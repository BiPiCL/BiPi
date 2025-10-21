// app/lib/scrape/common.js

// 1) User-Agents “normales” para que las peticiones parezcan de navegadores reales.
//    Puedes agregar más; rotamos uno al azar en cada request.
export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/121.0 Safari/537.36',
];

export function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// 2) Pequeña espera aleatoria (para no golpear a los sitios tan seguido)
export function humanDelay(min = 600, max = 1800) {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((res) => setTimeout(res, ms));
}

// 3) fetch con backoff: ante 429/503 reintenta con esperas crecientes.
//    Mantiene headers razonables (UA/idioma/referer) y desactiva cache.
export async function fetchWithBackoff(url, opts = {}, attempt = 0) {
  const headers = {
    'User-Agent': pickUA(),
    'Accept-Language': 'es-CL,es;q=0.9',
    'Referer': 'https://www.google.com/',
    ...(opts.headers || {}),
  };

  const res = await fetch(url, { ...opts, headers, cache: 'no-store' });

  // Si el sitio limita (429) o está saturado (503), reintentamos unas veces
  if ([429, 503].includes(res.status) && attempt < 4) {
    const wait = Math.min(20000, 500 * 2 ** attempt + Math.random() * 500);
    await new Promise((r) => setTimeout(r, wait));
    return fetchWithBackoff(url, opts, attempt + 1);
  }

  return res;
}

// 4) Parser genérico de CLP para empezar:
//    - Busca patrones tipo $1.290, 1.290, 15.990
//    - Devuelve un número entero (CLP) o null si no encuentra
export function parseCLPFromHTML(html) {
  if (!html) return null;

  // Removemos espacios repetidos para facilitar el match
  const text = String(html).replace(/\s+/g, ' ');

  // Busca números con formato chileno de miles (puntos) y opcional $
  const regex = /(?:\$|\b)\s?(\d{1,3}(?:\.\d{3}){0,3})(?:,\d+)?/g;
  const candidates = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    const raw = m[1]; // ej: "1.290" o "15.990"
    const num = parseInt(raw.replace(/\./g, ''), 10);
    if (!Number.isNaN(num)) candidates.push(num);
  }

  if (candidates.length === 0) return null;

  // Heurística simple: el menor razonable suele ser el precio unitario
  // (evita tomar totales enormes de combos/banners)
  candidates.sort((a, b) => a - b);

  // Descarta valores extremos (demasiado bajos o altos)
  const filtered = candidates.filter((v) => v >= 100 && v <= 1000000);
  return filtered.length ? filtered[0] : candidates[0];
}
