# Burmese and English interface

The app defaults to Burmese for new visitors. The `မြန်မာ / EN` control appears on the public pages, login/signup and Admin, Trader and Driver headers. The preference is stored for one year in the `logistics-language` cookie and applies across the current browser profile. Invalid values fall back to Burmese.

The switch reloads the current page so server-rendered text and the document's `lang` attribute agree. Finish or save an unfinished form before changing language. Separate browser profiles can choose different languages.

## Coverage

- Landing page and authentication labels, placeholders, confirmation instructions and common validation messages.
- Role navigation, dashboards, requests, approval/assignment forms and gate management.
- Shipment/gate status labels, timelines, document controls and loading/error screens.
- Driver GPS instructions, evidence upload feedback, offline queue and sync notices.
- Generated gate-alert wording, preserving the original disruption reason.

Names, shipment identifiers, uploaded filenames, cargo descriptions, notes and Admin-authored broadcasts remain as entered. Unknown backend error messages fall back to their original text. Supabase email templates and the browser's native date picker/validation language are configured separately; they are not translated by this interface update. Dates still use the existing Myanmar timezone formatting.

## Implementation

`src/lib/i18n/messages.ts` contains English-to-Burmese interface strings. `LanguageProvider` supplies the request locale to translated client components during server rendering and hydration. `T` renders plain text, without changing database enum values or translating the DOM after page load. Localized input/textarea wrappers translate placeholders while preserving names, values, handlers and validation attributes. Gate notifications use a dedicated component so entered reasons remain intact.

Noto Sans Myanmar is bundled locally at weights 400, 500 and 600. Burmese layouts use more line spacing, reduced heading sizes, wrapping buttons and wider mobile navigation rows. English keeps the existing Newsreader / IBM Plex Sans styling.

## Acceptance

1. Visit `/`, `/login`, `/signup` in a fresh browser profile: Burmese should appear immediately without an English flash.
2. Select EN, navigate and refresh: English should remain selected. Switch back to Burmese.
3. Log in as each role and check headings, navigation, forms and status labels.
4. Enter an incomplete request and mismatched signup passwords: errors should use Burmese.
5. Try GPS permission denial, upload rejection and offline capture/sync notices.
6. Read a gate disruption alert: generated text should be Burmese and the entered reason should remain unchanged.
7. Inspect 360px mobile layout, keyboard focus and Burmese font shaping on a real device. Interactive visual acceptance remains pending when no in-app browser is available.

Automated coverage: `npm run test:auth` includes locale fallback, translation/whitespace behavior, status coverage and critical validation translations. With the production server running locally, use `node scripts/test-language-pages.mjs` and `node scripts/test-public-pages.mjs`. `TEST_APP_URL=http://127.0.0.1:3100 npm run test:live` also checks Burmese role dashboards alongside existing access isolation.

No additional API key or database migration is required for language support. Deploy the updated code to publish it on Vercel.
