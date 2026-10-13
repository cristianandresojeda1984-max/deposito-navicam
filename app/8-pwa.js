// ============ Instalable como app (PWA) y siempre actualizada ============
const VERSION_APP = '/*VERSION*/';
const SEGURO = location.protocol === 'https:' || location.hostname === 'localhost';
if ('serviceWorker' in navigator && SEGURO) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('No se pudo registrar el service worker', e));
}
// Cada 5 minutos (y al volver a la app) se fija si hay una versión publicada más nueva
let avisoVersion = false;
async function revisarVersion() {
  if (avisoVersion || !SEGURO) return;
  try {
    const r = await fetch('version.txt?_=' + Date.now(), { cache: 'no-store' });
    const v = (await r.text()).trim();
    if (v && v !== VERSION_APP) {
      avisoVersion = true;
      const d = document.createElement('div');
      d.className = 'ok';
      d.innerHTML = `Hay una versión nueva de la app. <button class="btn chico pri" style="margin-left:8px" onclick="actualizarApp()">Actualizar</button>`;
      document.getElementById('toast').appendChild(d);
    }
  } catch (e) {}
}
async function actualizarApp() {
  try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.update())); } catch (e) {}
  location.reload();
}
// Botón ↻ de arriba a la izquierda: si hay versión nueva la carga; si no, trae los últimos cambios de la planilla
async function actualizarTodo(btn) {
  const botones = document.querySelectorAll('.btnAct'); botones.forEach(b => b.classList.add('girando'));
  try {
    if (SEGURO) {
      try {
        const v = (await (await fetch('version.txt?_=' + Date.now(), { cache: 'no-store' })).text()).trim();
        if (v && v !== VERSION_APP) { aviso('Cargando la versión nueva…', 'ok'); await actualizarApp(); return; }
      } catch (e) {}
    }
    await sincronizar(); refrescarRegistro();
    aviso('Todo al día', 'ok');
  } finally { botones.forEach(b => b.classList.remove('girando')); }
}
setInterval(revisarVersion, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarVersion(); });
setTimeout(revisarVersion, 15000);
// Botón "Instalar" (Chrome / Edge en PC y Android)
let pedidoInstalar = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalar = e; if (vista === 'datos') pintar(); });
window.addEventListener('appinstalled', () => { pedidoInstalar = null; aviso('App instalada', 'ok'); });
function appInstalada() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone; }
async function instalarApp() {
  if (!pedidoInstalar) return;
  pedidoInstalar.prompt(); await pedidoInstalar.userChoice; pedidoInstalar = null; pintar();
}
function bloqueInstalar() {
  if (appInstalada()) return '<div class="muted">✓ Estás usando la app instalada. Se actualiza sola cuando hay cambios.</div>';
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return (pedidoInstalar ? '<button class="btn pri" onclick="instalarApp()">⬇ Instalar Navicam en este dispositivo</button>' : '')
    + `<div class="muted" style="font-size:12px;margin-top:8px">${ios ? 'En iPhone: tocá Compartir y después “Agregar a inicio”.'
      : 'En la PC (Chrome o Edge): ícono de instalar en la barra de direcciones, o menú ⋮ → “Instalar Navicam”. En Android: menú ⋮ → “Instalar app”.'} Queda con su propio ícono y ventana, y se actualiza sola cuando publico cambios.</div>`;
}
