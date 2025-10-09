'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function ProductsToolbar() {
  const [query, setQuery] = useState('');
  const [stores, setStores] = useState([]); // tiendas detectadas por encabezados
  const [activeStores, setActiveStores] = useState(new Set()); // tiendas filtradas
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc' | 'none'
  const tableRef = useRef(null);

  // Al montar: localizar la tabla y detectar nombres de tiendas desde el thead
  useEffect(() => {
    const table = document.querySelector('table');
    if (!table) return;

    tableRef.current = table;

    // Detectar nombres de columnas (tiendas) a partir del thead
    const headCells = table.querySelectorAll('thead th, thead td');
    const headerTexts = Array.from(headCells).map(el =>
      el.innerText.trim().toLowerCase()
    );

    // heurística: considerar "jumbo", "líder/lider", "unimarc", "santa isabel/santa-isabel"
    const candidates = ['jumbo', 'líder', 'lider', 'unimarc', 'santa isabel', 'santaisabel', 'santa-isabel'];
    const found = [];
    headerTexts.forEach((txt, idx) => {
      candidates.forEach(key => {
        if (txt.includes(key) && !found.find(f => f.index === idx)) {
          found.push({ index: idx, label: normalizeStoreLabel(txt) });
        }
      });
    });

    // Unificar "líder/lider" y "santa isabel" etc.
    const normalized = dedupeStores(found.map(f => f.label));
    setStores(normalized);

    // Por defecto: ninguna tienda activa (muestra todas). Si quieres al revés, inicializa con todas.
    setActiveStores(new Set());
  }, []);

  // Normaliza rótulos (visual)
  function normalizeStoreLabel(txt) {
    const t = txt.toLowerCase();
    if (t.includes('líder') || t.includes('lider')) return 'Líder';
    if (t.includes('jumbo')) return 'Jumbo';
    if (t.includes('unimarc')) return 'Unimarc';
    if (t.includes('santa')) return 'Santa Isabel';
    return txt;
  }
  function dedupeStores(arr) {
    const map = new Map();
    arr.forEach(x => map.set(x, true));
    return Array.from(map.keys());
  }

  // Handlers
  const toggleStore = (name) => {
    const next = new Set(activeStores);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setActiveStores(next);
  };

  const visibleRows = useMemo(() => {
    // No calculamos filas aquí (lo haremos en el DOM). Este memo
    // solo sirve para re-renderizar la UI del toolbar cuando cambian filtros.
    return { q: query, stores: activeStores, sortDir };
  }, [query, activeStores, sortDir]);

  // Efecto que aplica filtros y orden al DOM de la tabla
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const tbody = table.querySelector('tbody') || table;
    const rows = Array.from(tbody.querySelectorAll('tr'));

    // 1) FILTRAR por búsqueda (nombre de producto)
    rows.forEach(row => {
      // Se asume que el nombre de producto está en la primera o segunda celda (heurística).
      const cells = row.querySelectorAll('td, th');
      if (cells.length === 0) return;

      const text = row.innerText.toLowerCase();
      const matchesQuery = query.trim() === '' ? true : text.includes(query.toLowerCase());

      // 2) FILTRAR por tiendas: si hay tiendas activas, mostrar fila si al menos una activa tiene precio
      let matchesStore = true;
      if (activeStores.size > 0) {
        matchesStore = false;

        // Para cada tienda activa, buscamos una celda del row que contenga el label de tienda en el thead;
        // como no sabemos el índice exacto, intentamos por texto: formato común "Jumbo: $x", "Líder: $x" etc.
        for (const name of activeStores) {
          const hasThisStore =
            text.includes(`${name.toLowerCase()}:`) ||
            text.includes(`${name.toLowerCase()} $`) ||
            text.includes(name.toLowerCase());
          if (hasThisStore) {
            matchesStore = true;
            break;
          }
        }
      }

      row.style.display = matchesQuery && matchesStore ? '' : 'none';
    });

    // 3) ORDENAR por precio (busca primer monto CLP en la fila)
    if (sortDir !== 'none') {
      // Extrae precio (número) de un texto
      const getPrice = (row) => {
        const txt = row.innerText;
        // Busca patrones tipo $1.234, $ 999, 1234, 1.234 CLP, etc.
        const match = txt.match(/(\$?\s?\d{1,3}(\.\d{3})+|\$?\s?\d+)/g);
        if (!match) return Number.POSITIVE_INFINITY;
        // Tomamos el primer match y convertimos a número
        const raw = match[0].replace(/[^\d]/g, '');
        return Number(raw || '999999999');
      };

      const visible = rows.filter(r => r.style.display !== 'none');
      const hidden = rows.filter(r => r.style.display === 'none');

      visible.sort((a, b) => {
        const pa = getPrice(a);
        const pb = getPrice(b);
        return sortDir === 'asc' ? pa - pb : pb - pa;
      });

      // Reinsertar en el DOM (ordenado + ocultos al final)
      [...visible, ...hidden].forEach(r => tbody.appendChild(r));
    }
  }, [visibleRows, query, activeStores, sortDir]);

  return (
    <div className="toolbar">
      <div className="toolbar-row">
        {/* Búsqueda */}
        <div className="toolbar-group">
          <label className="toolbar-label">Buscar</label>
          <input
            type="text"
            className="toolbar-input"
            placeholder="Nombre de producto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Orden */}
        <div className="toolbar-group">
          <label className="toolbar-label">Ordenar por precio</label>
          <select
            className="toolbar-select"
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value)}
          >
            <option value="asc">Menor a mayor</option>
            <option value="desc">Mayor a menor</option>
            <option value="none">Sin ordenar</option>
          </select>
        </div>
      </div>

      {/* Filtro por tiendas */}
      {stores.length > 0 && (
        <div className="toolbar-row">
          <div className="toolbar-label" style={{marginRight: 8}}>Tiendas</div>
          <div className="toolbar-chips">
            {stores.map((s) => {
              const active = activeStores.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  className={`chip ${active ? 'chip-active' : ''}`}
                  onClick={() => toggleStore(s)}
                >
                  {s}
                </button>
              );
            })}
            {activeStores.size > 0 && (
              <button
                type="button"
                className="chip chip-clear"
                onClick={() => setActiveStores(new Set())}
                title="Limpiar tiendas"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
