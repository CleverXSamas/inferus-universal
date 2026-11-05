import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApplication } from '../server/index.ts';
test('HTTP: permissões, erros assíncronos, CSRF e proteção de arquivos', async () => {
  const app = createApplication({ databaseUrl: '' });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const post = (path: string, data: unknown, headers = {}) =>
    fetch(origin + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(data),
    });
  try {
    assert.equal((await fetch(origin + '/api/missing')).status, 404);
    assert.equal((await fetch(origin + '/api/sheets')).status, 401);
    assert.equal(
      (await post('/api/sheets', { expression: '1d6' }, { origin: 'https://foreign.test' })).status,
      403,
    );
    assert.equal((await fetch(origin + '/api/auth/logout')).status, 404);
    assert.equal((await fetch(origin + '/%2e%2e%2fpackage.json')).status, 403);
    assert.equal((await post('/api/missing', [])).status, 404);
    assert.equal((await post('/api/sheets', { expression: 'x'.repeat(256 * 1024) })).status, 401);
    for (const path of [
      '/api/campaigns',
      '/api/campaigns/join',
      '/api/roll',
      '/api/history',
      '/api/presets',
    ])
      assert.equal((await post(path, {})).status, 404);
  } finally {
    await new Promise<void>((r, reject) => app.server.close((e) => (e ? reject(e) : r())));
    await app.close();
  }
});
