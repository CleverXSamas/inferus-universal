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
    ['rolar'],
  );
  assert.equal(commandDefinitions[0].options[0].name, 'expressao');
});
