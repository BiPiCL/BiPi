'use client';
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Productos() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

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

  // Agrupar filas por producto
  const productos = {};
  rows.forEach(r => {
    if (!productos[r.producto]) {
      productos[r.producto] = { categoria: r.categoria, formato: r.formato, precios: {} };
    }
    productos[r.producto].precios[r.tienda_slug] = r.precio_clp;
  });

  const tiendas = ['lider', 'jumbo', 'unimarc', 'santa-isabel'];

  return (
    <main style={{maxWidth: 1000, margin: '0 auto', padding: 16}}>
      <h1 style={{fontSize: 22, fontWeight: 600}}>Comparador de precios — Productos</h1>
      {err && <p style={{color:'red'}}>Error: {err}</p>}

      <div style={{overflowX:'auto', marginTop: 12}}>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th style={{textAlign:'left', borderBottom:'1px solid #ddd', padding:'8px'}}>Producto</th>
              <th style={{textAlign:'left', borderBottom:'1px solid #ddd', padding:'8px'}}>Formato</th>
              {tiendas.map(t => (
                <th key={t} style={{textAlign:'right', borderBottom:'1px solid #ddd', padding:'8px', whiteSpace:'nowrap'}}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(productos).map(([nombre, info]) => (
              <tr key={nombre}>
                <td style={{borderBottom:'1px solid #eee', padding:'8px'}}>{nombre}</td>
                <td style={{borderBottom:'1px solid #eee', padding:'8px'}}>{info.formato}</td>
                {tiendas.map(t => (
                  <td key={t} style={{borderBottom:'1px solid #eee', padding:'8px', textAlign:'right'}}>
                    {info.precios[t] != null ? `$${Number(info.precios[t]).toLocaleString('es-CL')}` : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{marginTop:16, color:'#666'}}>Nota: precios referenciales del MVP. Pueden variar por tienda y ciudad.</p>
    </main>
  );
}
