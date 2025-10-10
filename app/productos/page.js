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

/* Tiendas */
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
  // términos seleccionados: { raw:'Arroz grado 1', key:'arroz grado 1' }
  const [terms, setTerms] = useState([]);
  const [q, setQ] = useState('');

  const [category, setCategory] = useState('todas');
  const [order, setOrder] = useState('price-asc');
  const [rowsLimit, setRowsLimit] = useState(25);

  const [activeStores, setActiveStores] = useState({
    lider: true,
    jumbo: true,
    unimarc: true,
    'santa-isabel': true,
  });

  // popovers
  const [expOpen, setExpOpen] = useState(false);
  const [rowsOpen, setRowsOpen] = useState(false);
  const [storesOpen, setStoresOpen] = useState(false);

  // autocomplete
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  // toast
  const [toast, setToast] = useState('');

  const exportRef = useRef(null);
  const rowsRef = useRef(null);
  const storesRef = useRef(null);
  const suggestRef = useRef(null);
  const inputRef = useRef(null);

  /* -----------------------------
     Carga de datos
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
     Derivados: categorías y productos únicos
     ----------------------------- */
  const categories = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => r.categoria && set.add(r.categoria));
    return ['todas', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  // lista única de nombres de producto (para sugerencias)
  const allProductNames = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => set.add(r.producto));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
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
          precios: {},
        };
      }
      map[key].precios[r.tienda_slug] = r.precio_clp;
    });
    return map;
  }, [rows]);

  /* -----------------------------
     Tiendas visibles
     ----------------------------- */
  const visibleStores = useMemo(() => {
    const list = STORE_ORDER.filter((slug) => activeStores[slug]);
    return list.length ? list : STORE_ORDER;
  }, [activeStores]);

  /* -----------------------------
     Términos (chips) + buscador
     ----------------------------- */
  const addTermFree = () => {
    const t = q.trim();
    const key = norm(t);
    if (!t) return;
    if (!terms.some((k) => k.key === key)) {
      setTerms((prev) => [...prev, { raw: t, key }]);
    }
    setQ('');
    setSuggestOpen(false);
    setHighlight(-1);
  };

  const addTermExact = (rawValue) => {
    const key = norm(rawValue);
    if (!terms.some((k) => k.key === key)) {
      setTerms((prev) => [...prev, { raw: rawValue, key }]);
    }
    setQ('');
    setSuggestOpen(false);
    setHighlight(-1);
    inputRef.current?.focus();
  };

  const removeTerm = (key) => setTerms((prev) => prev.filter((x) => x.key !== key));
  const clearSearch = () => {
    setQ('');
    setSuggestOpen(false);
    setTerms([]);
    setHighlight(-1);
  };

  // Sugerencias (hasta 10)
  const suggestions = useMemo(() => {
    const nq = norm(q);
    if (!nq) return [];
    const out = allProductNames.filter((name) => norm(name).includes(nq));
    return out.slice(0, 10);
  }, [q, allProductNames]);

  /* -----------------------------
     Filtrar + ordenar
     ----------------------------- */
  const filteredEntries = useMemo(() => {
    let list = Object.entries(productos);

    // Filtro: chips (OR) o texto libre
    if (terms.length > 0) {
      list = list.filter(([nombre]) => {
        const n = norm(nombre);
        return terms.some((t) => n.includes(t.key));
      });
    } else if (q) {
      const nq = norm(q);
      list = list.filter(([nombre, info]) => {
        const n = norm(nombre);
        const c = norm(info.categoria || '');
        return n.includes(nq) || c.includes(nq);
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

  const pagedEntries = useMemo(
    () => filteredEntries.slice(0, rowsLimit),
    [filteredEntries, rowsLimit]
  );

  function cheapestVisible(precios, stores) {
    const vals = stores.map((s) => precios[s]).filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
  }

  /* -----------------------------
     Tiendas helpers y limpiar
     ----------------------------- */
  const toggleStore = (slug) =>
    setActiveStores((prev) => ({ ...prev, [slug]: !prev[slug] }));
  const selectAllStores = () =>
    setActiveStores({ lider: true, jumbo: true, unimarc: true, 'santa-isabel': true });
  const unselectAllStores = () =>
    setActiveStores({ lider: false, jumbo: false, unimarc: false, 'santa-isabel': false });

  const clearFilters = () => {
    setQ('');
    setSuggestOpen(false);
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
    return totals;
  }, [filteredEntries]);

  const minTotal = useMemo(() => {
    const vals = STORE_ORDER.map((s) => totalsByStore[s]).filter((v) => v > 0);
    return vals.length ? Math.min(...vals) : null;
  }, [totalsByStore]);

  /* -----------------------------
     Compartir búsqueda con filtros
     ----------------------------- */
  function buildShareUrl() {
    const base = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin) + '/productos';
    const params = new URLSearchParams();
    // términos seleccionados (raw) separados por |
    if (terms.length) {
      params.set('t', terms.map((x) => x.raw).join('|'));
    }
    // texto libre si no hay términos
    if (!terms.length && q.trim()) params.set('q', q.trim());
    if (category !== 'todas') params.set('cat', category);
    if (order !== 'price-asc') params.set('ord', order);
    if (rowsLimit !== 25) params.set('sz', String(rowsLimit));
    const onStores = STORE_ORDER.filter((s) => activeStores[s]);
    if (onStores.length !== STORE_ORDER.length) params.set('ti', onStores.join(','));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  async function shareCurrentView() {
    const url = buildShareUrl();
    // Web Share API (móviles compatibles)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'BiPi — Búsqueda', text: 'Mira esta búsqueda en BiPi Chile', url });
        return;
      } catch {
        // Si el usuario cancela, caemos a copiar
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast('Se ha copiado link de búsqueda');
      setTimeout(() => setToast(''), 2000);
    } catch {
      // Fallback extremo: nada
    }
  }

  /* -----------------------------
     Cargar filtros desde la URL (deep-link)
     ----------------------------- */
  useEffect(() => {
    // Solo al primer render
    const params = new URLSearchParams(window.location.search);

    // términos
    const t = params.get('t');
    if (t) {
      const list = t.split('|').map((raw) => raw.trim()).filter(Boolean);
      const uniq = Array.from(new Set(list));
      setTerms(uniq.map((raw) => ({ raw, key: norm(raw) })));
    } else {
      const qParam = params.get('q');
      if (qParam) setQ(qParam);
    }

    // categoría
    const cat = params.get('cat');
    if (cat) setCategory(cat);

    // orden
    const ord = params.get('ord');
    if (ord && ORDER_OPTIONS.some((o) => o.id === ord)) setOrder(ord);

    // filas
    const sz = params.get('sz');
    if (sz) {
      const n = parseInt(sz, 10);
      if ([10, 25, 50, 100].includes(n)) setRowsLimit(n);
    }

    // tiendas
    const ti = params.get('ti');
    if (ti) {
      const list = ti.split(',').map((s) => s.trim());
      const next = { lider: false, jumbo: false, unimarc: false, 'santa-isabel': false };
      list.forEach((s) => {
        if (s in next) next[s] = true;
      });
      setActiveStores(next);
    }
  }, []);

  /* -----------------------------
     Exportar
     ----------------------------- */
  const doCopyTable = async () => {
    const headers = ['Producto', 'Formato', ...visibleStores.map((s) => STORE_META[s]?.label ?? s)];
    const body = pagedEntries.map(([nombre, info]) => {
      const row = [nombre, info.formato || '—'];
      visibleStores.forEach((s) => row.push(info.precios[s] ?? ''));
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
     Cierre popovers / sugerencias
     ----------------------------- */
  useEffect(() => {
    const onDocClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExpOpen(false);
      if (rowsRef.current && !rowsRef.current.contains(e.target)) setRowsOpen(false);
      if (storesRef.current && !storesRef.current.contains(e.target)) setStoresOpen(false);
      if (suggestRef.current && !suggestRef.current.contains(e.target) && e.target !== inputRef.current) {
        setSuggestOpen(false);
        setHighlight(-1);
      }
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
          <div className="toolbar-group" style={{ flex: 1, minWidth: 260, position: 'relative' }}>
            <label className="toolbar-label" htmlFor="buscar">
              Buscar
            </label>
            <input
              id="buscar"
              ref={inputRef}
              className="toolbar-input"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSuggestOpen(Boolean(e.target.value.trim()));
                setHighlight(-1);
              }}
              onFocus={() => setSuggestOpen(Boolean(q.trim()))}
              onKeyDown={(e) => {
                if (suggestOpen && suggestions.length) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlight((h) => (h + 1) % suggestions.length);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (highlight >= 0) {
                      addTermExact(suggestions[highlight]);
                    } else {
                      addTermFree();
                    }
                    return;
                  }
                  if (e.key === 'Escape') {
                    setSuggestOpen(false);
                    setHighlight(-1);
                    return;
                  }
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  addTermFree();
                }
              }}
              placeholder="Ej: arroz, sal, aceite… (Enter para agregar)"
              aria-autocomplete="list"
              aria-expanded={suggestOpen}
              aria-owns="suggest-list"
              role="combobox"
            />

            {/* chips de términos */}
            {terms.length > 0 && (
              <div className="toolbar-chips" style={{ marginTop: 8 }}>
                {terms.map((t) => (
                  <span
                    key={t.key}
                    className="chip chip-active"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    {t.raw}
                    <button
                      type="button"
                      aria-label={`Quitar ${t.raw}`}
                      onClick={() => removeTerm(t.key)}
                      style={{
                        appearance: 'none',
                        border: 'none',
                        background: 'transparent',
                        color: '#fff',
                        fontWeight: 900,
                        lineHeight: 1,
                        cursor: 'pointer',
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

            {/* AUTOCOMPLETE */}
            {suggestOpen && suggestions.length > 0 && (
              <div
                ref={suggestRef}
                id="suggest-list"
                role="listbox"
                className="export-menu show"
                style={{
                  position: 'absolute',
                  insetInline: 0,
                  top: '100%',
                  marginTop: 6,
                  maxHeight: 280,
                  overflowY: 'auto',
                  zIndex: 30,
                }}
              >
                {suggestions.map((name, i) => (
                  <button
                    key={name}
                    role="option"
                    aria-selected={i === highlight}
                    className="btn btn-secondary btn-sm"
                    style={{
                      justifyContent: 'flex-start',
                      background: i === highlight ? '#eef2ff' : undefined,
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addTermExact(name)}
                  >
                    {name}
                  </button>
                ))}
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

        {/* fila 2: tiendas + filas + exportar + compartir + limpiar */}
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

          <button type="button" className="btn btn-secondary btn-sm" onClick={shareCurrentView}>
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

          {/* Totales */}
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
                        fontWeight: 800,
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
