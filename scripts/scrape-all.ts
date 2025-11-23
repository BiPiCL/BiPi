import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import pLimit from "p-limit";
import { chromium } from "playwright";

import { scrapeLider } from "./scrapers/lider";
import { scrapeUnimarc } from "./scrapers/unimarc";
import { scrapeTottus } from "./scrapers/tottus";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type TargetRow = {
  store_product_id: string;
  product_id: string;
  store_slug: "lider" | "unimarc" | "tottus" | "jumbo" | "santaisabel";
  url: string;
};

async function main() {
  console.log("▶ Iniciando scraping...");

  const { data: targets, error } = await supabase
    .from("v_product_urls")
    .select("store_product_id, product_id, store_slug, url");

  if (error) throw error;
  if (!targets?.length) {
    console.log("🟠 No hay datos en v_product_urls");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const limit = pLimit(3);

  const results = await Promise.all(
    (targets as TargetRow[]).map(t =>
      limit(async () => {
        const page = await browser.newPage({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
          locale: "es-CL",
        });

        try {
          let price = 0;

          if (t.store_slug === "lider") price = await scrapeLider(page, t.url);
          if (t.store_slug === "unimarc") price = await scrapeUnimarc(page, t.url);
          if (t.store_slug === "tottus") price = await scrapeTottus(page, t.url);

          if (t.store_slug === "jumbo" || t.store_slug === "santaisabel") {
            return { ...t, price: 0, ok: false as const, error: "bloqueado" };
          }

          console.log(`✅ ${t.store_slug} => $${price}`);
          return { ...t, price, ok: true as const };
        } catch (e: any) {
          console.log(`❌ ${t.store_slug} ERROR:`, e?.message);
          return { ...t, price: 0, ok: false as const, error: e?.message };
        } finally {
          await page.close();
        }
      })
    )
  );

  await browser.close();

  const rowsToInsert = results
    .filter(r => r.ok && r.price > 0)
    .map(r => ({
      store_product_id: r.store_product_id,
      price_clp: r.price,
      disponible: true,
      captured_at: new Date().toISOString(),
    }));

  if (rowsToInsert.length) {
    const { error: insErr } = await supabase.from("prices").insert(rowsToInsert);
    if (insErr) throw insErr;
    console.log(`🟢 Guardados ${rowsToInsert.length} precios`);
  } else {
    console.log("🟠 No hubo precios buenos para guardar");
  }
}

main().catch(err => {
  console.error("💥 Falló scraping:", err);
  process.exit(1);
});

