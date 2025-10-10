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

/* Tiendas (slug → etiqueta) */
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

  /* tiendas activas (todas true por defecto) */
  const [activeStores, setActiveStores] = useState({
    lider: true,
    jumbo: true,
    unimarc: true,
    'santa-isabel': true,
  });

  /* UI: popovers */
  const [openStores, setOpenStores] = useState(false);
  const [openRows, setOpenRows] = useState(false);
  const [openExport, setOpenExport] = useState(false);

  /* filas a mostrar (sin paginación, solo límite visual) */
  const [rowsLimit, setRowsLimit] = useState(25);

  /* refs para cierre por click afuera */
  const storesRef = useRef(null);
  const rowsRef = useRef(null);
  const exportRef = useRef(null);

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

  /* Cerrar popovers al hacer clic fuera */
  useEffect(() => {
    function onDocClick(e) {
      const t = e.target;
      if (storesRef.current && !storesRef.current.contains(t)) setOpenStores(false);
      if (rowsRef.current && !rowsRef.current.contains(t)) setOpenRows(false);
      if (exportRef.current && !exportRef.current.contains(t)) setOpenExport(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
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
    return list.length ? list : STORE_ORDER; // si apaga todas, mostramos todas
  }, [activeStores]);

  const countActiveStores = useMemo(
    () => STORE_ORDER.filter((s) => activeStores[s]).length,
    [activeStores]
  );

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

  const displayed = useMemo(
    () => filteredSorted.slice(0, rowsLimit),
    [filteredSorted, rowsLimit]
  );

  /* Precio mínimo entre tiendas visibles */
  function cheapestVisible(precios, stores) {
    const vals = stores.map((s) => precios[s]).filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
  }

  /* Toggle chip de tienda */
  const toggleStore = (slug) =>
    setActiveStores((prev) => ({ ...prev, [slug]: !prev[slug] }));

  /* Seleccionar / quitar todas las tiendas */
  const selectAllStores = () =>
    setActiveStores({
      lider: true,
      jumbo: true,
      unimarc: true,
      'santa-isabel': true,
    });
  const clearAllStores = () =>
    setActiveStores({
      lider: false,
      jumbo: false,
      unimarc: false,
      'santa-isabel': false,
    });

  const clearFilters = () => {
    setQ('');
    setCategory('todas');
    setOrder('price-asc');
    selectAllStores();
  };

  /* -----------------------------
     Exportar / compartir
     ----------------------------- */
  function toCSV(rowsArray, stores) {
    const head = ['Producto', 'Formato', ...stores.map((s) => STORE_META[s]?.label || s)];
    const lines = [head.join(',')];

    rowsArray.forEach(([nombre, info]) => {
      const line = [
        escapeCSV(nombre),
        escapeCSV(info.formato || ''),
        ...stores.map((s) =>
          info.precios[s] != null ? String(info.precios[s]).replace(/\./g, '') : ''
        ),
      ];
      lines.push(line.join(','));
    });

    return lines.join('\n');
  }

  function escapeCSV(v) {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function download(text, filename, type = 'text/csv;charset=utf-8;') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const copyTable = () => {
    const head = ['Producto', 'Formato', ...visibleStores.map((s) => STORE_META[s]?.label || s)];
    const lines = [head.join('\t')];

    displayed.forEach(([nombre, info]) => {
      const row = [
        nombre,
        info.formato || '',
        ...visibleStores.map((s) =>
          info.precios[s] != null ? CLP(info.precios[s]) : ''
        ),
      ];
      lines.push(row.join('\t'));
    });

    navigator.clipboard.writeText(lines.join('\n'));
  };

  const downloadCSV = () => {
    const csv = toCSV(displayed, visibleStores);
    download(csv, 'bipi_productos.csv');
  };

  const downloadExcel = () => {
    // CSV con extensión .xlsx (suficiente para Excel en este MVP)
    const csv = toCSV(displayed, visibleStores);
    download(csv, 'bipi_productos.xlsx');
  };

  const shareView = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category !== 'todas') params.set('cat', category);
    if (order !== 'price-asc') params.set('ord', order);
    params.set(
      'stores',
      STORE_ORDER.filter((s) => activeStores[s]).join(',')
    );
    const url = `${window.location.origin}/productos?${params.toString()}`;
    navigator.clipboard.writeText(url);
  };

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

        {/* fila 2: acciones (altura alineada) */}
        <div className="toolbar-row actions-row" style={{ justifyContent: 'space-between' }}>
          {/* --- Tiendas (popover) --- */}
          <div ref={storesRef} style={{ display: 'inline-flex', position: 'relative' }}>
            <button
              type="button"
              className={`chip ${openStores ? 'chip-active' : ''}`}
              onClick={() => setOpenStores((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={openStores ? 'true' : 'false'}
              title="Filtrar por tiendas"
            >
              Tiendas ({countActiveStores || 4})
            </button>

            <div
              className={`export-menu ${openStores ? 'show' : ''}`}
              role="menu"
              aria-label="Tiendas disponibles"
              style={{ minWidth: 280, gap: 10, flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={selectAllStores}>
                  Seleccionar todas
                </button>
                <button type="button" className="btn btn-ghost" onClick={clearAllStores}>
                  Quitar todas
                </button>
              </div>

              <div className="toolbar-chips" style={{ marginTop: 2 }}>
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

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* --- Filas (popover) --- */}
            <div ref={rowsRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                type="button"
                className={`chip ${openRows ? 'chip-active' : ''}`}
                onClick={() => setOpenRows((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={openRows ? 'true' : 'false'}
                title="Elegir filas a mostrar"
              >
                Filas: {rowsLimit}
              </button>

              <div
                className={`export-menu ${openRows ? 'show' : ''}`}
                role="menu"
                aria-label="Filas por página"
                style={{ padding: 8, gap: 8 }}
              >
                {[10, 25, 50, 100].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setRowsLimit(n);
                      setOpenRows(false);
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* --- Exportar (popover) --- */}
            <div ref={exportRef} className="toolbar__export">
              <button
                type="button"
                className={`btn btn-secondary btn-sm ${openExport ? 'is-open' : ''}`}
                onClick={() => setOpenExport((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={openExport ? 'true' : 'false'}
                title="Exportar datos"
              >
                Exportar ▾
              </button>

              <div
                className={`export-menu ${openExport ? 'show' : ''}`}
                role="menu"
                aria-label="Opciones de exportación"
              >
                <button type="button" className="btn btn-ghost" onClick={copyTable}>
                  Copiar
                </button>
                <button type="button" className="btn btn-ghost" onClick={downloadCSV}>
                  CSV
                </button>
                <button type="button" className="btn btn-ghost" onClick={downloadExcel}>
                  Excel
                </button>
              </div>
            </div>

            <button type="button" className="chip" onClick={shareView} title="Copiar URL con filtros">
              Compartir vista
            </button>

            <button type="button" className="chip chip-clear" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* fila 3: contador */}
        <div className="toolbar-row" style={{ marginBottom: 0 }}>
          <span className="muted">
            {filteredSorted.length} producto{filteredSorted.length === 1 ? '' : 's'} encontrados
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
            {displayed.length === 0 && (
              <tr>
                <td
                  colSpan={2 + visibleStores.length}
                  style={{ padding: 16, color: '#6B7280', textAlign: 'center' }}
                >
                  No se encontraron productos para la búsqueda/filtros actuales.
                </td>
              </tr>
            )}

            {displayed.map(([nombre, info]) => {
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
    </main>
  );
}
