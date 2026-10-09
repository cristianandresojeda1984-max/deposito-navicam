// ============ Datos y ajustes ============
VISTAS.datos = function () {
  const a = S.ajustes;
  main(`<div class="cab"><div><h1>Datos y ajustes</h1><p>Importar los Excel de siempre, exportar, respaldos y datos de la empresa para el presupuesto.</p></div></div>
  <div class="grid g2">
    <div class="panel"><h3>Importar</h3>
      ${filaImport('Stock del depósito', 'stock', 'impStock')}
      ${filaImport('Lista de precios Iveco', 'precios', 'impPrecios')}
      ${filaImport('Sobre stock (cajones)', 'sobre', 'impSobre')}
      ${filaImport('Reposicionados (Lista de PNs reposicionados)', 'repos', 'impRepos')}
      ${filaImport('Clientes (mismo formato que “Exportar clientes”)', 'clientesXls', 'impClientes')}
      <div class="muted" style="font-size:12px;margin-top:8px">Todo se guarda en la planilla de Google y lo ven todos los dispositivos. Las columnas se buscan por el nombre del encabezado. En el sobre stock, si un artículo ya estaba en el mismo cajón, gana el Excel y te avisa. La lista de precios también trae las equivalencias NEXPRO (hoja NEXPRO).</div></div>
    <div class="panel"><h3>Exportar</h3>
      <div class="fila"><button class="btn" onclick="exportarStock()">Stock</button><button class="btn" onclick="exportarSobre()">Sobre stock + registro</button>
      <button class="btn" onclick="exportarHistorial()">Historial y anotaciones</button><button class="btn" onclick="exportarClientes()">Clientes</button><button class="btn" onclick="exportarMetricas()">Presupuestos</button></div>
      <div class="sep"></div><h3>Planilla de Google</h3>
      <div class="muted" style="font-size:12px;margin-bottom:8px">Todos los datos están en la planilla “Navicam App Datos” del Drive del trabajo. Se puede abrir y editar a mano: los dispositivos toman los cambios solos.</div>
      <div class="fila">${planillaUrl ? `<a class="btn azul" href="${esc(planillaUrl)}" target="_blank">Abrir la planilla</a>` : ''}<button class="btn" onclick="sincronizar(true).then(()=>aviso('Datos actualizados','ok'))">↻ Volver a bajar todo</button>
      <button class="btn" onclick="borrarCopiaLocal()">Borrar la copia de este dispositivo</button></div></div>
    <div class="panel"><h3>Datos que salen en el presupuesto del cliente</h3>
      <div class="campo"><span class="lbl">Nombre de la empresa</span><input class="in" id="aEmp" value="${esc(a.empresa)}"></div>
      <div class="campo" style="margin-top:8px"><span class="lbl">Dirección, teléfono, e-mail</span><input class="in" id="aDat" value="${esc(a.datosEmpresa)}"></div>
      <div class="campo" style="margin-top:8px"><span class="lbl">Pie del presupuesto (condiciones, forma de pago)</span><textarea class="in" id="aPie" rows="3">${esc(a.pie)}</textarea></div>
      <div class="campo" style="margin-top:8px;max-width:200px"><span class="lbl">Validez por defecto (días)</span><input class="in" id="aVal" type="number" min="1" value="${a.validez}"></div>
      <button class="btn pri" style="margin-top:10px" onclick="guardarAjustes()">Guardar</button></div>
    <div class="panel"><h3>Motivos de no venta</h3>
      ${S.motivos.map((m, i) => `<div class="fila" style="padding:3px 0"><input class="in" value="${esc(m)}" style="max-width:260px" onchange="renombrarMotivo(${i},this.value)"><button class="btn chico rojo" onclick="borrarMotivo(${i})">✕</button></div>`).join('')}
      <div class="fila" style="margin-top:8px"><input class="in" id="motNuevo" placeholder="Nuevo motivo" style="max-width:260px" onkeydown="if(event.key==='Enter')agregarMotivoAjustes()"><button class="btn" onclick="agregarMotivoAjustes()">Agregar</button></div></div>
    <div class="panel"><h3>Reemplazos de códigos</h3>
      <div class="muted" style="font-size:12px;margin-bottom:8px">Cuando alguien cotiza el código de la izquierda, el cotizador ofrece el de la derecha. Se agregan solos al poner un reemplazo en un presupuesto.</div>
      <div style="max-height:260px;overflow:auto">${Object.keys(S.reemplazos).sort().map(v => `<div class="fila" style="padding:3px 0"><span class="num" style="min-width:110px">${esc(v)}</span>→<span class="num" style="min-width:110px;color:var(--amber)">${esc(S.reemplazos[v])}</span><span class="muted" style="font-size:12px;flex:1">${esc(infoArticulo(S.reemplazos[v]).desc)}</span><button class="btn chico rojo" data-v="${esc(v)}" onclick="borrarReemplazo(this.dataset.v)">✕</button></div>`).join('') || '<span class="muted">Todavía no hay reemplazos.</span>'}</div>
      <div class="fila" style="margin-top:8px"><input class="in" id="rViejo" placeholder="Código que piden" style="max-width:160px"> → <input class="in" id="rNuevo" placeholder="Código nuevo" style="max-width:160px" onkeydown="if(event.key==='Enter')agregarReemplazoAjustes()"><button class="btn" onclick="agregarReemplazoAjustes()">Agregar</button></div></div>
    <div class="panel"><h3>Equivalencias NEXPRO</h3><div class="muted">${fmt(Object.keys(S.nexpro).length, 0)} códigos Iveco con equivalente NEXPRO. Se actualizan al importar la lista de precios (hoja NEXPRO).</div></div>
  </div>
  <div class="panel" style="margin-top:14px"><div class="fila" style="justify-content:space-between"><h3 style="margin:0">Registro de cambios</h3><button class="btn" onclick="ir('historial')">Ver el historial completo</button></div></div>`);
};
function filaImport(txt, clave, fn) {
  return `<div class="fila" style="justify-content:space-between;padding:7px 0;border-bottom:1px solid #1c2740"><div><div>${txt}</div><div class="muted" style="font-size:12px">${S.archivos[clave] ? 'Último: ' + esc(S.archivos[clave]) : clave === 'clientesXls' ? S.clientes.length + ' clientes cargados' : 'Sin datos todavía'}</div></div>
    <label class="btn">Elegir Excel<input type="file" accept=".xlsx,.xls,.xlsm" style="display:none" onchange="${fn}(event)"></label></div>`;
}
async function guardarAjustes() {
  const a = { empresa: document.getElementById('aEmp').value.trim(), datosEmpresa: document.getElementById('aDat').value.trim(),
    pie: document.getElementById('aPie').value, validez: Math.max(1, parseInt(document.getElementById('aVal').value) || 7) };
  const r = await remoto({ tipo: 'guardarDocs', tabla: 'ajustes', docs: Object.keys(a).map(k => ({ id: k, valor: String(a[k]) })), reg: { tipo: 'Ajustes', detalle: 'Datos de la empresa y del presupuesto' } }, 'Guardando…');
  if (!r) return;
  Object.assign(S.ajustes, a); guardar('ajustes'); aviso('Ajustes guardados', 'ok');
}
function docsMotivos(l) { return l.map((m, i) => ({ id: m, orden: i + 1 })); }
async function guardarMotivos(nuevos, detalle) {
  const r = await remoto({ tipo: 'guardarDocs', tabla: 'motivos', reemplazarTodo: true, docs: docsMotivos(nuevos), reg: { tipo: 'Motivo', detalle } }, 'Guardando…');
  if (!r) { pintar(); return false; }
  S.motivos = nuevos; guardar('motivos'); pintar(); return true;
}
function renombrarMotivo(i, v) { v = v.trim(); if (!v || v === S.motivos[i]) return; const l = S.motivos.slice(); const ant = l[i]; l[i] = v; guardarMotivos(l, `${ant} → ${v}`); }
function borrarMotivo(i) { if (!confirm('¿Quitar “' + S.motivos[i] + '” de la lista? Los presupuestos que ya lo usan lo conservan.')) return; const l = S.motivos.slice(); const m = l.splice(i, 1)[0]; guardarMotivos(l, 'Quitado: ' + m); }
function agregarMotivoAjustes() { const v = document.getElementById('motNuevo').value.trim(); if (!v || S.motivos.some(m => normalizar(m) === normalizar(v))) return; guardarMotivos(S.motivos.concat([v]), 'Nuevo: ' + v); }
async function borrarReemplazo(v) {
  if (!confirm(`¿Borrar el reemplazo ${v} → ${S.reemplazos[v]}?`)) return;
  if (!await docBorrar('reemplazos', v, { tipo: 'Reemplazo', detalle: `Borrado ${v} → ${S.reemplazos[v]}` })) return;
  delete S.reemplazos[v]; guardar('reemplazos'); pintar();
}
async function agregarReemplazoAjustes() {
  const v = limpiarCodigo(document.getElementById('rViejo').value), n = limpiarCodigo(document.getElementById('rNuevo').value);
  if (v.length < 2 || n.length < 2 || v === n) { aviso('Poné los dos códigos', 'err'); return; }
  if (!await docGuardar('reemplazos', { id: v, nuevo: n }, { tipo: 'Reemplazo', detalle: `${v} → ${n}` })) return;
  S.reemplazos[v] = n; guardar('reemplazos'); pintar();
}

// --- lectura de Excel
function buscarEncabezado(rows, campos, obligatorio) {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const celdas = Array.from(rows[i] || [], normalizar); const col = {};
    for (const [n, alt] of Object.entries(campos)) { const idx = celdas.findIndex(c => alt.includes(c)); if (idx !== -1) col[n] = idx; }
    if (col[obligatorio] !== undefined && Object.keys(col).length >= 2) return { fila: i, col };
  }
  return null;
}
function leerExcel(ev, fn) {
  const f = ev.target.files[0]; if (!f) return; ev.target.value = '';
  aviso('Leyendo ' + f.name + '…');
  const rd = new FileReader();
  rd.onload = async e => { try { await fn(XLSX.read(new Uint8Array(e.target.result), { type: 'array' }), f.name); } catch (err) { aviso('Error al leer ' + f.name + ': ' + err.message, 'err'); } };
  rd.readAsArrayBuffer(f);
}
const filas = (wb, n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
// Hoja NEXPRO de la lista: PN genuino → equivalentes NEXPRO (código, descripción, precio USD, D, aplicación)
function leerNexpro(wb) {
  for (const h of wb.SheetNames) {
    const r = filas(wb, h);
    for (let i = 0; i < Math.min(r.length, 20); i++) {
      const cel = Array.from(r[i] || [], normalizar);
      const g = cel.indexOf('pn genuino'), n = cel.indexOf('pn nexpro');
      if (g < 0 || n < 0) continue;
      const pr = cel.findIndex(c => c.startsWith('precio de lista') && c.includes('nexpro'));
      const d = cel.lastIndexOf('codigo de descuento asociado');
      const det = cel.indexOf('detalle nexpro'), dsc = cel.indexOf('descripcion nexpro'), ap = cel.indexOf('aplicacion');
      const o = {};
      for (let k = i + 1; k < r.length; k++) {
        const gc = limpiarCodigo(r[k][g]), nc = limpiarCodigo(r[k][n]);
        if (gc.length < 2 || nc.length < 2) continue;
        (o[gc] = o[gc] || []).push([nc, String((det >= 0 && r[k][det]) || (dsc >= 0 && r[k][dsc]) || '').trim(), pr >= 0 ? parseFloat(r[k][pr]) || 0 : 0, d > n ? String(r[k][d]).trim() || '-' : '-', ap >= 0 ? String(r[k][ap]).trim() : '']);
      }
      return o;
    }
  }
  return null;
}
function impStock(ev) {
  leerExcel(ev, async (wb, nombre) => {
    const campos = { codigo: ['codigo', 'articulo', 'cod'], descripcion: ['descripcion', 'denominacion'], ubicacion: ['ubicacion', 'posicion'], stock: ['stock', 'cantidad', 'cant.', 'cant'] };
    const out = [];
    wb.SheetNames.forEach(h => { const r = filas(wb, h); const e = buscarEncabezado(r, campos, 'codigo'); if (!e) return; const c = e.col;
      for (let i = e.fila + 1; i < r.length; i++) { const cod = limpiarCodigo(r[i][c.codigo]); if (cod.length < 2) continue;
        out.push([cod, c.descripcion !== undefined ? String(r[i][c.descripcion]).trim() : '', c.stock !== undefined ? String(r[i][c.stock]).trim() : '-', c.ubicacion !== undefined ? (String(r[i][c.ubicacion]).trim() || '-') : '-']); } });
    if (!out.length) { aviso('No encontré un encabezado “Codigo” en ese archivo.', 'err'); return; }
    const r = await remoto({ tipo: 'subirDatos', tipoDatos: 'stock', archivo: nombre, contenido: JSON.stringify(out) }, `Subiendo stock (${fmt(out.length, 0)} artículos)…`, 120000);
    if (!r) return;
    const res = r.resultado || {};
    S.stock = out; S.ubicCambios = {}; if (res.meta) { S.metas.stock = res.meta.version; S.archivos.stock = nombre + ' · ' + (res.meta.fecha || ''); }
    guardar('stock', 'ubicCambios', 'metas', 'archivos'); indexarStock();
    abrirModal(`<h3 style="margin-top:0">Stock cargado y compartido</h3><p>${fmt(out.length, 0)} artículos de ${esc(nombre)}.</p>
      ${res.totalConflictos ? `<p><b>${res.totalConflictos} ubicaciones</b> cambiadas desde la última importación (en la app o en la planilla) se reemplazaron por las del Excel:</p><div class="muted" style="max-height:240px;overflow:auto;font-size:12px">${(res.conflictosUbicacion || []).map(x => `${esc(x.codigo)}: ${esc(x.app)} → Excel ${esc(x.excel)}`).join('<br>')}</div>` : ''}
      <button class="btn pri" onclick="cerrarModal()">Listo</button>`);
    pintar();
  });
}
function impPrecios(ev) {
  leerExcel(ev, async (wb, nombre) => {
    const campos = { codigo: ['catalogo'], precio: ['s/iva'], descuento: ['d'], desc: ['denominacion'] };
    const out = {}; const hojas = [];
    wb.SheetNames.forEach(h => { const r = filas(wb, h); const e = buscarEncabezado(r, campos, 'codigo'); if (!e || e.col.precio === undefined) return; hojas.push(h); const c = e.col;
      for (let i = e.fila + 1; i < r.length; i++) { const cod = limpiarCodigo(r[i][c.codigo]); if (cod.length < 2) continue;
        out[cod] = [parseFloat(r[i][c.precio]) || 0, c.desc !== undefined ? String(r[i][c.desc]).trim() : '', c.descuento !== undefined ? (String(r[i][c.descuento]).trim() || '-') : '-']; } });
    if (!hojas.length) { aviso('No encontré la hoja de precios (encabezados “Catálogo” y “s/IVA”).', 'err'); return; }
    const n = Object.keys(out).length;
    const r = await remoto({ tipo: 'subirDatos', tipoDatos: 'precios', archivo: nombre, contenido: JSON.stringify(out) }, `Subiendo lista de precios (${fmt(n, 0)} códigos)…`, 180000);
    if (!r) return;
    S.precios = out; if (r.resultado && r.resultado.meta) { S.metas.precios = r.resultado.meta.version; S.archivos.precios = nombre + ' · ' + (r.resultado.meta.fecha || ''); }
    guardar('precios', 'metas', 'archivos');
    const nx = leerNexpro(wb); let txtNx = '\nNo encontré la hoja NEXPRO: se mantienen las equivalencias anteriores.';
    if (nx) {
      const filasNx = []; Object.keys(nx).forEach(g => nx[g].forEach(x => filasNx.push([g, x[0], x[1], x[2], x[3], x[4]])));
      const r2 = await remoto({ tipo: 'subirDatos', tipoDatos: 'nexpro', archivo: nombre, contenido: JSON.stringify(filasNx) }, 'Subiendo equivalencias NEXPRO…', 60000);
      if (r2) { S.nexpro = nx; if (r2.resultado && r2.resultado.meta) S.metas.nexpro = r2.resultado.meta.version; guardar('nexpro', 'metas'); txtNx = `\nEquivalencias NEXPRO: ${fmt(Object.keys(nx).length, 0)} códigos.`; }
    }
    aviso(`Lista de precios cargada y compartida: ${fmt(n, 0)} códigos.` + txtNx + `\nLos presupuestos ya guardados no cambian.`, 'ok'); pintar();
  });
}
function impSobre(ev) {
  leerExcel(ev, async (wb, nombre) => {
    const campos = { codigo: ['codigo', 'articulo', 'cod'], cantidad: ['cant.', 'cant', 'cantidad', 'stock'], ubicacion: ['ubicacion', 'posicion'] };
    const items = [], omitidas = [];
    wb.SheetNames.forEach(h => {
      if (normalizar(h) === 'registro') return;
      const r = filas(wb, h); const e = buscarEncabezado(r, campos, 'codigo'); if (!e) { omitidas.push(h); return; }
      const c = e.col; const cajon = h.trim().toUpperCase();
      for (let i = e.fila + 1; i < r.length; i++) {
        const cod = limpiarCodigo(r[i][c.codigo]); if (cod.length < 2) continue;
        items.push({ CODIGO: cod, CANTIDAD: c.cantidad !== undefined ? (parseInt(r[i][c.cantidad]) || 0) : 0, UBICACION: c.ubicacion !== undefined ? (String(r[i][c.ubicacion]).trim() || '-') : '-', CAJON: cajon });
      }
    });
    if (!items.length) { aviso('No encontré un encabezado “Codigo” en ninguna hoja.', 'err'); return; }
    const r = await remoto({ tipo: 'importar', archivo: nombre, items }, 'Subiendo sobre stock…', 60000);
    if (!r) return;
    const res = r.resultado || {}; const cambios = (res.listaRepetidos || []).filter(x => x.cambio);
    abrirModal(`<h3 style="margin-top:0">Sobre stock importado</h3><p>${esc(nombre)}</p><ul><li>${res.agregados} artículos nuevos</li>${(res.cajonesNuevos || []).length ? `<li>${res.cajonesNuevos.length} cajones nuevos</li>` : ''}
      <li>${res.repetidos || 0} repetidos (ya estaban en el mismo cajón): ${(res.repetidos || 0) - (res.actualizados || 0)} sin diferencias, <b>${res.actualizados || 0} con diferencias → se tomó el Excel</b></li></ul>
      ${cambios.length ? `<div style="max-height:240px;overflow:auto;font-size:12px" class="muted">${cambios.map(x => `${esc(x.codigo)} (${esc(x.cajon)}): cant ${x.cantAnterior}→${x.cantNueva}` + (x.ubiAnterior !== x.ubiNueva ? `, ubic ${esc(x.ubiAnterior)}→${esc(x.ubiNueva)}` : '')).join('<br>')}</div>` : ''}
      ${omitidas.length ? `<p class="muted">Hojas omitidas (sin “Codigo”): ${omitidas.map(esc).join(', ')}</p>` : ''}<button class="btn pri" onclick="cerrarModal()">Listo</button>`);
    pintar();
  });
}
function impRepos(ev) {
  leerExcel(ev, async (wb, nombre) => {
    const o = {}; const hojas = [];
    wb.SheetNames.forEach(h => {
      const r = filas(wb, h); const e = buscarEncabezado(r, { codigo: ['catalogo', 'codigo'], mes: ['mes del cambio'], pvp: ['pvp'], pvc: ['pvc'] }, 'codigo');
      if (!e) return; hojas.push(h);
      for (let i = e.fila + 1; i < r.length; i++) { const c = limpiarCodigo(r[i][e.col.codigo]); if (c.length >= 2) o[c] = e.col.mes !== undefined ? String(r[i][e.col.mes]).trim() : ''; }
    });
    if (!hojas.length) { aviso('No encontré el encabezado “Catálogo” en ese archivo.', 'err'); return; }
    const r = await remoto({ tipo: 'subirDatos', tipoDatos: 'repos', archivo: nombre, contenido: JSON.stringify(Object.keys(o).map(c => [c, o[c]])) }, 'Subiendo reposicionados…', 90000);
    if (!r) return;
    S.reposicionado = o; if (r.resultado && r.resultado.meta) { S.metas.repos = r.resultado.meta.version; S.archivos.repos = nombre + ' · ' + (r.resultado.meta.fecha || ''); }
    guardar('reposicionado', 'metas', 'archivos');
    aviso(`Reposicionados cargados y compartidos: ${fmt(Object.keys(o).length, 0)} códigos.`, 'ok'); pintar();
  });
}
function impClientes(ev) {
  leerExcel(ev, async (wb, nombre) => {
    const campos = { nombre: ['cliente', 'razon social', 'nombre'], categoria: ['categoria'], d5: ['d5'], d6: ['d6'], d7: ['d7'], d8: ['d8'], d9: ['d9'], cuit: ['cuit'], localidad: ['localidad'],
      contacto: ['contacto', 'persona de contacto'], cumple: ['cumpleanos'], whatsapp: ['whatsapp', 'telefono'], pago: ['forma de pago'], notas: ['notas', 'observaciones'] };
    const docs = [];
    wb.SheetNames.forEach(h => {
      const r = filas(wb, h); const e = buscarEncabezado(r, campos, 'nombre'); if (!e) return; const c = e.col;
      for (let i = e.fila + 1; i < r.length; i++) {
        const v = k => c[k] !== undefined ? String(r[i][c[k]]).trim() : '';
        const nom = v('nombre').toUpperCase(); if (!nom) continue;
        const ya = S.clientes.find(x => normalizar(x.nombre) === normalizar(nom));
        const dd = k => v(k).replace(/%/g, '').replace(/\s*\/\s*/g, '/').replace(/^-$/, '');
        let cumple = v('cumple'); const m = cumple.match(/^(\d{1,2})\/(\d{1,2})/); if (m) cumple = '--' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
        docs.push({ id: ya ? ya.id : 'c' + uid(), nombre: nom, categoria: categoriaDeTexto(v('categoria')), d5: dd('d5'), d6: dd('d6'), d7: dd('d7'), d8: dd('d8'), d9: dd('d9'),
          cuit: v('cuit'), localidad: v('localidad'), contacto: v('contacto'), cumple, whatsapp: v('whatsapp'), pago: v('pago'), notas: v('notas') });
      }
    });
    if (!docs.length) { aviso('No encontré la columna “Cliente”.', 'err'); return; }
    const nuevos = docs.filter(d => !cliente(d.id)).length;
    if (!confirm(`${docs.length} clientes en el archivo: ${nuevos} nuevos y ${docs.length - nuevos} que ya existen (se actualizan sus datos y descuentos). ¿Seguir?`)) return;
    const r = await remoto({ tipo: 'guardarDocs', tabla: 'clientes', docs, reg: { tipo: 'Importar clientes', detalle: `${nombre}: ${nuevos} nuevos, ${docs.length - nuevos} actualizados` } }, 'Subiendo clientes…', 90000);
    if (!r) return;
    docs.forEach(d => { const c = docACliente(d); const i = S.clientes.findIndex(x => x.id === c.id); if (i >= 0) S.clientes[i] = c; else S.clientes.push(c); });
    S.archivos.clientesXls = nombre + ' · ' + fechaAR(hoyISO()); guardar('clientes', 'archivos');
    aviso(`Clientes cargados: ${nuevos} nuevos, ${docs.length - nuevos} actualizados.`, 'ok'); pintar();
  });
}
// --- exportaciones del depósito
function exportarStock() {
  const f = [['Codigo', 'Descripcion', 'Ubicacion', 'Stock']];
  S.stock.forEach(r => { const n = parseFloat(r[2]); f.push([valorCelda(r[0]), r[1], S.ubicCambios[r[0]] || r[3], isNaN(n) ? r[2] : n]); });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(f), 'Stock'); XLSX.writeFile(wb, 'Stock_deposito_' + hoyISO() + '.xlsx');
}
function exportarSobre() {
  const wb = XLSX.utils.book_new(); const usados = new Set();
  const nombreHoja = n => { let b = String(n).replace(/[\\\/\?\*\[\]:]/g, '-').slice(0, 31) || 'Hoja', x = b, i = 2; while (usados.has(x.toLowerCase())) { const s = ' (' + i++ + ')'; x = b.slice(0, 31 - s.length) + s; } usados.add(x.toLowerCase()); return x; };
  S.cajones.forEach(c => { const f = [[null, c], ['CANT.', 'CODIGO', 'UBICACIÓN']]; S.sobre.filter(x => x.cajon === c).forEach(x => f.push([x.cant, valorCelda(x.cod), x.ubic])); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(f), nombreHoja(c)); });
  const reg = [['Fecha', 'Tipo', 'Detalle', 'Nota']]; S.registro.filter(r => /sobre|caj/i.test(r.tipo)).forEach(r => reg.push([r.fecha, r.tipo, r.detalle, r.nota || '']));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reg), nombreHoja('REGISTRO'));
  XLSX.writeFile(wb, 'Sobre_stock_' + hoyISO() + '.xlsx');
}
function exportarHistorial() {
  const wb = XLSX.utils.book_new();
  const h = [['Fecha', 'Tipo', 'Detalle', 'Nota']]; S.registro.forEach(r => h.push([r.fecha, r.tipo, r.detalle, r.nota || '']));
  const n = [['Código', 'Descripción', 'Anotación', 'Fecha']]; Object.keys(S.notas).forEach(c => n.push([valorCelda(c), infoArticulo(c).desc, S.notas[c].texto, S.notas[c].fecha]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h), 'Historial'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(n), 'Anotaciones');
  XLSX.writeFile(wb, 'Historial_y_anotaciones_' + hoyISO() + '.xlsx');
}
async function borrarCopiaLocal() {
  if (!confirm('Se borra solo la copia guardada en este dispositivo (los datos de la planilla no se tocan) y se vuelve a bajar todo. ¿Seguir?')) return;
  await dbBorrarTodo(); location.reload();
}

// ============ Arranque ============
// Aviso discreto: numerito en el menú y un cartelito una sola vez por presupuesto que vence hoy
function pintarNumerito() {
  const n = S.presupuestos.filter(p => estadoPresu(p) === 'vencehoy').length;
  const b = document.querySelector('.nav[data-v=presupuestos]');
  let s = b.querySelector('.badge-nav');
  if (!n) { if (s) s.remove(); return; }
  if (!s) { s = document.createElement('span'); s.className = 'badge-nav'; b.appendChild(s); }
  s.textContent = n; s.title = n + ' presupuesto' + (n > 1 ? 's vencen' : ' vence') + ' hoy';
}
function avisarVencimientos() {
  pintarNumerito();
  const hoy = hoyISO(); let cambio = false;
  S.presupuestos.filter(p => estadoPresu(p) === 'vencehoy' && S.avisados[p.id] !== hoy).forEach(p => {
    aviso(`⏰ Hoy vence el presupuesto ${numPresu(p)} de ${p.clienteNombre}`); S.avisados[p.id] = hoy; cambio = true;
  });
  if (cambio) guardar('avisados');
}
(async function arrancar() {
  try {
    await abrirDB();
    const t = await dbLeerTodo();
    CLAVES.forEach(k => { if (t[k] !== undefined) S[k] = t[k]; });
    S.metas = S.metas || {};
    S.ajustes = { ...AJUSTES_BASE, ...S.ajustes };
    if (!S.motivos.length) S.motivos = MOTIVOS_BASE.slice();
    indexarStock(); indexarSobre(); pintarDolar();
    document.getElementById('carga').remove();
    estadoSync({ ok: null, msg: 'Conectando con Google…' });
    ir('inicio');
    await sincronizar();
    setInterval(() => sincronizar(), 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(); });
  } catch (e) {
    const c = document.getElementById('carga'); if (c) c.textContent = 'No se pudo iniciar: ' + e.message; else aviso('Error al iniciar: ' + e.message, 'err');
  }
})();
