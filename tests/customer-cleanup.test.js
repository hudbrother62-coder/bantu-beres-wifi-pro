import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateCustomerIds,financialCustomerIds,duplicatePaymentIds,calculateInvoiceStatus } from '../src/customer-cleanup.js';
test('detect potential duplicates with consistent Indonesian phone format',()=>{
 const ids=duplicateCustomerIds([
  {id:1,full_name:'  Siti   Aminah',phone:'0812-3456-7890'},
  {id:2,full_name:'siti aminah',phone:'+6281234567890'},
  {id:3,full_name:'Siti Aminah',phone:'08997776655'}
 ]);
 assert.deepEqual([...ids].sort(),[1,2]);
});
test('do not treat blank phone as duplicate',()=>{
 assert.equal(duplicateCustomerIds([{id:1,full_name:'Adi',phone:''},{id:2,full_name:'Adi',phone:''}]).size,0);
});
test('protect selected customers that have invoices or payments',()=>{
 assert.deepEqual([...financialCustomerIds(['a','b'],[{customer_id:'a'}],[{customer_id:'z'}])],['a']);
});

test('payment duplicates only for matching date, customer, amount, invoice and method',()=>{
 const duplicates=duplicatePaymentIds([
  {id:'a',customer_id:'c',invoice_id:'i',amount:100000,method:'Tunai',paid_at:'2026-10-11T07:00:00Z'},
  {id:'b',customer_id:'c',invoice_id:'i',amount:100000,method:'tunai',paid_at:'2026-10-11T12:00:00Z'},
  {id:'c',customer_id:'c',invoice_id:'i',amount:100000,method:'Tunai',paid_at:'2026-10-12T07:00:00Z'}
 ]);
 assert.deepEqual([...duplicates].sort(),['a','b']);
});
test('payment totals produce correct partial and paid invoice statuses',()=>{
 assert.equal(calculateInvoiceStatus(100000,[]),'unpaid');
 assert.equal(calculateInvoiceStatus(100000,[{amount:30000}]),'partial');
 assert.equal(calculateInvoiceStatus(100000,[{amount:30000},{amount:70000}]),'paid');
});
