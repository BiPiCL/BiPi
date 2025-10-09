export default function Home() {
  const APP = process.env.NEXT_PUBLIC_BIPI_NAME || 'BiPi Chile';
  const CONTACT = process.env.NEXT_PUBLIC_BIPI_CONTACT || 'bipichile2025@gmail.com';

  return (
    <>
      {/* TÍTULO */}
      <h1 className="page-title">Bienvenido a {APP}</h1>

      {/* PÁRRAFO JUSTIFICADO (antes del banner) */}
      <p className="lead">
        Tu comparador de precios de supermercados en Chile. Compara productos esenciales como arroz,
        aceite, fideos, papel higiénico y más entre Líder, Jumbo, Unimarc y Santa Isabel.
      </p>

      {/* BANNER (azul). Botón siempre visible. Título en una línea con bolsa 💰 */}
      <section className="hero">
        <div className="hero-center">
          <div className="hero-badge">
            <span className="hero-cart">🛒</span>
            <strong>{APP}</strong>
          </div>

          {/* Título + bolsa en una línea; se ajusta en móviles */}
          <h2 className="hero-title">
            <span>Compara precios y ahorra</span>
            <span className="hero-money" aria-hidden>💰</span>
          </h2>

          {/* Párrafo justificado dentro del banner */}
          <p className="hero-text">
            Encuentra los mejores precios de supermercados en la Región del Biobío — todo en un solo lugar.
          </p>

          <a href="/productos" className="hero-btn">
            🛍️ Ver productos
          </a>
        </div>
      </section>

      {/* LISTA DE TIENDAS (alineada a la izquierda) */}
      <section className="content-left">
        <h3 className="section-title">Tiendas conectadas a {APP}:</h3>
        <ul className="stores">
          <li>
            <a href="https://www.jumbo.cl" target="_blank" rel="noopener noreferrer">Jumbo</a>
            <span className="muted"> (jumbo)</span>
          </li>
          <li>
            <a href="https://www.lider.cl" target="_blank" rel="noopener noreferrer">Líder</a>
            <span className="muted"> (lider)</span>
          </li>
          <li>
            <a href="https://www.santaisabel.cl" target="_blank" rel="noopener noreferrer">Santa Isabel</a>
            <span className="muted"> (santa-isabel)</span>
          </li>
          <li>
            <a href="https://www.unimarc.cl" target="_blank" rel="noopener noreferrer">Unimarc</a>
            <span className="muted"> (unimarc)</span>
          </li>
        </ul>

        <p className="contact">Contacto: <a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
      </section>
    </>
  );
}
