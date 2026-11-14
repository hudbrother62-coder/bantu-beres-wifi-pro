import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTransactionDocument, receiptMarkup, jpegToPdf} from '../src/receipt.js';

const customer={id:'customer-01',full_name:'Putri <Jaya>',phone:'08123456789',package_id:'package-01'};
const profile={business_name:'WiFi Zam Zam',business_address:'Malang',business_whatsapp:'0812555000'};
const pkg={id:'package-01',name:'20 Mbps'};
const invoice={id:'11111111-2222-3333-4444-555555555555',customer_id:customer.id,amount:150000,period:'2026-11-01',due_date:'2026-11-14',status:'partial',created_at:'2026-11-01T05:00:00Z'};
const payment={id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',customer_id:customer.id,invoice_id:invoice.id,amount:50000,method:'Transfer bank',paid_at:'2026-11-14T12:00:00Z',note:'Terima kasih'};

test('struk pembayaran berasal dari transaksi nyata dan tidak mengklaim pelunasan parsial',()=>{
 const doc=buildTransactionDocument({kind:'payment',record:payment,customer,invoice,profile,packageInfo:pkg});
 assert.equal(doc.title,'BUKTI PEMBAYARAN');
 assert.equal(doc.amount,50000);
 assert.match(doc.number,/^STR-20261114-/);
 assert.ok(doc.lines.some(([k,v])=>k==='Status tagihan'&&v==='Terbayar sebagian'));
 assert.ok(doc.lines.some(([k,v])=>k==='Periode layanan'&&v==='November 2026'));
 assert.match(doc.amountText,/50.000/);
 assert.match(doc.filename,/\.pdf$/);
 const markup=receiptMarkup(doc);
 assert.ok(markup.includes('Putri &lt;Jaya&gt;'));
 assert.ok(!markup.includes('Putri <Jaya>'));
});

test('invoice menampilkan jumlah pembayaran dan sisa yang benar',()=>{
 const doc=buildTransactionDocument({kind:'invoice',record:invoice,customer,profile,packageInfo:pkg,payments:[payment]});
 assert.equal(doc.amount,150000);
 assert.ok(doc.lines.some(([k,v])=>k==='Sudah dibayar'&&v.includes('50.000')));
 assert.ok(doc.lines.some(([k,v])=>k==='Sisa tagihan'&&v.includes('100.000')));
 assert.ok(doc.lines.some(([k,v])=>k==='Status'&&v==='Terbayar sebagian'));
});

test('transaksi dan pelanggan tidak boleh dipasangkan dengan id berbeda',()=>{
 assert.throws(()=>buildTransactionDocument({kind:'payment',record:payment,customer:{...customer,id:'other'}}),/belum lengkap/);
});

test('pdf berisi header, objek gambar, xref, dan footer',async()=>{
 const jpeg=new Uint8Array([255,216,255,217]);
 const file=jpegToPdf(jpeg,100,200,58);
 assert.equal(file.type,'application/pdf');
 const buffer=await file.arrayBuffer();
 const pdf=new TextDecoder().decode(buffer);
 assert.ok(pdf.startsWith('%PDF-1.4'));
 assert.match(pdf,/\/Subtype \/Image/);
 assert.match(pdf,/\/MediaBox \[0 0 164\.41/);
 assert.match(pdf,/startxref\n\d+\n%%EOF$/);
 assert.ok(file.size>400);
});
