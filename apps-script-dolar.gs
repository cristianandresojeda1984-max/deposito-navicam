// Dólar compartido para la app Depósito Navicam.
// Pegar en https://script.google.com (proyecto nuevo) e implementar como "Aplicación web".

function doGet() {
  const p = PropertiesService.getScriptProperties();
  return salida({
    dolar: Number(p.getProperty('dolar') || 1250),
    fecha: p.getProperty('fecha') || ''
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const datos = JSON.parse(e.postData.contents || '{}');
    const valor = parseFloat(datos.dolar);
    if (!(valor > 0) || valor > 100000000) return salida({ ok: false, error: 'valor inválido' });
    const fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm');
    const p = PropertiesService.getScriptProperties();
    p.setProperty('dolar', String(valor));
    p.setProperty('fecha', fecha);
    return salida({ ok: true, dolar: valor, fecha: fecha });
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
