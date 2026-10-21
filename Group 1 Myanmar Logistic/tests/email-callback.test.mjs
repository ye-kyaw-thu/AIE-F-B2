import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCallbackUrl,emailLinkSchema} from '../src/lib/auth/callback.ts';
test('default invitation and recovery fragments are preserved for explicit confirmation',()=>{
  for(const type of ['invite','recovery'])assert.deepEqual(parseCallbackUrl(`https://example.com/auth/callback#access_token=access.jwt&refresh_token=refresh&type=${type}`),{kind:'session',accessToken:'access.jwt',refreshToken:'refresh'});
});
test('PKCE and custom template token hashes work without external destinations',()=>{
  assert.deepEqual(parseCallbackUrl('https://example.com/auth/callback?code=pkce-code&next=https://attacker.example'),{kind:'code',code:'pkce-code'});
  assert.deepEqual(parseCallbackUrl('https://example.com/auth/callback?token_hash='+ 'a'.repeat(64)+'&type=invite'),{kind:'token',tokenHash:'a'.repeat(64),type:'invite'});
  assert.equal(emailLinkSchema.safeParse({tokenHash:'a'.repeat(64),type:'admin'}).success,false);
});
test('expired links and incomplete or oversized fragments fail closed',()=>{
  for(const suffix of ['#error=access_denied&error_code=otp_expired','#access_token=only','?token_hash=bad&type=invite','#access_token='+ 'a'.repeat(8193)+'&refresh_token=refresh'])assert.equal(parseCallbackUrl('https://example.com/auth/callback'+suffix).kind,'error');
  assert.equal(parseCallbackUrl('https://example.com/auth/callback').kind,'empty');
});
