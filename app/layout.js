// app/layout.js
import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'BiPi Chile — Comparador de precios',
  description: 'Compara precios de supermercados en Chile (Líder, Jumbo, Unimarc y Santa Isabel).',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <header className="navbar">
          <div className="container">
            <Link href="/" className="logo">
              <span className="icon">🛒</span> BiPi Chile
            </Link>
            <nav>
              <Link href="/">Inicio</Link>
              <Link href="/productos">Productos</Link>
            </nav>
          </div>
        </header>

        <main className="container">{children}</main>

        <footer className="footer">
          <p>© {new Date().getFullYear()} BiPi Chile — Comparador de precios.</p>
          <p>
            Precios referenciales del MVP. Contacto: <a href="mailto:bipichile2025@gmail.com">bipichile2025@gmail.com</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
