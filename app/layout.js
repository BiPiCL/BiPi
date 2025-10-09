export default function Home() {
  return (
    <section className="hero">
      <div className="hero-center">
        <div className="hero-badge">
          <span>🛒</span> <strong>BiPi Chile</strong>
        </div>
        <h1>Encuentra los mejores precios en supermercados chilenos</h1>
        <p>
          Compara precios en tiempo real entre Lider, Jumbo, Unimarc y Santa Isabel.
        </p>
        <a href="/productos" className="hero-btn">
          Ver productos →
        </a>
      </div>
    </section>
  );
}
