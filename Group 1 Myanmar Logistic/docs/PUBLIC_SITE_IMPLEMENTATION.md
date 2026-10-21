# Public site and signup implementation log

User request: review the deployed project, list remaining work, continue development, replace the generic homepage/font styling and provide signup/login pages. Deployment supplied: https://myanmarlogistics.vercel.app/.

Implemented a public editorial layout with locally bundled Newsreader and IBM Plex Sans, a native SVG route drawing, clear Trader registration calls to action and shared login/signup styling. Existing role dashboards retain their workflows and inherit the new body font.

Added validated Trader signup through the normal Supabase SSR client, an email-confirmation screen and a PKCE callback. Role metadata is never accepted; the database profile trigger remains authoritative. Redirect destinations come from database roles, not user query parameters. Public signup is intentionally not a way to acquire Driver or Admin permissions.

The review found localhost Auth settings and no custom SMTP. Inspected configuration read-only and documented deployment setup without printing tokens. Added a read-only settings script. Also fixed pre-existing offline UI lint failures and the unreachable empty-queue simulation toggle.

Security review found nullable role comparisons in alert RPCs. Added a checksum-safe follow-up migration and executable database regression tests for authenticated sessions without identities/profiles. The hosted migration remains pending.

Validation caught unsupported font subset import paths; corrected imports to the installed packages' weight stylesheets. Build, lint, typecheck, 68 local database/queue tests, 3 signup tests, public HTTP/font/callback checks and existing hosted authentication/role-isolation checks pass. Interactive browser discovery returned no browser, so visual acceptance is explicitly pending. Real email signup was not claimed as tested: SMTP and redirect settings must be configured first.

Full findings, remaining features and deployment instructions: [project review](PROJECT_REVIEW_2026-09-17.md).

## Interface follow-ups

## Burmese language follow-up

Added a Burmese-first interface with persistent English/Burmese controls on public/authentication and all three role workspaces. Translations live in a shared dictionary and render through explicit React components, preserving operational data and stored enum values. Added locally hosted Noto Sans Myanmar, Burmese spacing/layout adjustments, common validation translations, Driver notices and generated gate-alert framing. Locale/translation tests and HTTP checks cover both language preferences and invalid-cookie fallback; hosted demo-account checks confirm Burmese dashboards with existing role isolation. See [language implementation and acceptance](BURMESE_LANGUAGE.md). Browser visual acceptance and Supabase email-template localization remain separate.

### Dashboard design follow-up

User requested the internal system match the landing-page font and logo. Admin, Trader and Driver shells now reuse the exact Wordmark component with role-dashboard destinations. Added scoped workspace styles for paper backgrounds, ink/rust accents, Newsreader page and panel headings, IBM Plex Sans interface text, simpler borders, legible table text and mobile form controls. Admin and Trader navigation now shows the active section using pathname matching and `aria-current`, including shipment detail pages without highlighting both the list and New request links. Operational forms, role checks and server actions retain their existing behavior. Interactive visual acceptance remains pending because no browser was available in the preceding review.
