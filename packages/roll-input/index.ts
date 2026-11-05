import { parseExpression } from '../dice-core/index.js';
export const MAX_REPEATS = 10,
  MAX_BATCH_DICE = 100;
/** Parse only an explicitly invoked dice command. Never scans general chat. */
export function parseRollInput(raw: string) {
  if (raw.length > 300) throw new Error('Use uma jogada de até 300 caracteres.');
  const divider = raw.indexOf('|');
  let options = (divider < 0 ? raw : raw.slice(0, divider)).trim();
  let reason = divider < 0 ? '' : raw.slice(divider + 1).trim();
  const targetMatch = options.match(/\s+alvo:(-?\d+)\s*$/i);
  const target = targetMatch ? Number(targetMatch[1]) : undefined;
  if (targetMatch) options = options.slice(0, targetMatch.index).trim();
  if (target !== undefined && (!Number.isInteger(target) || target < -50 || target > 1000))
    throw new Error('O alvo deve ser um inteiro entre -50 e 1000.');
  const repeated = options.match(/^(\d+)\s*#\s*/);
  const times = repeated ? Number(repeated[1]) : 1;
  if (!Number.isInteger(times) || times < 1 || times > MAX_REPEATS)
    throw new Error('Repita de 1 a 10 vezes, como 6#4d6d1.');
  if (repeated) options = options.slice(repeated[0].length);
  let spec;
  try {
    spec = parseExpression(options);
  } catch (original) {
    // A free title begins with a letter. Dice operators/options stay errors, never labels.
    if (divider >= 0) throw original;
    for (const m of options.matchAll(/\s+(?=\p{L})/gu)) {
      const label = options.slice(m.index! + m[0].length);
      if (/^(?:d\d|kh|kl|dh|dl|alvo:|privado:)/i.test(label) || label.includes(':')) continue;
      try {
        const parsed = parseExpression(options.slice(0, m.index));
        spec = parsed;
        reason = label;
        break;
      } catch {}
    }
    if (!spec) throw original;
  }
  if (reason.length > 80) throw new Error('Use um motivo de até 80 caracteres.');
  reason = reason.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (times > 1 && spec.groups.reduce((sum, g) => sum + g.count, 0) * times > MAX_BATCH_DICE)
    throw new Error(
      'Use no máximo 100 dados iniciais por lote. Reduza as repetições ou os grupos.',
    );
  return { expression: spec.normalized, reason, target, times };
}
