'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const ORDER_OPTIONS = [
  { id: 'price-asc', label: 'Precio (Menor a Mayor) ↑' },
  { id: 'price-desc', label: 'Precio (Mayor a Menor) ↓' },
  { id: 'name-asc', label: 'Nombre A → Z' },
  { id: 'name-desc', label: 'Nombre Z → A' },
];

export default function Productos() {
  /* ===== Datos ===== */
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

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

  /* ===== Estado filtros ===== */
  const [q, setQ] = useState('');
  const [tokens, setTokens] = useState([]);
  const [category, setCategory] = useState('todas');
  const [order, setOrder] = useState('price-asc');
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [activeStores, setActiveStores] = useState({
    lider: true,
    jumbo: true,
    unimarc: true,
    'santa-isabel': true,
  });

  /* ===== Menús desplegables ===== */
  const [openStores, setOpenStores] = useState(false);
  const [openRows, setOpenRows] = useState(false);
  const [openExport, setOpenExport] = useState(false);

  const storesRef = useRef(null);
  const rowsRef = useRef(null);
  const exportRef = useRef(null);
  const searchWrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (storesRef.current && !storesRef.current.contains(e.target)) setOpenStores(false);
      if (rowsRef.current && !rowsRef.current.contains(e.target)) setOpenRows(false);
      if (exportRef.current && !exportRef.current.contains(e.target)) setOpenExport(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  /* ===== Categorías únicas ===== */
  const categories = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => r.categoria && set.add(r.categoria));
    return ['todas', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  /* ===== Agrupar por producto ===== */
  const productos = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const key = r.producto;
      if (!map[key]) {
        map[key] = { categoria: r.categoria, formato: r.formato, precios: {} };
      }
      map[key].precios[r.tienda_slug] = r.precio_clp;
    });
    return map;
  }, [rows]);

  /* ===== Sugerencias ===== */
  const qn = norm(q);
  const suggestions = useMemo(() => {
    if (!qn) return [];
    const names = Object.keys(productos);
    const out = [];
    for (const name of names) {
      const n = norm(name);
      if (n.includes(qn) && !tokens.includes(name)) out.push(name);
      if (out.length >= 8) break;
    }
    return out;
  }, [productos, qn, tokens]);

  const addToken = (name) => {
    setTokens((t) => (t.includes(name) ? t : [...t, name]));
    setQ('');
  };
  const removeToken = (name) => setTokens((t) => t.filter((x) => x !== name));
  const clearSearch = () => { setQ(''); setTokens([]); };

  /* ===== Tiendas visibles ===== */
  const visibleStores = useMemo(
    () => STORE_ORDER.filter((slug) => activeStores[slug]),
    [activeStores]
  );

  const selectAllStores = () =>
    setActiveStores({ lider: true, jumbo: true, unimarc: true, 'santa-isabel': true });
  const clearAllStores = () =>
    setActiveStores({ lider: false, jumbo: false, unimarc: false, 'santa-isabel': false });
  const toggleStore = (slug) =>
    setActiveStores((prev) => ({ ...prev, [slug]: !prev[slug] }));

  /* ===== Filtrado + orden ===== */
  const filteredSorted = useMemo(() => {
    let list = Object.entries(productos);

    if (tokens.length) {
      const set = new Set(tokens);
      list = list.filter(([nombre]) => set.has(nombre));
    } else if (qn) {
      list = list.filter(([nombre, info]) => {
        const n = norm(nombre);
        const c = norm(info.categoria || '');
        return n.includes(qn) || c.includes(qn);
      });
    }

    if (category !== 'todas') {
      list = list.filter(([, info]) => info.categoria === category);
    }

    if (order === 'name-asc' || order === 'name-desc') {
      list.sort(([a], [b]) => (order === 'name-asc' ? a.localeCompare(b) : b.localeCompare(a)));
    } else {
      list.sort(([, A], [, B]) => {
        const minA = cheapestVisible(A.precios, visibleStores);
        const minB = cheapestVisible(B.precios, visibleStores);
        const va = minA ?? Number.POSITIVE_INFINITY;
        const vb = minB ?? Number.POSITIVE_INFINITY;
        return order === 'price-asc' ? va - vb : vb - va;
      });
    }

    return list;
  }, [productos, tokens, qn, category, order, visibleStores]);

  function cheapestVisible(precios, stores) {
    const vals = stores.map((s) => precios[s]).filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
  }

  const clearAll = () => {
    setQ('');
    setTokens([]);
    setCategory('todas');
    setOrder('price-asc');
    setRowsPerPage(25);
    setActiveStores({ lider: true, jumbo: true, unimarc: true, 'santa-isabel': true });
  };

  /* ===== Compartir búsqueda ===== */
  const [toast, setToast] = useState('');
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const copySearchLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    url.searchParams.delete('cat');
    url.searchParams.delete('ord');
    url.searchParams.delete('tokens');
    url.searchParams.delete('stores');
    if (tokens.length) url.searchParams.set('tokens', encodeURIComponent(tokens.join('|')));
    if (category !== 'todas') url.searchParams.set('cat', category);
    if (order !== 'price-asc') url.searchParams.set('ord', order);
    const storesStr = STORE_ORDER.filter((s) => activeStores[s]).join(',');
    if (storesStr.length && storesStr !== STORE_ORDER.join(',')) url.searchParams.set('stores', storesStr);

    try {
      await navigator.clipboard.writeText(url.toString());
      showToast('Se ha copiado el link de búsqueda');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url.toString();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Se ha copiado el link de búsqueda');
    }
  };

  /* ===== Render ===== */
  const pageItems = useMemo(() => filteredSorted.slice(0, rowsPerPage), [filteredSorted, rowsPerPage]);

  return (
    <main className="container" style={{ paddingTop: 18, paddingBottom: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
        Comparador de precios — Productos
      </h1>

      {/* ===== Toolbar ===== */}
      <section className="toolbar">
        {/* Fila superior: Buscar / Categoría / Ordenar */}
        <div className="toolbar-row" ref={searchWrapRef} style={{ position: 'relative' }}>
          <div className="toolbar-group" style={{ flex: 1, minWidth: 260 }}>
            <label className="toolbar-label" htmlFor="buscar">Buscar</label>
            <input
              id="buscar"
              className="toolbar-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej: arroz, aceite, papel, sal…"
              autoComplete="off"
            />
            {/* Sugerencias superpuestas */}
            {q && suggestions.length > 0 && (
              <div className="sugg-panel">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="sugg-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addToken(name)}
                  >
                    {name}
                  </button>
                ))}
                <div className="sugg-foot">{suggestions.length} listado</div>
              </div>
            )}
          </div>

          <div className="toolbar-group" style={{ minWidth: 220 }}>
            <label className="toolbar-label" htmlFor="categoria">Categoría</label>
            <select
              id="categoria"
              className="toolbar-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'todas' ? 'Todas' : c}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar-group" style={{ minWidth: 220 }}>
            <label className="toolbar-label" htmlFor="ordenar">Ordenar</label>
            <select
              id="ordenar"
              className="toolbar-select"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            >
              {ORDER_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Chips + Limpiar (los chips ahora fluyen horizontalmente) */}
        {tokens.length > 0 && (
          <div className="toolbar-row" style={{ marginTop: 6, alignItems: 'flex-start' }}>
            <div className="toolbar-chips" role="list">
              {tokens.map((t) => (
                <span key={t} className="chip chip-active" role="listitem" title={t}>
                  {t}
                  <button
                    type="button"
                    className="chip-x"
                    aria-label={`Eliminar ${t}`}
                    onClick={() => removeToken(t)}
                    style={{ marginLeft: 8 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <button type="button" className="btn btn-ghost" onClick={clearSearch}>
              Limpiar búsqueda
            </button>
          </div>
        )}

        {/* Acciones */}
        <div className="toolbar-row actions-row">
          {/* Tiendas (queda abierto para multiselección) */}
          <div className="toolbar__export" ref={storesRef}>
            <button
              type="button"
              className="btn btn-secondary"
              aria-haspopup="menu"
              aria-expanded={openStores}
              onClick={() => setOpenStores((v) => !v)}
            >
              Tiendas ({visibleStores.length}) ▾
            </button>

            <div className={`export-menu ${openStores ? 'show' : ''}`} role="menu" style={{ minWidth: 260 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllStores}>
                  Seleccionar todas
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearAllStores}>
                  Quitar todas
                </button>
              </div>

              {STORE_ORDER.map((slug) => {
                const on = !!activeStores[slug];
                const label = STORE_META[slug]?.label ?? slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    className="store-pill"
                    aria-pressed={on}
                    onClick={() => toggleStore(slug)}
                    title={on ? `Ocultar ${label}` : `Mostrar ${label}`}
                  >
                    <span className={`dot ${on ? 'on' : ''}`} /> {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filas */}
          <div className="toolbar__export" ref={rowsRef}>
            <button
              type="button"
              className="btn btn-secondary"
              aria-haspopup="menu"
              aria-expanded={openRows}
              onClick={() => setOpenRows((v) => !v)}
            >
              Filas: {rowsPerPage} ▾
            </button>
            <div className={`export-menu ${openRows ? 'show' : ''}`} role="menu">
              {[10, 25, 50, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setRowsPerPage(n);
                    setOpenRows(false);
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Exportar */}
          <div className="toolbar__export" ref={exportRef}>
            <button
              type="button"
              className="btn btn-secondary"
              aria-haspopup="menu"
              aria-expanded={openExport}
              onClick={() => setOpenExport((v) => !v)}
            >
              Exportar ▾
            </button>
            <div className={`export-menu ${openExport ? 'show' : ''}`} role="menu">
              <button
                type="button"
                className="menu-item"
                onClick={async () => {
                  try {
                    const txt = tableToTSV(pageItems, visibleStores);
                    await navigator.clipboard.writeText(txt);
                    showToast('Tabla copiada');
                  } catch {
                    showToast('No se pudo copiar');
                  }
                  setOpenExport(false);
                }}
              >
                Copiar
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  downloadCSV(pageItems, visibleStores);
                  setOpenExport(false);
                }}
              >
                CSV
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  downloadExcelLikeCSV(pageItems, visibleStores);
                  setOpenExport(false);
                }}
              >
                Excel
              </button>
            </div>
          </div>

          <button type="button" className="btn btn-secondary" onClick={copySearchLink}>
            Compartir búsqueda
          </button>

          <button type="button" className="btn btn-ghost" onClick={clearAll}>
            Limpiar filtros
          </button>
        </div>

        {/* contador */}
        <div className="toolbar-row" style={{ marginBottom: 0 }}>
          <span className="muted">
            {filteredSorted.length} producto{filteredSorted.length === 1 ? '' : 's'} encontrados
          </span>
        </div>
      </section>

      {/* error */}
      {err && <p style={{ color: 'red', marginTop: 8 }}>Error al cargar datos: {err}</p>}

      {/* ===== Tabla ===== */}
      <div className="table-wrapper">
        <span className="scroll-indicator left">‹</span>
        <span className="scroll-indicator right">›</span>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Formato</th>
              {visibleStores.map((s) => (
                <th key={s} style={{ textAlign: 'right', textTransform: 'capitalize' }}>
                  {STORE_META[s]?.label ?? s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={2 + visibleStores.length} style={{ padding: 16, color: '#6B7280', textAlign: 'center' }}>
                  No se encontraron productos para la búsqueda/filtros actuales.
                </td>
              </tr>
            )}

            {pageItems.map(([nombre, info]) => {
              const min = cheapestVisible(info.precios, visibleStores);
              return (
                <tr key={nombre}>
                  <td>{nombre}</td>
                  <td>{info.formato || '—'}</td>
                  {visibleStores.map((s) => {
                    const val = info.precios[s];
                    const isMin = min != null && val === min;
                    return (
                      <td
                        key={s}
                        style={{
                          textAlign: 'right',
                          fontWeight: isMin ? 700 : 500,
                          background: isMin ? '#e6f7e6' : 'transparent',
                          color: isMin ? '#006400' : '#111827',
                        }}
                      >
                        {val != null ? CLP(val) : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 14 }}>
        Nota: precios referenciales del MVP. Pueden variar por tienda y ciudad.
      </p>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

/* ===== Helpers exportación ===== */
function tableToTSV(items, stores) {
  const header = ['Producto', 'Formato', ...stores.map((s) => STORE_META[s]?.label ?? s)];
  const lines = [header.join('\t')];
  items.forEach(([nombre, info]) => {
    const row = [nombre, info.formato || '—', ...stores.map((s) => (info.precios[s] ?? ''))];
    lines.push(row.join('\t'));
  });
  return lines.join('\n');
}

function downloadCSV(items, stores) {
  const header = ['Producto', 'Formato', ...stores.map((s) => STORE_META[s]?.label ?? s)];
  const lines = [header.join(',')];
  items.forEach(([nombre, info]) => {
    const row = [csvCell(nombre), csvCell(info.formato || '—'), ...stores.map((s) => csvCell(info.precios[s] ?? ''))];
    lines.push(row.join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bipi_productos.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadExcelLikeCSV(items, stores) {
  downloadCSV(items, stores);
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}
