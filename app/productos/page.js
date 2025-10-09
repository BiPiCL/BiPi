'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

/* Mapa de tiendas (slug → etiqueta) */
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

  /* Tiendas activas (todas activas por defecto) */
  const [activeStores, setActiveStores] = useState({
    lider: true,
    jumbo: true,
    unimarc: true,
    'santa-isabel': true,
  });

  /* NUEVO: colapsable de tiendas */
  const [showStores, setShowStores] = useState(false);

  /* NUEVO: toggles de exportación y filas/por página */
  const [showExport, setShowExport] = useState(false);
  const [showPageSize, setShowPageSize] = useState(false);
  const [pageSize, setPageSize] = useState(25);

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
          precios: {},
        };
      }
      map[key].precios[r.tienda_slug] = r.precio_clp;
    });
    return map;
  }, [rows]);

  /* -----------------------------
     Tiendas visibles (chips)
     ----------------------------- */
  const visibleStores = useMemo(() => {
    const list = STORE_ORDER.filter((slug) => activeStores[slug]);
    return list.length ? list : STORE_ORDER;
  }, [activeStores]);

  /* Saber si todas las tiendas están seleccionadas */
  const allSelected = STORE_ORDER.every((s) => activeStores[s]);

  /* -----------------------------
     Filtrar + ordenar
     ----------------------------- */
  const qn = norm(q);
  const filteredSorted = useMemo(() => {
    let list = Object.entries(productos);

    // Filtro buscador
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
      // Orden por precio
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

  const pageItems = useMemo(() => filteredSorted.slice(0, pageSize), [filteredSorted, pageSize]);

  /* Precio mínimo visible */
  function cheapestVisible(precios, stores) {
    const vals = stores.map((s) => precios[s]).filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
  }

  /* Toggle chip */
  const toggleStore = (slug) =>
    setActiveStores((prev) => ({ ...prev, [slug]: !prev[slug] }));

  /* Seleccionar o quitar todas dinámico */
  const toggleAllStores = () => {
    const newState = !allSelected;
    const updated = {};
    STORE_ORDER.forEach((s) => (updated[s] = newState));
    setActiveStores(updated);
  };

  const clearFilters = () => {
    setQ('');
    setCategory('todas');
    setOrder('price-asc');
    setActiveStores({
      lider: true,
      jumbo: true,
      unimarc: true,
      'santa-isabel': true,
    });
  };

  /* -----------------------------
     Exportar (CSV/Excel)
     ----------------------------- */
  function toCSV(rowsArr) {
    const headers = ['Producto', 'Formato', ...visibleStores.map((s) => STORE_META[s]?.label ?? s)];
    const lines = [headers.join(',')];
    rowsArr.forEach(([nombre, info]) => {
      const row = [
        `"${nombre.replace(/"/g, '""')}"`,
        `"${(info.formato || '').replace(/"/g, '""')}"`,
        ...visibleStores.map((s) => (info.precios[s] != null ? info.precios[s] : '')),
      ];
      lines.push(row.join(','));
    });
    return lines.join('\n');
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleDownloadCSV = () => {
    const csv = toCSV(filteredSorted);
    downloadBlob(csv, 'bipi_productos.csv', 'text/csv;charset=utf-8;');
  };

  const handleCopyTable = async () => {
    const csv = toCSV(pageItems);
    try {
      await navigator.clipboard.writeText(csv);
      alert('Tabla copiada al portapapeles (formato CSV).');
    } catch {
      alert('No se pudo copiar. Permite el acceso al portapapeles.');
    }
  };

  const handleDownloadExcel = () => {
    const csv = toCSV(filteredSorted);
    downloadBlob(csv, 'bipi_productos.csv', 'text/csv;charset=utf-8;');
  };

  /* -----------------------------
     Render
     ----------------------------- */
  return (
    <main className="container" style={{ paddingTop: 18, paddingBottom: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
        Comparador de precios — Productos
      </h1>

      <section className="toolbar">
        {/* === FILA 1 === */}
        <div className="toolbar-row">
          <div className="toolbar-group" style={{ flex: 1, minWidth: 240 }}>
            <label className="toolbar-label" htmlFor="buscar">Buscar</label>
            <input
              id="buscar"
              className="toolbar-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej: arroz, aceite, papel, sal…"
            />
          </div>

          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="categoria">Categoría</label>
            <select
              id="categoria"
              className="toolbar-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c === 'todas' ? 'Todas' : c}</option>
              ))}
            </select>
          </div>

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

        {/* === FILA 2 === */}
        <div className="toolbar-row" style={{ justifyContent: 'space-between' }}>
          {/* Tiendas */}
          <div className="toolbar-group" style={{ flex: 1, minWidth: 240 }}>
            <label className="toolbar-label">Tiendas</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="chip"
                onClick={() => setShowStores((s) => !s)}
              >
                {`Tiendas (${STORE_ORDER.length}) ${showStores ? '▴' : '▾'}`}
              </button>

              {showStores && (
                <div className="toolbar-chips" style={{ width: '100%', marginTop: 8 }}>
                  <button
                    type="button"
                    className="chip"
                    onClick={toggleAllStores}
                  >
                    {allSelected ? 'Quitar todas' : 'Seleccionar todas'}
                  </button>

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
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Exportación + filas */}
          <div className="toolbar-actions">
            <button
              type="button"
              className="chip"
              onClick={() => setShowPageSize((s) => !s)}
            >
              {`Filas: ${pageSize} ${showPageSize ? '▴' : '▾'}`}
            </button>
            {showPageSize && (
              <select
                className="toolbar-select"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            )}

            <button
              type="button"
              className="chip"
              onClick={() => setShowExport((s) => !s)}
            >
              {`Exportar ${showExport ? '▴' : '▾'}`}
            </button>

            {showExport && (
              <div className="toolbar-actions">
                <button type="button" className="chip" onClick={handleCopyTable}>Copiar</button>
                <button type="button" className="chip" onClick={handleDownloadCSV}>CSV</button>
                <button type="button" className="chip" onClick={handleDownloadExcel}>Excel</button>
              </div>
            )}

            <button type="button" className="chip chip-clear" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* === FILA 3 === */}
        <div className="toolbar-row" style={{ marginBottom: 0 }}>
          <span className="muted">
            {filteredSorted.length} producto{filteredSorted.length === 1 ? '' : 's'} encontrados
          </span>
        </div>
      </section>

      {/* === TABLA === */}
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Formato</th>
              {visibleStores.map((s) => (
                <th key={s} style={{ textAlign: 'right' }}>
                  {STORE_META[s]?.label ?? s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={2 + visibleStores.length} style={{ textAlign: 'center', padding: 16 }}>
                  No se encontraron productos.
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
    </main>
  );
}
