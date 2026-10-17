export function duplicateCustomerIds(customers) {
 const grouped=new Map();
 for(const c of customers){
  const name=String(c.full_name||'').trim().toLocaleLowerCase('id').replace(/\s+/g,' ');
  const phone=String(c.phone||'').replace(/\D/g,'').replace(/^62(?=\d)/,'0');
  if(!name||phone.length<8)continue;
  const key=name+'|'+phone;
  grouped.set(key,[...(grouped.get(key)||[]),c.id]);
 }
 return new Set([...grouped.values()].filter(ids=>ids.length>1).flat());
}
export function financialCustomerIds(ids,invoices,payments) {
 const targets=new Set(ids);
 return new Set([...invoices,...payments].filter(r=>targets.has(r.customer_id)).map(r=>r.customer_id));
}

export function duplicatePaymentIds(payments){
 const groups=new Map();
 for(const p of payments){
  const date=String(p.paid_at||'').slice(0,10);
  const amount=Number(p.amount);
  if(!p.customer_id||!date||!Number.isFinite(amount))continue;
  const method=String(p.method||'').trim().toLocaleLowerCase('id').replace(/\s+/g,' ');
  const key=[p.customer_id,p.invoice_id||'manual',date,amount.toFixed(2),method].join('|');
  groups.set(key,[...(groups.get(key)||[]),p.id]);
 }
 return new Set([...groups.values()].filter(ids=>ids.length>1).flat());
}
export function calculateInvoiceStatus(amount,payments){
 const paid=payments.reduce((n,p)=>n+Number(p.amount||0),0);
 return paid<=0?'unpaid':paid>=Number(amount)?'paid':'partial';
}
