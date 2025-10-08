'use client';
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Conexión a Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'BiPi';

export default function Home() {
  const [stores, setStores] = useState([]);
  const [error, setError] = useState(null);

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
      {/* 🟦 Banner superior */}
      <section
        style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #1E3A8A, #2563EB)',
          borderRadius: 14,
          padding: '40px 24px',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          marginBottom: 24
        }}
      >
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
          {APP_NAME}: compara precios y ahorra 💰
        </h1>
        <p style={{ fontSize: 17, marginBottom: 24 }}>
          Encuentra los mejores precios de supermercados en la Región del Biobío
          — todo en un solo lugar.
        </p>
        <a
          href="/productos"
          style={{
            display: 'inline-block',
            backgroundColor: '#FACC15',
            color: '#1E3A8A',
            padding: '12px 24px',
            borderRadius: 10,
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: 16,
            boxShadow: '0 3px 6px rgba(0,0,0,0.2)'
          }}
        >
          🛒 Ver productos
        </a>
      </section>

      {/* 🧾 Contenido informativo */}
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 10 }}>
        Bienvenido a {APP_NAME}
      </h2>
      <p style={{ fontSize: 16, color: '#374151', marginBottom: 20 }}>
        Tu comparador de precios de supermercados en Chile. Compara productos
        esenciales como arroz, aceite, fideos, papel higiénico y más entre
        Lider, Jumbo, Unimarc y Santa Isabel.
      </p>

      <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginTop: 30 }}>
        Tiendas conectadas a {APP_NAME}:
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
