// Servidor compartido de la app Depósito Navicam (Google Apps Script).
// Todos los datos viven en la planilla "Navicam App Datos" del Drive de la cuenta dueña del script.
// La planilla se puede editar a mano: los teléfonos toman los cambios en la próxima sincronización.
// Implementado como "Aplicación web" (Ejecutar como: yo · Acceso: cualquiera).

const NOMBRE_PLANILLA = 'Navicam App Datos';
const CARPETA_DATOS = 'Navicam App Datos';
const MAX_REGISTRO = 2000;
const MAX_REPETIDOS_GUARDADOS = 150;
const TAM_PARTE = 3000;

const HOJAS = {
  dolar: 'Dólar', stock: 'Stock', precios: 'Precios', sobre: 'Sobre Stock',
  cajones: 'Cajones', registro: 'Registro', ultimo: '_ultimo_excel_stock'
};
const ENC = {
  stock: ['Codigo', 'Descripcion', 'Ubicacion', 'Stock'],
  precios: ['Codigo', 'Precio USD', 'Descuento', 'Descripcion'],
  sobre: ['Cajon', 'Codigo', 'Cantidad', 'Ubicacion'],
  cajones: ['Cajon'],
  registro: ['Fecha', 'Tipo', 'Detalle', 'Dispositivo', 'ID', 'Resultado', 'TS'],
  ultimo: ['Codigo', 'Ubicacion']
};
// Columnas que se guardan como texto (para no perder ceros ni convertir códigos en números)
const COLS_TEXTO = { stock: [1, 3], precios: [1, 3], sobre: [1, 2, 4], cajones: [1], ultimo: [1, 2] };

// ---------- utilidades ----------
function props() { return PropertiesService.getScriptProperties(); }

function ahoraTexto() {
  return Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm');
}

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function txt(v) {
  const s = String(v === undefined || v === null ? '' : v);
  return /^[=+]/.test(s) ? "'" + s : s;   // evita que Sheets lo tome como fórmula
}

function cod(v) {
  let s = String(v === undefined || v === null ? '' : v).trim().toUpperCase();
  if (/^\d+\.0+$/.test(s)) s = s.split('.')[0];
  return s;
}

function hashTexto(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return String(h);
}

// Almacenamiento grande en propiedades (solo para parches de ubicación y datos viejos)
function leerGrande(clave, porDefecto) {
  const p = props();
  const n = Number(p.getProperty(clave + '_n') || 0);
  if (!n) return porDefecto;
  let s = '';
  for (let i = 0; i < n; i++) s += p.getProperty(clave + '_' + i) || '';
  try { return JSON.parse(s); } catch (e) { return porDefecto; }
}

function guardarGrande(clave, valor) {
  const p = props();
  const s = JSON.stringify(valor);
  const partes = [];
  for (let i = 0; i < s.length; i += TAM_PARTE) partes.push(s.slice(i, i + TAM_PARTE));
  if (partes.length === 0) partes.push('');
  const anterior = Number(p.getProperty(clave + '_n') || 0);
  const obj = {};
  partes.forEach((x, i) => { obj[clave + '_' + i] = x; });
  obj[clave + '_n'] = String(partes.length);
  p.setProperties(obj);
  for (let i = partes.length; i < anterior; i++) p.deleteProperty(clave + '_' + i);
}

// ---------- planilla ----------
let _ss = null;
function planilla() {
  if (_ss) return _ss;
  const p = props();
  const id = p.getProperty('planilla_id');
  if (id) { try { _ss = SpreadsheetApp.openById(id); return _ss; } catch (e) {} }
  _ss = SpreadsheetApp.create(NOMBRE_PLANILLA);
  p.setProperty('planilla_id', _ss.getId());
  Object.keys(HOJAS).forEach(k => hoja(k));
  const sobrante = _ss.getSheets().filter(h => Object.values(HOJAS).indexOf(h.getName()) === -1);
  sobrante.forEach(h => { try { _ss.deleteSheet(h); } catch (e) {} });
  try {
    const it = DriveApp.getFoldersByName(CARPETA_DATOS);
    const carpeta = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_DATOS);
    DriveApp.getFileById(_ss.getId()).moveTo(carpeta);
  } catch (e) {}
  return _ss;
}

function hoja(clave) {
  const ss = planilla();
  let h = ss.getSheetByName(HOJAS[clave]);
  if (h) return h;
  h = ss.insertSheet(HOJAS[clave]);
  if (clave === 'dolar') {
    h.getRange(1, 1, 2, 2).setValues([['Dólar', 1250], ['Actualizado', '']]);
    h.getRange(1, 1, 2, 1).setFontWeight('bold');
  } else {
    const enc = ENC[clave];
    h.getRange(1, 1, 1, enc.length).setValues([enc]).setFontWeight('bold');
    h.setFrozenRows(1);
    if (h.getMaxColumns() > enc.length) h.deleteColumns(enc.length + 1, h.getMaxColumns() - enc.length);
    (COLS_TEXTO[clave] || []).forEach(c => h.getRange(1, c, h.getMaxRows(), 1).setNumberFormat('@'));
  }
  if (clave === 'ultimo') h.hideSheet();
  return h;
}

function leerTabla(clave) {
  const h = hoja(clave);
  const ultima = h.getLastRow();
  if (ultima < 2) return [];
  return h.getRange(2, 1, ultima - 1, ENC[clave].length).getValues()
    .filter(r => r.some(c => c !== '' && c !== null));
}

function escribirTabla(clave, filas) {
  const h = hoja(clave);
  const n = ENC[clave].length;
  const ultima = h.getLastRow();
  if (ultima >= 2) h.getRange(2, 1, ultima - 1, n).clearContent();
  if (!filas.length) return;
  const necesarias = filas.length + 1;
  if (h.getMaxRows() < necesarias) h.insertRowsAfter(h.getMaxRows(), necesarias - h.getMaxRows());
  (COLS_TEXTO[clave] || []).forEach(c => h.getRange(2, c, filas.length, 1).setNumberFormat('@'));
  h.getRange(2, 1, filas.length, n).setValues(filas);
}

// ---------- dólar ----------
function leerDolar() {
  const v = hoja('dolar').getRange(1, 2, 2, 1).getValues();
  const fecha = v[1][0] instanceof Date
    ? Utilities.formatDate(v[1][0], 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm') : String(v[1][0] || '');
  return { dolar: Number(v[0][0]) || 1250, fecha: fecha };
}

function guardarDolar(v) {
  const valor = parseFloat(v);
  if (!(valor > 0) || valor > 100000000) return { ok: false, error: 'valor inválido' };
  const fecha = ahoraTexto();
  hoja('dolar').getRange(1, 2, 2, 1).setValues([[valor], [fecha]]);
  return { ok: true, dolar: valor, fecha: fecha };
}

// ---------- metas (versiones de stock / precios para que los teléfonos sepan cuándo bajar) ----------
function leerMeta(tipo) { return JSON.parse(props().getProperty('meta_' + tipo) || 'null'); }

function subirVersion(tipo, datos) {
  const ant = leerMeta(tipo) || {};
  const meta = Object.assign({}, ant, datos || {}, { version: (ant.version || 0) + 1, fecha: ahoraTexto() });
  props().setProperty('meta_' + tipo, JSON.stringify(meta));
  return meta;
}

// Disparador instalable: una edición manual en la planilla avisa a los teléfonos
function alEditar(e) {
  try {
    const nombre = e.range.getSheet().getName();
    if (nombre === HOJAS.stock) {
      subirVersion('stock', { archivo: 'edición manual en Drive' });
      guardarGrande('ubic', {});
    } else if (nombre === HOJAS.precios) {
      subirVersion('precios', { archivo: 'edición manual en Drive' });
    }
  } catch (err) {}
}

// ---------- sobre stock ----------
function leerSobre() {
  const items = leerTabla('sobre').map(r => ({
    CAJON: String(r[0]).trim().toUpperCase(), CODIGO: cod(r[1]),
    CANTIDAD: parseInt(r[2]) || 0, UBICACION: String(r[3] || '').trim() || '-'
  })).filter(x => x.CAJON && x.CODIGO);
  const cajones = [];
  leerTabla('cajones').forEach(r => { const c = String(r[0]).trim().toUpperCase(); if (c && cajones.indexOf(c) === -1) cajones.push(c); });
  items.forEach(x => { if (cajones.indexOf(x.CAJON) === -1) cajones.push(x.CAJON); });
  const sobre = { cajones: cajones, items: items };
  sobre.version = hashTexto(JSON.stringify(sobre));
  return sobre;
}

function guardarSobre(sobre) {
  const orden = {};
  sobre.cajones.forEach((c, i) => { orden[c] = i; });
  const items = sobre.items.slice().sort((a, b) => (orden[a.CAJON] - orden[b.CAJON]));
  escribirTabla('sobre', items.map(x => [txt(x.CAJON), txt(x.CODIGO), x.CANTIDAD, txt(x.UBICACION)]));
  escribirTabla('cajones', sobre.cajones.map(c => [txt(c)]));
  sobre.version = hashTexto(JSON.stringify({ cajones: sobre.cajones, items: items }));
}

// ---------- registro ----------
function leerRegistro(max) {
  return leerTabla('registro').slice(0, max || 500).map(r => {
    let resultado = null;
    try { resultado = r[5] ? JSON.parse(r[5]) : null; } catch (e) {}
    return { fecha: String(r[0]), tipo: String(r[1]), detalle: String(r[2]), dispositivo: String(r[3]), id: String(r[4]), resultado: resultado, ts: Number(r[6]) || 0 };
  });
}

function buscarEnRegistro(id) {
  const h = hoja('registro');
  const ultima = h.getLastRow();
  if (ultima < 2) return null;
  const ids = h.getRange(2, 5, ultima - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) {
      const r = h.getRange(i + 2, 1, 1, ENC.registro.length).getValues()[0];
      let resultado = null;
      try { resultado = r[5] ? JSON.parse(r[5]) : null; } catch (e) {}
      return { fecha: String(r[0]), tipo: String(r[1]), detalle: String(r[2]), dispositivo: String(r[3]), id: id, resultado: resultado, ts: Number(r[6]) || 0 };
    }
  }
  return null;
}

function agregarRegistro(entrada) {
  const h = hoja('registro');
  let res = entrada.resultado ? JSON.stringify(entrada.resultado) : '';
  if (res.length > 45000) {
    const r2 = Object.assign({}, entrada.resultado);
    delete r2.listaRepetidos; delete r2.conflictosUbicacion;
    res = JSON.stringify(r2);
  }
  h.insertRowBefore(2);
  h.getRange(2, 1, 1, ENC.registro.length).setValues([[entrada.fecha, entrada.tipo, txt(entrada.detalle), entrada.dispositivo, entrada.id, res, entrada.ts]]);
  const ultima = h.getLastRow();
  if (ultima > MAX_REGISTRO + 1) h.deleteRows(MAX_REGISTRO + 2, ultima - MAX_REGISTRO - 1);
}

// ---------- stock / precios ----------
function leerUbicaciones() { return leerGrande('ubic', {}); }

function datosStock() {
  return leerTabla('stock').map(r => [cod(r[0]), String(r[1] || '').trim(), String(r[3] === '' ? '-' : r[3]), String(r[2] || '').trim() || '-']);
}

function datosPrecios() {
  const p = {};
  leerTabla('precios').forEach(r => { const c = cod(r[0]); if (c) p[c] = [Number(r[1]) || 0, String(r[3] || '').trim(), String(r[2] || '').trim() || '-']; });
  return p;
}

// ---------- lecturas (GET) ----------
function doGet(e) {
  const accion = (e && e.parameter && e.parameter.accion) || 'dolar';
  if (accion === 'sobre' || accion === 'estado') {
    const d = leerDolar();
    return salida({ dolar: d.dolar, fecha: d.fecha, sobre: leerSobre(), ubicaciones: leerUbicaciones(),
                    metas: { stock: leerMeta('stock'), precios: leerMeta('precios') }, planillaUrl: planilla().getUrl() });
  }
  if (accion === 'datos') {
    const tipo = e.parameter.tipo === 'precios' ? 'precios' : 'stock';
    const datos = tipo === 'stock' ? datosStock() : datosPrecios();
    return salida({ meta: leerMeta(tipo), datos: datos });
  }
  if (accion === 'registro') return salida({ registro: leerRegistro(500) });
  if (accion === 'op') {
    const ent = buscarEnRegistro(e.parameter.id);
    return salida({ aplicada: !!ent, entrada: ent, sobre: ent ? leerSobre() : null });
  }
  return salida(leerDolar());
}

// ---------- escrituras (POST) ----------
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (datos.accion === 'sobre') return salida(aplicarOperacion(datos.op || {}));
    return salida(guardarDolar(datos.dolar));
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function normCajon(s) { return String(s || '').trim().toUpperCase(); }

function aplicarOperacion(op) {
  if (!op.id) return { ok: false, error: 'operación sin id' };
  const previa = buscarEnRegistro(op.id);
  if (previa) return { ok: true, repetida: true, resultado: previa.resultado || null, entrada: previa, sobre: leerSobre() };

  let sobre = null;
  const cargarSobre = () => { if (!sobre) sobre = leerSobre(); return sobre; };
  let cambioSobre = false;
  let tipo, detalle, resultado = null;

  const buscar = (cajon, codigo) => cargarSobre().items.find(x => x.CAJON === cajon && x.CODIGO === codigo);
  const asegurarCajon = (nombre) => {
    if (cargarSobre().cajones.indexOf(nombre) === -1) { sobre.cajones.push(nombre); return true; }
    return false;
  };

  if (op.tipo === 'nuevoCajon') {
    const nombre = normCajon(op.nombre);
    if (!nombre) return { ok: false, error: 'Falta el nombre del cajón' };
    if (cargarSobre().cajones.indexOf(nombre) !== -1) return { ok: false, error: 'Ya existe el cajón ' + nombre };
    sobre.cajones.push(nombre); cambioSobre = true;
    tipo = 'NUEVO_CAJON'; detalle = 'Cajón creado: ' + nombre;

  } else if (op.tipo === 'agregarItem') {
    const cajon = normCajon(op.cajon), codigo = cod(op.codigo);
    const cantidad = parseInt(op.cantidad) || 0, ubicacion = String(op.ubicacion || '').trim().toUpperCase() || '-';
    if (!cajon || !codigo) return { ok: false, error: 'Faltan el cajón o el código' };
    const ya = buscar(cajon, codigo);
    if (ya) return { ok: false, error: 'El código ' + codigo + ' ya está en ' + cajon + ' (cantidad ' + ya.CANTIDAD + '). Cambiá la cantidad desde la lista.' };
    asegurarCajon(cajon);
    sobre.items.push({ CODIGO: codigo, CANTIDAD: cantidad, UBICACION: ubicacion, CAJON: cajon }); cambioSobre = true;
    tipo = 'ALTA_ARTICULO'; detalle = codigo + ' agregado a ' + cajon + ': ' + cantidad + ' unid., ubicación ' + ubicacion;

  } else if (op.tipo === 'cambiarCant') {
    const cajon = normCajon(op.cajon), codigo = cod(op.codigo);
    const it = buscar(cajon, codigo);
    if (!it) return { ok: false, error: 'No existe ' + codigo + ' en ' + cajon };
    const nueva = parseInt(op.cantidad) || 0, anterior = it.CANTIDAD;
    if (nueva === anterior) return { ok: true, sinCambios: true, sobre: sobre };
    it.CANTIDAD = nueva; cambioSobre = true;
    tipo = 'CANTIDAD'; detalle = codigo + ' en ' + cajon + ': cantidad ' + anterior + ' → ' + nueva;

  } else if (op.tipo === 'eliminarItem') {
    const cajon = normCajon(op.cajon), codigo = cod(op.codigo);
    const idx = cargarSobre().items.findIndex(x => x.CAJON === cajon && x.CODIGO === codigo);
    if (idx === -1) return { ok: false, error: 'No existe ' + codigo + ' en ' + cajon };
    const it = sobre.items.splice(idx, 1)[0]; cambioSobre = true;
    tipo = 'BAJA_ARTICULO'; detalle = codigo + ' eliminado de ' + cajon + ' (tenía ' + it.CANTIDAD + ' unid., ubicación ' + it.UBICACION + ')';

  } else if (op.tipo === 'eliminarCajon') {
    const nombre = normCajon(op.nombre);
    if (cargarSobre().cajones.indexOf(nombre) === -1) return { ok: false, error: 'No existe el cajón ' + nombre };
    const n = sobre.items.filter(x => x.CAJON === nombre).length;
    if (n > 0) return { ok: false, error: 'El cajón ' + nombre + ' tiene ' + n + ' artículos. Eliminá los artículos primero.' };
    sobre.cajones = sobre.cajones.filter(c => c !== nombre); cambioSobre = true;
    tipo = 'BAJA_CAJON'; detalle = 'Cajón eliminado: ' + nombre;

  } else if (op.tipo === 'cambiarUbicacion') {
    const codigo = cod(op.codigo), nueva = String(op.nueva || '').trim().toUpperCase();
    if (!codigo || !nueva) return { ok: false, error: 'Faltan el código o la ubicación' };
    const h = hoja('stock');
    const ultima = h.getLastRow();
    const codigos = ultima >= 2 ? h.getRange(2, 1, ultima - 1, 1).getValues() : [];
    let fila = -1;
    for (let i = 0; i < codigos.length; i++) { if (cod(codigos[i][0]) === codigo) { fila = i + 2; break; } }
    if (fila === -1) return { ok: false, error: 'El código ' + codigo + ' no está en la pestaña Stock' };
    const anterior = String(h.getRange(fila, 3).getValue() || 'SIN ASIGNAR');
    if (anterior === nueva) return { ok: true, sinCambios: true };
    h.getRange(fila, 3).setValue(txt(nueva));
    const ubic = leerUbicaciones();
    ubic[codigo] = nueva;
    guardarGrande('ubic', ubic);
    tipo = 'UBICACION'; detalle = codigo + ': ubicación ' + anterior + ' → ' + nueva;
    resultado = { ubicaciones: ubic };

  } else if (op.tipo === 'subirDatos') {
    const tipoDatos = op.tipoDatos === 'precios' ? 'precios' : 'stock';
    let datos;
    try { datos = JSON.parse(String(op.contenido || '')); } catch (e) { return { ok: false, error: 'Datos inválidos' }; }
    const cantidad = Array.isArray(datos) ? datos.length : Object.keys(datos).length;
    if (!cantidad) return { ok: false, error: 'El archivo no tiene artículos' };
    let conflictos = [];
    if (tipoDatos === 'stock') {
      // Manda el Excel. Se avisa de las ubicaciones que se cambiaron (en la app o a mano)
      // desde la última importación y que el Excel nuevo trae distintas.
      const actual = {}, ultimo = {};
      leerTabla('stock').forEach(r => { actual[cod(r[0])] = String(r[2] || '').trim(); });
      leerTabla('ultimo').forEach(r => { ultimo[cod(r[0])] = String(r[1] || '').trim(); });
      datos.forEach(r => {
        const c = cod(r[0]), nueva = String(r[3] || '').trim();
        if (actual[c] !== undefined && ultimo[c] !== undefined && actual[c] !== ultimo[c] && nueva !== actual[c]) {
          conflictos.push({ codigo: c, app: actual[c], excel: nueva });
        }
      });
      escribirTabla('stock', datos.map(r => {
        const st = parseFloat(r[2]);
        return [txt(cod(r[0])), txt(r[1]), txt(r[3]), isNaN(st) ? txt(r[2]) : st];
      }));
      escribirTabla('ultimo', datos.map(r => [txt(cod(r[0])), txt(r[3])]));
      guardarGrande('ubic', {});
    } else {
      escribirTabla('precios', Object.keys(datos).map(c => {
        const v = datos[c];
        return [txt(c), Number(v[0]) || 0, txt(v[2]), txt(v[1])];
      }));
    }
    const meta = subirVersion(tipoDatos, { cantidad: cantidad, archivo: op.archivo || '' });
    resultado = { meta: meta, conflictosUbicacion: conflictos.slice(0, MAX_REPETIDOS_GUARDADOS), totalConflictos: conflictos.length };
    tipo = tipoDatos === 'stock' ? 'IMPORTACION_STOCK' : 'IMPORTACION_PRECIOS';
    detalle = 'Excel ' + (op.archivo || '') + ': ' + cantidad + ' artículos' + (conflictos.length ? ', ' + conflictos.length + ' ubicaciones cambiadas desde la última importación fueron reemplazadas por las del Excel' : '');

  } else if (op.tipo === 'importar') {
    const items = Array.isArray(op.items) ? op.items : [];
    cargarSobre();
    let agregados = 0, actualizados = 0;
    const repetidos = [], cajonesNuevos = [];
    items.forEach(x => {
      const cajon = normCajon(x.CAJON), codigo = cod(x.CODIGO);
      if (!cajon || !codigo) return;
      if (asegurarCajon(cajon)) cajonesNuevos.push(cajon);
      const cantidad = parseInt(x.CANTIDAD) || 0, ubicacion = String(x.UBICACION || '').trim() || '-';
      const ya = buscar(cajon, codigo);
      if (ya) {
        const cambio = ya.CANTIDAD !== cantidad || ya.UBICACION !== ubicacion;
        repetidos.push({ codigo: codigo, cajon: cajon, cantAnterior: ya.CANTIDAD, cantNueva: cantidad, ubiAnterior: ya.UBICACION, ubiNueva: ubicacion, cambio: cambio });
        if (cambio) { ya.CANTIDAD = cantidad; ya.UBICACION = ubicacion; actualizados++; }
      } else {
        sobre.items.push({ CODIGO: codigo, CANTIDAD: cantidad, UBICACION: ubicacion, CAJON: cajon });
        agregados++;
      }
    });
    cambioSobre = true;
    const conCambio = repetidos.filter(x => x.cambio);
    resultado = {
      archivo: op.archivo || '', leidos: items.length, agregados: agregados, actualizados: actualizados,
      repetidos: repetidos.length, cajonesNuevos: cajonesNuevos,
      listaRepetidos: conCambio.slice(0, MAX_REPETIDOS_GUARDADOS)
    };
    tipo = 'IMPORTACION';
    detalle = 'Excel ' + (op.archivo || '') + ': ' + agregados + ' nuevos, ' + repetidos.length + ' repetidos (' + actualizados + ' con cambios)' + (cajonesNuevos.length ? ', cajones nuevos: ' + cajonesNuevos.join(', ') : '');

  } else {
    return { ok: false, error: 'operación desconocida: ' + op.tipo };
  }

  if (cambioSobre) guardarSobre(sobre);
  const entrada = { id: op.id, ts: Date.now(), fecha: ahoraTexto(), tipo: tipo, detalle: detalle, dispositivo: String(op.dispositivo || '').slice(0, 40) };
  if (resultado) entrada.resultado = resultado;
  agregarRegistro(entrada);
  return { ok: true, resultado: resultado, entrada: entrada, sobre: sobre || leerSobre() };
}

// ---------- configuración (ejecutar desde el editor) ----------

// 1) Crea la planilla y el aviso de ediciones manuales. Pide permisos la primera vez.
function autorizar() {
  const ss = planilla();
  const ya = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'alEditar');
  if (!ya) ScriptApp.newTrigger('alEditar').forSpreadsheet(ss).onEdit().create();
  Logger.log('Planilla lista: ' + ss.getUrl());
}

// 2) Pasa a la planilla los datos que estaban guardados en la versión anterior (una sola vez).
function migrar() {
  const p = props();
  if (p.getProperty('migrado') === 'si') { Logger.log('Ya estaba migrado.'); return; }
  planilla();
  const dolar = Number(p.getProperty('dolar') || 0);
  if (dolar > 0) hoja('dolar').getRange(1, 2, 2, 1).setValues([[dolar], [p.getProperty('fecha') || '']]);
  const sobreViejo = leerGrande('sobre', null);
  if (sobreViejo && sobreViejo.items) guardarSobre({ cajones: sobreViejo.cajones || [], items: sobreViejo.items });
  const regViejo = leerGrande('registro', []);
  if (regViejo.length) {
    escribirTabla('registro', regViejo.slice(0, MAX_REGISTRO).map(r => [
      r.fecha, r.tipo, txt(r.detalle), r.dispositivo || '', r.id, r.resultado ? JSON.stringify(r.resultado).slice(0, 45000) : '', r.ts || 0
    ]));
  }
  ['stock', 'precios'].forEach(tipo => {
    const id = p.getProperty('archivo_' + tipo);
    if (!id) return;
    const datos = JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8'));
    if (tipo === 'stock') {
      escribirTabla('stock', datos.map(r => { const st = parseFloat(r[2]); return [txt(cod(r[0])), txt(r[1]), txt(r[3]), isNaN(st) ? txt(r[2]) : st]; }));
      escribirTabla('ultimo', datos.map(r => [txt(cod(r[0])), txt(r[3])]));
      // aplicar las ubicaciones cambiadas desde la app
      const ubic = leerGrande('ubic', {});
      const h = hoja('stock'), filas = leerTabla('stock');
      filas.forEach((r, i) => { const c = cod(r[0]); if (ubic[c]) h.getRange(i + 2, 3).setValue(txt(ubic[c])); });
    } else {
      escribirTabla('precios', Object.keys(datos).map(c => [txt(c), Number(datos[c][0]) || 0, txt(datos[c][2]), txt(datos[c][1])]));
    }
    subirVersion(tipo, {});
  });
  p.setProperty('migrado', 'si');
  Logger.log('Migración terminada: ' + planilla().getUrl());
}
