export type FieldType =
  'number' | 'text' | 'boolean' | 'resource' | 'list' | 'calculated' | 'action';
export type Field = {
  id: string;
  label: string;
  type: FieldType;
  value?: unknown;
  min?: number;
  max?: number;
  integer?: boolean;
  formula?: string;
  expression?: string;
};
export type Section = { id: string; label: string; fields: Field[] };
export type Sheet = { id: string; name: string; sections: Section[] };
const identifier = /^[a-z][a-z0-9_]{0,39}$/;
export function validateSheet(sheet: Sheet) {
  if (
    !sheet ||
    typeof sheet.id !== 'string' ||
    !identifier.test(sheet.id) ||
    typeof sheet.name !== 'string' ||
    !sheet.name.trim() ||
    sheet.name.length > 120 ||
    !Array.isArray(sheet.sections) ||
    sheet.sections.length > 300
  )
    throw new Error('Ficha inválida.');
  const ids = new Set<string>(),
    sections = new Set<string>();
  for (const section of sheet.sections) {
    if (
      !section ||
      !identifier.test(section.id) ||
      sections.has(section.id) ||
      typeof section.label !== 'string' ||
      !Array.isArray(section.fields) ||
      section.fields.length > 300
    )
      throw new Error('Seção inválida ou duplicada.');
    sections.add(section.id);
    for (const f of section.fields) {
      if (!f || !identifier.test(f.id) || ids.has(f.id))
        throw new Error(`ID inválido ou duplicado: ${f?.id}`);
      ids.add(f.id);
      if (
        !['number', 'text', 'boolean', 'resource', 'list', 'calculated', 'action'].includes(
          f.type,
        ) ||
        typeof f.label !== 'string'
      )
        throw new Error(`Campo inválido: ${f.id}`);
      if (f.formula !== undefined && (typeof f.formula !== 'string' || f.formula.length > 200))
        throw new Error(`Fórmula inválida: ${f.id}`);
      if (
        [f.min, f.max].some((v) => v !== undefined && !Number.isFinite(v)) ||
        (f.min !== undefined && f.max !== undefined && f.min > f.max)
      )
        throw new Error(`Limites inválidos: ${f.id}`);
      if (f.type === 'number') {
        if (
          typeof f.value !== 'number' ||
          !Number.isFinite(f.value) ||
          (f.integer && !Number.isInteger(f.value)) ||
          (f.min !== undefined && f.value < f.min) ||
          (f.max !== undefined && f.value > f.max)
        )
          throw new Error(`Valor fora dos limites: ${f.id}`);
      }
      if (f.type === 'boolean' && typeof f.value !== 'boolean')
        throw new Error(`Valor booleano inválido: ${f.id}`);
      if (f.type === 'text' && typeof f.value !== 'string')
        throw new Error(`Texto inválido: ${f.id}`);
      if (f.type === 'list' && !Array.isArray(f.value)) throw new Error(`Lista inválida: ${f.id}`);
      if (f.type === 'resource') {
        const r = f.value as { current: number; max: number } | undefined;
        if (
          !r ||
          !Number.isFinite(r.current) ||
          !Number.isFinite(r.max) ||
          r.current < 0 ||
          r.max < 0 ||
          r.current > r.max
        )
          throw new Error(`Recurso inválido: ${f.id}`);
      }
    }
  }
  return sheet;
}
function tokenize(text: string) {
  const tokens: string[] = [],
    re = /\s*(?:(@[a-z][a-z0-9_]*)|([a-z]+)|(\d+(?:\.\d+)?)|([(),+\-*/×]))/gy;
  let pos = 0;
  text = text.trim();
  while (pos < text.length) {
    re.lastIndex = pos;
    const match = re.exec(text);
    if (!match) throw new Error(`Símbolo inválido perto de “${text.slice(pos, pos + 10)}”.`);
    tokens.push(match[1] ?? match[2] ?? match[3] ?? match[4]);
    pos = re.lastIndex;
  }
  return tokens;
}
export function evaluateFormula(
  formula: string,
  values: Record<string, number>,
  stack: string[] = [],
): number {
  if (formula.length > 200) throw new Error('Fórmula excede 200 caracteres.');
  const tokens = tokenize(formula);
  let pos = 0;
  const peek = () => tokens[pos],
    take = () => tokens[pos++];
  const functions: Record<string, (...args: number[]) => number> = {
    floor: Math.floor,
    ceil: Math.ceil,
    min: Math.min,
    max: Math.max,
    abs: Math.abs,
  };
  function primary(): number {
    const x = take();
    if (x === '(') {
      const v = expr();
      if (take() !== ')') throw new Error('Parêntese não fechado.');
      return v;
    }
    if (x?.startsWith('@')) {
      const key = x.slice(1);
      if (stack.includes(key)) throw new Error('Ciclo detectado nas fórmulas.');
      if (!Object.hasOwn(values, key) || !Number.isFinite(values[key]))
        throw new Error(`Referência inexistente ou inválida: @${key}`);
      return values[key];
    }
    if (x && Object.hasOwn(functions, x)) {
      if (take() !== '(') throw new Error('Esperado parêntese após função.');
      const args = [expr()];
      while (peek() === ',') {
        take();
        args.push(expr());
      }
      if (take() !== ')') throw new Error('Parêntese não fechado.');
      if (!['min', 'max'].includes(x) && args.length !== 1)
        throw new Error(`${x} exige um argumento.`);
      return functions[x](...args);
    }
    if (x && /^\d/.test(x)) return Number(x);
    throw new Error('Esperado número, função ou referência.');
  }
  function unary(): number {
    if (peek() === '-' || peek() === '+') {
      const op = take();
      return (op === '-' ? -1 : 1) * unary();
    }
    return primary();
  }
  function term(): number {
    let v = unary();
    while (['*', '/', '×'].includes(peek())) {
      const op = take(),
        r = unary();
      if (op === '/' && r === 0) throw new Error('Divisão por zero.');
      v = op === '/' ? v / r : v * r;
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = take(),
        r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const result = expr();
  if (pos !== tokens.length) throw new Error('Expressão inesperada.');
  if (!Number.isFinite(result)) throw new Error('Resultado não finito.');
  return result;
}
// Resolve dependencies recursively, regardless of field order, and detect actual cycles.
export function evaluateSheet(sheet: Sheet): Record<string, number> {
  validateSheet(sheet);
  const fields = new Map(sheet.sections.flatMap((s) => s.fields).map((f) => [f.id, f]));
  const values: Record<string, number> = {},
    visiting = new Set<string>();
  function resolve(id: string): number {
    if (Object.hasOwn(values, id)) return values[id];
    if (visiting.has(id)) throw new Error('Ciclo detectado nas fórmulas.');
    const field = fields.get(id);
    if (!field) throw new Error(`Referência inexistente: @${id}`);
    if (field.type === 'number') return (values[id] = field.value as number);
    if (field.type !== 'calculated' || !field.formula)
      throw new Error(`Referência não numérica: @${id}`);
    visiting.add(id);
    for (const ref of field.formula.matchAll(/@([a-z][a-z0-9_]*)/g)) resolve(ref[1]);
    values[id] = evaluateFormula(field.formula, values);
    visiting.delete(id);
    return values[id];
  }
  for (const field of fields.values())
    if (field.type === 'number' || field.type === 'calculated') resolve(field.id);
  return values;
}
export const emptySheet = (): Sheet => ({ id: 'ficha', name: 'Minha ficha', sections: [] });
export const sampleSheet: Sheet = {
  id: 'aventureiro',
  name: 'Aventureiro',
  sections: [
    {
      id: 'atributos',
      label: 'Atributos',
      fields: [
        { id: 'forca', label: 'Força', type: 'number', value: 3, min: 0, max: 20, integer: true },
        {
          id: 'mod_forca',
          label: 'Mod. de força',
          type: 'calculated',
          formula: 'floor((@forca - 10) / 2)',
        },
      ],
    },
    {
      id: 'recursos',
      label: 'Recursos',
      fields: [{ id: 'vida', label: 'Vida', type: 'resource', value: { current: 12, max: 12 } }],
    },
    {
      id: 'acoes',
      label: 'Ações',
      fields: [{ id: 'golpe', label: 'Golpe', type: 'action', expression: '1d20 + @mod_forca' }],
    },
  ],
};
