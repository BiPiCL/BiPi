// /app/layout.js
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bi-pi-three.vercel.app';
const APP = process.env.NEXT_PUBLIC_BIPI_NAME || 'BiPi Chile';
const CONTACT = process.env.NEXT_PUBLIC_BIPI_CONTACT || 'bipichile2025@gmail.com';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${APP} — Comparador de precios de supermercados`,
    template: `%s | ${APP}`,
  },
  description:
    'Compara precios de supermercados en Chile (Líder, Jumbo, Unimarc y Santa Isabel) y encuentra el menor precio por producto.',
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: '/',
    siteName: APP,
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {/* ===== NAVBAR (carrito + nombre a la izquierda, enlaces a la derecha) ===== */}
        <header className="navbar" role="banner">
          <div className="nav-flex">
            <a href="/" className="brand" aria-label="Ir al inicio">
              <span className="brand-badge" aria-hidden>🛒</span>
              <span className="brand-name">BiPi Chile</span>
            </a>

            <nav className="nav-links" aria-label="Navegación principal">
              <a href="/">Inicio</a>
              <a href="/productos">Productos</a>
            </nav>
          </div>
        </header>

        {/* ===== CONTENIDO ===== */}
        <main className="container" id="main-content">
          {children}
        </main>

        {/* ===== FOOTER ===== */}
        <footer className="footer" role="contentinfo">
          <div>© {new Date().getFullYear()} {APP}</div>
          <div>Contacto: <a href={`mailto:${CONTACT}`}>{CONTACT}</a></div>
        </footer>
      </body>
    </html>
  );
}
