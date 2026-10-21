import {readFile} from 'node:fs/promises';
import {loadEnvironment,printSafeError} from './lib/environment.mjs';

async function main(){
  const {ref}=loadEnvironment();
  const origin=new URL(process.argv.find(value=>value.startsWith('--origin='))?.slice(9)??'https://myanmarlogistics.vercel.app').origin;
  if(!origin.startsWith('https://'))throw new Error('Use the deployed HTTPS application origin.');
  if(!process.env.SUPABASE_ACCESS_TOKEN)throw new Error('Supabase management access is required.');
  const endpoint=`https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers={Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'};
  const response=await fetch(endpoint,{headers,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Auth configuration read failed: '+response.status);
  const current=await response.json();
  const allowed=new Set((current.uri_allow_list??'').split(',').map(value=>value.trim()).filter(Boolean));
  for(const base of [origin,'http://localhost:3000','http://127.0.0.1:3000','http://127.0.0.1:3100'])allowed.add(base+'/auth/callback');
  const redirectsOnly=process.argv.includes('--redirects-only');
  const patch={site_url:origin,uri_allow_list:[...allowed].join(','),...(!redirectsOnly?{
    mailer_subjects_invite:'Myanmar Trading — Driver invitation',
    mailer_templates_invite_content:await readFile('supabase/templates/driver-invite.html','utf8'),
    mailer_subjects_recovery:'Myanmar Trading — Password setup',
    mailer_templates_recovery_content:await readFile('supabase/templates/password-recovery.html','utf8')}:{})};
  console.log(JSON.stringify({site_url:patch.site_url,redirect_allow_list:patch.uri_allow_list,templates:redirectsOnly?'Existing templates preserved':'Explicit token-hash confirmation',apply:process.argv.includes('--apply')},null,2));
  if(!process.argv.includes('--apply'))return;
  const update=await fetch(endpoint,{method:'PATCH',headers,body:JSON.stringify(patch),signal:AbortSignal.timeout(20000)});
  if(!update.ok)throw new Error('Auth configuration update failed: '+update.status);
  console.log('Driver authentication configuration updated. No emails sent.');
}
main().catch(printSafeError);
