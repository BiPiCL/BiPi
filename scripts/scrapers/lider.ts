import { Page } from "playwright";

export async function scrapeLider(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

  const jsonLd = await page.$$eval('script[type="application/ld+json"]', els =>
    els.map(e => e.textContent || "").filter(Boolean)
  );

  for (const block of jsonLd) {
    try {
      const data = JSON.parse(block);
      const items = Array.isArray(data) ? data : [data];
      for (const it of items) {
        const price = it?.offers?.price || it?.offers?.lowPrice;
        if (price) return normalizePrice(price);
      }
    } catch {}
  }

  const priceText = await page
    .locator('[data-testid="product-price"], .prices-main-price, .price')
    .first()
    .innerText()
    .catch(() => "");

  const price = normalizePrice(priceText);
  if (!price) throw new Error("No se encontró precio en Lider");
  return price;
}

function normalizePrice(value: any): number {
  const str = String(value).replace(/\./g, "").replace(/[^\d]/g, "");
  const n = Math.round(Number(str));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

