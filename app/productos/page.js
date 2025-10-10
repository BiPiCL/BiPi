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

export default function Productos() {
  /* -----------------------------
     Estado base / datos
     ----------------------------- */
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  /* filtros generales */
  const [category, setCategory] = useState('todas');
  const [order, setOrder] = useState('price-asc');
  const [pageSize, setPageSize] = useState(25);

  /* chips de tiendas activas */
  const [activeStores, setActiveStores] = useState({
    lider: true,
    jumbo: true,
    unimarc: true,
    'santa-isabel': true,
  });

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
     Estructuras derivadas
     ----------------------------- */
  // { nombre: {categoria, formato, precios{slug:precio}} }
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

  // categorías
  const categories = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => r.categoria && set.add(r.categoria));
    return ['todas', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  // tiendas visibles segun chips
  const visibleStores = useMemo(() => {
    const list = STORE_ORDER.filter((slug) => activeStores[slug]);
    return list.length ? list : STORE_ORDER;
  }, [activeStores]);

  /* -----------------------------
     BÚSQUEDA AVANZADA (multi selección con sugerencias)
     ----------------------------- */
  // texto actual del input
  const [qText, setQText] = useState('');
  // set de productos seleccionados (chips)
  const [selectedNames, setSelectedNames] = useState([]);

  // refs para dropdown y manejo de blur/click afuera
  const acWrapRef = useRef(null); // contenedor relativo
  const inputRef = useRef(null);
  const [openAC, setOpenAC] = useState(false);

  // lista de sugerencias (superpuesta), hasta 10 opciones
  const suggestions = useMemo(() => {
    const q = norm(qText);
    if (!q) return [];
    const all = Object.keys(productos);
    return all
      .filter((name) => norm(name).includes(q))
      .slice(0, 10);
  }, [qText, productos]);

  // añadir selección (chip)
  const addSelection = (name) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev : [...prev, name]
    );
    setQText('');
    setOpenAC(false);
    // mantén el foco para poder seguir tipeando rápido en móvil/desktop:
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // quitar selección
  const removeSelection = (name) =>
    setSelectedNames((prev) => prev.filter((n) => n !== name));

  // limpiar todas las selecciones
  const clearSelections = () => setSelectedNames([]);

  // cerrar sugerencias con click afuera o Esc
  useEffect(() => {
    const onDocClick = (e) => {
      if (!acWrapRef.current) return;
      if (!acWrapRef.current.contains(e.target)) {
        setOpenAC(false);
      }
    };
    const onEsc = (e) => e.key === 'Escape' && setOpenAC(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  // FIX iOS Safari zoom: el zoom “automático” ocurre si el font-size del input < 16px.
  // En CSS ya forzamos 16px, pero por si acaso aseguramos también vía inline style.
  const inputStyleIOS = { fontSize: 16 };

  /* -----------------------------
     Filtrado + orden
     ----------------------------- */
  // Si hay seleccionados, filtramos SOLO por esos; si no, mostramos todo con categoría/orden
  const filteredSorted = useMemo(() => {
    let entries = Object.entries(productos);

    if (selectedNames.length > 0) {
      const setSel = new Set(selectedNames);
      entries = entries.filter(([name]) => setSel.has(name));
    } else {
      // si no hay chips, puede usarse categoría u orden + texto libre (qText)
      const q = norm(qText);
      if (q) {
        entries = entries.filter(([name, info]) => {
          const n = norm(name);
          const c = norm(info.categoria || '');
          return n.includes(q) || c.includes(q);
        });
      }
    }

    // categoría
    if (category !== 'todas') {
      entries = entries.filter(([, info]) => info.categoria === category);
    }

    // orden
    if (order === 'name-asc' || order === 'name-desc') {
      entries.sort(([a], [b]) =>
        order === 'name-asc' ? a.localeCompare(b) : b.localeCompare(a)
      );
    } else {
      entries.sort(([, A], [, B]) => {
        const minA = cheapestVisible(A.precios, visibleStores);
        const minB = cheapestVisible(B.precios, visibleStores);
        const va = minA ?? Number.POSITIVE_INFINITY;
        const vb = minB ?? Number.POSITIVE_INFINITY;
        return order === 'price-asc' ? va - vb : vb - va;
      });
    }

    // paginado simple (solo contamos, la tabla muestra todo; si quisieras, corta aquí con slice)
    return entries;
  }, [productos, selectedNames, qText, category, order, visibleStores]);

  // precio mínimo entre tiendas visibles
  function cheapestVisible(precios, stores) {
    const vals = stores.map((s) => precios[s]).filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
  }

  // totales por tienda (selección)
  const totalsByStore = useMemo(() => {
    if (selectedNames.length === 0) return null;
    const totals = Object.fromEntries(visibleStores.map((s) => [s, 0]));
    selectedNames.forEach((name) => {
      const info = productos[name];
      if (!info) return;
      visibleStores.forEach((s) => {
        const v = info.precios[s];
        if (typeof v === 'number') totals[s] += v;
        else totals[s] = totals[s] ?? null;
      });
    });
    return totals;
  }, [selectedNames, productos, visibleStores]);

  /* -----------------------------
     Tiendas (UI)
     ----------------------------- */
  const [openStores, setOpenStores] = useState(false);
  const toggleStore = (slug) =>
    setActiveStores((prev) => ({ ...prev, [slug]: !prev[slug] }));

  const selectAllStores = () =>
    setActiveStores({ lider: true, jumbo: true, unimarc: true, 'santa-isabel': true });
  const clearAllStores = () =>
    setActiveStores({ lider: false, jumbo: false, unimarc: false, 'santa-isabel': false });

  /* -----------------------------
     Exportar / Compartir búsqueda
     ----------------------------- */
  const [openExport, setOpenExport] = useState(false);
  const [openPageSize, setOpenPageSize] = useState(false);
  const [toast, setToast] = useState('');

  const copyTable = async () => {
    try {
      const headers = ['Producto', 'Formato', ...visibleStores.map((s) => STORE_META[s]?.label ?? s)];
      const lines = [headers.join('\t')];
      filteredSorted.forEach(([name, info]) => {
        const row = [
          name,
          info.formato || '—',
          ...visibleStores.map((s) => {
            const v = info.precios[s];
            return typeof v === 'number' ? v : '';
          }),
        ];
        lines.push(row.join('\t'));
      });
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast('Tabla copiada');
    } catch {
      showToast('No se pudo copiar');
    }
  };

  const downloadCSV = () => {
    const headers = ['Producto', 'Formato', ...visibleStores.map((s) => STORE_META[s]?.label ?? s)];
    const lines = [headers.join(',')];
    filteredSorted.forEach(([name, info]) => {
      const row = [
        `"${name.replace(/"/g, '""')}"`,
        `"${(info.formato || '—').replace(/"/g, '""')}"`,
        ...visibleStores.map((s) => info.precios[s] ?? ''),
      ];
      lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bipi_productos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExcel = () => {
    // CSV compatible con Excel
    downloadCSV();
  };

  const shareSearch = async () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    url.searchParams.delete('sel');

    if (selectedNames.length) url.searchParams.set('sel', encodeURIComponent(selectedNames.join('|')));
    const final = url.toString();
    try {
      await navigator.clipboard.writeText(final);
      showToast('Se copió el link de búsqueda');
    } catch {
      showToast('No se pudo copiar el link');
    }
  };

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  /* -----------------------------
     Restaurar selección desde URL
     ----------------------------- */
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const sel = u.searchParams.get('sel');
      if (sel) {
        const list = decodeURIComponent(sel).split('|').map((s) => s.trim()).filter(Boolean);
        setSelectedNames(Array.from(new Set(list)));
      }
    } catch {}
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
        {/* fila 1: BUSCAR + CATEGORÍA + ORDEN */}
        <div className="toolbar-row">
          {/* Buscar con autocompletado superpuesto */}
          <div className="toolbar-group ac-wrap" ref={acWrapRef} style={{ flex: 1, minWidth: 260 }}>
            <label className="toolbar-label" htmlFor="buscar">
              Buscar
            </label>

            <input
              id="buscar"
              ref={inputRef}
              className="toolbar-input"
              style={inputStyleIOS}
              value={qText}
              onFocus={() => setOpenAC(!!qText)}
              onChange={(e) => {
                setQText(e.target.value);
                setOpenAC(true);
              }}
              placeholder="Ej: arroz, aceite, papel, sal…"
              autoComplete="off"
              inputMode="search"
            />

            {/* Chips seleccionados */}
            {selectedNames.length > 0 && (
              <div className="chips-selected">
                {selectedNames.map((name) => (
                  <span className="chip chip-selected" key={name}>
                    {name}
                    <button
                      className="chip-x"
                      aria-label={`Quitar ${name}`}
                      onClick={() => removeSelection(name)}
                    >
                      ×
                    </button>
                  </span>
                ))}

                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => {
                    clearSelections();
                    setQText('');
                    inputRef.current?.focus();
                  }}
                >
                  Limpiar búsqueda
                </button>
              </div>
            )}

            {/* MENÚ DE SUGERENCIAS (superpuesto, NO empuja layout) */}
            {openAC && suggestions.length > 0 && (
              <div className="ac-menu" role="listbox" aria-label="Sugerencias">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    className="ac-item"
                    role="option"
                    // Usamos onMouseDown para capturar ANTES del blur y evitar saltos
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addSelection(name);
                    }}
                    onTouchStart={(e) => {
                      // iOS: misma idea para evitar que se cierre por blur
                      e.preventDefault();
                      addSelection(name);
                    }}
                    tabIndex={-1}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Categoría */}
          <div className="toolbar-group">
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

          {/* Orden */}
          <div className="toolbar-group">
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

        {/* fila 2: tiendas / filas / exportar / compartir / limpiar */}
        <div className="toolbar-row actions-row" style={{ gap: 10 }}>
          {/* Tiendas (popover) */}
          <div className="toolbar__export" style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => setOpenStores((s) => !s)}
              aria-expanded={openStores}
            >
              Tiendas ({visibleStores.length}) ▾
            </button>
            <div className={`export-menu ${openStores ? 'show' : ''}`} style={{ minWidth: 260 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button className="btn btn-ghost btn-sm" type="button" onClick={selectAllStores}>
                  Seleccionar todas
                </button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={clearAllStores}>
                  Quitar todas
                </button>
              </div>
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
                    style={{ justifyContent: 'space-between' }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filas por página (popover) */}
          <div className="toolbar__export" style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => setOpenPageSize((s) => !s)}
              aria-expanded={openPageSize}
            >
              Filas: {pageSize} ▾
            </button>
            <div className={`export-menu ${openPageSize ? 'show' : ''}`}>
              {[10, 25, 50, 100].map((n) => (
                <button
                  key={n}
                  className={`chip ${n === pageSize ? 'chip-active' : ''}`}
                  type="button"
                  onClick={() => {
                    setPageSize(n);
                    setOpenPageSize(false);
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Exportar (popover) */}
          <div className="toolbar__export" style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => setOpenExport((s) => !s)}
              aria-expanded={openExport}
            >
              Exportar ▾
            </button>
            <div className={`export-menu ${openExport ? 'show' : ''}`}>
              <button className="btn btn-ghost btn-sm" type="button" onClick={copyTable}>
                Copiar
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={downloadCSV}>
                CSV
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={downloadExcel}>
                Excel
              </button>
            </div>
          </div>

          <button className="btn btn-secondary btn-sm" type="button" onClick={shareSearch}>
            Compartir búsqueda
          </button>

          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => {
              setCategory('todas');
              setOrder('price-asc');
              setOpenExport(false);
              setOpenPageSize(false);
              setOpenStores(false);
              setQText('');
              clearSelections();
              selectAllStores();
            }}
          >
            Limpiar filtros
          </button>
        </div>

        {/* contador */}
        <div className="toolbar-row" style={{ marginBottom: 0 }}>
          <span className="muted">
            {Math.min(filteredSorted.length, pageSize)} de {filteredSorted.length} producto
            {filteredSorted.length === 1 ? '' : 's'} listados
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
            {filteredSorted.length === 0 && (
              <tr>
                <td
                  colSpan={2 + visibleStores.length}
                  style={{ padding: 16, color: '#6B7280', textAlign: 'center' }}
                >
                  No se encontraron productos para los filtros actuales.
                </td>
              </tr>
            )}

            {filteredSorted.slice(0, pageSize).map(([nombre, info]) => {
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

            {/* Totales por tienda para la selección */}
            {totalsByStore && (
              <tr>
                <td colSpan={2} style={{ fontWeight: 800 }}>
                  Total por tienda (selección)
                </td>
                {visibleStores.map((s) => (
                  <td key={s} style={{ textAlign: 'right', fontWeight: 800 }}>
                    {typeof totalsByStore[s] === 'number' ? CLP(totalsByStore[s]) : '—'}
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

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
