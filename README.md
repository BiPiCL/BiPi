# BiPi (Next.js + Supabase) — Starter mínimo

## Cómo desplegar en Vercel
1) Sube estos archivos a un repositorio (GitHub).
2) En Vercel → New Project → importa el repositorio.
3) En Settings → Environment Variables agrega:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - NEXT_PUBLIC_CONTACT_EMAIL (opcional)
4) Deploy. Abre el dominio temporal (por ej. bipi.vercel.app).