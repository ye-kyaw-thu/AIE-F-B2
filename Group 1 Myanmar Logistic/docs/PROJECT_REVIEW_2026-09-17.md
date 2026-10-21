# Project review — 17 September 2026

Reviewed the local source, migrations, auth and role guards, driver queue, existing tests and documentation, GitHub HEAD, and public HTTP responses at https://myanmarlogistics.vercel.app/. Remote and local HEAD matched `f146763` before these changes. This is a code and automated review; an interactive browser was unavailable, so mobile appearance and real email delivery still require acceptance testing.

## What is already built

- Trader requests, shipment details, editing before approval, tracking, documents and alerts.
- Admin assignment, approval, corrections, gate management and broadcasts.
- Driver status/location updates, device GPS, demo positions and evidence uploads.
- Leaflet maps, shipment history, Realtime subscriptions and private Storage.
- Supabase sessions, role-specific routes, database RLS and guarded mutation functions.
- An offline queue with manual synchronization from an already loaded driver page.
- A reachable Vercel deployment. The deployed homepage still describes the early foundation rather than the implemented product.

## Findings and changes

| Priority | Finding | Resolution / next action |
| --- | --- | --- |
| High | Supabase Auth Site URL is `http://localhost:3000`, with an empty redirect allowlist. Confirmation is enabled. | Configure the production URLs below before inviting users. Settings were inspected read-only. |
| High | Custom SMTP is not configured. Default Supabase mail is restricted and unsuitable for public registration. | Configure a verified sender and custom SMTP; then test real email confirmation. |
| High | Alert RPC checks used `role <> 'admin'` / `role <> 'trader'`; a missing profile returns NULL, bypassing the explicit guard. | Added migration `20260917000100_alert_auth_guards.sql`, checking missing identity and using `IS DISTINCT FROM`. Regression tests cover missing profiles and identities. **Migration must be applied to the hosted database.** |
| Medium | Public homepage advertised unfinished foundation work; signup was absent. | Replaced homepage; added `/signup`, confirmation callback, validated Trader registration and redesigned login. Signup never accepts a role; the existing database trigger assigns Trader. |
| Medium | Offline toggle was hidden when the queue was empty. Existing UI failed lint. | Toggle is now visible and browser/queue subscriptions use React external-store subscriptions. Lint errors fixed. |
| Medium | Offline form reuses its request UUID, allowing a later queued update to replace an earlier one. Multiple updates also share a stale revision. | Next engineering priority: distinct capture IDs, explicit conflict/rebase policy, and real form-to-sync tests. See `src/components/driver/update-form.tsx` and `src/lib/offline/sync.ts`. |
| Medium | Offline sync does not explicitly check the current authenticated identity before replay. Queue contents lack complete shape validation. | Verify identity for each replay, validate persisted entries, handle storage failures and test account switching. Database assignment checks still apply. |
| Medium | Offline tests duplicate queue logic instead of importing the production module. | Replace copied logic with actual module tests plus browser offline/reconnect tests. Current passing results do not prove end-to-end offline behavior. |
| Medium | No password recovery or staff onboarding workflow. | Add forgot/reset password next; then an Admin-controlled Driver invitation workflow. Keep public signup Trader-only. |
| Acceptance | Device permissions, mobile layout, offline recovery and complete email signup have not been exercised interactively in this review. | Run the checklist below before calling this production-ready. |

## Design and authentication delivered locally

The public pages use warm paper, dark ink, restrained rust accents, Newsreader serif headings and IBM Plex Sans body text. Both fonts are bundled locally. A custom SVG route drawing gives the homepage a Myanmar logistics identity without stock dashboard cards, fabricated statistics or testimonials. Illustrations are labeled as illustrative routes, not live conditions.

Signup includes field validation, password confirmation, show/hide controls, pending/error states and an email-confirmation screen. The callback exchanges the Supabase PKCE code and chooses a fixed destination from the database role. It ignores external `next` destinations. Authentication remains cookie-based and uses the publishable client, not elevated credentials. Open confirmation links in the browser that initiated signup.

## Your deployment steps

1. In Vercel → project → Settings → Environment Variables, set `NEXT_PUBLIC_APP_URL=https://myanmarlogistics.vercel.app` for Production. Keep the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never add the personal management token to Vercel.
2. In Supabase → Authentication → URL Configuration, set Site URL to `https://myanmarlogistics.vercel.app`. Add `https://myanmarlogistics.vercel.app/auth/callback` to Redirect URLs. For local development also allow `http://localhost:3000/auth/callback`. Add only the exact additional preview origins you intend to test.
3. In Supabase → Authentication → Email / SMTP settings, configure your mail provider, verified sending domain and sender. Keep email confirmation enabled. The confirmation template should retain Supabase's `{{ .ConfirmationURL }}` link, which verifies the email and redirects to the callback.
4. Apply the pending database guard migration using `npm run db:migrate` from the configured local workspace. This runner checks prior migration checksums; do not reseed an existing deployment.
5. Commit and push the reviewed app changes, then deploy/redeploy on Vercel so the new environment value and pages are included. This review has not pushed or deployed changes.
6. Use a fresh email you control to sign up, follow the email in the same browser, confirm the Trader dashboard opens, log out and log in again. Try expired links, mismatched passwords and already registered emails.

References: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Next build order

1. Complete production email configuration and signup acceptance.
2. Fix and test offline queue durability, identity checks and revision conflicts.
3. Add password recovery, then Admin-controlled staff onboarding.
4. Finish Phase 9: one complete Trader → Admin → Driver → delivery scenario; two-user isolation; private document access; reconnect handling; real-device GPS; keyboard and 360px mobile review.
5. Finish deployment operations: error monitoring, restore/backup procedure, demo-account policy and a short user guide. Real-user launch also needs appropriate privacy/support information.

Do not mark Phase 9 complete based only on unit/SQL tests. The current offline feature requires an already loaded page; it does not provide offline page loading or background synchronization.

## Verification completed

- ESLint and TypeScript pass; production build succeeds with the new public routes.
- All 68 existing/local database, scheduler and queue tests pass, including the new missing-profile authorization regression. The copied queue-test limitation above still applies.
- Three new signup tests pass: identity normalization/role stripping, invalid fields/password mismatch, and trusted confirmation-origin configuration.
- `node scripts/test-public-pages.mjs` passes against the local production build: homepage/login/signup HTML, bundled font assets, and missing/invalid confirmation callbacks including rejection of external redirect parameters.
- `TEST_APP_URL=http://127.0.0.1:3100 npm run test:live` passes: all five provisioned accounts authenticate, API ownership/role isolation holds, anonymous reads and invalid credentials fail, and role dashboard redirects work.
- Real signup email delivery, interactive/mobile visual review, hosted application of the new migration and deployment of these changes remain pending.
