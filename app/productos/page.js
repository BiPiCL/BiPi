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
  // ---- Datos y estado base ----
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  // ---- Filtros / orden ----
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('todas');
  const [order, setOrder] = useState('price-asc');
  const [activeStores, setActiveStores] = useState({
    lider: true,
    jumbo: true,
    unimarc: true,
    'santa-isabel': true,
  });

  // ---- Paginación ----
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ---- Exportación ----
  // scope: "page" (página actual) | "all" (todo filtrado)
  const [exportScope, setExportScope] = useState('page');

  // Carga de datos
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from('product_price_matrix')
        .select(
          'product_id, producto, categoria, formato, tienda_slug, tienda, precio_clp'
        )
        .order('producto', { ascending: true });

      if (error) setErr(error.message);
      else setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  // Categorías únicas
  const categories = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.categoria) set.add(r.categoria);
    });
    return ['todas', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  // Agrupar por producto
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

  // Tiendas visibles (según chips)
  const visibleStores = useMemo(() => {
    const list = STORE_ORDER.filter((slug) => activeStores[slug]);
    return list.length ? list : STORE_ORDER; // si apagan todas, mostramos todas
  }, [activeStores]);

  // Filtrar + ordenar
  const qn = norm(q);
  const filteredSorted = useMemo(() => {
    let list = Object.entries(productos);

    if (qn) {
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

  // Helpers
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
  };

  // Reset a página 1 al cambiar filtros o tamaño
  useEffect(() => {
    setPage(1);
  }, [q, category, order, activeStores, pageSize]);

  // Paginación (slice)
  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredSorted.slice(start, end);

  // ===== Export / Copiar =====
  function buildMatrix(dataEntries, storeSlugs) {
    // Cabeceras
    const headers = ['Producto', 'Formato', ...storeSlugs.map((s) => STORE_META[s]?.label ?? s)];
    // Filas (sin $ y sin separador de miles para que Excel lo tome como número)
    const rows = dataEntries.map(([nombre, info]) => {
      const vals = storeSlugs.map((s) => (info.precios[s] != null ? info.precios[s] : ''));
      return [nombre, info.formato || '', ...vals];
    });
    return { headers, rows };
  }

  function downloadCSV() {
    const dataset = exportScope === 'page' ? pageItems : filteredSorted;
    const { headers, rows } = buildMatrix(dataset, visibleStores);
    // CSV con separador ';' (Excel-friendly) + línea "sep=;" para Excel
    const lines = [];
    lines.push('sep=;');
    lines.push(headers.join(';'));
    rows.forEach((r) => {
      // Escapar ; y comillas si aparecieran en el nombre/formato
      const safe = r.map((cell) => {
        const v = cell === null || cell === undefined ? '' : String(cell);
        return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      });
      lines.push(safe.join(';'));
    });
    const csv = lines.join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'bipi_productos.csv');
  }

  function downloadExcel() {
    // Truco simple: TSV con MIME de Excel. Excel abre limpio en columnas.
    const dataset = exportScope === 'page' ? pageItems : filteredSorted;
    const { headers, rows } = buildMatrix(dataset, visibleStores);

    const tsvLines = [];
    tsvLines.push(headers.join('\t'));
    rows.forEach((r) => {
      const safe = r.map((cell) =>
        cell === null || cell === undefined ? '' : String(cell).replace(/\t/g, ' ')
      );
      tsvLines.push(safe.join('\t'));
    });
    const tsv = tsvLines.join('\n');

    const blob = new Blob([tsv], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'bipi_productos.xls');
  }

  function copyTable() {
    const dataset = exportScope === 'page' ? pageItems : filteredSorted;
    const headers = ['Producto', 'Formato', ...visibleStores.map((s) => STORE_META[s]?.label ?? s)];
    const lines = [];
    lines.push(headers.join('\t'));
    dataset.forEach(([nombre, info]) => {
      const vals = visibleStores.map((s) => (info.precios[s] != null ? CLP(info.precios[s]) : '—'));
      lines.push([nombre, info.formato || '', ...vals].join('\t'));
    });
    const text = lines.join('\n');

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
  }

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ========================= RENDER =========================
  return (
    <main className="container" style={{ paddingTop: 18, paddingBottom: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
        Comparador de precios — Productos
      </h1>

      {/* ====== TOOLBAR avanzada ====== */}
      <section className="toolbar" role="region" aria-label="Filtros de productos">
        {/* fila 1 */}
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
              aria-label="Ordenar por"
            >
              {ORDER_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="pagesize">
              Filas por página
            </label>
            <select
              id="pagesize"
              className="toolbar-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Filas por página"
            >
              {[5, 10, 15, 20, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* fila 2: chips tiendas + limpiar */}
        <div className="toolbar-row" style={{ justifyContent: 'space-between' }}>
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

          <button type="button" className="chip chip-clear" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>

        {/* fila 3: contador + export */}
        <div className="toolbar-row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 0 }}>
          <span className="muted">
            {total} producto{total === 1 ? '' : 's'} encontrados
          </span>

          {/* Export scope */}
          <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
            <label className="toolbar-label">Exportar</label>
            <div className="toolbar-chips">
              <button
                type="button"
                className={`chip ${exportScope === 'page' ? 'chip-active' : ''}`}
                onClick={() => setExportScope('page')}
                aria-pressed={exportScope === 'page'}
                title="Exportar solo la página visible"
              >
                Página actual
              </button>
              <button
                type="button"
                className={`chip ${exportScope === 'all' ? 'chip-active' : ''}`}
                onClick={() => setExportScope('all')}
                aria-pressed={exportScope === 'all'}
                title="Exportar todo el resultado filtrado"
              >
                Todo filtrado
              </button>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="toolbar-chips">
            <button type="button" className="chip" onClick={copyTable} title="Copiar tabla al portapapeles">
              Copiar tabla
            </button>
            <button type="button" className="chip" onClick={downloadCSV} title="Descargar CSV (Excel/Google Sheets)">
              Descargar CSV
            </button>
            <button type="button" className="chip" onClick={downloadExcel} title="Descargar Excel">
              Descargar Excel
            </button>
          </div>
        </div>
      </section>

      {/* Errores */}
      {!loading && err && (
        <p style={{ color: 'red', marginTop: 8 }}>
          Error al cargar datos: {err}
        </p>
      )}

      {/* ====== TABLA ====== */}
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
        <table aria-label="Tabla comparativa de precios">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Formato</th>
              {visibleStores.map((s) => (
                <th
                  key={s}
                  style={{
                    textAlign: 'right',
                    textTransform: 'capitalize',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {STORE_META[s]?.label ?? s}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Skeleton */}
            {loading &&
              [...Array(pageSize)].map((_, i) => (
                <tr key={`sk-${i}`} aria-hidden="true">
                  <td colSpan={2} style={{ padding: 12 }}>
                    <div style={{ height: 14, width: '60%', background: '#eef2f7', borderRadius: 6 }} />
                  </td>
                  {visibleStores.map((s) => (
                    <td key={`sk-${i}-${s}`} style={{ textAlign: 'right', padding: 12 }}>
                      <div style={{ height: 14, width: 70, marginLeft: 'auto', background: '#eef2f7', borderRadius: 6 }} />
                    </td>
                  ))}
                </tr>
              ))}

            {/* Sin resultados */}
            {!loading && total === 0 && (
              <tr>
                <td colSpan={2 + visibleStores.length} style={{ padding: 16, color: '#6B7280', textAlign: 'center' }}>
                  No se encontraron productos para la búsqueda/filtros actuales.
                </td>
              </tr>
            )}

            {/* Filas paginadas */}
            {!loading &&
              pageItems.map(([nombre, info]) => {
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

      {/* Paginación */}
      {!loading && total > 0 && (
        <nav
          className="toolbar-row"
          style={{ justifyContent: 'space-between', marginTop: 16 }}
          aria-label="Paginación"
        >
          <span className="muted">
            Mostrando <strong>{Math.min(end, total)}</strong> de <strong>{total}</strong> productos
          </span>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="chip"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSafe === 1}
              aria-label="Página anterior"
              style={{ opacity: pageSafe === 1 ? 0.5 : 1 }}
            >
              ← Anterior
            </button>
            <div className="chip" aria-current="page">
              Página {pageSafe} / {totalPages}
            </div>
            <button
              className="chip"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSafe === totalPages}
              aria-label="Página siguiente"
              style={{ opacity: pageSafe === totalPages ? 0.5 : 1 }}
            >
              Siguiente →
            </button>
          </div>
        </nav>
      )}

      <p className="muted" style={{ marginTop: 14 }}>
        Nota: precios referenciales del MVP. Pueden variar por tienda y ciudad.
      </p>
    </main>
  );
}
