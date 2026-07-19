import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('PWA manifest exposes a scoped standalone application', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
});

test('service worker precaches the guide and supports controlled updates', async () => {
  const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(serviceWorker, /APP_VERSION = '1\.2\.1'/);
  assert.match(serviceWorker, /'\/guide'/);
  assert.match(serviceWorker, /SKIP_WAITING/);
  assert.match(serviceWorker, /self\.skipWaiting\(\)/);
  assert.match(serviceWorker, /request\.mode === 'navigate'/);
  assert.match(serviceWorker, /fetch\(request\)/);
});
