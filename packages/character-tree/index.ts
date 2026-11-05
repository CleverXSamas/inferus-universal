import { validateSheet, type Sheet } from '../sheet-engine/index.js';
import { newTree } from '../tree-editor/index.js';
export function withCharacterTree(sheet: Sheet): Sheet {
  if (!sheet || typeof sheet !== 'object') throw new Error('Selecione uma ficha válida.');
  return validateSheet({
    ...sheet,
    skillTree: sheet.skillTree ?? {
      ...newTree(),
      character: sheet.name,
      name: `Habilidades de ${sheet.name}`,
    },
  });
}
