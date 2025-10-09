// app/page.js
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="w-full">
      {/* Banner azul */}
      <section className="relative mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 pt-10 pb-12">
        <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-blue-500 px-6 py-10 sm:px-10 sm:py-14 shadow-xl">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
              Encuentra los mejores precios en supermercados chilenos
            </h1>
            <p className="mt-4 text-white/90">
              Compara rápidamente y ahorra en tus compras del mes.
            </p>

            <div className="mt-8">
              <Link
                href="/productos"
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-semibold bg-yellow-400 hover:bg-yellow-300 transition shadow-md"
              >
                Ver productos
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Texto de bienvenida */}
      <section className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 pb-16">
        <div className="mx-auto max-w-3xl text-center sm:text-left">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            Bienvenido a BiPi Chile
          </h2>
          <p className="mt-3 text-gray-600">
            Tu comparador de precios de supermercados en Chile. Compara
            productos esenciales como arroz, aceite, fideos, papel higiénico y
            más entre Líder, Jumbo, Unimarc y Santa Isabel.
          </p>

          <div className="mt-6">
            <h3 className="font-semibold text-gray-900">
              Tiendas conectadas a BiPi Chile:
            </h3>
            <ul className="mt-2 list-disc list-inside text-gray-700 space-y-1">
              <li><strong>Jumbo</strong> (jumbo)</li>
              <li><strong>Líder</strong> (lider)</li>
              <li><strong>Santa Isabel</strong> (santa-isabel)</li>
              <li><strong>Unimarc</strong> (unimarc)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
