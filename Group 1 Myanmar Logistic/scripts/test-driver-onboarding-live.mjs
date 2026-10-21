import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {loadEnvironment,printSafeError} from './lib/environment.mjs';
import {DEMO_PASSWORD} from './lib/demo-data.mjs';
async function main(){
  const {url,key}=loadEnvironment();
  const origin=new URL(process.env.TEST_APP_URL??'http://127.0.0.1:3100');
  assert.ok(['127.0.0.1','localhost'].includes(origin.hostname),'Local testing only.');
  for(const locale of ['en','my']){
    const response=await fetch(new URL('/auth/callback?token_hash='+ 'a'.repeat(64)+'&type=invite',origin),{headers:{Cookie:'logistics-language='+locale},redirect:'manual'});
    assert.equal(response.status,200);assert.match(response.headers.get('cache-control')??'',/no-store/);
    assert.equal(response.headers.get('referrer-policy'),'no-referrer');
    const html=await response.text();assert.ok(html.includes(locale==='en'?'Confirm and continue':'အတည်ပြုပြီး ဆက်သွားပါ'));
    assert.ok(!html.includes('confirmation-error'),'GET must render confirmation rather than reject or consume email links.');
  }
  const setup=await fetch(new URL('/auth/driver-setup',origin),{redirect:'manual'});
  assert.ok((setup.headers.get('location')??'').endsWith('/login')||(await setup.text()).includes('NEXT_REDIRECT;replace;/login;'));
  for(const role of ['admin','driver','trader']){
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    try{
      const login=await client.auth.signInWithPassword({email:`${role}@demo.com`,password:DEMO_PASSWORD});assert.equal(login.error,null);
      const jar=new Map();const ssr=createServerClient(url,key,{auth:{autoRefreshToken:false},cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
      assert.equal((await ssr.auth.setSession(login.data.session)).error,null);
      const headers={Cookie:[...jar].map(([name,value])=>name+'='+encodeURIComponent(value)).join('; ')+'; logistics-language=en'};
      const callback=await fetch(new URL('/auth/callback',origin),{headers,redirect:'manual'});assert.equal(callback.status,200);
      const html=await callback.text();assert.ok(html.includes('Continue to my account'));assert.ok(html.includes(`href="/${role}/dashboard"`));
      const directory=await fetch(new URL('/admin/drivers',origin),{headers,redirect:'manual'});const body=await directory.text();
      if(role==='admin'){assert.equal(directory.status,200);assert.ok(body.includes('Driver directory'));assert.ok(body.includes('Pending invitations'));}
      else{assert.ok(directory.status>=300&&directory.status<400||body.includes('NEXT_REDIRECT;'));assert.ok(!body.includes('Driver directory'));}
    }finally{await client.auth.signOut({scope:'local'});}
  }
  console.log('PASS: bilingual scanner-safe callback, no-cache/referrer headers, setup guard, current-account destinations and Admin-only directory. No emails sent or Driver accounts changed.');
}
main().catch(printSafeError);
