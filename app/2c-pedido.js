// ============ Armar pedido: pegar códigos y cantidades → dónde está y si alcanza ============
// Es un informe del momento (no se guarda). Stock total = el del Excel (incluye el sobre stock); estantería = total − sobre stock.
const pedido = { cliente: '', codigos: '', cantidades: '', filas: [], orden: 'ubic', dir: 'asc', armado: false, editandoId: null };
let pedTab = 'nuevo', pedAbierto = null;

VISTAS.pedido = function (op) {
  if (op && op.abrir) { pedTab = 'abierto'; pedAbierto = op.abrir; }
  if (pedTab === 'lista') return vistaPedidosGuardados();
  if (pedTab === 'abierto' && S.pedidos.some(p => p.id === pedAbierto)) return vistaArmarPedido();
  pedTab = 'nuevo';
  const ed = pedido.editandoId && S.pedidos.find(p => p.id === pedido.editandoId);
  main(`<div class="cab"><div><h1>Armar pedido</h1><p>${ed ? `Editando el <b>Pedido ${numPed(ed)}</b> de ${esc(ed.cliente)}.` : 'Pegá la columna de códigos y la de cantidades del Excel: te dice dónde está cada cosa y si alcanza. Guardalo para armarlo desde el pañol.'}</p></div>
    <div class="acciones">${tabsPedido()}${pedido.armado || ed ? `<button class="btn" onclick="nuevoPedido()">${ed ? 'Cancelar la edición' : 'Empezar otro'}</button>` : ''}</div></div>
  <div class="panel" style="margin-bottom:14px">
    <div class="campo" style="max-width:420px"><span class="lbl">Cliente (sale en el PDF y en el pedido guardado)</span><input class="in" id="pedCli" value="${esc(pedido.cliente)}" placeholder="Ej: TRANSPORTE PEREZ" oninput="pedido.cliente=this.value"></div>
    <div class="fila" style="margin-top:10px;justify-content:space-between"><span class="lbl" style="margin:0">Códigos y cantidades · pegá las dos columnas del Excel en la primera celda (o una columna por vez). Tab avanza como en Excel, Enter baja.</span>
      <span class="fila" style="gap:6px"><button class="btn chico" onclick="filasGrilla(10)">＋ 10 filas</button><button class="btn chico" onclick="limpiarGrilla()">Limpiar</button></span></div>
    <div id="grillaPed" class="grilla-ped">${grillaPedido()}</div>
    <div class="fila" style="margin-top:10px;justify-content:space-between"><span class="muted" id="pedCuenta" style="font-size:13px"></span>
      <button class="btn pri" onclick="armarPedido()">${pedido.armado ? 'Volver a armar el informe' : 'Armar informe →'}</button></div>
  </div>
  <div id="pedInforme">${pedido.armado ? informePedido() : ''}</div>`);
  contarPedido();
};
function nuevoPedido() { Object.assign(pedido, { cliente: '', codigos: '', cantidades: '', filas: [], armado: false, editandoId: null }); pedTab = 'nuevo'; pintar(); }
// Renglones de un textarea pegado desde Excel: se respetan los vacíos del medio (para no correr las filas), se sacan los del final
function renglones(txt) { const l = String(txt || '').replace(/\r/g, '').split('\n'); while (l.length && !l[l.length - 1].trim()) l.pop(); return l; }
function contarPedido() {
  const el = document.getElementById('pedCuenta'); if (!el) return;
  const { c, q } = lineasPed(); const n = Math.max(c.length, q.length);
  let cods = 0, sinCant = 0, sinCod = 0;
  for (let i = 0; i < n; i++) { const a = (c[i] || '').trim(), b = (q[i] || '').trim(); if (a) { cods++; if (!b) sinCant++; } else if (b) sinCod++; }
  el.innerHTML = !cods && !sinCod ? '' : `${cods} códigos` + (sinCant ? ` · ${sinCant} sin cantidad (va 1)` : ' ✓') + (sinCod ? ` · <span style="color:var(--red)">${sinCod} cantidades sin código (no se toman)</span>` : '');
}
function armarPedido() {
  const { c, q } = lineasPed();
  const pares = [];
  for (let i = 0; i < Math.max(c.length, q.length); i++) {
    const a = (c[i] || '').trim(), b = (q[i] || '').trim();
    if (a.includes('\t') && !b) { const t = a.split('\t'); pares.push([t[0].trim(), (t[1] || '').trim()]); }   // las dos columnas en una celda
    else if (a) pares.push([a, b || '1']); else if (b) pares.push(['', b]);
  }
  if (!pares.some(p => p[0])) { aviso('Cargá al menos un código', 'err'); return; }
  const sinCod = pares.filter(p => !p[0]).length;
  const filas = [], idx = {};
  pares.filter(p => p[0]).forEach(([cod, cant], orden) => {
    cod = limpiarCodigo(cod);
    let n = parseFloat(String(cant || '').replace(/\./g, '').replace(',', '.')); if (isNaN(n) || n <= 0) n = 1;
    if (idx[cod] !== undefined) { filas[idx[cod]].cant += n; filas[idx[cod]].veces++; return; }
    idx[cod] = filas.length; filas.push({ cod, cant: n, orden, veces: 1 });
  });
  pedido.filas = filas.map(calcFilaPedido); pedido.armado = true;
  pintar();
  if (sinCod) aviso(`${sinCod} cantidades no tenían código al lado y no se tomaron`, '');
  setTimeout(() => { const e = document.getElementById('pedInforme'); if (e) e.scrollIntoView({ behavior: 'smooth' }); }, 50);
}
function calcFilaPedido(f) {
  const a = infoArticulo(f.cod); const existe = existeArticulo(f.cod);
  const total = numStock(a.stock);
  const cajones = (sobreIdx.get(f.cod) || []).filter(x => x.cant > 0);
  const enSobre = cajones.reduce((s, x) => s + x.cant, 0);
  const estanteria = total === null ? null : total - enSobre;
  const disp = total === null ? 0 : Math.max(0, total);
  const estado = !existe ? 'noexiste' : disp <= 0 ? 'sin' : disp >= f.cant ? 'ok' : 'parcial';
  return Object.assign({}, f, { desc: a.desc, ubic: a.ubic && a.ubic !== '-' ? a.ubic : '', total, enSobre, cajones, estanteria, estado, falta: Math.max(0, f.cant - disp), reemplazo: S.reemplazos[f.cod] || '' });
}
const EST_PED = { ok: ['✔ Alcanza', 't-green'], parcial: ['⚠ Parcial', 't-amber'], sin: ['✖ Sin stock', 't-red'], noexiste: ['? No existe', 't-gris'] };
// Orden: tocando el encabezado de cada columna (otra vez = al revés). 'ubic' y 'orig' son los atajos de arriba.
const nroCajon = c => { const m = String(c || '').match(/(\d+)\s*$/); return m ? Number(m[1]) : 9999; };
const CLAVE_PED = {
  cod: f => f.cod, desc: f => f.desc || '', cant: f => f.cant, total: f => f.total === null ? -1 : f.total,
  sobre: f => f.cajones.length ? nroCajon(f.cajones[0].cajon) : null, ubic: f => f.ubic || null,
  estante: f => f.estanteria === null ? -1 : f.estanteria, estado: f => ({ ok: 0, parcial: 1, sin: 2, noexiste: 3 }[f.estado]), orig: f => f.orden
};
function ordenarPedido(col) {
  if (pedido.orden === col) pedido.dir = pedido.dir === 'desc' ? 'asc' : 'desc'; else { pedido.orden = col; pedido.dir = 'asc'; }
  pintar();
}
function filasPedidoOrdenadas() {
  const k = CLAVE_PED[pedido.orden] || CLAVE_PED.orig, s = pedido.dir === 'desc' ? -1 : 1;
  return pedido.filas.slice().sort((a, b) => {
    const x = k(a), y = k(b);
    if (x === null && y !== null) return 1; if (y === null && x !== null) return -1;   // los vacíos siempre al final
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'es', { numeric: true });
    return c * s || a.orden - b.orden;
  });
}
function informePedido() {
  const l = filasPedidoOrdenadas();
  const n = k => pedido.filas.filter(f => f.estado === k).length;
  const num = v => v === null || v === undefined ? '—' : fmt(v, Number.isInteger(v) ? 0 : 2);
  return `<div class="grid g4" style="margin-bottom:12px">
      <div class="panel kpi"><small>Artículos</small><b>${pedido.filas.length}</b><span>${fmt(pedido.filas.reduce((s, f) => s + f.cant, 0), 0)} unidades pedidas</span></div>
      <div class="panel kpi" style="border-color:var(--green)"><small>Alcanzan</small><b>${n('ok')}</b><span>se puede armar completo</span></div>
      <div class="panel kpi" ${n('parcial') ? 'style="border-color:var(--amber)"' : ''}><small>Parciales</small><b>${n('parcial')}</b><span>hay algo, falta el resto</span></div>
      <div class="panel kpi" ${n('sin') + n('noexiste') ? 'style="border-color:var(--red)"' : ''}><small>Sin stock / no existen</small><b>${n('sin') + n('noexiste')}</b><span>${n('noexiste') ? n('noexiste') + ' código' + (n('noexiste') > 1 ? 's' : '') + ' no existe' + (n('noexiste') > 1 ? 'n' : '') : 'no hay nada'}</span></div></div>
    <div class="fila" style="margin-bottom:10px">
      <span class="muted">Ordenar:</span><button class="chip ${pedido.orden === 'ubic' ? 'on' : ''}" onclick="pedido.orden='ubic';pedido.dir='asc';pintar()">Por ubicación (para recorrer)</button><button class="chip ${pedido.orden === 'sobre' ? 'on' : ''}" onclick="pedido.orden='sobre';pedido.dir='asc';pintar()">Por cajón</button><button class="chip ${pedido.orden === 'orig' ? 'on' : ''}" onclick="pedido.orden='orig';pedido.dir='asc';pintar()">Como lo pegué</button>
      <span class="muted" style="font-size:12px">o tocá el título de una columna</span>
      <span style="margin-left:auto" class="fila"><button class="btn" onclick="pdfPedido()">🖨 PDF para armar</button><button class="btn" onclick="excelFaltantes()" ${n('parcial') + n('sin') + n('noexiste') ? '' : 'disabled'}>⬇ Excel de faltantes</button><button class="btn azul" onclick="pedidoACotizador()">Pasar al cotizador</button><button class="btn pri" onclick="guardarPedido()">💾 ${pedido.editandoId ? 'Guardar cambios del pedido' : 'Guardar pedido'}</button></span></div>
    <div class="panel tabla-scroll"><table class="t"><tr>${[['cod', 'Código'], ['desc', 'Descripción'], ['cant', 'Pedido', 'der'], ['total', 'Stock total', 'der'], ['sobre', 'En sobre stock'], ['ubic', 'En estantería'], ['estado', 'Estado']]
      .map(([k, t, c]) => `<th class="${c || ''}" style="cursor:pointer;user-select:none;white-space:nowrap${pedido.orden === k ? ';color:var(--amber)' : ''}" title="Ordenar por ${t.toLowerCase()} (tocá de nuevo para invertir)" onclick="ordenarPedido('${k}')">${t} ${pedido.orden === k ? (pedido.dir === 'desc' ? '▼' : '▲') : '<span style="opacity:.35">↕</span>'}</th>`).join('')}</tr>
    ${l.map(f => `<tr><td class="num" style="color:var(--amber)">${esc(f.cod)}${f.veces > 1 ? `<div class="muted" style="font-size:11px">sumado de ${f.veces} renglones</div>` : ''}</td>
      <td>${esc(f.desc || '')}${f.reemplazo ? `<div><span class="tag t-amber">Tiene reemplazo: ${esc(f.reemplazo)}</span></div>` : ''}</td>
      <td class="der num"><b>${num(f.cant)}</b></td>
      <td class="der num">${num(f.total)}</td>
      <td style="font-size:13px">${f.cajones.length ? f.cajones.map(x => `<a href="#" class="link-cajon" style="display:inline;padding:0" data-c="${esc(x.cajon)}" data-cod="${esc(f.cod)}" onclick="abrirCajon(this.dataset.c,this.dataset.cod);return false">${esc(x.cajon.replace(/^CAJON SOBRE STOCK\s*/i, 'Cajón '))} · <b>${x.cant} u.</b></a>`).join('<br>') : '<span class="muted">—</span>'}</td>
      <td style="font-size:13px">${f.estanteria === null ? '<span class="muted">—</span>' : `<b>${num(Math.max(0, f.estanteria))} u.</b>${f.ubic ? ' · ' + esc(f.ubic) : ''}`}</td>
      <td><span class="tag ${EST_PED[f.estado][1]}">${EST_PED[f.estado][0]}</span>${f.estado === 'parcial' ? `<div class="muted" style="font-size:12px">falta${f.falta > 1 ? 'n' : ''} ${num(f.falta)}</div>` : ''}</td></tr>`).join('')}</table></div>`;
}
function pdfPedido() {
  const l = filasPedidoOrdenadas(); if (!l.length) return;
  const doc = pdfBase(); const W = doc.internal.pageSize.getWidth(); const fecha = new Date().toLocaleDateString('es-AR');
  const n = k => l.filter(f => f.estado === k).length;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90); doc.text('ARMADO DE PEDIDO · ' + (S.ajustes.empresa || 'Navicam'), 40, 46); doc.text(fecha, W - 40, 46, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(10); doc.text(pedido.cliente.trim() ? 'Pedido: ' + pedido.cliente.trim().toUpperCase() : 'Armado de pedido', 40, 78);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(70);
  doc.text(`${l.length} artículos · ${n('ok')} alcanzan · ${n('parcial')} parciales · ${n('sin') + n('noexiste')} sin stock`, 40, 98);
  doc.setDrawColor(20); doc.setLineWidth(1.2); doc.line(40, 108, W - 40, 108);
  const txtEst = f => f.estado === 'ok' ? 'Alcanza' : f.estado === 'parcial' ? 'Falta ' + fmt(f.falta, 0) : f.estado === 'sin' ? 'Sin stock' : 'No existe';
  doc.autoTable(Object.assign({}, ESTILO_TABLA, {
    startY: 118, styles: Object.assign({}, ESTILO_TABLA.styles, { fontSize: 9.5 }),
    head: [['Código', 'Descripción', 'Pedido', 'Estantería', 'Sobre stock', 'Estado', 'OK']],
    body: l.map(f => [f.cod, (f.desc || '') + (f.reemplazo ? '\nReemplazo: ' + f.reemplazo : ''), fmt(f.cant, 0),
      f.estanteria === null ? '—' : fmt(Math.max(0, f.estanteria), 0) + ' u.' + (f.ubic ? '\n' + f.ubic : ''),
      f.cajones.length ? f.cajones.map(x => x.cajon.replace(/^CAJON SOBRE STOCK\s*/i, 'Cajón ') + ': ' + x.cant).join('\n') : '—', txtEst(f), '']),
    columnStyles: { 0: { font: 'courier', fontStyle: 'bold', cellWidth: 84 }, 2: { cellWidth: 44, halign: 'center', fontStyle: 'bold', fontSize: 11 }, 3: { cellWidth: 66, halign: 'center' }, 4: { cellWidth: 72 }, 5: { cellWidth: 58 }, 6: { cellWidth: 30 } },
    didParseCell: d => { if (d.section === 'body' && d.column.index === 5) { const f = l[d.row.index]; if (f.estado !== 'ok') d.cell.styles.fontStyle = 'bold'; } }
  }));
  pieDePagina(doc, 'Armado de pedido' + (pedido.cliente.trim() ? ' · ' + pedido.cliente.trim().toUpperCase() : '') + ' · ' + fecha);
  doc.save(('Pedido ' + (pedido.cliente.trim() || '') + ' ' + fecha.replace(/\//g, '-')).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() + '.pdf');
}
function excelFaltantes() {
  const l = filasPedidoOrdenadas().filter(f => f.estado !== 'ok'); if (!l.length) return;
  const filas = [['Código', 'Descripción', 'Pedido', 'Hay', 'Falta', 'Estado']].concat(l.map(f => [valorCelda(f.cod), f.desc || '', f.cant, f.total === null ? 0 : Math.max(0, f.total), f.estado === 'noexiste' ? f.cant : f.falta, EST_PED[f.estado][0].replace(/^\S+\s/, '')]));
  const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(filas); ws['!cols'] = [{ wch: 16 }, { wch: 42 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Faltantes');
  XLSX.writeFile(wb, ('Faltantes ' + (pedido.cliente.trim() || '') + ' ' + hoyISO()).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() + '.xlsx');
}
function pedidoACotizador() {
  if (!pedido.filas.length) return;
  if (S.borrador && S.borrador.items.length && !confirm(`El cotizador ya tiene ${S.borrador.items.length} artículos. ¿Agregar los del pedido a esos? (Cancelar = no hacer nada)`)) return;
  if (!S.borrador) S.borrador = borradorVacio();
  const cli = pedido.cliente.trim() && S.clientes.find(c => normalizar(c.nombre) === normalizar(pedido.cliente));
  if (cli && !S.borrador.clienteId) S.borrador.clienteId = cli.id;
  let n = 0, salteados = 0;
  pedido.filas.forEach(f => { if (f.estado === 'noexiste') { salteados++; return; } agregarSinPintar(f.cod, Math.round(f.cant)); n++; });
  if (cli) cambiarClienteBorrador(cli.id);
  guardar('borrador'); ir('cotizador');
  aviso(`${n} artículos pasados al cotizador` + (salteados ? ` · ${salteados} no existen y no se pasaron` : ''), salteados ? '' : 'ok');
}


// ============ Pedidos guardados: se arman desde el pañol ============
const EST_PEDIDO = { pendiente: ['Pendiente', 't-gris'], armando: ['En armado', 't-amber'], armado: ['Armado', 't-green'] };
function numPed(p) { return p.num ? String(p.num).padStart(4, '0') : '(nuevo)'; }
function sacadoDe(l) { return (l.sacado || []).reduce((a, x) => a + (Number(x.cant) || 0), 0); }
function estadoAuto(p) { if (p.estado === 'armado') return 'armado'; return p.items.some(l => sacadoDe(l) > 0) ? 'armando' : 'pendiente'; }
function resumenPed(p) { const c = p.items.filter(l => sacadoDe(l) >= l.cant).length; return `${c}/${p.items.length} renglones · ${fmt(p.items.reduce((a, l) => a + sacadoDe(l), 0), 0)} de ${fmt(p.items.reduce((a, l) => a + l.cant, 0), 0)} u.`; }
function tabsPedido() {
  const n = S.pedidos.filter(p => p.estado !== 'armado').length;
  return `<button class="btn ${pedTab === 'nuevo' ? 'pri' : ''}" onclick="if(salirDelPedido()){pedTab='nuevo';pintar()}">Nuevo / informe</button>
    <button class="btn ${pedTab !== 'nuevo' ? 'pri' : ''}" onclick="if(salirDelPedido()){pedTab='lista';pintar()}">Pedidos guardados${n ? ` (${n} sin armar)` : ''}</button>`;
}
async function guardarPedido() {
  const cli = pedido.cliente.trim().toUpperCase();
  if (!cli) { aviso('Escribí el cliente para guardar el pedido', 'err'); const e = document.getElementById('pedCli'); if (e) e.focus(); return; }
  if (!pedido.filas.length) { aviso('Primero armá el informe', 'err'); return; }
  const ant = pedido.editandoId && S.pedidos.find(p => p.id === pedido.editandoId);
  if (ant && ant.estado === 'armado') { aviso('Ese pedido ya está armado: no se puede editar', 'err'); return; }
  const previo = {}; (ant ? ant.items : []).forEach(l => { previo[l.cod] = l; });
  const sacadosQueSeVan = ant ? ant.items.filter(l => sacadoDe(l) > 0 && !pedido.filas.some(f => f.cod === l.cod)) : [];
  if (sacadosQueSeVan.length && !confirm(`Sacás del pedido ${sacadosQueSeVan.length} renglones que ya tenían algo sacado (${sacadosQueSeVan.map(l => l.cod).join(', ')}). Lo que salió de cajones NO vuelve solo. ¿Seguir?`)) return;
  const items = pedido.filas.slice().sort((a, b) => a.orden - b.orden).map(f => ({ cod: f.cod, cant: f.cant, desc: f.desc || '', sacado: previo[f.cod] ? previo[f.cod].sacado || [] : [] }));
  const doc = { id: ant ? ant.id : uid(), num: ant ? ant.num : null, fecha: ant ? ant.fecha : hoyISO(), cliente: cli, items, creado: ant ? ant.creado : Date.now() };
  doc.estado = estadoAuto(doc); doc.resumen = resumenPed(doc);
  const r = await docGuardar('pedidos', doc, { tipo: 'Pedido', detalle: ant ? `${numPed(ant)} editado (${cli}): ${items.length} renglones` : `Nuevo pedido para ${cli}: ${items.length} renglones` });
  if (!r) return;
  if (r.resultado && r.resultado.num) doc.num = r.resultado.num;
  const i = S.pedidos.findIndex(p => p.id === doc.id); if (i >= 0) S.pedidos[i] = doc; else S.pedidos.push(doc);
  guardar('pedidos'); marcarPedidos();
  Object.assign(pedido, { cliente: '', codigos: '', cantidades: '', filas: [], armado: false, editandoId: null });
  aviso(`Pedido ${numPed(doc)} guardado`, 'ok');
  pedTab = 'abierto'; pedAbierto = doc.id; pintar();
}
let filtroPed = 'activos';
function vistaPedidosGuardados() {
  const l = S.pedidos.filter(p => filtroPed === 'todos' || (filtroPed === 'armados' ? p.estado === 'armado' : p.estado !== 'armado')).sort((a, b) => (b.num || 0) - (a.num || 0));
  main(`<div class="cab"><div><h1>Armar pedido</h1><p>Pedidos guardados para armar desde el pañol. Tocá uno para abrirlo y tildar lo que se va sacando.</p></div><div class="acciones">${tabsPedido()}</div></div>
    <div class="fila" style="margin-bottom:10px">${[['activos', 'Sin armar'], ['armados', 'Armados'], ['todos', 'Todos']].map(([k, t]) => `<button class="chip ${filtroPed === k ? 'on' : ''}" onclick="filtroPed='${k}';pintar()">${t}</button>`).join('')}</div>
    <div class="panel tabla-scroll">${l.length ? `<table class="t"><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Avance</th><th>Estado</th></tr>
      ${l.map(p => `<tr class="click" onclick="pedTab='abierto';pedAbierto='${p.id}';pintar()"><td class="num">${numPed(p)}</td><td>${fechaAR(p.fecha)}</td><td><b>${esc(p.cliente)}</b></td><td class="muted" style="font-size:13px">${resumenPed(p)}</td><td><span class="tag ${EST_PEDIDO[p.estado || 'pendiente'][1]}">${EST_PEDIDO[p.estado || 'pendiente'][0]}</span></td></tr>`).join('')}</table>`
      : '<div class="vacio">No hay pedidos ' + (filtroPed === 'armados' ? 'armados' : filtroPed === 'activos' ? 'sin armar' : 'guardados') + '. Cargalos en “Nuevo / informe” y tocá “Guardar pedido”.</div>'}</div>`);
}
// Dónde está cada cosa ahora (estantería = stock − sobre stock)
// ---- Armado con borrador: se tilda todo en el teléfono sin guardar y al final se guarda una sola vez
let borrPed = null;   // { id, items, delta: { 'CAJON|COD': unidades a descontar (+) o devolver (−) }, cambios }
function pedidoVista(id) { return borrPed && borrPed.id === id ? borrPed : S.pedidos.find(x => x.id === id); }
function abrirBorrador(id) {
  if (borrPed && borrPed.id === id) return borrPed;
  const p = S.pedidos.find(x => x.id === id);
  borrPed = Object.assign(JSON.parse(JSON.stringify(p)), { delta: {}, cambios: 0 });
  return borrPed;
}
function hayCambiosPed() { return !!(borrPed && borrPed.cambios); }
window.addEventListener('beforeunload', e => { if (hayCambiosPed()) { e.preventDefault(); e.returnValue = ''; } });
// Al salir de la pantalla con cambios sin guardar, preguntar
function salirDelPedido() {
  if (!hayCambiosPed()) { borrPed = null; return true; }
  if (confirm(`Tenés ${borrPed.cambios} cambios sin guardar en el Pedido ${numPed(borrPed)}. ¿Salir sin guardar? (Cancelar = quedarse)`)) { borrPed = null; return true; }
  return false;
}
function fuentesDe(cod) {
  const a = infoArticulo(cod); const total = numStock(a.stock);
  const cajones = (sobreIdx.get(cod) || []).map(x => ({ ...x, cant: x.cant - ((borrPed && borrPed.delta[x.cajon + '|' + cod]) || 0) })).filter(x => x.cant > 0);
  const enSobre = (sobreIdx.get(cod) || []).reduce((s, x) => s + x.cant, 0);
  return { a, total, cajones, estante: total === null ? null : Math.max(0, total - enSobre), ubic: a.ubic && a.ubic !== '-' ? a.ubic : '' };
}
function tarjetaRenglon(p, l, i, f, armado) {
  const s = sacadoDe(l), completo = s >= l.cant;
  return `<div class="panel" id="ren_${i}" style="padding:10px 12px;${completo ? 'opacity:.6;border-color:var(--green)' : ''}">
    <div class="fila" style="gap:10px;flex-wrap:nowrap;align-items:flex-start">
      <input type="checkbox" style="width:26px;height:26px;margin-top:2px;flex:none" ${s > 0 ? 'checked' : ''} ${armado ? 'disabled' : ''} onclick="event.preventDefault();tildarRenglon('${p.id}',${i})">
      <div style="flex:1;min-width:0"><div class="fila" style="justify-content:space-between"><span class="num" style="color:var(--amber);font-size:16px">${esc(l.cod)}</span>
        <span><b style="font-size:17px">${s ? fmt(s, 0) + ' / ' : ''}${fmt(l.cant, 0)}</b> <span class="muted">u.</span></span></div>
        <div style="font-size:14px">${esc(f.a.desc || l.desc || '')}</div>
        <div class="muted" style="font-size:13px;margin-top:3px">Estantería: <b>${f.estante === null ? '—' : fmt(f.estante, 0) + ' u.'}</b>${f.ubic ? ' · ' + esc(f.ubic) : ''}${f.cajones.map(x => ` · ${esc(x.cajon.replace(/^CAJON SOBRE STOCK\s*/i, 'Cajón '))}: ${x.cant} u.`).join('')}</div>
        ${(l.sacado || []).length ? `<div style="font-size:12px;margin-top:3px;color:var(--green)">Sacado: ${l.sacado.map(x => fmt(x.cant, 0) + ' de ' + (x.de === 'estante' ? 'estantería' : x.de.replace(/^CAJON SOBRE STOCK\s*/i, 'Cajón ')) + (x.nuevo ? ' <span style="color:var(--amber)">(sin guardar)</span>' : '')).join(' · ')}</div>` : ''}
        ${!completo && s > 0 ? `<div style="font-size:12px;color:var(--amber)">Faltan ${fmt(l.cant - s, 0)}</div>` : ''}</div></div></div>`;
}
function barraGuardar(p) {
  const n = borrPed && borrPed.id === p.id ? borrPed.cambios : 0;
  return `<div id="barraPed" style="position:sticky;bottom:0;z-index:5;margin-top:12px;${n ? '' : 'display:none'}">
    <div class="panel fila" style="justify-content:space-between;border-color:var(--amber);background:#1c1a10">
      <span><b>${n}</b> cambio${n === 1 ? '' : 's'} sin guardar</span>
      <span class="fila" style="gap:6px"><button class="btn" onclick="descartarBorrador()">Descartar</button><button class="btn pri" onclick="guardarCambiosPedido()">💾 Guardar cambios</button></span></div></div>`;
}
function vistaArmarPedido() {
  const p = pedidoVista(pedAbierto);
  const armado = p.estado === 'armado';
  // orden fijo por ubicación (no se mueven las tarjetas al tildar)
  const items = p.items.map((l, i) => ({ l, i, f: fuentesDe(l.cod) }))
    .sort((a, b) => String(a.f.ubic || 'zzz').localeCompare(String(b.f.ubic || 'zzz'), 'es', { numeric: true }) || a.i - b.i);
  main(`<div class="cab"><div><h1>Pedido ${numPed(p)} · ${esc(p.cliente)}</h1><p id="resPed">${fechaAR(p.fecha)} · ${resumenPed(p)} · <span class="tag ${EST_PEDIDO[estadoAuto(p)][1]}">${EST_PEDIDO[estadoAuto(p)][0]}</span></p></div>
    <div class="acciones">${tabsPedido()}</div></div>
    <div class="fila" style="margin-bottom:12px">
      ${!armado ? `<button class="btn" onclick="editarPedido('${p.id}')">✎ Editar</button>` : ''}
      <button class="btn" onclick="pdfPedidoGuardado('${p.id}')">🖨 PDF para armar</button>
      ${!armado ? `<button class="btn verde" onclick="terminarPedido('${p.id}')">✔ Marcar como armado</button>` : `<button class="btn" onclick="reabrirPedido('${p.id}')">Reabrir</button>`}
      <button class="btn rojo" style="margin-left:auto" onclick="eliminarPedido('${p.id}')">Eliminar</button></div>
    <div class="muted" style="font-size:12px;margin-bottom:8px">Tildá todo lo que vas sacando: <b>no se guarda nada hasta que toques “💾 Guardar cambios”</b> abajo. Si está también en el sobre stock, te pregunta de dónde salió.</div>
    <div class="grid" style="gap:8px">${items.map(({ l, i, f }) => tarjetaRenglon(p, l, i, f, armado)).join('')}</div>
    ${barraGuardar(p)}`);
}
// Redibuja solo la tarjeta tocada y la barra (rápido en el teléfono)
function refrescarRenglon(i) {
  const p = borrPed; const l = p.items[i];
  const el = document.getElementById('ren_' + i); if (el) el.outerHTML = tarjetaRenglon(p, l, i, fuentesDe(l.cod), false);
  const b = document.getElementById('barraPed'); if (b) b.outerHTML = barraGuardar(p);
  const r = document.getElementById('resPed'); if (r) r.innerHTML = `${fechaAR(p.fecha)} · ${resumenPed(p)} · <span class="tag ${EST_PEDIDO[estadoAuto(p)][1]}">${EST_PEDIDO[estadoAuto(p)][0]}</span>`;
}
function editarPedido(id) {
  if (!salirDelPedido()) return;
  const p = S.pedidos.find(x => x.id === id); if (!p || p.estado === 'armado') return;
  Object.assign(pedido, { cliente: p.cliente, codigos: p.items.map(l => l.cod).join('\n'), cantidades: p.items.map(l => l.cant).join('\n'), editandoId: p.id });
  pedTab = 'nuevo'; armarPedido();
}
async function guardarDocPedido(p, detalle) {
  p.estado = p.estado === 'armado' ? 'armado' : estadoAuto(p); p.resumen = resumenPed(p);
  const r = await docGuardar('pedidos', p, { tipo: 'Pedido', detalle: `${numPed(p)} (${p.cliente}): ${detalle}` });
  guardar('pedidos'); marcarPedidos();
  return r;
}
// Tildar (local): si está en cajones, preguntar de dónde se sacó. Destildar: lo de cajones vuelve al guardar.
function tildarRenglon(id, i) {
  const p = abrirBorrador(id); const l = p.items[i];
  if (sacadoDe(l) > 0) return formDestildar(id, i);
  const f = fuentesDe(l.cod); const falta = l.cant - sacadoDe(l);
  if (!f.cajones.length) return confirmarSacado(id, i, [{ de: 'estante', cant: falta }]);
  let resto = falta; const prop = [];
  const e = Math.min(resto, f.estante || 0); prop.push(['estante', e]); resto -= e;
  f.cajones.forEach(x => { const c = Math.min(resto, x.cant); prop.push([x.cajon, c]); resto -= c; });
  if (resto > 0) prop[0][1] += resto;
  abrirModal(`<h3 style="margin-top:0">¿De dónde sacaste ${esc(l.cod)}?</h3>
    <p class="muted" style="margin-top:0">${esc(f.a.desc)} · pedido: <b>${fmt(falta, 0)} u.</b></p>
    ${prop.map(([de, c], k) => { const disp = de === 'estante' ? f.estante : f.cajones.find(x => x.cajon === de).cant;
      return `<div class="fila" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><div><b>${de === 'estante' ? 'Estantería' + (f.ubic ? ' · ' + esc(f.ubic) : '') : esc(de)}</b><div class="muted" style="font-size:12px">hay ${disp === null ? '—' : fmt(disp, 0)} u.</div></div>
        <input class="in" type="number" min="0" id="sac_${k}" data-de="${esc(de)}" value="${c}" style="width:80px;text-align:right" oninput="sumaSacado(${falta})"></div>`; }).join('')}
    <div class="muted" id="sacSuma" style="margin-top:8px;font-size:13px"></div>
    <div class="fila" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn pri" onclick="confirmarSacadoModal('${id}',${i})">Listo, lo saqué</button></div>`);
  sumaSacado(falta);
}
function sumaSacado(falta) {
  const t = [...document.querySelectorAll('[id^="sac_"]')].reduce((a, e) => a + (parseInt(e.value) || 0), 0);
  const el = document.getElementById('sacSuma'); if (el) el.innerHTML = `Total: <b>${t}</b> de ${fmt(falta, 0)}` + (t < falta ? ` · quedan faltando ${fmt(falta - t, 0)}` : t > falta ? ' · <span style="color:var(--amber)">más de lo pedido</span>' : ' ✓');
}
function confirmarSacadoModal(id, i) {
  const partes = [...document.querySelectorAll('[id^="sac_"]')].map(e => ({ de: e.dataset.de, cant: parseInt(e.value) || 0 })).filter(x => x.cant > 0);
  if (!partes.length) { aviso('Poné cuántas sacaste', 'err'); return; }
  const f = fuentesDe(borrPed.items[i].cod);
  for (const x of partes) if (x.de !== 'estante') { const c = f.cajones.find(y => y.cajon === x.de); if (!c || x.cant > c.cant) { aviso(`En ${x.de} no hay tantas`, 'err'); return; } }
  cerrarModal(); confirmarSacado(id, i, partes);
}
function confirmarSacado(id, i, partes) {
  const p = abrirBorrador(id); const l = p.items[i];
  partes.forEach(x => {
    l.sacado = (l.sacado || []).concat([{ de: x.de, cant: x.cant, ts: Date.now(), stockV: S.metas.stock, nuevo: true }]);
    if (x.de !== 'estante') { const k = x.de + '|' + l.cod; p.delta[k] = (p.delta[k] || 0) + x.cant; }
  });
  p.cambios++; refrescarRenglon(i);
}
function formDestildar(id, i) {
  const p = abrirBorrador(id); const l = p.items[i];
  const deCajon = (l.sacado || []).filter(x => x.de !== 'estante');
  abrirModal(`<h3 style="margin-top:0">¿Destildar ${esc(l.cod)}?</h3>
    <p class="muted" style="margin-top:0">Se borra lo anotado como sacado (${l.sacado.map(x => fmt(x.cant, 0) + ' de ' + (x.de === 'estante' ? 'estantería' : esc(x.de))).join(', ')}).
    ${deCajon.length ? '<br>Lo que salió de cajones vuelve al cajón cuando guardes.' : ''}</p>
    <div class="fila" style="justify-content:flex-end"><button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn rojo" onclick="cerrarModal();destildar('${id}',${i})">Destildar</button></div>`);
}
function destildar(id, i) {
  const p = abrirBorrador(id); const l = p.items[i];
  (l.sacado || []).filter(x => x.de !== 'estante').forEach(x => { const k = x.de + '|' + l.cod; p.delta[k] = (p.delta[k] || 0) - x.cant; });
  l.sacado = []; p.cambios++; refrescarRenglon(i);
}
function descartarBorrador() {
  if (!confirm('¿Descartar todos los cambios sin guardar de este pedido?')) return;
  borrPed = null; pintar();
}
// Guardar: primero los cajones (lo neto por cajón y código), después el pedido una sola vez
async function guardarCambiosPedido() {
  const p = borrPed; if (!p || !p.cambios) return;
  const nota = `Pedido ${numPed(p)} · ${p.cliente}`;
  const claves = Object.keys(p.delta).filter(k => p.delta[k]);
  let hechos = 0, error = null;
  for (const k of claves) {
    const [caj, cod] = k.split('|'); const n = p.delta[k];
    const c = S.sobre.find(y => y.cajon === caj && y.cod === cod);
    let ok;
    if (n > 0) {
      if (!c) { error = `${cod} ya no está en ${caj}`; continue; }
      ok = n >= c.cant ? await remoto({ tipo: 'eliminarItem', cajon: caj, codigo: cod, nota: nota + ` (${n} u.)` }, `Guardando ${hechos + 1} de ${claves.length}…`)
        : await remoto({ tipo: 'editarItem', cajon: caj, codigo: cod, cantidad: c.cant - n, ubicacion: c.ubic, nota }, `Guardando ${hechos + 1} de ${claves.length}…`);
    } else {
      const a = infoArticulo(cod);
      ok = await agregarOSumarEnCajon(caj, cod, -n, a.ubic && a.ubic !== '-' ? a.ubic : '-', nota + ' · se destildó', `Guardando ${hechos + 1} de ${claves.length}…`);
    }
    if (!ok) { error = 'no se pudo guardar en ' + caj; break; }
    delete p.delta[k]; hechos++;
  }
  if (error && Object.keys(p.delta).some(k => p.delta[k])) { aviso('❌ Se cortó al guardar (' + error + '). Lo que quedó sin guardar sigue marcado: tocá Guardar de nuevo.', 'err'); indexarSobre(); pintar(); return; }
  const doc = JSON.parse(JSON.stringify(p)); delete doc.delta; delete doc.cambios;
  doc.items.forEach(l => (l.sacado || []).forEach(x => { delete x.nuevo; }));
  const tot = p.cambios;
  if (!await guardarDocPedido(doc, `armado: ${tot} cambios guardados`)) { aviso('❌ No se pudo guardar el pedido. Los cajones ya se descontaron; tocá Guardar de nuevo.', 'err'); p.delta = {}; pintar(); return; }
  const i = S.pedidos.findIndex(x => x.id === doc.id); if (i >= 0) S.pedidos[i] = doc;
  guardar('pedidos'); marcarPedidos(); borrPed = null; indexarSobre(); pintar();
  aviso(`Pedido ${numPed(doc)}: ${tot} cambios guardados`, 'ok');
}
async function terminarPedido(id) {
  if (hayCambiosPed()) { await guardarCambiosPedido(); if (hayCambiosPed()) return; }
  const p = S.pedidos.find(x => x.id === id);
  const faltan = p.items.filter(l => sacadoDe(l) < l.cant);
  if (faltan.length && !confirm(`Quedan ${faltan.length} renglones sin completar (${faltan.slice(0, 5).map(l => l.cod).join(', ')}${faltan.length > 5 ? '…' : ''}). ¿Marcar el pedido como armado igual?`)) return;
  p.estado = 'armado';
  if (await guardarDocPedido(p, 'marcado como armado' + (faltan.length ? ` (faltaron ${faltan.length} renglones)` : ''))) aviso(`Pedido ${numPed(p)} armado`, 'ok');
  pintar();
}
async function reabrirPedido(id) {
  const p = S.pedidos.find(x => x.id === id); p.estado = 'armando';
  await guardarDocPedido(p, 'reabierto'); pintar();
}
async function eliminarPedido(id) {
  const p = S.pedidos.find(x => x.id === id);
  if (!confirm(`¿Eliminar el Pedido ${numPed(p)} de ${p.cliente}? Lo que ya se sacó de los cajones no vuelve.`)) return;
  if (!await docBorrar('pedidos', id, { tipo: 'Pedido', detalle: `${numPed(p)} eliminado (${p.cliente})` })) return;
  if (borrPed && borrPed.id === id) borrPed = null;
  S.pedidos = S.pedidos.filter(x => x.id !== id); guardar('pedidos'); marcarPedidos(); pedTab = 'lista'; pintar();
}
function pdfPedidoGuardado(id) {
  const p = S.pedidos.find(x => x.id === id);
  const antes = { cliente: pedido.cliente, filas: pedido.filas };
  pedido.cliente = `${p.cliente} · Pedido ${numPed(p)}`;
  pedido.filas = p.items.map((l, k) => calcFilaPedido({ cod: l.cod, cant: l.cant, orden: k, veces: 1 }));
  try { pdfPedido(); } finally { Object.assign(pedido, antes); }
}


// ---- Grilla tipo Excel para cargar códigos y cantidades (los textos de pedido.codigos/cantidades siguen siendo la fuente)
let _filasExtra = 0;
function lineasPed() { return { c: String(pedido.codigos || '').replace(/\r/g, '').split('\n'), q: String(pedido.cantidades || '').replace(/\r/g, '').split('\n') }; }
function grillaPedido() {
  const { c, q } = lineasPed();
  const usadas = Math.max(renglones(pedido.codigos).length, renglones(pedido.cantidades).length);
  const n = Math.max(12, usadas + 3) + _filasExtra;
  let h = `<table class="t grilla"><tr><th style="width:34px"></th><th>Código</th><th style="width:110px" class="der">Cantidad</th><th>Descripción</th></tr>`;
  for (let r = 0; r < n; r++) {
    const cod = (c[r] || '').trim(), a = cod ? infoArticulo(limpiarCodigo(cod)) : null;
    h += `<tr><td class="muted der" style="font-size:11px">${r + 1}</td>
      <td><input class="celda mono" data-r="${r}" data-k="0" value="${esc(c[r] || '')}" oninput="celdaPed(this)" onkeydown="teclaCelda(event,this)" onpaste="pegarCelda(event,this)"></td>
      <td><input class="celda mono der" data-r="${r}" data-k="1" value="${esc(q[r] || '')}" oninput="celdaPed(this)" onkeydown="teclaCelda(event,this)" onpaste="pegarCelda(event,this)"></td>
      <td class="desc-celda" id="gd_${r}">${a ? (a.desc ? esc(a.desc) : (existeArticulo(limpiarCodigo(cod)) ? '' : '<span style="color:var(--red)">no existe</span>')) : ''}</td></tr>`;
  }
  return h + '</table>';
}
function ponerLinea(k, r, v) {
  const { c, q } = lineasPed(); const l = k === 0 ? c : q;
  while (l.length <= r) l.push('');
  l[r] = v;
  if (k === 0) pedido.codigos = l.join('\n'); else pedido.cantidades = l.join('\n');
}
function celdaPed(el) {
  const r = +el.dataset.r, k = +el.dataset.k;
  ponerLinea(k, r, el.value.trim());
  if (k === 0) { const cod = limpiarCodigo(el.value), d = document.getElementById('gd_' + r), a = cod ? infoArticulo(cod) : null;
    if (d) d.innerHTML = a ? (a.desc ? esc(a.desc) : existeArticulo(cod) ? '' : '<span style="color:var(--red)">no existe</span>') : ''; }
  contarPedido();
}
function celdaEn(r, k) { return document.querySelector(`#grillaPed input[data-r="${r}"][data-k="${k}"]`); }
function irACelda(r, k) {
  let e = celdaEn(r, k);
  if (!e) { _filasExtra += 10; repintarGrilla(); e = celdaEn(r, k); }
  if (e) { e.focus(); e.select(); }
}
function teclaCelda(ev, el) {
  const r = +el.dataset.r, k = +el.dataset.k;
  if (ev.key === 'Tab' && !ev.shiftKey) { ev.preventDefault(); k === 0 ? irACelda(r, 1) : irACelda(r + 1, 0); }
  else if (ev.key === 'Tab' && ev.shiftKey) { ev.preventDefault(); k === 1 ? irACelda(r, 0) : r > 0 && irACelda(r - 1, 1); }
  else if (ev.key === 'Enter') { ev.preventDefault(); irACelda(r + 1, k); }
  else if (ev.key === 'ArrowDown') { ev.preventDefault(); irACelda(r + 1, k); }
  else if (ev.key === 'ArrowUp' && r > 0) { ev.preventDefault(); irACelda(r - 1, k); }
}
// Pegar desde Excel: filas separadas por salto de línea y columnas por tabulación, desde la celda donde se pega
function pegarCelda(ev, el) {
  const txt = (ev.clipboardData || window.clipboardData).getData('text');
  if (!/[\t\n]/.test(txt.replace(/\n$/, ''))) return;   // un solo valor: pegado normal
  ev.preventDefault();
  const filas = txt.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(f => f.split('\t'));
  const r0 = +el.dataset.r, k0 = +el.dataset.k;
  filas.forEach((cols, i) => cols.forEach((v, j) => { const k = k0 + j; if (k <= 1) ponerLinea(k, r0 + i, String(v).trim()); }));
  repintarGrilla(); contarPedido();
  irACelda(r0 + filas.length, k0);
  aviso(`${filas.length} filas pegadas`, 'ok');
}
function repintarGrilla() { const g = document.getElementById('grillaPed'); if (g) g.innerHTML = grillaPedido(); }
function filasGrilla(n) { _filasExtra += n; repintarGrilla(); }
function limpiarGrilla() { if ((pedido.codigos || pedido.cantidades) && !confirm('¿Borrar todos los códigos y cantidades cargados?')) return; pedido.codigos = ''; pedido.cantidades = ''; _filasExtra = 0; repintarGrilla(); contarPedido(); }

// ---- Desde un presupuesto (o el cotizador) a Armar pedido: carga la grilla y arma el informe para revisar y guardar
function cargarEnPedido(filas, cliente, origen) {
  filas = filas.filter(f => f.cod && f.cant > 0);
  if (!filas.length) { aviso('No hay artículos para pasar', 'err'); return; }
  if ((renglones(pedido.codigos).length || pedido.editandoId) && !confirm('En Armar pedido ya hay códigos cargados. ¿Reemplazarlos por los de ' + origen + '?')) return;
  if (hayCambiosPed() && !salirDelPedido()) return;
  Object.assign(pedido, { cliente: String(cliente || '').toUpperCase(), codigos: filas.map(f => f.cod).join('\n'), cantidades: filas.map(f => f.cant).join('\n'), filas: [], armado: false, editandoId: null });
  pedTab = 'nuevo'; ir('pedido'); armarPedido();
  aviso(`${filas.length} artículos de ${origen}. Revisá y tocá “💾 Guardar pedido”.`, 'ok');
}
function presupuestoAPedido(id) {
  const p = S.presupuestos.find(x => x.id === id); if (!p) return;
  // si ya se confirmó la venta, se pasa solo lo vendido
  const vendidos = p.estado === 'cerrado' ? p.items.filter(l => (l.vendido || 0) > 0) : [];
  const filas = (vendidos.length ? vendidos.map(l => ({ cod: l.cod, cant: l.vendido })) : p.items.map(l => ({ cod: l.cod, cant: l.cant })));
  cargarEnPedido(filas, p.clienteNombre, `el presupuesto ${numPresu(p)}` + (vendidos.length ? ' (lo vendido)' : ''));
}
function cotizadorAPedido() {
  const b = B(); const cli = cliente(b.clienteId);
  cargarEnPedido(b.items.map(l => ({ cod: l.cod, cant: l.cant })), cli ? cli.nombre : '', 'el cotizador');
}
