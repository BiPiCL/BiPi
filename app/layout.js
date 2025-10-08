import './globals.css';
import Header from '../components/Header';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'BiPi';

export const metadata = {
  title: `${APP_NAME} — Comparador de precios`,
  description: 'Comparador de precios de supermercados en Chile.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Header />
        <main className="bipi-container bipi-main">
          {children}
        </main>
        <footer className="bipi-footer">
          <div className="bipi-container bipi-footer-inner">
            <span>© {new Date().getFullYear()} {APP_NAME} — Comparador de precios</span>
            <span>Contacto: {process.env.NEXT_PUBLIC_CONTACT_EMAIL}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}

