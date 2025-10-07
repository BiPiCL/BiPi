'use client';
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Conexión al proyecto Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [stores, setStores] = useState([]);
  const [error, setError] = useState(null);

  // Cargar tiendas desde Supabase
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('name, slug, url_base')
        .order('name');
      if (error) setError(error.message);
      else setStores(data ?? []);
    })();
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1E3A8A', marginBottom: 10 }}>
        Bienvenido a BiPi
      </h1>

      <p style={{ fontSize: 16, color: '#374151', marginBottom: 10 }}>
        Tu comparador de precios de supermercados en Chile.
      </p>

      {/* Enlace destacado hacia la tabla de productos */}
      <p style={{ margin: '8px 0 20px' }}>
        <a
          className="bipi-link"
          href="/productos"
          style={{
            color: '#1E3A8A',
            fontWeight: 600,
            textDecoration: 'none',
            padding: '8px 12px',
            border: '1px solid #1E3A8A',
            borderRadius: '8px'
          }}
        >
          ➡ Ver comparación por producto
        </a>
      </p>

      <p style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
        Tiendas cargadas desde Supabase:
      </p>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <ul style={{ lineHeight: 1.8 }}>
        {stores.map((s) => (
          <li key={s.slug}>
            <a
              href={s.url_base || '#'}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#1E3A8A', textDecoration: 'none' }}
            >
              {s.name}
            </a>{' '}
            <small style={{ color: '#6B7280' }}>({s.slug})</small>
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 30, color: '#6B7280' }}>
        Contacto: {process.env.NEXT_PUBLIC_CONTACT_EMAIL}
      </p>
    </main>
  );
}
