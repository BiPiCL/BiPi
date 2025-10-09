import './globals.css';

export const metadata = {
  title: 'BiPi Chile — Comparador de precios',
  description: 'Compara precios de supermercados en Chile (Líder, Jumbo, Unimarc, Santa Isabel).',
};

export default function RootLayout({ children }) {
  const APP = process.env.NEXT_PUBLIC_BIPI_NAME || 'BiPi Chile';

  return (
    <html lang="es">
      <body>
        {/* HEADER: marca a la izquierda, navegación a la derecha (también en móvil) */}
        <header className="navbar">
          <div className="container nav-flex">
            <a href="/" className="brand" aria-label={`${APP} inicio`}>
              <div className="brand-badge" aria-hidden>🛒</div>
              <span className="brand-name">{APP}</span>
            </a>

            <nav className="nav-links" aria-label="Navegación principal">
              <a href="/">Inicio</a>
              <a href="/productos">Productos</a>
            </nav>
          </div>
        </header>

        {/* CONTENIDO */}
        <main className="container">{children}</main>

        {/* FOOTER: dos líneas separadas, buen espaciado */}
        <footer className="footer">
          <div>© {new Date().getFullYear()} {APP} — Comparador de precios</div>
          <div>Contacto: {process.env.NEXT_PUBLIC_BIPI_CONTACT || 'bipichile2025@gmail.com'}</div>
        </footer>
      </body>
    </html>
  );
}
