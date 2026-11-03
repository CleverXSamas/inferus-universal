import { defaultPool, type SkillNode } from '../tree-core/index.js';
export type Point = { x: number; y: number };
export type Branch = { id: string; name: string; color: string };
export type EditorSkill = SkillNode & {
  branchId: string | null;
  parentId: string | null;
  position: Point;
  unlocked: boolean;
};
export type TreeDocument = {
  version: 1;
  name: string;
  character: string;
  level: number;
  branches: Branch[];
  skills: EditorSkill[];
  library: SkillNode[];
  viewport: { x: number; y: number; zoom: number };
};
export const branchColors = ['#bd9ae8', '#e3b77a', '#83c4b0', '#e593ac', '#86b4df', '#b8c67c'];
export function newTree(
  template: 'universal' | 'combat' | 'magic' | 'blank' = 'universal',
): TreeDocument {
  const pool = defaultPool();
  const doc: TreeDocument = {
    version: 1,
    name: 'Minha árvore',
    character: 'Aventureiro',
    level: 2,
    branches: [],
    skills: [],
    library: pool.nodes,
    viewport: { x: 60, y: 80, zoom: 0.8 },
  };
  if (template === 'blank') return doc;
  doc.branches = [
    {
      id: 'corpo',
      name: template === 'magic' ? 'Rituais' : 'Corpo e combate',
      color: branchColors[1],
    },
    {
      id: 'mente',
      name: template === 'combat' ? 'Defesa e resistência' : 'Mente e magia',
      color: branchColors[0],
    },
  ];
  doc.skills = pool.nodes.map((n, i) => ({
    ...n,
    branchId: i === 0 ? null : i % 2 ? 'corpo' : 'mente',
    parentId: pool.edges.find((e) => e.to === n.id)?.from ?? null,
    position: { x: i === 0 ? 250 : i % 2 ? 40 : 460, y: i === 0 ? 0 : i < 3 ? 180 : 360 },
    unlocked: false,
  }));
  if (template === 'combat') {
    doc.name = 'Caminhos do guerreiro';
    doc.skills = doc.skills.map((n, i) => ({
      ...n,
      name: ['Despertar', 'Disciplina', 'Guarda firme', 'Investida', 'Resiliência'][i],
      description: [
        'O primeiro passo.',
        'Treinamento e precisão.',
        'Proteja seus aliados.',
        'Avance contra o perigo.',
        'Continue de pé.',
      ][i],
    }));
  }
  if (template === 'magic') {
    doc.name = 'Círculos do arcano';
    doc.skills = doc.skills.map((n, i) => ({
      ...n,
      name: ['Centelha', 'Canalização', 'Eco arcano', 'Ritual', 'Vínculo'][i],
      type: i ? 'magia' : 'passiva',
    }));
  }
  return doc;
}
export function descendants(doc: TreeDocument, id: string): Set<string> {
  const found = new Set<string>();
  const queue = [id];
  for (let i = 0; i < queue.length; i++)
    for (const n of doc.skills)
      if (n.parentId === queue[i] && n.id !== id && !found.has(n.id)) {
        found.add(n.id);
        queue.push(n.id);
      }
  return found;
}
export function parentOptions(
  doc: TreeDocument,
  branchId: string | null,
  excluded?: string,
): EditorSkill[] {
  const banned = excluded ? new Set([excluded, ...descendants(doc, excluded)]) : new Set();
  return doc.skills.filter(
    (n) => !banned.has(n.id) && (n.branchId === branchId || n.branchId === null),
  );
}
function checkPlacement(
  doc: TreeDocument,
  branchId: string | null,
  parentId: string | null,
  excluded?: string,
) {
  if (branchId !== null && !doc.branches.some((b) => b.id === branchId))
    throw new Error('Escolha um ramo existente.');
  if (parentId !== null && !parentOptions(doc, branchId, excluded).some((n) => n.id === parentId))
    throw new Error('A conexão criaria um ciclo ou aponta para outro ramo.');
}
export function placeSkill(
  doc: TreeDocument,
  template: SkillNode,
  id: string,
  branchId: string | null,
  parentId: string | null,
): TreeDocument {
  checkPlacement(doc, branchId, parentId);
  if (doc.skills.some((n) => n.id === id)) throw new Error('Esta skill já existe no mapa.');
  const parent = doc.skills.find((n) => n.id === parentId);
  const siblings = doc.skills.filter((n) => n.parentId === parentId);
  const position = parent
    ? {
        x:
          parent.position.x +
          (siblings.length % 2 ? -1 : 1) * (210 + Math.floor(siblings.length / 2) * 200),
        y: parent.position.y + 180,
      }
    : { x: doc.skills.length * 210, y: 0 };
  const next = {
    ...doc,
    skills: [
      ...doc.skills,
      { ...structuredClone(template), id, branchId, parentId, position, unlocked: false },
    ],
  };
  return validateTreeDocument(next);
}
export function moveSkill(
  doc: TreeDocument,
  id: string,
  branchId: string | null,
  parentId: string | null,
): TreeDocument {
  const node = doc.skills.find((n) => n.id === id);
  if (!node) throw new Error('Skill não encontrada.');
  checkPlacement(doc, branchId, parentId, id);
  const following = descendants(doc, id);
  return validateTreeDocument({
    ...doc,
    skills: doc.skills.map((n) =>
      n.id === id
        ? { ...n, branchId, parentId, unlocked: false }
        : following.has(n.id)
          ? { ...n, branchId, unlocked: false }
          : n,
    ),
  });
}
export function deleteSkill(doc: TreeDocument, id: string, subtree = false): TreeDocument {
  const node = doc.skills.find((n) => n.id === id);
  if (!node) return doc;
  const removed = new Set([id, ...(subtree ? descendants(doc, id) : [])]);
  // Removing a single skill reconnects its children to the preceding skill.
  return validateTreeDocument({
    ...doc,
    skills: doc.skills
      .filter((n) => !removed.has(n.id))
      .map((n) => (n.parentId === id ? { ...n, parentId: node.parentId } : n)),
  });
}
export function deleteBranch(doc: TreeDocument, id: string): TreeDocument {
  const removed = new Set(doc.skills.filter((n) => n.branchId === id).map((n) => n.id));
  for (const node of [...removed]) for (const child of descendants(doc, node)) removed.add(child);
  return validateTreeDocument({
    ...doc,
    branches: doc.branches.filter((b) => b.id !== id),
    skills: doc.skills.filter((n) => !removed.has(n.id)),
  });
}
export function canUnlock(doc: TreeDocument, node: EditorSkill) {
  return (
    !node.unlocked &&
    (node.parentId === null || doc.skills.some((n) => n.id === node.parentId && n.unlocked))
  );
}
export function validateTreeDocument(doc: TreeDocument): TreeDocument {
  if (
    !doc ||
    doc.version !== 1 ||
    typeof doc.name !== 'string' ||
    doc.name.length > 120 ||
    typeof doc.character !== 'string' ||
    doc.character.length > 120 ||
    !Number.isInteger(doc.level) ||
    doc.level < 1 ||
    doc.level > 100 ||
    !Array.isArray(doc.branches) ||
    doc.branches.length > 30 ||
    !Array.isArray(doc.skills) ||
    doc.skills.length > 200 ||
    !Array.isArray(doc.library) ||
    doc.library.length > 200
  )
    throw new Error('Árvore inválida ou limite de tamanho excedido.');
  const branches = new Set<string>();
  const ids = new Set<string>();
  const libraryIds = new Set<string>();
  const idValid = (id: string) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
  for (const b of doc.branches) {
    if (
      !b ||
      !idValid(b.id) ||
      branches.has(b.id) ||
      typeof b.name !== 'string' ||
      !b.name.trim() ||
      b.name.length > 80 ||
      !/^#[a-fA-F0-9]{6}$/.test(b.color)
    )
      throw new Error('Ramo inválido.');
    branches.add(b.id);
  }
  const validSkill = (n: SkillNode) =>
    n &&
    idValid(n.id) &&
    typeof n.name === 'string' &&
    n.name.trim() &&
    n.name.length <= 120 &&
    typeof n.description === 'string' &&
    n.description.length <= 2000 &&
    ['passiva', 'ativa', 'magia'].includes(n.type) &&
    Number.isFinite(n.cost) &&
    n.cost >= 0 &&
    n.cost <= 1000000 &&
    Number.isFinite(n.weight) &&
    n.weight >= 0 &&
    Number.isInteger(n.minLevel) &&
    n.minLevel >= 1 &&
    (!n.effect ||
      ((n.effect.amount === undefined || Number.isFinite(n.effect.amount)) &&
        (n.effect.field === undefined ||
          (typeof n.effect.field === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(n.effect.field))) &&
        (n.effect.expression === undefined ||
          (typeof n.effect.expression === 'string' && n.effect.expression.length <= 200))));
  for (const n of doc.library) {
    if (!validSkill(n) || libraryIds.has(n.id)) throw new Error('Skill da biblioteca inválida.');
    libraryIds.add(n.id);
  }
  for (const n of doc.skills) {
    if (
      !validSkill(n) ||
      ids.has(n.id) ||
      (n.branchId !== null && !branches.has(n.branchId)) ||
      !n.position ||
      ![n.position.x, n.position.y].every((v) => Number.isFinite(v) && Math.abs(v) <= 100000) ||
      typeof n.unlocked !== 'boolean'
    )
      throw new Error('Skill do mapa inválida.');
    ids.add(n.id);
  }
  for (const n of doc.skills) {
    if (n.parentId !== null && (!ids.has(n.parentId) || n.parentId === n.id))
      throw new Error('Conexão inválida.');
    const seen = new Set([n.id]);
    let parent = n.parentId;
    while (parent !== null) {
      if (seen.has(parent)) throw new Error('A árvore não pode conter ciclos.');
      seen.add(parent);
      const p = doc.skills.find((s) => s.id === parent)!;
      if (p.branchId !== null && p.branchId !== n.branchId)
        throw new Error('Conecte a skill a uma origem ou ao mesmo ramo.');
      parent = p.parentId;
    }
  }
  if (
    !doc.viewport ||
    ![doc.viewport.x, doc.viewport.y, doc.viewport.zoom].every(Number.isFinite) ||
    doc.viewport.zoom < 0.2 ||
    doc.viewport.zoom > 2.5
  )
    throw new Error('Posição do mapa inválida.');
  return doc;
}
