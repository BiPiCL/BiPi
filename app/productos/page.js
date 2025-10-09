'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
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

/* Helpers URL <-> Estado */
const parseBool = (v) => v === '1' || v === 'true';
const encodeStores = (obj) => STORE_ORDER.map((s) => (obj[s] ? '1' : '0')).join('');
const decodeStores = (str) => {
  const flags = (str || '').padEnd(STORE_ORDER.length, '1').slice(0, STORE_ORDER.length);
  const out = {};
  STORE_ORDER.forEach((s, i) => (out[s] = flags[i] === '1'));
  return out;
};

export default function Productos() {
  /* -----------------------------
     Estado base
     ----------------------------- */
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  // Filtros/orden
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('todas');
  const [order, setOrder] = useState('price-asc');

  // Tiendas activas
  const [activeStores, setActiveStores] = useState({
    lider: true,
    jumbo: true,
    unimarc: true,
    'santa-isabel': true,
  });

  // Controles plegables
  const [showStores, setShowStores] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showPageSize, setShowPageSize] = useState(false);

  // Paginación simple (cortamos número de filas visibles)
  const [pageSize, setPageSize] = useState(25);

  // Debounce para el buscador
  const searchRef = useRef(q);
  const debounceTimer = useRef(null);

  /* -----------------------------
     Cargar datos
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
     Categorías únicas
     ----------------------------- */
  const categories = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => r.categoria && set.add(r.categoria));
    return ['todas', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  /* -----------------------------
     Agrupar por producto
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
    return map;
  }, [rows]);

  /* -----------------------------
     Tiendas visibles (según chips)
     ----------------------------- */
  const visibleStores = useMemo(() => {
    const list = STORE_ORDER.filter((slug) => activeStores[slug]);
    return list.length ? list : STORE_ORDER; // si apagan todas, mostramos todas
  }, [activeStores]);

  const allSelected = STORE_ORDER.every((s) => activeStores[s]);

  /* -----------------------------
     Filtrar + ordenar
     ----------------------------- */
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

  const pageItems = useMemo(() => filteredSorted.slice(0, pageSize), [filteredSorted, pageSize]);

  /* -----------------------------
     Precio mínimo visible
     ----------------------------- */
  function cheapestVisible(precios, stores) {
    const vals = stores.map((s) => precios[s]).filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
  }

  /* -----------------------------
     Acciones UI
     ----------------------------- */
  const toggleStore = (slug) =>
    setActiveStores((prev) => ({ ...prev, [slug]: !prev[slug] }));

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
    setActiveStores({ lider: true, jumbo: true, unimarc: true, 'santa-isabel': true });
    setPageSize(25);
  };

  /* -----------------------------
     Sincronización con URL (C.4)
     ----------------------------- */

  // 1) Leer URL al montar y precargar estado
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);

    const q0 = sp.get('q');
    const cat0 = sp.get('cat');
    const ord0 = sp.get('ord');
    const size0 = sp.get('size');
    const stores0 = sp.get('stores'); // ej: "1101" (lider/jumbo/unimarc/santa-isabel)

    if (q0 !== null) setQ(q0);
    if (cat0 !== null) setCategory(cat0);
    if (ord0 !== null) setOrder(ord0);
    if (size0 !== null && !Number.isNaN(Number(size0))) setPageSize(Number(size0));
    if (stores0) setActiveStores(decodeStores(stores0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Actualizar URL cuando cambie el estado (con debounce para q)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // usamos searchRef + debounce: actualiza cuando el usuario “termina” de escribir
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      searchRef.current = q;

      const sp = new URLSearchParams(window.location.search);
      q ? sp.set('q', q) : sp.delete('q');
      category && category !== 'todas' ? sp.set('cat', category) : sp.delete('cat');
      order && order !== 'price-asc' ? sp.set('ord', order) : sp.delete('ord');
      pageSize !== 25 ? sp.set('size', String(pageSize)) : sp.delete('size');

      const storesEncoded = encodeStores(activeStores);
      storesEncoded !== '1111' ? sp.set('stores', storesEncoded) : sp.delete('stores');

      const newUrl = `${window.location.pathname}?${sp.toString()}`;
      window.history.replaceState(null, '', newUrl);
    }, 250);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [q, category, order, pageSize, activeStores]);

  // Botón “Compartir vista”
  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Enlace copiado. ¡Puedes compartir esta vista!');
    } catch {
      alert('No se pudo copiar el enlace.');
    }
  };

  /* -----------------------------
     Exportar (CSV/Excel minimal)
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
      alert('Tabla copiada (CSV).');
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

        {/* === FILA 2 (todo alineado) === */}
        <div className="toolbar-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Tiendas (sin label encima) */}
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
                <button type="button" className="chip" onClick={toggleAllStores}>
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

          {/* Acciones derechas */}
          <div className="toolbar-actions">
            {/* Filas */}
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

            {/* Exportar */}
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

            {/* Compartir */}
            <button type="button" className="chip" onClick={handleShare} title="Copiar enlace de esta vista">
              Compartir vista
            </button>

            {/* Limpiar */}
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
