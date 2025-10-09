// components/Footer.tsx
export default function Footer() {
  return (
    <footer className="w-full border-t bg-white">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-3 py-6 md:flex-row">
          <p className="text-sm text-gray-500 text-center md:text-left">
            © {new Date().getFullYear()} BiPi Chile — Comparador de precios
          </p>

          <a
            href="mailto:bipichile2025@gmail.com"
            className="text-sm text-blue-600 hover:underline"
          >
            Contacto: bipichile2025@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
