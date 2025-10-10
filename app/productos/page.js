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
     Estado de datos y filtros
     ----------------------------- */
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  const [q, setQ] = useState('');
  const [category, setCategory] = useState('todas');
  const [order, setOrder] = useState('price-asc');

  // filas por página (drop oculto en popover “Filas”)
  const [pageSize, setPageSize] = useState(25);

  // chips de tiendas activas
  const [activeStores, setActiveStores] = useState({
    lider: true,
    jumbo: true,
    unimarc: true,
    'santa-isabel': true,
  });

  // popover Exportar
  const [openExport, setOpenExport] = useState(false);
  const exportRef = useRef(null);

  // toast “copiado”
  const [copiedMsg, setCopiedMsg] = useState('');

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
     Cerrar popover Export al hacer clic fuera o Esc
     ----------------------------- */
  useEffect(() => {
    function onDown(e) {
      if (e.key === 'Escape') setOpenExport(false);
    }
    function onClickOutside(e) {
      if (!exportRef.current) return;
      if (!exportRef.current.contains(e.target)) setOpenExport(false);
    }
    if (openExport) {
      document.addEventListener('keydown', onDown);
      document.addEventListener('mousedown', onClickOutside);
      document.addEventListener('touchstart', onClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', onDown);
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('touchstart', onClickOutside);
    };
  }, [openExport]);

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
    return list.length ? list : STORE_ORDER; // si el usuario apaga todo, mostramos todas
  }, [activeStores]);

  /* -----------------------------
     Filtrar + ordenar
     ----------------------------- */
  const qn = norm(q);
  const filteredSorted = useMemo(() => {
    let list = Object.entries(productos);

    // Filtro buscador (nombre o categoría)
    if (qn) {
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
      // Orden por precio más bajo (considerando solo tiendas visibles)
      list.sort(([, A], [, B]) => {
        const minA = cheapestVisible(A.precios, visibleStores);
        const minB = cheapestVisible(B.precios, visibleStores);
        const va = minA ?? Number.POSITIVE_INFINITY;
        const vb = minB ?? Number.POSITIVE_INFINITY;
        return order === 'price-asc' ? va - vb : vb - va;
      });
    }

    return list;
  }, [productos, qn, category, order, visibleStores]);

  /* Precio mínimo entre tiendas visibles */
  function cheapestVisible(precios, stores) {
    const vals = stores.map((s) => precios[s]).filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
  }

  /* Toggle chip de tienda */
  const toggleStore = (slug) =>
    setActiveStores((prev) => ({ ...prev, [slug]: !prev[slug] }));

  /* Limpiar filtros */
  const clearFilters = () => {
    setQ('');
    setCategory('todas');
    setOrder('price-asc');
    setPageSize(25);
    setActiveStores({
      lider: true,
      jumbo: true,
      unimarc: true,
      'santa-isabel': true,
    });
  };

  /* -----------------------------
     Compartir búsqueda (copiar URL con filtros)
     ----------------------------- */
  function buildShareUrl() {
    const url = new URL(
      `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/productos`
    );
    if (q) url.searchParams.set('q', q);
    if (category !== 'todas') url.searchParams.set('cat', category);
    if (order !== 'price-asc') url.searchParams.set('ord', order);
    if (pageSize !== 25) url.searchParams.set('sz', String(pageSize));
    // tiendas (solo las que están activas en orden fijo)
    const onStores = STORE_ORDER.filter((s) => activeStores[s]);
    if (onStores.length !== STORE_ORDER.length) {
      url.searchParams.set('ti', onStores.join(','));
    }
    return url.toString();
  }

  async function copyShareUrl() {
    const link = buildShareUrl();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedMsg('Se ha copiado link de búsqueda');
    setTimeout(() => setCopiedMsg(''), 2000);
  }

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
        {/* fila 1: Buscador */}
        <div className="toolbar-row">
          <div className="toolbar-group" style={{ flex: 1, minWidth: 240 }}>
            <label className="toolbar-label" htmlFor="buscar">
              Buscar
            </label>
            <input
              id="buscar"
              className="toolbar-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej: arroz, aceite, papel, sal…"
            />
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

        {/* fila 2: Acciones (Filas / Exportar / Compartir / Limpiar) */}
        <div className="toolbar-row actions-row" style={{ gap: 10 }}>
          {/* Tiendas (globo resumido) */}
          <div className="toolbar__export">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-haspopup="true"
              aria-expanded="false"
              onClick={() =>
                alert(
                  'Para filtrar tiendas usa los chips (esta versión resume las tiendas activas).'
                )
              }
              title="Tiendas activas"
            >
              Tiendas ({STORE_ORDER.filter((s) => activeStores[s]).length})
            </button>
          </div>

          {/* Filas */}
          <div className="toolbar__export">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-haspopup="true"
              aria-expanded="false"
              onClick={() =>
                setPageSize((p) => {
                  const opts = [10, 25, 50, 100];
                  const idx = opts.indexOf(p);
                  return opts[(idx + 1) % opts.length];
                })
              }
              title="Cambiar filas por página"
            >
              Filas: {pageSize}
            </button>
          </div>

          {/* Exportar */}
          <div className="toolbar__export" ref={exportRef}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-haspopup="true"
              aria-expanded={openExport}
              aria-controls="export-menu"
              onClick={() => setOpenExport((v) => !v)}
              title="Exportar"
            >
              Exportar ▾
            </button>

            <div
              id="export-menu"
              className={`export-menu ${openExport ? 'show' : ''}`}
              role="menu"
              aria-label="Opciones de exportación"
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  // copiar tabla (simple)
                  const lines = filteredSorted.map(([n, info]) => {
                    const cols = visibleStores.map((s) =>
                      info.precios[s] != null ? CLP(info.precios[s]) : '—'
                    );
                    return [n, info.formato || '—', ...cols].join('\t');
                  });
                  const header = ['Producto', 'Formato', ...visibleStores
                    .map((s) => STORE_META[s]?.label ?? s)].join('\t');
                  const text = [header, ...lines].join('\n');
                  navigator.clipboard.writeText(text);
                  setOpenExport(false);
                  setCopiedMsg('Se copió la tabla');
                  setTimeout(() => setCopiedMsg(''), 2000);
                }}
                role="menuitem"
              >
                Copiar
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  // CSV sencillo
                  const header = ['Producto','Formato',...visibleStores.map((s)=>STORE_META[s]?.label??s)];
                  const rowsCsv = filteredSorted.map(([n, info]) => {
                    const cols = visibleStores.map((s) =>
                      info.precios[s] != null ? info.precios[s] : ''
                    );
                    return [n, info.formato || '', ...cols]
                      .map((x) => `"${String(x).replace(/"/g, '""')}"`)
                      .join(',');
                  });
                  const csv = [header.join(','), ...rowsCsv].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'bipi_productos.csv';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  setOpenExport(false);
                }}
                role="menuitem"
              >
                CSV
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  // “Excel” = CSV con extensión .xls para abrir directo
                  const header = ['Producto','Formato',...visibleStores.map((s)=>STORE_META[s]?.label??s)];
                  const rowsX = filteredSorted.map(([n, info]) => {
                    const cols = visibleStores.map((s) =>
                      info.precios[s] != null ? info.precios[s] : ''
                    );
                    return [n, info.formato || '', ...cols]
                      .map((x) => `"${String(x).replace(/"/g, '""')}"`)
                      .join(',');
                  });
                  const csv = [header.join(','), ...rowsX].join('\n');
                  const blob = new Blob([csv], { type: 'application/vnd.ms-excel' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'bipi_productos.xls';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  setOpenExport(false);
                }}
                role="menuitem"
              >
                Excel
              </button>
            </div>
          </div>

          {/* Compartir búsqueda */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={copyShareUrl}
            title="Copiar link con los filtros actuales"
          >
            Compartir búsqueda
          </button>

          {/* Limpiar */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={clearFilters}
          >
            Limpiar filtros
          </button>
        </div>

        {/* fila 3: contador */}
        <div className="toolbar-row" style={{ marginBottom: 0 }}>
          <span className="muted">
            {filteredSorted.length} producto
            {filteredSorted.length === 1 ? '' : 's'} encontrados
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
                <th
                  key={s}
                  style={{ textAlign: 'right', textTransform: 'capitalize' }}
                >
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
                  No se encontraron productos para la búsqueda/filters actuales.
                </td>
              </tr>
            )}

            {filteredSorted.map(([nombre, info]) => {
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

      {/* Toast “copiado” */}
      {copiedMsg ? (
        <div
          role="status"
          aria-live="polite"
          className="toast"
        >
          {copiedMsg}
        </div>
      ) : null}

      <p className="muted" style={{ marginTop: 14 }}>
        Nota: precios referenciales del MVP. Pueden variar por tienda y ciudad.
      </p>
    </main>
  );
}
