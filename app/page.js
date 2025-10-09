// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="w-full">
      {/* Banner / Hero */}
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

      {/* Bienvenida / Descripción */}
      <section className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 pb-16">
        <div className="mx-auto max-w-3xl">
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
              <li>
                <span className="font-medium">Jumbo</span>{" "}
                <span className="text-gray-500">(jumbo)</span>
              </li>
              <li>
                <span className="font-medium">Líder</span>{" "}
                <span className="text-gray-500">(lider)</span>
              </li>
              <li>
                <span className="font-medium">Santa Isabel</span>{" "}
                <span className="text-gray-500">(santa-isabel)</span>
              </li>
              <li>
                <span className="font-medium">Unimarc</span>{" "}
                <span className="text-gray-500">(unimarc)</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

