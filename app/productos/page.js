'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Conexión a Supabase (usa tus envs de Vercel)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Utilidad: normaliza texto (minúsculas, sin tildes)
function norm(s = '') {
  return s
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Etiquetas lindas para los headers
const TIENDA_LABEL = {
  'lider': 'Líder',
  'jumbo': 'Jumbo',
  'unimarc': 'Unimarc',
  'santa-isabel': 'Santa Isabel',
};

// Orden base de las columnas
const TIENDAS_BASE = ['lider', 'jumbo', 'unimarc', 'santa-isabel'];

export default function Productos() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  // Toolbar
  const [query, setQuery] = useState('');               // buscador
  const [selected, setSelected] = useState(new Set());  // tiendas seleccionadas
  const [sortBy, setSortBy] = useState('none');         // none | asc | desc

  // Carga de datos
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

  // Tiendas visibles (si no hay selección, mostramos todas)
  const tiendasVisibles = useMemo(() => {
    return selected.size ? TIENDAS_BASE.filter(t => selected.has(t)) : TIENDAS_BASE;
  }, [selected]);

  // Filtro + orden
  const productosProcesados = useMemo(() => {
    const filtro = norm(query);

    let arr = Object.entries(productos);

    // 1) Filtro por buscador (nombre o categoría)
    if (filtro) {
      arr = arr.filter(([nombre, info]) => {
        const n = norm(nombre);
        const c = norm(info.categoria);
        return n.includes(filtro) || c.includes(filtro);
      });
    }

    // 2) Filtro por tiendas (si hay selección: mostrar productos con precio en al menos 1 tienda visible)
    if (selected.size) {
      arr = arr.filter(([_, info]) =>
        tiendasVisibles.some(t => info.precios[t] != null)
      );
    }

    // 3) Orden por precio mínimo (asc/desc) considerando columnas visibles
    if (sortBy !== 'none') {
      arr = arr.slice().sort((a, b) => {
        const minA = minPrecio(a[1].precios, tiendasVisibles);
        const minB = minPrecio(b[1].precios, tiendasVisibles);

        if (minA == null && minB == null) return 0;
        if (minA == null) return 1;  // los sin precio al final
        if (minB == null) return -1;

        return sortBy === 'asc' ? minA - minB : minB - minA;
      });
    }

    return arr;
  }, [productos, query, selected, sortBy, tiendasVisibles]);

  // Helpers
  const minPrecio = (precios, tiendas) => {
    const vals = tiendas.map(t => precios[t]).filter(v => v != null);
    return vals.length ? Math.min(...vals) : null;
  };
  const fmt = (v) =>
    typeof v === 'number'
      ? `$${Number(v).toLocaleString('es-CL')}`
      : '—';

  // Interacción chips
  const toggleTienda = (slug) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };
  const clearTiendas = () => setSelected(new Set());

  return (
    <main className="container" style={{ paddingTop: 16, paddingBottom: 30 }}>
      <h1 className="page-title" style={{ marginBottom: 8, textAlign:'left' }}>
        Comparador de precios — Productos
      </h1>

      <p className="muted" style={{ textAlign:'justify', maxWidth:820, margin:'0 0 14px' }}>
        Busca por nombre o categoría, filtra por tiendas y ordena por el precio mínimo. El precio más
        bajo en cada fila se resalta en <strong>verde</strong>.
      </p>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-row">
          {/* Buscador */}
          <div className="toolbar-group" style={{ flex: 1, minWidth: 220 }}>
            <label className="toolbar-label">Buscar</label>
            <div style={{ display:'flex', gap:8 }}>
              <input
                className="toolbar-input"
                value={query}
                onChange={(e)=>setQuery(e.target.value)}
                placeholder="Ej: arroz, aceite, papel, sal…"
                aria-label="Buscar productos"
                style={{ flex: 1 }}
              />
              {query && (
                <button
                  className="chip chip-clear"
                  onClick={()=>setQuery('')}
                  aria-label="Limpiar búsqueda"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Orden */}
          <div className="toolbar-group">
            <label className="toolbar-label">Ordenar por</label>
            <select
              className="toolbar-select"
              value={sortBy}
              onChange={(e)=>setSortBy(e.target.value)}
              aria-label="Ordenar por precio"
            >
              <option value="none">— Sin ordenar —</option>
              <option value="asc">Precio mínimo (menor a mayor)</option>
              <option value="desc">Precio mínimo (mayor a menor)</option>
            </select>
          </div>
        </div>

        {/* Filtro por tiendas */}
        <div className="toolbar-group">
          <label className="toolbar-label">Tiendas</label>
          <div className="toolbar-chips">
            {TIENDAS_BASE.map((t) => {
              const active = selected.has(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTienda(t)}
                  className={`chip ${active ? 'chip-active' : ''}`}
                  aria-pressed={active}
                >
                  {TIENDA_LABEL[t] ?? t}
                </button>
              );
            })}
            {selected.size > 0 && (
              <button className="chip chip-clear" onClick={clearTiendas}>
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {err && <p style={{color:'red', marginTop:8}}>Error: {err}</p>}

      {/* Tabla */}
      <div style={{ overflowX:'auto', marginTop: 8 }}>
        <table
          style={{
            width:'100%',
            borderCollapse:'separate',
            borderSpacing:0,
            background:'#fff',
            border:'1px solid #e5e7eb',
            borderRadius:12
          }}
        >
          <thead>
            <tr style={{ background:'#F3F4F6' }}>
              <th style={thLeft}>Producto</th>
              <th style={thLeft}>Formato</th>
              {tiendasVisibles.map(t => (
                <th
                  key={t}
                  style={thRight}
                  aria-label={TIENDA_LABEL[t] ?? t}
                >
                  {(TIENDA_LABEL[t] ?? t)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {productosProcesados.length === 0 && (
              <tr>
                <td colSpan={2 + tiendasVisibles.length} style={{ padding:16, color:'#6B7280', textAlign:'center' }}>
                  No se encontraron productos {query ? `para “${query}”` : ''}.
                </td>
              </tr>
            )}

            {productosProcesados.map(([nombre, info]) => {
              const min = minPrecio(info.precios, tiendasVisibles);

              return (
                <tr key={nombre}>
                  <td style={{ ...td, fontWeight:700 }}>{nombre}</td>
                  <td style={td}>{info.formato}</td>
                  {tiendasVisibles.map(t => {
                    const val = info.precios[t];
                    const isMin = min != null && val === min;
                    return (
                      <td
                        key={t}
                        style={{
                          ...tdRight,
                          fontWeight: isMin ? 800 : 500,
                          background: isMin ? '#DCFCE7' : '#fff',
                          color: isMin ? '#166534' : '#111827',
                        }}
                      >
                        {val != null ? fmt(val) : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop:12 }}>
        <small>Nota: precios referenciales en este MVP (pueden variar según tienda y ciudad).</small>
      </p>
    </main>
  );
}

/* ===== Estilos inline simples para la tabla ===== */
const thLeft = {
  textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'10px 12px', fontWeight:800, color:'#111827', whiteSpace:'nowrap'
};
const thRight = {
  textAlign:'right', borderBottom:'1px solid #e5e7eb', padding:'10px 12px', fontWeight:800, color:'#111827', whiteSpace:'nowrap'
};
const td = { borderTop:'1px solid #eee', padding:'10px 12px', verticalAlign:'top', fontWeight:500, color:'#111827' };
const tdRight = { ...td, textAlign:'right' };
