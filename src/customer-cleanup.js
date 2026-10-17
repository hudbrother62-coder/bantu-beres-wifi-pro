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
