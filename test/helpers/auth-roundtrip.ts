import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { callback, currentUser, logout, closeAuthStore } from '../../server/auth.js';
const req = (cookie: string) =>
  ({
    headers: { cookie, host: 'localhost', 'x-forwarded-proto': 'http' },
  }) as unknown as IncomingMessage;
let headers: Record<string, any> = {};
const res = {
  writeHead: (_status: number, h: Record<string, any>) => {
    headers = h;
  },
  end: () => {},
} as unknown as ServerResponse;
process.env.MANUS_PROJECT_ID = 'test-project';
process.env.MANUS_OAUTH_API_URL = 'http://provider.test';
process.env.MANUS_JWT_SECRET = 'test-only-jwt-secret';
const original = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL) =>
  new Response(
    JSON.stringify(
      String(input).endsWith('ExchangeToken')
        ? { accessToken: 'test-access' }
        : { openId: 'auth-test-person', name: 'Test Person' },
    ),
    { status: 200 },
  );
try {
  const state = Buffer.from(
    JSON.stringify({ nonce: 'nonce', redirectUri: 'http://localhost/api/auth/callback' }),
  ).toString('base64url');
  await assert.rejects(callback(req('inferus_oauth_state=wrong'), res, 'code', state), /segurança/);
  await callback(req('inferus_oauth_state=nonce'), res, 'code', state);
  const cookie = (headers['set-cookie'] as string[])
    .find((c) => c.startsWith('webdev_app_session='))!
    .split(';')[0];
  const user = await currentUser(req(cookie));
  assert.equal(user?.openId, 'auth-test-person');
  assert.match(user!.id, /^usr_/);
  await logout(req(cookie), res);
  assert.equal(await currentUser(req(cookie)), null);
  const jwt = (payload: unknown, alg = 'HS256') => {
    const head = Buffer.from(JSON.stringify({ alg })).toString('base64url'),
      body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${head}.${body}.${createHmac('sha256', process.env.MANUS_JWT_SECRET!).update(`${head}.${body}`).digest('base64url')}`;
  };
  const valid = {
    openId: 'preview-person',
    appId: 'test-project',
    exp: Math.floor(Date.now() / 1000) + 60,
  };
  assert.equal(
    (await currentUser(req(`webdev_app_session=${jwt(valid)}`)))?.openId,
    'preview-person',
  );
  for (const token of [
    jwt({ ...valid, exp: 0 }),
    jwt({ ...valid, exp: undefined }),
    jwt({ ...valid, appId: 'wrong' }),
    jwt({ ...valid, appId: undefined }),
    jwt(valid, 'none'),
    `${jwt(valid)}tampered`,
  ])
    assert.equal(await currentUser(req(`webdev_app_session=${token}`)), null);
  console.log('OAuth, sessão persistente, logout e JWT verificados.');
} finally {
  globalThis.fetch = original;
  await closeAuthStore();
}
