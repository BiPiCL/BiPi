// supabase/functions/scraper/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ====== Helpers de scraping ======

// 1) User-Agents normales
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.1 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/121.0 Safari/537.36"
];

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// 2) Espera aleatoria humana
function humanDelay(min = 600, max = 1800) {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((res) => setTimeout(res, ms));
}

// 3) Fetch con backoff
async function fetchWithBackoff(url: string, opts: RequestInit = {}, attempt = 0): Promise<Response> {
  const headers = {
    "User-Agent": pickUA(),
    "Accept-Language": "es-CL,es;q=0.9",
    "Referer": "https://www.google.com/",
    ...(opts.headers || {})
  };

  const res = await fetch(url, {
    ...opts,
    headers,
    cache: "no-store"
  });

  if ([429, 503].includes(res.status) && attempt < 4) {
    const wait = Math.min(20000, 500 * 2 ** attempt + Math.random() * 500);
    await new Promise((r) => setTimeout(r, wait));
    return fetchWithBackoff(url, opts, attempt + 1);
  }

  return res;
}

// 4) Parser de precios CLP mejorado
function parseCLPFromHTML(html: string | null): number | null {
  if (!html) return null;

  const text = String(html).replace(/\s+/g, " ");

  // Primero buscar precios con $
  const dollarRegex = /\$\s?(\d{1,3}(?:\.\d{3}){0,3})(?:,\d+)?/g;
  const dollarCandidates: number[] = [];
  let m: RegExpExecArray | null;

  while ((m = dollarRegex.exec(text)) !== null) {
    const raw = m[1];
    const num = parseInt(raw.replace(/\./g, ""), 10);
    if (!Number.isNaN(num)) dollarCandidates.push(num);
  }

  if (dollarCandidates.length) {
    dollarCandidates.sort((a, b) => a - b);
    const filtered = dollarCandidates.filter((v) => v >= 500 && v <= 1_000_000);
    return filtered.length ? filtered[0] : dollarCandidates[0];
  }

  // Fallback: números sin $, evitando valores chicos (100, 200, 300)
  const genericRegex = /(?:\b)\s?(\d{1,3}(?:\.\d{3}){0,3})(?:,\d+)?/g;
  const candidates: number[] = [];

  while ((m = genericRegex.exec(text)) !== null) {
    const raw = m[1];
    const num = parseInt(raw.replace(/\./g, ""), 10);
    if (!Number.isNaN(num)) candidates.push(num);
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => a - b);
  const filtered = candidates.filter((v) => v >= 500 && v <= 1_000_000);

  return filtered.length ? filtered[0] : candidates[candidates.length - 1];
}

// =====================================================
// ===============   EDGE FUNCTION     =================
// =====================================================

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY"); // usamos el editable

    if (!supabaseUrl || !serviceKey) {
      console.error("Faltan SUPABASE_URL o SERVICE_ROLE_KEY");
      return json(
        { ok: false, error: "Faltan variables de entorno" },
        500
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    // Leer ?limit
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 0;

    // Leer store_products con ext_sku válido
    let query = supabase
      .from("store_products")
      .select("id, store_slug, ext_sku")
      .not("ext_sku", "is", null)
      .neq("ext_sku", "")
      .neq("ext_sku", "EMPTY")
      .neq("ext_sku", "search");

    if (limit && limit > 0) query = query.limit(limit);

    const { data: rows, error: spError } = await query;

    if (spError) {
      console.error("Error leyendo store_products:", spError);
      return json({ ok: false, error: spError.message }, 500);
    }

    if (!rows || !rows.length) {
      return json({ ok: true, message: "No hay store_products con ext_sku válido" });
    }

    console.log(`Procesando ${rows.length} store_products`);
    const results: any[] = [];

    // Scraping por producto
    for (const row of rows as any[]) {
      const { id: storeProductId, store_slug, ext_sku } = row;

      const productUrl = buildProductUrl(store_slug, ext_sku);
      if (!productUrl) {
        results.push({ storeProductId, store_slug, status: "no-url-pattern" });
        continue;
      }

      try {
        await humanDelay(500, 1500);

        const res = await fetchWithBackoff(productUrl);
        if (!res.ok) {
          console.warn(`HTTP ${res.status} en ${productUrl}`);
          results.push({ storeProductId, store_slug, status: "http-error", httpStatus: res.status });
          continue;
        }

        const html = await res.text();
        const price = parseCLPFromHTML(html);

        if (price === null) {
          const { error: insError } = await supabase.from("prices").insert({
            store_product_id: storeProductId,
            price_clp: 0,
            disponible: false
          });

          if (insError) {
            results.push({ storeProductId, store_slug, status: "insert-error", error: insError.message });
          } else {
            results.push({ storeProductId, store_slug, status: "no-price-found" });
          }
        } else {
          const { error: insError } = await supabase.from("prices").insert({
            store_product_id: storeProductId,
            price_clp: price,
            disponible: true
          });

          if (insError) {
            results.push({ storeProductId, store_slug, status: "insert-error", error: insError.message });
          } else {
            results.push({ storeProductId, store_slug, status: "ok", price });
          }
        }
      } catch (e) {
        results.push({
          storeProductId,
          store_slug,
          status: "scrape-error",
          error: String(e)
        });
      }
    }

    return json({ ok: true, processed: results.length, results });

  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

// ===== Helpers =====
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function buildProductUrl(storeSlug: string, extSku: string): string | null {
  if (!extSku) return null;

  switch (storeSlug) {
    case "lider":
      return `https://super.lider.cl/ip/panaderia-granel/${extSku}`;

    case "jumbo":
      return `https://www.jumbo.cl/${extSku}/p`;

    case "unimarc":
      return `https://www.unimarc.cl/product/${extSku}`;

    case "santa-isabel":
      return `https://www.santaisabel.cl/product/${extSku}`;

    default:
      return null;
  }
}
