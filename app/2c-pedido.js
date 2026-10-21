// ============ Armar pedido: pegar códigos y cantidades → dónde está y si alcanza ============
// Es un informe del momento (no se guarda). Stock total = el del Excel (incluye el sobre stock); estantería = total − sobre stock.
const pedido = { cliente: '', codigos: '', cantidades: '', filas: [], orden: 'ubic', dir: 'asc', armado: false };

VISTAS.pedido = function () {
  main(`<div class="cab"><div><h1>Armar pedido</h1><p>Pegá la columna de códigos y la de cantidades del Excel: te dice dónde está cada cosa y si alcanza.</p></div>
    ${pedido.armado ? `<div class="acciones"><button class="btn" onclick="nuevoPedido()">Empezar otro</button></div>` : ''}</div>
  <div class="panel" style="margin-bottom:14px">
    <div class="campo" style="max-width:420px"><span class="lbl">Cliente (opcional, sale en el PDF)</span><input class="in" id="pedCli" value="${esc(pedido.cliente)}" placeholder="Ej: TRANSPORTE PEREZ" oninput="pedido.cliente=this.value"></div>
    <div class="fila" style="margin-top:10px;align-items:stretch;gap:10px">
      <div class="campo" style="flex:2;min-width:180px"><span class="lbl">Códigos (una columna)</span>
        <textarea class="in mono" id="pedCods" rows="${pedido.armado ? 4 : 12}" placeholder="2992544&#10;500041178&#10;LUB020-P-I" oninput="pedido.codigos=this.value;contarPedido()">${esc(pedido.codigos)}</textarea></div>
      <div class="campo" style="flex:1;min-width:110px"><span class="lbl">Cantidades (una columna)</span>
        <textarea class="in mono" id="pedCants" rows="${pedido.armado ? 4 : 12}" placeholder="12&#10;40&#10;2" oninput="pedido.cantidades=this.value;contarPedido()">${esc(pedido.cantidades)}</textarea></div>
    </div>
    <div class="fila" style="margin-top:10px;justify-content:space-between"><span class="muted" id="pedCuenta" style="font-size:13px"></span>
      <button class="btn pri" onclick="armarPedido()">${pedido.armado ? 'Volver a armar el informe' : 'Armar informe →'}</button></div>
  </div>
  <div id="pedInforme">${pedido.armado ? informePedido() : ''}</div>`);
  contarPedido();
};
function nuevoPedido() { Object.assign(pedido, { cliente: '', codigos: '', cantidades: '', filas: [], armado: false }); pintar(); }
// Renglones de un textarea pegado desde Excel: se respetan los vacíos del medio (para no correr las filas), se sacan los del final
function renglones(txt) { const l = String(txt || '').replace(/\r/g, '').split('\n'); while (l.length && !l[l.length - 1].trim()) l.pop(); return l; }
function contarPedido() {
  const el = document.getElementById('pedCuenta'); if (!el) return;
  const c = renglones(pedido.codigos), q = renglones(pedido.cantidades);
  if (!c.length) { el.textContent = ''; return; }
  const juntas = !q.length && c.some(x => x.includes('\t'));
  el.innerHTML = juntas ? `${c.length} renglones (código y cantidad juntos)`
    : !q.length ? `${c.length} códigos · sin cantidades (va 1 a cada uno)`
    : c.length === q.length ? `${c.length} códigos · ${q.length} cantidades ✓`
    : `<span style="color:var(--red)">${c.length} códigos y ${q.length} cantidades: no coinciden</span>`;
}
function armarPedido() {
  const c = renglones(pedido.codigos), q = renglones(pedido.cantidades);
  if (!c.length) { aviso('Pegá la columna de códigos', 'err'); return; }
  const pares = [];
  if (!q.length && c.some(x => x.includes('\t'))) {
    // las dos columnas pegadas juntas en el primer casillero
    c.forEach(x => { const t = x.split('\t').map(s => s.trim()); if (t[0]) pares.push([t[0], t[1]]); });
  } else {
    if (q.length && q.length !== c.length) { aviso(`Hay ${c.length} códigos y ${q.length} cantidades. Revisá que estén las dos columnas completas (mismas filas).`, 'err'); return; }
    c.forEach((x, i) => { if (x.trim()) pares.push([x.trim(), q.length ? String(q[i] || '').trim() : '1']); else if (q.length && String(q[i] || '').trim()) pares.push(['', q[i]]); });
  }
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
      <span style="margin-left:auto" class="fila"><button class="btn" onclick="pdfPedido()">🖨 PDF para armar</button><button class="btn" onclick="excelFaltantes()" ${n('parcial') + n('sin') + n('noexiste') ? '' : 'disabled'}>⬇ Excel de faltantes</button><button class="btn azul" onclick="pedidoACotizador()">Pasar al cotizador</button></span></div>
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
