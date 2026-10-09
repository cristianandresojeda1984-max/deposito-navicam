// ============ Conexión con la planilla de Google (servidor compartido) ============
// Todo lo compartido vive en la planilla "Navicam App Datos". Este dispositivo guarda una copia para abrir rápido y sin señal.
const URL_API_PROD = 'https://script.google.com/macros/s/AKfycbwY3sVIFHj0Nbymj8P66lrOXABlW_Knh6xIFuY-mU539xOPD8VVk-NPNpR87scLpiTJBg/exec';
const URL_API = (() => { try { const u = new URLSearchParams(location.search).get('api'); if (u && /^http:\/\/localhost(:\d+)?\//.test(u)) return u; } catch (e) {} return URL_API_PROD; })();
const TABLAS_DOCS = ['clientes', 'presupuestos', 'agenda', 'notas', 'reemplazos', 'motivos', 'ajustes'];

function fetchConLimite(url, opciones, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms || 15000);
  return fetch(url, Object.assign({}, opciones, { signal: ac.signal })).finally(() => clearTimeout(t));
}
async function apiGet(params, ms) {
  const qs = Object.entries(params).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const r = await fetchConLimite(URL_API + (URL_API.includes('?') ? '&' : '?') + qs + '&_ts=' + Date.now(), { cache: 'no-store' }, ms || 20000);
  return r.json();
}
const esperar = ms => new Promise(res => setTimeout(res, ms));
function nombreDispositivo() { return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'Celular' : 'PC'; }

// Envía una operación. Si la respuesta de Google no llega, confirma consultando el registro (como en la app anterior).
async function enviarOp(op, ms) {
  op.id = 'op' + Date.now() + Math.random().toString(36).slice(2, 8);
  op.dispositivo = nombreDispositivo();
  const limite = ms || 30000;
  let terminado = false, envioFallidoEn = 0;
  const viaEnvio = (async () => {
    try {
      const r = await fetchConLimite(URL_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ accion: 'sobre', op }) }, limite);
      return { tipo: 'envio', resp: await r.json() };
    } catch (e) { envioFallidoEn = Date.now(); return { tipo: 'fallo' }; }
  })();
  const viaConsulta = (async () => {
    await esperar(1500);
    const fin = Date.now() + limite + 10000;
    while (!terminado && Date.now() < fin) {
      if (envioFallidoEn && Date.now() - envioFallidoEn > 6000) break;
      try { const v = await apiGet({ accion: 'op', id: op.id }, 15000); if (v.aplicada) return { tipo: 'consulta', v }; } catch (e) {}
      await esperar(2000);
    }
    return { tipo: 'fallo' };
  })();
  const res = await Promise.race([
    viaEnvio.then(x => x.tipo === 'envio' ? x : viaConsulta),
    viaConsulta.then(x => x.tipo === 'consulta' ? x : viaEnvio)
  ]);
  terminado = true;
  let resp;
  if (res.tipo === 'envio') { resp = res.resp; if (!resp.ok) throw new Error(resp.error || 'Error del servidor'); }
  else if (res.tipo === 'consulta') resp = { ok: true, resultado: res.v.entrada.resultado || null, entrada: res.v.entrada, sobre: res.v.sobre };
  else throw new Error('No hay conexión con Google. El cambio NO se guardó.');
  aplicarRespuesta(resp);
  return resp;
}
function aplicarRespuesta(resp) {
  if (resp.sobre) aplicarSobre(resp.sobre);
  if (resp.entrada && !S.registro.some(r => r.id === resp.entrada.id)) { S.registro.unshift(resp.entrada); guardar('registro'); }
  if (resp.resultado && resp.resultado.ubicaciones) { S.ubicCambios = resp.resultado.ubicaciones; guardar('ubicCambios'); }
}
// Envoltorio con aviso: devuelve la respuesta o null si falló (y avisa)
async function remoto(op, textoEspera, ms) {
  const t = textoEspera ? avisoFijo(textoEspera) : null;
  try { return await enviarOp(op, ms); }
  catch (e) { aviso('❌ ' + e.message, 'err'); return null; }
  finally { if (t) t.remove(); }
}
function avisoFijo(texto) { const d = document.createElement('div'); d.textContent = '⏳ ' + texto; document.getElementById('toast').appendChild(d); return d; }

// --- documentos (clientes, presupuestos, agenda, notas, reemplazos, motivos, ajustes)
async function docGuardar(tabla, doc, reg, nota) { return remoto({ tipo: 'guardarDoc', tabla, doc, reg, nota: nota || '' }, 'Guardando…'); }
async function docBorrar(tabla, docId, reg, nota) { return remoto({ tipo: 'borrarDoc', tabla, docId, reg, nota: nota || '' }, 'Borrando…'); }

function clienteADoc(c) { return { id: c.id, nombre: c.nombre, categoria: c.categoria, d5: c.desc[5] || '', d6: c.desc[6] || '', d7: c.desc[7] || '', d8: c.desc[8] || '', d9: c.desc[9] || '', cuit: c.cuit, localidad: c.localidad, contacto: c.contacto, cumple: c.cumple, whatsapp: c.whatsapp, pago: c.pago, notas: c.notas }; }
function docACliente(d) { return { id: d.id, nombre: String(d.nombre || '').toUpperCase(), categoria: CATEGORIAS.some(c => c.id === d.categoria) ? d.categoria : categoriaDeTexto(d.categoria), cuit: d.cuit || '', localidad: d.localidad || '', contacto: d.contacto || '', cumple: d.cumple || '', whatsapp: d.whatsapp || '', pago: d.pago || '', notas: d.notas || '', desc: { 5: d.d5 || '', 6: d.d6 || '', 7: d.d7 || '', 8: d.d8 || '', 9: d.d9 || '' } }; }
function categoriaDeTexto(t) { const n = normalizar(t); const c = CATEGORIAS.find(x => normalizar(x.corto) === n || normalizar(x.largo) === n || n.startsWith(normalizar(x.corto).slice(0, 5))); return c ? c.id : 'generales'; }
function presuADoc(p) {
  const d = Object.assign({}, p);
  delete d.sub; delete d.borrador;
  d.estadoTxt = ESTADO_TXT[estadoPresu(p)] || ''; d.totalSinIva = montoPresu(p); d.vendidoSinIva = montoVendido(p); d.motivos = motivosDe(p).join(', ');
  return d;
}
function docAPresu(d) {
  const p = Object.assign({}, d);
  delete p.estadoTxt; delete p.totalSinIva; delete p.vendidoSinIva; delete p.motivos;
  p.items = Array.isArray(p.items) ? p.items : []; p.historial = Array.isArray(p.historial) ? p.historial : []; p.escala = p.escala || {};
  p.estado = p.estado === 'cerrado' ? 'cerrado' : 'abierto';
  if (!p.cierre) delete p.cierre;
  p.validezDias = Number(p.validezDias) || 7; p.dolar = Number(p.dolar) || S.dolar; p.num = Number(p.num) || 0;
  return p;
}
function aplicarTabla(t, docs) {
  if (t === 'clientes') S.clientes = docs.map(docACliente);
  else if (t === 'presupuestos') S.presupuestos = docs.map(docAPresu);
  else if (t === 'agenda') S.agenda = docs.map(d => ({ id: d.id, fecha: d.fecha, texto: d.texto, clienteId: d.clienteId || '', anual: !!d.anual }));
  else if (t === 'notas') { S.notas = {}; docs.forEach(d => { if (d.texto) S.notas[d.id] = { texto: d.texto, fecha: d.fecha, ts: d.ts || 0 }; }); }
  else if (t === 'reemplazos') { S.reemplazos = {}; docs.forEach(d => { if (d.nuevo) S.reemplazos[d.id] = d.nuevo; }); }
  else if (t === 'motivos') { const l = docs.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(d => d.id); S.motivos = l.length ? l : MOTIVOS_BASE.slice(); }
  else if (t === 'ajustes') { const a = { ...AJUSTES_BASE }; docs.forEach(d => { a[d.id] = d.id === 'validez' ? Number(d.valor) || 7 : d.valor; }); S.ajustes = a; }
  guardar(t === 'notas' ? 'notas' : t);
}
function aplicarSobre(sobre) {
  if (!sobre) return;
  S.sobre = (sobre.items || []).map(x => ({ id: x.CAJON + '|' + x.CODIGO, cod: x.CODIGO, cant: x.CANTIDAD, ubic: x.UBICACION, cajon: x.CAJON }));
  S.cajones = sobre.cajones || [];
  S.metas.sobre = sobre.version;
  guardar('sobre', 'cajones', 'metas');
}

// --- descarga en partes de las tablas grandes
async function bajarPorPartes(tipo, nombre) {
  const tam = tipo === 'precios' ? 2500 : 1500;
  const pedir = async desde => {
    let ultimo = null;
    for (let i = 0; i < 3; i++) {
      try { const r = await apiGet({ accion: 'pagina', tipo, desde, cuantos: tam }, 45000); if (r && Array.isArray(r.filas)) return r; ultimo = new Error('respuesta inválida'); }
      catch (e) { ultimo = e; }
      await esperar(1500 * (i + 1));
    }
    throw ultimo || new Error('No se pudo descargar ' + nombre);
  };
  const primera = await pedir(0);
  const total = primera.total || 0, version = primera.meta ? primera.meta.version : null;
  const partes = [primera], desdes = [];
  for (let d = tam; d < total; d += tam) desdes.push(d);
  let hechas = 1; const n = desdes.length + 1;
  estadoSync({ ok: null, msg: `Descargando ${nombre} ${hechas}/${n}…` });
  for (let i = 0; i < desdes.length; i += 3) {
    const lote = await Promise.all(desdes.slice(i, i + 3).map(pedir));
    lote.forEach(p => { if (p.meta && version !== null && p.meta.version !== version) throw new Error('Los datos cambiaron durante la descarga'); partes.push(p); });
    hechas += lote.length; estadoSync({ ok: null, msg: `Descargando ${nombre} ${hechas}/${n}…` });
  }
  partes.sort((a, b) => a.desde - b.desde);
  return { meta: primera.meta, filas: [].concat(...partes.map(p => p.filas)) };
}
const GRANDES = { stock: 'stock', precios: 'lista de precios', repos: 'reposicionados', nexpro: 'equivalencias NEXPRO' };
async function bajarGrande(tipo) {
  const d = await bajarPorPartes(tipo, GRANDES[tipo]);
  if (tipo === 'stock') S.stock = d.filas;
  else if (tipo === 'precios') { const o = {}; d.filas.forEach(r => { o[r[0]] = [r[1], r[2], r[3]]; }); S.precios = o; }
  else if (tipo === 'repos') { const o = {}; d.filas.forEach(r => { o[r[0]] = r[1]; }); S.reposicionado = o; }
  else { const o = {}; d.filas.forEach(r => { (o[r[0]] = o[r[0]] || []).push([r[1], r[2], r[3], r[4], r[5]]); }); S.nexpro = o; }
  S.archivos[tipo] = d.meta ? ((d.meta.archivo || '') + (d.meta.fecha ? ' · ' + d.meta.fecha : '')).replace(/^ · /, '') : '';
  S.metas[tipo] = d.meta ? d.meta.version : null;
  guardar(tipo === 'repos' ? 'reposicionado' : tipo, 'metas', 'archivos');
}

// --- sincronización
let _sync = { ok: null, msg: 'Conectando…', hora: '' }, sincronizando = false, planillaUrl = '';
function estadoSync(e) {
  _sync = Object.assign({ hora: _sync.hora }, e);
  const el = document.getElementById('estadoSync'); if (!el) return;
  const color = _sync.ok === true ? 'var(--green)' : _sync.ok === false ? 'var(--red)' : 'var(--amber)';
  const m = document.getElementById('syncMovil'); if (m) { m.style.background = color; m.title = _sync.ok === true ? 'Sincronizado ' + _sync.hora : _sync.ok === false ? 'Sin conexión con Google' : _sync.msg; }
  el.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${esc(_sync.ok === true ? 'Sincronizado ' + _sync.hora : _sync.ok === false ? 'Sin conexión con Google' : _sync.msg)}`
    + (planillaUrl ? ` · <a href="${esc(planillaUrl)}" target="_blank">planilla</a>` : '');
}
async function sincronizar(forzar) {
  if (sincronizando) return; sincronizando = true;
  let cambio = false;
  try {
    const d = await apiGet({ accion: 'estado' });
    if (!d.servidor) throw new Error('El servidor de Google todavía es la versión anterior');
    if (d.dolar > 0 && d.dolar !== S.dolar) { S.dolar = Number(d.dolar); guardar('dolar'); pintarDolar(); cambio = true; }
    if (d.sobre && d.sobre.version !== S.metas.sobre) { aplicarSobre(d.sobre); cambio = true; }
    if (d.ubicaciones && JSON.stringify(d.ubicaciones) !== JSON.stringify(S.ubicCambios)) { S.ubicCambios = d.ubicaciones; guardar('ubicCambios'); cambio = true; }
    if (d.planillaUrl) planillaUrl = d.planillaUrl;
    const m = d.metas || {};
    for (const t of TABLAS_DOCS) {
      const v = m['t_' + t] ? m['t_' + t].version : 0;
      if (forzar || v !== (S.metas['t_' + t] || 0) || S.metas['t_' + t] === undefined) {
        const r = await apiGet({ accion: 'tabla', t }, 30000);
        if (r && Array.isArray(r.docs)) { aplicarTabla(t, r.docs); S.metas['t_' + t] = r.meta ? r.meta.version : 0; cambio = true; }
      }
    }
    for (const g of Object.keys(GRANDES)) {
      const v = m[g] ? m[g].version : null;
      if (v !== null && (forzar || v !== S.metas[g])) { await bajarGrande(g); cambio = true; }
    }
    guardar('metas');
    if (cambio) { indexarStock(); indexarSobre(); }
    _sync.hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    estadoSync({ ok: true });
    if (!S.metas.notasViejas) await migrarNotasViejas();
  } catch (e) {
    console.warn('Sincronización fallida', e);
    estadoSync({ ok: false, msg: e.message });
  }
  sincronizando = false;
  if (cambio) pintarSeguro();
  avisarVencimientos();
}
// No redibujar mientras alguien escribe
let repintarPendiente = false;
function pintarSeguro() {
  const a = document.activeElement;
  if (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) && document.getElementById('main').contains(a)) { repintarPendiente = true; return; }
  if (document.getElementById('modal').classList.contains('on')) { repintarPendiente = true; return; }
  pintar();
}
document.addEventListener('focusout', () => { if (repintarPendiente) { repintarPendiente = false; setTimeout(pintarSeguro, 400); } });
async function refrescarRegistro() {
  try { const d = await apiGet({ accion: 'registro' }); if (Array.isArray(d.registro)) { S.registro = d.registro; guardar('registro'); if (vista === 'historial') pintarSeguro(); } } catch (e) {}
}
// Las anotaciones de la app anterior estaban guardadas solo en cada teléfono: se suben una vez
async function migrarNotasViejas() {
  let viejas = null;
  try { viejas = JSON.parse(localStorage.getItem('navicam_notas_v2') || 'null'); } catch (e) {}
  const docs = [];
  if (viejas) Object.keys(viejas).forEach(c => { const n = viejas[c]; if (n && n.texto && n.texto.trim() && !S.notas[c]) docs.push({ id: c, texto: n.texto, fecha: n.fecha || '', ts: Date.now() }); });
  if (docs.length) {
    const r = await remoto({ tipo: 'guardarDocs', tabla: 'notas', docs, reg: { tipo: 'Anotaciones', detalle: `${docs.length} anotaciones de la app anterior de este ${nombreDispositivo().toLowerCase()}` } });
    if (!r) return;
    docs.forEach(d => { S.notas[d.id] = { texto: d.texto, fecha: d.fecha, ts: d.ts }; }); guardar('notas');
  }
  // liberar el espacio que usaba la app anterior
  ['navicam_precios', 'navicam_stock', 'navicam_sobre', 'navicam_cajones', 'navicam_registro', 'navicam_historial'].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  S.metas.notasViejas = true; guardar('metas');
}
