# Driver onboarding and confirmation recovery

Public signup creates Traders. Admin → Drivers reserves an invitation, Supabase sends an email, and trusted SQL links the newly invited Auth identity to an invited Driver profile. The Driver confirms the email, sets a password, and activates their account. Only active Drivers appear in assignment choices. Disabling a Driver blocks operational RLS/RPC access while preserving shipment history.

The default Supabase invitation may return `#access_token=...&refresh_token=...` rather than a PKCE `code`. A server route cannot read URL fragments. `/auth/callback` is now a confirmation page that supports fragments, PKCE codes, and custom token-hash templates. Tokens are verified only after the user clicks **Confirm and continue**. Existing signed-in accounts are never silently replaced; sign out and reopen the email when switching accounts.

## Already confirmed, but no password

Admin → Drivers → **Resend invitation** now sends a password-setup recovery email for the bound, confirmed Driver. It does not create a second account or change the Driver role. The Driver opens the latest email in a signed-out browser or private window, confirms, chooses a password, and reaches the Driver dashboard. Refresh the Admin directory afterward. Email acceptance alone leaves the invitation awaiting password setup.

Do not register the invited Driver through public signup, delete their account, or assign an Admin-created password. A signed-in invited Driver can resume at `/auth/driver-setup`.

## Configuration

- Server-only `SUPABASE_SECRET_KEY` in `.env.local` and Vercel; never `NEXT_PUBLIC_*`.
- Production `NEXT_PUBLIC_APP_URL=https://myanmarlogistics.vercel.app` in Vercel; local development may use `http://localhost:3000`.
- Hosted Supabase Site URL is the production origin. Allow exact `/auth/callback` URLs for production and the local origins used for testing.
- Invite and recovery email templates are in `supabase/templates/`. They use `.RedirectTo`, `.TokenHash`, and an allowlisted OTP type. Customize SMTP for production delivery; Supabase's built-in email service has restrictions and is not a production mail solution.

`node scripts/configure-driver-auth.mjs` previews redirects and templates. Add `--apply` to update the connected project; existing redirect entries are preserved. Use `--redirects-only --apply` to fix URLs while keeping existing templates. This script does not send emails or change SMTP credentials. Deploy callback code before applying the templates to a production project.

`node scripts/review-driver-onboarding.mjs DRIVER_EMAIL` reads only role/access/invitation state, email confirmation, and whether Auth has a password hash. A hash does not prove the Driver chose a password: invited Auth users may have provider-generated credentials. It never prints password hashes or authentication tokens.

References: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [password recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).
