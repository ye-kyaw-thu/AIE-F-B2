import assert from 'node:assert/strict';

const origin = new URL(process.env.TEST_APP_URL || 'http://127.0.0.1:3100');
assert.ok(['127.0.0.1', 'localhost'].includes(origin.hostname), 'This check is for the local production build.');
const pages = [
  ['/', ['Every shipment.', 'href="/signup"', 'Illustrated routes']],
  ['/login', ['Good to see you.', 'name="email"', 'name="password"', 'href="/signup"']],
  ['/signup', ['name="fullName"', 'name="confirmPassword"', 'Create Trader account']],
];
let home;
for (const [path, expected] of pages) {
  const response = await fetch(new URL(path, origin), {headers:{Cookie:"logistics-language=en"}});
  assert.equal(response.status, 200, path);
  const html = await response.text();
  for (const text of expected) assert.ok(html.includes(text), `${path}: missing ${text}`);
  if (path === '/') home = html;
  else assert.match(response.headers.get('cache-control') || '', /private|no-store/);
}
const cssPaths = [...new Set([...home.matchAll(/href="([^" ]+\.css[^" ]*)"/g)].map(match => match[1]))];
assert.ok(cssPaths.length);
let styles = '';
for (const path of cssPaths) {
  const response = await fetch(new URL(path.replaceAll('&amp;', '&'), origin));
  assert.equal(response.status, 200);
  styles += await response.text();
}
assert.ok(styles.includes('IBM Plex Sans Variable'));
assert.ok(styles.includes('Newsreader Variable'));
const fonts = [...new Set([...styles.matchAll(/url\(["']?([^)'"\s]+\.woff2)["']?\)/g)].map(match => match[1]))];
assert.ok(fonts.length);
for (const path of fonts) {
  const response = await fetch(new URL(path, new URL(cssPaths[0], origin)));
  assert.equal(response.status, 200, `Font failed: ${path}`);
}
for (const query of ['', '?next=https://example.com', '?code=invalid&next=https://example.com']) {
  const response = await fetch(new URL('/auth/callback' + query, origin), {redirect: 'manual'});
  assert.equal(response.status, 307);
  const location = new URL(response.headers.get('location'), origin);
  // Next's local server can normalize 127.0.0.1 to localhost in request.url.
  assert.ok(['localhost', '127.0.0.1'].includes(location.hostname));
  assert.equal(location.port, origin.port);
  assert.equal(location.protocol, origin.protocol);
  assert.equal(location.pathname, '/login');
  assert.equal(location.searchParams.get('notice'), 'confirmation-error');
  assert.match(response.headers.get('cache-control') || '', /no-store/);
}
console.log('PASS: landing, login and signup render; bundled fonts load; invalid callbacks stay local and uncached.');
