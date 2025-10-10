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

/* Botones utilitarios */
function PillButton({ children, onClick, ariaExpanded, title }) {
  return (
    <button
      type="button"
      className="chip"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      title={title}
    >
      {children}
      {typeof ariaExpanded === 'boolean' ? <span aria-hidden> ▾</span> : null}
    </button>
  );
}

export default function Productos() {
  /* -----------------------------
     Estado de datos y filtros
     ----------------------------- */
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  const [q, setQ] = useState('');               // texto en el input
  const [tokens, setTokens] = useState([]);     // chips de productos seleccionados

  const [category, setCategory] = useState('todas');
  const [order, setOrder] = useState('price-asc');

  const [activeStores, setActiveStores] = useState({
    lider: true,
    jumbo: true,
    unimarc: true,
    'santa-isabel': true,
  });

  // UI/refs para móvil
  const toolbarRef = useRef(null);
  const inputRef = useRef(null);
  const suggestRef = useRef(null);
  const inputWrapRef = useRef(null);

  // Popovers (exportar, filas)
  const [openExport, setOpenExport] = useState(false);
  const [openRows, setOpenRows] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Sugerencias
  const [openSuggest, setOpenSuggest] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  /* -----------------------------
     Carga de datos
     ----------------------------- */
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

  /* -----------------------------
     Catálogo y categorías
     ----------------------------- */
  // catálogo único de nombres (para autocompletar)
  const catalogo = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => set.add(r.producto));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [rows]);

  const categories = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => r.categoria && set.add(r.categoria));
    return ['todas', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))];
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
    return map; // { nombre: {categoria, formato, precios} }
  }, [rows]);

  /* -----------------------------
     Tiendas visibles
     ----------------------------- */
  const visibleStores = useMemo(() => {
    const list = STORE_ORDER.filter((slug) => activeStores[slug]);
    return list.length ? list : STORE_ORDER;
  }, [activeStores]);

  /* -----------------------------
     SUGERENCIAS (overlay)
     ----------------------------- */
  const filteredSuggestions = useMemo(() => {
    const nq = norm(q);
    if (!nq) return [];
    // Evitar sugerir algo ya seleccionado
    const chosen = new Set(tokens.map((t) => t.nombre));
    return catalogo
      .filter((name) => !chosen.has(name) && norm(name).includes(nq))
      .slice(0, 12);
  }, [q, catalogo, tokens]);

  // Cierra cualquier popover/sugerencia al click afuera
  useEffect(() => {
    function onDocClick(e) {
      if (openExport || openRows || openSuggest) {
        const inExport = e.target.closest?.('.popover-export');
        const inRows = e.target.closest?.('.popover-rows');
        const inSuggest = e.target.closest?.('.suggest-panel');
        const inInputWrap = e.target.closest?.('.input-with-suggest');
        if (!inExport) setOpenExport(false);
        if (!inRows) setOpenRows(false);
        if (!inSuggest && !inInputWrap) setOpenSuggest(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [openExport, openRows, openSuggest]);

  // Teclas en input (flechas / Enter / Esc)
  function onInputKeyDown(e) {
    if (!openSuggest && filteredSuggestions.length) {
      // abrir con flecha o escribir
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setOpenSuggest(true);
        e.preventDefault();
        return;
      }
    }

    if (openSuggest && filteredSuggestions.length) {
      if (e.key === 'ArrowDown') {
        setActiveIndex((i) => Math.min(i + 1, filteredSuggestions.length - 1));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setActiveIndex((i) => Math.max(i - 1, 0));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        const pick = filteredSuggestions[activeIndex >= 0 ? activeIndex : 0];
        if (pick) addToken(pick);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setOpenSuggest(false);
        inputRef.current?.blur();
      }
    }
  }

  function addToken(nombre) {
    if (!nombre) return;
    if (!tokens.find((t) => t.nombre === nombre)) {
      setTokens((prev) => [...prev, { nombre }]);
    }
    setQ('');
    setOpenSuggest(false);
    // Quitar foco para que iOS cierre teclado y “des-zoomee”
    inputRef.current?.blur();
    // Reposicionar suavemente para que no quede la pantalla con zoom
    setTimeout(() => {
      const top = (toolbarRef.current?.offsetTop || 0) - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    }, 50);
  }

  function removeToken(nombre) {
    setTokens((prev) => prev.filter((t) => t.nombre !== nombre));
  }

  function clearTokens() {
    setTokens([]);
  }

  /* -----------------------------
     Filtrado + Orden
     ----------------------------- */
  const qn = norm(q);
  const filteredSorted = useMemo(() => {
    let list = Object.entries(productos);

    // si hay tokens, filtramos por esos nombres exactos
    if (tokens.length) {
      const pick = new Set(tokens.map((t) => t.nombre));
      list = list.filter(([name]) => pick.has(name));
    } else if (qn) {
      // si no hay tokens, permitir buscar por texto (fallback)
      list = list.filter(([nombre, info]) => {
        const n = norm(nombre);
        const c = norm(info.categoria || '');
        return n.includes(qn) || c.includes(qn);
      });
    }

    if (category !== 'todas') list = list.filter(([, info]) => info.categoria === category);

    if (order === 'name-asc' || order === 'name-desc') {
      list.sort(([a], [b]) => (order === 'name-asc' ? a.localeCompare(b, 'es') : b.localeCompare(a, 'es')));
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
  }, [productos, qn, tokens, category, order, visibleStores]);

  function cheapestVisible(precios, stores) {
    const vals = stores.map((s) => precios[s]).filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
  }

  /* -----------------------------
     Totales por tienda (suma de tokens)
     ----------------------------- */
  const totalsByStore = useMemo(() => {
    if (!tokens.length) return null;
    const totals = {};
    visibleStores.forEach((s) => (totals[s] = 0));

    tokens.forEach((t) => {
      const info = productos[t.nombre];
      if (!info) return;
      visibleStores.forEach((s) => {
        const val = info.precios[s];
        if (typeof val === 'number') totals[s] += val;
        else totals[s] = totals[s] + 0; // mantiene NaN fuera
      });
    });
    return totals;
  }, [tokens, productos, visibleStores]);

  /* -----------------------------
     Compartir búsqueda (toast)
     ----------------------------- */
  const [toast, setToast] = useState(null);

  function shareCurrentView() {
    const params = new URLSearchParams();
    if (tokens.length) params.set('q', tokens.map((t) => t.nombre).join('|'));
    if (category !== 'todas') params.set('cat', category);
    if (order !== 'price-asc') params.set('ord', order);
    const url = `${window.location.origin}/productos?${params.toString()}`;
    navigator.clipboard?.writeText(url);
    setToast('Se copió el link de búsqueda');
    setTimeout(() => setToast(null), 1800);
  }

  // hidratar desde URL (si alguien abre el link compartido)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const qparam = sp.get('q');
    const cat = sp.get('cat');
    const ord = sp.get('ord');

    if (qparam) {
      const parts = qparam.split('|').filter(Boolean);
      setTokens(parts.map((p) => ({ nombre: p })));
    }
    if (cat && categories.includes(cat)) setCategory(cat);
    if (ord && ORDER_OPTIONS.find((o) => o.id === ord)) setOrder(ord);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.join('|')]);

  /* -----------------------------
     Render
     ----------------------------- */
  return (
    <main className="container" style={{ paddingTop: 18, paddingBottom: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
        Comparador de precios — Productos
      </h1>

      {/* ====== TOOLBAR ====== */}
      <section ref={toolbarRef} className="toolbar">
        {/* Buscar + sugerencias */}
        <div className="toolbar-row">
          <div className="toolbar-group" style={{ flex: 1, minWidth: 260 }}>
            <label className="toolbar-label" htmlFor="buscar">
              Buscar
            </label>

            {/* Envoltorio con posición relativa para el overlay */}
            <div ref={inputWrapRef} className="input-with-suggest" style={{ position: 'relative' }}>
              <input
                id="buscar"
                ref={inputRef}
                className="toolbar-input"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActiveIndex(-1);
                  setOpenSuggest(true);
                }}
                onFocus={() => {
                  if (q) setOpenSuggest(true);
                }}
                onBlur={() => {
                  // iOS: al perder foco, “cerramos” zoom y recolocamos
                  setTimeout(() => {
                    const top = (toolbarRef.current?.offsetTop || 0) - 12;
                    window.scrollTo({ top, behavior: 'smooth' });
                  }, 40);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Ej: arroz, aceite, papel, sal…"
                inputMode="search"
                enterKeyHint="done"
                aria-autocomplete="list"
                aria-expanded={openSuggest}
                aria-controls="suggest-list"
              />

              {/* Panel de sugerencias (overlay absoluto) */}
              {openSuggest && filteredSuggestions.length > 0 && (
                <ul
                  id="suggest-list"
                  ref={suggestRef}
                  className="suggest-panel"
                  role="listbox"
                  aria-label="Sugerencias"
                >
                  {filteredSuggestions.map((name, i) => (
                    <li key={name}>
                      <button
                        type="button"
                        className={`suggest-item ${i === activeIndex ? 'is-active' : ''}`}
                        role="option"
                        aria-selected={i === activeIndex}
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => addToken(name)}
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Chips seleccionados */}
            {tokens.length > 0 && (
              <div className="chips-selected" style={{ marginTop: 8 }}>
                {tokens.map((t) => (
                  <span key={t.nombre} className="token-chip" title={t.nombre}>
                    {t.nombre}
                    <button
                      aria-label={`Quitar ${t.nombre}`}
                      onClick={() => removeToken(t.nombre)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {tokens.length > 0 && (
              <button
                type="button"
                className="chip chip-clear"
                style={{ width: 'fit-content', marginTop: 8 }}
                onClick={clearTokens}
              >
                Limpiar búsqueda
              </button>
            )}
          </div>

          {/* Categoría */}
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

          {/* Orden */}
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

        {/* Fila: Tiendas / Filas / Exportar / Compartir / Limpiar */}
        <div className="toolbar-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
          {/* Tiendas */}
          <PillButton
            onClick={() => setOpenRows(false)}
            title="Seleccionar tiendas (ya está oculto por simplicidad)"
          >
            Tiendas (4)
          </PillButton>

          {/* Filas por página */}
          <div className="popover-rows" style={{ position: 'relative' }}>
            <PillButton
              onClick={(e) => {
                e.stopPropagation();
                setOpenRows((v) => !v);
                setOpenExport(false);
              }}
              ariaExpanded={openRows}
              title="Cambiar filas por página"
            >
              Filas: {rowsPerPage}
            </PillButton>

            {openRows && (
              <div className="popover-menu" role="menu">
                {[10, 25, 50, 100].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="menu-item"
                    role="menuitem"
                    onClick={() => {
                      setRowsPerPage(n);
                      setOpenRows(false);
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Exportar */}
          <div className="popover-export" style={{ position: 'relative' }}>
            <PillButton
              onClick={(e) => {
                e.stopPropagation();
                setOpenExport((v) => !v);
                setOpenRows(false);
              }}
              ariaExpanded={openExport}
              title="Exportar datos"
            >
              Exportar
            </PillButton>

            {openExport && (
              <div className="popover-menu" role="menu">
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    copyTable(false);
                    setOpenExport(false);
                  }}
                >
                  Copiar
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    downloadCSV();
                    setOpenExport(false);
                  }}
                >
                  CSV
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    downloadExcel();
                    setOpenExport(false);
                  }}
                >
                  Excel
                </button>
              </div>
            )}
          </div>

          {/* Compartir búsqueda */}
          <PillButton onClick={shareCurrentView} title="Copiar link con filtros actuales">
            Compartir búsqueda
          </PillButton>

          <button
            type="button"
            className="chip chip-clear"
            onClick={() => {
              setQ('');
              setTokens([]);
              setCategory('todas');
              setOrder('price-asc');
            }}
          >
            Limpiar filtros
          </button>
        </div>

        <div className="toolbar-row" style={{ marginBottom: 0 }}>
          <span className="muted">
            {filteredSorted.length} producto{filteredSorted.length === 1 ? '' : 's'} encontrados
          </span>
        </div>
      </section>

      {toast && (
        <div className="toast">{toast}</div>
      )}

      {err && (
        <p style={{ color: 'red', marginTop: 8 }}>Error al cargar datos: {err}</p>
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
            {filteredSorted.length === 0 && (
              <tr>
                <td colSpan={2 + visibleStores.length} style={{ padding: 16, color: '#6B7280', textAlign: 'center' }}>
                  No se encontraron productos para la búsqueda/filters actuales.
                </td>
              </tr>
            )}

            {filteredSorted.slice(0, rowsPerPage).map(([nombre, info]) => {
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

            {/* Totales si hay tokens */}
            {totalsByStore && (
              <tr>
                <td colSpan={2} style={{ fontWeight: 800, background: '#F3F4F6' }}>
                  Total por tienda (selección)
                </td>
                {visibleStores.map((s) => (
                  <td key={s} style={{ textAlign: 'right', fontWeight: 800, background: '#F3F4F6' }}>
                    {CLP(totalsByStore[s])}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 14 }}>
        Nota: precios referenciales del MVP. Pueden variar por tienda y ciudad.
      </p>
    </main>
  );

  /* -----------------------------
     Export helpers
     ----------------------------- */
  function tableDataForExport() {
    const header = ['Producto', 'Formato', ...visibleStores.map((s) => STORE_META[s]?.label ?? s)];
    const rows = filteredSorted.slice(0, rowsPerPage).map(([nombre, info]) => {
      return [
        nombre,
        info.formato || '',
        ...visibleStores.map((s) => (info.precios[s] ?? '')),
      ];
    });
    return { header, rows };
  }

  function copyTable() {
    const { header, rows } = tableDataForExport();
    const lines = [header.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    navigator.clipboard?.writeText(lines);
    setToast('Tabla copiada');
    setTimeout(() => setToast(null), 1500);
  }

  function downloadCSV() {
    const { header, rows } = tableDataForExport();
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bipi_productos.csv';
    a.click();
  }

  function downloadExcel() {
    // CSV con extensión .xlsx (suficiente para abrir en Excel/Sheets)
    const { header, rows } = tableDataForExport();
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bipi_productos.xlsx';
    a.click();
  }
}
