# Phase 2 — database, authentication and role access

## What is implemented

- Real email/password login, server-side validation, pending/error feedback, email-only demo shortcuts, and sign-out.
- Cookie-based Supabase SSR clients; Proxy refreshes sessions and disables shared caching.
- Server-verified identity and a fresh profile lookup; roles are never taken from signup metadata or a role selector.
- Protected admin/trader/driver layouts and dashboards. Each data access point checks its role as well as relying on database RLS.
- All six database tables, checks, foreign keys, indexes, secure Auth profile triggers, RLS policies and private document bucket.
- Idempotent hosted setup script with migration checksum/history and repeatable demo user/data provisioning.
- Generated TypeScript database types from the actual migration applied to local embedded PostgreSQL.
- Local SQL security tests and a hosted direct-API/optional HTTP verification script.

This phase provides read-only shipment lists to demonstrate access boundaries. Shipment creation, assignment, approval and driver updates are implemented in later phases. Direct operational writes are deliberately denied to all application users until constrained workflow functions exist. Renaming one's own profile and marking one's own alerts read are allowed at the column/policy level. File upload policies, map, Realtime and gate alerts are still future phases.

## Hosted setup

The app uses two public configuration values in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REFERENCE.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The URL must be the full HTTPS address, not only the 20-character reference.

Creating tables and Auth users additionally requires administrative setup access. The public publishable key cannot perform these operations. The prepared setup script uses a Supabase **personal access token**, which stays outside the app:

1. Open [Supabase account access tokens](https://supabase.com/dashboard/account/tokens) and create a token that can manage the intended project database and read its secret API key. If choosing granular permissions, grant database read/write and API gateway key/secret read access for this project.
2. Add it locally:

   ```dotenv
   SUPABASE_ACCESS_TOKEN=YOUR_PERSONAL_ACCESS_TOKEN
   ```

3. Review `supabase/migrations/20260913000100_foundation.sql` and `scripts/setup-supabase.mjs`, then run:

   ```powershell
   npm run check:supabase
   npm run setup:supabase
   npm run test:live
   ```

4. Restart the app after changing environment variables: `npm run dev`.

The setup script targets only the project named by the configured URL. It obtains an existing secret/service-role key in memory for the Auth admin API, never saves or prints it, applies a transactional migration with CLI-compatible history, and creates five demo/test accounts plus four shipment records. It does not change project billing, delete data, reset passwords, reset shipment progress, or publish the application.

An existing application table without the expected migration history causes setup to stop. An existing email without this script's trusted demo marker also causes setup to stop; it does not take over unrelated accounts. Setup is repeatable after partial failures. A changed previously applied migration checksum is rejected; subsequent schema changes must be separate migrations.

The personal token is only read by CLI scripts. Do not put it in `NEXT_PUBLIC_*` or Vercel's app configuration. You can remove/revoke it after setup. Do not paste credentials into chat. `.env.local` remains ignored by Git.

## Demo users

After hosted setup succeeds:

| Email | Role | Expected sample shipments |
| --- | --- | --- |
| admin@demo.com | Admin | All four |
| trader@demo.com | Trader | Yangon → Muse; Yangon → Myawaddy; Mandalay → Muse |
| driver@demo.com | Driver | Yangon → Muse; Mandalay → Muse |
| trader2@demo.com | Trader (isolation test) | One separate shipment |
| driver2@demo.com | Driver (isolation test) | One separate assigned shipment |

Shared development-only password: `Demo-Myanmar!2026-Only`. The two extra users and fourth shipment prove ownership isolation. The account picker fills only the email, never changes roles or bypasses password authentication. Seeded gate statuses are simulated and initially Open.

## Verification

```powershell
npm run verify         # lint, TypeScript, local database tests, production build
npm run db:types       # regenerate schema types from the migration
npm run check:supabase # verify configured hosted Auth and anonymous permissions
npm run test:live      # after hosted setup: real Auth and RLS through the public API
```

The local tests execute the unchanged migration in PGlite (embedded PostgreSQL). Only Supabase-owned Auth/Storage schemas and `auth.uid()` are supplied by the harness; table grants, constraints, triggers and RLS execute in PostgreSQL. This verifies SQL behavior, not hosted Auth, Storage upload services or browser interactions.

To also verify local application redirects/dashboards against hosted sessions, start `npm run dev` in one terminal. In a second PowerShell terminal:

```powershell
$env:TEST_APP_URL = 'http://localhost:3000'
npm run test:live
Remove-Item Env:TEST_APP_URL
```

The live script signs in through Supabase, reads only the known sample shipment IDs, checks profile/shipments permissions, attempts denied no-op privileged writes, verifies anonymous table rejection and wrong-password rejection, and signs out its own test sessions. Its optional HTTP checks use actual Supabase SSR cookies against localhost; tokens are not logged. Browser form behavior, mobile layout, and cookie persistence across browser restarts still require manual testing.

## Manual acceptance

1. Login as each primary demo account; verify redirect to the matching role dashboard.
2. Check counts/shipments against the table above.
3. As Trader, directly enter `/admin/dashboard` or `/driver/dashboard`: you must return to your trader dashboard without seeing another role's data.
4. Sign out, then directly visit each dashboard: you must be sent to `/login`.
5. Submit a wrong password: show an error without granting a session.
6. Refresh an authenticated dashboard and verify the session persists. Use separate browser profiles for concurrent roles.
7. Check the login form and Driver dashboard at narrow mobile widths and with keyboard navigation.
8. Confirm the Supabase SQL editor/Table Editor shows RLS enabled on all six operational tables and the `shipment-documents` bucket is private.

## Current execution status

- Local SQL migration and 17 security tests: passed.
- Hosted URL/publishable-key connection: verified; email/password Auth enabled.
- Hosted migration/account provisioning: completed. Six tables, two gates, private bucket, five users, four shipments and seeded timeline events are present.
- Application lint, TypeScript and production build: passed.
- Live API: all five account logins, expected profile roles, shipment ownership, direct-ID isolation, rejected privileged writes, anonymous rejection and invalid-password rejection passed.
- Authenticated HTTP checks against the production app: all three dashboards and cross-role redirects passed. Anonymous requests reveal no shipment records.
- Setup repeatability: a second hosted setup run succeeded, reused migration/users and preserved shipment progress.
- Interactive browser form and mobile visual checks: still manual.

## Sources

- [Supabase SSR clients and session refresh](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase Management API SQL queries](https://supabase.com/docs/reference/api/v1-run-a-query)
- [Supabase Management API project keys](https://supabase.com/docs/reference/api/v1-get-project-api-keys)
- Installed Next.js documentation under `node_modules/next/dist/docs/`: authentication, cookies, Proxy and error boundaries.
