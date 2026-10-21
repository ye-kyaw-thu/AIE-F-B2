import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signupSchema} from '../src/lib/auth/signup-validation.ts';
import {appOrigin} from '../src/lib/auth/app-origin.ts';

const valid={fullName:'Example Trader',email:'trader@example.invalid',password:'Long-unique-passphrase!',confirmPassword:'Long-unique-passphrase!'};
test('signup normalizes identity and excludes injected role metadata',()=>{
  const parsed=signupSchema.parse({...valid,email:'  TRADER@example.invalid  ',fullName:'  Example Trader  ',role:'admin',driver_id:'injected'});
  assert.equal(parsed.email,'trader@example.invalid');assert.equal(parsed.fullName,'Example Trader');assert.equal('role' in parsed,false);assert.equal('driver_id' in parsed,false);
});
test('signup rejects invalid names, email, weak length and password mismatch',()=>{
  for(const input of [{fullName:''},{fullName:'x'.repeat(121)},{email:'wrong'},{password:'short',confirmPassword:'short'},{confirmPassword:'Different-password'}])assert.equal(signupSchema.safeParse({...valid,...input}).success,false);
});
test('confirmation origin uses configuration and Vercel fallback, never a request header',()=>{
  assert.equal(appOrigin({NODE_ENV:'production',NEXT_PUBLIC_APP_URL:'https://myanmarlogistics.vercel.app/path'}),'https://myanmarlogistics.vercel.app');
  assert.equal(appOrigin({NODE_ENV:'production',NEXT_PUBLIC_APP_URL:'http://localhost:3000',VERCEL_PROJECT_PRODUCTION_URL:'myanmarlogistics.vercel.app'}),'https://myanmarlogistics.vercel.app');
  assert.equal(appOrigin({NODE_ENV:'development'}),'http://localhost:3000');
  for(const value of ['javascript:alert(1)','http://example.com','https://user:pass@example.com'])assert.throws(()=>appOrigin({NODE_ENV:'production',NEXT_PUBLIC_APP_URL:value}));
  assert.throws(()=>appOrigin({NODE_ENV:'production'}));
});
