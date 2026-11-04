export type Token = {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  participantId?: string;
  hidden: boolean;
};
export type Tabletop = {
  revision: number;
  name: string;
  columns: number;
  rows: number;
  map: string;
  tokens: Token[];
};
type Member = { id: string; role: string; character?: unknown };
export const emptyTabletop = (): Tabletop => ({
  revision: 0,
  name: 'Cena da aventura',
  columns: 24,
  rows: 18,
  map: '',
  tokens: [],
});
export class TabletopError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new TabletopError(status, message);
};
export function visibleTabletop(
  scene: Tabletop | undefined,
  actor: Member,
  members: Member[],
): Tabletop {
  const s = structuredClone(scene ?? emptyTabletop());
  s.tokens = s.tokens.filter(
    (t) =>
      (!t.participantId || members.some((p) => p.id === t.participantId)) &&
      (actor.role === 'dm' || !t.hidden || t.participantId === actor.id),
  );
  return s;
}
export function updateTabletop(
  scene: Tabletop | undefined,
  actor: Member,
  members: Member[],
  status: string,
  input: unknown,
): Tabletop {
  const s = structuredClone(scene ?? emptyTabletop());
  if (!input || typeof input !== 'object') return fail(400, 'Alteração da mesa inválida.');
  const a = input as Record<string, unknown>;
  if (status === 'closed') return fail(409, 'A campanha está encerrada.');
  if (a.revision !== s.revision) return fail(409, 'A mesa mudou. Atualize e tente novamente.');
  const dm = actor.role === 'dm';
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const integer = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
      ? v
      : fail(400, 'Posição ou tamanho inválido.');
  s.tokens = s.tokens.filter(
    (t) => !t.participantId || members.some((p) => p.id === t.participantId),
  );
  if (a.kind === 'configure') {
    if (!dm) return fail(403, 'Apenas o mestre pode configurar a cena.');
    s.name = text(a.name, 80) || 'Cena da aventura';
    s.columns = integer(a.columns, 8, 60);
    s.rows = integer(a.rows, 8, 60);
    s.map = text(a.map, 2000);
    if (s.map) {
      try {
        const url = new URL(s.map);
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
      } catch {
        return fail(400, 'Use um endereço HTTPS para o mapa.');
      }
    }
    s.tokens.forEach((t) => {
      t.x = Math.min(t.x, s.columns - 1);
      t.y = Math.min(t.y, s.rows - 1);
    });
  } else if (a.kind === 'add') {
    if (s.tokens.length >= 60) return fail(400, 'Esta cena aceita até 60 tokens.');
    const participantId = text(a.participantId, 80) || undefined;
    if (!dm && participantId !== actor.id)
      return fail(403, 'Você só pode adicionar seu personagem.');
    if (participantId && !members.some((p) => p.id === participantId && p.character))
      return fail(400, 'Vincule uma ficha antes de adicionar o personagem.');
    if (participantId && s.tokens.some((t) => t.participantId === participantId))
      return fail(409, 'Este personagem já está na cena.');
    const color = text(a.color, 7);
    s.tokens.push({
      id: crypto.randomUUID(),
      name: text(a.name, 60) || 'Personagem',
      participantId,
      x: integer(a.x ?? 0, 0, s.columns - 1),
      y: integer(a.y ?? 0, 0, s.rows - 1),
      color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#b298d6',
      hidden: dm && a.hidden === true,
    });
  } else {
    const t = s.tokens.find((t) => t.id === a.id);
    if (!t || (!dm && t.hidden && t.participantId !== actor.id))
      return fail(404, 'Token não encontrado.');
    if (!dm && t.participantId !== actor.id)
      return fail(403, 'Você só pode controlar seu personagem.');
    if (a.kind === 'move') {
      t.x = integer(a.x, 0, s.columns - 1);
      t.y = integer(a.y, 0, s.rows - 1);
    } else if (a.kind === 'remove') s.tokens = s.tokens.filter((x) => x.id !== t.id);
    else if (a.kind === 'visibility' && dm) t.hidden = a.hidden === true;
    else return fail(400, 'Ação da mesa inválida.');
  }
  s.revision++;
  return s;
}
