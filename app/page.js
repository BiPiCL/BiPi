export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Título y texto introductorio arriba del banner */}
      <h1 className="text-center text-3xl sm:text-4xl font-extrabold text-slate-800">
        Bienvenido a BiPi Chile
      </h1>

      <p className="mt-4 max-w-3xl mx-auto text-center text-slate-600 leading-relaxed">
        Tu comparador de precios de supermercados en Chile. Compara productos esenciales
        como arroz, aceite, fideos, papel higiénico y más entre Líder, Jumbo, Unimarc y Santa Isabel.
      </p>

      {/* Banner */}
      <section
        className="
          mt-8 sm:mt-10 mx-auto max-w-4xl
          rounded-3xl p-6 sm:p-10 text-center text-white
          relative overflow-hidden
          shadow-[0_20px_60px_-20px_rgba(30,64,175,.45)]
          bg-[linear-gradient(135deg,#1E3A8A_0%,#2563EB_100%)]
        "
      >
        {/* Brillos suaves */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-56 w-56 rounded-full blur-3xl opacity-30 bg-blue-400" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 rounded-full blur-3xl opacity-30 bg-indigo-500" />

        {/* Chip de marca (forzado a blanco) */}
        <div
          className="
            inline-flex items-center gap-2 px-4 py-2 rounded-full
            bg-white/15 backdrop-blur-md ring-1 ring-white/25
            text-white   /* <- forzado en blanco */
          "
        >
          <span className="text-xl">🛒</span>
          <span className="font-semibold">BiPi Chile</span>
        </div>

        {/* Título grande + emoji */}
        <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
          Compara precios y ahorra <span className="align-[-2px]">💰</span>
        </h2>

        {/* Subtítulo (justificado en móviles y centrado en desktop) */}
        <p className="mt-4 sm:mt-5 text-base sm:text-lg leading-relaxed text-white/95 text-justify sm:text-center">
          Encuentra los mejores precios de supermercados en la Región del Biobío — todo en un solo lugar.
        </p>

        {/* Botón */}
        <a
          href="/productos"
          className="
            inline-flex items-center gap-2 mt-6 sm:mt-8
            px-6 sm:px-7 py-3 rounded-full
            bg-yellow-400 text-slate-900 font-semibold
            shadow-[0_12px_30px_-12px_rgba(234,179,8,.65)]
            hover:translate-y-[-1px] hover:shadow-[0_16px_40px_-12px_rgba(234,179,8,.75)]
            transition-transform
          "
        >
          🛍️ <span>Ver productos</span>
        </a>
      </section>

      {/* Bloque “Tiendas conectadas” (alineado a la izquierda) */}
      <section className="mt-10 sm:mt-12">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-800">
          Tiendas conectadas a BiPi Chile:
        </h3>
        <ul className="mt-4 space-y-2 text-slate-700 list-disc list-inside">
          <li><a className="underline underline-offset-2 hover:text-blue-700" href="https://www.jumbo.cl/" target="_blank" rel="noreferrer">Jumbo</a> <span className="text-slate-400 text-sm">(jumbo)</span></li>
          <li><a className="underline underline-offset-2 hover:text-blue-700" href="https://www.lider.cl/" target="_blank" rel="noreferrer">Líder</a> <span className="text-slate-400 text-sm">(lider)</span></li>
          <li><a className="underline underline-offset-2 hover:text-blue-700" href="https://www.santaisabel.cl/" target="_blank" rel="noreferrer">Santa Isabel</a> <span className="text-slate-400 text-sm">(santa-isabel)</span></li>
          <li><a className="underline underline-offset-2 hover:text-blue-700" href="https://www.unimarc.cl/" target="_blank" rel="noreferrer">Unimarc</a> <span className="text-slate-400 text-sm">(unimarc)</span></li>
        </ul>
      </section>

      {/* Footer simple, en dos líneas separadas en móvil/desktop */}
      <footer className="mt-10 sm:mt-12 text-center text-sm text-slate-500 space-y-1">
        <div>© 2025 BiPi Chile — Comparador de precios</div>
        <div>Contacto: <a className="underline" href="mailto:bipichile2025@gmail.com">bipichile2025@gmail.com</a></div>
      </footer>
    </main>
  );
}
