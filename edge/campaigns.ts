import {
  readCharacter,
  writeCharacter,
  characterSummary,
  type CharacterParticipant,
} from '../packages/campaign-characters/index.js';
import type { Sheet } from '../packages/sheet-engine/index.js';
import { campaignStatusLabels } from '../packages/campaign-types/index.js';
import type {
  CampaignRole,
  CampaignStatus,
  CampaignState,
  CampaignEvent,
  CampaignParticipant,
} from '../packages/campaign-types/index.js';
import { type D1Database, ApiError, hash, token, id, clean } from './types.js';
type Participant = CharacterParticipant & { openId?: string };
type Campaign = Omit<CampaignState, 'participants'> & {
  participants: Participant[];
  inviteHash: string;
  sessions: { sessionHash: string; participantId: string }[];
};
type Row = { id: string; revision: number; document: string };
const publicState = (c: Campaign): CampaignState => ({
  id: c.id,
  name: c.name,
  status: c.status,
  createdAt: c.createdAt,
  revoked: c.revoked,
  participants: c.participants.map(({ openId, character, ...p }) => ({
    ...p,
    character: characterSummary(character),
  })),
  events: c.events.slice(-80),
});
const record = (c: Campaign, kind: CampaignEvent['kind'], author: string, body: string) => {
  c.events.push({ id: id('evt'), kind, author, body, createdAt: new Date().toISOString() });
  c.events = c.events.slice(-80);
};
function auth(c: Campaign, sessionHash: string, owner?: string, dm = false) {
  const session = c.sessions.find((s) => s.sessionHash === sessionHash);
  const p =
    (owner ? c.participants.find((p) => p.openId === owner) : undefined) ??
    c.participants.find((p) => p.id === session?.participantId && !p.openId);
  if (!p)
    throw new ApiError(
      403,
      'Sessão de campanha inválida. Entre novamente pela sua conta ou convite.',
    );
  if (dm && p.role !== 'dm') throw new ApiError(403, 'Apenas o DM pode gerenciar a campanha.');
  return p;
}
export function createEdgeCampaignStore(db: D1Database) {
  async function run<T>(locator: string, write: boolean, fn: (c: Campaign) => T) {
    const inviteHash = await hash(locator);
    // Optimistic compare-and-swap makes the whole state transition atomic in D1.
    // A competing join/remove/status operation retries against the new revision.
    for (let attempt = 0; attempt < 12; attempt++) {
      const row = await db
        .prepare('SELECT id,revision,document FROM edge_campaigns WHERE id=? OR invite_hash=?')
        .bind(locator, inviteHash)
        .first<Row>();
      if (!row) throw new ApiError(404, 'Campanha ou convite inexistente.');
      const c = JSON.parse(row.document) as Campaign,
        result = fn(c);
      if (!write) return result;
      const saved = await db
        .prepare(
          'UPDATE edge_campaigns SET document=?,invite_hash=?,revision=revision+1 WHERE id=? AND revision=?',
        )
        .bind(JSON.stringify(c), c.inviteHash, row.id, row.revision)
        .run();
      if (saved.meta.changes === 1) return result;
    }
    throw new ApiError(409, 'A mesa recebeu muitas alterações simultâneas. Tente novamente.');
  }
  return {
    async create(name: unknown, dmName: unknown, owner?: string) {
      const n = clean(name, 100),
        d = clean(dmName, 60);
      if (!n || !d) throw new ApiError(400, 'Informe o nome da campanha e o nome do DM.');
      const inviteToken = token(),
        sessionToken = token(),
        participantId = id('part'),
        createdAt = new Date().toISOString();
      const c: Campaign = {
        id: id('camp'),
        name: n,
        status: 'lobby',
        createdAt,
        revoked: false,
        participants: [
          {
            id: participantId,
            name: d,
            role: 'dm',
            online: true,
            joinedAt: createdAt,
            openId: owner,
          },
        ],
        events: [],
        sessions: [{ sessionHash: await hash(sessionToken), participantId }],
        inviteHash: await hash(inviteToken),
      };
      record(c, 'system', 'Inferus', `${d} criou a campanha.`);
      await db
        .prepare('INSERT INTO edge_campaigns (id,invite_hash,document) VALUES (?,?,?)')
        .bind(c.id, c.inviteHash, JSON.stringify(c))
        .run();
      return {
        state: publicState(c),
        inviteToken,
        sessionToken,
        participantId,
        role: 'dm' as CampaignRole,
      };
    },
    async join(invite: string, name: unknown, owner?: string) {
      const inviteHash = await hash(invite),
        sessionToken = token(),
        sessionHash = await hash(sessionToken);
      return run(invite, true, (c) => {
        if (c.revoked || c.inviteHash !== inviteHash)
          throw new ApiError(403, 'Este convite não existe ou foi revogado.');
        if (c.status === 'closed') throw new ApiError(400, 'A campanha está encerrada.');
        let p = owner ? c.participants.find((p) => p.openId === owner) : undefined;
        if (!p) {
          const n = clean(name, 60);
          if (!n) throw new ApiError(400, 'Informe um nome de mesa.');
          if (c.participants.some((p) => p.name.toLocaleLowerCase() === n.toLocaleLowerCase()))
            throw new ApiError(
              409,
              'Nome já utilizado. Use outro nome ou retome pela sua conta/sessão.',
            );
          if (c.participants.length >= 10)
            throw new ApiError(409, 'A campanha já está cheia: o limite é 1 DM + 9 jogadores.');
          p = {
            id: id('part'),
            name: n,
            role: 'player',
            online: true,
            joinedAt: new Date().toISOString(),
            openId: owner,
          };
          c.participants.push(p);
          record(c, 'system', 'Inferus', `${n} entrou na campanha.`);
        }
        c.sessions = c.sessions.filter((s) => s.participantId !== p.id);
        c.sessions.push({ sessionHash, participantId: p.id });
        return { state: publicState(c), role: p.role, sessionToken, participantId: p.id };
      });
    },
    async get(locator: string, session: string, owner?: string) {
      const sessionHash = await hash(session);
      return run(locator, false, (c) => {
        const p = auth(c, sessionHash, owner);
        return {
          state: publicState(c),
          role: p.role,
          participantId: p.id,
          accountLinked: Boolean(p.openId),
        };
      });
    },
    async character(locator: string, session: string, participantId?: string, owner?: string) {
      const sessionHash = await hash(session);
      return run(locator, false, (c) =>
        readCharacter(c.participants, auth(c, sessionHash, owner), participantId),
      );
    },
    async saveCharacter(
      locator: string,
      session: string,
      sheet: Sheet | null,
      revision: unknown,
      owner?: string,
    ) {
      const sessionHash = await hash(session);
      return run(locator, true, (c) => {
        const viewer = auth(c, sessionHash, owner);
        writeCharacter(viewer, sheet, revision);
        return readCharacter(c.participants, viewer);
      });
    },
    async event(locator: string, session: string, body: unknown, owner?: string) {
      const sessionHash = await hash(session);
      return run(locator, true, (c) => {
        const p = auth(c, sessionHash, owner),
          text = clean(body, 500);
        if (!text) throw new ApiError(400, 'A mensagem não pode estar vazia.');
        record(c, 'message', p.name, text);
        return publicState(c);
      });
    },
    async status(locator: string, session: string, status: CampaignStatus, owner?: string) {
      const sessionHash = await hash(session);
      return run(locator, true, (c) => {
        auth(c, sessionHash, owner, true);
        if (!['lobby', 'active', 'paused', 'closed'].includes(status))
          throw new ApiError(400, 'Estado de campanha inválido.');
        c.status = status;
        record(c, 'status', 'DM', `Sessão: ${campaignStatusLabels[status]}.`);
        return publicState(c);
      });
    },
    async revoke(locator: string, session: string, owner?: string) {
      const sessionHash = await hash(session);
      return run(locator, true, (c) => {
        auth(c, sessionHash, owner, true);
        c.revoked = true;
        return publicState(c);
      });
    },
    async rotate(locator: string, session: string, owner?: string) {
      const sessionHash = await hash(session),
        inviteToken = token(),
        inviteHash = await hash(inviteToken);
      return run(locator, true, (c) => {
        auth(c, sessionHash, owner, true);
        c.inviteHash = inviteHash;
        c.revoked = false;
        return { state: publicState(c), inviteToken };
      });
    },
    async claim(locator: string, session: string, owner: string) {
      const sessionHash = await hash(session);
      return run(locator, true, (c) => {
        if (c.participants.some((p) => p.openId === owner))
          throw new ApiError(409, 'Esta conta já participa da campanha.');
        auth(c, sessionHash).openId = owner;
        return publicState(c);
      });
    },
    async remove(locator: string, session: string, participantId: string, owner?: string) {
      const sessionHash = await hash(session);
      return run(locator, true, (c) => {
        auth(c, sessionHash, owner, true);
        const p = c.participants.find((p) => p.id === participantId);
        if (!p || p.role === 'dm') throw new ApiError(400, 'Selecione um jogador para remover.');
        c.participants = c.participants.filter((p) => p.id !== participantId);
        c.sessions = c.sessions.filter((s) => s.participantId !== participantId);
        record(c, 'system', 'Inferus', `${p.name} saiu da campanha.`);
        return publicState(c);
      });
    },
    async list(owner: string) {
      const rows = await db
        .prepare(
          "SELECT DISTINCT c.document FROM edge_campaigns c, json_each(c.document,'$.participants') p WHERE json_extract(p.value,'$.openId')=?",
        )
        .bind(owner)
        .all<{ document: string }>();
      return rows.results.map((r) => publicState(JSON.parse(r.document)));
    },
  };
}
