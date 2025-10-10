'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/* ===========================
   Conexión a Supabase (env)
   =========================== */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/* ===========================
   Utilidades
   =========================== */
const norm = (s = '') =>
  s
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const CLP = (v) =>
  typeof v === 'number' ? `$${Number(v).toLocaleString('es-CL')}` : '—';

/* Mapa de tiendas (slug → etiqueta bonita) */
const STORE_META = {
  lider: { label: 'Líder' },
  jumbo: { label: 'Jumbo' },
  unimarc: { label: 'Unimarc' },
  'santa-isabel': { label: 'Santa Isabel' },
};
const STORE_ORDER = ['lider', 'jumbo', 'unimarc', 'santa-isabel'];

/* Opciones de orden */
const ORDER_OPTIONS = [
  { id: 'price-asc', label: 'Precio (Menor a Mayor) ↑' },
  { id: 'price-desc', label: 'Precio (Mayor a Menor) ↓' },
  { id: 'name-asc', label: 'Nombre A → Z' },
  { id: 'name-desc', label: 'Nombre Z → A' },
];

/* Helpers Export */
function download(filename, text) {
  const el = document.createElement('a');
  el.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  el.setAttribute('download', filename);
  el.style.display = 'none';
  document.body.appendChild(el);
  el.click();
  document.body.removeChild(el);
}

function toCSV(headers, rows) {
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = headers.map(esc).join(',');
  const body = rows.map((r) => r.map(esc).join(',')).join('\n');
  return head + '\n' + body;
}

export default function Productos() {
  /* -----------------------------
     Estado de datos
     ----------------------------- */
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  /* -----------------------------
     Filtros y UI
     ----------------------------- */
  // términos seleccionados (chips) y texto actual del input
  const [terms, setTerms] = useState([]); // array de strings (minúscula normalizada)
  const [q, setQ] = useState('');

  const [category, setCategory] = useState('todas');
  const [order, setOrder] = useState('price-asc');
  const [rowsLimit, setRowsLimit] = useState(25);

  // chips de tiendas activas
  const [activeStores, setActiveStores] = useState({
    lider: true,
    jumbo: true,
    unimarc: true,
    'santa-isabel': true,
  });

  // popovers (Exportar / Filas / Tiendas)
  const [expOpen, setExpOpen] = useState(false);
  const [rowsOpen, setRowsOpen] = useState(false);
  const [storesOpen, setStoresOpen] = useState(false);

  // toast de “copiado”
  const [toast, setToast] = useState('');

  const exportRef = useRef(null);
  const rowsRef = useRef(null);
  const storesRef = useRef(null);

  /* -----------------------------
     Carga de datos desde Supabase
     ----------------------------- */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('product_price_matrix')
        .select(
          'product_id, producto, categoria, formato, tienda_slug, tienda, precio_clp'
        )
        .order('producto', { ascending: true });

      if (error) setErr(error.message);
      else setRows(data ?? []);
    })();
  }, []);

  /* -----------------------------
     Derivados: categorías únicas
     ----------------------------- */
  const categories = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.categoria) set.add(r.categoria);
    });
    return ['todas', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  /* -----------------------------
     Agrupar filas por producto
     ----------------------------- */
  const productos = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const key = r.producto;
      if (!map[key]) {
        map[key] = {
          categoria: r.categoria,
          formato: r.formato,
          precios: {}, // { slug: precio }
        };
      }
      map[key].precios[r.tienda_slug] = r.precio_clp;
    });
    return map; // { nombre: {categoria, formato, precios} }
  }, [rows]);

  /* -----------------------------
     Tiendas visibles (chips)
     ----------------------------- */
  const visibleStores = useMemo(() => {
    const list = STORE_ORDER.filter((slug) => activeStores[slug]);
    return list.length ? list : STORE_ORDER; // si apagan todas, mostramos todas
  }, [activeStores]);

  /* -----------------------------
     Búsqueda múltiple (terms)
     ----------------------------- */
  const addTerm = () => {
    const t = norm(q);
    if (t && !terms.includes(t)) {
      setTerms((prev) => [...prev, t]);
    }
    setQ('');
  };
  const removeTerm = (t) => setTerms((prev) => prev.filter((x) => x !== t));
  const clearSearch = () => {
    setQ('');
    setTerms([]);
  };

  /* -----------------------------
     Filtrar + ordenar
     ----------------------------- */
  const filteredEntries = useMemo(() => {
    let list = Object.entries(productos); // [ [nombre, info], ... ]

    // Filtro por términos (OR por término)
    if (terms.length > 0) {
      list = list.filter(([nombre]) => {
        const n = norm(nombre);
        return terms.some((t) => n.includes(t));
      });
    } else if (q) {
      // si no se han agregado términos, filtra por el texto libre
      const qn = norm(q);
      list = list.filter(([nombre, info]) => {
        const n = norm(nombre);
        const c = norm(info.categoria || '');
        return n.includes(qn) || c.includes(qn);
      });
    }

    // Filtro categoría
    if (category !== 'todas') {
      list = list.filter(([, info]) => info.categoria === category);
    }

    // Orden
    if (order === 'name-asc' || order === 'name-desc') {
      list.sort(([a], [b]) =>
        order === 'name-asc' ? a.localeCompare(b) : b.localeCompare(a)
      );
    } else {
      // Orden por precio mínimo considerando tiendas visibles
      list.sort(([, A], [, B]) => {
        const minA = cheapestVisible(A.precios, visibleStores);
        const minB = cheapestVisible(B.precios, visibleStores);
        const va = minA ?? Number.POSITIVE_INFINITY;
        const vb = minB ?? Number.POSITIVE_INFINITY;
        return order === 'price-asc' ? va - vb : vb - va;
      });
    }

    return list;
  }, [productos, q, terms, category, order, visibleStores]);

  // lista paginada para mostrar (pero totales se calculan sobre TODO el filtrado)
  const pagedEntries = useMemo(
    () => filteredEntries.slice(0, rowsLimit),
    [filteredEntries, rowsLimit]
  );

  /* Precio mínimo entre tiendas visibles */
  function cheapestVisible(precios, stores) {
    const vals = stores.map((s) => precios[s]).filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
  }

  /* Toggle chip de tienda */
  const toggleStore = (slug) =>
    setActiveStores((prev) => ({ ...prev, [slug]: !prev[slug] }));

  const selectAllStores = () =>
    setActiveStores({
      lider: true,
      jumbo: true,
      unimarc: true,
      'santa-isabel': true,
    });

  const unselectAllStores = () =>
    setActiveStores({
      lider: false,
      jumbo: false,
      unimarc: false,
      'santa-isabel': false,
    });

  const clearFilters = () => {
    setQ('');
    setTerms([]);
    setCategory('todas');
    setOrder('price-asc');
    setRowsLimit(25);
    selectAllStores();
  };

  /* -----------------------------
     Totales por supermercado
     ----------------------------- */
  const totalsByStore = useMemo(() => {
    const totals = Object.fromEntries(STORE_ORDER.map((s) => [s, 0]));
    filteredEntries.forEach(([, info]) => {
      STORE_ORDER.forEach((s) => {
        const val = info.precios[s];
        if (typeof val === 'number') totals[s] += val;
      });
    });
    return totals; // {lider: 1234, ...}
  }, [filteredEntries]);

  const minTotal = useMemo(() => {
    const vals = STORE_ORDER.map((s) => totalsByStore[s]).filter((v) => v > 0);
    return vals.length ? Math.min(...vals) : null;
  }, [totalsByStore]);

  /* -----------------------------
     Exportar / Compartir
     ----------------------------- */
  const copyView = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast('Se ha copiado link de búsqueda');
      setTimeout(() => setToast(''), 2000);
    } catch {
      // fallback: nada
    }
  };

  const doCopyTable = async () => {
    // Exporta la página actual en formato TSV al portapapeles
    const headers = ['Producto', 'Formato', ...visibleStores.map((s) => STORE_META[s]?.label ?? s)];
    const body = pagedEntries.map(([nombre, info]) => {
      const row = [nombre, info.formato || '—'];
      visibleStores.forEach((s) => {
        const val = info.precios[s];
        row.push(val != null ? String(val) : '—');
      });
      return row;
    });
    const tsv = [headers.join('\t'), ...body.map((r) => r.join('\t'))].join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      setToast('Tabla copiada');
      setTimeout(() => setToast(''), 1800);
    } catch {}
  };

  const doCSV = () => {
    const headers = ['Producto', 'Formato', ...STORE_ORDER.map((s) => STORE_META[s]?.label ?? s)];
    const body = filteredEntries.map(([nombre, info]) => {
      const row = [nombre, info.formato || '—'];
      STORE_ORDER.forEach((s) => row.push(info.precios[s] ?? ''));
      return row;
    });
    download('bipi_productos.csv', toCSV(headers, body));
  };

  const doXLSX = () => {
    // Simple CSV con extensión .xlsx (Excel lo abrirá)
    const headers = ['Producto', 'Formato', ...STORE_ORDER.map((s) => STORE_META[s]?.label ?? s)];
    const body = filteredEntries.map(([nombre, info]) => {
      const row = [nombre, info.formato || '—'];
      STORE_ORDER.forEach((s) => row.push(info.precios[s] ?? ''));
      return row;
    });
    const csv = toCSV(headers, body);
    download('bipi_productos.xlsx', csv);
  };

  /* -----------------------------
     Cierre de popovers clic afuera
     ----------------------------- */
  useEffect(() => {
    const onDocClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExpOpen(false);
      if (rowsRef.current && !rowsRef.current.contains(e.target)) setRowsOpen(false);
      if (storesRef.current && !storesRef.current.contains(e.target)) setStoresOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  /* -----------------------------
     Render
     ----------------------------- */
  return (
    <main className="container" style={{ paddingTop: 18, paddingBottom: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
        Comparador de precios — Productos
      </h1>

      {/* ====== TOOLBAR ====== */}
      <section className="toolbar">
        {/* fila 1: buscador + categoría + ordenar */}
        <div className="toolbar-row">
          <div className="toolbar-group" style={{ flex: 1, minWidth: 260 }}>
            <label className="toolbar-label" htmlFor="buscar">
              Buscar
            </label>
            <input
              id="buscar"
              className="toolbar-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTerm();
                }
              }}
              placeholder="Ej: arroz, sal, aceite… (Enter para agregar)"
            />
            {/* chips de términos */}
            {terms.length > 0 && (
              <div className="toolbar-chips" style={{ marginTop: 8 }}>
                {terms.map((t) => (
                  <span key={t} className="chip chip-active" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {t}
                    <button
                      type="button"
                      aria-label={`Quitar ${t}`}
                      onClick={() => removeTerm(t)}
                      style={{
                        appearance: 'none',
                        border: 'none',
                        background: 'transparent',
                        color: '#fff',
                        fontWeight: 900,
                        lineHeight: 1,
                        cursor: 'pointer'
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button type="button" className="chip chip-clear" onClick={clearSearch}>
                  Limpiar búsqueda
                </button>
              </div>
            )}
          </div>

          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="categoria">
              Categoría
            </label>
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

          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="ordenar">
              Ordenar
            </label>
            <select
              id="ordenar"
              className="toolbar-select"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            >
              {ORDER_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* fila 2: tiendas (popover) + filas (popover) + exportar (popover) + compartir + limpiar */}
        <div className="toolbar-row actions-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
          {/* Tiendas */}
          <div className="toolbar__export" ref={storesRef}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStoresOpen((v) => !v)}
              aria-expanded={storesOpen}
            >
              Tiendas ({STORE_ORDER.filter((s) => activeStores[s]).length})
              <span aria-hidden> ▾</span>
            </button>
            <div className={`export-menu ${storesOpen ? 'show' : ''}`} style={{ minWidth: 260 }}>
              <div className="toolbar-chips" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="chip" onClick={selectAllStores}>
                  Seleccionar todas
                </button>
                <button type="button" className="chip" onClick={unselectAllStores}>
                  Quitar todas
                </button>
              </div>
              <div className="toolbar-chips" style={{ flexWrap: 'wrap' }}>
                {STORE_ORDER.map((slug) => {
                  const on = activeStores[slug];
                  const label = STORE_META[slug]?.label ?? slug;
                  return (
                    <button
                      key={slug}
                      type="button"
                      className={`chip ${on ? 'chip-active' : ''}`}
                      onClick={() => toggleStore(slug)}
                      aria-pressed={on}
                      title={on ? `Ocultar ${label}` : `Mostrar ${label}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Filas */}
          <div className="toolbar__export" ref={rowsRef}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setRowsOpen((v) => !v)}
              aria-expanded={rowsOpen}
            >
              Filas: {rowsLimit} <span aria-hidden>▾</span>
            </button>
            <div className={`export-menu ${rowsOpen ? 'show' : ''}`}>
              {[10, 25, 50, 100].map((n) => (
                <button
                  key={n}
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setRowsLimit(n);
                    setRowsOpen(false);
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
              className="btn btn-secondary btn-sm"
              onClick={() => setExpOpen((v) => !v)}
              aria-expanded={expOpen}
            >
              Exportar <span aria-hidden>▾</span>
            </button>
            <div className={`export-menu ${expOpen ? 'show' : ''}`}>
              <button className="btn btn-secondary btn-sm" onClick={doCopyTable}>Copiar</button>
              <button className="btn btn-secondary btn-sm" onClick={doCSV}>CSV</button>
              <button className="btn btn-secondary btn-sm" onClick={doXLSX}>Excel</button>
            </div>
          </div>

          <button type="button" className="btn btn-secondary btn-sm" onClick={copyView}>
            Compartir búsqueda
          </button>

          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>

        {/* fila 3: contador */}
        <div className="toolbar-row" style={{ marginBottom: 0 }}>
          <span className="muted">
            {filteredEntries.length} producto{filteredEntries.length === 1 ? '' : 's'} encontrados
            {filteredEntries.length > rowsLimit ? ` — mostrando ${rowsLimit}` : ''}
          </span>
        </div>
      </section>

      {/* Errores */}
      {err && (
        <p style={{ color: 'red', marginTop: 8 }}>
          Error al cargar datos: {err}
        </p>
      )}

      {/* ====== TABLA ====== */}
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
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
            {pagedEntries.length === 0 && (
              <tr>
                <td
                  colSpan={2 + visibleStores.length}
                  style={{ padding: 16, color: '#6B7280', textAlign: 'center' }}
                >
                  No se encontraron productos para la búsqueda/filtros actuales.
                </td>
              </tr>
            )}

            {pagedEntries.map(([nombre, info]) => {
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

          {/* Totales por supermercado (sobre TODOS los filtrados, no solo la página) */}
          {filteredEntries.length > 0 && (
            <tfoot>
              <tr>
                <th colSpan={2} style={{ textAlign: 'right' }}>Total</th>
                {visibleStores.map((s) => {
                  const total = totalsByStore[s] || 0;
                  const isMin = minTotal != null && total === minTotal && total > 0;
                  return (
                    <th
                      key={s}
                      style={{
                        textAlign: 'right',
                        background: isMin ? '#dff5df' : '#F3F4F6',
                        color: isMin ? '#006400' : '#111827',
                        fontWeight: 800
                      }}
                    >
                      {total > 0 ? CLP(total) : '—'}
                    </th>
                  );
                })}
              </tr>
            </tfoot>
          )}
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
