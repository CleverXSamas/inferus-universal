import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPrefixHandler,
  parsePrefixCommand,
  type PrefixMessage,
} from '../bot/discord-adapter.ts';
import { removeLegacyCommands } from '../packages/discord-commands/index.ts';
test('prefixos públicos aceitam expressão, alvo e título sem menu slash', () => {
  assert.deepEqual(parsePrefixCommand('!rolar 2d20kh1+5 alvo:15 | Teste de percepção'), {
    kind: 'roll',
    expression: '2d20kh1+5',
    target: 15,
    reason: 'Teste de percepção',
  });
  assert.equal(parsePrefixCommand('!R 3d6!')?.kind, 'roll');
  assert.deepEqual(parsePrefixCommand('!ajuda expressoes'), { kind: 'help', topic: 'expressoes' });
  for (const text of ['oi', '/rolar expressao:1d6', '!random 1d6', '!rolaroutra 1d6', 'oi !r 1d6'])
    assert.equal(parsePrefixCommand(text), null);
  for (const text of [
    '!rolar',
    '!r 1d6 alvo:1001',
    '!r 1d6 privado:true',
    '!r 1d6 | ' + 'a'.repeat(81),
    '!r 1d6 | ' + 'a'.repeat(400),
    '!ajuda inexistente',
  ])
    assert.throws(() => parsePrefixCommand(text));
});
test('prefixo publica resultado no canal com bônus junto dos dados e sem buscar histórico/API', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    assert.fail('não precisa da API nem lê histórico'),
  );
  const replies: any[] = [];
  const handle = createPrefixHandler('https://inferus.example');
  const base: PrefixMessage = {
    content: '!r 1d6+5 alvo:1 | Percepção',
    userId: 'player',
    isBot: false,
    inGuild: true,
    richAllowed: true,
    reply: async (body) => {
      replies.push(body);
    },
  };
  await handle(base);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].flags, 32768);
  const text = JSON.stringify(replies[0]);
  assert.match(text, /Percepção/);
  assert.match(text, /Alvo 1/);
  assert.match(text, /dados|dado/);
  assert.match(text, /\*\*\+5\*\*/);
  assert(!text.includes('Modificador'));
  assert(!Object.hasOwn(replies[0], 'ephemeral'));
  await handle({ ...base, userId: 'bot', isBot: true });
  await handle({ ...base, userId: 'dm', inGuild: false });
  await handle({ ...base, userId: 'chat', content: 'mensagem comum' });
  await handle(base); // per-player rate limit
  assert.equal(replies.length, 1);
});
test('prefixo trata erros e ajuda em público; canal sem embeds recebe texto seguro', async () => {
  const replies: any[] = [];
  const handle = createPrefixHandler();
  const base: PrefixMessage = {
    content: '!r inválido',
    userId: 'one',
    isBot: false,
    inGuild: true,
    richAllowed: false,
    reply: async (body) => {
      replies.push(body);
    },
  };
  await handle(base);
  await handle({ ...base, userId: 'two', content: '!ajuda' });
  await handle({ ...base, userId: 'three', content: '!r 1d6+5 alvo:1' });
  assert.equal(replies.length, 3);
  assert.match(replies[0].content, /Não foi possível/);
  assert.match(replies[1].content, /!rolar/);
  assert.match(replies[2].content, /Alvo 1/);
  assert(replies.every((r) => !r.flags && !r.embeds && !r.ephemeral));
});
test('prefixo bloqueia concorrência por usuário e se recupera após falha no envio', async () => {
  let at = 2000;
  const handle = createPrefixHandler(undefined, () => at);
  let release!: () => void,
    sends = 0;
  const base: PrefixMessage = {
    content: '!r 1d6',
    userId: 'player',
    isBot: false,
    inGuild: true,
    richAllowed: true,
    reply: async () => {
      sends++;
      await new Promise<void>((r) => {
        release = r;
      });
    },
  };
  const pending = handle(base);
  at += 2000;
  await handle(base);
  assert.equal(sends, 1);
  release();
  await pending;
  await assert.rejects(
    handle({
      ...base,
      reply: async () => {
        throw new Error('no permission');
      },
    }),
  );
  at += 2000;
  await handle({
    ...base,
    reply: async () => {
      sends++;
    },
  });
  assert.equal(sends, 2);
});
test('remoção apaga só rolar e ajuda globais e no servidor informado; não registra comandos', async () => {
  const calls: string[] = [];
  const count = await removeLegacyCommands(
    async (path, init) => {
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      return init?.method === 'DELETE'
        ? null
        : [
            { id: '111111111111111111', name: 'rolar' },
            { id: '222222222222222222', name: 'outro' },
            { id: '333333333333333333', name: 'ajuda' },
          ];
    },
    '123456789012345678',
    '987654321098765432',
  );
  assert.equal(count, 4);
  assert.equal(calls.filter((s) => s.startsWith('DELETE')).length, 4);
  assert(calls.every((s) => !s.includes('222222222222222222') && !s.startsWith('POST')));
  assert(calls.some((s) => s.includes('/guilds/987654321098765432/')));
});
