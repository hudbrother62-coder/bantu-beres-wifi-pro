// Shared import/export contract for Bantu Beres WiFi Pro customer data.
export const CUSTOMER_HEADERS = ['nama','telepon','alamat','paket','harga_bulanan','jatuh_tempo','status','mulai','catatan'];
const EXCELJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
let excelLoader;

function normalize(value) {
  return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
}
function canonicalHeader(value) {
  const key=normalize(value);
  const names={nama_lengkap:'nama',full_name:'nama',nomor_wa:'telepon',no_wa:'telepon',no_hp:'telepon',phone:'telepon',nomor_telepon:'telepon',address:'alamat',nama_paket:'paket',package:'paket',harga:'harga_bulanan',monthly_price:'harga_bulanan',tanggal_jatuh_tempo:'jatuh_tempo',due_day:'jatuh_tempo',tanggal_mulai:'mulai',started_at:'mulai',notes:'catatan'};
  return names[key]||key;
}
function csvCell(value) {
  let v=String(value??'');
  // Prevent a CSV opened in a spreadsheet from executing user-supplied formula text.
  if (/^[\s]*[=+\-@]/.test(v)) v="'"+v;
  return '"'+v.replace(/"/g,'""')+'"';
}
function saveFile(blob,filename) {
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function csvDownload(matrix,filename) {
  const csv=matrix.map(row=>row.map(csvCell).join(',')).join('\r\n');
  saveFile(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}),filename);
}
function loadExcelJS() {
  if(window.ExcelJS?.Workbook) return Promise.resolve(window.ExcelJS);
  if(excelLoader) return excelLoader;
  excelLoader=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=EXCELJS_SRC;script.async=true;script.crossOrigin='anonymous';
    script.onload=()=>window.ExcelJS?.Workbook?resolve(window.ExcelJS):reject(new Error('Pustaka Excel tidak dapat dimuat. Gunakan template CSV jika jaringan memblokir layanan Excel.'));
    script.onerror=()=>{script.remove();reject(new Error('Tidak dapat memuat dukungan Excel. Periksa koneksi internet atau gunakan CSV.'));};
    document.head.append(script);
  }).catch(err=>{excelLoader=null;throw err;});
  return excelLoader;
}
function buildWorkbook(ExcelJS, rows, withGuide) {
  const workbook=new ExcelJS.Workbook();
  workbook.creator='Bantu Beres WiFi Pro';
  const sheet=workbook.addWorksheet('Pelanggan',{views:[{state:'frozen',ySplit:1}]});
  sheet.addRow(CUSTOMER_HEADERS);
  sheet.columns=[{width:26},{width:19},{width:38},{width:24},{width:20},{width:17},{width:17},{width:19},{width:34}];
  const header=sheet.getRow(1);header.height=29;
  header.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF243B65'}};cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.alignment={vertical:'middle'};});
  sheet.getColumn(2).numFmt='@';sheet.getColumn(8).numFmt='@';
  rows.forEach(row=>sheet.addRow(row.map(x=>x??'')));
  sheet.autoFilter='A1:I1';
  if(withGuide){
    for(let n=2;n<=101;n++){sheet.getCell('G'+n).dataValidation={type:'list',allowBlank:true,formulae:['"active,isolated,inactive"']};}
    const guide=workbook.addWorksheet('Panduan');
    guide.columns=[{width:23},{width:85},{width:37}];
    guide.addRow(['BANTU BERES WIFI PRO','PANDUAN TEMPLATE IMPOR PELANGGAN','']);
    guide.addRow([]);
    guide.addRow(['Kolom','Petunjuk','Contoh (hanya panduan, bukan data impor)']);
    [
      ['nama','Wajib. Nama lengkap pelanggan.','Budi Santoso'],
      ['telepon','Teks untuk mempertahankan angka 0 di depan.','081234567890'],
      ['alamat','Alamat pemasangan.','Jl. Mawar No. 10'],
      ['paket','Wajib: harus cocok dengan nama paket yang dibuat di aplikasi.','Paket 20 Mbps'],
      ['harga_bulanan','Opsional. Harga impor selalu disinkronkan dari paket.','150000'],
      ['jatuh_tempo','Isi angka 1–31. Kosong berarti tanggal 10.','10'],
      ['status','active, isolated, inactive. Kosong berarti active.','active'],
      ['mulai','Tanggal mulai YYYY-MM-DD. Kosong berarti hari impor.','2026-09-29'],
      ['catatan','Keterangan tambahan, boleh dikosongkan.','Pemasangan selesai']
    ].forEach(row=>guide.addRow(row));
    guide.addRow([]);
    guide.addRow(['PENTING','Isi data pada sheet Pelanggan mulai baris ke-2, jangan ubah judul kolom.','']);
    guide.getRow(1).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF243B65'}};c.font={bold:true,color:{argb:'FFFFFFFF'}};});
    guide.getRow(3).font={bold:true,color:{argb:'FF243B65'}};
    guide.getRow(14).font={bold:true,color:{argb:'FF9A5B10'}};
  }
  return workbook;
}
async function downloadWorkbook(rows,filename,guide=false) {
  const ExcelJS=await loadExcelJS();
  const workbook=buildWorkbook(ExcelJS,rows,guide);
  const buffer=await workbook.xlsx.writeBuffer();
  saveFile(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),filename);
}
export async function downloadCustomerTemplate(format) {
  if(format==='csv'){csvDownload([CUSTOMER_HEADERS],'template-pelanggan-wifi-pro.csv');return;}
  if(format==='xlsx'){await downloadWorkbook([],'template-pelanggan-wifi-pro.xlsx',true);return;}
  throw new Error('Format template tidak dikenal.');
}
function customerMatrix(customers,packages) {
  return customers.map(c=>[
    c.full_name||'',c.phone||'',c.address||'',
    packages.find(p=>p.id===c.package_id)?.name||'',
    Number(c.monthly_price)||0,c.due_day||10,c.status||'active',c.started_at||'',c.notes||''
  ]);
}
export async function exportCustomerData(format,customers,packages,day) {
  const matrix=customerMatrix(customers,packages);
  if(format==='csv'){csvDownload([CUSTOMER_HEADERS,...matrix],'wifi-pro-pelanggan-'+day+'.csv');return;}
  if(format==='xlsx'){await downloadWorkbook(matrix,'wifi-pro-pelanggan-'+day+'.xlsx');return;}
  throw new Error('Format ekspor tidak dikenal.');
}
function parseCSV(text) {
  const source=text.replace(/^\uFEFF/,'');
  const first=(source.split(/\r?\n/)[0]||'');
  const sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(ch==='"'&&quoted&&source[i+1]==='"'){cell+='"';i++;}
    else if(ch==='"')quoted=!quoted;
    else if(ch===sep&&!quoted){row.push(cell);cell='';}
    else if((ch==='\r'||ch==='\n')&&!quoted){
      if(ch==='\r'&&source[i+1]==='\n')i++;
      row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);
      row=[];cell='';
    }else cell+=ch;
  }
  if(quoted)throw new Error('Format CSV tidak valid: tanda kutip belum ditutup.');
  if(cell||row.length){row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);}
  return rows;
}
function excelCell(cell) {
  const value=cell.value;
  if(value==null)return '';
  if(value instanceof Date)return value.toISOString().slice(0,10);
  if(typeof value==='object'){
    if('text' in value)return String(value.text||'');
    if('result' in value)return String(value.result??'');
    if('richText' in value)return value.richText.map(p=>p.text||'').join('');
    return String(cell.text||'');
  }
  return String(value);
}
export async function readCustomerFile(file) {
  if(!file || file.size>4*1024*1024)throw new Error('Gunakan file CSV/XLSX berukuran maksimal 4 MB.');
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  let matrix;
  if(ext==='csv')matrix=parseCSV(await file.text());
  else if(ext==='xlsx'){
    const ExcelJS=await loadExcelJS(),workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet=workbook.getWorksheet('Pelanggan')||workbook.worksheets[0];
    if(!sheet)throw new Error('Sheet pelanggan tidak ditemukan dalam file Excel.');
    matrix=[];
    for(let row=1;row<=sheet.rowCount;row++){
      const source=sheet.getRow(row),item=[];
      for(let col=1;col<=Math.max(9,sheet.getRow(1).cellCount);col++)item.push(excelCell(source.getCell(col)));
      matrix.push(item);
    }
  }else throw new Error('File harus .csv atau .xlsx. Untuk .xls, simpan ulang sebagai .xlsx terlebih dahulu.');
  if(!matrix.length)throw new Error('File kosong. Unduh template dan isi baris data terlebih dahulu.');
  const headers=matrix.shift().map(canonicalHeader);
  if(!headers.includes('nama')||!headers.includes('paket'))throw new Error('Kolom nama dan paket wajib ada. Gunakan template yang tersedia di aplikasi.');
  const rows=matrix.filter(row=>row.some(v=>String(v??'').trim())).map((row,i)=>({
    line:i+2,raw:Object.fromEntries(headers.map((key,n)=>[key,String(row[n]??'').trim()]))
  }));
  return rows;
}
function validDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===value;
}
export function validateCustomerRows(input,packages,customers,userId,day) {
  const errors=[],records=[],skipped=[];
  if(input.length>500)return {records:[],errors:['Maksimal 500 baris dalam satu proses impor. Pisahkan file terlebih dahulu.'],skipped:[],total:input.length};
  const key=(n,p)=>normalize(n)+'|'+String(p||'').replace(/\D/g,'');
  const existing=new Set(customers.filter(c=>c.full_name&&c.phone).map(c=>key(c.full_name,c.phone)));
  const seen=new Set();
  for(const item of input){
    const r=item.raw,number=item.line;
    const name=String(r.nama||'').trim(),phone=String(r.telepon||'').replace(/^'/,'').trim();
    const packName=String(r.paket||'').trim(),pkg=packages.find(p=>normalize(p.name)===normalize(packName));
    const statusRaw=normalize(r.status||'active');
    const statuses={aktif:'active',active:'active',terisolir:'isolated',isolated:'isolated',nonaktif:'inactive',inactive:'inactive'};
    const dueText=String(r.jatuh_tempo||'10').trim(),due=Number(dueText);
    const started=String(r.mulai||day).trim();
    const problems=[];
    if(!name)problems.push('nama kosong');
    if(!packName||!pkg)problems.push('paket "'+packName+'" tidak ditemukan; buat paket di menu Paket terlebih dahulu');
    if(!Number.isInteger(due)||due<1||due>31)problems.push('jatuh_tempo harus 1–31');
    if(!statuses[statusRaw])problems.push('status harus active/isolated/inactive');
    if(!validDate(started))problems.push('mulai harus YYYY-MM-DD');
    if(problems.length){errors.push('Baris '+number+': '+problems.join('; '));continue;}
    const fingerprint=key(name,phone);
    if(phone&&(existing.has(fingerprint)||seen.has(fingerprint))){skipped.push('Baris '+number+' ('+name+'): pelanggan dengan nama dan nomor yang sama sudah ada.');continue;}
    if(phone)seen.add(fingerprint);
    records.push({
      user_id:userId,full_name:name,phone,address:String(r.alamat||''),package_id:pkg.id,
      monthly_price:Number(pkg.monthly_price),due_day:due,status:statuses[statusRaw],
      started_at:started,notes:String(r.catatan||'')||null
    });
  }
  return {records,errors,skipped,total:input.length};
}
