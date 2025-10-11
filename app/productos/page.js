'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

/* ===== Supabase ===== */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/* ===== Utils ===== */
const norm = (s = '') =>
  s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const CLP = (v) => (typeof v === 'number' ? `$${Number(v).toLocaleString('es-CL')}` : '—');

const STORE_META = {
  lider: { label: 'Líder' },
  jumbo: { label: 'Jumbo' },
  unimarc: { label: 'Unimarc' },
  'santa-isabel': { label: 'Santa Isabel' },
};
const STORE_ORDER = ['lider', 'jumbo', 'unimarc', 'santa-isabel'];

/* ===== Component ===== */
export default function ProductosPage() {
  const [rows, setRows] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [category, setCategory] = useState('todas');
  const [sort, setSort] = useState('price-asc');
  const [stores, setStores] = useState(STORE_ORDER);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    supabase.from('product_price_matrix').select('*').then(({ data }) => {
      if (data) setRows(data);
    });
  }, []);

  /* Filtrado dinámico */
  const products = useMemo(() => {
    let grouped = {};
    for (let r of rows) {
      const key = r.producto;
      if (!grouped[key])
        grouped[key] = { categoria: r.categoria, formato: r.formato, precios: {} };
      grouped[key].precios[r.tienda_slug] = r.precio_clp;
    }

    let items = Object.entries(grouped).map(([producto, obj]) => ({
      producto,
      ...obj,
    }));

    if (category !== 'todas')
      items = items.filter((p) => norm(p.categoria) === norm(category));

    if (tokens.length)
      items = items.filter((p) => tokens.some((t) => norm(p.producto).includes(norm(t))));

    if (sort === 'price-asc') {
      items.sort((a, b) => getMin(a) - getMin(b));
    } else if (sort === 'price-desc') {
      items.sort((a, b) => getMin(b) - getMin(a));
    } else if (sort === 'az') {
      items.sort((a, b) => a.producto.localeCompare(b.producto));
    } else if (sort === 'za') {
      items.sort((a, b) => b.producto.localeCompare(a.producto));
    }

    return items;
  }, [rows, tokens, category, sort, stores]);

  const getMin = (p) =>
    Math.min(...stores.map((s) => p.precios[s]).filter((x) => typeof x === 'number'));

  /* Autocompletar */
  useEffect(() => {
    if (!query.trim()) return setSuggestions([]);
    const q = norm(query);
    const unique = Array.from(new Set(rows.map((r) => r.producto)));
    const list = unique.filter((x) => norm(x).includes(q)).slice(0, 10);
    setSuggestions(list);
  }, [query, rows]);

  /* Añadir chip */
  const addToken = (t) => {
    if (!tokens.includes(t)) setTokens([...tokens, t]);
    setQuery('');
    setSuggestions([]);
  };

  const removeToken = (t) => setTokens(tokens.filter((x) => x !== t));
  const clearAll = () => setTokens([]);

  return (
    <div>
      <h2>Comparador de precios — <b>Productos</b></h2>

      <div className="toolbar">
        <div className="search-group">
          <input
            placeholder="Ej: arroz, aceite, papel..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {suggestions.length > 0 && (
            <div className="sugg-panel">
              {suggestions.map((s, i) => (
                <p key={i} onClick={() => addToken(s)}>
                  {s}
                </p>
              ))}
              <small>{suggestions.length} listado</small>
            </div>
          )}
        </div>

        {/* Chips */}
        {tokens.length > 0 && (
          <div className="toolbar-chips">
            {tokens.map((t, i) => (
              <div className="chip" key={i}>
                {t} <button onClick={() => removeToken(t)}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Limpiar búsqueda */}
        {tokens.length > 0 && (
          <button className="btn-ghost" onClick={clearAll}>
            Limpiar búsqueda
          </button>
        )}

        {/* Filtros */}
        <div className="filters" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <label>Categoría</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div>
            <label>Ordenar</label>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="price-asc">Precio (Menor a Mayor) ↑</option>
              <option value="price-desc">Precio (Mayor a Menor) ↓</option>
              <option value="az">Nombre A–Z</option>
              <option value="za">Nombre Z–A</option>
            </select>
          </div>
        </div>
      </div>

      <p style={{ marginTop: '0.6rem' }}>{products.length} productos encontrados</p>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Formato</th>
              {STORE_ORDER.map((s) => (
                <th key={s}>{STORE_META[s].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.slice(0, pageSize).map((p, i) => {
              const min = getMin(p);
              return (
                <tr key={i}>
                  <td>{p.producto}</td>
                  <td>{p.formato}</td>
                  {STORE_ORDER.map((s) => (
                    <td
                      key={s}
                      className={p.precios[s] === min ? 'highlight' : ''}
                    >
                      {CLP(p.precios[s])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <small style={{ display: 'block', marginTop: '0.8rem', color: '#666' }}>
        Nota: precios referenciales del MVP. Pueden variar por tienda y ciudad.
      </small>
    </div>
  );
}
