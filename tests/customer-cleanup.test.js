import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateCustomerIds,financialCustomerIds } from '../src/customer-cleanup.js';
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
