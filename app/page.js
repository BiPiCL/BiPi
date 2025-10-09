'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="container">
      {/* Título principal */}
      <h1 className="page-title">Bienvenido a BiPi Chile</h1>

      {/* Párrafo introductorio justificado */}
      <p className="lead">
        Tu comparador de precios de supermercados en Chile. Compara productos
        esenciales como arroz, aceite, fideos, papel higiénico y más entre
        <strong> Líder, Jumbo, Unimarc y Santa Isabel</strong>.
      </p>

      {/* HERO / Banner azul (clases ya definidas en tu globals.css) */}
      <section className="hero" aria-label="Sección destacada">
        <div className="hero-center">
          {/* Insignia dentro del hero: texto SIEMPRE blanco */}
          <div className="hero-badge">
            <span className="hero-cart" aria-hidden>🛒</span>
            <span>BiPi Chile</span>
          </div>

          <h2 className="hero-title">
            Compara precios y ahorra
            <span className="hero-money" aria-hidden>💰</span>
          </h2>

          <p className="hero-text">
            Encuentra los mejores precios de supermercados en la Región del Biobío — todo en un solo lugar.
          </p>

          <Link href="/productos" className="hero-btn" aria-label="Ver productos">
            <span aria-hidden>🛍️</span> Ver productos
          </Link>
        </div>
      </section>

      {/* Tiendas (alineadas a la izquierda) */}
      <section className="content-left">
        <h3 className="section-title">Tiendas conectadas a BiPi Chile:</h3>
        <ul className="stores">
          <li><a href="https://www.jumbo.cl" target="_blank" rel="noreferrer">Jumbo</a> <small>(jumbo)</small></li>
          <li><a href="https://www.lider.cl" target="_blank" rel="noreferrer">Líder</a> <small>(lider)</small></li>
          <li><a href="https://www.santaisabel.cl" target="_blank" rel="noreferrer">Santa Isabel</a> <small>(santa-isabel)</small></li>
          <li><a href="https://www.unimarc.cl" target="_blank" rel="noreferrer">Unimarc</a> <small>(unimarc)</small></li>
        </ul>
      </section>
    </main>
  );
}
