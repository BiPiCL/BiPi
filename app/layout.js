// app/layout.js
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bi-pi.vercel.app';
const APP = process.env.NEXT_PUBLIC_BIPI_NAME || 'BiPi Chile';
const CONTACT = process.env.NEXT_PUBLIC_BIPI_CONTACT || 'bipichile2025@gmail.com';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${APP} — Comparador de precios de supermercados`,
    template: `%s | ${APP}`,
  },
  description:
    'Compara precios de supermercados en Chile (Líder, Jumbo, Unimarc, Santa Isabel) y encuentra el menor precio por producto.',
  keywords: [
    'comparador de precios',
    'supermercados Chile',
    'Líder',
    'Jumbo',
    'Unimarc',
    'Santa Isabel',
    'ahorrar',
    'ofertas',
    'Concepción',
    'Talcahuano',
  ],
  applicationName: APP,
  authors: [{ name: APP }],
  creator: APP,
  publisher: APP,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: '/',
    siteName: APP,
    title: `${APP} — Compara precios y ahorra`,
    description:
      'Compara precios de supermercados en Chile (Líder, Jumbo, Unimarc, Santa Isabel) y encuentra el menor precio por producto.',
    images: [
      {
        url: '/og-image.jpg', // súbela a /public
        width: 1200,
        height: 630,
        alt: `${APP} — Comparador de precios de supermercados`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP} — Compara precios y ahorra`,
    description:
      'Compara precios de supermercados en Chile (Líder, Jumbo, Unimarc, Santa Isabel).',
    images: ['/og-image.jpg'],
    creator: '@bipi', // opcional
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
  themeColor: '#1E3A8A',
  category: 'shopping',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {/* Skip link (Accesibilidad: permite saltar el navbar con teclado) */}
        <a href="#main-content" className="skip-link">Saltar al contenido</a>

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
        <main id="main-content" className="container">
          {children}
        </main>

        {/* FOOTER: dos líneas separadas, buen espaciado */}
        <footer className="footer" role="contentinfo">
          <div>© {new Date().getFullYear()} {APP} — Comparador de precios</div>
          <div>Contacto: {CONTACT}</div>
        </footer>
      </body>
    </html>
  );
}
