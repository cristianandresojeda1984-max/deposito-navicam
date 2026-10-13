// ============ Presupuestos ============
let filtroPresu = 'todos', qPresu = '', presuSel = null, conf = null;
// Grupos de seguimiento
const GRUPOS = {
  vigentes: { t: 'Vigentes', f: p => estadoPresu(p) === 'abierto' },
  vencehoy: { t: 'Vencen hoy', f: p => estadoPresu(p) === 'vencehoy' },
  vencidos: { t: 'Vencidos', f: p => estadoPresu(p) === 'vencido' },
  ventas: { t: 'Ventas realizadas', f: p => ['vendido', 'parcial'].includes(estadoPresu(p)), monto: montoVendido },
  novendido: { t: 'No vendidos', f: p => estadoPresu(p) === 'novendido' },
  todos: { t: 'Todos', f: () => true }
};
function seguimiento() {
  const o = {};
  for (const k in GRUPOS) { const l = S.presupuestos.filter(GRUPOS[k].f); o[k] = { lista: l, monto: l.reduce((a, p) => a + (GRUPOS[k].monto || montoPresu)(p), 0) }; }
  return o;
}
VISTAS.presupuestos = function (op) {
  if (op && op.sel) { presuSel = op.sel; conf = null; }
  if (!GRUPOS[filtroPresu]) filtroPresu = 'todos';
  const sg = seguimiento();
  const q = normalizar(qPresu);
  const vis = sg[filtroPresu].lista.filter(p => !q || normalizar(numPresu(p) + ' ' + p.clienteNombre + ' ' + p.items.map(l => l.cod).join(' ')).includes(q)).sort((a, b) => b.num - a.num);
  if (presuSel && !S.presupuestos.find(p => p.id === presuSel)) presuSel = null;
  const chipF = k => `<button class="chip ${filtroPresu === k ? 'on' : ''}" onclick="filtroPresu='${k}';pintar()" ${k === 'vencehoy' && sg[k].lista.length ? 'style="border-color:var(--amber)"' : ''}>${GRUPOS[k].t} <b>${sg[k].lista.length}</b>${k !== 'todos' && k !== 'novendido' ? ` <span class="muted">· ${plata0(sg[k].monto)}</span>` : ''}</button>`;
  main(`<div class="cab"><div><h1>Presupuestos</h1><p>Guardados en esta PC. Se confirman ítem por ítem; la confirmación no descuenta stock. Montos sin IVA.</p></div>
    <div class="acciones"><button class="btn pri" onclick="nuevoPresupuesto()">＋ Nuevo presupuesto</button></div></div>
  <div class="fila" style="margin-bottom:12px">${['vigentes', 'vencehoy', 'vencidos', 'ventas', 'novendido', 'todos'].map(chipF).join('')}
    <input class="in" id="qPresu" placeholder="Buscar n.º, cliente o código…" style="max-width:240px;margin-left:auto" value="${esc(qPresu)}" oninput="qPresu=this.value;clearTimeout(window._tq);window._tq=setTimeout(()=>{pintar();const e=document.getElementById('qPresu');e.focus();e.setSelectionRange(e.value.length,e.value.length)},250)"></div>
  <div class="split" style="grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)">
    <div class="panel lista-scroll" id="listaPresu">${vis.length ? `<table class="t"><thead><tr><th>N.º</th><th>Cliente</th><th>Vence</th><th class="der">Total</th><th>Estado</th></tr></thead><tbody>
      ${vis.map(p => `<tr class="click ${p.id === presuSel ? 'sel' : ''}" onclick="elegirPresu('${p.id}')"><td class="num">${numPresu(p)}</td><td>${esc(p.clienteNombre)}<div class="muted" style="font-size:11px">${fechaAR(p.fecha)}</div></td><td>${fechaAR(p.hasta)}</td><td class="der num">${masIva(montoPresu(p))}</td><td>${chipEstado(p)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="vacio">No hay presupuestos en esta vista.</div>'}</div>
    <div id="detPresu" class="fija">${presuSel ? detallePresu(S.presupuestos.find(p => p.id === presuSel)) : '<div class="panel vacio">Elegí un presupuesto de la lista para ver el detalle y confirmar la venta.</div>'}</div>
  </div>`);
};
// Elegir sin redibujar toda la pantalla, para que la lista no pierda la posición
function elegirPresu(id) {
  presuSel = id; conf = null;
  document.querySelectorAll('#listaPresu tr.click').forEach(tr => tr.classList.toggle('sel', tr.getAttribute('onclick').includes(id)));
  repintarDetalle(); document.getElementById('detPresu').scrollTop = 0;
}
function detallePresu(p) {
  const e = estadoPresu(p);
  const abierto = p.estado !== 'cerrado';
  if (abierto && !conf) conf = { vend: p.items.map(l => l.cant), mot: p.items.map(() => ''), motGeneral: '' };
  const cli = cliente(p.clienteId);
  return `<div class="panel">
    <div class="fila" style="justify-content:space-between"><div><div class="muted">Presupuesto ${numPresu(p)} · ${p.items.length} ítems</div><h3 style="margin:4px 0 0;font-size:19px">${esc(p.clienteNombre)}</h3></div>${chipEstado(p)}</div>
    <div class="grid g2" style="margin-top:12px;gap:8px">
      <div><small class="muted">Total</small><div class="num" style="font-size:18px;font-weight:700">${masIva(montoPresu(p))}</div></div>
      <div><small class="muted">Dólar del presupuesto (interno)</small><div class="num">$ ${fmt(p.dolar)}</div></div>
      <div><small class="muted">Creado</small><div>${fechaAR(p.fecha)}</div></div>
      <div><small class="muted">Válido hasta</small><div>${fechaAR(p.hasta)} <span class="muted">(${p.validezDias} días)</span></div></div>
    </div>
    <div class="muted" style="font-size:12px;margin-top:8px">${e === 'vencehoy' ? '⏰ Hoy es el último día de validez.' : e === 'vencido' ? '⚠ Vencido: si lo editás o duplicás, los precios se recalculan con la lista y el dólar de hoy.' : abierto ? 'Dentro de la validez: se respetan los precios del presupuesto.' : 'Cerrado el ' + esc(p.cierre ? p.cierre.fecha : '') + '.'}</div>
    <div class="sep"></div>
    ${abierto ? bloqueConfirmar(p) : bloqueResultado(p)}
    <div class="sep"></div>
    <div class="fila">
      ${abierto ? `<button class="btn azul" onclick="abrirEnCotizador('${p.id}')">✎ Modificar</button>` : `<span class="tag t-gris" style="padding:8px 10px" title="Ya se confirmó la venta o se desestimó">🔒 Cerrado: no se modifica</span>`}
      <button class="btn" onclick="duplicar('${p.id}')">Copiar a un presupuesto nuevo</button>
      <button class="btn" onclick="vistaCliente(S.presupuestos.find(x=>x.id==='${p.id}'))">Vista cliente / PDF</button>
      <button class="btn" onclick="enviarWhatsApp(S.presupuestos.find(x=>x.id==='${p.id}'))">WhatsApp${cli && cli.whatsapp ? '' : ' (sin número)'}</button>
      <button class="btn" onclick="exportarPresupuesto(S.presupuestos.find(x=>x.id==='${p.id}'))">Excel</button>
      <button class="btn rojo" onclick="eliminarPresu('${p.id}')">Eliminar</button>
    </div>
    <div class="sep"></div>
    <div class="muted" style="font-size:12px">Historial</div>
    ${p.historial.map(h => `<div style="font-size:12px;padding:2px 0">${esc(h.fecha)} · ${esc(h.texto)}</div>`).join('')}
  </div>`;
}
function opcionesMotivo(sel) {
  return `<option value="">— motivo —</option>` + S.motivos.map(m => `<option ${m === sel ? 'selected' : ''}>${esc(m)}</option>`).join('');
}
function bloqueConfirmar(p) {
  const vendidos = p.items.filter((l, i) => conf.vend[i] > 0);
  const t = totales(p.items.map((l, i) => ({ ...l, cantV: conf.vend[i] })), 'cantV');
  const noVend = p.items.map((l, i) => i).filter(i => conf.vend[i] < p.items[i].cant);
  return `<div style="font-weight:600;margin-bottom:8px">¿Qué se vendió? Marcá los ítems y ajustá la cantidad</div>
  <table class="t">${p.items.map((l, i) => `<tr>
    <td style="width:28px;vertical-align:top;padding-top:12px"><input type="checkbox" ${conf.vend[i] > 0 ? 'checked' : ''} onchange="marcarItem(${i},this.checked)"></td>
    <td><span class="num" style="color:var(--amber)">${esc(l.cod)}</span> <span class="tag t-gris">${esc(marcaDe(l))}</span> <span class="num muted" style="font-size:12px">${plata(l.unit)} c/u + IVA</span><div style="font-size:12px" class="muted">${esc(l.desc)}${l.reemplazaA ? ' · reemplaza a ' + esc(l.reemplazaA) : ''}</div>
      ${conf.vend[i] < l.cant ? `<select class="in" style="margin-top:6px;max-width:240px;padding:5px 8px" onchange="conf.mot[${i}]=this.value">${opcionesMotivo(conf.mot[i])}</select>` : ''}</td>
    <td class="der" style="white-space:nowrap;vertical-align:top"><input class="in" type="number" min="0" max="${l.cant}" value="${conf.vend[i]}" style="width:60px;text-align:right" onchange="cantVendida(${i},this.value)"> <span class="muted">de ${l.cant}</span></td></tr>`).join('')}</table>
  <div class="fila" style="justify-content:space-between;margin-top:12px"><span>Vendido (${vendidos.length} de ${p.items.length} ítems)</span><b class="num" style="font-size:17px">${masIva(t.sub)}</b></div>
  ${noVend.length ? `<div style="margin-top:12px"><div class="muted" style="font-size:12px;margin-bottom:6px">Motivo de lo que no se vendió (tocá uno para ponerlo en todos los que no tienen motivo)</div>
    <div class="fila">${S.motivos.map(m => `<button class="chip" onclick="motivoATodos(this.dataset.m)" data-m="${esc(m)}">${esc(m)}</button>`).join('')}
    <span id="nuevoMotivoBox"><button class="chip" onclick="campoNuevoMotivo()">＋ Agregar motivo</button></span></div></div>` : ''}
  <div class="fila" style="margin-top:14px">
    <button class="btn verde" onclick="confirmarVenta('${p.id}')" ${vendidos.length ? '' : 'disabled'}>✔ Confirmar venta de lo marcado</button>
    <button class="btn rojo" onclick="noSeVendio('${p.id}')">No se vendió nada</button></div>`;
}
function bloqueResultado(p) {
  const t = totales(p.items, 'vendido');
  return `<div style="font-weight:600;margin-bottom:8px">Resultado</div>
  <table class="t">${p.items.map(l => `<tr><td><span class="num" style="color:var(--amber)">${esc(l.cod)}</span> <span class="tag t-gris">${esc(marcaDe(l))}</span><div style="font-size:12px" class="muted">${esc(l.desc)}${l.reemplazaA ? ' · reemplaza a ' + esc(l.reemplazaA) : ''}</div></td>
    <td class="der">${l.vendido || 0} de ${l.cant}</td>
    <td>${(l.vendido || 0) >= l.cant ? '<span class="tag t-green">vendido</span>' : `<span class="tag t-red">${(l.vendido || 0) ? 'parcial' : 'no vendido'}${l.motivo ? ' · ' + esc(l.motivo) : ''}</span>`}</td></tr>`).join('')}</table>
  <div class="fila" style="justify-content:space-between;margin-top:10px"><span>Total vendido</span><b class="num" style="font-size:17px">${masIva(t.sub)}</b></div>`;
}
function repintarDetalle() { const p = S.presupuestos.find(x => x.id === presuSel); if (p) document.getElementById('detPresu').innerHTML = detallePresu(p); }
function marcarItem(i, on) { const p = S.presupuestos.find(x => x.id === presuSel); conf.vend[i] = on ? p.items[i].cant : 0; repintarDetalle(); }
function cantVendida(i, v) { const p = S.presupuestos.find(x => x.id === presuSel); conf.vend[i] = Math.max(0, Math.min(p.items[i].cant, parseInt(v) || 0)); repintarDetalle(); }
function motivoATodos(m) { const p = S.presupuestos.find(x => x.id === presuSel); p.items.forEach((l, i) => { if (conf.vend[i] < l.cant && !conf.mot[i]) conf.mot[i] = m; }); conf.motGeneral = m; repintarDetalle(); }
function campoNuevoMotivo() {
  document.getElementById('nuevoMotivoBox').innerHTML = `<input class="in" id="txtMotivo" placeholder="Nuevo motivo" style="width:180px;padding:4px 8px" onkeydown="if(event.key==='Enter')agregarMotivo()"> <button class="btn chico pri" onclick="agregarMotivo()">Agregar</button>`;
  document.getElementById('txtMotivo').focus();
}
async function agregarMotivo() {
  const v = document.getElementById('txtMotivo').value.trim();
  if (!v) return;
  if (!S.motivos.some(m => normalizar(m) === normalizar(v))) {
    if (!await docGuardar('motivos', { id: v, orden: S.motivos.length + 1 }, { tipo: 'Motivo nuevo', detalle: v })) return;
    S.motivos.push(v); guardar('motivos');
  }
  repintarDetalle();
}
function confirmarVenta(id) {
  const p = S.presupuestos.find(x => x.id === id);
  const faltan = p.items.filter((l, i) => conf.vend[i] < l.cant && !conf.mot[i]);
  if (faltan.length && !confirm(`${faltan.length} ítems no vendidos quedan sin motivo. ¿Confirmar igual?`)) return;
  cerrarPresu(p, conf.vend, conf.mot);
}
function noSeVendio(id) {
  const p = S.presupuestos.find(x => x.id === id);
  const sinMot = p.items.some((l, i) => !conf.mot[i]);
  if (sinMot && !conf.motGeneral) {
    abrirModal(`<h3 style="margin-top:0">¿Por qué no se vendió?</h3><div class="fila">${S.motivos.map(m => `<button class="btn" data-m="${esc(m)}" onclick="cerrarModal();conf.motGeneral=this.dataset.m;motivoATodos(this.dataset.m);noSeVendio('${id}')">${esc(m)}</button>`).join('')}</div>
      <div class="fila" style="margin-top:12px"><button class="btn" onclick="cerrarModal();conf.motGeneral='(sin motivo)';noSeVendio('${id}')">Cerrar sin motivo</button></div>`);
    return;
  }
  cerrarPresu(p, p.items.map(() => 0), p.items.map((l, i) => conf.mot[i] || (conf.motGeneral === '(sin motivo)' ? '' : conf.motGeneral)));
}
async function cerrarPresu(p, vend, mot) {
  const q = JSON.parse(JSON.stringify(p));
  q.items.forEach((l, i) => { l.vendido = vend[i]; l.motivo = vend[i] < l.cant ? (mot[i] || '') : ''; });
  q.estado = 'cerrado'; q.cierre = { fecha: fechaAR(hoyISO()), iso: hoyISO() };
  const t = totales(q.items, 'vendido'); const e = estadoPresu(q);
  q.historial.push({ fecha: ahoraTxt(), texto: `${ESTADO_TXT[e]}: ${plata(t.sub)} + IVA` + (motivosDe(q).length ? ' · motivos: ' + motivosDe(q).join(', ') : '') });
  if (!await docGuardar('presupuestos', presuADoc(q), { tipo: 'Presupuesto', detalle: `${numPresu(q)} ${q.clienteNombre}: ${ESTADO_TXT[e]} (${plata(t.sub)} + IVA)` })) return;
  Object.assign(p, q); guardar('presupuestos'); conf = null; pintar(); aviso('Presupuesto ' + numPresu(p) + ': ' + ESTADO_TXT[e], 'ok');
}
async function reabrir(id) {
  const p = S.presupuestos.find(x => x.id === id);
  if (!confirm('¿Reabrir el presupuesto ' + numPresu(p) + '? Se borra lo confirmado para que lo vuelvas a marcar.')) return;
  const q = JSON.parse(JSON.stringify(p));
  q.estado = 'abierto'; delete q.cierre; q.items.forEach(l => { delete l.vendido; delete l.motivo; });
  q.historial.push({ fecha: ahoraTxt(), texto: 'Reabierto para corregir' });
  if (!await docGuardar('presupuestos', presuADoc(q), { tipo: 'Presupuesto', detalle: numPresu(q) + ' reabierto' })) return;
  const i = S.presupuestos.indexOf(p); S.presupuestos[i] = q; guardar('presupuestos'); conf = null; pintar();
}
async function eliminarPresu(id) {
  const p = S.presupuestos.find(x => x.id === id);
  if (!confirm('¿Eliminar el presupuesto ' + numPresu(p) + ' de ' + p.clienteNombre + '? No se puede deshacer.')) return;
  if (!await docBorrar('presupuestos', id, { tipo: 'Presupuesto', detalle: numPresu(p) + ' eliminado (' + p.clienteNombre + ')' })) return;
  S.presupuestos = S.presupuestos.filter(x => x.id !== id); guardar('presupuestos'); presuSel = null; pintar();
}
function puedePisarBorrador() {
  return !(S.borrador && S.borrador.items.length) || confirm('Hay otro presupuesto a medio hacer en el cotizador. ¿Descartarlo?');
}
function abrirEnCotizador(id) {
  const p = S.presupuestos.find(x => x.id === id);
  if (p.estado === 'cerrado') { aviso('Este presupuesto ya está cerrado (vendido o no vendido): no se puede modificar. Podés copiarlo a uno nuevo.', 'err'); return; }
  if (!puedePisarBorrador()) return;
  const venc = estadoPresu(p) === 'vencido';
  S.borrador = { editandoId: p.id, clienteId: p.clienteId, validezDias: p.validezDias, fecha: venc ? hoyISO() : p.fecha, dolar: venc ? S.dolar : p.dolar, items: p.items.map(l => ({ ...l })), notas: p.notas || '', mostrarDispo: !!(p.opciones && p.opciones.mostrarDispo) };
  if (venc) recalcularBorrador(true);
  guardar('borrador'); ir('cotizador');
  if (venc) aviso('Estaba vencido: precios recalculados con la lista y el dólar de hoy. La validez corre desde hoy.', '');
}
// Copiar un presupuesto (abierto o cerrado) a un presupuesto nuevo, para el mismo cliente o para otro
function duplicar(id) {
  const p = S.presupuestos.find(x => x.id === id);
  abrirModal(`<h3 style="margin-top:0">Copiar el presupuesto ${numPresu(p)}</h3>
    <p class="muted">${p.items.length} artículos de ${esc(p.clienteNombre)} · ${fechaAR(p.fecha)}. Se arma un presupuesto nuevo con los precios y el dólar de hoy.</p>
    <div class="campo"><span class="lbl">¿Para qué cliente?</span><select class="in" id="dupCli">${opcionesClientes(p.clienteId)}</select></div>
    <div class="muted" style="font-size:12px;margin-top:6px">Si elegís otro cliente, los descuentos se recalculan con su escala.</div>
    <div class="fila" style="margin-top:14px;justify-content:flex-end"><button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn pri" onclick="copiarPresu('${p.id}',document.getElementById('dupCli').value)">Copiar al cotizador</button></div>`);
}
function opcionesClientes(sel) {
  return CATEGORIAS.map(c => `<optgroup label="${esc(c.largo)}">${S.clientes.filter(x => x.categoria === c.id).sort((a, x) => a.nombre.localeCompare(x.nombre)).map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</optgroup>`).join('');
}
function copiarPresu(id, clienteId) {
  const p = S.presupuestos.find(x => x.id === id);
  if (!puedePisarBorrador()) return;
  const otro = clienteId && clienteId !== p.clienteId;
  S.borrador = { editandoId: null, clienteId: clienteId || p.clienteId, validezDias: p.validezDias, fecha: hoyISO(), dolar: S.dolar,
    items: p.items.map(l => { const c = { ...l }; delete c.vendido; delete c.motivo; if (c.dispo && !c.dispo.manual) delete c.dispo; if (otro && c.manual) c.manual = false; return c; }),
    notas: p.notas || '', mostrarDispo: !!(p.opciones && p.opciones.mostrarDispo) };
  recalcularBorrador(true); guardar('borrador'); cerrarModal(); ir('cotizador');
  aviso(`Copia del presupuesto ${numPresu(p)} lista en el cotizador${otro ? ' para ' + (cliente(clienteId) || {}).nombre : ''}, con precios de hoy`, 'ok');
}
// Desde el cotizador: buscar un presupuesto anterior y traer sus artículos
let qCopiar = '';
function formCopiarAnterior() {
  abrirModal(`<h3 style="margin-top:0">Copiar de un presupuesto anterior</h3>
    <input class="in" id="qCopiar" autofocus placeholder="Buscar por n.º, cliente o código…" value="${esc(qCopiar)}" oninput="qCopiar=this.value;listaCopiar()">
    <div id="listaCopiar" style="max-height:420px;overflow:auto;margin-top:10px"></div>
    <div class="muted" style="font-size:12px;margin-top:8px">Los artículos se traen con los precios y el dólar de hoy, para el cliente que esté elegido en el cotizador.</div>`, true);
  listaCopiar();
}
function listaCopiar() {
  const q = normalizar(qCopiar);
  const l = [...S.presupuestos].sort((a, b) => (b.num || 0) - (a.num || 0))
    .filter(p => !q || normalizar(numPresu(p) + ' ' + p.clienteNombre + ' ' + p.items.map(x => x.cod + ' ' + (x.reemplazaA || '') + ' ' + x.desc).join(' ')).includes(q)).slice(0, 60);
  document.getElementById('listaCopiar').innerHTML = l.length ? `<table class="t">${l.map(p => `<tr class="click" onclick="traerAnterior('${p.id}')"><td class="num">${numPresu(p)}</td><td>${esc(p.clienteNombre)}<div class="muted" style="font-size:11px">${esc(p.items.slice(0, 3).map(x => x.cod + ' ' + x.desc).join(' · '))}${p.items.length > 3 ? ' · …' : ''}</div></td><td>${fechaAR(p.fecha)}</td><td class="der">${p.items.length} art.</td><td>${chipEstado(p)}</td></tr>`).join('')}</table>`
    : '<div class="vacio">No hay presupuestos que coincidan.</div>';
}
function traerAnterior(id) {
  const b = B(); const p = S.presupuestos.find(x => x.id === id);
  if (b.items.length && !confirm(`El cotizador ya tiene ${b.items.length} artículos. ¿Reemplazarlos por los ${p.items.length} del presupuesto ${numPresu(p)}?`)) return;
  const clienteId = b.clienteId || p.clienteId;
  const ed = b.editandoId; const fecha = b.fecha;
  S.borrador = null; copiarPresuSinPreguntar(p, clienteId);
  if (ed) { S.borrador.editandoId = ed; S.borrador.fecha = fecha; }
  guardar('borrador'); cerrarModal(); pintar();
}
function copiarPresuSinPreguntar(p, clienteId) {
  const otro = clienteId !== p.clienteId;
  S.borrador = { editandoId: null, clienteId, validezDias: p.validezDias, fecha: hoyISO(), dolar: S.dolar,
    items: p.items.map(l => { const c = { ...l }; delete c.vendido; delete c.motivo; if (c.dispo && !c.dispo.manual) delete c.dispo; if (otro && c.manual) c.manual = false; return c; }),
    notas: p.notas || '', mostrarDispo: !!(p.opciones && p.opciones.mostrarDispo) };
  recalcularBorrador(true);
  aviso(`Artículos del presupuesto ${numPresu(p)} cargados con precios de hoy`, 'ok');
}
function recalcularBorrador(conLista) {
  const b = S.borrador; const cli = cliente(b.clienteId);
  b.items.forEach(l => { if (conLista) refrescarLinea(l, cli, b.dolar); else { recalcDesc(l, cli); calcularLinea(l, b.dolar); } });
}

