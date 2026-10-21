// ============ Cotizador ============
function borradorVacio(clienteId) {
  return { editandoId: null, clienteId: clienteId || '', validezDias: Number(S.ajustes.validez) || 7, fecha: hoyISO(), dolar: S.dolar, items: [], notas: '' };
}
function nuevoPresupuesto(clienteId) {
  if (S.borrador && S.borrador.items.length && !confirm('Hay un presupuesto sin guardar en el cotizador. ¿Descartarlo y empezar uno nuevo?')) { ir('cotizador'); return; }
  S.borrador = borradorVacio(clienteId); guardar('borrador'); ir('cotizador');
}
function B() { if (!S.borrador) { S.borrador = borradorVacio(); guardar('borrador'); } return S.borrador; }

VISTAS.cotizador = function () {
  const b = B();
  const cli = cliente(b.clienteId);
  const ed = b.editandoId ? S.presupuestos.find(p => p.id === b.editandoId) : null;
  const raros = cli ? ['5', '6', '7', '8', '9'].filter(d => descCliente(cli, d).raro) : [];
  const dobles = cli ? ['5', '6', '7', '8', '9'].filter(d => descCliente(cli, d).alternativas.length > 1) : [];
  main(`
  <div class="cab"><div><h1>${ed ? 'Editando presupuesto ' + numPresu(ed) : 'Presupuesto nuevo'}</h1>
    <p>${fechaAR(b.fecha)} · dólar del presupuesto <b>$ ${fmt(b.dolar)}</b>${b.dolar !== S.dolar ? ` <span class="tag t-amber">hoy $ ${fmt(S.dolar)}</span> <button class="btn chico" onclick="actualizarPreciosBorrador()">Actualizar precios a hoy</button>` : ''}</p></div>
    <div class="acciones">
      <button class="btn" onclick="enviarWhatsApp(armarDesdeBorrador())" ${b.items.length && cli ? '' : 'disabled'}>WhatsApp</button>
      <button class="btn" onclick="vistaCliente(armarDesdeBorrador())" ${b.items.length && cli ? '' : 'disabled'}>Vista cliente / PDF</button>
      <button class="btn" onclick="exportarPresupuesto(armarDesdeBorrador())" ${b.items.length && cli ? '' : 'disabled'}>Excel</button>
      <button class="btn rojo" onclick="descartarBorrador()" ${b.items.length || ed ? '' : 'disabled'}>Descartar</button>
      <button class="btn pri" onclick="guardarPresupuesto()" ${b.items.length && cli ? '' : 'disabled'}>${ed ? 'Guardar cambios' : 'Guardar presupuesto'}</button>
    </div></div>
  <div class="grid g3">
    <div class="panel"><span class="lbl">Cliente</span>
      <select class="in" id="selCli" onchange="cambiarClienteBorrador(this.value)"><option value="">— Elegí un cliente —</option>
      ${CATEGORIAS.map(c => `<optgroup label="${esc(c.largo)}">${S.clientes.filter(x => x.categoria === c.id).sort((a, x) => a.nombre.localeCompare(x.nombre)).map(x => `<option value="${x.id}" ${x.id === b.clienteId ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</optgroup>`).join('')}</select>
      <div class="muted" style="margin-top:6px;font-size:12px">${cli ? esc(catCorto(cli.categoria)) + (cli.localidad ? ' · ' + esc(cli.localidad) : '') : ''} <a href="#" onclick="formCliente();return false">＋ cliente nuevo</a></div></div>
    <div class="panel"><span class="lbl">Validez del presupuesto</span>
      <div class="fila"><input class="in" type="number" min="1" style="width:80px" value="${b.validezDias}" onchange="B().validezDias=Math.max(1,parseInt(this.value)||1);guardar('borrador');pintar()">
      <span>días · hasta <b>${fechaAR(sumarDias(b.fecha, b.validezDias))}</b></span></div>
      <div class="muted" style="margin-top:6px;font-size:12px">Dentro de la validez se respeta el precio.</div>
      <label class="fila" style="margin-top:10px;cursor:pointer;gap:6px"><input type="checkbox" ${b.mostrarDispo ? 'checked' : ''} onchange="B().mostrarDispo=this.checked;guardar('borrador');pintar()"> <b>Mostrar disponibilidad al cliente</b></label></div>
    <div class="panel"><span class="lbl">Escala de descuentos del cliente (se aplica sola según la D del código)</span>
      <div class="fila">${cli ? chipsEscala(cli) : '<span class="muted">Elegí un cliente</span>'}</div>
      ${raros.length ? `<div style="margin-top:6px"><span class="tag t-red" style="white-space:normal">D${raros.join(', D')}: valor sin interpretar (${raros.map(d => esc(cli.desc[d])).join(', ')}) → poné el % a mano en la línea</span></div>` : ''}
      ${dobles.length ? `<div style="margin-top:6px"><span class="tag t-amber" style="white-space:normal">D${dobles.join(', D')} tiene dos valores: se usa el primero; en la línea podés elegir el otro</span></div>` : ''}
    </div>
  </div>
  <div class="panel" style="margin-top:14px">
    <div class="fila" style="align-items:flex-end">
      <div class="busca" style="flex:1;min-width:240px"><span class="lbl">Código o descripción</span>
        <input class="in" id="busq" autocomplete="off" placeholder="Ej: 2992242 o filtro aceite" oninput="sugerir(this.value)" onkeydown="teclaBusq(event)"><div class="sug" id="sug" style="display:none"></div></div>
      <div class="campo" style="width:90px"><span class="lbl">Cantidad</span><input class="in" id="cantNueva" type="number" min="1" value="1" onkeydown="if(event.key==='Enter')agregarDesdeBuscador()"></div>
      <button class="btn pri" onclick="agregarDesdeBuscador()">Agregar</button>
      <button class="btn azul" onclick="formPegar()">Pegar códigos y cantidades</button>
      <button class="btn" onclick="formCopiarAnterior()">Copiar de un presupuesto anterior</button>
    </div>
    <div class="tabla-scroll" style="margin-top:14px">${tablaBorrador(b, cli)}</div>
    ${b.items.length ? `<div class="fila" style="justify-content:space-between;align-items:flex-start;margin-top:14px">
      <div style="flex:1;min-width:260px"><span class="lbl">Observaciones (salen en el presupuesto)</span><textarea class="in" rows="3" onchange="B().notas=this.value;guardar('borrador')">${esc(b.notas)}</textarea>
      <div class="muted" style="font-size:12px;margin-top:6px">El descuento de cada línea lo pone la app según la escala del cliente y la D del código. Si lo cambiás a mano queda marcado como “manual”.</div></div>
      ${bloqueTotales(totales(b.items))}</div>` : ''}
  </div>`);
}
function bloqueTotales(t) {
  return `<div style="width:320px;max-width:100%">
    <div class="total-linea muted"><span>Total a precio de lista</span><span class="num">${plata(t.lista)}</span></div>
    <div class="total-linea" style="color:var(--green)"><span>Descuento del cliente</span><span class="num">−${plata(t.ahorro)}</span></div>
    <div class="total-linea total-grande"><span>Total</span><span class="num">${masIva(t.sub)}</span></div>
    <div class="muted" style="font-size:12px;text-align:right">Precios sin IVA. El IVA y las percepciones dependen de cada cliente.</div></div>`;
}
function tablaBorrador(b, cli) {
  if (!b.items.length) return '<div class="vacio">Agregá artículos con el buscador o pegá una lista desde Excel.</div>';
  return `<table class="t"><tr><th style="width:26px">N.º</th><th>Artículo</th><th>Marca</th><th class="der">Cant</th><th class="cen">D</th><th class="der">Lista + IVA</th><th class="der">Desc %</th><th class="der">Unitario + IVA</th><th class="der">Subtotal + IVA</th><th>Depósito y avisos</th><th></th></tr>
  ${b.items.map((l, i) => {
    const a = infoArticulo(l.cod);
    const dc = descCliente(cli, l.D);
    const marca = l.marca || 'IVECO';
    const alt = dc.alternativas.length > 1 ? dc.alternativas.map(v => `<button class="chip ${Number(l.descPct) === v ? 'on' : ''}" style="padding:1px 6px;font-size:11px" onclick="ponerDesc(${i},${v})">${v}</button>`).join('') : '';
    const base = baseDe(l);
    const nx = S.nexpro[base.cod] || [];
    const sugerido = !l.reemplazaA && S.reemplazos[base.cod];
    const precioEditable = marca === 'OTRO' || marca === 'PROPIO' || (!l.usd && !l.listaManual) || (marca === 'NEXPRO' && !l.usd);
    return `<tr><td class="num muted" style="width:26px;text-align:right;padding-right:6px">${i + 1}</td>
      <td style="min-width:230px"><span class="num" style="color:var(--amber);font-weight:600">${esc(l.cod)}</span>${marca === 'NEXPRO' && l.cod !== base.cod ? ` <span class="muted" style="font-size:11px">(Iveco ${esc(base.cod)})</span>` : ''}
        <div style="font-size:13px">${esc(l.desc)}</div>
        ${l.reemplazaA ? `<div><span class="tag t-violet">Reemplaza a ${esc(l.reemplazaA)}</span> <a href="#" style="font-size:11px" onclick="quitarReemplazo(${i});return false">quitar</a></div>`
          : sugerido ? `<div><span class="tag t-amber">Tiene reemplazo: ${esc(sugerido)}</span> <button class="btn chico azul" onclick="ponerReemplazo(${i},'${esc(sugerido)}')">Usar</button></div>`
          : `<a href="#" style="font-size:11px" onclick="formReemplazo(${i});return false">↔ poner reemplazo</a>`}</td>
      <td>${marca === 'PROPIO' ? `<span class="tag t-violet">Artículo propio</span><input class="in" style="width:104px;padding:4px 6px;margin-top:4px;font-size:12px" placeholder="Marca (opcional)" title="Lo que sale en la columna Marca del presupuesto" value="${esc(l.marcaTxt || '')}" onchange="B().items[${i}].marcaTxt=this.value.trim().toUpperCase();guardar('borrador')">` : `<select class="in" style="width:104px;padding:5px 6px" onchange="cambiarMarca(${i},this.value)">${['IVECO', 'NEXPRO', 'OTRO'].map(m => `<option ${m === marca ? 'selected' : ''}>${m}</option>`).join('')}</select>
        ${marca === 'OTRO' ? `<input class="in" style="width:104px;padding:4px 6px;margin-top:4px;font-size:12px" placeholder="¿Qué marca?" value="${esc(l.marcaTxt || '')}" onchange="B().items[${i}].marcaTxt=this.value.trim().toUpperCase();guardar('borrador')">` : ''}
        ${marca === 'NEXPRO' && nx.length > 1 ? `<select class="in" style="width:104px;padding:4px 6px;margin-top:4px;font-size:11px" title="Hay ${nx.length} equivalentes NEXPRO" onchange="elegirNexpro(${i},this.value)">${nx.map((x, k) => `<option value="${k}" ${x[0] === l.cod ? 'selected' : ''} title="${esc(x[4])}">${esc(x[0])}</option>`).join('')}</select>` : ''}
        ${marca === 'NEXPRO' && !nx.length ? '<div class="tag t-red" style="white-space:normal;margin-top:4px">Sin equivalente: precio a mano</div>' : ''}`}</td>
      <td class="der"><input class="in" type="number" min="1" value="${l.cant}" style="width:66px;text-align:right" onchange="cambiarCant(${i},this.value)"></td>
      <td class="cen">${esc(l.D || '—')}</td>
      <td class="der num">${precioEditable ? `<input class="in" placeholder="$ a mano" style="width:110px;text-align:right" value="${l.listaManual ? fmt(l.listaManual) : ''}" onchange="ponerListaManual(${i},this.value)">` : plata(l.listaArs)}</td>
      <td class="der"><div class="fila" style="justify-content:flex-end;gap:4px;flex-wrap:nowrap">${alt}<input class="in" type="number" step="0.5" value="${l.descPct}" style="width:64px;text-align:right" onchange="ponerDesc(${i},this.value)"></div>
        ${l.manual ? `<span class="tag t-amber" title="Escala del cliente: ${dc.pct}%">manual <a href="#" style="color:inherit" onclick="volverEscala(${i});return false">↺</a></span>` : ''}</td>
      <td class="der num">${plata(l.unit)}</td>
      <td class="der num">${plata(l.sub)}</td>
      <td style="font-size:12px">${a.stock !== null ? `<span class="${Number(a.stock) >= l.cant ? '' : 'muted'}">${esc(a.stock)} u. · ${esc(a.ubic)}</span>` : '<span class="muted">sin stock en depósito</span>'}${a.sobre ? ` <span class="muted">+${a.sobre} sobre stock</span>` : ''}<br>
        ${a.enLista || marca !== 'IVECO' ? (a.repos ? etiquetasArticulo({ ...a, enLista: true }) : '') : etiquetasArticulo(a)}
        ${bloqueDispo(l, i)}</td>
      <td><button class="btn chico rojo" onclick="quitarLinea(${i})" title="Quitar este artículo del presupuesto">🗑 Quitar</button></td></tr>`;
  }).join('')}</table>`;
}
// Datos Iveco del renglón (después de un reemplazo, los del código nuevo)
function baseDe(l) { return l.base || { cod: l.cod, desc: l.desc, usd: l.usd, D: l.D }; }
function datosIveco(cod) { const a = infoArticulo(cod); return { cod, desc: a.desc, usd: a.usd, D: a.D }; }
function lineaNueva(cod, cant, cli, dolar) {
  const a = infoArticulo(cod);
  const dc = descCliente(cli, a.D);
  if (a.propio) return calcularLinea({ cod, desc: a.desc, cant, D: '', usd: 0, listaManual: a.precioArs, descPct: 0, manual: false, marca: 'PROPIO', base: datosIveco(cod) }, dolar);
  return calcularLinea({ cod, desc: a.desc, cant, D: a.D, usd: a.usd, listaManual: 0, descPct: dc.pct, manual: false, marca: 'IVECO', base: datosIveco(cod) }, dolar);
}
// Aplica la marca elegida sobre los datos Iveco del renglón
function aplicarMarca(l, idxNexpro) {
  const base = baseDe(l); l.base = base;
  const m = l.marca || 'IVECO';
  if (m === 'PROPIO') { const pr = S.propios[base.cod]; Object.assign(l, { cod: base.cod, desc: base.desc, usd: 0, D: '' }); if (pr && !l.listaManual) l.listaManual = Number(pr.precio) || 0; }
  else if (m === 'IVECO') { Object.assign(l, { cod: base.cod, desc: base.desc, usd: base.usd, D: base.D, listaManual: 0 }); }
  else if (m === 'NEXPRO') {
    const nx = S.nexpro[base.cod] || [];
    const x = nx[idxNexpro || 0];
    if (x) Object.assign(l, { cod: x[0], desc: x[1] || base.desc, usd: Number(x[2]) || 0, D: String(x[3] || '').trim(), listaManual: 0 });
    else Object.assign(l, { cod: base.cod, desc: base.desc, usd: 0, D: base.D });
  } else { Object.assign(l, { cod: base.cod, desc: base.desc, usd: 0, D: base.D }); }
}
function recalcDesc(l, cli) { if (!l.manual) l.descPct = descCliente(cli, l.D).pct; }
function cambiarMarca(i, m) {
  const b = B(); const l = b.items[i]; l.marca = m;
  if (m !== 'OTRO') l.listaManual = 0;
  aplicarMarca(l); recalcDesc(l, cliente(b.clienteId)); calcularLinea(l, b.dolar);
  if (m === 'NEXPRO' && !(S.nexpro[baseDe(l).cod] || []).length) aviso(`${baseDe(l).cod} no tiene equivalente NEXPRO en la lista: poné el precio a mano.`);
  guardar('borrador'); pintar();
}
function elegirNexpro(i, k) { const b = B(); const l = b.items[i]; aplicarMarca(l, Number(k)); recalcDesc(l, cliente(b.clienteId)); calcularLinea(l, b.dolar); guardar('borrador'); pintar(); }
// --- reemplazos
function formReemplazo(i) {
  const l = B().items[i]; const base = baseDe(l);
  const prev = id => `const a=infoArticulo(limpiarCodigo(this.value));document.getElementById('${id}').innerHTML=a.desc?esc(a.desc)+(a.usd?' · '+plata(a.usd*S.dolar)+' + IVA':'')+(a.stock!==null?' · stock '+esc(a.stock):''):'<span class=muted>No está en la lista ni en el stock</span>'`;
  abrirModal(`<h3 style="margin-top:0">Poner un reemplazo</h3>
    <p class="muted" style="margin-top:0">El renglón toma la descripción, el precio, la D y el stock del código nuevo, y queda anotado que es un reemplazo. El programa lo recuerda para la próxima vez.</p>
    <div class="campo"><span class="lbl">Código que pidió el cliente</span><input class="in" id="codPedido" style="max-width:220px" value="${esc(base.cod)}" oninput="${prev('prevPedido')}"><div id="prevPedido" style="font-size:12px;margin-top:3px">${esc(base.desc || '')}</div></div>
    <div style="margin:6px 0"><button class="btn chico" title="Dar vuelta los dos códigos" onclick="const x=document.getElementById('codPedido'),y=document.getElementById('codReemp');[x.value,y.value]=[y.value,x.value];x.dispatchEvent(new Event('input'));y.dispatchEvent(new Event('input'))">⇅ dar vuelta</button></div>
    <div class="campo"><span class="lbl">Código nuevo (el que va en el presupuesto)</span><input class="in" id="codReemp" autofocus style="max-width:220px" placeholder="Código nuevo" oninput="${prev('prevReemp')}" onkeydown="if(event.key==='Enter')ponerReemplazo(${i},this.value,document.getElementById('codPedido').value)"><div id="prevReemp" style="font-size:12px;margin-top:3px"></div></div>
    <div class="fila" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn pri" onclick="ponerReemplazo(${i},document.getElementById('codReemp').value,document.getElementById('codPedido').value)">Reemplazar</button></div>`);
}
async function ponerReemplazo(i, nuevo, pedido) {
  nuevo = limpiarCodigo(nuevo); if (nuevo.length < 2) { aviso('Poné el código nuevo', 'err'); return; }
  const b = B(); const l = b.items[i];
  const viejo = pedido !== undefined && limpiarCodigo(pedido).length >= 2 ? limpiarCodigo(pedido) : (l.reemplazaA || baseDe(l).cod);
  if (nuevo === viejo) { aviso('Los dos códigos son iguales', 'err'); return; }
  if (!existeArticulo(nuevo) && !confirm(`${nuevo} no está en la lista ni en el stock. ¿Usarlo igual?`)) return;
  l.reemplazaA = viejo; l.base = datosIveco(nuevo); marcaSegunCodigo(l);
  aplicarMarca(l); recalcDesc(l, cliente(b.clienteId)); calcularLinea(l, b.dolar);
  guardar('borrador'); cerrarModal(); pintar();
  if (S.reemplazos[viejo] === nuevo) { aviso(`${viejo} reemplazado por ${nuevo}`, 'ok'); return; }
  const r = await docGuardar('reemplazos', { id: viejo, nuevo }, { tipo: 'Reemplazo', detalle: `${viejo} → ${nuevo}` });
  if (!r) { aviso(`El renglón quedó con ${nuevo}, pero el reemplazo no se pudo guardar en la planilla. Probá de nuevo desde Datos y ajustes.`, 'err'); return; }
  S.reemplazos[viejo] = nuevo; ultimoReemp = viejo; guardar('reemplazos'); pintarSeguro();
  aviso(`Reemplazo guardado: ${viejo} → ${nuevo}`, 'ok');
}
// Al cambiar el código del renglón (reemplazo): si el nuevo es de Iveco toma su lista; si es un artículo propio, su precio
function marcaSegunCodigo(l) {
  const a = infoArticulo(baseDe(l).cod);
  if (a.propio) { l.marca = 'PROPIO'; l.listaManual = a.precioArs || 0; l.manual = false; }
  else if (l.marca === 'PROPIO') { l.marca = 'IVECO'; l.listaManual = 0; delete l.marcaTxt; l.manual = false; }
  else if ((l.marca || 'IVECO') === 'IVECO') l.listaManual = 0;
}
function quitarReemplazo(i) {
  const b = B(); const l = b.items[i];
  l.base = datosIveco(l.reemplazaA); delete l.reemplazaA; marcaSegunCodigo(l);
  aplicarMarca(l); recalcDesc(l, cliente(b.clienteId)); calcularLinea(l, b.dolar); guardar('borrador'); pintar();
}
// Refresca precios de un renglón con la lista de hoy, respetando marca y reemplazo
function refrescarLinea(l, cli, dolar) {
  const base = baseDe(l); const a = infoArticulo(base.cod);
  if (l.marca === 'PROPIO') { if (a.propio && a.precioArs) l.listaManual = a.precioArs; calcularLinea(l, dolar); return; }
  if (a.usd) l.base = { ...base, usd: a.usd, D: a.D, desc: a.desc || base.desc };
  const nxIdx = (S.nexpro[l.base.cod] || []).findIndex(x => x[0] === l.cod);
  if ((l.marca || 'IVECO') !== 'OTRO') aplicarMarca(l, Math.max(0, nxIdx));
  recalcDesc(l, cli); calcularLinea(l, dolar);
}
function agregarAlBorrador(cod, cant) {
  const b = B(); cant = Number(cant) || 1;
  const ya = b.items.find(l => l.cod === cod || baseDe(l).cod === cod || l.reemplazaA === cod);
  if (ya) { ya.cant += cant; calcularLinea(ya, b.dolar); }
  else b.items.push(lineaNueva(cod, cant, cliente(b.clienteId), b.dolar));
  guardar('borrador');
  if (vista === 'cotizador') pintar(); else aviso(`${cod} agregado al presupuesto (${b.items.length} ítems)`, 'ok');
  if (S.reemplazos[cod] && !(ya && ya.reemplazaA)) aviso(`${cod} tiene un reemplazo cargado: ${S.reemplazos[cod]}. Tocá “Usar” en el renglón.`);
}
function cambiarClienteBorrador(id) {
  const b = B(); b.clienteId = id; const cli = cliente(id);
  b.items.forEach(l => { if (!l.manual) { l.descPct = descCliente(cli, l.D).pct; calcularLinea(l, b.dolar); } });
  guardar('borrador'); pintar();
}
function cambiarCant(i, v) { const b = B(); b.items[i].cant = Math.max(1, parseInt(v) || 1); calcularLinea(b.items[i], b.dolar); guardar('borrador'); pintar(); }
function ponerDesc(i, v) {
  const b = B(); const l = b.items[i]; const n = Math.min(100, Math.max(0, parseFloat(String(v).replace(',', '.')) || 0));
  const dc = descCliente(cliente(b.clienteId), l.D);
  l.descPct = n; l.manual = (n === dc.pct || dc.alternativas.includes(n)) ? false : 'manual';
  calcularLinea(l, b.dolar); guardar('borrador'); pintar();
}
function volverEscala(i) { const b = B(); const l = b.items[i]; l.descPct = descCliente(cliente(b.clienteId), l.D).pct; l.manual = false; calcularLinea(l, b.dolar); guardar('borrador'); pintar(); }
function leerPesos(v) { let t = String(v).trim().replace(/[$\s]/g, ''); if (/,\d{1,2}$/.test(t) || (t.includes(',') && t.includes('.'))) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(',', '.'); return parseFloat(t) || 0; }
function ponerListaManual(i, v) {
  const b = B(); const l = b.items[i]; l.listaManual = leerPesos(v); calcularLinea(l, b.dolar); guardar('borrador'); pintar();
  // en un artículo propio, el precio que se pone queda como precio del artículo
  if (l.marca === 'PROPIO' && S.propios[l.cod] && l.listaManual && Number(S.propios[l.cod].precio) !== l.listaManual) guardarPrecioPropio(l.cod, l.listaManual);
}
function quitarLinea(i) { const b = B(); const l = b.items.splice(i, 1)[0]; guardar('borrador'); pintar(); if (l) aviso(`Se quitó ${l.cod} del presupuesto`, 'ok'); }
function actualizarPreciosBorrador() {
  const b = B(); b.dolar = S.dolar; const cli = cliente(b.clienteId);
  b.items.forEach(l => refrescarLinea(l, cli, b.dolar));
  guardar('borrador'); pintar(); aviso('Precios recalculados con la lista y el dólar de hoy', 'ok');
}
function descartarBorrador() {
  if (!confirm('¿Descartar lo que hay en el cotizador?')) return;
  S.borrador = borradorVacio(); guardar('borrador'); pintar();
}
// --- buscador con sugerencias
let sugLista = [], sugAct = -1;
function sugerir(v) {
  sugLista = buscarArticulos(v, 12); sugAct = sugLista.length ? 0 : -1;
  const el = document.getElementById('sug');
  if (!sugLista.length) { el.style.display = 'none'; return; }
  el.innerHTML = sugLista.map((c, i) => { const a = infoArticulo(c); return `<div class="${i === sugAct ? 'act' : ''}" onmousedown="elegirSug(${i})"><span class="mono">${esc(c)}</span><span>${esc(a.desc)}</span><span class="muted" style="margin-left:auto">${a.usd ? plata(a.usd * S.dolar) + ' + IVA' : a.propio ? (a.precioArs ? plata(a.precioArs) + ' + IVA' : 'propio · sin precio') : ''}</span></div>`; }).join('');
  el.style.display = 'block';
}
function cerrarSug() { const el = document.getElementById('sug'); if (el) el.style.display = 'none'; }
document.addEventListener('click', e => { if (!e.target.closest('.busca')) cerrarSug(); });
function teclaBusq(e) {
  const el = document.getElementById('sug');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!sugLista.length) return; e.preventDefault();
    sugAct = (sugAct + (e.key === 'ArrowDown' ? 1 : -1) + sugLista.length) % sugLista.length;
    [...el.children].forEach((d, i) => d.classList.toggle('act', i === sugAct));
  } else if (e.key === 'Enter') { e.preventDefault(); if (sugAct >= 0 && el.style.display !== 'none') elegirSug(sugAct); else agregarDesdeBuscador(); }
}
function elegirSug(i) { document.getElementById('busq').value = sugLista[i]; cerrarSug(); const c = document.getElementById('cantNueva'); c.focus(); c.select(); }
function agregarDesdeBuscador() {
  const v = limpiarCodigo(document.getElementById('busq').value);
  if (v.length < 2) return;
  let cod = v;
  const cant = parseInt(document.getElementById('cantNueva').value) || 1;
  if (!existeArticulo(cod)) {
    const r = buscarArticulos(v, 1);
    if (r.length) cod = r[0];
    else { formArticulo({ id: v }, { cant }); return; }
  }
  agregarAlBorrador(cod, cant);
  setTimeout(() => { const i = document.getElementById('busq'); if (i) { i.value = ''; i.focus(); } }, 0);
}
function agregarSinPintar(cod, cant) {
  const b = B(); const ya = b.items.find(l => l.cod === cod || baseDe(l).cod === cod || l.reemplazaA === cod);
  if (ya) { ya.cant += cant; calcularLinea(ya, b.dolar); } else b.items.push(lineaNueva(cod, cant, cliente(b.clienteId), b.dolar));
}
// --- guardar
function armarDesdeBorrador() {
  const b = B(); const cli = cliente(b.clienteId); const t = totales(b.items);
  const ed = b.editandoId ? S.presupuestos.find(p => p.id === b.editandoId) : null;
  return {
    id: ed ? ed.id : null, num: ed ? ed.num : null, clienteId: b.clienteId, clienteNombre: cli ? cli.nombre : '', categoria: cli ? cli.categoria : '',
    escala: cli ? { ...cli.desc } : {}, fecha: b.fecha, validezDias: b.validezDias, hasta: sumarDias(b.fecha, b.validezDias), dolar: b.dolar,
    items: b.items.map(l => { const c = { ...l }; c.dispo = dispoDe(l); return c; }), notas: b.notas, sub: t.sub, borrador: !ed,
    opciones: { mostrarDispo: !!b.mostrarDispo }
  };
}
// ---- disponibilidad (stock del depósito + sobre stock)
function stockTotal(cod) { const a = infoArticulo(cod); const n = parseFloat(String(a.stock === null ? 0 : a.stock).replace(',', '.')); return Math.max(0, (isNaN(n) ? 0 : n) + (a.sobre || 0)); }
function dispoDe(l) {
  const d = l.dispo || {};
  const inm = d.manual ? Math.min(l.cant, Math.max(0, Number(d.inmediata) || 0)) : Math.min(l.cant, Math.floor(stockTotal(l.cod)));
  return { manual: !!d.manual, inmediata: inm, dias: d.dias === undefined || d.dias === null ? '' : d.dias, sinAbast: !!d.sinAbast };
}
function textoDispo(l) {
  const d = l.dispo || dispoDe(l); const resto = l.cant - d.inmediata; const dias = d.dias !== '' && d.dias !== undefined ? Number(d.dias) : null;
  const plazo = dias ? dias + (dias === 1 ? ' día' : ' días') : 'a confirmar';
  if (resto <= 0) return 'Inmediata';
  if (d.sinAbast) return d.inmediata ? `${d.inmediata} inmediata${d.inmediata > 1 ? 's' : ''}, resto sin abastecimiento` : 'Sin abastecimiento';
  if (!d.inmediata) return plazo;
  return `${d.inmediata} inmediata${d.inmediata > 1 ? 's' : ''}, resto ${dias ? 'en ' : ''}${plazo}`;
}
function bloqueDispo(l, i) {
  const d = dispoDe(l); const resto = l.cant - d.inmediata;
  return `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #25324d">${B().mostrarDispo ? '' : '<div class="muted" style="font-size:11px;margin-bottom:3px">No se muestra al cliente</div>'}
    <span class="${resto > 0 ? (d.sinAbast ? 'tag t-red' : 'tag t-amber') : 'tag t-green'}">${resto > 0 ? (d.sinAbast && !d.inmediata ? 'Sin abastecimiento' : d.inmediata ? d.inmediata + ' inmediatas' : 'Sin stock') : 'Disponible'}</span>
    <span class="muted">inmed.</span> <input class="in" type="number" min="0" max="${l.cant}" value="${d.inmediata}" title="Unidades disponibles ya (stock + sobre stock: ${fmt(stockTotal(l.cod), 0)})" style="width:52px;padding:2px 4px" onchange="ponerDispo(${i},'inmediata',this.value)">
    ${resto > 0 ? (d.sinAbast ? '' : `<span class="muted">resto en</span> <input class="in" type="number" min="0" value="${d.dias}" placeholder="días" style="width:56px;padding:2px 4px" onchange="ponerDispo(${i},'dias',this.value)"> <span class="muted">días</span>`)
      + `<label style="display:block;margin-top:3px;cursor:pointer;font-size:12px"><input type="checkbox" ${d.sinAbast ? 'checked' : ''} onchange="ponerDispo(${i},'sinAbast',this.checked)"> sin abastecimiento</label>` : ''}
    ${d.manual ? ` <a href="#" style="font-size:11px" onclick="ponerDispo(${i},'auto');return false" title="Volver a calcular con el stock">↺</a>` : ''}</div>`;
}
function ponerDispo(i, campo, v) {
  const l = B().items[i]; const d = dispoDe(l);
  if (campo === 'auto') l.dispo = { manual: false, dias: d.dias, sinAbast: d.sinAbast };
  else if (campo === 'inmediata') l.dispo = { manual: true, inmediata: Math.min(l.cant, Math.max(0, parseInt(v) || 0)), dias: d.dias, sinAbast: d.sinAbast };
  else if (campo === 'sinAbast') l.dispo = { ...d, sinAbast: !!v };
  else l.dispo = { ...d, dias: v === '' ? '' : Math.max(0, parseInt(v) || 0) };
  if (campo !== 'auto' && !B().mostrarDispo) { B().mostrarDispo = true; aviso('Activé “Mostrar disponibilidad al cliente”: va a salir en el PDF. Si no querés, destildalo.', 'ok'); }
  guardar('borrador'); pintar();
}
let guardandoPresu = false;
async function guardarPresupuesto() {
  if (guardandoPresu) return;
  const b = B(); const cli = cliente(b.clienteId);
  if (!cli) { aviso('Elegí un cliente', 'err'); return; }
  if (!b.items.length) return;
  const sinPrecio = b.items.filter(l => !l.unit);
  if (sinPrecio.length && !confirm(`${sinPrecio.length} ítems quedaron sin precio (${sinPrecio.map(l => l.cod).join(', ')}). ¿Guardar igual?`)) return;
  const p = armarDesdeBorrador(); delete p.borrador; delete p.sub;
  const total = plata(totales(p.items).sub) + ' + IVA';
  let nuevo;
  if (b.editandoId) {
    const ant = S.presupuestos.find(x => x.id === b.editandoId);
    nuevo = Object.assign({}, ant, p, { id: ant.id, num: ant.num, creado: ant.creado, estado: 'abierto', historial: (ant.historial || []).concat([{ fecha: ahoraTxt(), texto: `Editado: ${p.items.length} ítems, ${total}` }]) });
  } else {
    nuevo = Object.assign(p, { id: uid(), num: null, creado: Date.now(), estado: 'abierto', historial: [{ fecha: ahoraTxt(), texto: `Creado: ${p.items.length} ítems, ${total}` }] });
  }
  guardandoPresu = true;
  const r = await docGuardar('presupuestos', presuADoc(nuevo), { tipo: 'Presupuesto', detalle: b.editandoId ? `${numPresu(nuevo)} editado (${nuevo.clienteNombre}) · ${total}` : `Nuevo para ${nuevo.clienteNombre} · ${total}` });
  guardandoPresu = false;
  if (!r) return;
  if (r.resultado && r.resultado.num) nuevo.num = r.resultado.num;
  const i = S.presupuestos.findIndex(x => x.id === nuevo.id); if (i >= 0) S.presupuestos[i] = nuevo; else S.presupuestos.push(nuevo);
  S.borrador = borradorVacio(); guardar('presupuestos', 'borrador');
  aviso((b.editandoId ? 'Cambios guardados en el presupuesto ' : 'Presupuesto guardado: N.º ') + numPresu(nuevo), 'ok'); ir('presupuestos', { sel: nuevo.id });
}
