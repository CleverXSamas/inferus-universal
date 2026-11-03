import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newTree,
  validateTreeDocument,
  placeSkill,
  moveSkill,
  deleteSkill,
  deleteBranch,
  descendants,
  canUnlock,
  parentOptions,
} from '../packages/tree-editor/index.ts';
test('biblioteca reutiliza a mesma skill em qualquer ramo sem alterar o modelo', () => {
  const doc = newTree(),
    template = doc.library.find((n) => n.id === 'investida')!;
  const first = placeSkill(doc, template, 'copy_a', 'mente', 'eco');
  const second = placeSkill(first, template, 'copy_b', 'corpo', 'brasa');
  assert.equal(second.skills.find((n) => n.id === 'copy_a')?.branchId, 'mente');
  assert.equal(second.skills.find((n) => n.id === 'copy_b')?.parentId, 'brasa');
  assert.equal(doc.skills.length, 5);
  assert.equal(second.library.length, 5);
  assert.equal(template.id, 'investida');
});
test('mover uma skill leva suas dependências e rejeita ciclos e ligações entre ramos', () => {
  const doc = newTree();
  const moved = moveSkill(doc, 'brasa', 'mente', 'eco');
  assert.equal(moved.skills.find((n) => n.id === 'investida')?.branchId, 'mente');
  assert.equal(moved.skills.find((n) => n.id === 'brasa')?.parentId, 'eco');
  assert.throws(() => moveSkill(doc, 'brasa', 'corpo', 'investida'), /ciclo/);
  assert.throws(() => moveSkill(doc, 'brasa', 'corpo', 'eco'), /outro ramo/);
  assert(!parentOptions(doc, 'corpo', 'brasa').some((n) => n.id === 'investida'));
});
test('exclusão de uma única skill preserva e reconecta as seguintes, inclusive na origem', () => {
  const doc = newTree();
  const without = deleteSkill(doc, 'brasa');
  assert.equal(without.skills.find((n) => n.id === 'investida')?.parentId, 'centro');
  assert(!without.skills.some((n) => n.id === 'brasa'));
  assert.equal(without.skills.length, 4);
  const noRoot = deleteSkill(doc, 'centro');
  assert.equal(noRoot.skills.find((n) => n.id === 'brasa')?.parentId, null);
  assert.equal(noRoot.skills.find((n) => n.id === 'eco')?.parentId, null);
  validateTreeDocument(noRoot);
});
test('exclusão de sequência ou ramo remove skills e conexões sem afetar biblioteca e outros ramos', () => {
  const doc = newTree();
  const removed = deleteSkill(doc, 'brasa', true);
  assert.deepEqual(new Set(removed.skills.map((n) => n.id)), new Set(['centro', 'eco', 'vigilia']));
  assert.equal(removed.library.length, 5);
  const withoutBranch = deleteBranch(doc, 'mente');
  assert.equal(withoutBranch.branches.length, 1);
  assert.deepEqual(
    new Set(withoutBranch.skills.map((n) => n.id)),
    new Set(['centro', 'brasa', 'investida']),
  );
  assert.equal(withoutBranch.library.length, 5);
});
test('todas as skills, incluindo a origem, podem ser excluídas e o mapa vazio aceita um novo começo', () => {
  const doc = deleteSkill(newTree(), 'centro', true);
  assert.equal(doc.skills.length, 0);
  const rebuilt = placeSkill(doc, doc.library[0], 'new_root', null, null);
  assert(canUnlock(rebuilt, rebuilt.skills[0]));
  assert.equal(descendants(rebuilt, 'new_root').size, 0);
});
test('carregamento rejeita ciclos, IDs duplicados, ramo inexistente e posições inválidas', () => {
  const doc = newTree();
  assert.throws(() => validateTreeDocument({ ...doc, skills: [...doc.skills, doc.skills[0]] }));
  assert.throws(() =>
    validateTreeDocument({
      ...doc,
      skills: doc.skills.map((n) => (n.id === 'centro' ? { ...n, parentId: 'investida' } : n)),
    }),
  );
  assert.throws(() =>
    validateTreeDocument({
      ...doc,
      skills: doc.skills.map((n) => ({ ...n, branchId: 'missing' })),
    }),
  );
  assert.throws(() => validateTreeDocument({ ...doc, viewport: { x: 0, y: 0, zoom: NaN } }));
  assert.throws(() =>
    validateTreeDocument({
      ...doc,
      skills: doc.skills.map((n) => ({ ...n, position: { x: Infinity, y: 0 } })),
    }),
  );
  assert.throws(() => placeSkill(doc, doc.library[0], 'new', 'missing', null));
});
