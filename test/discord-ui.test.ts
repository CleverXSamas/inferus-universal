import test from 'node:test';
import assert from 'node:assert/strict';
import { roll, parseExpression, type RollRecord } from '../packages/dice-core/index.ts';
import {
  diceExamples,
  expressionSuggestions,
  formatHelp,
  formatRoll,
  formatRollError,
  rollOptions,
} from '../packages/discord-ui/index.ts';
test('todos os exemplos e sugestões são expressões válidas e a consulta não executa rolagens', () => {
  for (const example of diceExamples)
    assert.doesNotThrow(() => parseExpression(example.expression));
  assert(expressionSuggestions('vantagem').some((s) => s.value === '2d20kh1+5'));
  assert(expressionSuggestions('4d8+2').some((s) => s.value === '4d8+2'));
  assert(expressionSuggestions('x'.repeat(10000)).length <= 25);
  for (const s of expressionSuggestions('')) {
    assert(s.name.length <= 100);
    assert(s.value.length <= 100);
  }
});
test('cartão de resultado mostra descartes, modificador, alvo e evita menções no motivo', () => {
  const record: RollRecord = {
    roll_id: 'audit-test',
    expression: '2d20kh1+5',
    created_at: '2026-11-03T12:00:00.000Z',
    mode: 'sum',
    bonus: 5,
    total: 23,
    target: 15,
    passed: true,
    groups: [
      {
        raw: '2d20kh1',
        subtotal: 18,
        dice: [
          { index: 0, raw: [18], total: 18, kept: true },
          { index: 1, raw: [4], total: 4, kept: false },
        ],
      },
    ],
  };
  const message = formatRoll(record, '@everyone **Teste**', 'https://inferus.example');
  const embed = message.embeds![0];
  assert.equal(embed.title, '23 · resultado');
  assert.match(embed.fields![0].value, /~~4~~/);
  assert.match(embed.fields![0].value, /\*\*18\*\*/);
  assert.equal(embed.fields!.find((f) => f.name === 'Modificador')?.value, '+5');
  assert.match(embed.fields!.find((f) => f.name === 'Alvo 15')!.value, /Passou/);
  assert(!embed.description!.includes('@everyone'));
  assert.equal(message.components![0].components[0].url, 'https://inferus.example/discord');
  assert.match(embed.footer!.text, /audit-test/);
});
test('auditoria extensa respeita os limites dos embeds e identifica a abreviação', () => {
  const result = roll(Array(10).fill('40d1000').join('+'));
  const message = formatRoll(result);
  const embed = message.embeds![0];
  assert(embed.fields!.length <= 25);
  for (const f of embed.fields!) assert(f.value.length <= 1024);
  const total =
    embed.title.length +
    (embed.description?.length ?? 0) +
    (embed.footer?.text.length ?? 0) +
    embed.fields!.reduce((s, f) => s + f.name.length + f.value.length, 0);
  assert(total <= 6000);
  assert(embed.fields!.some((f) => f.name === 'Auditoria resumida'));
});
test('opções inválidas falham antes da execução e ajuda explica privacidade e limitações', () => {
  for (const options of [
    { expressao: '1d6', alvo: NaN },
    { expressao: '1d6', privado: 'false' },
    { expressao: '1d6', motivo: 'x'.repeat(81) },
    { expressao: 123 },
    { expressao: '1d20++5' },
  ])
    assert.throws(() => rollOptions(options));
  assert.equal(rollOptions({ expressao: '1d6', privado: false }).private, false);
  assert.match(JSON.stringify(formatHelp('privacidade')), /privado:true/);
  assert.match(JSON.stringify(formatHelp('privacidade')), /não vincula/);
  assert.match(formatRollError(new Error('inválido')).content, /inválido/);
});

test('canais sem permissão de embeds recebem resultado e alvo em texto com limite seguro', async () => {
  const { presentMessage, embedsPermitted } = await import('../packages/discord-ui/index.ts');
  assert.equal(embedsPermitted('0'), false);
  assert.equal(embedsPermitted('16384'), true);
  assert.equal(embedsPermitted('invalid'), false);
  const result = roll(Array(10).fill('40d1000').join('+'), { target: 15 });
  const message = presentMessage(formatRoll(result), false);
  assert.equal(message.embeds, undefined);
  assert(message.content.length <= 2000);
  assert.match(message.content, /Alvo 15/);
  assert.match(message.content, new RegExp(String(result.total)));
});
