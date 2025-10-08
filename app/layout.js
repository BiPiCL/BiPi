import './globals.css';
import Header from '../components/Header';

export const metadata = {
  title: 'BiPi Chile — Comparador de precios',
  description: 'Compara precios de supermercados en Chile.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Header />
        {/* Contenido de cada página */}
        <main className="container">{children}</main>

        {/* Footer */}
        <footer className="site-footer">
          <div className="container footer-inner">
            <div>© {new Date().getFullYear()} BiPi Chile — <span className="text-muted">Comparador de precios</span></div>
            <div>Contacto: bipichile2025@gmail.com</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
