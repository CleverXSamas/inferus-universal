import test from 'node:test';
import assert from 'node:assert/strict';
import { EmbedBuilder } from 'discord.js';
import { discordAccounts } from '../edge/discord-accounts.ts';
import { createEdgeCampaignStore } from '../edge/campaigns.ts';
import { sqliteD1 } from './helpers/d1.ts';
import type { Env } from '../edge/types.ts';
import { createPrefixHandler, parsePrefixCommand } from '../bot/discord-adapter.ts';
import { botCard, pageOf } from '../bot/presentation.ts';
import { formatHelp, presentMessage } from '../packages/discord-ui/index.ts';
import { commandCatalog } from '../packages/discord-ui/commands.ts';
import { createSiteIntegration } from '../bot/site-integration.ts';

test('catálogo executável e comandos de campanha aceitam acentos, páginas e nomes completos', () => {
  for (const c of commandCatalog) assert(parsePrefixCommand(c.command));
  assert.deepEqual(parsePrefixCommand('!CAMPANHA usar A Noite Eterna'), {
    kind: 'campaign',
    query: 'A Noite Eterna',
  });
  assert.deepEqual(parsePrefixCommand('!SESSÃO retomar'), { kind: 'session', status: 'active' });
  assert.deepEqual(parsePrefixCommand('!diário 2'), { kind: 'diary', page: 2 });
  assert.deepEqual(parsePrefixCommand('!ações 2'), { kind: 'actions', page: 2 });
  for (const c of [
    '!campanha usar',
    '!campanha apagar tudo',
    '!mesa outro',
    '!diario 0',
    '!diario -1',
    '!campanhas 1.5',
    '!sessao excluir',
    '!anotar',
    '!anotar ' + 'a'.repeat(301),
  ])
    assert.throws(() => parsePrefixCommand(c));
  assert.equal(parsePrefixCommand('!mesas outra'), null);
  assert.throws(() => pageOf([1, 2], 2), /1 página/);
});

test('campanha selecionada revalida membro, controla sessão só como DM e nunca transporta credenciais ou ficha privada', async (t) => {
  const db = sqliteD1(),
    env: Env = { DB: db, DISCORD_CLIENT_ID: '1528465674731782347' };
  const accounts = discordAccounts(env),
    campaigns = createEdgeCampaignStore(db);
  const request = new Request('https://inferus.example/api/discord/bot', {
    headers: { authorization: 'Bot fixture-campaign-command-token' },
  });
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify({ id: env.DISCORD_CLIENT_ID })),
  );
  const dm = '111111111111111111',
    player = '222222222222222222';
  const bind = async (owner: string, discordId: string) => {
    const pair = (await accounts.change(owner, { action: 'create-pair' })) as { code: string };
    await accounts.bot(request, { action: 'pair', discordId, code: pair.code });
    await accounts.change(owner, {
      action: 'confirm',
      pairId: (await accounts.status(owner)).pending!.id,
    });
  };
  const call = (discordId: string, action: string, args: Record<string, unknown> = {}) =>
    accounts.bot(request, { discordId, action, ...args }) as Promise<any>;
  try {
    const c = await campaigns.create('A Noite Eterna', 'Mestre', 'dm');
    const p = await campaigns.join(c.inviteToken, 'Jogadora', 'player');
    await bind('dm', dm);
    await bind('player', player);
    await assert.rejects(call(dm, 'campaign'), /Escolha sua mesa/);
    await assert.rejects(call(player, 'campaign', { query: 'mesa alheia' }), /não encontrada/);
    await campaigns.saveCharacter(
      c.state.id,
      '',
      { id: 'hero', name: 'Aria', sections: [] },
      0,
      'player',
    );
    const picked = await call(player, 'campaign', { query: 'a noite eterna' });
    assert.equal(picked.campaign.character, 'Aria');
    assert.equal((await call(player, 'character')).sheet.name, 'Aria');
    assert.equal((await call(player, 'campaigns')).campaigns[0].selected, true);
    await assert.rejects(call(player, 'session', { status: 'active' }), /Apenas o DM/);
    await call(dm, 'campaign', { query: c.state.id });
    await call(dm, 'session', { status: 'active' });
    const count = (await campaigns.get(c.state.id, '', 'dm')).state.events.length;
    await call(dm, 'session', { status: 'active' });
    assert.equal((await campaigns.get(c.state.id, '', 'dm')).state.events.length, count);
    await call(player, 'note', { text: 'Encontramos o portal.' });
    const detail = await call(dm, 'campaign');
    assert(
      detail.campaign.events.some(
        (e: any) => e.author === 'Jogadora' && e.body === 'Encontramos o portal.',
      ),
    );
    for (const forbidden of [c.inviteToken, c.sessionToken, 'openId', 'inviteHash', 'sessionHash'])
      assert(!JSON.stringify(detail).includes(forbidden));
    await call(dm, 'session', { status: 'closed' });
    await assert.rejects(call(player, 'note', { text: 'Não deve salvar' }), /encerrada/);
    await assert.rejects(
      campaigns.event(c.state.id, '', 'Também não salva', 'player'),
      /encerrada/,
    );
    await call(dm, 'session', { status: 'active' });
    await call(player, 'note', { text: 'Reabriu' });
    await campaigns.create('A Noite Eterna', 'Mestre', 'dm');
    await assert.rejects(call(dm, 'campaign', { query: 'A Noite Eterna' }), /mesmo nome/);
    await call(dm, 'campaign', { query: c.state.id });
    await campaigns.remove(c.state.id, '', p.participantId, 'dm');
    for (const action of ['campaign', 'note', 'session', 'character'])
      await assert.rejects(call(player, action, { text: 'x', status: 'active' }), /inválida/);
  } finally {
    db.close();
  }
});

test('respostas de campanha têm hierarquia, paginação, erro contextual e fallback seguro', async () => {
  let time = 0;
  const replies: any[] = [],
    calls: string[] = [];
  const campaign = {
    id: 'camp_123',
    name: 'Mesa **sombria**',
    status: 'active' as const,
    role: 'dm' as const,
    character: null,
    participants: [{ name: 'Mestre @everyone', role: 'dm' as const, character: null, self: true }],
    events: Array.from({ length: 7 }, (_, i) => ({
      id: String(i),
      kind: 'message' as const,
      author: '@everyone',
      body: '*'.repeat(500),
      createdAt: '2026-11-04T01:00:00Z',
    })),
  };
  const handler = createPrefixHandler('https://inferus.example', () => time, {
    pair: async () => {},
    character: async () => ({ id: 'hero', name: 'Hero', sections: [] }),
    campaigns: async (id) => {
      calls.push(id);
      return Array.from({ length: 7 }, (_, i) => ({
        ...campaign,
        id: `camp_${i}`,
        name: `Mesa ${i}`,
        participants: 1,
        selected: i === 0,
      }));
    },
    campaign: async (id, query) => {
      calls.push(id);
      if (query === 'erro') throw new Error('Campanha não encontrada');
      return campaign;
    },
    session: async (id, status) => {
      calls.push(id);
      return { ...campaign, status };
    },
    note: async (id) => {
      calls.push(id);
      return { name: campaign.name };
    },
  });
  const send = async (content: string, richAllowed = true) => {
    time += 2000;
    await handler({
      content,
      userId: '111111111111111111',
      isBot: false,
      inGuild: true,
      richAllowed,
      reply: async (body) => {
        replies.push(body);
      },
    });
    return replies.at(-1);
  };
  for (const cmd of [
    '!campanhas',
    '!campanhas 2',
    '!campanha usar Mesa',
    '!campanha',
    '!mesa',
    '!diario',
    '!sessao pausar',
    '!anotar Descoberta',
    '!acoes',
    '!skills',
  ]) {
    const r = await send(cmd);
    assert(r.embeds?.length);
    for (const e of r.embeds) {
      assert.doesNotThrow(() => new EmbedBuilder(e).toJSON());
      for (const f of e.fields ?? []) assert(f.value.length <= 1024);
    }
    assert(!JSON.stringify(r).includes('@everyone'));
    assert(presentMessage(r, false).content!.length <= 2000);
  }
  const list = await send('!campanhas');
  assert(list.embeds[0].fields[0].value.includes('`camp_0`')); // copyable IDs must not be markdown-escaped inside code
  const error = await send('!campanha usar erro');
  assert.match(error.embeds[0].title, /comando/);
  assert(!JSON.stringify(error).includes('rolagem'));
  const plain = await send('!diario', false);
  assert(!plain.embeds && plain.content.length <= 2000);
  assert(calls.every((id) => id === '111111111111111111'));
  for (const topic of ['campanhas', 'personagem'])
    assert.doesNotThrow(() => new EmbedBuilder(formatHelp(topic).embeds![0]).toJSON());
  assert.doesNotThrow(() => botCard('Title', 'Description'));
});

test('cliente HTTP encaminha novos comandos somente ao site HTTPS configurado', async (t) => {
  const calls: any[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, options?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(options?.body)) });
    return new Response(JSON.stringify({ campaign: { id: 'camp_1' }, name: 'Mesa' }));
  });
  const client = createSiteIntegration('https://inferus.example', 'fixture-only-token');
  await client.campaign('111111111111111111', 'Mesa');
  await client.session('111111111111111111', 'paused');
  await client.note('111111111111111111', 'Registro');
  assert(calls.every((c) => c.url === 'https://inferus.example/api/discord/bot'));
  assert.deepEqual(
    calls.map((c) => c.body.action),
    ['campaign', 'session', 'note'],
  );
  assert.throws(() => createSiteIntegration('http://example.com', 'fixture'), /HTTPS/);
});
