'use client';
import React from 'react';

export default function Header() {
  return (
    <header className="bipi-header">
      <div className="bipi-container bipi-header-inner">
        <a className="bipi-logo" href="/">
          <span className="bipi-logo-icon" aria-hidden="true">🛒</span>
          <span className="bipi-logo-text">BiPi</span>
        </a>
        <nav className="bipi-nav">
          <a className="bipi-nav-link" href="/">Inicio</a>
          <a className="bipi-nav-link" href="/productos">Productos</a>
        </nav>
      </div>
    </header>
  );
}
