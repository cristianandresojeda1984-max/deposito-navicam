// ============ Lo que recibe el cliente: vista, PDF, WhatsApp y Excel ============
// Nunca muestra el dólar. Todos los precios son sin IVA, aclarando "+ IVA".
function pctTxt(n) { n = Number(n) || 0; return n ? '-' + fmt(n, n % 1 ? 1 : 0) + '%' : '0%'; }
function hojaCliente(p) {
  const cli = cliente(p.clienteId) || {};
  const t = totales(p.items);
  const escala = p.escala || cli.desc || {};
  return `<div class="hoja">
    <div class="h-cab"><div><div class="h-tit">Presupuesto N.º ${p.borrador ? '(sin guardar)' : numPresu(p)}</div><div class="gris" style="font-size:14px;margin-top:4px"><b style="color:#141a26">${esc(S.ajustes.empresa)}</b><br>${esc(S.ajustes.datosEmpresa)}</div></div>
      <div style="text-align:right;font-size:14px;line-height:1.6">Fecha: <b>${fechaAR(p.fecha)}</b><br>Válido hasta: <b>${fechaAR(p.hasta)}</b></div></div>
    <div style="display:flex;justify-content:space-between;gap:20px;font-size:14px;flex-wrap:wrap">
      <div><div class="gris" style="font-size:12px;text-transform:uppercase;letter-spacing:1px">Cliente</div><div style="font-size:18px;font-weight:700">${esc(p.clienteNombre)}</div>${cli.cuit ? `<div class="gris">CUIT ${esc(cli.cuit)}</div>` : ''}</div>
      <div style="text-align:right"><div class="gris" style="font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Sus descuentos por escala</div>
        <div style="display:flex;gap:6px;justify-content:flex-end">${['5', '6', '7', '8', '9'].map(d => `<span class="h-chip">D${d} <b>${esc(textoDesc(escala[d]))}</b></span>`).join('')}</div></div></div>
    <table><tr><th>Código</th><th>Descripción</th><th>Marca</th><th class="r">Cant</th><th class="r">Precio lista</th><th class="r">Desc.</th><th class="r">Unitario + IVA</th><th class="r">Subtotal + IVA</th></tr>
      ${p.items.map(l => `<tr><td style="font-family:Consolas,monospace">${esc(l.cod)}</td><td>${esc(l.desc)}${l.reemplazaA ? `<div style="font-size:11px;color:#6b4bb8">Reemplaza a ${esc(l.reemplazaA)}</div>` : ''}</td><td>${esc(marcaDe(l))}</td><td class="r">${l.cant}</td><td class="r">${fmt(l.listaArs)}</td>
        <td class="r ${l.descPct ? 'd' : 'gris'}">${pctTxt(l.descPct)}</td><td class="r">${fmt(l.unit)}</td><td class="r">${fmt(l.sub)}</td></tr>`).join('')}</table>
    <div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start">
      <div style="flex:1;font-size:13px;color:#4a5468;line-height:1.5">Todos los precios son en pesos <b style="color:#141a26">+ IVA</b>.${p.notas ? '<br><br><b style="color:#141a26">Observaciones:</b> ' + esc(p.notas) : ''}</div>
      <div class="tot">
        <div><span class="gris">Total a precio de lista</span><span>${fmt(t.lista)}</span></div>
        <div style="color:#0f6b3d;font-weight:600"><span>Su ahorro</span><span>-${fmt(t.ahorro)}</span></div>
        <div style="border-top:2px solid #141a26;padding-top:9px;font-size:18px;font-weight:700"><span>Total</span><span>$ ${fmt(t.sub)} + IVA</span></div></div></div>
    <div class="pie">${esc(S.ajustes.pie)}</div></div>`;
}
let presuVista = null;
function vistaCliente(p) {
  presuVista = p;
  abrirModal(`<div class="fila" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">Así lo recibe el cliente</h3>
    <div class="fila"><button class="btn pri" onclick="descargarPdf(presuVista)">⬇ Descargar PDF</button><button class="btn" onclick="enviarWhatsApp(presuVista)">WhatsApp</button><button class="btn" onclick="imprimirPresu()">Imprimir</button><button class="btn" onclick="cerrarModal()">Cerrar</button></div></div>
    <div style="overflow:auto;background:#5a6478;padding:16px;border-radius:8px">${hojaCliente(p)}</div>`, true);
}
function imprimirPresu() {
  document.getElementById('printArea').innerHTML = hojaCliente(presuVista);
  window.print();
}

// --- PDF (se arma acá mismo, sin internet)
function nombrePdf(p) { return `Presupuesto ${p.borrador ? '' : numPresu(p) + ' '}${p.clienteNombre}`.replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.pdf'; }
function pdfPresupuesto(p) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 42;
  const cli = cliente(p.clienteId) || {};
  const escala = p.escala || cli.desc || {};
  const t = totales(p.items);
  const tinta = [20, 26, 38], gris = [74, 84, 104], verde = [15, 107, 61];
  // encabezado
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...tinta);
  doc.text('Presupuesto N.º ' + (p.borrador ? '(sin guardar)' : numPresu(p)), M, 58);
  doc.setFontSize(10); doc.text(S.ajustes.empresa || '', M, 76);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...gris); doc.text(S.ajustes.datosEmpresa || '', M, 90);
  doc.setTextColor(...tinta); doc.setFontSize(10);
  doc.text('Fecha: ', W - M - doc.getTextWidth(fechaAR(p.fecha)) - 2, 56, { align: 'right' }); doc.setFont('helvetica', 'bold'); doc.text(fechaAR(p.fecha), W - M, 56, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.text('Válido hasta: ', W - M - doc.getTextWidth(fechaAR(p.hasta)) - 2, 72, { align: 'right' }); doc.setFont('helvetica', 'bold'); doc.text(fechaAR(p.hasta), W - M, 72, { align: 'right' });
  doc.setDrawColor(...tinta); doc.setLineWidth(2); doc.line(M, 104, W - M, 104);
  // cliente y escala
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...gris); doc.text('CLIENTE', M, 128);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...tinta); doc.text(p.clienteNombre, M, 146);
  if (cli.cuit) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gris); doc.text('CUIT ' + cli.cuit, M, 160); }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...gris); doc.text('SUS DESCUENTOS POR ESCALA', W - M, 128, { align: 'right' });
  doc.setFontSize(9); let x = W - M; doc.setLineWidth(0.6); doc.setDrawColor(201, 207, 219);
  ['9', '8', '7', '6', '5'].forEach(d => {
    const a = 'D' + d + ' ', b = textoDesc(escala[d]);
    doc.setFont('helvetica', 'bold'); const wb = doc.getTextWidth(b); doc.setFont('helvetica', 'normal'); const wa = doc.getTextWidth(a);
    const w = wa + wb + 12; x -= w;
    doc.roundedRect(x, 136, w, 18, 3, 3); doc.setTextColor(...tinta); doc.text(a, x + 6, 148); doc.setFont('helvetica', 'bold'); doc.text(b, x + 6 + wa, 148);
    x -= 5;
  });
  // tabla
  doc.autoTable({
    startY: 176, margin: { left: M, right: M },
    head: [['Código', 'Descripción', 'Marca', 'Cant', 'Precio lista', 'Desc.', 'Unitario + IVA', 'Subtotal + IVA']],
    body: p.items.map(l => [l.cod, l.desc + (l.reemplazaA ? '\nReemplaza a ' + l.reemplazaA : ''), marcaDe(l), String(l.cant), fmt(l.listaArs), pctTxt(l.descPct), fmt(l.unit), fmt(l.sub)]),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: tinta, lineColor: [221, 226, 234], lineWidth: { bottom: 0.6 } },
    headStyles: { fillColor: tinta, textColor: 255, fontStyle: 'bold', lineWidth: 0 },
    columnStyles: { 0: { cellWidth: 66 }, 2: { cellWidth: 50 }, 3: { halign: 'right', cellWidth: 30 }, 4: { halign: 'right', cellWidth: 64 }, 5: { halign: 'right', cellWidth: 38 }, 6: { halign: 'right', cellWidth: 66 }, 7: { halign: 'right', cellWidth: 70 } },
    didParseCell: d => { if (d.section === 'head' && d.column.index >= 3) d.cell.styles.halign = 'right';
      if (d.section === 'body' && d.column.index === 5) { if (d.cell.raw !== '0%') { d.cell.styles.textColor = verde; d.cell.styles.fontStyle = 'bold'; } else d.cell.styles.textColor = gris; } },
    alternateRowStyles: { fillColor: [255, 255, 255] }
  });
  let y = doc.lastAutoTable.finalY + 22;
  if (y > H - 150) { doc.addPage(); y = 60; }
  // totales
  const xT = W - M - 220;
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(...gris);
  doc.text('Total a precio de lista', xT, y); doc.setTextColor(...tinta); doc.text(fmt(t.lista), W - M, y, { align: 'right' });
  y += 18; doc.setTextColor(...verde); doc.setFont('helvetica', 'bold'); doc.text('Su ahorro', xT, y); doc.text('-' + fmt(t.ahorro), W - M, y, { align: 'right' });
  y += 12; doc.setDrawColor(...tinta); doc.setLineWidth(1.5); doc.line(xT, y, W - M, y);
  y += 20; doc.setTextColor(...tinta); doc.setFontSize(14); doc.text('Total', xT, y); doc.text('$ ' + fmt(t.sub) + ' + IVA', W - M, y, { align: 'right' });
  // nota y observaciones (a la izquierda)
  let yN = y - 50; doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...gris);
  doc.text('Todos los precios son en pesos + IVA.', M, yN);
  if (p.notas) { yN += 18; doc.setFont('helvetica', 'bold'); doc.setTextColor(...tinta); doc.text('Observaciones:', M, yN); const wo = doc.getTextWidth('Observaciones: '); doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(p.notas, xT - M - wo - 16), M + wo, yN); }
  // pie
  doc.setDrawColor(221, 226, 234); doc.setLineWidth(0.6); doc.line(M, H - 70, W - M, H - 70);
  doc.setFontSize(8.5); doc.setTextColor(...gris); doc.text(doc.splitTextToSize(S.ajustes.pie || '', W - 2 * M), M, H - 54);
  return doc;
}
function descargarPdf(p) {
  pdfPresupuesto(p).save(nombrePdf(p));
  anotarHistorial(p, 'PDF descargado');
}
function anotarHistorial(p, texto) {
  if (p.borrador || !p.id) return;
  const q = S.presupuestos.find(x => x.id === p.id); if (!q) return;
  q.historial.push({ fecha: ahoraTxt(), texto }); guardar('presupuestos');
  enviarOp({ tipo: 'guardarDoc', tabla: 'presupuestos', doc: presuADoc(q), reg: { tipo: 'Presupuesto', detalle: numPresu(q) + ': ' + texto } }).catch(() => {});
}
// WhatsApp: el link de WhatsApp no puede adjuntar archivos. Se ofrece compartir el PDF (Windows / celular)
// o descargarlo y abrir el chat del cliente para arrastrarlo.
let presuWa = null;
function enviarWhatsApp(p) {
  presuWa = p;
  const cli = cliente(p.clienteId) || {};
  const puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] }));
  abrirModal(`<h3 style="margin-top:0">Mandar el presupuesto por WhatsApp</h3>
    <p class="muted">Se manda el PDF del presupuesto${cli.whatsapp ? ' a ' + esc(cli.whatsapp) : ''}.</p>
    <div class="grid ${puedeCompartir ? 'g2' : ''}">
      ${puedeCompartir ? `<div class="panel"><b>Compartir el PDF</b><p class="muted" style="font-size:13px">Abre el menú “Compartir” de Windows o del celular: elegís WhatsApp y el contacto.</p><button class="btn pri" onclick="compartirPdf()">Compartir PDF</button></div>` : ''}
      <div class="panel"><b>Descargar y abrir WhatsApp</b><p class="muted" style="font-size:13px">Se descarga el PDF y se abre ${cli.whatsapp ? 'el chat del cliente' : 'WhatsApp'}. Después arrastrás el PDF (está en Descargas) al chat.</p><button class="btn ${puedeCompartir ? '' : 'pri'}" onclick="descargarYAbrirWa()">Descargar y abrir WhatsApp</button></div>
    </div>
    ${cli.whatsapp ? '' : '<p class="muted" style="font-size:12px">Este cliente no tiene WhatsApp cargado en su ficha: vas a tener que elegir el contacto.</p>'}
    <div class="fila" style="justify-content:flex-end;margin-top:12px"><button class="btn" onclick="cerrarModal()">Cerrar</button></div>`);
}
async function compartirPdf() {
  const p = presuWa; const nombre = nombrePdf(p);
  const file = new File([pdfPresupuesto(p).output('blob')], nombre, { type: 'application/pdf' });
  try { await navigator.share({ files: [file], title: nombre.replace('.pdf', '') }); anotarHistorial(p, 'PDF compartido'); cerrarModal(); }
  catch (e) { if (e.name !== 'AbortError') aviso('No se pudo compartir: ' + e.message + '. Probá con “Descargar y abrir WhatsApp”.', 'err'); }
}
function descargarYAbrirWa() {
  const p = presuWa; const cli = cliente(p.clienteId) || {};
  pdfPresupuesto(p).save(nombrePdf(p));
  const tel = String(cli.whatsapp || '').replace(/\D/g, '');
  const txt = `Hola, te envío el presupuesto ${p.borrador ? '' : 'N.º ' + numPresu(p) + ' '}(válido hasta ${fechaAR(p.hasta)}).`;
  window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(txt), '_blank');
  anotarHistorial(p, 'Enviado por WhatsApp (PDF)'); cerrarModal();
  aviso('PDF descargado: ' + nombrePdf(p) + '\nArrastralo al chat de WhatsApp.', 'ok');
}
function exportarPresupuesto(p) {
  const t = totales(p.items);
  const filas = [['Presupuesto', p.borrador ? '(sin guardar)' : numPresu(p)], ['Cliente', p.clienteNombre], ['Fecha', fechaAR(p.fecha)], ['Válido hasta', fechaAR(p.hasta)], ['Precios en pesos + IVA'], [],
    ['Código', 'Descripción', 'Marca', 'Reemplaza a', 'Cant', 'Precio lista', 'Desc %', 'Unitario + IVA', 'Subtotal + IVA']];
  p.items.forEach(l => filas.push([valorCelda(l.cod), l.desc, marcaDe(l), l.reemplazaA ? valorCelda(l.reemplazaA) : '', l.cant, l.listaArs, l.descPct, l.unit, l.sub]));
  filas.push([], ['', '', '', '', '', '', '', 'Total a precio de lista', t.lista], ['', '', '', '', '', '', '', 'Su ahorro', -t.ahorro], ['', '', '', '', '', '', '', 'Total + IVA', t.sub]);
  if (p.notas) filas.push([], ['Observaciones', p.notas]);
  const ws = XLSX.utils.aoa_to_sheet(filas); ws['!cols'] = [{ wch: 14 }, { wch: 42 }, { wch: 10 }, { wch: 14 }, { wch: 6 }, { wch: 14 }, { wch: 8 }, { wch: 22 }, { wch: 16 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto');
  XLSX.writeFile(wb, nombrePdf(p).replace(/\.pdf$/, '.xlsx'));
}
function valorCelda(v) { const s = String(v === undefined || v === null ? '' : v); return /^\d{1,15}$/.test(s) ? Number(s) : s; }
