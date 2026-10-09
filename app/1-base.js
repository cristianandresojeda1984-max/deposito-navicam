'use strict';
// ============ Almacenamiento local (IndexedDB) ============
const DB_NOMBRE = 'navicam_app';
let _db = null;
function abrirDB() {
  return new Promise((ok, mal) => {
    const rq = indexedDB.open(DB_NOMBRE, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
    rq.onsuccess = () => { _db = rq.result; ok(); };
    rq.onerror = () => mal(rq.error);
  });
}
function dbLeerTodo() {
  return new Promise((ok, mal) => {
    const out = {};
    const tx = _db.transaction('kv', 'readonly');
    const cur = tx.objectStore('kv').openCursor();
    cur.onsuccess = () => { const c = cur.result; if (c) { out[c.key] = c.value; c.continue(); } else ok(out); };
    cur.onerror = () => mal(cur.error);
  });
}
function dbGuardar(clave, valor) {
  return new Promise((ok, mal) => {
    const tx = _db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(valor, clave);
    tx.oncomplete = ok; tx.onerror = () => mal(tx.error);
  });
}
function dbBorrarTodo() {
  return new Promise((ok, mal) => {
    const tx = _db.transaction('kv', 'readwrite');
    tx.objectStore('kv').clear();
    tx.oncomplete = ok; tx.onerror = () => mal(tx.error);
  });
}

// ============ Estado ============
const CLAVES = ['dolar', 'stock', 'precios', 'sobre', 'cajones', 'notas', 'ubicCambios', 'reposicionado', 'pedidoNegocio', 'promos',
  'clientes', 'presupuestos', 'motivos', 'registro', 'ajustes', 'contador', 'borrador', 'archivos', 'agenda', 'avisados', 'versionDatos', 'nexpro', 'reemplazos', 'metas'];
const S = {
  dolar: 1520, stock: [], precios: {}, sobre: [], cajones: [], notas: {}, ubicCambios: {}, reposicionado: {}, pedidoNegocio: {}, promos: {},
  clientes: [], presupuestos: [], motivos: [], registro: [], ajustes: {}, contador: 0, borrador: null, archivos: {}, agenda: [], avisados: {}, versionDatos: 1, nexpro: {}, reemplazos: {}, metas: {}
};
const MOTIVOS_BASE = ['Precio', 'Plazo de entrega', 'Sin stock', 'Lo compró en otro lado', 'Otro'];
const CATEGORIAS = [
  { id: 'generales', corto: 'General', largo: 'Clientes generales' },
  { id: 'mayoristas', corto: 'Mayorista', largo: 'Repuesteros mayoristas' },
  { id: 'especiales', corto: 'Especial', largo: 'Clientes especiales' },
  { id: 'transporte', corto: 'Transporte', largo: 'Transporte y logística' }
];
const AJUSTES_BASE = {
  empresa: 'Navicam · Repuestos Rosario',
  datosEmpresa: '[Dirección · teléfono · e-mail]',
  pie: 'Precios en pesos + IVA. Se mantienen hasta la fecha de validez indicada.\n[Forma de pago y condiciones de entrega]',
  validez: 7
};
let stockIdx = new Map();   // código → fila de stock
let sobreIdx = new Map();   // código → [items sobre stock]

function guardar(...claves) {
  claves.forEach(k => dbGuardar(k, S[k]).catch(e => aviso('No se pudo guardar (' + k + '): ' + e.message, 'err')));
  if (claves.includes('stock')) indexarStock();
  if (claves.includes('sobre')) indexarSobre();
}
function indexarStock() { stockIdx = new Map(); S.stock.forEach(r => stockIdx.set(r[0], r)); }
function indexarSobre() {
  sobreIdx = new Map();
  S.sobre.forEach(x => { if (!sobreIdx.has(x.cod)) sobreIdx.set(x.cod, []); sobreIdx.get(x.cod).push(x); });
}

// ============ Utilidades ============
function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function r2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function fmt(n, dec = 2) { return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function plata(n) { return '$ ' + fmt(n); }
function plata0(n) { return '$ ' + fmt(Math.round(n), 0); }
function masIva(n) { return plata(n) + ' <span class="iva">+ IVA</span>'; }
function masIva0(n) { return plata0(n) + ' <span class="iva">+ IVA</span>'; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function hoyISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function sumarDias(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + Number(n || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fechaAR(iso) { if (!iso) return ''; const [a, m, d] = iso.slice(0, 10).split('-'); return d + '/' + m + '/' + a; }
function ahoraTxt() { return new Date().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function mesDe(iso) { return iso.slice(0, 7); }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function nombreMes(ym) { const [a, m] = ym.split('-'); return MESES[Number(m) - 1].replace(/^./, c => c.toUpperCase()) + ' ' + a; }
function normalizar(v) { return String(v === undefined || v === null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase(); }
function limpiarCodigo(v) {
  if (v === undefined || v === null) return '';
  let s = String(v).trim().toUpperCase();
  if (/^\d+\.0+$/.test(s)) s = s.split('.')[0];
  return s;
}
function marcaDe(l) { const m = l.marca || 'IVECO'; return m === 'OTRO' ? (l.marcaTxt || 'OTRA MARCA') : m; }
function numPresu(p) { return p.num ? String(p.num).padStart(4, '0') : '(pend.)'; }

// El registro de cambios lo lleva el servidor (hoja Registro de la planilla)

// ============ Avisos y ventana ============
function aviso(texto, tipo) {
  const d = document.createElement('div');
  d.className = tipo || '';
  d.textContent = texto;
  document.getElementById('toast').appendChild(d);
  setTimeout(() => d.remove(), tipo === 'err' ? 7000 : 4000);
}
function abrirModal(html, ancha) {
  const c = document.getElementById('modalCaja');
  c.className = 'caja' + (ancha ? ' ancha' : '');
  c.innerHTML = html;
  document.getElementById('modal').classList.add('on');
  const f = c.querySelector('[autofocus]'); if (f) f.focus();
}
function cerrarModal() { document.getElementById('modal').classList.remove('on'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { cerrarModal(); cerrarSug(); } });

// ============ Navegación ============
let vista = 'inicio';
const VISTAS = {};
function ir(v, opciones) {
  vista = v;
  document.querySelectorAll('.nav').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  document.getElementById('side').classList.remove('abierto');
  const fn = VISTAS[v];
  document.getElementById('main').innerHTML = '';
  if (fn) fn(opciones || {});
  window.scrollTo(0, 0);
}
function pintar() {
  const fn = VISTAS[vista]; if (!fn) return;
  const sc = [...document.querySelectorAll('#main .lista-scroll')].map(e => e.scrollTop);   // conservar la posición de las listas
  fn({ repintar: true });
  document.querySelectorAll('#main .lista-scroll').forEach((e, i) => { if (sc[i]) e.scrollTop = sc[i]; });
  if (typeof pintarNumerito === 'function') pintarNumerito();
}
function menuMovil() { document.getElementById('side').classList.toggle('abierto'); }
function main(html) { document.getElementById('main').innerHTML = html; }

// ============ Dólar ============
function pintarDolar() {
  document.getElementById('dolarTxt').textContent = '$ ' + fmt(S.dolar, S.dolar % 1 ? 2 : 0);
  document.getElementById('dolarMovil').textContent = 'USD $ ' + fmt(S.dolar, 0);
}
function editarDolar() {
  abrirModal(`<h3 style="margin-top:0">Cotización del dólar</h3>
    <p class="muted">Se usa para todos los precios nuevos. Los presupuestos ya guardados conservan el dólar con el que se hicieron.</p>
    <div class="fila"><input class="in" id="dolarNuevo" type="number" step="0.01" style="max-width:200px" value="${S.dolar}" autofocus
      onkeydown="if(event.key==='Enter')guardarDolar()"><button class="btn pri" onclick="guardarDolar()">Guardar</button><button class="btn" onclick="cerrarModal()">Cancelar</button></div>`);
}
async function guardarDolar() {
  const v = parseFloat(String(document.getElementById('dolarNuevo').value).replace(',', '.'));
  if (!(v > 0)) { aviso('Poné un valor válido', 'err'); return; }
  cerrarModal();
  if (v === S.dolar) return;
  const anterior = S.dolar; S.dolar = v; pintarDolar(); pintar();
  const t = avisoFijo('Guardando dólar…');
  let ok = false;
  try {
    const r = await fetchConLimite(URL_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ dolar: v }) }, 20000);
    const d = await r.json(); ok = !!d.ok;
  } catch (e) {}
  for (let i = 0; !ok && i < 3; i++) { try { const d = await apiGet({ accion: 'dolar' }); ok = Number(d.dolar) === v; } catch (e) {} if (!ok) await esperar(2000); }
  t.remove();
  if (ok) { guardar('dolar'); aviso('Dólar actualizado en todos los dispositivos: $ ' + fmt(v), 'ok'); }
  else { S.dolar = anterior; pintarDolar(); pintar(); aviso('❌ No se pudo guardar el dólar (sin conexión con Google).', 'err'); }
}

// ============ Artículos y precios ============
function infoArticulo(cod) {
  const p = S.precios[cod];
  const st = stockIdx.get(cod);
  const sob = sobreIdx.get(cod) || [];
  return {
    cod,
    desc: (st && st[1]) || (p && p[1]) || '',
    usd: p ? Number(p[0]) || 0 : 0,
    D: p ? String(p[2] || '').trim() : '',
    enLista: !!p,
    stock: st ? st[2] : null,
    ubic: st ? (S.ubicCambios[cod] || st[3]) : null,
    sobre: sob.reduce((a, x) => a + (x.cant || 0), 0),
    sobreDet: sob,
    repos: S.reposicionado[cod] !== undefined,
    reposMes: S.reposicionado[cod] || ''
  };
}
function buscarArticulos(q, max = 12) {
  q = normalizar(q);
  if (q.length < 2) return [];
  const qU = q.toUpperCase();
  const out = []; const vistos = new Set();
  const agregar = c => { if (!vistos.has(c)) { vistos.add(c); out.push(c); } };
  if (S.precios[qU] || stockIdx.has(qU)) agregar(qU);
  // prefijo de código
  for (const r of S.stock) { if (out.length >= max) break; if (r[0].startsWith(qU)) agregar(r[0]); }
  if (out.length < max) for (const c in S.precios) { if (out.length >= max) break; if (c.startsWith(qU)) agregar(c); }
  // descripción (todas las palabras)
  const palabras = q.split(/\s+/).filter(Boolean);
  if (out.length < max) for (const r of S.stock) {
    if (out.length >= max) break;
    const d = normalizar(r[1]); if (palabras.every(p => d.includes(p))) agregar(r[0]);
  }
  if (out.length < max) for (const c in S.precios) {
    if (out.length >= max) break;
    const d = normalizar(S.precios[c][1]); if (palabras.every(p => d.includes(p))) agregar(c);
  }
  return out;
}

// ============ Clientes y descuentos ============
function catCorto(id) { const c = CATEGORIAS.find(x => x.id === id); return c ? c.corto : id; }
function cliente(id) { return S.clientes.find(c => c.id === id); }
// "30" → [30]; "25/27" → [25,27]; "" → [] (sin descuento); "+11" → sin interpretar
function opcionesDesc(txt) {
  const s = String(txt || '').trim();
  if (!s || s === '-' || s === '—') return { valores: [], raro: false };
  if (/^\+/.test(s)) return { valores: [], raro: true };
  const m = s.match(/\d+(?:[.,]\d+)?/g);
  if (!m) return { valores: [], raro: true };
  return { valores: m.map(x => Number(x.replace(',', '.'))), raro: false };
}
function descCliente(cli, D) {
  if (!cli || !/^[5-9]$/.test(D)) return { pct: 0, alternativas: [], raro: false, txt: '' };
  const txt = (cli.desc || {})[D] || '';
  const o = opcionesDesc(txt);
  return { pct: o.valores[0] || 0, alternativas: o.valores, raro: o.raro, txt };
}
function textoDesc(txt) { const s = String(txt || '').trim(); return s ? (/^\d+(?:[.,]\d+)?$/.test(s) ? s + '%' : s) : '—'; }
function chipsEscala(cli) {
  if (!cli) return '';
  return ['5', '6', '7', '8', '9'].map(d => `<span class="chip">D${d} <b>${esc(textoDesc((cli.desc || {})[d]))}</b></span>`).join(' ');
}
function convertirClientePortal(c) {
  const d = v => { const s = String(v || '').trim(); if (!s || s === '-') return ''; return s.replace(/%/g, '').replace(/\s*\/\s*/g, '/').trim(); };
  return {
    id: 'c' + c.id, nombre: String(c.name || '').trim(), categoria: c.category || 'generales',
    cuit: c.cuit || '', localidad: c.address || '', contacto: c.contact || '', cumple: c.birthday || '', whatsapp: c.phone || '',
    notas: c.notes || '', pago: '', desc: { 5: d(c.d5), 6: d(c.d6), 7: d(c.d7), 8: d(c.d8), 9: d(c.d9) }
  };
}

// ============ Cálculo de líneas ============
function calcularLinea(l, dolar) {
  l.listaArs = l.listaManual ? r2(l.listaManual) : r2(l.usd * dolar);
  l.unit = r2(l.listaArs * (1 - (Number(l.descPct) || 0) / 100));
  l.sub = r2(l.unit * (Number(l.cant) || 0));
  return l;
}
function totales(items, campoCant) {
  let sub = 0, lista = 0;
  items.forEach(l => {
    const q = campoCant ? (Number(l[campoCant]) || 0) : (Number(l.cant) || 0);
    sub += r2(l.unit * q); lista += r2(l.listaArs * q);
  });
  sub = r2(sub);
  return { sub, lista: r2(lista), ahorro: r2(lista - sub) };
}
// Montos de un presupuesto: siempre sin IVA
function montoPresu(p) { return totales(p.items).sub; }
function montoVendido(p) { return p.estado === 'cerrado' ? totales(p.items, 'vendido').sub : 0; }
function estadoPresu(p) {
  if (p.estado === 'cerrado') {
    const vend = p.items.filter(l => (l.vendido || 0) > 0);
    const completos = p.items.every(l => (l.vendido || 0) >= l.cant);
    if (!vend.length) return 'novendido';
    return completos ? 'vendido' : 'parcial';
  }
  const h = hoyISO();
  return h > p.hasta ? 'vencido' : h === p.hasta ? 'vencehoy' : 'abierto';
}
const ESTADO_TXT = { abierto: 'Vigente', vencehoy: 'Vence hoy', vencido: 'Vencido', vendido: 'Vendido', parcial: 'Vendido parcial', novendido: 'No vendido' };
function chipEstado(p) {
  const e = estadoPresu(p);
  let t = ESTADO_TXT[e];
  if (e === 'novendido') { const m = motivosDe(p)[0]; if (m) t += ' · ' + m.toLowerCase(); }
  return `<span class="estado e-${e}">${esc(t)}</span>`;
}
function motivosDe(p) { return [...new Set(p.items.filter(l => (l.vendido || 0) < l.cant && l.motivo).map(l => l.motivo))]; }
