import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePrefixCommand, createPrefixHandler } from '../bot/discord-adapter.ts';
import { commandCatalog } from '../packages/discord-ui/commands.ts';
import { formatHelp } from '../packages/discord-ui/index.ts';
test('catálogo do bot só oferece comandos ativos e retira completamente o contexto de campanha', () => {
  for (const c of commandCatalog) assert(parsePrefixCommand(c.command), c.command);
  for (const c of [
    '!campanhas',
    '!campanha usar Mesa',
    '!mesa',
    '!diario',
    '!anotar texto',
    '!sessao iniciar',
  ])
    assert.equal(parsePrefixCommand(c), null);
  assert.deepEqual(parsePrefixCommand('!fichas 2'), { kind: 'sheets', page: 2 });
  assert.deepEqual(parsePrefixCommand('!ficha usar Heroína da Lua'), {
    kind: 'sheet',
    query: 'Heroína da Lua',
  });
  assert.throws(() => parsePrefixCommand('!ajuda campanhas'), /!ajuda personagem/);
  assert(!JSON.stringify(formatHelp()).includes('campanha'));
});
test('bot lista e seleciona ficha com identidade do autor e escapa nome na resposta pública', async () => {
  let at = 0;
  const calls: unknown[] = [],
    replies: unknown[] = [];
  const handler = createPrefixHandler('https://inferus.example', () => at, {
    pair: async () => {},
    character: async () => ({ id: 'hero', name: 'Hero', sections: [] }),
    sheets: async (id) => {
      calls.push(id);
      return [{ id: 'hero', name: 'Hero @everyone', selected: false }];
    },
    selectSheet: async (id, query) => {
      calls.push([id, query]);
      return { id: 'hero', name: 'Hero @everyone' };
    },
  });
  for (const content of ['!fichas', '!ficha usar hero']) {
    at += 2000;
    await handler({
      content,
      userId: '123456789012345678',
      isBot: false,
      inGuild: true,
      richAllowed: true,
      reply: async (r) => {
        replies.push(r);
      },
    });
  }
  assert.deepEqual(calls, ['123456789012345678', ['123456789012345678', 'hero']]);
  assert(!JSON.stringify(replies).includes('@everyone'));
  assert(JSON.stringify(replies).includes('Personagem selecionado'));
});
