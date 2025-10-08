'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Conexión a Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Utilidad: normaliza texto (minúsculas, sin tildes)
function norm(s = '') {
  return s
    .toString()
    .toLowerCase()
    .normalize('NFD')        // separa acentos
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .trim();
}

export default function Productos() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [query, setQuery] = useState(''); // ← texto del buscador

  // Cargar matriz producto/tienda/precio
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

  // Agrupar filas por producto
  const productos = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      if (!map[r.producto]) {
        map[r.producto] = { categoria: r.categoria, formato: r.formato, precios: {} };
      }
      map[r.producto].precios[r.tienda_slug] = r.precio_clp;
    });
    return map;
  }, [rows]);

  // Tiendas (orden de columnas)
  const tiendas = ['lider', 'jumbo', 'unimarc', 'santa-isabel'];

  // Filtro por buscador (nombre o categoría)
  const filtro = norm(query);
  const productosFiltrados = useMemo(() => {
    const entries = Object.entries(productos);
    if (!filtro) return entries;
    return entries.filter(([nombre, info]) => {
      const n = norm(nombre);
      const c = norm(info.categoria);
      return n.includes(filtro) || c.includes(filtro);
    });
  }, [productos, filtro]);

  return (
    <main style={{maxWidth: 1000, margin: '0 auto', padding: 16}}>
      <h1 style={{fontSize: 22, fontWeight: 600, marginBottom: 6}}>
        Comparador de precios — Productos
      </h1>

      {/* Buscador */}
      <div style={{display:'flex', gap: 8, alignItems:'center', margin: '8px 0 14px'}}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar (ej: arroz, aceite, papel, sal…) "
          aria-label="Buscar productos"
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            fontSize: 15,
            outline: 'none'
          }}
        />
        {query ? (
          <button
            onClick={() => setQuery('')}
            style={{
              padding: '10px 12px',
              border: '1px solid #E5E7EB',
              background: 'white',
              borderRadius: 10,
              cursor: 'pointer'
            }}
            aria-label="Limpiar búsqueda"
            title="Limpiar"
          >
            Limpiar
          </button>
        ) : null}
      </div>

      {err && <p style={{color:'red'}}>Error: {err}</p>}

      <div style={{overflowX:'auto', marginTop: 12}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize: 15}}>
          <thead>
            <tr style={{background:'#f2f2f2'}}>
              <th style={{textAlign:'left', borderBottom:'2px solid #ddd', padding:'8px'}}>Producto</th>
              <th style={{textAlign:'left', borderBottom:'2px solid #ddd', padding:'8px'}}>Formato</th>
              {tiendas.map(t => (
                <th
                  key={t}
                  style={{
                    textAlign:'right',
                    borderBottom:'2px solid #ddd',
                    padding:'8px',
                    whiteSpace:'nowrap',
                    textTransform:'capitalize'
                  }}
                >
                  {t.replace('-', ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {productosFiltrados.length === 0 && (
              <tr>
                <td colSpan={2 + tiendas.length} style={{padding: 16, color:'#6B7280', textAlign:'center'}}>
                  No se encontraron productos para “{query}”.
                </td>
              </tr>
            )}

            {productosFiltrados.map(([nombre, info]) => {
              // Precio mínimo de la fila (solo valores presentes)
              const valores = tiendas.map(t => info.precios[t]).filter(v => v != null);
              const min = valores.length ? Math.min(...valores) : null;

              return (
                <tr key={nombre}>
                  <td style={{borderBottom:'1px solid #eee', padding:'8px'}}>{nombre}</td>
                  <td style={{borderBottom:'1px solid #eee', padding:'8px'}}>{info.formato}</td>
                  {tiendas.map(t => {
                    const val = info.precios[t];
                    const isMin = min != null && val === min;
                    return (
                      <td
                        key={t}
                        style={{
                          borderBottom:'1px solid #eee',
                          padding:'8px',
                          textAlign:'right',
                          fontWeight: isMin ? 700 : 400,
                          background: isMin ? '#e6f7e6' : 'transparent',
                          color: isMin ? '#006400' : '#000'
                        }}
                      >
                        {val != null ? `$${Number(val).toLocaleString('es-CL')}` : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{marginTop:16, color:'#666'}}>
        Nota: precios referenciales del MVP. Pueden variar por tienda y ciudad.
      </p>
    </main>
  );
}
