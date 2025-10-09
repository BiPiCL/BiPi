'use client';

import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="container">
      {/* Título principal */}
      <h1 className="title">Bienvenido a BiPi Chile</h1>

      {/* Intro debajo del título (justificado) */}
      <p className="intro">
        Tu comparador de precios de supermercados en Chile. Compara productos
        esenciales como arroz, aceite, fideos, papel higiénico y más entre
        <b> Líder, Jumbo, Unimarc y Santa Isabel</b>.
      </p>

      {/* HERO / Banner azul */}
      <section className="hero" aria-label="Sección de llamado principal">
        {/* Chip con carrito + nombre (SIEMPRE blanco) */}
        <div className="chip">
          <span className="chip-icon" aria-hidden>🛒</span>
          <span className="chip-text">BiPi Chile</span>
        </div>

        {/* Título grande + ícono al lado (en una sola línea en desktop) */}
        <h2 className="hero-title">
          <span>Compara precios y ahorra</span>
          <span className="hero-bag" aria-hidden>💰</span>
        </h2>

        {/* Frase secundaria en blanco, justificada */}
        <p className="hero-sub">
          Encuentra los mejores precios de supermercados en la Región del Biobío — todo en un solo lugar.
        </p>

        {/* Botón amarillo */}
        <Link href="/productos" className="cta-btn" aria-label="Ir a ver productos">
          <span className="cta-emoji" aria-hidden>🛍️</span>
          Ver productos
        </Link>
      </section>

      {/* Listado de tiendas (alineado a la izquierda) */}
      <section className="stores">
        <h3>Tiendas conectadas a BiPi Chile:</h3>
        <ul>
          <li><a href="https://www.jumbo.cl" target="_blank" rel="noreferrer">Jumbo</a> <small>(jumbo)</small></li>
          <li><a href="https://www.lider.cl" target="_blank" rel="noreferrer">Líder</a> <small>(lider)</small></li>
          <li><a href="https://www.santaisabel.cl" target="_blank" rel="noreferrer">Santa Isabel</a> <small>(santa-isabel)</small></li>
          <li><a href="https://www.unimarc.cl" target="_blank" rel="noreferrer">Unimarc</a> <small>(unimarc)</small></li>
        </ul>
      </section>
    </main>
  );
}
