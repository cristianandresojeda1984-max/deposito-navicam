// ============ Sobre stock: reponer en estantería y planillas para imprimir ============
function numStock(v) {
  if (v === null || v === undefined) return null;
  let t = String(v).trim(); if (!t || t === '-') return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t.replace(',', '.'));
  return isNaN(n) ? null : n;
}
// Artículos donde en la estantería queda 1 o ninguno (stock total menos lo que está en el sobre stock)
function paraReponer() {
  const porCod = {};
  S.sobre.forEach(x => { if (x.cant > 0) (porCod[x.cod] = porCod[x.cod] || []).push(x); });
  const out = [];
  Object.keys(porCod).forEach(cod => {
    const a = infoArticulo(cod);
    const total = numStock(a.stock);
    if (total === null) return;               // sin dato de stock: no se puede calcular
    const enSobre = porCod[cod].reduce((s, x) => s + x.cant, 0);
    const estanteria = total - enSobre;
    if (estanteria <= 1) out.push({ cod, desc: a.desc, ubicEst: a.ubic && a.ubic !== '-' ? a.ubic : (porCod[cod][0].ubic || '-'), total, enSobre, estanteria, items: porCod[cod] });
  });
  return out.sort((a, b) => a.estanteria - b.estanteria || String(a.ubicEst).localeCompare(String(b.ubicEst)));
}
function panelReponer() {
  const l = paraReponer();
  if (!l.length) return '';
  return `<div class="panel" style="margin-bottom:14px;border-color:var(--amber)">
    <div class="fila" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">⚠ Reponer en estantería <span class="tag t-amber">${l.length}</span></h3>
      <button class="btn chico" onclick="pdfReponer()">🖨 PDF para llevar al depósito</button></div>
    <div class="muted" style="font-size:12px;margin-bottom:8px">En la estantería queda 1 o ninguno: hay que sacar del sobre stock y guardar en la estantería. Cuando lo pasen, tocá “Pasé a estantería” y se descuenta del cajón.</div>
    <div class="tabla-scroll" style="max-height:340px;overflow:auto"><table class="t"><tr><th>Código</th><th>Descripción</th><th>Estantería</th><th class="der">Quedan</th><th>Está en</th><th></th></tr>
    ${l.map(r => r.items.map((x, k) => `<tr>${k === 0 ? `<td rowspan="${r.items.length}" class="num" style="color:var(--amber)">${esc(r.cod)}</td><td rowspan="${r.items.length}">${esc(r.desc)}</td><td rowspan="${r.items.length}">${esc(r.ubicEst)}</td>
        <td rowspan="${r.items.length}" class="der"><span class="tag ${r.estanteria <= 0 ? 't-red' : 't-amber'}">${r.estanteria <= 0 ? 'ninguno' : '1'}</span>${r.estanteria < 0 ? '<div class="muted" style="font-size:11px">el stock dice menos que el sobre stock</div>' : ''}</td>` : ''}
        <td>${esc(x.cajon)} · <b>${x.cant} u.</b></td>
        <td><button class="btn chico azul" onclick="formReponer('${x.id}')">Pasé a estantería</button></td></tr>`).join('')).join('')}</table></div></div>`;
}
function formReponer(id) {
  const x = S.sobre.find(y => y.id === id); if (!x) return;
  abrirModal(`<h3 style="margin-top:0">Pasar ${esc(x.cod)} a la estantería</h3>
    <p class="muted" style="margin-top:0">${esc(infoArticulo(x.cod).desc)}<br>En ${esc(x.cajon)} hay <b>${x.cant} u.</b> Lo que pongas se descuenta de ese cajón (el stock total no cambia).</p>
    <div class="fila"><div class="campo" style="width:140px"><span class="lbl">¿Cuántas sacaste?</span><input class="in" id="repCant" type="number" min="1" max="${x.cant}" autofocus onkeydown="if(event.key==='Enter')confirmarReponer('${id}')"></div>
      <button class="btn chico" style="align-self:flex-end;margin-bottom:4px" onclick="document.getElementById('repCant').value=${x.cant}">Todas (${x.cant})</button></div>
    <div class="fila" style="margin-top:14px;justify-content:flex-end"><button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn pri" onclick="confirmarReponer('${id}')">Descontar del cajón</button></div>`);
  setTimeout(() => { const e = document.getElementById('repCant'); if (e) e.focus(); }, 50);
}
async function confirmarReponer(id) {
  const x = S.sobre.find(y => y.id === id); if (!x) return;
  const n = parseInt(document.getElementById('repCant').value) || 0;
  if (n < 1) { aviso('Poné cuántas sacaste', 'err'); return; }
  if (n > x.cant) { aviso(`En el cajón hay ${x.cant} u., no se pueden sacar ${n}`, 'err'); return; }
  const nota = `Repuesto a estantería: ${n} u.`;
  const r = n === x.cant
    ? await remoto({ tipo: 'eliminarItem', cajon: x.cajon, codigo: x.cod, nota }, 'Guardando…')
    : await remoto({ tipo: 'editarItem', cajon: x.cajon, codigo: x.cod, cantidad: x.cant - n, ubicacion: x.ubic, nota }, 'Guardando…');
  if (!r) return;
  cerrarModal(); indexarSobre(); pintar();
  aviso(`${x.cod}: ${n} u. pasadas a la estantería (quedan ${x.cant - n} en ${x.cajon})`, 'ok');
}

// --- PDF imprimibles (fondo blanco, letra negra)
function pdfBase() { const { jsPDF } = window.jspdf; return new jsPDF({ unit: 'pt', format: 'a4' }); }
function pieDePagina(doc, texto) {
  const n = doc.internal.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(120); doc.text(texto, 40, H - 22); doc.text(`Hoja ${i} de ${n}`, W - 40, H - 22, { align: 'right' }); }
}
const ESTILO_TABLA = { theme: 'grid', styles: { font: 'helvetica', fontSize: 11, textColor: 20, cellPadding: 6, lineColor: 190, lineWidth: 0.5, valign: 'middle' },
  headStyles: { fillColor: [225, 225, 225], textColor: 20, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [246, 246, 246] }, margin: { left: 40, right: 40, bottom: 40 } };
function pdfCajones(cajones) {
  cajones = cajones.filter(c => S.sobre.some(x => x.cajon === c));
  if (!cajones.length) { aviso('No hay artículos en esos cajones', 'err'); return; }
  const doc = pdfBase(); const W = doc.internal.pageSize.getWidth(); const fecha = new Date().toLocaleDateString('es-AR');
  cajones.forEach((c, i) => {
    if (i) doc.addPage();
    const it = S.sobre.filter(x => x.cajon === c).sort((a, b) => a.cod.localeCompare(b.cod));
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90); doc.text('SOBRE STOCK · ' + (S.ajustes.empresa || 'Navicam'), 40, 46);
    doc.text(fecha, W - 40, 46, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(10); doc.text(c, 40, 80);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(70);
    doc.text(`${it.length} artículos · ${it.reduce((a, x) => a + x.cant, 0)} unidades`, 40, 100);
    doc.setDrawColor(20); doc.setLineWidth(1.2); doc.line(40, 110, W - 40, 110);
    doc.autoTable(Object.assign({}, ESTILO_TABLA, {
      startY: 122,
      head: [['Cant.', 'Código', 'Descripción', 'Ubicación']],
      body: it.map(x => [String(x.cant), x.cod, infoArticulo(x.cod).desc || '', x.ubic || '-']),
      columnStyles: { 0: { halign: 'center', fontStyle: 'bold', fontSize: 13, cellWidth: 50 }, 1: { font: 'courier', fontStyle: 'bold', cellWidth: 105 }, 3: { cellWidth: 85, halign: 'center' } }
    }));
  });
  pieDePagina(doc, 'Sobre stock · impreso el ' + fecha);
  doc.save((cajones.length === 1 ? cajones[0] : 'Sobre stock - todos los cajones').replace(/[\\/:*?"<>|]+/g, ' ') + '.pdf');
}
function pdfReponer() {
  const l = paraReponer(); if (!l.length) { aviso('No hay nada para reponer', 'ok'); return; }
  const doc = pdfBase(); const W = doc.internal.pageSize.getWidth(); const fecha = new Date().toLocaleDateString('es-AR');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90); doc.text('SOBRE STOCK · ' + (S.ajustes.empresa || 'Navicam'), 40, 46); doc.text(fecha, W - 40, 46, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(10); doc.text('Reponer en estantería', 40, 80);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(70); doc.text(`${l.length} artículos con 1 o ninguno en la estantería · sacar del cajón y guardar`, 40, 100);
  doc.setDrawColor(20); doc.setLineWidth(1.2); doc.line(40, 110, W - 40, 110);
  const body = [];
  l.forEach(r => r.items.forEach(x => body.push([r.cod, r.desc || '', r.ubicEst || '-', r.estanteria <= 0 ? '0' : '1', x.cajon.replace(/^CAJON SOBRE STOCK\s*/i, 'Cajón '), String(x.cant), ''])));
  doc.autoTable(Object.assign({}, ESTILO_TABLA, {
    startY: 122, styles: Object.assign({}, ESTILO_TABLA.styles, { fontSize: 10 }),
    head: [['Código', 'Descripción', 'Estantería', 'Quedan', 'Cajón', 'En cajón', 'Pasé']],
    body,
    columnStyles: { 0: { font: 'courier', fontStyle: 'bold', cellWidth: 88 }, 2: { cellWidth: 64, halign: 'center' }, 3: { cellWidth: 52, halign: 'center', fontStyle: 'bold' }, 4: { cellWidth: 62 }, 5: { cellWidth: 48, halign: 'center', fontStyle: 'bold' }, 6: { cellWidth: 36 } }
  }));
  pieDePagina(doc, 'Reponer en estantería · impreso el ' + fecha);
  doc.save('Reponer en estanteria ' + fecha.replace(/\//g, '-') + '.pdf');
}
