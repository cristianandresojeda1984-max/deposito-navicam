// ============ Inicio ============
VISTAS.inicio = function () {
  const sg = seguimiento();
  const recientes = [...S.presupuestos].sort((a, b) => b.creado - a.creado).slice(0, 6);
  const hoy = new Date(); const mes = hoy.getMonth() + 1;
  const ev = eventosDelMes(hoy.getFullYear(), mes);
  const nRepos = Object.keys(S.reposicionado).length;
  const tarjeta = (k, titulo, color, txt) => `<div class="panel kpi click-kpi" onclick="filtroPresu='${k}';ir('presupuestos')" style="cursor:pointer${sg[k].lista.length && color ? ';border-color:' + color : ''}"><small>${titulo}</small><b>${sg[k].lista.length}</b><span>${masIva0(sg[k].monto)}${txt ? ' · ' + txt : ''}</span></div>`;
  main(`
  <div class="cab"><div><h1>Inicio</h1><p>${hoy.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
    <div class="acciones"><button class="btn pri" onclick="nuevoPresupuesto()">＋ Nuevo presupuesto</button></div></div>
  <div class="muted" style="margin-bottom:8px;font-weight:600">Seguimiento de presupuestos</div>
  <div class="grid g4">
    ${tarjeta('vigentes', 'Presupuestos vigentes', '', 'dentro de la validez')}
    ${tarjeta('vencehoy', 'Vencen hoy', 'var(--amber)', 'último día')}
    ${tarjeta('vencidos', 'Vencidos sin respuesta', '', '')}
    ${tarjeta('ventas', 'Ventas por presupuesto', 'var(--green)', 'vendido')}
  </div>
  <div class="split" style="margin-top:14px">
    <div class="panel"><h3>Presupuestos recientes</h3>
      ${recientes.length ? `<div class="tabla-scroll"><table class="t"><tr><th>N.º</th><th>Cliente</th><th>Fecha</th><th class="der">Ítems</th><th class="der">Total</th><th>Estado</th></tr>
      ${recientes.map(p => `<tr class="click" onclick="ir('presupuestos',{sel:'${p.id}'})"><td class="num">${numPresu(p)}</td><td>${esc(p.clienteNombre)}</td><td>${fechaAR(p.fecha)}</td><td class="der">${p.items.length}</td><td class="der num">${masIva(montoPresu(p))}</td><td>${chipEstado(p)}</td></tr>`).join('')}</table></div>`
      : '<div class="vacio">Todavía no hay presupuestos. Empezá con “Nuevo presupuesto”.</div>'}
    </div>
    <div class="grid">
      <div class="panel"><div class="fila" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Agenda de ${MESES[mes - 1]}</h3><button class="btn chico" onclick="formAgenda()">＋</button></div>
        ${ev.length ? ev.map(e => filaEvento(e, mes)).join('') : '<div class="muted">Nada anotado para este mes.</div>'}
      </div>
      <div class="panel"><h3>Datos cargados</h3>
        <div class="fila" style="padding:3px 0"><span class="tag t-gris">${fmt(S.stock.length, 0)}</span><span class="muted">artículos en stock${S.archivos.stock ? ' · ' + esc(S.archivos.stock) : ''}</span></div>
        <div class="fila" style="padding:3px 0"><span class="tag t-gris">${fmt(Object.keys(S.precios).length, 0)}</span><span class="muted">códigos en la lista de precios${S.archivos.precios ? ' · ' + esc(S.archivos.precios) : ''}</span></div>
        <div class="fila" style="padding:3px 0"><span class="tag t-amber">${fmt(nRepos, 0)}</span><span class="muted">códigos con precio reposicionado</span></div>
        <div class="fila" style="padding:3px 0"><span class="tag t-gris">${fmt(S.sobre.length, 0)}</span><span class="muted">artículos de sobre stock en ${S.cajones.length} cajones</span></div>
        <div class="fila" style="padding:3px 0"><span class="tag t-gris">${S.clientes.length}</span><span class="muted">clientes con su escala de descuentos</span></div>
      </div>
    </div>
  </div>`);
};
function mesCumple(c) { const p = String(c || '').split('-'); return p.length >= 2 ? Number(p[p.length - 2]) : 0; }
function diaCumple(c) { const p = String(c || '').split('-'); return p.length >= 2 ? Number(p[p.length - 1]) : 0; }

// ============ Depósito ============
let qDeposito = '';
VISTAS.deposito = function () {
  main(`<div class="cab"><div><h1>Depósito</h1><p>Buscá por código, descripción o ubicación. Stock, precio, sobre stock y anotaciones.</p></div></div>
    <input class="in" id="qDep" placeholder="🔍 Código, descripción o ubicación…" value="${esc(qDeposito)}" oninput="qDeposito=this.value;listaDeposito()" style="font-size:16px;padding:12px 14px;margin-bottom:14px">
    <div id="listaDep"></div>`);
  document.getElementById('qDep').focus();
  listaDeposito();
};
function listaDeposito() {
  const q = normalizar(qDeposito);
  const el = document.getElementById('listaDep');
  if (q.length < 2) { el.innerHTML = '<div class="vacio">Escribí al menos 2 letras o números.</div>'; return; }
  let cods = [];
  const palabras = q.split(/\s+/);
  for (const r of S.stock) {
    const ub = normalizar(S.ubicCambios[r[0]] || r[3]);
    const t = normalizar(r[0]) + ' ' + normalizar(r[1]) + ' ' + ub;
    if (palabras.every(p => t.includes(p))) cods.push(r[0]);
    if (cods.length > 60) break;
  }
  if (cods.length < 10) buscarArticulos(qDeposito, 30).forEach(c => { if (!cods.includes(c)) cods.push(c); });
  if (!cods.length) { el.innerHTML = '<div class="vacio">Sin resultados.</div>'; return; }
  const total = cods.length; cods = cods.slice(0, 30);
  el.innerHTML = (total > 30 ? `<div class="muted" style="margin-bottom:8px">Mostrando 30 de ${total}+ resultados.</div>` : '') + cods.map(tarjetaArticulo).join('');
}
function tarjetaArticulo(cod) {
  const a = infoArticulo(cod);
  const nota = S.notas[cod] || { texto: '', fecha: '' };
  const idc = esc(cod).replace(/[^A-Za-z0-9]/g, '_');
  return `<div class="tarj">
    <div class="t1"><div class="fila"><span class="cod">${esc(cod)}</span>${a.D ? `<span class="tag t-gris">D ${esc(a.D)}</span>` : ''}${etiquetasArticulo(a)}</div>
      <div class="fila"><button class="btn chico azul" onclick="agregarAlBorrador('${esc(cod)}')">＋ Al presupuesto</button></div></div>
    <div class="desc">${esc(a.desc || '(sin descripción)')}</div>
    <div class="mini">
      <div><small>Stock depósito</small><b>${a.stock === null ? '—' : esc(a.stock)}</b></div>
      <div><small>Ubicación</small><b>${esc(a.ubic || '—')}</b></div>
      <div><small>Precio lista (USD ${fmt(a.usd)})</small><b class="num">${a.usd ? masIva(a.usd * S.dolar) : 'Consultar'}</b></div>
      <div><small>Sobre stock</small><b>${a.sobre ? a.sobre + ' u.' : '—'}</b>${a.sobreDet.map(x => `<div class="muted" style="font-size:11px">${esc(x.cajon)} · ${x.cant} u.</div>`).join('')}</div>
    </div>
    ${a.stock !== null ? `<div class="fila" style="margin-top:10px"><span class="muted">Cambiar ubicación:</span><input class="in" id="ub_${idc}" value="${esc(a.ubic)}" style="max-width:150px">
      <input class="in" id="nu_${idc}" placeholder="Nota del cambio (opcional)" style="flex:1;min-width:180px" onkeydown="if(event.key==='Enter')cambiarUbicacion('${esc(cod)}','ub_${idc}','nu_${idc}')"><button class="btn chico" onclick="cambiarUbicacion('${esc(cod)}','ub_${idc}','nu_${idc}')">Guardar</button></div>` : ''}
    <div style="margin-top:10px"><span class="lbl">Anotación ${nota.fecha ? '· ' + esc(nota.fecha) : ''}</span><textarea class="in" rows="2" placeholder="Agregar nota…" onchange="guardarNota('${esc(cod)}',this.value)">${esc(nota.texto)}</textarea></div>
  </div>`;
}
function etiquetasArticulo(a) {
  let s = '';
  if (a.repos) s += `<span class="tag t-amber" title="Mes del cambio: ${esc(a.reposMes)}">Reposicionado${a.reposMes ? ' · ' + esc(a.reposMes) : ''}</span>`;
  if (!a.enLista) s += `<span class="tag t-red">No está en la lista</span>`;
  return s;
}
async function cambiarUbicacion(cod, idInput, idNota) {
  const v = document.getElementById(idInput).value.trim().toUpperCase();
  const nota = idNota ? document.getElementById(idNota).value.trim() : '';
  const st = stockIdx.get(cod); if (!st || !v) return;
  const ant = S.ubicCambios[cod] || st[3];
  if (v === ant) { aviso('La ubicación es la misma'); return; }
  const r = await remoto({ tipo: 'cambiarUbicacion', codigo: cod, anterior: ant, nueva: v, nota }, 'Guardando ubicación…');
  if (!r) return;
  aviso('Ubicación guardada en todos los dispositivos', 'ok'); listaDeposito();
}
async function guardarNota(cod, texto) {
  texto = String(texto || '');
  if (!texto.trim()) {
    if (!S.notas[cod]) return;
    if (await docBorrar('notas', cod, { tipo: 'Anotación', detalle: 'Borrada la nota de ' + cod })) { delete S.notas[cod]; guardar('notas'); }
    return;
  }
  const n = { texto, fecha: ahoraTxt(), ts: Date.now() };
  if (await docGuardar('notas', { id: cod, ...n }, { tipo: 'Anotación', detalle: cod + ': ' + texto.slice(0, 120) })) { S.notas[cod] = n; guardar('notas'); aviso('Anotación guardada', 'ok'); }
}

// ============ Sobre stock ============
let cajonSel = '', qSobre = '';
VISTAS.sobre = function () {
  main(`<div class="cab"><div><h1>Sobre stock</h1><p>${S.sobre.length} artículos en ${S.cajones.length} cajones</p></div>
    <div class="acciones"><button class="btn" onclick="formCajon()">＋ Nuevo cajón</button><button class="btn pri" onclick="formArticuloSobre()">＋ Agregar artículo</button>
    <button class="btn" onclick="exportarSobre()">⬇ Exportar Excel</button></div></div>
    <input class="in" placeholder="🔍 Buscar código, ubicación o cajón…" value="${esc(qSobre)}" oninput="qSobre=this.value;listaSobre()" style="margin-bottom:14px">
    <div id="listaSobre"></div>`);
  listaSobre();
};
function listaSobre() {
  const el = document.getElementById('listaSobre'); const q = normalizar(qSobre);
  if (!q && !cajonSel) {
    el.innerHTML = `<div class="grid g4">${S.cajones.map(c => {
      const it = S.sobre.filter(x => x.cajon === c);
      return `<div class="panel cajon" onclick="cajonSel=this.dataset.c;listaSobre()" data-c="${esc(c)}"><b>${esc(c)}</b><div class="muted">${it.length} art. · ${it.reduce((a, x) => a + x.cant, 0)} u.</div>
      ${!it.length ? `<button class="btn chico rojo" style="margin-top:8px" onclick="event.stopPropagation();eliminarCajon(this.closest('.cajon').dataset.c)">Eliminar cajón vacío</button>` : ''}</div>`;
    }).join('')}</div>` || '<div class="vacio">No hay cajones.</div>';
    return;
  }
  let it = S.sobre;
  if (cajonSel) it = it.filter(x => x.cajon === cajonSel);
  if (q) it = it.filter(x => normalizar(x.cod + ' ' + x.ubic + ' ' + x.cajon).includes(q));
  el.innerHTML = `<div class="fila" style="margin-bottom:10px"><button class="btn chico" onclick="cajonSel='';qSobre='';ir('sobre')">← Todos los cajones</button>${cajonSel ? `<span class="chip on">${esc(cajonSel)}</span>` : ''}</div>
  <div class="panel tabla-scroll">${it.length ? `<table class="t"><tr><th>Código</th><th>Descripción</th><th>Cajón</th><th>Ubicación</th><th class="der">Cantidad</th><th>Nota del cambio (opcional)</th><th></th></tr>
  ${it.slice(0, 200).map(x => `<tr><td class="num" style="color:var(--amber)">${esc(x.cod)}</td><td>${esc(infoArticulo(x.cod).desc)}</td><td>${esc(x.cajon)}</td>
    <td><input class="in" id="su_${x.id}" value="${esc(x.ubic)}" style="width:100px"></td>
    <td class="der"><input class="in" id="sc_${x.id}" type="number" value="${x.cant}" style="width:76px;text-align:right"></td>
    <td><input class="in" id="sn_${x.id}" placeholder="Ej: conté de nuevo" style="min-width:160px" onkeydown="if(event.key==='Enter')guardarSobreFila('${x.id}')"></td>
    <td class="der" style="white-space:nowrap"><button class="btn chico" onclick="guardarSobreFila('${x.id}')">Guardar</button> <button class="btn chico rojo" onclick="eliminarSobre('${x.id}')">🗑</button></td></tr>`).join('')}</table>` : '<div class="vacio">Sin artículos.</div>'}</div>`;
}
function formCajon() {
  const n = S.cajones.length + 1;
  abrirModal(`<h3 style="margin-top:0">Nuevo cajón</h3><div class="fila"><input class="in" id="nomCajon" value="CAJON SOBRE STOCK ${n}" autofocus style="max-width:320px">
    <button class="btn pri" onclick="crearCajon()">Crear</button><button class="btn" onclick="cerrarModal()">Cancelar</button></div>`);
}
async function crearCajon() {
  const n = document.getElementById('nomCajon').value.trim().toUpperCase();
  if (!n) return; if (S.cajones.includes(n)) { aviso('Ese cajón ya existe', 'err'); return; }
  if (!await remoto({ tipo: 'nuevoCajon', nombre: n }, 'Creando cajón…')) return;
  cerrarModal(); cajonSel = n; ir('sobre');
}
async function eliminarCajon(n) {
  if (S.sobre.some(x => x.cajon === n)) return;
  if (!confirm('¿Eliminar el cajón ' + n + '?')) return;
  if (await remoto({ tipo: 'eliminarCajon', nombre: n }, 'Eliminando cajón…')) ir('sobre');
}
function formArticuloSobre() {
  abrirModal(`<h3 style="margin-top:0">Agregar artículo al sobre stock</h3>
    <div class="grid g2"><div class="campo"><span class="lbl">Código</span><input class="in" id="sCod" autofocus oninput="document.getElementById('sDesc').textContent=infoArticulo(limpiarCodigo(this.value)).desc||''"><small id="sDesc" class="muted" style="margin-top:4px"></small></div>
    <div class="campo"><span class="lbl">Cantidad</span><input class="in" id="sCant" type="number" value="1"></div>
    <div class="campo"><span class="lbl">Ubicación</span><input class="in" id="sUbi"></div>
    <div class="campo"><span class="lbl">Cajón</span><select class="in" id="sCaj">${S.cajones.map(c => `<option ${c === cajonSel ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div></div>
    <div class="campo" style="margin-top:10px"><span class="lbl">Nota (opcional)</span><input class="in" id="sNota" placeholder="Ej: llegó del pedido de la semana"></div>
    <div class="fila" style="margin-top:14px"><button class="btn pri" onclick="agregarSobre()">Agregar</button><button class="btn" onclick="cerrarModal()">Cancelar</button></div>`);
}
async function agregarSobre() {
  const cod = limpiarCodigo(document.getElementById('sCod').value);
  const cant = parseInt(document.getElementById('sCant').value) || 0;
  const ubic = document.getElementById('sUbi').value.trim().toUpperCase() || '-';
  const cajon = document.getElementById('sCaj').value;
  const nota = document.getElementById('sNota').value.trim();
  if (cod.length < 2 || !cajon) { aviso('Falta código o cajón', 'err'); return; }
  const ya = S.sobre.find(x => x.cod === cod && x.cajon === cajon);
  let r;
  if (ya) { if (!confirm(`${cod} ya está en ${cajon} con ${ya.cant} u. ¿Reemplazar por ${cant}?`)) return; r = await remoto({ tipo: 'editarItem', cajon, codigo: cod, cantidad: cant, ubicacion: ubic, nota }, 'Guardando…'); }
  else r = await remoto({ tipo: 'agregarItem', cajon, codigo: cod, cantidad: cant, ubicacion: ubic, nota }, 'Guardando…');
  if (!r) return;
  cerrarModal(); cajonSel = cajon; listaSobre(); aviso('Artículo agregado', 'ok');
}
async function guardarSobreFila(id) {
  const x = S.sobre.find(y => y.id === id); if (!x) return;
  const n = parseInt(document.getElementById('sc_' + id).value) || 0;
  const u = document.getElementById('su_' + id).value.trim().toUpperCase() || '-';
  const nota = document.getElementById('sn_' + id).value.trim();
  if (n === x.cant && u === x.ubic && !nota) { aviso('No hay cambios'); return; }
  const r = await remoto({ tipo: 'editarItem', cajon: x.cajon, codigo: x.cod, cantidad: n, ubicacion: u, nota }, 'Guardando…');
  if (!r) return;
  listaSobre(); aviso('Guardado' + (nota ? ' con nota' : ''), 'ok');
}
function eliminarSobre(id) {
  const x = S.sobre.find(y => y.id === id); if (!x) return;
  abrirModal(`<h3 style="margin-top:0">Sacar ${esc(x.cod)} de ${esc(x.cajon)}</h3><p class="muted">${x.cant} u. · ubicación ${esc(x.ubic)}</p>
    <div class="campo"><span class="lbl">Nota (opcional)</span><input class="in" id="delNota" autofocus placeholder="Ej: se vendió todo / se pasó al depósito" onkeydown="if(event.key==='Enter')confirmarEliminarSobre('${id}')"></div>
    <div class="fila" style="margin-top:14px"><button class="btn rojo" onclick="confirmarEliminarSobre('${id}')">Sacar del sobre stock</button><button class="btn" onclick="cerrarModal()">Cancelar</button></div>`);
}
async function confirmarEliminarSobre(id) {
  const x = S.sobre.find(y => y.id === id); if (!x) return;
  const nota = document.getElementById('delNota').value.trim();
  if (!await remoto({ tipo: 'eliminarItem', cajon: x.cajon, codigo: x.cod, nota }, 'Guardando…')) return;
  cerrarModal(); listaSobre();
}

// ============ Anotaciones ============
let qNotas = '';
VISTAS.anotaciones = function () {
  const q = normalizar(qNotas);
  const cods = Object.keys(S.notas).filter(c => S.notas[c] && S.notas[c].texto.trim())
    .filter(c => !q || normalizar(c + ' ' + S.notas[c].texto + ' ' + infoArticulo(c).desc).includes(q))
    .sort((a, b) => (S.notas[b].ts || 0) - (S.notas[a].ts || 0));
  main(`<div class="cab"><div><h1>Anotaciones</h1><p>${Object.keys(S.notas).length} artículos con nota. Se agregan desde la tarjeta del artículo en Depósito.</p></div>
    <div class="acciones"><button class="btn" onclick="exportarHistorial()">⬇ Exportar Excel</button></div></div>
  <input class="in" id="qNotas" placeholder="🔍 Buscar en las notas, código o descripción…" value="${esc(qNotas)}" oninput="qNotas=this.value;pintar();const e=document.getElementById('qNotas');e.focus();e.setSelectionRange(e.value.length,e.value.length)" style="margin-bottom:14px">
  ${cods.length ? cods.map(c => { const n = S.notas[c]; const a = infoArticulo(c); return `<div class="tarj">
    <div class="t1"><div class="fila"><span class="cod">${esc(c)}</span><span class="muted">${esc(a.desc)}</span>${a.ubic ? `<span class="tag t-gris">${esc(a.ubic)}</span>` : ''}</div>
      <div class="fila"><span class="muted" style="font-size:12px">${esc(n.fecha)}</span><button class="btn chico rojo" data-c="${esc(c)}" onclick="borrarNota(this.dataset.c)">✓ Borrar</button></div></div>
    <textarea class="in" rows="2" style="margin-top:8px" onchange="guardarNota('${esc(c)}',this.value)">${esc(n.texto)}</textarea></div>`; }).join('')
    : '<div class="vacio">No hay anotaciones' + (q ? ' que coincidan' : '') + '.</div>'}`);
};
async function borrarNota(c) { if (!confirm('¿Borrar la anotación de ' + c + '?')) return; if (await docBorrar('notas', c, { tipo: 'Anotación', detalle: 'Borrada la nota de ' + c })) { delete S.notas[c]; guardar('notas'); pintar(); } }
// ============ Historial ============
let qHist = '', fHist = 'todos';
const TIPOS_HIST = { todos: 'Todos', sobre: 'Sobre stock', ubic: 'Ubicaciones', presu: 'Presupuestos', clientes: 'Clientes', otros: 'Otros' };
const TIPO_TXT = { NUEVO_CAJON: 'Nuevo cajón', BAJA_CAJON: 'Cajón eliminado', ALTA_ARTICULO: 'Sobre stock · alta', BAJA_ARTICULO: 'Sobre stock · baja', CANTIDAD: 'Sobre stock', CAMBIO_SOBRE_STOCK: 'Sobre stock',
  IMPORTACION: 'Importar sobre stock', UBICACION: 'Ubicación', IMPORTACION_STOCK: 'Importar stock', IMPORTACION_PRECIOS: 'Importar lista de precios', IMPORTACION_REPOSICIONADOS: 'Importar reposicionados', IMPORTACION_NEXPRO: 'Importar NEXPRO' };
function tipoTxt(t) { return TIPO_TXT[t] || t; }
function grupoHist(t) {
  t = tipoTxt(t);
  if (/sobre|caj/i.test(t)) return 'sobre'; if (/ubicac/i.test(t)) return 'ubic'; if (/presupuesto|motivo/i.test(t)) return 'presu';
  if (/client|descuento/i.test(t)) return 'clientes'; return 'otros';
}
VISTAS.historial = function (op) {
  if (!op || !op.repintar) refrescarRegistro();
  const q = normalizar(qHist);
  const l = S.registro.filter(r => (fHist === 'todos' || grupoHist(r.tipo) === fHist) && (!q || normalizar(tipoTxt(r.tipo) + ' ' + r.detalle + ' ' + (r.nota || '') + ' ' + r.fecha).includes(q)));
  main(`<div class="cab"><div><h1>Historial</h1><p>Cada cambio que se hace en el programa, con la nota que se haya puesto.</p></div>
    <div class="acciones"><button class="btn" onclick="exportarHistorial()">⬇ Exportar Excel</button></div></div>
  <div class="fila" style="margin-bottom:12px">${Object.entries(TIPOS_HIST).map(([k, t]) => `<button class="chip ${fHist === k ? 'on' : ''}" onclick="fHist='${k}';pintar()">${t}</button>`).join('')}
    <input class="in" id="qHist" placeholder="Buscar código, nota, fecha…" style="max-width:260px;margin-left:auto" value="${esc(qHist)}" oninput="qHist=this.value;pintar();const e=document.getElementById('qHist');e.focus();e.setSelectionRange(e.value.length,e.value.length)"></div>
  <div class="panel lista-scroll">${l.length ? `<table class="t"><thead><tr><th>Fecha</th><th>Tipo</th><th>Cambio</th><th style="min-width:200px">Nota</th></tr></thead><tbody>
    ${l.slice(0, 500).map(r => `<tr><td class="muted num" style="font-size:12px;white-space:nowrap">${esc(r.fecha)}</td><td><span class="tag t-gris">${esc(tipoTxt(r.tipo))}</span>${r.dispositivo ? `<div class="muted" style="font-size:11px">${esc(r.dispositivo)}</div>` : ''}</td><td>${esc(r.detalle)}</td><td>${r.nota ? `<span style="color:var(--amber)">${esc(r.nota)}</span>` : ''}</td></tr>`).join('')}</tbody></table>`
    + (l.length > 500 ? `<div class="muted" style="padding:8px">Mostrando 500 de ${l.length}. Exportá a Excel para ver todo.</div>` : '') : '<div class="vacio">Sin cambios registrados.</div>'}</div>`);
};

// ============ Agenda ============
let anioAgenda = new Date().getFullYear();
// Eventos de un mes: cumpleaños de las fichas + anotaciones (las anuales aparecen todos los años)
function eventosDelMes(anio, mes) {
  const out = [];
  S.clientes.forEach(c => { if (mesCumple(c.cumple) === mes) out.push({ tipo: 'cumple', id: c.id, dia: diaCumple(c.cumple), texto: 'Cumpleaños de ' + (c.contacto || c.nombre), sub: c.contacto ? c.nombre : '', anual: true }); });
  S.agenda.forEach(e => {
    const [a, m, d] = e.fecha.split('-').map(Number);
    if (m !== mes) return;
    if (!e.anual && a !== anio) return;
    const cli = e.clienteId ? cliente(e.clienteId) : null;
    out.push({ tipo: 'agenda', id: e.id, dia: d, texto: e.texto, sub: cli ? cli.nombre : '', anual: e.anual });
  });
  return out.sort((x, y) => x.dia - y.dia);
}
function filaEvento(e, mes) {
  const accion = e.tipo === 'cumple' ? `formCliente('${e.id}')` : `formAgenda('${e.id}')`;
  return `<div class="fila evento" style="justify-content:space-between;padding:5px 6px;margin:0 -6px;border-radius:6px;cursor:pointer;flex-wrap:nowrap" onclick="${accion}" title="Tocá para editar">
    <span>${esc(e.texto)}${e.sub ? ` <span class="muted">· ${esc(e.sub)}</span>` : ''}${e.anual ? ' <span class="muted" title="Se repite todos los años">↻</span>' : ''}</span><b>${String(e.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}</b></div>`;
}
VISTAS.agenda = function () {
  const hoy = new Date(); const mesAct = hoy.getFullYear() === anioAgenda ? hoy.getMonth() : -1;
  main(`<div class="cab"><div><h1>Agenda</h1><p>Tocá una anotación para editarla o borrarla. ↻ = se repite todos los años. Los cumpleaños cargados en las fichas de clientes también aparecen acá.</p></div>
    <div class="acciones"><button class="btn" onclick="anioAgenda--;pintar()">‹</button><b style="font-size:17px">${anioAgenda}</b><button class="btn" onclick="anioAgenda++;pintar()">›</button>
    <button class="btn pri" onclick="formAgenda()">＋ Agregar</button></div></div>
  <div class="grid g3">${MESES.map((m, i) => { const ev = eventosDelMes(anioAgenda, i + 1);
    return `<div class="panel" style="${i === mesAct ? 'border-color:var(--amber)' : ''}"><div class="fila" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0;text-transform:capitalize">${m}</h3><button class="btn chico" onclick="formAgenda(null,${i + 1})" title="Agregar en ${m}">＋</button></div>
    ${ev.length ? ev.map(e => filaEvento(e, i + 1)).join('') : '<span class="muted">—</span>'}</div>`; }).join('')}</div>`);
};
function formAgenda(id, mes) {
  const e = id ? S.agenda.find(x => x.id === id) : null;
  let fecha = e ? e.fecha : hoyISO();
  if (!e && mes) fecha = anioAgenda + '-' + String(mes).padStart(2, '0') + '-01';
  abrirModal(`<h3 style="margin-top:0">${e ? 'Editar anotación' : 'Nueva anotación en la agenda'}</h3>
    <div class="grid g2"><div class="campo"><span class="lbl">Fecha</span><input class="in" type="date" id="agFecha" value="${fecha}"></div>
      <div class="campo"><span class="lbl">Cliente (opcional)</span><select class="in" id="agCli"><option value="">—</option>${[...S.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => `<option value="${c.id}" ${e && e.clienteId === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div></div>
    <div class="campo" style="margin-top:10px"><span class="lbl">Qué es</span><input class="in" id="agTexto" autofocus value="${esc(e ? e.texto : '')}" placeholder="Ej: Cumpleaños de Juan · Llamar por la válvula · Vence la lista" onkeydown="if(event.key==='Enter')guardarAgenda('${id || ''}')"></div>
    <label class="fila" style="margin-top:12px;cursor:pointer"><input type="checkbox" id="agAnual" ${e && e.anual ? 'checked' : ''}> Se repite todos los años</label>
    <div class="fila" style="margin-top:16px;justify-content:space-between">${e ? `<button class="btn rojo" onclick="borrarAgenda('${e.id}')">Borrar</button>` : '<span></span>'}
      <div class="fila"><button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn pri" onclick="guardarAgenda('${id || ''}')">Guardar</button></div></div>`);
}
async function guardarAgenda(id) {
  const fecha = document.getElementById('agFecha').value, texto = document.getElementById('agTexto').value.trim();
  if (!fecha || !texto) { aviso('Poné la fecha y qué es', 'err'); return; }
  const clienteId = document.getElementById('agCli').value; const cli = cliente(clienteId);
  const e = { id: id || uid(), fecha, texto, clienteId, anual: document.getElementById('agAnual').checked };
  if (!await docGuardar('agenda', { ...e, clienteNombre: cli ? cli.nombre : '' }, { tipo: 'Agenda', detalle: `${id ? 'Editado' : 'Agregado'}: ${fechaAR(fecha)} · ${texto}${e.anual ? ' (todos los años)' : ''}` })) return;
  const i = S.agenda.findIndex(x => x.id === e.id); if (i >= 0) S.agenda[i] = e; else S.agenda.push(e);
  guardar('agenda'); cerrarModal(); pintar(); aviso('Guardado en la agenda', 'ok');
}
async function borrarAgenda(id) {
  const e = S.agenda.find(x => x.id === id); if (!confirm('¿Borrar “' + e.texto + '”?')) return;
  if (!await docBorrar('agenda', id, { tipo: 'Agenda', detalle: 'Borrado: ' + e.texto })) return;
  S.agenda = S.agenda.filter(x => x.id !== id); guardar('agenda'); cerrarModal(); pintar();
}
