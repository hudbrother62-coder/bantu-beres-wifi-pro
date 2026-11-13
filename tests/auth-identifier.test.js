import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLoginIdentifier, isEmailAlias, signInWithIdentifier } from '../src/auth-identifier.js';

test('username is converted to the existing synthetic auth email', async () => {
  let credentials;
  const client = { auth: { signInWithPassword: async data => { credentials=data; return {data:{user:{id:'user'}},error:null}; } } };
  const result=await signInWithIdentifier(client,'  RENDY92 ','correct password');
  assert.equal(credentials.email,'rendy92@wifi-users.bantuberes.com');
  assert.equal(result.error,null);
});
test('email alias is resolved server-side without exposing synthetic identity in the UI', async () => {
  let request, session;
  const client={
    functions:{invoke:async(name,options)=>{request={name,options};return {data:{access_token:'access',refresh_token:'refresh'},error:null};}},
    auth:{setSession:async tokens=>{session=tokens;return {data:{user:{id:'user'}},error:null};}}
  };
  const result=await signInWithIdentifier(client,'  TEST@EXAMPLE.COM ','correct password');
  assert.equal(request.name,'login-alias');
  assert.equal(request.options.body.email,'test@example.com');
  assert.deepEqual(session,{access_token:'access',refresh_token:'refresh'});
  assert.equal(result.error,null);
});
test('missing credentials do not call authentication',async()=>{
  const result=await signInWithIdentifier({},'','');
  assert.ok(result.error);
});
test('email alias failure does not start an unauthenticated session', async()=>{
  const result=await signInWithIdentifier({functions:{invoke:async()=>({data:null,error:new Error('denied')})}},'unknown@example.com','invalid');
  assert.ok(result.error);
});
test('legacy internal email uses existing auth flow',()=>{
  assert.equal(isEmailAlias('rendy92@wifi-users.bantuberes.com'),false);
  assert.equal(isEmailAlias('owner@example.com'),true);
  assert.equal(normalizeLoginIdentifier(' TEST '),'test');
});
