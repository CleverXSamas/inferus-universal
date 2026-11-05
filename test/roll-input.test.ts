import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExpression, roll, recalculate, isRollRecord } from '../packages/dice-core/index.ts';
import { parseRollInput } from '../packages/roll-input/index.ts';
import { parsePrefixCommand, createPrefixHandler } from '../bot/discord-adapter.ts';
import { formatRollBatch, presentMessage, rollOptions } from '../packages/discord-ui/index.ts';
test('abreviações usam o mesmo modelo e auditoria na ficha e no bot', () => {
  for (const [input, canonical] of [
    ['d20', '1d20'],
    ['d%', '1d100'],
    ['2D%+3', '2d100+3'],
    ['4d6k3', '4d6kh3'],
    ['4d6d1', '4d6kh3'],
    ['d6!', '1d6!'],
  ]) {
    assert.equal(parseExpression(input).normalized, canonical);
    assert.equal(
      parseExpression(rollOptions({ expressao: input }).expression).normalized,
      canonical,
    );
    const r = roll(input);
    assert.equal(r.expression, canonical);
    assert.equal(recalculate(r), r.total);
    assert(isRollRecord(r));
  }
  assert.throws(() => parseExpression(Array(50).fill('d6').join('+')), /160/);
  for (const invalid of [
    'd1',
    'd0',
    '0d6',
    'dF',
    '4d6k0',
    '4d6d4',
    '4d6d0',
    '4d6k5',
    '1d20++3',
    'd20*2',
    '41d6',
  ])
    assert.throws(() => parseExpression(invalid));
});
test('comandos curtos, títulos e ajuda mantêm prefixo explícito', () => {
  for (const verb of ['r', 'd', 'dice', 'roll', 'rolar'])
    assert.deepEqual(parsePrefixCommand(`!${verb} d20+5 Percepção`), {
      kind: 'roll',
      expression: '1d20+5',
      reason: 'Percepção',
      target: undefined,
    });
  assert.equal(parsePrefixCommand('d20 Percepção'), null);
  assert.equal(parsePrefixCommand('eu [d20] ataco'), null);
  assert.deepEqual(parsePrefixCommand('!help dice'), { kind: 'help', topic: 'expressoes' });
  assert.deepEqual(parsePrefixCommand('!ping'), { kind: 'ping' });
  assert.equal(parseRollInput('d20 + 5 Percepção alvo:15').target, 15);
  assert.equal(
    parseRollInput('2d20 kh1 + 5 | Teste com | contexto').reason,
    'Teste com | contexto',
  );
  for (const value of [
    'd20 + erro',
    'd20 privado:true',
    'd20 alvo:1.2',
    'd20 alvo:1001',
    'd20 kh2',
    'd20 | ' + 'x'.repeat(81),
  ])
    assert.throws(() => parseRollInput(value), value);
});
test('lotes validam tudo antes de rolar e respeitam limites agregados', () => {
  assert.deepEqual(parseRollInput('6#4d6d1 | Atributos'), {
    expression: '4d6kh3',
    reason: 'Atributos',
    times: 6,
    target: undefined,
  });
  assert.equal(parseRollInput('10#10d6').times, 10);
  for (const input of ['0#d20', '11#d20', '2#30d6+21d6', '10#11d6', '2#d20+1#d6', '100000#d20'])
    assert.throws(() => parseRollInput(input));
});
test('lote gera uma resposta pública, preserva descartes/sinais e fallback contém todos os totais', async () => {
  let calls = 0;
  const replies: any[] = [];
  const handler = createPrefixHandler('https://inferus.example', () => 10000);
  await handler({
    content: '!d 6#4d6d1 | Atributos @everyone',
    userId: 'test',
    isBot: false,
    inGuild: true,
    richAllowed: true,
    reply: async (b) => {
      calls++;
      replies.push(b);
    },
  });
  assert.equal(calls, 1);
  assert.equal(replies[0].embeds[0].fields.length, 6);
  assert(!JSON.stringify(replies).includes('@everyone'));
  const results = Array.from({ length: 10 }, () => roll('2d6kh1-1d4+2'));
  const rich = formatRollBatch(results, 'Atributos');
  assert(JSON.stringify(rich).includes('~~'));
  assert(JSON.stringify(rich).includes('−'));
  const plain = presentMessage(rich, false).content!;
  assert(plain.length < 2000);
  for (let i = 0; i < 10; i++) assert(plain.includes(`${i + 1} · **${results[i].total}**`));
});

test('fallback de lote máximo conserva todos os resultados mesmo com título longo e alvo', () => {
  const results = Array.from({ length: 10 }, () => roll('10d1000!', { target: 1000 }));
  const message = formatRollBatch(results, '*'.repeat(80));
  const plain = presentMessage(message, false).content!;
  assert(plain.length < 1900);
  for (let i = 0; i < 10; i++) assert(plain.includes(`${i + 1} · **${results[i].total}**`));
  assert(!('fallbackContent' in presentMessage(message, true)));
});
