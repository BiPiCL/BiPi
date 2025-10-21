// app/lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

// Estas variables deben existir en Vercel y en tu entorno local (.env.local)
// - NEXT_PUBLIC_SUPABASE_URL           (YA la tienes)
// - SUPABASE_SERVICE_ROLE_KEY          (agregada en el Paso 0 A)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Si falta alguna variable, lanzamos un error al iniciar el servidor.
// (Así nos enteramos de inmediato.)
if (!url || !serviceKey) {
  throw new Error(
    'Faltan variables de entorno de Supabase en el servidor: ' +
      'NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY'
  );
}

// Cliente "admin" para usar SOLO en el servidor (nunca en el navegador).
// Este cliente permite escribir en tablas (lo usará el robot/cron).
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { 'X-Client-Info': 'bipi-scraper/1.0' } },
});
