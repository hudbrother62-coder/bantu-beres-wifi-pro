// Receipt/Invoice generator for authenticated WiFi Pro transaction records.
// No remote PDF service, credentials, or database mutations are required.
const rupiah = value => new Intl.NumberFormat('id-ID', {style: 'currency', currency: 'IDR', maximumFractionDigits: 0}).format(Number(value || 0));
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const dateID = value => {
  const day = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '—';
  return new Intl.DateTimeFormat('id-ID', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(day + 'T12:00:00Z'));
};
const monthID = value => {
  const month = String(value || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return '—';
  return new Intl.DateTimeFormat('id-ID', {month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(month + '-01T12:00:00Z'));
};
const safeSize = size => Number(size) === 58 ? 58 : 80;
const cleanText = value => String(value ?? '').trim();

export function buildTransactionDocument({kind, record, customer, invoice = null, profile = {}, packageInfo = null, payments = []}) {
  if (!['payment', 'invoice'].includes(kind)) throw new Error('Jenis dokumen tidak dikenal.');
  if (!record?.id || !customer?.id || record.customer_id !== customer.id) throw new Error('Data transaksi atau pelanggan belum lengkap.');
  const isPayment = kind === 'payment';
  const sourceInvoice = isPayment ? invoice : record;
  const date = isPayment ? record.paid_at : record.created_at;
  const compactDate = String(date || '').slice(0, 10).replace(/-/g, '');
  const id = String(record.id).replace(/[^a-z0-9]/gi, '').toUpperCase();
  const number = (isPayment ? 'STR' : 'INV') + '-' + (compactDate || '00000000') + '-' + id.slice(0, 8) + id.slice(-4);
  const amount = Number(record.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Nominal transaksi tidak valid.');
  const name = cleanText(profile.business_name) || 'Usaha WiFi';
  const address = [profile.business_address, profile.business_city].map(cleanText).filter(Boolean).join(', ');
  const contact = cleanText(profile.business_whatsapp || profile.business_phone || '');
  const lines = [
    ['No. dokumen', number],
    [isPayment ? 'Tanggal bayar' : 'Tanggal dibuat', dateID(date)],
    ['Pelanggan', cleanText(customer.full_name) || 'Pelanggan']
  ];
  if (customer.phone) lines.push(['Telepon', cleanText(customer.phone)]);
  if (packageInfo?.name) lines.push(['Paket internet', cleanText(packageInfo.name)]);
  if (sourceInvoice?.period) lines.push(['Periode layanan', monthID(sourceInvoice.period)]);
  if (!isPayment && record.due_date) lines.push(['Jatuh tempo', dateID(record.due_date)]);
  if (isPayment) {
    lines.push(['Cara bayar', cleanText(record.method) || 'Tunai']);
    if (sourceInvoice) lines.push(['Status tagihan', sourceInvoice.status === 'paid' ? 'Lunas' : sourceInvoice.status === 'partial' ? 'Terbayar sebagian' : 'Belum lunas']);
  } else {
    const paid = payments.filter(p => p.invoice_id === record.id).reduce((sum,p) => sum + Math.max(0, Number(p.amount) || 0), 0);
    lines.push(['Sudah dibayar', rupiah(paid)]);
    lines.push(['Sisa tagihan', rupiah(Math.max(0, amount - paid))]);
    lines.push(['Status', paid >= amount && amount > 0 ? 'Lunas' : paid > 0 ? 'Terbayar sebagian' : 'Belum lunas']);
  }
  const note = cleanText(record.note);
  if (note) lines.push(['Catatan', note]);
  return {
    kind,
    title: isPayment ? 'BUKTI PEMBAYARAN' : 'INVOICE TAGIHAN WIFI',
    number,
    businessName: name,
    address,
    contact,
    lines,
    amount,
    amountLabel: isPayment ? 'TOTAL DITERIMA' : 'TOTAL TAGIHAN',
    amountText: rupiah(amount),
    footer: isPayment ? 'Terima kasih, pembayaran telah dicatat.' : 'Terima kasih telah menggunakan layanan kami.',
    filename: (isPayment ? 'Struk-' : 'Invoice-') + number + '.pdf'
  };
}

export function receiptMarkup(doc) {
  const rows = doc.lines.map(([label, value]) => '<div class="r-row"><dt>' + html(label) + '</dt><dd>' + html(value) + '</dd></div>').join('');
  return '<div class="receipt-paper"><div class="r-brand">' + html(doc.businessName) +
    '</div>' + (doc.address ? '<div class="r-center">' + html(doc.address) + '</div>' : '') +
    (doc.contact ? '<div class="r-center">Kontak: ' + html(doc.contact) + '</div>' : '') +
    '<div class="r-dashes"></div><div class="r-title">' + html(doc.title) +
    '</div><dl class="r-rows">' + rows + '</dl><div class="r-dashes"></div>' +
    '<div class="r-total"><span>' + html(doc.amountLabel) + '</span><strong>' + html(doc.amountText) + '</strong></div>' +
    '<div class="r-dashes"></div><p class="r-footer">' + html(doc.footer) + '</p>' +
    '<p class="r-footer small">Diterbitkan oleh Bantu Beres WiFi Pro</p></div>';
}

const printCss = size => 'html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,sans-serif}' +
  '.receipt-paper{width:' + safeSize(size) + 'mm;max-width:100%;box-sizing:border-box;padding:5mm 3mm;margin:auto;background:white;font-size:11px}' +
  '.r-brand{text-align:center;font-size:16px;font-weight:800;overflow-wrap:anywhere}.r-center{text-align:center;margin:3px 0;overflow-wrap:anywhere}' +
  '.r-dashes{border-top:1px dashed #555;margin:13px 0}.r-title{text-align:center;font-size:13px;font-weight:700;letter-spacing:.035em;margin:12px 0}' +
  '.r-rows{margin:0}.r-row{display:flex;gap:8px;justify-content:space-between;margin:8px 0;align-items:baseline}.r-row dt{flex:0 0 39%;color:#444}.r-row dd{margin:0;text-align:right;flex:1;overflow-wrap:anywhere}' +
  '.r-total{display:flex;flex-direction:column;gap:6px;text-align:center}.r-total span{font-size:10px;font-weight:700}.r-total strong{font-size:19px;overflow-wrap:anywhere}' +
  '.r-footer{text-align:center;line-height:1.45;overflow-wrap:anywhere}.r-footer.small{font-size:9px;color:#555}' +
  '.print-toolbar{text-align:center;padding:12px}.print-toolbar button{border:0;border-radius:8px;background:#262f8f;color:white;padding:12px 18px;font-weight:700}' +
  '@media print{.print-toolbar{display:none!important}body{width:' + safeSize(size) + 'mm} .receipt-paper{margin:0;page-break-inside:avoid}}';

export function printTransactionDocument(doc, size = 80, openWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null) {
  if (!openWindow) throw new Error('Jendela cetak diblokir. Izinkan pop-up untuk situs ini.');
  openWindow.document.open();
  openWindow.document.write('<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + html(doc.title) + ' - ' + html(doc.number) + '</title><style>' + printCss(size) + '</style></head><body>' +
    '<div class="print-toolbar"><button type="button" onclick="window.print()">Cetak / Simpan PDF</button></div>' +
    receiptMarkup(doc) + '<script>window.addEventListener("load",function(){window.focus();setTimeout(function(){window.print()},300)})<\/script></body></html>');
  openWindow.document.close();
}

function wrapLine(ctx, text, width) {
  const words = String(text).split(/\s+/);
  const rows = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (ctx.measureText(candidate).width <= width) { line = candidate; continue; }
    if (line) { rows.push(line); line = ''; }
    let chunk = '';
    for (const char of word) {
      if (chunk && ctx.measureText(chunk + char).width > width) { rows.push(chunk); chunk = ''; }
      chunk += char;
    }
    line = chunk;
  }
  if (line) rows.push(line);
  return rows.length ? rows : [''];
}

// Rasterise the receipt using the browser's own Unicode fonts so Indonesian names
// (including non-Latin characters) remain legible in an offline PDF.
export function drawReceiptCanvas(doc, size = 80) {
  if (typeof document === 'undefined') throw new Error('Pembuatan PDF memerlukan browser.');
  const width = safeSize(size) === 58 ? 464 : 640, pad = 32, maxTextWidth = width - pad * 2;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('Browser tidak mendukung pembuatan gambar PDF.');
  const commands = [];
  let y = 28;
  function write(text, font = '21px Arial', align = 'left', extra = 0) {
    measure.font = font;
    const rows = wrapLine(measure, text, maxTextWidth);
    const lineHeight = font.includes('bold') ? 31 : 28;
    for (const row of rows) { commands.push({text: row, font, align, y: y + lineHeight}); y += lineHeight; }
    y += extra;
  }
  function divider() { y += 10; commands.push({divider: true, y}); y += 13; }
  write(doc.businessName, 'bold 29px Arial', 'center', 7);
  if (doc.address) write(doc.address, '20px Arial', 'center', 3);
  if (doc.contact) write('Kontak: ' + doc.contact, '20px Arial', 'center', 3);
  divider();
  write(doc.title, 'bold 24px Arial', 'center', 8);
  doc.lines.forEach(([label, value]) => {
    write(label, '19px Arial', 'left');
    write(value, 'bold 22px Arial', 'right', 7);
  });
  divider();
  write(doc.amountLabel, 'bold 21px Arial', 'center', 3);
  write(doc.amountText, 'bold 34px Arial', 'center', 7);
  divider();
  write(doc.footer, '20px Arial', 'center', 5);
  write('Diterbitkan oleh Bantu Beres WiFi Pro', '18px Arial', 'center', 6);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.ceil(y + 28);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung pembuatan PDF.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111';
  for (const command of commands) {
    if (command.divider) {
      ctx.save();
      ctx.setLineDash([9, 6]);
      ctx.strokeStyle = '#777';
      ctx.beginPath();
      ctx.moveTo(pad, command.y);
      ctx.lineTo(width - pad, command.y);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    ctx.font = command.font;
    ctx.textAlign = command.align;
    ctx.fillText(command.text, command.align === 'center' ? width / 2 : command.align === 'right' ? width - pad : pad, command.y);
  }
  return canvas;
}

// One JPEG image embedded as a standards-compliant single-page PDF.
// This avoids CDN scripts and preserves the rendered receipt exactly.
export function jpegToPdf(jpeg, imageWidth, imageHeight, paperMm = 80) {
  if (!(jpeg instanceof Uint8Array) || !jpeg.length || imageWidth <= 0 || imageHeight <= 0) throw new Error('Data gambar PDF tidak valid.');
  const encoder = new TextEncoder(), chunks = [];
  let length = 0;
  function push(data) {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  }
  const offsets = [0], pageWidth = (safeSize(paperMm) * 72 / 25.4).toFixed(2);
  const pageHeight = (Number(pageWidth) * imageHeight / imageWidth).toFixed(2);
  function startObject(index) { offsets[index] = length; push(index + ' 0 obj\n'); }
  push('%PDF-1.4\n');
  startObject(1); push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObject(2); push('<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n');
  startObject(3); push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageWidth + ' ' + pageHeight + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
  startObject(4); push('<< /Type /XObject /Subtype /Image /Width ' + imageWidth + ' /Height ' + imageHeight + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n');
  push(jpeg); push('\nendstream\nendobj\n');
  const content = 'q\n' + pageWidth + ' 0 0 ' + pageHeight + ' 0 0 cm\n/Im0 Do\nQ\n';
  startObject(5); push('<< /Length ' + encoder.encode(content).length + ' >>\nstream\n' + content + 'endstream\nendobj\n');
  const startXref = length;
  push('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
  push('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + startXref + '\n%%EOF');
  const file = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) { file.set(chunk, at); at += chunk.length; }
  return new Blob([file], {type: 'application/pdf'});
}

export async function transactionPdf(doc, size = 80) {
  const canvas = drawReceiptCanvas(doc, size);
  const jpeg = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Gagal membuat PDF.')), 'image/jpeg', 0.94));
  return jpegToPdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height, size);
}

export function downloadTransactionPdf(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function shareTransactionPdf(doc, size = 80) {
  const pdf = await transactionPdf(doc, size);
  const file = new File([pdf], doc.filename, {type:'application/pdf'});
  if (navigator.canShare?.({files:[file]}) && navigator.share) {
    await navigator.share({title: doc.title, text: doc.businessName + ' - ' + doc.number, files:[file]});
    return 'shared';
  }
  downloadTransactionPdf(pdf, doc.filename);
  return 'downloaded';
}
