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
  s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const CLP = (v) => (typeof v === 'number' ? `$${Number(v).toLocaleString('es-CL')}` : '—');

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

  const [activeStores, setActiveStores] = useState({
    lider: true,
    jumbo: true,
    unimarc: true,
    'santa-isabel': true,
  });

  // Controles colapsables
  const [showExport, setShowExport] = useState(false);
  const [showPageSize, setShowPageSize] = useState(false);

  // Paginación
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

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
    rows.forEach((r) => r.categoria && set.add(r.categoria));
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
        map[key] = { categoria: r.categoria, formato: r.formato, precios: {} };
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
    return list.length ? list : STORE_ORDER;
  }, [activeStores]);

  /* -----------------------------
     Filtrar + ordenar
     ----------------------------- */
  const qn = norm(q);
  const filteredSorted = useMemo(() => {
    let list = Object.entries(productos);

    // Buscador
    if (qn) {
      list = list.filter(([nombre, info]) => {
        const n = norm(nombre);
        const c = norm(info.categoria || '');
        return n.includes(qn) || c.includes(qn);
      });
    }

    // Categoría
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
  }, [productos, qn, category, order, visibleStores]);

  // Paginación aplicada a la tabla
  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const sliceFrom = (safePage - 1) * pageSize;
  const pageRows = filteredSorted.slice(sliceFrom, sliceFrom + pageSize);

  useEffect(() => {
    // Si cambian filtros/orden, vuelve a la página 1
    setPage(1);
  }, [q, category, order, activeStores, pageSize]);

  /* -----------------------------
     Acciones
     ----------------------------- */
  function cheapestVisible(precios, stores) {
    const vals = stores.map((s) => precios[s]).filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
  }

  const toggleStore = (slug) =>
    setActiveStores((prev) => ({ ...prev, [slug]: !prev[slug] }));

  const clearFilters = () => {
    setQ('');
    setCategory('todas');
    setOrder('price-asc');
    setActiveStores({ lider: true, jumbo: true, unimarc: true, 'santa-isabel': true });
    setPage(1);
  };

  /* ===== Exportaciones (UI plegable) ===== */
  const tableHeaders = ['Producto', 'Formato', ...visibleStores.map((s) => STORE_META[s]?.label ?? s)];
  const tableDataAll = filteredSorted.map(([nombre, info]) => ({
    nombre,
    formato: info.formato || '—',
    precios: visibleStores.map((s) => (info.precios[s] ?? null)),
  }));
  const tableDataPage = pageRows.map(([nombre, info]) => ({
    nombre,
    formato: info.formato || '—',
    precios: visibleStores.map((s) => (info.precios[s] ?? null)),
  }));

  const toCSV = (rowsObj) => {
    const header = tableHeaders.join(',');
    const body = rowsObj
      .map((r) =>
        [r.nombre, r.formato, ...r.precios.map((v) => (v == null ? '' : v))].join(',')
      )
      .join('\n');
    return `${header}\n${body}`;
  };

  const download = (filename, content, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyTable = (rowsObj) => {
    const txt =
      [tableHeaders.join('\t')]
        .concat(
          rowsObj.map((r) =>
            [r.nombre, r.formato, ...r.precios.map((v) => (v == null ? '' : v))].join('\t')
          )
        )
        .join('\n');
    navigator.clipboard.writeText(txt);
    alert('Tabla copiada al portapapeles.');
  };

  const exportCSVPage = () =>
    download('bipi-productos-pagina.csv', toCSV(tableDataPage), 'text/csv;charset=utf-8;');

  const exportCSVAll = () =>
    download('bipi-productos-filtrado.csv', toCSV(tableDataAll), 'text/csv;charset=utf-8;');

  const exportExcelPage = () =>
    download('bipi-productos-pagina.xls', toCSV(tableDataPage), 'application/vnd.ms-excel');

  const exportExcelAll = () =>
    download('bipi-productos-filtrado.xls', toCSV(tableDataAll), 'application/vnd.ms-excel');

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
        {/* fila 1: buscador / categoría / ordenar */}
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
                <option key={c} value={c}>
                  {c === 'todas' ? 'Todas' : c}
                </option>
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

        {/* fila 2: chips tiendas + acciones limpias + toggles compactos */}
        <div className="toolbar-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="toolbar-chips" role="group" aria-label="Tiendas">
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

          <div className="toolbar-actions">
            {/* Filas por página (colapsable) */}
            <button
              type="button"
              className="chip"
              onClick={() => setShowPageSize((v) => !v)}
              aria-expanded={showPageSize}
              title="Cambiar filas por página"
            >
              Filas por página: {pageSize} ▾
            </button>

            {/* Exportar (colapsable) */}
            <button
              type="button"
              className="chip"
              onClick={() => setShowExport((v) => !v)}
              aria-expanded={showExport}
              title="Opciones de exportación"
            >
              Exportar ▾
            </button>

            <button type="button" className="chip chip-clear" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* fila 3: secciones desplegables alineadas en una misma altura */}
        <div className="toolbar-row" style={{ alignItems: 'center' }}>
          {/* bloque selector de page size */}
          {showPageSize && (
            <div className="toolbar-group" style={{ marginRight: 8 }}>
              <label className="toolbar-label" htmlFor="pagesize">Filas por página</label>
              <select
                id="pagesize"
                className="toolbar-select"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}

          {/* bloque exportación */}
          {showExport && (
            <div className="toolbar-actions" aria-label="Exportar">
              <span className="toolbar-label" style={{ marginRight: 6 }}>Exportar</span>
              <button className="chip" onClick={() => copyTable(tableDataPage)}>Copiar tabla</button>
              <button className="chip" onClick={exportCSVPage}>Página actual (CSV)</button>
              <button className="chip" onClick={exportCSVAll}>Todo filtrado (CSV)</button>
              <button className="chip" onClick={exportExcelPage}>Página actual (Excel)</button>
              <button className="chip" onClick={exportExcelAll}>Todo filtrado (Excel)</button>
            </div>
          )}

          {/* contador al final de la fila */}
          <span className="muted" style={{ marginLeft: 'auto' }}>
            {total} producto{total === 1 ? '' : 's'} encontrados
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
            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={2 + visibleStores.length}
                  style={{ padding: 16, color: '#6B7280', textAlign: 'center' }}
                >
                  No se encontraron productos para la búsqueda/filtros actuales.
                </td>
              </tr>
            )}

            {pageRows.map(([nombre, info]) => {
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

      {/* Paginación simple */}
      {totalPages > 1 && (
        <div className="toolbar-row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button
            className="chip"
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            title="Anterior"
          >
            ← Anterior
          </button>
          <span className="muted" style={{ padding: '0 8px' }}>
            Página {safePage} de {totalPages}
          </span>
          <button
            className="chip"
            disabled={safePage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            title="Siguiente"
          >
            Siguiente →
          </button>
        </div>
      )}

      <p className="muted" style={{ marginTop: 14 }}>
        Nota: precios referenciales del MVP. Pueden variar por tienda y ciudad.
      </p>
    </main>
  );
}
