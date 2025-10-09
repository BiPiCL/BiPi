import './globals.css';

export const metadata = {
  title: 'BiPi Chile — Comparador de Precios',
  description: 'Compara precios de supermercados chilenos en un solo lugar.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <header className="navbar">
          <div className="nav-inner">
            <a href="/" className="brand" aria-label="Inicio BiPi Chile">
              <div className="brand-badge">🛒</div>
              {process.env.NEXT_PUBLIC_BIPI_NAME || 'BiPi Chile'}
            </a>
            <nav className="nav-links" aria-label="Navegación principal">
              <a href="/">Inicio</a>
              <a href="/productos">Productos</a>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer>
          <span>© {new Date().getFullYear()} {process.env.NEXT_PUBLIC_BIPI_NAME || 'BiPi Chile'}</span>
          <span>Contacto: {process.env.NEXT_PUBLIC_BIPI_CONTACT || 'bipichile2025@gmail.com'}</span>
        </footer>
      </body>
    </html>
  );
}
