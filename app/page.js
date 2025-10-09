// app/page.js

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Título principal */}
      <h1 className="text-3xl sm:text-4xl font-extrabold text-bipi-title text-center">
        Bienvenido a BiPi Chile
      </h1>

      {/* Párrafo introductorio (justificado) */}
      <p className="mt-4 text-bipi-muted text-justify leading-relaxed">
        Tu comparador de precios de supermercados en Chile. Compara productos
        esenciales como arroz, aceite, fideos, papel higiénico y más entre
        Líder, Jumbo, Unimarc y Santa Isabel.
      </p>

      {/* Banner / Hero con botón amarillo */}
      <section
        aria-label="Banner destacado"
        className="mt-8 relative rounded-2xl bg-gradient-to-br from-[#1946D2] to-[#1E90FF] p-6 sm:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden"
      >
        {/* halo suave */}
        <div className="pointer-events-none absolute -inset-24 rounded-[100%] bg-white/10 blur-3xl" />

        {/* Chip BiPi: texto blanco */}
        <div className="relative mx-auto w-fit">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur text-white shadow-inner">
            <span aria-hidden="true" className="text-lg">🛒</span>
            <span className="font-semibold tracking-wide">BiPi Chile</span>
          </div>
        </div>

        {/* Título grande con ícono dinero alineado */}
        <h2 className="relative mt-6 text-center text-white font-extrabold text-2xl sm:text-3xl md:text-4xl">
          <span className="inline-block align-middle">Compara precios y ahorra</span>
          <span aria-hidden="true" className="inline-block align-middle ml-2">💰</span>
        </h2>

        {/* Subtítulo (justificado en mobile, centrado en desktop) */}
        <p className="relative mt-4 text-white/95 text-justify sm:text-center leading-relaxed">
          Encuentra los mejores precios de supermercados en la Región del Biobío — todo en un solo lugar.
        </p>

        {/* Botón CTA */}
        <div className="relative mt-6 flex justify-center">
          <a
            href="/productos"
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 bg-[#FFD029] text-[#1B1B1B] font-semibold shadow-[0_10px_30px_rgba(255,208,41,0.35)] hover:translate-y-[-1px] transition-transform"
          >
            <span aria-hidden="true">🛍️</span>
            Ver productos
          </a>
        </div>
      </section>

      {/* Tiendas conectadas (alineadas a la izquierda) */}
      <section className="mt-10">
        <h3 className="text-lg font-semibold text-bipi-title">
          Tiendas conectadas a BiPi Chile:
        </h3>

        <ul className="mt-3 space-y-2 list-disc pl-5 text-bipi-muted">
          <li>
            <a className="text-bipi-link hover:underline" href="https://www.jumbo.cl" target="_blank" rel="noreferrer">
              Jumbo
            </a>{' '}
            <span className="text-sm text-gray-500">(jumbo)</span>
          </li>
          <li>
            <a className="text-bipi-link hover:underline" href="https://www.lider.cl" target="_blank" rel="noreferrer">
              Líder
            </a>{' '}
            <span className="text-sm text-gray-500">(lider)</span>
          </li>
          <li>
            <a className="text-bipi-link hover:underline" href="https://www.santaisabel.cl" target="_blank" rel="noreferrer">
              Santa Isabel
            </a>{' '}
            <span className="text-sm text-gray-500">(santa-isabel)</span>
          </li>
          <li>
            <a className="text-bipi-link hover:underline" href="https://www.unimarc.cl" target="_blank" rel="noreferrer">
              Unimarc
            </a>{' '}
            <span className="text-sm text-gray-500">(unimarc)</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
