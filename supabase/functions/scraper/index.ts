// supabase/functions/scraper/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ====== Helpers de scraping ======

// 1) User-Agents “normales”
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.1 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/121.0 Safari/537.36"
];

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// 2) Espera aleatoria “humana”
function humanDelay(min = 600, max = 1800) {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((res) => setTimeout(res, ms));
}

// 3) fetch con backoff
async function fetchWithBackoff(
  url: string,
  opts: RequestInit = {},
  attempt = 0
): Promise<Response> {
  const headers = {
    "User-Agent": pickUA(),
    "Accept-Language": "es-CL,es;q=0.9",
    "Referer": "https://www.google.com/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

// 4) Parser de precios CLP mejorado (JSON-LD + heurística)
function parseCLPFromHTML(html: string | null): number | null {
  if (!html) return null;
  const text = String(html);

  // A) Intentar JSON-LD
  const jsonLdPrices: number[] = [];
  const jsonLdRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jm: RegExpExecArray | null;

  while ((jm = jsonLdRegex.exec(text)) !== null) {
    const rawJson = jm[1].trim();
    try {
      const parsed = JSON.parse(rawJson);

      const walk = (node: any) => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node === "object") {
          if (node.offers) walk(node.offers);
          if (node.priceSpecification) walk(node.priceSpecification);

          if (node.price) {
            const p = Number(String(node.price).replace(/[^\d]/g, ""));
            if (Number.isFinite(p) && p >= 500) jsonLdPrices.push(p);
          }
          for (const k of Object.keys(node)) walk(node[k]);
        }
      };

      walk(parsed);
    } catch {}
  }

  if (jsonLdPrices.length) {
    jsonLdPrices.sort((a, b) => a - b);
    return jsonLdPrices[0];
  }

  // B) Buscar "price": 2590 en scripts
  const scriptPrices: number[] = [];
  const priceKeyRegex = /"price"\s*:\s*"?(\d{3,7})"?/gi;
  let pm: RegExpExecArray | null;

  while ((pm = priceKeyRegex.exec(text)) !== null) {
    const p = Number(pm[1]);
    if (Number.isFinite(p) && p >= 500 && p <= 1_000_000) {
      scriptPrices.push(p);
    }
  }

  if (scriptPrices.length) {
    scriptPrices.sort((a, b) => a - b);
    return scriptPrices[0];
  }

  // C) Fallback: $1.990 etc evitando pesos/unidades
  const cleaned = text.replace(/\s+/g, " ");
  const dollarRegex = /\$\s?(\d{1,3}(?:\.\d{3}){0,3})(?:,\d+)?/g;

  const candidates: number[] = [];
  let m: RegExpExecArray | null;

  while ((m = dollarRegex.exec(cleaned)) !== null) {
    const raw = m[1];
    const num = parseInt(raw.replace(/\./g, ""), 10);
    if (Number.isNaN(num)) continue;

    const idx = m.index;
    const ctx = cleaned.slice(Math.max(0, idx - 8), idx + 12).toLowerCase();
    if (/(g|kg|gr|ml|lt|l|%|un|uds)/.test(ctx)) continue;

    if (num >= 500 && num <= 1_000_000) candidates.push(num);
  }

  if (!candidates.length) return null;

  // D) moda (más repetido); si no, menor razonable
  const freq = new Map<number, number>();
  for (const c of candidates) freq.set(c, (freq.get(c) || 0) + 1);

  let best = candidates[0];
  let bestCount = 0;
  for (const [val, count] of freq.entries()) {
    if (count > bestCount || (count === bestCount && val < best)) {
      best = val;
      bestCount = count;
    }
  }

  return best;
}

// ====== Edge Function principal ======
serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: "Faltan variables de entorno" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 0;

    let query = supabase
      .from("store_products")
      .select("id, store_slug, ext_sku")
      .not("ext_sku", "is", null)
      .neq("ext_sku", "")
      .neq("ext_sku", "EMPTY")
      .neq("ext_sku", "search");

    if (limit && limit > 0) query = query.limit(limit);

    const { data: rows, error } = await query;
    if (error) return json({ ok: false, error: error.message }, 500);

    if (!rows?.length) {
      return json({ ok: true, message: "No hay productos para scrapear" });
    }

    const results: any[] = [];

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
          results.push({
            storeProductId,
            store_slug,
            status: "http-error",
            httpStatus: res.status
          });
          continue;
        }

        const html = await res.text();
        const price = parseCLPFromHTML(html);

        if (price == null) {
          await supabase.from("prices").insert({
            store_product_id: storeProductId,
            price_clp: 0,
            disponible: false
          });
          results.push({ storeProductId, store_slug, status: "no-price-found" });
        } else {
          await supabase.from("prices").insert({
            store_product_id: storeProductId,
            price_clp: price,
            disponible: true
          });
          results.push({ storeProductId, store_slug, status: "ok", price });
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

// ✅ URLs por tienda
function buildProductUrl(storeSlug: string, extSku: string): string | null {
  if (!extSku) return null;

  switch (storeSlug) {
    case "lider":
      return `https://super.lider.cl/ip/panaderia-granel/${extSku}`;

    case "jumbo":
      // 🔥 CAMBIO CLAVE: usamos el host SSR de smdigital
      // que normalmente trae precio en HTML.
      return `https://cl-jumbo-web-lb-render-v2.smdigital.cl/${extSku}/p`;

    case "unimarc":
      return `https://www.unimarc.cl/product/${extSku}`;

    case "santa-isabel":
      return `https://www.santaisabel.cl/product/${extSku}`;

    default:
      return null;
  }
}
