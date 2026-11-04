import test from 'node:test';
import assert from 'node:assert/strict';
import { ContainerBuilder } from 'discord.js';
import { roll, parseExpression, type RollRecord } from '../packages/dice-core/index.ts';
import {
  diceExamples,
  expressionSuggestions,
  formatHelp,
  formatRoll,
  formatRollError,
  rollOptions,
  rollCardModel,
  ROLL_LEGEND,
  type DiscordContainer,
} from '../packages/discord-ui/index.ts';
const example: RollRecord = {
  roll_id: 'audit-test',
  expression: '2d20kh1+5',
  created_at: '2026-11-03T12:00:00.000Z',
  mode: 'sum',
  bonus: 5,
  total: 20,
  groups: [
    {
      raw: '2d20kh1',
      subtotal: 15,
      dice: [
        { index: 0, raw: [15], total: 15, kept: true },
        { index: 1, raw: [12], total: 12, kept: false },
      ],
    },
  ],
};
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
test('cartão nativo segue a referência: motivo, total, expressão, dados, modificador e legenda', () => {
  const message = formatRoll(example, 'Teste de percepção');
  assert.equal(message.flags, 32768);
  assert(!Object.hasOwn(message, 'content'));
  assert(!Object.hasOwn(message, 'embeds'));
  const container = message.components![0] as DiscordContainer;
  assert.equal(container.type, 17);
  assert.equal(container.accent_color, 0xb79be7);
  assert.deepEqual(container.components, [
    { type: 10, id: 2, content: '**Teste de percepção**' },
    { type: 10, id: 3, content: '# 20' },
    { type: 10, id: 4, content: '`2d20kh1+5`' },
    { type: 14, id: 5, spacing: 1, divider: true },
    { type: 10, id: 10, content: '`2d20kh1`\n\n**`15`** ~~`12`~~' },
    { type: 14, id: 26, spacing: 1, divider: true },
    { type: 10, id: 30, content: 'Modificador  **+5**' },
    { type: 10, id: 31, content: `-# ${ROLL_LEGEND}` },
  ]);
  assert.deepEqual(new ContainerBuilder(container).toJSON(), container);
  const model = rollCardModel(example, 'Teste de percepção');
  assert.equal(model.total, 20);
  assert.equal(model.title, 'Teste de percepção');
  assert.equal(model.modifier, '+5');
  assert.deepEqual(
    model.groups[0].dice.map((d) => [d.total, d.kept]),
    [
      [15, true],
      [12, false],
    ],
  );
});
test('cartão escapa motivo, mostra alvo e mantém destaque violeta', () => {
  const message = formatRoll({ ...example, target: 15, passed: true }, '@everyone **Teste**');
  const c = message.components![0] as DiscordContainer;
  assert.equal(c.accent_color, 0xb79be7);
  const data = JSON.stringify(c);
  assert(!data.includes('@everyone'));
  assert.match(data, /Alvo 15/);
  assert.match(data, /Passou/);
});
test('auditoria extensa respeita componentes v2, IDs únicos e orçamento de texto', () => {
  const result = roll(Array(10).fill('40d1000').join('+'));
  const container = formatRoll(result).components![0] as DiscordContainer;
  assert(container.components.length + 1 <= 40);
  const ids = [container.id, ...container.components.map((c) => c.id)];
  assert.equal(new Set(ids).size, ids.length);
  const text = container.components
    .filter((c) => c.type === 10)
    .map((c) => c.content)
    .join('');
  assert(text.length <= 4000);
  assert.match(text, /grupos omitidos/);
  assert.doesNotThrow(() => new ContainerBuilder(container).toJSON());
  const exploding = {
    ...example,
    groups: [
      {
        ...example.groups[0],
        dice: Array.from({ length: 40 }, (_, index) => ({
          index,
          kept: true,
          raw: Array(64).fill(1000),
          total: 64000,
        })),
      },
    ],
  };
  assert(JSON.stringify(formatRoll(exploding)).length < 6000);
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
  assert.match(formatRollError(new Error('inválido')).content ?? '', /inválido/);
});
test('canais sem permissão de embeds recebem resultado e alvo em texto com limite seguro', async () => {
  const { presentMessage, embedsPermitted } = await import('../packages/discord-ui/index.ts');
  assert.equal(embedsPermitted('0'), false);
  assert.equal(embedsPermitted('16384'), true);
  assert.equal(embedsPermitted('invalid'), false);
  const result = roll(Array(10).fill('40d1000').join('+'), { target: 15 });
  const message = presentMessage(formatRoll(result), false);
  assert.equal(message.embeds, undefined);
  assert.equal(message.flags, undefined);
  assert.equal(message.components, undefined);
  assert(message.content!.length <= 2000);
  assert.match(message.content!, /Alvo 15/);
  assert.match(message.content!, new RegExp(String(result.total)));
});
