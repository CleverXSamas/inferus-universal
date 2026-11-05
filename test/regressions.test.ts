import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExpression, roll, recalculate } from '../packages/dice-core/index.ts';
import {
  evaluateFormula,
  evaluateSheet,
  validateSheet,
  type Sheet,
} from '../packages/sheet-engine/index.ts';
import { defaultPool, validateGraph, generateTree } from '../packages/tree-core/index.ts';

test('keep/drop seleciona as faces corretas e preserva a semântica normalizada', (t) => {
  for (const [op, total, kept] of [
    ['kh2', 11, [1, 3]],
    ['kl2', 3, [0, 2]],
    ['dh2', 3, [0, 2]],
    ['dl2', 11, [1, 3]],
    ['KH2', 11, [1, 3]],
  ] as const) {
    let face = 0;
    const faces = [1, 6, 2, 5];
    const mocked = t.mock.method(globalThis.crypto, 'getRandomValues', (a: Uint32Array) => {
      a[0] = faces[face++ % faces.length] - 1;
      return a;
    });
    const spec = parseExpression(`4d6${op}`),
      result = roll(spec);
    assert.equal(result.total, total);
    assert.deepEqual(
      result.groups[0].dice.filter((d) => d.kept).map((d) => d.index),
      kept,
    );
    assert.deepEqual(
      parseExpression(spec.normalized).groups.map((g) => [g.keepMode, g.keepCount]),
      spec.groups.map((g) => [g.keepMode, g.keepCount]),
    );
    mocked.mock.restore();
  }
});
test('parser rejeita operadores incompletos e alvos de sucesso inconsistentes', () => {
  for (const expression of [
    '1d6+',
    '+1d6-',
    '1d6++2',
    '1d6--2',
    '1d6>=3+1d8>=5',
    '1d6>=0',
    '1d6>=7',
  ])
    assert.throws(() => parseExpression(expression), expression);
  assert.equal(parseExpression('1d6>=3+1d8>=3').mode, 'success');
});
test('auditoria recalcula sucessos, grupos negativos e bônus', () => {
  const r = roll('4d6>=3-2d8>=3+2');
  assert.equal(recalculate(r), r.total);
  for (const expr of ['2d20kl1', '4d6dh1', '3d6!', '1d20-1d6+3']) {
    const r = roll(expr);
    assert.equal(recalculate(r), r.total);
  }
});
test('funções de fórmula aceitam composição, referências, espaços e sinais', () => {
  assert.equal(evaluateFormula(' max(floor(@forca / 2), ceil(2.1)) + abs(-3) ', { forca: 9 }), 7);
  assert.equal(evaluateFormula('min(4, 2, max(3, 8))', {}), 2);
  assert.equal(evaluateFormula('-ceil(-2.8) + +1', {}), 3);
});
test('fórmulas rejeitam chamadas inválidas, execução e valores não finitos', () => {
  for (const f of [
    '',
    'floor()',
    'floor(1,2)',
    'min()',
    'abs(1',
    'max(1,)',
    'Math.max(1,2)',
    'process.exit()',
    '1/0',
    '@toString',
    '1 2',
  ])
    assert.throws(() => evaluateFormula(f, {}), f);
  assert.throws(() => evaluateFormula('@x', { x: Infinity }));
});
test('ficha resolve dependências fora de ordem e detecta ciclos reais', () => {
  const sheet: Sheet = {
    id: 'ficha',
    name: 'Teste',
    sections: [
      {
        id: 'atributos',
        label: 'Atributos',
        fields: [
          { id: 'total', label: 'Total', type: 'calculated', formula: '@mod + 1' },
          { id: 'mod', label: 'Mod', type: 'calculated', formula: 'floor(@forca/2)' },
          { id: 'forca', label: 'Força', type: 'number', value: 7 },
        ],
      },
    ],
  };
  assert.deepEqual(evaluateSheet(sheet), { forca: 7, mod: 3, total: 4 });
  sheet.sections[0].fields[1].formula = '@total';
  assert.throws(() => evaluateSheet(sheet), /Ciclo/);
});
test('validação aplica limites superiores, inteiros, recursos e IDs únicos', () => {
  const make = (field: unknown) =>
    ({
      id: 'ficha',
      name: 'Teste',
      sections: [{ id: 'sec', label: 'Seção', fields: [field] }],
    }) as Sheet;
  for (const field of [
    { id: 'x', label: 'X', type: 'number', value: 10, max: 5 },
    { id: 'x', label: 'X', type: 'number', value: 1.5, integer: true },
    { id: 'x', label: 'X', type: 'resource', value: { current: 4, max: 3 } },
    { id: 'x', label: 'X', type: 'number', value: NaN },
  ])
    assert.throws(() => validateSheet(make(field)));
});
test('árvores rejeitam IDs duplicados, centro ausente, níveis e custos inválidos', () => {
  const p = defaultPool();
  assert.throws(() => validateGraph([...p.nodes, p.nodes[0]], p.edges));
  assert.throws(() => validateGraph(p.nodes.slice(1), []));
  assert.throws(() => generateTree(p, 'hero', NaN));
  assert.throws(() =>
    validateGraph(
      p.nodes.map((n) => ({ ...n, cost: -1 })),
      p.edges,
    ),
  );
  p.nodes[0].name = 'alterado';
  assert.notEqual(defaultPool().nodes[0].name, 'alterado');
});

test('ações resolvem referências positivas e negativas sem liberar operadores malformados', async () => {
  const { resolveActionExpression } = await import('../packages/sheet-engine/index.ts');
  assert.equal(resolveActionExpression('1d20 + @mod', { mod: -2 }), '1d20-2');
  assert.equal(resolveActionExpression('1d20 - @mod', { mod: -2 }), '1d20+2');
  assert.equal(resolveActionExpression('1d20 - @mod', { mod: 2 }), '1d20-2');
  assert.equal(resolveActionExpression('1d20 + +@mod', { mod: 2 }), '1d20++2');
  assert.throws(() => resolveActionExpression('1d20+@missing', {}));
  assert.throws(() => resolveActionExpression('1d20+@mod', { mod: NaN }));
  assert.throws(() =>
    validateSheet({
      id: 'ficha',
      name: 'Teste',
      sections: [
        {
          id: 's',
          label: 'Ações',
          fields: [{ id: 'a', label: 'Ação', type: 'action', expression: {} as string }],
        },
      ],
    }),
  );
});
