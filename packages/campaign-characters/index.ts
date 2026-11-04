import { validateSheet, evaluateSheet, type Sheet } from '../sheet-engine/index.js';
import { newTree } from '../tree-editor/index.js';
import type { CampaignParticipant } from '../campaign-types/index.js';
export type CampaignCharacter = { sheet: Sheet | null; revision: number; updatedAt: string };
export type CharacterParticipant = Omit<CampaignParticipant, 'character'> & {
  character?: CampaignCharacter;
};
export class CharacterError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function withCharacterTree(sheet: Sheet): Sheet {
  if (!sheet || typeof sheet !== 'object')
    throw new CharacterError(400, 'Selecione uma ficha válida.');
  return validateSheet({
    ...sheet,
    skillTree: sheet.skillTree ?? {
      ...newTree(),
      character: sheet.name,
      name: `Habilidades de ${sheet.name}`,
    },
  });
}
export function characterSummary(character?: CampaignCharacter) {
  if (!character?.sheet) return undefined;
  return {
    name: character.sheet.name,
    revision: character.revision,
    updatedAt: character.updatedAt,
    skills: character.sheet.skillTree?.skills.length ?? 0,
    unlocked: character.sheet.skillTree?.skills.filter((s) => s.unlocked).length ?? 0,
  };
}
export function readCharacter(
  participants: CharacterParticipant[],
  viewer: CharacterParticipant,
  participantId?: string,
) {
  const target = participants.find((p) => p.id === (participantId || viewer.id));
  if (!target) throw new CharacterError(404, 'Personagem ou participante inexistente.');
  if (target.id !== viewer.id && viewer.role !== 'dm')
    throw new CharacterError(403, 'A ficha é visível apenas ao dono e ao DM desta campanha.');
  return {
    participantId: target.id,
    participantName: target.name,
    canEdit: target.id === viewer.id,
    sheet: target.character?.sheet ?? null,
    revision: target.character?.revision ?? 0,
    updatedAt: target.character?.updatedAt ?? null,
  };
}
export function writeCharacter(
  viewer: CharacterParticipant,
  sheet: Sheet | null,
  revision: unknown,
) {
  if (!Number.isInteger(revision) || revision !== (viewer.character?.revision ?? 0))
    throw new CharacterError(
      409,
      'A ficha mudou em outra sessão. Reabra o personagem antes de salvar.',
    );
  if (sheet === null) {
    viewer.character = {
      sheet: null,
      revision: Number(revision) + 1,
      updatedAt: new Date().toISOString(),
    };
    return;
  }
  const next = withCharacterTree(sheet);
  evaluateSheet(next);
  if (new TextEncoder().encode(JSON.stringify(next)).length > 96 * 1024)
    throw new CharacterError(
      413,
      'A ficha e sua árvore excedem o limite de compartilhamento de 96 KB.',
    );
  viewer.character = {
    sheet: structuredClone(next),
    revision: Number(revision) + 1,
    updatedAt: new Date().toISOString(),
  };
}
