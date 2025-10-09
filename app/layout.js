// app/layout.js
import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "BiPi Chile — Comparador de precios",
  description:
    "Tu comparador de precios de supermercados en Chile. Compara productos esenciales entre Jumbo, Líder, Unimarc y Santa Isabel.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
