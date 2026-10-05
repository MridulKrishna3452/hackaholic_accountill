import PDFDocument from 'pdfkit';
import { lineTotal } from './money.js';

const fmt = (cents, cur) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(cents / 100);
const INK = '#1d2a24', MUTED = '#6b756f', ACCENT = '#1f5c47', RULE = '#d9d4c7';
export const invoiceLabel = (n) => `INV-${String(n).padStart(4, '0')}`;

/** Renders an invoice to a Buffer entirely in memory. Nothing touches the disk. */
export function renderInvoicePdf({ invoice, items, totals, client, seller, status }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: invoiceLabel(invoice.number) } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 56;
    const right = doc.page.width - 56;
    const width = right - left;
    let y = 56;
    const logo = /^data:image\/(png|jpeg);base64,(.+)$/.exec(seller.logo || '');
    if (logo) {
      try { doc.image(Buffer.from(logo[2], 'base64'), left, y, { fit: [90, 50] }); } catch { /* unreadable logo: skip */ }
    }
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(26).text('Invoice', left, y, { width, align: 'right' });
    doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(invoiceLabel(invoice.number), left, y + 32, { width, align: 'right' });
    y += 76;

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(seller.business_name || seller.name, left, y);
    doc.font('Helvetica').fillColor(MUTED).fontSize(9.5)
      .text([seller.address, seller.email, seller.phone, seller.website].filter(Boolean).join('\n'), left, doc.y + 2, { width: 240 });
    const sellerEnd = doc.y;

    doc.fillColor(MUTED).fontSize(9).text('BILLED TO', 330, y);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(client.name, 330, y + 13, { width: right - 330 });
    doc.font('Helvetica').fillColor(MUTED).fontSize(9.5)
      .text([client.address, client.email].filter(Boolean).join('\n'), 330, doc.y + 2, { width: right - 330 });
    y = Math.max(sellerEnd, doc.y) + 24;

    [['Issued', invoice.issue_date], ['Due', invoice.due_date], ['Status', status.toUpperCase()]].forEach(([k, v], i) => {
      const x = left + i * 130;
      doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(k.toUpperCase(), x, y);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(v, x, y + 12);
    });
    y += 50;

    const col = { desc: left, qty: left + 245, unit: left + 300, amt: left + 385 };
    doc.moveTo(left, y).lineTo(right, y).strokeColor(INK).lineWidth(1).stroke();
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8.5);
    doc.text('DESCRIPTION', col.desc, y + 8);
    doc.text('QTY', col.qty, y + 8, { width: 50, align: 'right' });
    doc.text('UNIT', col.unit, y + 8, { width: 75, align: 'right' });
    doc.text('AMOUNT', col.amt, y + 8, { width: right - col.amt, align: 'right' });
    y += 26;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(RULE).lineWidth(0.5).stroke();

    doc.font('Helvetica').fontSize(10);
    for (const it of items) {
      const h = doc.heightOfString(it.description, { width: 235 });
      if (y + h + 120 > doc.page.height - 56) { doc.addPage(); y = 56; }
      doc.fillColor(INK).font('Helvetica').fontSize(10);
      doc.text(it.description, col.desc, y + 8, { width: 235 });
      doc.text(String(it.quantity_milli / 1000), col.qty, y + 8, { width: 50, align: 'right' });
      doc.text(fmt(it.unit_cents, invoice.currency), col.unit, y + 8, { width: 75, align: 'right' });
      doc.text(fmt(lineTotal(it), invoice.currency), col.amt, y + 8, { width: right - col.amt, align: 'right' });
      y += h + 18;
      doc.moveTo(left, y).lineTo(right, y).strokeColor(RULE).lineWidth(0.5).stroke();
    }

    y += 14;
    if (y + 110 > doc.page.height - 56) { doc.addPage(); y = 56; }
    const rows = [['Subtotal', totals.subtotal], [`Tax (${invoice.tax_bps / 100}%)`, totals.tax], ['Total', totals.total], ['Paid', totals.paid]];
    for (const [k, v] of rows) {
      const strong = k === 'Total';
      doc.font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(strong ? 12 : 10).fillColor(strong ? INK : MUTED);
      doc.text(k, col.unit - 10, y, { width: 90 });
      doc.text(fmt(v, invoice.currency), col.amt, y, { width: right - col.amt, align: 'right' });
      y += strong ? 22 : 17;
    }
    doc.rect(col.unit - 16, y + 2, right - col.unit + 16, 30).fill(ACCENT);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('Balance due', col.unit - 6, y + 11);
    doc.text(fmt(totals.balance, invoice.currency), col.amt, y + 11, { width: right - col.amt - 8, align: 'right' });
    y += 52;

    for (const [k, v] of [['Notes', invoice.notes], ['Payment details', seller.payment_details]].filter(([, v]) => v)) {
      if (y + 60 > doc.page.height - 56) { doc.addPage(); y = 56; }
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8.5).text(k.toUpperCase(), left, y);
      doc.fillColor(INK).font('Helvetica').fontSize(10).text(v, left, y + 12, { width: 330 });
      y = doc.y + 16;
    }
    doc.end();
  });
}
