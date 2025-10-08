import './globals.css';
import Header from '../components/Header';

export const metadata = {
  title: 'BiPi Chile — Comparador de precios',
  description: 'Compara precios de supermercados en la Región del Biobío y Chile.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Header />
        {children}
        <footer style={{
          maxWidth: 900, margin: '40px auto 24px', padding: '0 16px',
          color: '#6B7280', fontSize: 14, borderTop: '1px solid #e5e7eb', paddingTop: 16
        }}>
          © {new Date().getFullYear()} BiPi Chile — Comparador de precios
          <span style={{ float: 'right' }}>Contacto: {process.env.NEXT_PUBLIC_CONTACT_EMAIL}</span>
        </footer>
      </body>
    </html>
  );
}
