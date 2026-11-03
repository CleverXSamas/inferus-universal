import test from 'node:test';
import assert from 'node:assert/strict';
import { handleInteraction, commandDefinitions, type Interaction } from '../bot/discord-adapter.ts';
test('Discord responde ao erro após deferReply sem tentar responder duas vezes', async (t) => {
  const calls: string[] = [];
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify({ error: 'Expressão inválida.' }), { status: 400 }),
  );
  const i: Interaction = {
    commandName: 'rolar',
    options: { expressao: '1d6' },
    userId: 'user',
    reply: async () => {
      calls.push('reply');
    },
    deferReply: async () => {
      calls.push('defer');
    },
    editReply: async (body) => {
      calls.push('edit');
      assert.match(body.content, /Expressão inválida/);
    },
  };
  await handleInteraction(i);
  assert.deepEqual(calls, ['defer', 'edit']);
});
test('Discord publica apenas comandos funcionais com opções de rolagem', () => {
  assert.deepEqual(
    commandDefinitions.map((c) => c.name),
    ['rolar', 'ajuda'],
  );
  assert.equal(commandDefinitions[0].options[0].name, 'expressao');
});

test('Discord valida expressão antes do defer e mantém ajuda privada sem consultar API', async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('A ajuda não deve acessar a API.');
  });
  const make = (name: string, options: Record<string, unknown>): Interaction => ({
    commandName: name,
    options,
    userId: 'user',
    reply: async (body) => {
      calls.push('reply');
      assert.equal(body.ephemeral, true);
      if (name === 'ajuda') assert.match(body.embeds![0].title, /Inferus/);
    },
    deferReply: async () => {
      calls.push('defer');
    },
    editReply: async () => {
      calls.push('edit');
    },
  });
  await handleInteraction(make('rolar', { expressao: '1d20++5' }));
  await handleInteraction(make('ajuda', { topico: 'privacidade' }));
  assert.deepEqual(calls, ['reply', 'reply']);
});
test('Discord Node compartilha o formato rico e respeita a privacidade no defer', async (t) => {
  const { roll } = await import('../packages/dice-core/index.ts');
  const record = roll('2d20kh1+5', { target: 10 });
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(record)));
  let edited = false;
  await handleInteraction({
    commandName: 'rolar',
    options: { expressao: '2d20kh1+5', alvo: 10, privado: true, motivo: 'Percepção' },
    userId: 'user',
    reply: async () => assert.fail('não deve responder duas vezes'),
    deferReply: async (options) => assert.equal(options.ephemeral, true),
    editReply: async (body) => {
      edited = true;
      assert.equal(body.embeds![0].title, `${record.total} · resultado`);
      assert.match(body.embeds![0].description!, /Percepção/);
      assert(body.embeds![0].fields!.some((f) => f.name === 'Alvo 10'));
    },
  });
  assert(edited);
});
