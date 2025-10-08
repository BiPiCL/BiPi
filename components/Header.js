'use client';
import React from 'react';

export default function Header() {
  return (
    <header className="navbar">
      <div className="container nav-inner">
        <a href="/" className="brand" aria-label="Inicio BiPi Chile">
          <span className="brand-badge" aria-hidden>🛒</span>
          <span>BiPi Chile</span>
        </a>
        <nav className="nav-links" aria-label="Navegación principal">
          <a href="/">Inicio</a>
          <a href="/productos">Productos</a>
        </nav>
      </div>
    </header>
  );
}
