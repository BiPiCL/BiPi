// components/Header.jsx
import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full bg-white border-b shadow-sm">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2">
          <img
            src="/logo-bipi.png"
            alt="BiPi Chile"
            className="h-9 w-9 rounded-full"
          />
          <span className="text-xl font-semibold text-blue-700">BiPi Chile</span>
        </Link>

        <nav className="flex space-x-6 text-gray-700 font-medium">
          <Link href="/" className="hover:text-blue-600">
            Inicio
          </Link>
          <Link href="/productos" className="hover:text-blue-600">
            Productos
          </Link>
        </nav>
      </div>
    </header>
  );
}
