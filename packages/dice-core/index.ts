export type KeepMode = 'all' | 'high' | 'low';
export type Group = {
  count: number;
  sides: number;
  explode: boolean;
  keepMode: KeepMode;
  keepCount: number;
  successTarget?: number;
  sign: 1 | -1;
  raw: string;
};
export type RollSpec = {
  groups: Group[];
  bonus: number;
  target?: number;
  mode: 'sum' | 'success';
  normalized: string;
};
export type DieAudit = {
  index: number;
  raw: number[];
  total: number;
  kept: boolean;
  success?: boolean;
};
export type GroupAudit = { raw: string; subtotal: number; dice: DieAudit[]; successes?: number };
export type RollRecord = {
  roll_id: string;
  expression: string;
  user?: string;
  channel?: string;
  groups: GroupAudit[];
  bonus: number;
  total: number;
  target?: number;
  passed?: boolean;
  created_at: string;
  mode: 'sum' | 'success';
};

const MAX_EXPLOSION_DEPTH = 64;
const isInt = (n: number) => Number.isInteger(n);
const fail = (message: string): never => {
  throw new Error(message);
};
function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const a = new Uint32Array(4);
    globalThis.crypto.getRandomValues(a);
    return `${a[0].toString(16)}-${a[1].toString(16)}-4${(a[2] & 0xfff).toString(16)}-${((a[3] & 0x3fff) | 0x8000).toString(16)}-${a[0].toString(16)}${a[1].toString(16)}`;
  }
  throw new Error('Fonte criptográfica indisponível.');
}
function secureFace(sides: number) {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const max = 0x100000000;
    const limit = max - (max % sides);
    const a = new Uint32Array(1);
    do {
      globalThis.crypto.getRandomValues(a);
    } while (a[0] >= limit);
    return (a[0] % sides) + 1;
  }
  // Node path is loaded dynamically to keep the browser bundle dependency-free.
  throw new Error('Fonte criptográfica indisponível.');
}

export function parseExpression(input: string): RollSpec {
  const text = input.replace(/\s+/g, '').replace(/−/g, '-');
  if (text.length < 2 || text.length > 160) fail('A expressão deve ter entre 2 e 160 caracteres.');
  if (!/^[+-]?[^+-]+(?:[+-][^+-]+)*$/.test(text)) fail('Operador sem termo na expressão.');
  const parts = text.match(/[+-]?[^+-]+/g) ?? [];
  let bonus = 0;
  const groups: Group[] = [];
  let mode: 'sum' | 'success' = 'sum';
  let successTarget: number | undefined;
  for (let token of parts) {
    const alias = token.match(/^([+-]?)(\d*)d(\d+|%)(!|(?:kh|kl|dh|dl|k|d)\d+|>=\d+)?$/i);
    if (alias) {
      let op = (alias[4] ?? '').toLowerCase();
      if (/^k\d/.test(op)) op = 'kh' + op.slice(1);
      if (/^d\d/.test(op)) op = 'dl' + op.slice(1);
      token = `${alias[1]}${alias[2] || '1'}d${alias[3] === '%' ? '100' : alias[3]}${op}`;
    }

    if (/^[-+]?\d+$/.test(token)) {
      if (!Number.isSafeInteger(Number(token))) fail('Bônus deve usar inteiros seguros.');
      bonus += Number(token);
      continue;
    }
    const m = token.match(/^([+-]?)(\d+)d(\d+)(!|kh(\d+)|kl(\d+)|dh(\d+)|dl(\d+)|>=(\d+))?$/i);
    if (!m) fail(`Parte inválida: ${token}`);
    const match = m as RegExpMatchArray;
    const count = Number(match[2]),
      sides = Number(match[3]);
    if (count < 1 || count > 40) fail('Cada grupo deve ter de 1 a 40 dados.');
    if (sides < 2 || sides > 1000) fail('Cada dado deve ter de 2 a 1000 lados.');
    const op = (match[4] ?? '').toLowerCase();
    let keepMode: KeepMode = 'all',
      keepCount = count,
      explode = false,
      target: number | undefined;
    if (op === '!') explode = true;
    else if (op.startsWith('kh')) {
      keepMode = 'high';
      keepCount = Number(match[5]);
    } else if (op.startsWith('kl')) {
      keepMode = 'low';
      keepCount = Number(match[6]);
    } else if (op.startsWith('dh')) {
      keepMode = 'low';
      keepCount = count - Number(match[7]);
    } else if (op.startsWith('dl')) {
      keepMode = 'high';
      keepCount = count - Number(match[8]);
    } else if (op.startsWith('>=')) {
      mode = 'success';
      target = Number(match[9]);
      if (target < 1 || target > sides) fail('O sucesso deve ficar entre 1 e o número de lados.');
      if (successTarget !== undefined && target !== successTarget)
        fail('Todos os grupos de sucesso devem usar o mesmo >=N.');
      successTarget = target;
    }
    if ((op.startsWith('dh') || op.startsWith('dl')) && Number(match[7] ?? match[8]) < 1)
      fail('A quantidade descartada deve ser positiva.');
    if (!isInt(keepCount) || keepCount < 1 || keepCount > count)
      fail('A quantidade mantida deve ficar entre 1 e o número de dados.');
    if (mode === 'success' && successTarget !== undefined && target !== successTarget)
      fail('Todos os grupos de sucesso devem usar o mesmo >=N.');
    groups.push({
      count,
      sides,
      explode,
      keepMode,
      keepCount,
      successTarget: target,
      sign: match[1] === '-' ? -1 : 1,
      raw: token,
    });
  }
  if (!groups.length) fail('Inclua ao menos um grupo no formato XdY.');
  if (bonus < -50 || bonus > 50) fail('O bônus deve ficar entre -50 e +50.');
  if (mode === 'success' && groups.some((g) => g.successTarget === undefined))
    fail('No modo de sucesso, todos os grupos precisam usar >=N.');
  const normalized =
    groups
      .map(
        (g) =>
          `${g.sign < 0 ? '-' : ''}${g.count}d${g.sides}${g.explode ? '!' : g.successTarget !== undefined ? `>=${g.successTarget}` : g.keepMode === 'high' ? `kh${g.keepCount}` : g.keepMode === 'low' ? `kl${g.keepCount}` : ''}`,
      )
      .join('+')
      .replace(/\+-/g, '-') + (bonus ? `${bonus > 0 ? '+' : ''}${bonus}` : '');
  if (normalized.length > 160)
    fail('A expressão normalizada excede 160 caracteres. Reduza os grupos.');
  return { groups, bonus, mode, normalized, target: undefined };
}
function rollGroup(g: Group) {
  const dice: DieAudit[] = [];
  for (let i = 0; i < g.count; i++) {
    const raw: number[] = [];
    let total = 0;
    for (let depth = 0; depth < MAX_EXPLOSION_DEPTH; depth++) {
      const face = secureFace(g.sides);
      raw.push(face);
      total += face;
      if (!g.explode || face !== g.sides) break;
    }
    dice.push({ index: i, raw, total, kept: true });
  }
  const order = [...dice].sort(
    (a, b) => (g.keepMode === 'low' ? a.total - b.total : b.total - a.total) || a.index - b.index,
  );
  if (g.keepMode !== 'all') order.slice(g.keepCount).forEach((d) => (d.kept = false));
  const kept = dice.filter((d) => d.kept);
  const subtotal = kept.reduce((s, d) => s + d.total, 0);
  const successes =
    g.successTarget === undefined
      ? undefined
      : kept.filter((d) => d.total >= g.successTarget!).length;
  return { dice, subtotal, successes };
}
export function roll(
  specOrExpression: RollSpec | string,
  meta: { user?: string; channel?: string; target?: number } = {},
): RollRecord {
  const spec =
    typeof specOrExpression === 'string' ? parseExpression(specOrExpression) : specOrExpression;
  const audits = spec.groups.map(rollGroup);
  const rawTotal = audits.reduce((s, a, i) => s + spec.groups[i].sign * a.subtotal, 0);
  const rawSuccess = audits.reduce((s, a, i) => s + spec.groups[i].sign * (a.successes ?? 0), 0);
  const total = (spec.mode === 'success' ? rawSuccess : rawTotal) + spec.bonus;
  const target = meta.target;
  if (target !== undefined && (!isInt(target) || target < -50 || target > 1000))
    fail('O alvo deve ser um inteiro entre -50 e 1000.');
  return {
    roll_id: uuid(),
    expression: spec.normalized,
    user: meta.user,
    channel: meta.channel,
    groups: audits.map((a, i) => ({
      raw: spec.groups[i].raw,
      subtotal: spec.groups[i].sign * a.subtotal,
      dice: a.dice,
      successes: a.successes,
    })),
    bonus: spec.bonus,
    total,
    target,
    passed: target === undefined ? undefined : total >= target,
    created_at: new Date().toISOString(),
    mode: spec.mode,
  };
}
export function recalculate(record: RollRecord) {
  return (
    record.groups.reduce(
      (sum, g) =>
        sum +
        (record.mode === 'success'
          ? (g.raw.startsWith('-') ? -1 : 1) * (g.successes ?? 0)
          : g.subtotal),
      0,
    ) + record.bonus
  );
}
export const PRESETS = [
  { id: 'd20', name: 'Teste de d20', expression: '1d20' },
  { id: 'vantagem', name: 'Vantagem', expression: '2d20kh1' },
  { id: 'desvantagem', name: 'Desvantagem', expression: '2d20kl1' },
  { id: 'atributo', name: 'Atributo', expression: '4d6kh3' },
  { id: 'dano', name: 'Dano', expression: '2d6+3' },
  { id: 'explosivo', name: 'Explosivo', expression: '3d6!' },
  { id: 'pool', name: 'Pool de sucessos', expression: '6d10>=8' },
];

/** Validate saved results before rendering history; broken browser storage is recoverable. */
export function isRollRecord(value: unknown): value is RollRecord {
  try {
    if (!value || typeof value !== 'object') return false;
    const r = value as RollRecord;
    if (
      typeof r.expression !== 'string' ||
      typeof r.roll_id !== 'string' ||
      !r.roll_id ||
      typeof r.created_at !== 'string' ||
      !Number.isFinite(Date.parse(r.created_at)) ||
      !Number.isSafeInteger(r.total) ||
      !Number.isSafeInteger(r.bonus) ||
      !Array.isArray(r.groups)
    )
      return false;
    if (r.target === undefined && r.passed !== undefined) return false;
    const spec = parseExpression(r.expression);
    if (r.mode !== spec.mode || r.bonus !== spec.bonus || r.groups.length !== spec.groups.length)
      return false;
    if (
      r.target !== undefined &&
      (!Number.isInteger(r.target) ||
        r.target < -50 ||
        r.target > 1000 ||
        r.passed !== r.total >= r.target)
    )
      return false;
    return (
      r.groups.every((g, i) => {
        const expected = spec.groups[i];
        if (
          !g ||
          typeof g.raw !== 'string' ||
          parseExpression(g.raw).normalized !== parseExpression(expected.raw).normalized ||
          !Array.isArray(g.dice) ||
          g.dice.length !== expected.count
        )
          return false;
        if (
          !g.dice.every(
            (d, index) =>
              d &&
              d.index === index &&
              typeof d.kept === 'boolean' &&
              Array.isArray(d.raw) &&
              d.raw.length > 0 &&
              d.raw.length <= MAX_EXPLOSION_DEPTH &&
              d.raw.every((n) => Number.isInteger(n) && n >= 1 && n <= expected.sides) &&
              d.total === d.raw.reduce((sum, n) => sum + n, 0),
          )
        )
          return false;
        const kept = g.dice.filter((d) => d.kept);
        return (
          kept.length === expected.keepCount &&
          g.subtotal === expected.sign * kept.reduce((sum, d) => sum + d.total, 0) &&
          (r.mode !== 'success' ||
            g.successes === kept.filter((d) => d.total >= expected.successTarget!).length)
        );
      }) && recalculate(r) === r.total
    );
  } catch {
    return false;
  }
}
