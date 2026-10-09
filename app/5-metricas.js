// ============ Métricas ============
let mPeriodo = null, mCat = 'todas', mCli = 'todos';
VISTAS.metricas = function () {
  if (!mPeriodo) mPeriodo = mesDe(hoyISO());
  const meses = [...new Set(S.presupuestos.map(p => mesDe(p.fecha)).concat([mesDe(hoyISO())]))].sort().reverse();
  const base = S.presupuestos.filter(p => (mCat === 'todas' || p.categoria === mCat) && (mCli === 'todos' || p.clienteId === mCli));
  const ps = base.filter(p => mPeriodo === 'todo' || mesDe(p.fecha) === mPeriodo);
  const presup = ps.reduce((a, p) => a + montoPresu(p), 0);
  const cerrados = ps.filter(p => p.estado === 'cerrado');
  const vendido = cerrados.reduce((a, p) => a + montoVendido(p), 0);
  const presCerr = cerrados.reduce((a, p) => a + montoPresu(p), 0);
  const conVenta = cerrados.filter(p => montoVendido(p) > 0).length;
  const abiertos = ps.filter(p => p.estado !== 'cerrado');
  const vencidos = abiertos.filter(p => estadoPresu(p) === 'vencido').length;
  // motivos (ítems no vendidos de presupuestos cerrados)
  const mot = {};
  cerrados.forEach(p => p.items.forEach(l => {
    const nv = l.cant - (l.vendido || 0); if (nv <= 0) return;
    const k = l.motivo || '(sin motivo)'; mot[k] = mot[k] || { n: 0, monto: 0 }; mot[k].n++; mot[k].monto += r2(l.unit * nv);
  }));
  const motOrden = Object.entries(mot).sort((a, b) => b[1].monto - a[1].monto);
  const maxMot = Math.max(1, ...motOrden.map(x => x[1].monto));
  // clientes
  const porCli = {};
  ps.forEach(p => { const c = porCli[p.clienteId] = porCli[p.clienteId] || { nombre: p.clienteNombre, pres: 0, vend: 0, presCerr: 0, n: 0 }; c.n++; c.pres += montoPresu(p); if (p.estado === 'cerrado') { c.vend += montoVendido(p); c.presCerr += montoPresu(p); } });
  const cliOrden = Object.values(porCli).sort((a, b) => b.vend - a.vend || b.pres - a.pres).slice(0, 10);
  // artículos
  const porArt = {};
  ps.forEach(p => p.items.forEach(l => { const a = porArt[l.cod] = porArt[l.cod] || { desc: l.desc, cot: 0, vend: 0, veces: 0 }; a.veces++; a.cot += l.cant; if (p.estado === 'cerrado') a.vend += l.vendido || 0; }));
  const artOrden = Object.entries(porArt).sort((a, b) => b[1].veces - a[1].veces || b[1].cot - a[1].cot).slice(0, 10);
  // categorías
  const porCat = CATEGORIAS.map(c => { const l = ps.filter(p => p.categoria === c.id); const cer = l.filter(p => p.estado === 'cerrado'); const v = cer.reduce((a, p) => a + montoVendido(p), 0); const pc = cer.reduce((a, p) => a + montoPresu(p), 0); return { c, n: l.length, pres: l.reduce((a, p) => a + montoPresu(p), 0), vend: v, cierre: pc ? v / pc : null }; });
  const pct = x => x === null || isNaN(x) ? '—' : fmt(x * 100, 0) + ' %';
  main(`<div class="cab"><div><h1>Métricas de operaciones</h1><p>Salen solas de los presupuestos hechos en la app y de cómo terminó cada uno (no incluyen ventas hechas por fuera). Montos sin IVA.</p></div>
    <div class="acciones"><button class="btn" onclick="exportarMetricas()">⬇ Exportar a Excel</button></div></div>
  <div class="fila" style="margin-bottom:14px">
    <div class="campo"><span class="lbl">Período</span><select class="in" onchange="mPeriodo=this.value;pintar()"><option value="todo" ${mPeriodo === 'todo' ? 'selected' : ''}>Todo</option>${meses.map(m => `<option value="${m}" ${m === mPeriodo ? 'selected' : ''}>${nombreMes(m)}</option>`).join('')}</select></div>
    <div class="campo"><span class="lbl">Categoría</span><select class="in" onchange="mCat=this.value;pintar()"><option value="todas">Todas</option>${CATEGORIAS.map(c => `<option value="${c.id}" ${c.id === mCat ? 'selected' : ''}>${c.largo}</option>`).join('')}</select></div>
    <div class="campo"><span class="lbl">Cliente</span><select class="in" onchange="mCli=this.value;pintar()"><option value="todos">Todos</option>${[...S.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => `<option value="${c.id}" ${c.id === mCli ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>
  </div>
  <div class="grid g4">
    <div class="panel kpi"><small>Presupuestado</small><b class="num" style="font-size:22px">${masIva0(presup)}</b><span>${ps.length} presupuestos</span></div>
    <div class="panel kpi"><small>Vendido</small><b class="num" style="font-size:22px;color:var(--green)">${masIva0(vendido)}</b><span>${conVenta} con venta (total o parcial)</span></div>
    <div class="panel kpi"><small>Tasa de cierre</small><b>${pct(presCerr ? vendido / presCerr : null)}</b><span>por monto, sobre los cerrados · ${cerrados.length ? fmt(conVenta / cerrados.length * 100, 0) + ' % por cantidad' : '—'}</span></div>
    <div class="panel kpi"><small>Abiertos sin respuesta</small><b>${abiertos.length}</b><span>${masIva0(abiertos.reduce((a, p) => a + montoPresu(p), 0))} en juego${vencidos ? ` · ${vencidos} vencidos` : ''}</span></div>
  </div>
  <div class="split" style="margin-top:14px">
    <div class="panel"><h3>Presupuestado contra vendido, por mes</h3>${graficoMeses(base)}</div>
    <div class="panel"><h3>Por qué no se vendió</h3>${motOrden.length ? motOrden.map(([k, v]) => `<div style="margin-bottom:8px"><div class="fila" style="justify-content:space-between"><span>${esc(k)}</span><span class="muted">${v.n} ítems · ${plata0(v.monto)}</span></div>
      <div style="height:7px;background:var(--panel2);border-radius:4px;margin-top:4px"><div style="height:7px;border-radius:4px;background:var(--red);width:${v.monto / maxMot * 100}%"></div></div></div>`).join('') : '<div class="muted">Todavía no hay ítems no vendidos en este período.</div>'}</div>
  </div>
  <div class="grid g3" style="margin-top:14px">
    <div class="panel tabla-scroll"><h3>Clientes que más compran</h3>${cliOrden.length ? `<table class="t"><tr><th>Cliente</th><th class="der">Vendido</th><th class="der">Cierre</th></tr>${cliOrden.map(c => `<tr><td>${esc(c.nombre)}<div class="muted" style="font-size:11px">${c.n} presup. · ${plata0(c.pres)}</div></td><td class="der num">${plata0(c.vend)}</td><td class="der">${pct(c.presCerr ? c.vend / c.presCerr : null)}</td></tr>`).join('')}</table>` : '<div class="muted">Sin datos.</div>'}</div>
    <div class="panel tabla-scroll"><h3>Artículos más cotizados</h3>${artOrden.length ? `<table class="t"><tr><th>Código</th><th class="der">Veces</th><th class="der">Unid. cotiz.</th><th class="der">Vendidas</th></tr>${artOrden.map(([c, a]) => `<tr><td><span class="num" style="color:var(--amber)">${esc(c)}</span><div class="muted" style="font-size:11px">${esc(a.desc)}</div></td><td class="der">${a.veces}</td><td class="der">${a.cot}</td><td class="der">${a.vend}</td></tr>`).join('')}</table>` : '<div class="muted">Sin datos.</div>'}</div>
    <div class="panel tabla-scroll"><h3>Por categoría de cliente</h3><table class="t"><tr><th>Categoría</th><th class="der">Presup.</th><th class="der">Vendido</th><th class="der">Cierre</th></tr>${porCat.map(x => `<tr><td>${x.c.corto}<div class="muted" style="font-size:11px">${x.n} presupuestos</div></td><td class="der num">${plata0(x.pres)}</td><td class="der num">${plata0(x.vend)}</td><td class="der">${pct(x.cierre)}</td></tr>`).join('')}</table></div>
  </div>`);
};
function graficoMeses(base) {
  const fin = mPeriodo && mPeriodo !== 'todo' ? mPeriodo : mesDe(hoyISO());
  const ms = []; let [a, m] = fin.split('-').map(Number);
  for (let i = 0; i < 6; i++) { ms.unshift(a + '-' + String(m).padStart(2, '0')); m--; if (!m) { m = 12; a--; } }
  const d = ms.map(k => { const l = base.filter(p => mesDe(p.fecha) === k); return { k, pres: l.reduce((s, p) => s + montoPresu(p), 0), vend: l.filter(p => p.estado === 'cerrado').reduce((s, p) => s + montoVendido(p), 0) }; });
  const max = Math.max(1, ...d.map(x => x.pres));
  const W = 560, H = 210, bw = 30, paso = W / 6;
  const barras = d.map((x, i) => { const x0 = i * paso + paso / 2 - bw - 2; const hp = x.pres / max * (H - 40), hv = x.vend / max * (H - 40);
    return `<rect x="${x0}" y="${H - 22 - hp}" width="${bw}" height="${hp}" rx="3" fill="#4cb3f0"><title>Presupuestado ${plata0(x.pres)}</title></rect>
      <rect x="${x0 + bw + 4}" y="${H - 22 - hv}" width="${bw}" height="${hv}" rx="3" fill="#34c77b"><title>Vendido ${plata0(x.vend)}</title></rect>
      <text x="${i * paso + paso / 2}" y="${H - 5}" fill="#8d9ab3" font-size="12" text-anchor="middle">${MESES[Number(x.k.slice(5)) - 1].slice(0, 3)}</text>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${barras}<line x1="0" x2="${W}" y1="${H - 22}" y2="${H - 22}" stroke="#25324d"/></svg>
    <div class="fila" style="font-size:12px"><span class="tag" style="background:#4cb3f0;color:#062033">Presupuestado</span><span class="tag" style="background:#34c77b;color:#062014">Vendido</span><span class="muted">Pasá el mouse por las barras para ver los montos.</span></div>`;
}
function exportarMetricas() {
  const wb = XLSX.utils.book_new();
  const p1 = [['N.º', 'Fecha', 'Cliente', 'Categoría', 'Válido hasta', 'Dólar (interno)', 'Ítems', 'Total + IVA', 'Estado', 'Vendido + IVA', 'Fecha cierre', 'Motivos']];
  S.presupuestos.forEach(p => p1.push([numPresu(p), fechaAR(p.fecha), p.clienteNombre, catCorto(p.categoria), fechaAR(p.hasta), p.dolar, p.items.length, montoPresu(p), ESTADO_TXT[estadoPresu(p)], montoVendido(p), p.cierre ? p.cierre.fecha : '', motivosDe(p).join(', ')]));
  const p2 = [['N.º', 'Cliente', 'Código', 'Descripción', 'D', 'Cant', 'Precio lista', 'Desc %', 'Unitario', 'Subtotal', 'Vendido', 'Motivo']];
  S.presupuestos.forEach(p => p.items.forEach(l => p2.push([numPresu(p), p.clienteNombre, valorCelda(l.cod), l.desc, l.D, l.cant, l.listaArs, l.descPct, l.unit, l.sub, p.estado === 'cerrado' ? (l.vendido || 0) : '', l.motivo || ''])));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(p1), 'Presupuestos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(p2), 'Ítems');
  XLSX.writeFile(wb, 'Metricas_presupuestos_' + hoyISO() + '.xlsx');
}

// ============ Clientes ============
let fCat = 'todas', qCli = '', cliSel = null;
VISTAS.clientes = function (op) {
  if (op && op.sel) cliSel = op.sel;
  const q = normalizar(qCli);
  const vis = S.clientes.filter(c => (fCat === 'todas' || c.categoria === fCat) && (!q || normalizar(c.nombre + ' ' + c.contacto + ' ' + c.localidad).includes(q))).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const c = cliente(cliSel);
  main(`<div class="cab"><div><h1>Cartera de clientes</h1><p>${S.clientes.length} clientes con su escala de descuentos</p></div>
    <div class="acciones"><button class="btn" onclick="exportarClientes()">⬇ Exportar Excel</button><button class="btn pri" onclick="formCliente()">＋ Nuevo cliente</button></div></div>
  <div class="fila" style="margin-bottom:12px"><button class="chip ${fCat === 'todas' ? 'on' : ''}" onclick="fCat='todas';pintar()">Todos ${S.clientes.length}</button>
    ${CATEGORIAS.map(k => `<button class="chip ${fCat === k.id ? 'on' : ''}" onclick="fCat='${k.id}';pintar()">${k.largo} ${S.clientes.filter(x => x.categoria === k.id).length}</button>`).join('')}
    <input class="in" id="qCli" placeholder="Buscar cliente…" style="max-width:240px;margin-left:auto" value="${esc(qCli)}" oninput="qCli=this.value;pintar();const e=document.getElementById('qCli');e.focus();e.setSelectionRange(e.value.length,e.value.length)"></div>
  <div class="split">
    <div class="panel lista-scroll" id="listaCli"><table class="t"><thead><tr><th>Cliente</th><th>Categoría</th><th class="cen">D5</th><th class="cen">D6</th><th class="cen">D7</th><th class="cen">D8</th><th class="cen">D9</th></tr></thead><tbody>
      ${vis.map(x => `<tr class="click ${x.id === cliSel ? 'sel' : ''}" onclick="elegirCliente('${x.id}')"><td>${esc(x.nombre)}</td><td class="muted">${catCorto(x.categoria)}</td>${['5', '6', '7', '8', '9'].map(d => `<td class="cen num">${esc(x.desc[d] || '—')}</td>`).join('')}</tr>`).join('')}</table></div>
    <div id="fichaCli" class="fija">${c ? fichaCliente(c) : '<div class="panel vacio">Elegí un cliente para ver su ficha.</div>'}</div>
  </div>`);
};
function elegirCliente(id) {
  cliSel = id;
  document.querySelectorAll('#listaCli tr.click').forEach(tr => tr.classList.toggle('sel', tr.getAttribute('onclick').includes("'" + id + "'")));
  document.getElementById('fichaCli').innerHTML = fichaCliente(cliente(id)); document.getElementById('fichaCli').scrollTop = 0;
}
function fichaCliente(c) {
  const ps = S.presupuestos.filter(p => p.clienteId === c.id).sort((a, b) => b.num - a.num);
  const vend = ps.reduce((a, p) => a + montoVendido(p), 0);
  return `<div class="panel"><div class="muted">${esc(catCorto(c.categoria))}${c.cuit ? ' · CUIT ' + esc(c.cuit) : ''}</div><h3 style="font-size:19px;margin:4px 0">${esc(c.nombre)}</h3><div class="muted">${esc(c.localidad || '')}</div>
    <div class="fila" style="margin:12px 0">${chipsEscala(c)}</div>
    <div class="grid g2" style="gap:8px">
      <div><small class="muted">Contacto</small><div>${esc(c.contacto || '—')}</div></div>
      <div><small class="muted">Cumpleaños</small><div>${mesCumple(c.cumple) ? diaCumple(c.cumple) + ' de ' + MESES[mesCumple(c.cumple) - 1] : '—'}</div></div>
      <div><small class="muted">WhatsApp</small><div>${esc(c.whatsapp || '—')}</div></div>
      <div><small class="muted">Forma de pago</small><div>${esc(c.pago || '—')}</div></div></div>
    ${c.notas ? `<div style="margin-top:8px"><small class="muted">Notas</small><div>${esc(c.notas)}</div></div>` : ''}
    <div class="sep"></div>
    <div class="fila" style="justify-content:space-between"><b>Presupuestos</b><span class="muted">${ps.length} · vendido ${plata0(vend)}</span></div>
    ${ps.length ? ps.slice(0, 8).map(p => `<div class="fila" style="justify-content:space-between;padding:5px 0;cursor:pointer" onclick="ir('presupuestos',{sel:'${p.id}'})"><span class="num">${numPresu(p)} · ${fechaAR(p.fecha)}</span><span class="num">${masIva(montoPresu(p))}</span>${chipEstado(p)}</div>`).join('') : '<div class="muted">Todavía no tiene presupuestos.</div>'}
    <div class="sep"></div>
    <div class="fila"><button class="btn pri" onclick="nuevoPresupuesto('${c.id}')">Cotizar para este cliente</button><button class="btn" onclick="formCliente('${c.id}')">Editar ficha y descuentos</button>
      <button class="btn rojo" onclick="eliminarCliente('${c.id}')">Eliminar</button></div></div>`;
}
function formCliente(id) {
  const c = id ? cliente(id) : { nombre: '', categoria: 'generales', cuit: '', localidad: '', contacto: '', cumple: '', whatsapp: '', notas: '', pago: '', desc: { 5: '', 6: '', 7: '', 8: '', 9: '' } };
  const cm = mesCumple(c.cumple), cd = diaCumple(c.cumple);
  abrirModal(`<h3 style="margin-top:0">${id ? 'Editar cliente' : 'Nuevo cliente'}</h3>
  <div style="font-weight:600;margin:6px 0 8px">1 · Datos del cliente</div>
  <div class="grid g2"><div class="campo"><span class="lbl">Razón social *</span><input class="in" id="fNom" value="${esc(c.nombre)}" autofocus></div>
    <div class="campo"><span class="lbl">Categoría *</span><select class="in" id="fCat">${CATEGORIAS.map(k => `<option value="${k.id}" ${k.id === c.categoria ? 'selected' : ''}>${k.largo}</option>`).join('')}</select></div>
    <div class="campo"><span class="lbl">CUIT</span><input class="in" id="fCuit" value="${esc(c.cuit)}"></div>
    <div class="campo"><span class="lbl">Localidad</span><input class="in" id="fLoc" value="${esc(c.localidad)}"></div></div>
  <div style="font-weight:600;margin:14px 0 8px">2 · Contacto</div>
  <div class="grid g3"><div class="campo"><span class="lbl">Persona de contacto</span><input class="in" id="fCon" value="${esc(c.contacto)}"></div>
    <div class="campo"><span class="lbl">Cumpleaños (día / mes)</span><div class="fila" style="flex-wrap:nowrap"><select class="in" id="fCd"><option value="">—</option>${Array.from({ length: 31 }, (_, i) => `<option ${i + 1 === cd ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
      <select class="in" id="fCm"><option value="">—</option>${MESES.map((m, i) => `<option value="${i + 1}" ${i + 1 === cm ? 'selected' : ''}>${m}</option>`).join('')}</select></div></div>
    <div class="campo"><span class="lbl">WhatsApp</span><input class="in" id="fWa" value="${esc(c.whatsapp)}" placeholder="+54 9 341 …"></div></div>
  <div style="font-weight:600;margin:14px 0 4px">3 · Descuentos del cliente por escala</div>
  <div class="muted" style="font-size:12px;margin-bottom:8px">Se aplican solos en el cotizador según la D de cada código. Vacío = sin descuento. Si tiene dos opciones, escribilas “25/27”.</div>
  <div class="fila" style="margin-bottom:10px"><span class="muted">Copiar escala de otro cliente:</span><select class="in" style="max-width:300px" onchange="copiarEscala(this.value)"><option value="">—</option>${[...S.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(x => `<option value="${x.id}">${esc(x.nombre)} · ${['5', '6', '7', '8', '9'].map(d => x.desc[d] || '—').join(' / ')}</option>`).join('')}</select></div>
  <div class="grid" style="grid-template-columns:repeat(5,minmax(0,1fr))">${['5', '6', '7', '8', '9'].map(d => `<div class="campo"><span class="lbl">D${d} (%)</span><input class="in" id="fD${d}" value="${esc(c.desc[d] || '')}" oninput="ejemploEscala()"></div>`).join('')}</div>
  <div class="muted" id="ejEscala" style="margin-top:8px;font-size:13px"></div>
  <div style="font-weight:600;margin:14px 0 8px">4 · Observaciones y forma de pago</div>
  <div class="grid g2"><div class="campo"><span class="lbl">Forma de pago</span><input class="in" id="fPago" value="${esc(c.pago)}"></div><div class="campo"><span class="lbl">Notas</span><input class="in" id="fNotas" value="${esc(c.notas)}"></div></div>
  <div class="muted" style="font-size:12px;margin-top:10px">Cada cambio de descuento queda en el registro: cuándo, de cuánto a cuánto.</div>
  <div class="fila" style="margin-top:14px;justify-content:flex-end"><button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn pri" onclick="guardarCliente('${id || ''}')">Guardar cliente</button></div>`);
  ejemploEscala();
}
function copiarEscala(id) { const x = cliente(id); if (!x) return; ['5', '6', '7', '8', '9'].forEach(d => document.getElementById('fD' + d).value = x.desc[d] || ''); ejemploEscala(); }
function ejemploEscala() {
  const v = opcionesDesc(document.getElementById('fD5').value).valores[0] || 0;
  document.getElementById('ejEscala').innerHTML = `Ejemplo: un código <b>D5</b> de lista <b>$ 100.000</b> le queda en <b>${plata0(100000 * (1 - v / 100))}</b> + IVA.`;
}
async function guardarCliente(id) {
  const g = k => document.getElementById(k).value.trim();
  const nombre = g('fNom').toUpperCase();
  if (!nombre) { aviso('Falta la razón social', 'err'); return; }
  if (S.clientes.some(c => c.id !== id && normalizar(c.nombre) === normalizar(nombre))) { aviso('Ya existe un cliente con ese nombre', 'err'); return; }
  const desc = {}; ['5', '6', '7', '8', '9'].forEach(d => desc[d] = g('fD' + d).replace(/%/g, '').replace(/\s*\/\s*/g, '/'));
  const cm = g('fCm'), cd = g('fCd');
  const datos = { nombre, categoria: g('fCat'), cuit: g('fCuit'), localidad: g('fLoc'), contacto: g('fCon'), whatsapp: g('fWa'), pago: g('fPago'), notas: g('fNotas'), desc,
    cumple: cm && cd ? '--' + String(cm).padStart(2, '0') + '-' + String(cd).padStart(2, '0') : '' };
  let c, reg;
  if (id) {
    const ant = cliente(id);
    if (ant.cumple && cm && cd && mesCumple(ant.cumple) === Number(cm) && diaCumple(ant.cumple) === Number(cd)) datos.cumple = ant.cumple;
    const cambios = ['5', '6', '7', '8', '9'].filter(d => (ant.desc[d] || '') !== desc[d]).map(d => `D${d} ${ant.desc[d] || '—'} → ${desc[d] || '—'}`);
    c = { ...ant, ...datos };
    reg = cambios.length ? { tipo: 'Descuentos cliente', detalle: `${nombre}: ${cambios.join(', ')}` } : { tipo: 'Cliente', detalle: `${nombre}: ficha editada` };
  } else {
    c = { id: 'c' + uid(), ...datos };
    reg = { tipo: 'Cliente nuevo', detalle: `${nombre} · ${['5', '6', '7', '8', '9'].map(d => 'D' + d + ' ' + (desc[d] || '—')).join(', ')}` };
  }
  if (!await docGuardar('clientes', clienteADoc(c), reg)) return;
  const i = S.clientes.findIndex(x => x.id === c.id); if (i >= 0) S.clientes[i] = c; else S.clientes.push(c);
  cliSel = c.id; guardar('clientes'); cerrarModal();
  if (!id && vista === 'cotizador') { cambiarClienteBorrador(c.id); aviso('Cliente creado', 'ok'); return; }
  pintar(); aviso('Cliente guardado', 'ok');
}
async function eliminarCliente(id) {
  const c = cliente(id); const n = S.presupuestos.filter(p => p.clienteId === id).length;
  if (!confirm(`¿Eliminar a ${c.nombre}?` + (n ? ` Tiene ${n} presupuestos: quedan guardados con su nombre.` : ''))) return;
  if (!await docBorrar('clientes', id, { tipo: 'Cliente eliminado', detalle: c.nombre })) return;
  S.clientes = S.clientes.filter(x => x.id !== id); guardar('clientes'); cliSel = null; pintar();
}
function exportarClientes() {
  const f = [['Cliente', 'Categoría', 'D5', 'D6', 'D7', 'D8', 'D9', 'CUIT', 'Localidad', 'Contacto', 'Cumpleaños', 'WhatsApp', 'Forma de pago', 'Notas']];
  S.clientes.forEach(c => f.push([c.nombre, catCorto(c.categoria), ...['5', '6', '7', '8', '9'].map(d => c.desc[d] || ''), c.cuit, c.localidad, c.contacto, mesCumple(c.cumple) ? diaCumple(c.cumple) + '/' + mesCumple(c.cumple) : '', c.whatsapp, c.pago, c.notas]));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(f), 'Clientes'); XLSX.writeFile(wb, 'Clientes_' + hoyISO() + '.xlsx');
}
