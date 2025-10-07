import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BiPi — Comparador de precios',
  description: 'Comparador de precios de supermercados en Chile.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
