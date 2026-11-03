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
      (await post('/api/campaigns/join', { inviteToken: 'invalid', name: 'Intruder' })).status,
      400,
    );
    assert.equal(
      (await post('/api/roll', { expression: '1d6' }, { origin: 'https://foreign.test' })).status,
      403,
    );
    assert.equal((await fetch(origin + '/api/auth/logout')).status, 404);
    assert.equal((await fetch(origin + '/%2e%2e%2fpackage.json')).status, 403);
    assert.equal((await post('/api/roll', [])).status, 400);
    assert.equal((await post('/api/roll', { expression: 'x'.repeat(256 * 1024) })).status, 413);
    const c = await (await post('/api/campaigns', { name: 'Mesa', dmName: 'DM' })).json();
    assert.equal(
      (await post('/api/campaigns/join', { inviteToken: c.inviteToken, name: 'DM' })).status,
      400,
    );
    const guest = await (
      await post('/api/campaigns/join', { inviteToken: c.inviteToken, name: 'Player' })
    ).json();
    assert.equal(
      (
        await post('/api/campaigns/status', {
          campaignId: c.state.id,
          sessionToken: guest.sessionToken,
          status: 'active',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post('/api/campaigns/revoke', {
          campaignId: c.state.id,
          sessionToken: c.sessionToken,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post('/api/campaigns/state', {
          campaignId: c.state.id,
          sessionToken: guest.sessionToken,
        })
      ).status,
      200,
    );
  } finally {
    await new Promise<void>((r, reject) => app.server.close((e) => (e ? reject(e) : r())));
    await app.close();
  }
});
