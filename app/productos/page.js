'use client';
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Conexión al proyecto Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Productos() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  // Cargar los datos desde Supabase al cargar la página
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('product_price_matrix')
        .select('product_id, producto, categoria, formato, tienda_slug, tienda, precio_clp')
        .order('producto', { ascending: true });

      if (error) setErr(error.message);
      else setRows(data ?? []);
    })();
  }, []);

  // Agrupar las filas por producto
  const productos = {};
  rows.forEach(r => {
    if (!productos[r.producto]) {
      productos[r.producto] = { categoria: r.categoria, formato: r.formato, precios: {} };
    }
    productos[r.producto].precios[r.tienda_slug] = r.precio_clp;
  });

  // Orden de las tiendas en las columnas
  const tiendas = ['lider', 'jumbo', 'unimarc', 'santa-isabel'];

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>
        Comparador de precios — Productos
      </h1>

      {err && <p style={{ color: 'red' }}>Error: {err}</p>}

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
          <thead>
            <tr style={{ background: '#f2f2f2' }}>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #ddd', padding: '8px' }}>Producto</th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #ddd', padding: '8px' }}>Formato</th>
              {tiendas.map(t => (
                <th
                  key={t}
                  style={{
                    textAlign: 'right',
                    borderBottom: '2px solid #ddd',
                    padding: '8px',
                    whiteSpace: 'nowrap',
                    textTransform: 'capitalize'
                  }}
                >
                  {t.replace('-', ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(productos).map(([nombre, info]) => {
              // Calcular el precio mínimo de esa fila (producto)
              const preciosDeFila = tiendas
                .map(t => info.precios[t])
                .filter(v => v != null);
              const min = Math.min(...preciosDeFila);

              return (
                <tr key={nombre}>
                  <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{nombre}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{info.formato}</td>
                  {tiendas.map(t => {
                    const val = info.precios[t];
                    const isMin = val != null && val === min;
                    return (
                      <td
                        key={t}
                        style={{
                          borderBottom: '1px solid #eee',
                          padding: '8px',
                          textAlign: 'right',
                          fontWeight: isMin ? 700 : 400,
                          background: isMin ? '#e6f7e6' : 'transparent',
                          color: isMin ? '#006400' : '#000'
                        }}
                      >
                        {val != null
                          ? `$${Number(val).toLocaleString('es-CL')}`
                          : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 16, color: '#666' }}>
        Nota: precios referenciales del MVP. Pueden variar por tienda y ciudad.
      </p>
    </main>
  );
}

