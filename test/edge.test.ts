import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../edge/index.js';
import { createEdgeCampaignStore } from '../edge/campaigns.js';
import { sqliteD1 } from './helpers/d1.js';
import type { Env } from '../edge/types.js';
const origin = 'https://inferus.test';
function request(
  path: string,
  owner?: string,
  data?: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(origin + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      ...(owner
        ? {
            'oai-authenticated-user-id': owner,
            'oai-authenticated-user-email': `${owner}@example.test`,
          }
        : {}),
      ...headers,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
test('D1: limite concorrente, permissões, rotação e retomada da conta', async () => {
  const db = sqliteD1(),
    store = createEdgeCampaignStore(db);
  try {
    const c = await store.create('Mesa', 'DM', 'owner');
    await assert.rejects(store.join(c.inviteToken, 'DM', 'attacker'), /Nome já utilizado/);
    const p = await store.join(c.inviteToken, 'Pessoa', 'player');
    await assert.rejects(store.status(c.state.id, p.sessionToken, 'active', 'player'), /DM/);
    const results = await Promise.allSettled(
      Array.from({ length: 15 }, (_, i) => store.join(c.inviteToken, `Pessoa ${i}`, `account${i}`)),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 8);
    assert.equal((await store.get(c.state.id, '', 'owner')).state.participants.length, 10);
    await store.revoke(c.state.id, '', 'owner');
    await assert.rejects(store.join(c.inviteToken, 'New'), /revogado/);
    assert.equal((await store.get(c.state.id, '', 'player')).role, 'player');
    const pid = (await store.get(c.state.id, '', 'player')).participantId;
    await store.remove(c.state.id, '', pid, 'owner');
    await assert.rejects(store.get(c.state.id, p.sessionToken, 'player'), /Sessão/);
    const rotated = await store.rotate(c.state.id, '', 'owner');
    assert.notEqual(rotated.inviteToken, c.inviteToken);
    const guest = await store.join(rotated.inviteToken, 'Guest');
    await store.claim(c.state.id, guest.sessionToken, 'new-owner');
    assert.equal((await store.get(c.state.id, '', 'new-owner')).role, 'player');
    await assert.rejects(store.get(c.state.id, guest.sessionToken), /Sessão/);
    const resumed = createEdgeCampaignStore(db);
    assert.equal((await resumed.list('owner')).length, 1);
    assert.equal((await resumed.list('stranger')).length, 0);
    assert.equal(
      JSON.stringify((await resumed.get(c.state.id, '', 'owner')).state).includes('openId'),
      false,
    );
  } finally {
    db.close();
  }
});
test('Worker: fichas, histórico e árvores persistem e respeitam o dono', async () => {
  const db = sqliteD1(),
    env: Env = { DB: db };
  const call = (path: string, owner?: string, data?: unknown, headers?: Record<string, string>) =>
    worker.fetch(request(path, owner, data, headers), env);
  try {
    assert.equal((await call('/api/health')).status, 200);
    const info = (await (await call('/api/auth/me', 'owner')).json()) as any;
    assert.equal(info.provider, 'chatgpt');
    assert.match(info.loginUrl, /signin-with-chatgpt/);
    assert.equal((await call('/api/sheets')).status, 401);
    const sheet = { id: 'hero', name: 'Heroína', sections: [] };
    assert.equal((await call('/api/sheets', 'owner', { sheet })).status, 200);
    assert.deepEqual(await (await call('/api/sheets', 'owner')).json(), [sheet]);
    assert.deepEqual(await (await call('/api/sheets', 'stranger')).json(), []);
    await call('/api/roll', 'owner', { expression: '1d6' });
    assert.equal(((await (await call('/api/history', 'owner')).json()) as any[]).length, 1);
    assert.deepEqual(await (await call('/api/history', 'stranger')).json(), []);
    const bought = (await (
      await call('/api/tree/buy', 'owner', { character: 'hero', level: 2, nodeId: 'centro' })
    ).json()) as any;
    assert.deepEqual(bought.bought, ['centro']);
    assert.deepEqual(
      ((await (await call('/api/tree?character=hero&level=2', 'owner')).json()) as any).bought,
      ['centro'],
    );
    assert.deepEqual(
      ((await (await call('/api/tree?character=hero&level=2', 'stranger')).json()) as any).bought,
      [],
    );
    assert.equal(
      (await call('/api/roll', 'owner', { expression: '1d6' }, { origin: 'https://foreign.test' }))
        .status,
      403,
    );
    assert.equal((await call('/api/missing')).status, 404);
  } finally {
    db.close();
  }
});
test('Discord HTTP legado valida assinaturas e orienta a migração sem executar slash', async () => {
  const db = sqliteD1(),
    keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', keys.publicKey)).toString(
    'hex',
  );
  const env: Env = {
    DB: db,
    DISCORD_PUBLIC_KEY: publicKey,
    DISCORD_CLIENT_ID: '123456789012345678',
  };
  const signed = async (payload: unknown, age = 0) => {
    const body = JSON.stringify(payload),
      timestamp = String(Math.floor(Date.now() / 1000) - age);
    const sig = await crypto.subtle.sign(
      'Ed25519',
      keys.privateKey,
      new TextEncoder().encode(timestamp + body),
    );
    return new Request(origin + '/api/discord/interactions', {
      method: 'POST',
      headers: {
        'x-signature-ed25519': Buffer.from(sig).toString('hex'),
        'x-signature-timestamp': timestamp,
      },
      body,
    });
  };
  try {
    assert.equal(
      (await worker.fetch(request('/api/discord/interactions', undefined, { type: 1 }), env))
        .status,
      401,
    );
    assert.deepEqual(await (await worker.fetch(await signed({ type: 1 }), env)).json(), {
      type: 1,
    });
    assert.equal((await worker.fetch(await signed({ type: 1 }, 600), env)).status, 401);
    const result = (await (
      await worker.fetch(
        await signed({
          type: 2,
          application_id: env.DISCORD_CLIENT_ID,
          data: {
            name: 'rolar',
            options: [
              { name: 'expressao', value: '1d6' },
              { name: 'privado', value: true },
            ],
          },
        }),
        env,
      )
    ).json()) as any;
    assert.equal(result.type, 4);
    assert.equal(result.data.flags, 64);
    assert.match(result.data.content, /!rolar/);
    assert.equal(result.data.components, undefined);
    assert.equal(result.data.embeds, undefined);
    assert.deepEqual(result.data.allowed_mentions, { parse: [] });
    const help = (await (
      await worker.fetch(
        await signed({
          type: 2,
          application_id: env.DISCORD_CLIENT_ID,
          data: { name: 'ajuda', options: [{ name: 'topico', value: 'expressoes' }] },
        }),
        env,
      )
    ).json()) as any;
    assert.equal(help.data.flags, 64);
    assert.match(help.data.content, /!ajuda/);
    const choices = (await (
      await worker.fetch(
        await signed({
          type: 4,
          application_id: env.DISCORD_CLIENT_ID,
          data: {
            name: 'rolar',
            options: [{ name: 'expressao', value: 'vantagem', focused: true }],
          },
        }),
        env,
      )
    ).json()) as any;
    assert.equal(choices.type, 8);
    assert.deepEqual(choices.data.choices, []);
    const plain = (await (
      await worker.fetch(
        await signed({
          type: 2,
          app_permissions: '0',
          data: {
            name: 'rolar',
            options: [
              { name: 'expressao', value: '1d6' },
              { name: 'alvo', value: 1 },
            ],
          },
        }),
        env,
      )
    ).json()) as any;
    assert.equal(plain.data.embeds, undefined);
    assert.match(plain.data.content, /!rolar/);
    assert.deepEqual(plain.data.allowed_mentions, { parse: [] });
    const invalid = (await (
      await worker.fetch(
        await signed({ type: 2, data: { name: 'rolar', options: { invalid: true } } }),
        env,
      )
    ).json()) as any;
    assert.equal(invalid.data.flags, 64);
    assert.match(invalid.data.content, /!rolar/);
    assert.equal(
      (await worker.fetch(await signed({ type: 2, application_id: 'wrong' }), env)).status,
      403,
    );
  } finally {
    db.close();
  }
});
test('remoção de slash exige login, preserva outros comandos e descarta token', async (t) => {
  const db = sqliteD1(),
    env: Env = {
      DB: db,
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_PUBLIC_KEY: 'ab'.repeat(32),
    };
  const calls: { url: string; method: string }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET' });
    assert.equal(
      (init?.headers as Record<string, string>).authorization,
      'Bot temporary-test-token',
    );
    if (url.endsWith('/commands'))
      return new Response(
        JSON.stringify([
          { id: '111111111111111111', name: 'rolar' },
          { id: '222222222222222222', name: 'ajuda' },
          { id: '333333333333333333', name: 'outro' },
        ]),
      );
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    if (!init?.method)
      return new Response(
        JSON.stringify({ id: env.DISCORD_CLIENT_ID, verify_key: env.DISCORD_PUBLIC_KEY }),
      );
    return new Response(JSON.stringify({ id: 'command' }));
  });
  try {
    assert.equal(
      (
        await worker.fetch(
          request('/api/discord/setup', undefined, {
            action: 'remove-slash',
            botToken: 'temporary-test-token',
          }),
          env,
        )
      ).status,
      401,
    );
    assert.equal(calls.length, 0);
    const response = await worker.fetch(
      request('/api/discord/setup', 'owner', {
        action: 'remove-slash',
        botToken: 'temporary-test-token',
      }),
      env,
    );
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.ok(!text.includes('temporary-test-token'));
    assert.ok(text.includes('/api/discord/interactions'));
    assert.deepEqual(
      calls.map((c) => c.method),
      ['GET', 'GET', 'DELETE', 'DELETE'],
    );
    assert.equal(
      (await db.prepare('SELECT count(*) AS n FROM edge_campaigns').first<{ n: number }>())?.n,
      0,
    );
  } finally {
    db.close();
  }
});

test('configuração pública expõe somente dados de conexão; erros do Discord não refletem tokens', async (t) => {
  const db = sqliteD1();
  const env: Env = {
    DB: db,
    DISCORD_CLIENT_ID: '123456789012345678',
    DISCORD_PUBLIC_KEY: 'ab'.repeat(32),
  };
  try {
    const response = await worker.fetch(request('/api/discord/config'), env);
    const data = (await response.json()) as any;
    assert.equal(data.serviceReady, true);
    for (const command of [
      '!rolar',
      '!r',
      '!ajuda',
      '!campanha',
      '!mesa',
      '!diario',
      '!sessao',
      '!anotar',
      '!acoes',
      '!vincular',
    ])
      assert(data.commands.includes(command));
    assert(data.commands.every((command: string) => command.startsWith('!')));
    assert.equal(data.gatewayStatus, 'unverified');
    assert.equal(data.hostingRequired, true);
    assert(!JSON.stringify(data).includes(env.DISCORD_PUBLIC_KEY!));
    assert.match(data.installUrl, /permissions=274877926400/);
    const missing = (await (
      await worker.fetch(request('/api/discord/config'), { DB: db })
    ).json()) as any;
    assert.equal(missing.serviceReady, false);
    assert.equal(missing.installUrl, null);
    t.mock.method(
      globalThis,
      'fetch',
      async () => new Response(JSON.stringify({ token: 'do-not-reflect' }), { status: 429 }),
    );
    const limited = await worker.fetch(
      request('/api/discord/setup', 'owner', {
        action: 'remove-slash',
        botToken: 'do-not-reflect',
      }),
      env,
    );
    assert.equal(limited.status, 429);
    const message = await limited.text();
    assert.match(message, /limitou/);
    assert(!message.includes('do-not-reflect'));
  } finally {
    db.close();
  }
});
