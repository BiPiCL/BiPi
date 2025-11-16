// supabase/functions/scraper/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ====== Helpers de scraping (adaptados de app/lib/scrape/common.js) ======

// 1) User-Agents “normales”
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.1 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/121.0 Safari/537.36",
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
async function fetchWithBackoff(url: string, opts: RequestInit = {}, attempt = 0): Promise<Response> {
  const headers = {
    "User-Agent": pickUA(),
    "Accept-Language": "es-CL,es;q=0.9",
    "Referer": "https://www.google.com/",
    ...(opts.headers || {}),
  };

  const res = await fetch(url, { ...opts, headers, cache: "no-store" });

  if ([429, 503].includes(res.status) && attempt < 4) {
    const wait = Math.min(20000, 500 * 2 ** attempt + Math.random() * 500);
    await new Promise((r) => setTimeout(r, wait));
    return fetchWithBackoff(url, opts, attempt + 1);
  }

  return res;
}

// 4) Parser genérico de CLP desde HTML
function parseCLPFromHTML(html: string | null): number | null {
  if (!html) return null;
  const text = String(html).replace(/\s+/g, " ");
  const regex = /(?:\$|\b)\s?(\d{1,3}(?:\.\d{3}){0,3})(?:,\d+)?/g;

  const candidates: number[] = [];
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    const raw = m[1]; // ej: "1.290"
    const num = parseInt(raw.replace(/\./g, ""), 10);
    if (!Number.isNaN(num)) candidates.push(num);
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => a - b);
  const filtered = candidates.filter((v) => v >= 100 && v <= 1_000_000);
  return filtered.length ? filtered[0] : candidates[0];
}

// ====== Edge Function principal ======

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
      return json({ ok: false, error: "Faltan variables de entorno" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Permitir ?limit=XX para probar pocos productos
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 0;

    // 1) Leer store_products con ext_sku válido
    let query = supabase
      .from("store_products")
      .select("id, store_slug, ext_sku")
      .not("ext_sku", "is", null)
      .neq("ext_sku", "")
      .neq("ext_sku", "EMPTY")
      .neq("ext_sku", "search");

    if (limit && Number.isFinite(limit) && limit > 0) {
      query = query.limit(limit);
    }

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

    // 2) Recorrer productos
    for (const row of rows) {
      const { id: storeProductId, store_slug, ext_sku } = row as {
        id: string;
        store_slug: string;
        ext_sku: string;
      };

      const productUrl = buildProductUrl(store_slug, ext_sku);
      if (!productUrl) {
        results.push({ storeProductId, store_slug, status: "no-url-pattern" });
        continue;
      }

      try {
        await humanDelay(500, 1500); // pequeño descanso entre requests

        const res = await fetchWithBackoff(productUrl);
        if (!res.ok) {
          console.warn(`HTTP ${res.status} en ${productUrl}`);
          results.push({
            storeProductId,
            store_slug,
            status: "http-error",
            httpStatus: res.status,
          });
          continue;
        }

        const html = await res.text();
        const price = parseCLPFromHTML(html);

        if (price === null) {
          // Registrar como no disponible
          const { error: insError } = await supabase.from("prices").insert({
            store_product_id: storeProductId,
            price_clp: 0,
            disponible: false,
          });

          if (insError) {
            console.error("Error insertando price (no disponible):", insError);
            results.push({
              storeProductId,
              store_slug,
              status: "insert-error",
              error: insError.message,
            });
          } else {
            results.push({
              storeProductId,
              store_slug,
              status: "no-price-found",
            });
          }
        } else {
          // Insertar precio encontrado
          const { error: insError } = await supabase.from("prices").insert({
            store_product_id: storeProductId,
            price_clp: price,
            disponible: true,
          });

          if (insError) {
            console.error("Error insertando price:", insError);
            results.push({
              storeProductId,
              store_slug,
              status: "insert-error",
              error: insError.message,
            });
          } else {
            console.log(`OK [${store_slug}] ${ext_sku} → ${price}`);
            results.push({
              storeProductId,
              store_slug,
              status: "ok",
              price,
            });
          }
        }
      } catch (e) {
        console.error("Error scrappeando", store_slug, ext_sku, e);
        results.push({
          storeProductId,
          store_slug,
          status: "scrape-error",
          error: String(e),
        });
      }
    }

    return json({ ok: true, processed: results.length, results });
  } catch (e) {
    console.error("Error inesperado en scraper:", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});

/* ===== Helpers locales ===== */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// Construcción de URL según tienda + ext_sku
function buildProductUrl(storeSlug: string, extSku: string): string | null {
  if (!extSku) return null;

  switch (storeSlug) {
    case "lider":
      // Ajustable según el patrón real de tus URLs de Lider.
      // Si tus ext_sku son sólo códigos (ej: 00228610000000),
      // revisa en el navegador cuál es el patrón más estable y cámbialo aquí.
      return `https://super.lider.cl/ip/panaderia-granel/${extSku}`;

    case "jumbo":
      // En muchos casos las URLs de Jumbo son /<slug>/p
      // Si tu ext_sku viene sin el /p final, lo agregamos.
      return `https://www.jumbo.cl/${extSku}/p`;

    case "unimarc":
      // Tus URLs parecen ser /product/<slug>
      return `https://www.unimarc.cl/product/${extSku}`;

    case "santa-isabel":
      // Similar a Unimarc (ajusta si es distinto)
      return `https://www.santaisabel.cl/product/${extSku}`;

    default:
      return null;
  }
}

