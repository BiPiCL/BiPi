'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/* ===========================
   Supabase (env)
   =========================== */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/* ===========================
   Utils
   =========================== */
const norm = (s = '') =>
  s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

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

/* Orden */
const ORDER_OPTIONS = [
  { id: 'price-asc', label: 'Precio (Menor a Mayor) ↑' },
  { id: 'price-desc', label: 'Precio (Mayor a Menor) ↓' },
  { id: 'name-asc', label: 'Nombre A → Z' },
  { id: 'name-desc', label: 'Nombre Z → A' },
];

export default function Productos() {
  /* -----------------------------
     Estado base
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

  /* Paginación visual (filas por página) */
  const [pageSize, setPageSize] = useState(25);

  /* Popovers abiertos: 'stores' | 'rows' | 'export' | null */
  const [openMenu, setOpenMenu] = useState(null);

  /* Autocomplete */
  const [showAuto, setShowAuto] = useState(false);
  const inputWrapRef = useRef(null);
  const toolbarRef = useRef(null);

  /* -----------------------------
     Carga datos
     ----------------------------- */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('product_price_matrix')
        .select('product_id, producto, categoria, formato, tienda_slug, precio_clp')
        .order('producto', { ascending: true });

      if (error) setErr(error.message);
      else setRows(data ?? []);
    })();
  }, []);

  /* Categorías únicas */
  const categories = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => r.categoria && set.add(r.categoria));
    return ['todas', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  /* Agrupar por producto */
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

  /* Sugerencias de autocomplete (nombres únicos que matcheen q) */
  const suggestions = useMemo(() => {
    const qn = norm(q);
    if (!qn) return [];
    const all = Object.keys(productos);
    return all
      .filter((name) => norm(name).includes(qn))
      .slice(0, 8); // top 8
  }, [q, productos]);

  /* Tiendas visibles (chips) */
  const visibleStores = useMemo(() => {
    const list = STORE_ORDER.filter((slug) => activeStores[slug]);
    return list.length ? list : STORE_ORDER;
  }, [activeStores]);

  /* Filtro + orden */
  const qn = norm(q);
  const filteredSorted = useMemo(() => {
    let list = Object.entries(productos);

    // Buscar en nombre/categoría
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

  function cheapestVisible(precios, stores) {
    const vals = stores.map((s) => precios[s]).filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
  }

  /* -----------------------------
     Acciones
     ----------------------------- */
  const toggleStore = (slug) => {
    setActiveStores((prev) => ({ ...prev, [slug]: !prev[slug] }));
    setOpenMenu(null); // cerrar al elegir
  };

  const selectAllStores = () => {
    setActiveStores({ lider: true, jumbo: true, unimarc: true, 'santa-isabel': true });
    setOpenMenu(null);
  };

  const clearAllStores = () => {
    setActiveStores({ lider: false, jumbo: false, unimarc: false, 'santa-isabel': false });
    setOpenMenu(null);
  };

  const clearFilters = () => {
    setQ('');
    setCategory('todas');
    setOrder('price-asc');
    setActiveStores({ lider: true, jumbo: true, unimarc: true, 'santa-isabel': true });
  };

  const copyView = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('q', q);
      url.searchParams.set('cat', category);
      url.searchParams.set('ord', order);
      await navigator.clipboard.writeText(url.toString());
      showToast('Se copió el link de búsqueda');
    } catch (e) {
      showToast('No se pudo copiar');
    }
  };

  const [toast, setToast] = useState('');
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  /* Cerrar popovers al hacer click afuera */
  useEffect(() => {
    const onDown = (e) => {
      const t = e.target;
      const wrap = toolbarRef.current;
      if (!wrap || !wrap.contains(t)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, []);

  /* Abrir/cerrar un popover y cerrar los otros */
  const toggleMenu = useCallback((id) => {
    setOpenMenu((prev) => (prev === id ? null : id));
  }, []);

  /* Autocomplete: abrir al focus, cerrar con click fuera o selección */
  useEffect(() => {
    const handler = (e) => {
      const w = inputWrapRef.current;
      if (!w || !w.contains(e.target)) setShowAuto(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const onSelectSuggestion = (name) => {
    setQ(name);
    setShowAuto(false);
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
      <section ref={toolbarRef} className="toolbar">
        {/* fila 1: buscador + categoría + ordenar */}
        <div className="toolbar-row">
          {/* BUSCAR */}
          <div className="toolbar-group" style={{ flex: 1, minWidth: 260 }}>
            <label className="toolbar-label" htmlFor="buscar">Buscar</label>

            <div ref={inputWrapRef} className="input-relative">
              <input
                id="buscar"
                className="toolbar-input"
                value={q}
                onFocus={() => setShowAuto(true)}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ej: arroz, aceite, papel, sal…"
                inputMode="search"
              />

              {/* Sugerencias */}
              {showAuto && suggestions.length > 0 && (
                <div className="autocomplete">
                  {suggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="autocomplete__item"
                      // mousedown evita que se pierda el foco antes del click en móvil
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onSelectSuggestion(name);
                      }}
                      onClick={() => onSelectSuggestion(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CATEGORÍA */}
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

          {/* ORDENAR */}
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

        {/* fila 2: popovers + acciones */}
        <div className="toolbar-row actions-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
          {/* Tiendas */}
          <div className="toolbar__dropdown">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => toggleMenu('stores')}
              aria-expanded={openMenu === 'stores'}
            >
              Tiendas ({STORE_ORDER.filter((s) => activeStores[s]).length})
              <span aria-hidden> ▾</span>
            </button>

            <div className={`menu-pop ${openMenu === 'stores' ? 'show' : ''}`} role="menu">
              <div className="menu-pop__header">
                <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllStores}>
                  Seleccionar todas
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearAllStores}>
                  Quitar todas
                </button>
              </div>

              <div className="menu-pop__grid">
                {STORE_ORDER.map((slug) => {
                  const on = activeStores[slug];
                  const label = STORE_META[slug]?.label ?? slug;
                  return (
                    <button
                      key={slug}
                      type="button"
                      className={`chip ${on ? 'chip-active' : ''}`}
                      onClick={() => toggleStore(slug)}
                      role="menuitem"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Filas por página */}
          <div className="toolbar__dropdown">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => toggleMenu('rows')}
              aria-expanded={openMenu === 'rows'}
            >
              Filas: {pageSize} <span aria-hidden> ▾</span>
            </button>

            <div className={`menu-pop ${openMenu === 'rows' ? 'show' : ''}`} role="menu">
              {[10, 25, 50, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="menu-pop__item"
                  onClick={() => {
                    setPageSize(n);
                    setOpenMenu(null); // cerrar al elegir
                  }}
                  role="menuitem"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Exportar */}
          <div className="toolbar__dropdown">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => toggleMenu('export')}
              aria-expanded={openMenu === 'export'}
            >
              Exportar <span aria-hidden> ▾</span>
            </button>

            <div className={`menu-pop ${openMenu === 'export' ? 'show' : ''}`} role="menu">
              <button
                type="button"
                className="menu-pop__item"
                onClick={async () => {
                  // Copiar tabla (texto)
                  try {
                    const lines = [
                      ['Producto', 'Formato', ...visibleStores.map((s) => STORE_META[s]?.label ?? s)].join('\t'),
                      ...filteredSorted.map(([nombre, info]) => {
                        const cols = visibleStores.map((s) =>
                          info.precios[s] != null ? Number(info.precios[s]) : ''
                        );
                        return [nombre, info.formato || '', ...cols].join('\t');
                      }),
                    ];
                    await navigator.clipboard.writeText(lines.join('\n'));
                    showToast('Tabla copiada');
                  } catch {
                    showToast('No se pudo copiar');
                  }
                  setOpenMenu(null);
                }}
                role="menuitem"
              >
                Copiar
              </button>

              <button
                type="button"
                className="menu-pop__item"
                onClick={() => {
                  // CSV
                  const header = ['Producto', 'Formato', ...visibleStores.map((s) => STORE_META[s]?.label ?? s)];
                  const rowsCsv = filteredSorted.map(([nombre, info]) => {
                    const cols = visibleStores.map((s) =>
                      info.precios[s] != null ? Number(info.precios[s]) : ''
                    );
                    return [nombre, info.formato || '', ...cols];
                  });
                  const csv = [header, ...rowsCsv]
                    .map((r) => r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(','))
                    .join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'bipi_productos.csv';
                  a.click();
                  URL.revokeObjectURL(a.href);
                  setOpenMenu(null);
                }}
                role="menuitem"
              >
                CSV
              </button>

              <button
                type="button"
                className="menu-pop__item"
                onClick={() => {
                  // Excel (CSV con .xls para compat)
                  const header = ['Producto', 'Formato', ...visibleStores.map((s) => STORE_META[s]?.label ?? s)];
                  const rowsCsv = filteredSorted.map(([nombre, info]) => {
                    const cols = visibleStores.map((s) =>
                      info.precios[s] != null ? Number(info.precios[s]) : ''
                    );
                    return [nombre, info.formato || '', ...cols];
                  });
                  const csv = [header, ...rowsCsv]
                    .map((r) => r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(','))
                    .join('\n');
                  const blob = new Blob([csv], { type: 'application/vnd.ms-excel' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'bipi_productos.xls';
                  a.click();
                  URL.revokeObjectURL(a.href);
                  setOpenMenu(null);
                }}
                role="menuitem"
              >
                Excel
              </button>
            </div>
          </div>

          {/* Compartir + Limpiar */}
          <button type="button" className="btn btn-secondary btn-sm" onClick={copyView}>
            Compartir búsqueda
          </button>

          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>

        {/* contador */}
        <div className="toolbar-row" style={{ marginBottom: 0 }}>
          <span className="muted">
            {filteredSorted.length} producto{filteredSorted.length === 1 ? '' : 's'} encontrados
          </span>
        </div>
      </section>

      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
      {err && <p style={{ color: 'red', marginTop: 8 }}>Error al cargar datos: {err}</p>}

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

      <p className="muted" style={{ marginTop: 14 }}>
        Nota: precios referenciales del MVP. Pueden variar por tienda y ciudad.
      </p>
    </main>
  );
}
