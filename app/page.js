'use client';
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>BiPi — MVP</h1>
      <p>Tiendas cargadas desde Supabase:</p>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <ul>
        {stores.map((s) => (
          <li key={s.slug}>
            <a href={s.url_base || '#'} target="_blank" rel="noreferrer">
              {s.name}
            </a>{' '}
            — <small>{s.slug}</small>
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 24, color: '#555' }}>
        Contacto: {process.env.NEXT_PUBLIC_CONTACT_EMAIL}
      </p>
    </main>
  );
}
