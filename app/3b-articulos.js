// ============ Artículos propios (no son de Iveco) ============
// Viven en la hoja "Artículos propios" de la planilla. Ninguna importación los toca. Precio en pesos, sin IVA, lo ponen ellos.
function leerStock(v) {
  let t = String(v === undefined || v === null ? '' : v).trim();
  if (!t) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t.replace(',', '.'));
  return isNaN(n) ? null : n;
}
function docPropio(cod) { const p = S.propios[cod] || {}; return { id: cod, desc: p.desc || '', tipo: p.tipo || '', ubic: p.ubic || '', stock: p.stock === undefined ? null : p.stock, precio: p.precio === undefined ? null : p.precio, fecha: p.fecha || '' }; }
function aPropio(d) { return { desc: d.desc || '', tipo: d.tipo || '', ubic: d.ubic || '', stock: d.stock, precio: d.precio, fecha: d.fecha || '' }; }

// --- crear / editar uno
// opciones: { cant } viene del buscador del cotizador · { volverPegado } viene de la revisión del pegado rápido
let opcArticulo = {};
function formArticulo(doc, opciones) {
  opcArticulo = opciones || {};
  const nuevo = !S.propios[doc.id];
  const d = nuevo ? Object.assign({ desc: '', tipo: '', ubic: '', stock: null, precio: null }, doc) : docPropio(doc.id);
  const enIveco = doc.id && (S.precios[doc.id] || stockIdx.has(doc.id));
  abrirModal(`<h3 style="margin-top:0">${nuevo ? 'Crear artículo propio' : 'Editar artículo ' + esc(d.id)}</h3>
    ${nuevo && doc.id && !enIveco ? `<p class="muted" style="margin-top:0">El código <b>${esc(doc.id)}</b> no está en la lista Iveco, ni en el stock, ni en los artículos propios. Completá los datos y queda guardado para todos.</p>` : ''}
    ${enIveco ? `<div class="tag t-amber" style="white-space:normal;margin-bottom:8px">Ese código ya está en la lista o en el stock de Iveco: se va a usar el de Iveco.</div>` : ''}
    <div class="grid g2" style="gap:8px">
      <div class="campo"><span class="lbl">Código (con el sufijo, ej. LUB020-P-I)</span><input class="in" id="aCod" value="${esc(d.id || '')}" ${nuevo ? '' : 'disabled'}></div>
      <div class="campo"><span class="lbl">Tipo (PI / PN)</span><input class="in" id="aTipo" value="${esc(d.tipo)}" placeholder="opcional"></div>
      <div class="campo" style="grid-column:1/-1"><span class="lbl">Descripción</span><input class="in" id="aDesc" value="${esc(d.desc)}"></div>
      <div class="campo"><span class="lbl">Ubicación</span><input class="in" id="aUbic" value="${esc(d.ubic)}"></div>
      <div class="campo"><span class="lbl">Stock</span><input class="in" id="aStock" value="${d.stock === null || d.stock === '' ? '' : esc(d.stock)}"></div>
      <div class="campo" style="grid-column:1/-1"><span class="lbl">Precio en pesos, sin IVA (lo podés dejar vacío y ponerlo después)</span><input class="in" id="aPrecio" value="${d.precio ? fmt(d.precio) : ''}" placeholder="$ sin IVA" style="max-width:220px"></div>
    </div>
    <div class="fila" style="margin-top:14px;justify-content:flex-end">
      ${opcArticulo.cant && nuevo ? `<button class="btn" onclick="cerrarModal();agregarAlBorrador('${esc(doc.id)}',${Number(opcArticulo.cant) || 1})" title="Lo agrega al presupuesto sin guardarlo como artículo">Agregar sin crear (precio a mano)</button>` : ''}
      <button class="btn" onclick="${opcArticulo.volverPegado ? 'mostrarRevisionPegado()' : 'cerrarModal()'}">Cancelar</button>
      <button class="btn pri" onclick="guardarArticulo()">${opcArticulo.cant ? 'Guardar y agregar' : 'Guardar'}</button></div>`);
  setTimeout(() => { const e = document.getElementById(nuevo && !doc.id ? 'aCod' : 'aDesc'); if (e) e.focus(); }, 50);
}
async function guardarArticulo() {
  const cod = limpiarCodigo(document.getElementById('aCod').value);
  if (cod.length < 2) { aviso('Poné el código', 'err'); return; }
  const desc = document.getElementById('aDesc').value.trim().toUpperCase();
  if (!desc) { aviso('Poné la descripción', 'err'); return; }
  const pTxt = document.getElementById('aPrecio').value.trim();
  const doc = { id: cod, desc, tipo: document.getElementById('aTipo').value.trim().toUpperCase(), ubic: document.getElementById('aUbic').value.trim().toUpperCase(),
    stock: leerStock(document.getElementById('aStock').value), precio: pTxt ? leerPesos(pTxt) : null, fecha: hoyISO() };
  const era = !!S.propios[cod];
  if (!await docGuardar('articulos', doc, { tipo: 'Artículo propio', detalle: `${cod} ${era ? 'editado' : 'creado'}: ${desc}${doc.precio ? ' · ' + plata(doc.precio) : ' · sin precio'}` })) return;
  S.propios[cod] = aPropio(doc); guardar('propios');
  aviso(`Artículo ${cod} ${era ? 'actualizado' : 'creado'}`, 'ok');
  if (opcArticulo.volverPegado) { mostrarRevisionPegado(); return; }
  cerrarModal();
  if (opcArticulo.cant) agregarAlBorrador(cod, Number(opcArticulo.cant) || 1); else pintar();
}
async function guardarPrecioPropio(cod, precio) {
  if ((Number((S.propios[cod] || {}).precio) || 0) === (Number(precio) || 0)) return;
  const doc = Object.assign(docPropio(cod), { precio: precio || null, fecha: hoyISO() });
  if (!await docGuardar('articulos', doc, { tipo: 'Artículo propio', detalle: `${cod}: precio ${precio ? plata(precio) : 'vacío'}` })) { pintar(); return; }
  S.propios[cod] = aPropio(doc); guardar('propios');
  aviso(`Precio de ${cod} guardado: ${precio ? plata(precio) + ' + IVA' : 'sin precio'}`, 'ok');
  if (vista === 'articulos') pintarSeguro();
}
async function borrarArticulo(cod) {
  if (!confirm(`¿Borrar el artículo propio ${cod}? Los presupuestos que ya lo tienen lo conservan.`)) return;
  if (!await docBorrar('articulos', cod, { tipo: 'Artículo propio', detalle: `${cod} borrado (${(S.propios[cod] || {}).desc || ''})` })) return;
  delete S.propios[cod]; guardar('propios'); pintar();
}

// --- carga masiva pegando filas del Excel: código | descripción | PI | ubicación | stock | (importe: no se toma)
let masivo = [];
function formMasivo() {
  abrirModal(`<h3 style="margin-top:0">Cargar varios artículos propios</h3>
    <p class="muted" style="margin-top:0">Copiá las filas en el Excel y pegalas acá, con las columnas en este orden: <b>código · descripción · PI/PN · ubicación · stock</b>. La columna del importe no se toma: el precio lo ponés vos después (queda el lugar vacío).</p>
    <textarea class="in" id="txtMasivo" rows="10" placeholder="LUB020-P-I	ACEITE DIFERENCIAL 85W140	PI	TALLER	442"></textarea>
    <div class="fila" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn pri" onclick="leerMasivo()">Revisar →</button></div>`, true);
  setTimeout(() => { const e = document.getElementById('txtMasivo'); if (e) e.focus(); }, 50);
}
function leerMasivo() {
  const filas = document.getElementById('txtMasivo').value.split(/\r?\n/).filter(f => f.trim());
  masivo = filas.map(f => {
    const c = f.split('\t').map(x => x.trim());
    return { id: limpiarCodigo(c[0]), desc: String(c[1] || '').toUpperCase(), tipo: String(c[2] || '').toUpperCase(), ubic: String(c[3] || '').toUpperCase(), stock: leerStock(c[4]), precio: '' };
  }).filter(r => r.id && !/^(CODIGO|CÓDIGO|COD)$/i.test(r.id));
  if (!masivo.length) { aviso('No encontré filas. Copiá las celdas del Excel (con tabulaciones) y pegalas.', 'err'); return; }
  pintarMasivo();
}
function pintarMasivo() {
  const vistos = {};
  masivo.forEach(r => { vistos[r.id] = (vistos[r.id] || 0) + 1; });
  const estado = r => !r.id ? '<span class="tag t-red">sin código</span>'
    : vistos[r.id] > 1 ? '<span class="tag t-red">repetido</span>'
    : (S.precios[r.id] || stockIdx.has(r.id)) ? '<span class="tag t-amber" title="Se va a usar el de Iveco al cotizar">está en Iveco</span>'
    : S.propios[r.id] ? '<span class="tag t-gris" title="Se actualizan los datos; si el precio queda vacío se mantiene el que tenía">ya existe: se actualiza</span>'
    : '<span class="tag t-green">nuevo</span>';
  const inp = (i, k, w, extra) => `<input class="in" style="width:${w};padding:4px 6px;font-size:12px" value="${esc(masivo[i][k] === null ? '' : masivo[i][k])}" onchange="masivo[${i}].${k}=${k === 'stock' ? 'leerStock(this.value)' : k === 'id' ? 'limpiarCodigo(this.value)' : 'this.value.toUpperCase()'};${k === 'id' ? 'pintarMasivo()' : ''}" ${extra || ''}>`;
  abrirModal(`<h3 style="margin-top:0">Revisá antes de guardar · ${masivo.length} artículos</h3>
    <p class="muted" style="margin-top:0">Todo se puede corregir acá. El precio es opcional (en pesos, sin IVA).</p>
    <div style="max-height:52vh;overflow:auto"><table class="t"><tr><th>Código</th><th>Descripción</th><th>Tipo</th><th>Ubicación</th><th class="der">Stock</th><th class="der">Precio $</th><th></th><th></th></tr>
    ${masivo.map((r, i) => `<tr><td>${inp(i, 'id', '112px')}</td><td>${inp(i, 'desc', '210px')}</td><td>${inp(i, 'tipo', '42px')}</td><td>${inp(i, 'ubic', '78px')}</td>
      <td class="der">${inp(i, 'stock', '58px', 'style="text-align:right"')}</td>
      <td class="der"><input class="in" style="width:86px;padding:4px 6px;font-size:12px;text-align:right" placeholder="vacío" value="${r.precio ? fmt(r.precio) : ''}" onchange="masivo[${i}].precio=this.value.trim()?leerPesos(this.value):''"></td>
      <td>${estado(r)}</td><td><button class="btn chico rojo" title="Sacar esta fila" onclick="masivo.splice(${i},1);pintarMasivo()">✕</button></td></tr>`).join('')}</table></div>
    <div class="fila" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="formMasivo()">← Volver a pegar</button><button class="btn" onclick="cerrarModal()">Cancelar</button>
      <button class="btn pri" onclick="guardarMasivo()">Guardar ${masivo.length} artículos</button></div>`, true);
}
async function guardarMasivo() {
  const vistos = {}; masivo.forEach(r => { vistos[r.id] = (vistos[r.id] || 0) + 1; });
  if (masivo.some(r => !r.id)) { aviso('Hay filas sin código', 'err'); return; }
  const rep = Object.keys(vistos).filter(k => vistos[k] > 1);
  if (rep.length) { aviso('Códigos repetidos: ' + rep.join(', ') + '. Dejá uno solo.', 'err'); return; }
  if (masivo.some(r => !r.desc) && !confirm('Hay artículos sin descripción. ¿Guardar igual?')) return;
  const hoy = hoyISO();
  const docs = masivo.map(r => { const d = { id: r.id, desc: r.desc, tipo: r.tipo, ubic: r.ubic, stock: r.stock, fecha: hoy }; if (r.precio) d.precio = r.precio; else if (!S.propios[r.id]) d.precio = null; return d; });
  const nuevos = docs.filter(d => !S.propios[d.id]).length;
  const res = await remoto({ tipo: 'guardarDocs', tabla: 'articulos', fusionar: true, docs, reg: { tipo: 'Artículo propio', detalle: `Carga masiva: ${nuevos} nuevos, ${docs.length - nuevos} actualizados` } }, `Guardando ${docs.length} artículos…`, 90000);
  if (!res) return;
  docs.forEach(d => { S.propios[d.id] = aPropio(Object.assign(docPropio(d.id), d)); });
  guardar('propios'); cerrarModal(); masivo = [];
  aviso(`${docs.length} artículos guardados (${nuevos} nuevos)`, 'ok');
  if (vista === 'articulos') pintar(); else ir('articulos');
}

// --- vista: lista de artículos propios
let qArt = '', soloSinPrecio = false;
VISTAS.articulos = function () {
  const todos = Object.keys(S.propios).sort();
  const sinPrecio = todos.filter(c => !Number(S.propios[c].precio)).length;
  const q = normalizar(qArt);
  const vis = todos.filter(c => (!soloSinPrecio || !Number(S.propios[c].precio)) && (!q || normalizar(c + ' ' + S.propios[c].desc + ' ' + S.propios[c].ubic).includes(q)));
  main(`<div class="cab"><div><h1>Artículos propios</h1><p>Artículos que no son de Iveco. Precio en pesos, sin IVA, lo ponen ustedes. Las importaciones de stock y de lista Iveco no los tocan.</p></div>
    <div class="fila"><button class="btn" onclick="formMasivo()">Pegar varios desde Excel</button><button class="btn pri" onclick="formArticulo({id:''})">＋ Nuevo artículo</button></div></div>
  <div class="fila" style="margin-bottom:12px">
    <button class="chip ${!soloSinPrecio ? 'on' : ''}" onclick="soloSinPrecio=false;pintar()">Todos <b>${todos.length}</b></button>
    <button class="chip ${soloSinPrecio ? 'on' : ''}" onclick="soloSinPrecio=true;pintar()" ${sinPrecio ? 'style="border-color:var(--amber)"' : ''}>Sin precio <b>${sinPrecio}</b></button>
    <input class="in" id="qArt" placeholder="Buscar código, descripción o ubicación…" style="max-width:300px;margin-left:auto" value="${esc(qArt)}" oninput="qArt=this.value;clearTimeout(window._ta);window._ta=setTimeout(()=>{pintar();const e=document.getElementById('qArt');e.focus();e.setSelectionRange(e.value.length,e.value.length)},250)"></div>
  <div class="panel tabla-scroll">${vis.length ? `<table class="t"><tr><th>Código</th><th>Descripción</th><th>Tipo</th><th>Ubicación</th><th class="der">Stock</th><th class="der">Precio $ sin IVA</th><th>Actualizado</th><th></th></tr>
    ${vis.slice(0, 400).map(c => { const p = S.propios[c]; return `<tr><td class="num" style="color:var(--amber)">${esc(c)}</td><td>${esc(p.desc)}</td><td>${esc(p.tipo)}</td><td>${esc(p.ubic)}</td>
      <td class="der num">${p.stock === null || p.stock === '' || p.stock === undefined ? '—' : fmt(p.stock, 0)}</td>
      <td class="der"><input class="in" style="width:120px;text-align:right;${Number(p.precio) ? '' : 'border-color:var(--amber)'}" placeholder="poner precio" value="${Number(p.precio) ? fmt(p.precio) : ''}" data-c="${esc(c)}" onchange="guardarPrecioPropio(this.dataset.c, this.value.trim() ? leerPesos(this.value) : null)"></td>
      <td class="muted" style="font-size:12px">${esc(fechaAR(p.fecha))}</td>
      <td><div class="fila" style="gap:4px;flex-wrap:nowrap"><button class="btn chico" data-c="${esc(c)}" onclick="formArticulo({id:this.dataset.c})">✎</button><button class="btn chico rojo" data-c="${esc(c)}" onclick="borrarArticulo(this.dataset.c)">✕</button></div></td></tr>`; }).join('')}</table>
    ${vis.length > 400 ? `<div class="muted" style="margin-top:8px">Mostrando 400 de ${vis.length}. Usá el buscador.</div>` : ''}`
    : `<div class="vacio">${todos.length ? 'Nada coincide con la búsqueda.' : 'Todavía no hay artículos propios. Cargalos de a uno con “＋ Nuevo artículo” o varios de una con “Pegar varios desde Excel”.'}</div>`}</div>`);
};

// ============ Presupuesto rápido: pegar códigos y cantidades ============
let pegado = [];
function formPegar() {
  abrirModal(`<h3 style="margin-top:0">Pegar códigos y cantidades</h3>
    <p class="muted" style="margin-top:0">Una línea por artículo: <b>código y cantidad</b>, en cualquier orden, separados por espacio o tabulación (podés copiar dos columnas del Excel, de un mail o de WhatsApp). Si no ponés cantidad, va 1.</p>
    <textarea class="in" id="txtPegar" rows="12" placeholder="2992544 12&#10;500041178	40&#10;LUB020-P-I 2"></textarea>
    <div class="fila" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn pri" onclick="leerPegado()">Revisar →</button></div>`);
  setTimeout(() => { const e = document.getElementById('txtPegar'); if (e) e.focus(); }, 50);
}
function leerLineaPegada(f) {
  const t = f.split(/[\t;]|\s+/).map(x => x.trim()).filter(Boolean);
  const esCant = x => /^\d{1,5}([.,]\d+)?$/.test(x);
  let iCod = t.findIndex(x => existeArticulo(limpiarCodigo(x)));
  if (iCod < 0) iCod = t.findIndex(x => !esCant(x) && /\d/.test(x));
  if (iCod < 0) iCod = t.findIndex(x => x.replace(/\D/g, '').length >= 6);
  if (iCod < 0) return null;
  const iCant = t.findIndex((x, i) => i !== iCod && esCant(x));
  const cant = iCant >= 0 ? Math.max(1, Math.round(parseFloat(t[iCant].replace(',', '.')))) : 1;
  return { cod: limpiarCodigo(t[iCod]), cant };
}
function leerPegado() {
  const lineas = document.getElementById('txtPegar').value.split(/\r?\n/).filter(f => f.trim());
  const malas = [];
  pegado = [];
  lineas.forEach(f => { const r = leerLineaPegada(f); if (r) pegado.push(r); else malas.push(f.trim()); });
  if (!pegado.length) { aviso('No encontré códigos en lo que pegaste.', 'err'); return; }
  if (malas.length) aviso(`No se entendieron ${malas.length} líneas: ${malas.slice(0, 5).join(' · ')}`, '');
  mostrarRevisionPegado();
}
function mostrarRevisionPegado() {
  const b = B(); const cli = cliente(b.clienteId);
  const cuenta = {}; pegado.forEach(r => { cuenta[r.cod] = (cuenta[r.cod] || 0) + 1; });
  let total = 0, faltan = 0;
  const filas = pegado.map((r, i) => {
    const a = infoArticulo(r.cod); const existe = existeArticulo(r.cod);
    const lista = a.propio ? a.precioArs : a.usd * b.dolar;
    const desc = a.propio ? 0 : descCliente(cli, a.D).pct;
    const unit = r2(lista * (1 - desc / 100)); if (existe) total += unit * r.cant; else faltan++;
    const reemp = S.reemplazos[r.cod];
    return `<tr><td><input class="in" style="width:130px;padding:4px 6px" value="${esc(r.cod)}" onchange="pegado[${i}].cod=limpiarCodigo(this.value);delete pegado[${i}].reemplazaA;mostrarRevisionPegado()">
        ${r.reemplazaA ? `<div style="font-size:11px" class="muted">reemplaza a ${esc(r.reemplazaA)}</div>` : ''}</td>
      <td style="font-size:13px">${existe ? esc(a.desc) : '<span class="tag t-red">No existe</span> <button class="btn chico azul" onclick="formArticulo({id:pegado[' + i + '].cod},{volverPegado:true})">＋ Crear</button>'}
        ${a.propio ? ' <span class="tag t-violet">propio</span>' : ''}${cuenta[r.cod] > 1 ? ' <span class="tag t-amber">repetido: se suman</span>' : ''}
        ${reemp && !r.reemplazaA ? `<div><span class="tag t-amber">Tiene reemplazo: ${esc(reemp)}</span> <button class="btn chico azul" onclick="pegado[${i}].reemplazaA=pegado[${i}].cod;pegado[${i}].cod='${esc(reemp)}';mostrarRevisionPegado()">Usar</button></div>` : ''}</td>
      <td class="der"><input class="in" type="number" min="1" style="width:70px;text-align:right;padding:4px 6px" value="${r.cant}" onchange="pegado[${i}].cant=Math.max(1,parseInt(this.value)||1);mostrarRevisionPegado()"></td>
      <td class="der num">${existe ? (lista ? plata(unit) : '<span class="muted">sin precio</span>') : ''}${desc ? ` <span class="muted" style="font-size:11px">(-${desc}%)</span>` : ''}</td>
      <td class="der num" style="font-size:12px">${existe ? (a.stock !== null ? esc(a.stock) : '<span class="muted">—</span>') : ''}</td>
      <td><button class="btn chico rojo" title="Sacar" onclick="pegado.splice(${i},1);mostrarRevisionPegado()">✕</button></td></tr>`;
  }).join('');
  const listos = pegado.filter(r => existeArticulo(r.cod)).length;
  abrirModal(`<h3 style="margin-top:0">Revisá antes de agregar · ${pegado.length} renglones</h3>
    <p class="muted" style="margin-top:0">${cli ? 'Precios con el descuento de ' + esc(cli.nombre) : 'Sin cliente elegido: precios de lista'}, sin IVA. Podés corregir códigos y cantidades.</p>
    <div style="max-height:52vh;overflow:auto"><table class="t"><tr><th>Código</th><th>Descripción</th><th class="der">Cant</th><th class="der">Unitario</th><th class="der">Stock</th><th></th></tr>${filas}</table></div>
    <div class="fila" style="margin-top:10px;justify-content:space-between">
      <div class="muted">Total aprox.: <b>${plata(total)}</b> + IVA${faltan ? ` · <span style="color:var(--red)">${faltan} no existen</span>` : ''}</div>
      ${faltan ? `<label style="font-size:13px;cursor:pointer"><input type="checkbox" id="pegarTodos"> Agregar también los que no existen (precio a mano)</label>` : ''}</div>
    <div class="fila" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="formPegar()">← Volver a pegar</button><button class="btn" onclick="cerrarModal()">Cancelar</button>
      <button class="btn pri" onclick="agregarPegado()">Agregar al presupuesto</button></div>`, true);
}
function agregarPegado() {
  const todos = document.getElementById('pegarTodos') && document.getElementById('pegarTodos').checked;
  const b = B(); let n = 0, salteados = 0;
  pegado.forEach(r => {
    if (!existeArticulo(r.cod) && !todos) { salteados++; return; }
    const yaEstaba = b.items.some(x => x.cod === r.cod || baseDe(x).cod === r.cod || x.reemplazaA === r.cod);
    agregarSinPintar(r.cod, r.cant); n++;
    // la marca "reemplaza a" solo en un renglón nuevo (si se sumó a uno que ya estaba, no se cambia)
    if (r.reemplazaA && !yaEstaba) { const l = b.items.find(x => x.cod === r.cod || baseDe(x).cod === r.cod); if (l && !l.reemplazaA) l.reemplazaA = r.reemplazaA; }
  });
  guardar('borrador'); cerrarModal(); pegado = []; pintar();
  aviso(`${n} artículos agregados al presupuesto` + (salteados ? ` · ${salteados} sin agregar porque no existen` : ''), salteados ? '' : 'ok');
}
