import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRuntimeConfiguration, assertRuntimeConfiguration } from '../server/config.ts';
import { validateDiscordCredentials } from '../bot/credentials.ts';
const web = {
  DATABASE_URL: 'mysql://user:private-password@mysql.railway.internal:3306/inferus',
  PUBLIC_ORIGIN: 'https://inferus.example',
  MANUS_PROJECT_ID: 'project',
  MANUS_OAUTH_API_URL: 'https://auth.example',
  MANUS_OAUTH_PORTAL_URL: 'https://portal.example',
};
test('produção exige banco, origem HTTPS e configuração real de login', () => {
  assert.deepEqual(validateRuntimeConfiguration('web', web), []);
  assert.throws(() => assertRuntimeConfiguration('web', {}), /DATABASE_URL/);
  for (const override of [
    { PUBLIC_ORIGIN: 'http://inferus.example' },
    { PUBLIC_ORIGIN: 'https://inferus.example/path' },
    { PUBLIC_ORIGIN: 'https://inferus.example/' },
    { DATABASE_URL: 'mysql://user@host/db' },
    { PORT: 'NaN' },
  ])
    assert.ok(validateRuntimeConfiguration('web', { ...web, ...override }).length);
  const errors = validateRuntimeConfiguration('web', {
    ...web,
    DATABASE_URL: 'broken-private-password',
  }).join(' ');
  assert.ok(!errors.includes('broken-private-password'));
});
test('bot admite API privada e exige token e ID de aplicação', () => {
  const bot = {
    DISCORD_TOKEN: 'test-token',
    DISCORD_CLIENT_ID: '123456789012345678',
    FRAGMENTOS_API_URL: 'http://web.railway.internal:3000',
    PUBLIC_ORIGIN: 'https://inferus.example',
  };
  assert.deepEqual(validateRuntimeConfiguration('bot', bot), []);
  assert.ok(
    validateRuntimeConfiguration('bot', { ...bot, FRAGMENTOS_API_URL: 'http://public.example' })
      .length,
  );
  assert.ok(validateRuntimeConfiguration('bot', { ...bot, DISCORD_CLIENT_ID: 'wrong' }).length);
  assert.throws(() => assertRuntimeConfiguration('bot', {}), /DISCORD_TOKEN/);
});
test('validação Discord verifica o dono do token sem expor o segredo', async (t) => {
  const mocked = t.mock.method(
    globalThis,
    'fetch',
    async (_url: RequestInfo | URL, opts?: RequestInit) => {
      assert.equal(
        (opts?.headers as Record<string, string>).authorization,
        'Bot private-test-token',
      );
      return new Response(JSON.stringify({ id: '123456789012345678' }), { status: 200 });
    },
  );
  assert.equal(
    await validateDiscordCredentials('private-test-token', '123456789012345678'),
    '123456789012345678',
  );
  await assert.rejects(
    validateDiscordCredentials('private-test-token', '987654321098765432'),
    /aplicações diferentes/,
  );
  mocked.mock.mockImplementation(async () => new Response('unauthorized', { status: 401 }));
  await assert.rejects(
    validateDiscordCredentials('private-test-token', '123456789012345678'),
    (e) =>
      e instanceof Error && /HTTP 401/.test(e.message) && !e.message.includes('private-test-token'),
  );
});
