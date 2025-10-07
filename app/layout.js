import './globals.css';

export const metadata = {
  title: 'BiPi — Comparador de precios',
  description: 'Comparador de precios de supermercados en Chile.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
