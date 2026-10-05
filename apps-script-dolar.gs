// Servidor compartido de la app Depósito Navicam (Google Apps Script).
// Guarda: dólar, sobre stock (cajones y artículos) y el registro de cambios.
// Implementado como "Aplicación web" (Ejecutar como: yo · Acceso: cualquier usuario).

const MAX_REGISTRO = 500;       // entradas de registro que se conservan
const TAM_PARTE = 3000;         // caracteres por propiedad (límite de Google: 9 KB por valor)
const MAX_REPETIDOS_GUARDADOS = 300;

// ---------- utilidades de almacenamiento ----------
function props() { return PropertiesService.getScriptProperties(); }

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

function ahoraTexto() {
  return Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm');
}

function leerSobre() { return leerGrande('sobre', { cajones: [], items: [], version: 0 }); }
function leerRegistro() { return leerGrande('registro', []); }

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function leerDolar() {
  const p = props();
  return { dolar: Number(p.getProperty('dolar') || 1250), fecha: p.getProperty('fecha') || '' };
}

// ---------- archivos grandes (stock / precios) en Google Drive ----------
const CARPETA_DATOS = 'Navicam App Datos';

function carpetaDatos() {
  const p = props();
  const id = p.getProperty('carpeta_id');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const it = DriveApp.getFoldersByName(CARPETA_DATOS);
  const carpeta = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_DATOS);
  p.setProperty('carpeta_id', carpeta.getId());
  return carpeta;
}

function leerMeta(tipo) { return JSON.parse(props().getProperty('meta_' + tipo) || 'null'); }

function guardarArchivoDatos(tipo, contenido) {
  const p = props();
  const nombre = tipo + '.json';
  const id = p.getProperty('archivo_' + tipo);
  if (id) {
    try { DriveApp.getFileById(id).setContent(contenido); return; } catch (e) {}
  }
  const f = carpetaDatos().createFile(nombre, contenido, MimeType.PLAIN_TEXT);
  p.setProperty('archivo_' + tipo, f.getId());
}

function leerArchivoDatos(tipo) {
  const id = props().getProperty('archivo_' + tipo);
  if (!id) return null;
  return DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8');
}

function leerUbicaciones() { return leerGrande('ubic', {}); }

// ---------- lecturas (GET) ----------
function doGet(e) {
  const accion = (e && e.parameter && e.parameter.accion) || 'dolar';
  if (accion === 'sobre' || accion === 'estado') {
    const d = leerDolar();
    return salida({ dolar: d.dolar, fecha: d.fecha, sobre: leerSobre(), ubicaciones: leerUbicaciones(),
                    metas: { stock: leerMeta('stock'), precios: leerMeta('precios') } });
  }
  if (accion === 'datos') {
    const tipo = e.parameter.tipo === 'precios' ? 'precios' : 'stock';
    const contenido = leerArchivoDatos(tipo);
    const meta = leerMeta(tipo);
    const texto = '{"meta":' + JSON.stringify(meta) + ',"datos":' + (contenido || 'null') + '}';
    return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.JSON);
  }
  if (accion === 'registro') {
    return salida({ registro: leerRegistro() });
  }
  if (accion === 'op') {
    const id = e.parameter.id;
    const ent = leerRegistro().find(r => r.id === id);
    return salida({ aplicada: !!ent, entrada: ent || null, sobre: ent ? leerSobre() : null });
  }
  return salida(leerDolar());
}

// ---------- escrituras (POST) ----------
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
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

function guardarDolar(v) {
  const valor = parseFloat(v);
  if (!(valor > 0) || valor > 100000000) return { ok: false, error: 'valor inválido' };
  const fecha = ahoraTexto();
  props().setProperties({ dolar: String(valor), fecha: fecha });
  return { ok: true, dolar: valor, fecha: fecha };
}

function normCajon(s) { return String(s || '').trim().toUpperCase(); }
function normCodigo(s) { return String(s || '').trim().toUpperCase(); }

function aplicarOperacion(op) {
  if (!op.id) return { ok: false, error: 'operación sin id' };
  const registro = leerRegistro();
  const previa = registro.find(r => r.id === op.id);
  if (previa) return { ok: true, repetida: true, resultado: previa.resultado || null, entrada: previa, sobre: leerSobre() };

  const sobre = leerSobre();
  let tipo, detalle, resultado = null;

  const asegurarCajon = (nombre) => {
    if (sobre.cajones.indexOf(nombre) === -1) { sobre.cajones.push(nombre); return true; }
    return false;
  };
  const buscar = (cajon, codigo) => sobre.items.find(x => x.CAJON === cajon && x.CODIGO === codigo);

  if (op.tipo === 'nuevoCajon') {
    const nombre = normCajon(op.nombre);
    if (!nombre) return { ok: false, error: 'Falta el nombre del cajón' };
    if (sobre.cajones.indexOf(nombre) !== -1) return { ok: false, error: 'Ya existe el cajón ' + nombre };
    sobre.cajones.push(nombre);
    tipo = 'NUEVO_CAJON'; detalle = 'Cajón creado: ' + nombre;

  } else if (op.tipo === 'agregarItem') {
    const cajon = normCajon(op.cajon), codigo = normCodigo(op.codigo);
    const cantidad = parseInt(op.cantidad) || 0, ubicacion = String(op.ubicacion || '').trim().toUpperCase() || '-';
    if (!cajon || !codigo) return { ok: false, error: 'Faltan el cajón o el código' };
    const ya = buscar(cajon, codigo);
    if (ya) return { ok: false, error: 'El código ' + codigo + ' ya está en ' + cajon + ' (cantidad ' + ya.CANTIDAD + '). Cambiá la cantidad desde la búsqueda.' };
    asegurarCajon(cajon);
    sobre.items.push({ CODIGO: codigo, CANTIDAD: cantidad, UBICACION: ubicacion, CAJON: cajon });
    tipo = 'ALTA_ARTICULO'; detalle = codigo + ' agregado a ' + cajon + ': ' + cantidad + ' unid., ubicación ' + ubicacion;

  } else if (op.tipo === 'cambiarCant') {
    const cajon = normCajon(op.cajon), codigo = normCodigo(op.codigo);
    const it = buscar(cajon, codigo);
    if (!it) return { ok: false, error: 'No existe ' + codigo + ' en ' + cajon };
    const nueva = parseInt(op.cantidad) || 0, anterior = it.CANTIDAD;
    if (nueva === anterior) return { ok: true, sinCambios: true, sobre: sobre };
    it.CANTIDAD = nueva;
    tipo = 'CANTIDAD'; detalle = codigo + ' en ' + cajon + ': cantidad ' + anterior + ' → ' + nueva;

  } else if (op.tipo === 'eliminarItem') {
    const cajon = normCajon(op.cajon), codigo = normCodigo(op.codigo);
    const idx = sobre.items.findIndex(x => x.CAJON === cajon && x.CODIGO === codigo);
    if (idx === -1) return { ok: false, error: 'No existe ' + codigo + ' en ' + cajon };
    const it = sobre.items.splice(idx, 1)[0];
    tipo = 'BAJA_ARTICULO'; detalle = codigo + ' eliminado de ' + cajon + ' (tenía ' + it.CANTIDAD + ' unid., ubicación ' + it.UBICACION + ')';

  } else if (op.tipo === 'eliminarCajon') {
    const nombre = normCajon(op.nombre);
    if (sobre.cajones.indexOf(nombre) === -1) return { ok: false, error: 'No existe el cajón ' + nombre };
    const n = sobre.items.filter(x => x.CAJON === nombre).length;
    if (n > 0) return { ok: false, error: 'El cajón ' + nombre + ' tiene ' + n + ' artículos. Eliminá los artículos primero.' };
    sobre.cajones = sobre.cajones.filter(c => c !== nombre);
    tipo = 'BAJA_CAJON'; detalle = 'Cajón eliminado: ' + nombre;

  } else if (op.tipo === 'cambiarUbicacion') {
    const codigo = normCodigo(op.codigo), nueva = String(op.nueva || '').trim().toUpperCase();
    if (!codigo || !nueva) return { ok: false, error: 'Faltan el código o la ubicación' };
    const ubic = leerUbicaciones();
    const anterior = ubic[codigo] || String(op.anterior || 'SIN ASIGNAR');
    if (anterior === nueva) return { ok: true, sinCambios: true, ubicaciones: ubic };
    ubic[codigo] = nueva;
    guardarGrande('ubic', ubic);
    tipo = 'UBICACION'; detalle = codigo + ': ubicación ' + anterior + ' → ' + nueva;
    resultado = { ubicaciones: ubic };

  } else if (op.tipo === 'subirDatos') {
    const tipoDatos = op.tipoDatos === 'precios' ? 'precios' : 'stock';
    const contenido = String(op.contenido || '');
    let datos;
    try { datos = JSON.parse(contenido); } catch (e) { return { ok: false, error: 'Datos inválidos' }; }
    const cantidad = Array.isArray(datos) ? datos.length : Object.keys(datos).length;
    if (!cantidad) return { ok: false, error: 'El archivo no tiene artículos' };
    // Stock nuevo: manda el Excel. Se avisa qué ubicaciones cambiadas en la app difieren del Excel.
    let conflictos = [];
    if (tipoDatos === 'stock') {
      const ubic = leerUbicaciones();
      const porCodigo = {};
      datos.forEach(r => { porCodigo[r[0]] = r[3]; });
      Object.keys(ubic).forEach(c => {
        if (porCodigo[c] !== undefined && porCodigo[c] !== ubic[c]) conflictos.push({ codigo: c, app: ubic[c], excel: porCodigo[c] });
      });
      guardarGrande('ubic', {});
    }
    guardarArchivoDatos(tipoDatos, contenido);
    const anteriorMeta = leerMeta(tipoDatos);
    const meta = { version: ((anteriorMeta && anteriorMeta.version) || 0) + 1, fecha: ahoraTexto(), cantidad: cantidad, archivo: op.archivo || '' };
    props().setProperty('meta_' + tipoDatos, JSON.stringify(meta));
    resultado = { meta: meta, conflictosUbicacion: conflictos.slice(0, MAX_REPETIDOS_GUARDADOS), totalConflictos: conflictos.length };
    tipo = tipoDatos === 'stock' ? 'IMPORTACION_STOCK' : 'IMPORTACION_PRECIOS';
    detalle = 'Excel ' + (op.archivo || '') + ': ' + cantidad + ' artículos' + (conflictos.length ? ', ' + conflictos.length + ' ubicaciones cambiadas en la app reemplazadas por las del Excel' : '');
    // Lo que sigue (guardar sobre) no aplica, pero no molesta
  } else if (op.tipo === 'importar') {
    const items = Array.isArray(op.items) ? op.items : [];
    let agregados = 0, actualizados = 0;
    const repetidos = [], cajonesNuevos = [];
    items.forEach(x => {
      const cajon = normCajon(x.CAJON), codigo = normCodigo(x.CODIGO);
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
    resultado = {
      archivo: op.archivo || '', leidos: items.length, agregados: agregados, actualizados: actualizados,
      repetidos: repetidos.length, cajonesNuevos: cajonesNuevos,
      listaRepetidos: repetidos.slice(0, MAX_REPETIDOS_GUARDADOS)
    };
    tipo = 'IMPORTACION';
    detalle = 'Excel ' + (op.archivo || '') + ': ' + agregados + ' nuevos, ' + repetidos.length + ' repetidos (' + actualizados + ' con cambios)' + (cajonesNuevos.length ? ', cajones nuevos: ' + cajonesNuevos.join(', ') : '');

  } else {
    return { ok: false, error: 'operación desconocida: ' + op.tipo };
  }

  sobre.version = (sobre.version || 0) + 1;
  guardarGrande('sobre', sobre);
  const entrada = { id: op.id, ts: Date.now(), fecha: ahoraTexto(), tipo: tipo, detalle: detalle, dispositivo: String(op.dispositivo || '').slice(0, 40) };
  if (resultado) entrada.resultado = resultado;
  registro.unshift(entrada);
  // Para no llenar el espacio: solo las 3 importaciones más recientes guardan la lista de repetidos
  let importaciones = 0;
  registro.forEach(r => {
    if (r.resultado && r.resultado.listaRepetidos) {
      importaciones++;
      if (importaciones > 3) delete r.resultado.listaRepetidos;
    }
  });
  guardarGrande('registro', registro.slice(0, MAX_REGISTRO));
  return { ok: true, resultado: resultado, entrada: entrada, sobre: sobre };
}

// Ejecutar UNA vez desde el editor para dar permiso de Drive (crea la carpeta "Navicam App Datos").
function autorizar() {
  const c = carpetaDatos();
  Logger.log('Carpeta lista: ' + c.getName());
}
