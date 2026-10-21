import {loadEnvironment,printSafeError} from './lib/environment.mjs';

async function main(){
  const {ref}=loadEnvironment();
  if(!process.env.SUPABASE_ACCESS_TOKEN)throw new Error('Setup token required for read-only configuration review.');
  const response=await fetch('https://api.supabase.com/v1/projects/'+ref+'/config/auth',{headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Auth configuration read failed: '+response.status);
  const config=await response.json();
  // Deliberate allowlist: never print SMTP credentials or other Auth secrets.
  console.log(JSON.stringify({
    site_url:config.site_url,redirect_allow_list:config.uri_allow_list,
    signup_disabled:config.disable_signup,email_confirmation_required:!config.mailer_autoconfirm,
    email_provider_enabled:config.external_email_enabled,custom_smtp_configured:!!config.smtp_host,
    emails_per_hour:config.rate_limit_email_sent,per_recipient_cooldown_seconds:config.smtp_max_frequency,
  },null,2));
}
main().catch(printSafeError);
