import { visibleTabletop, updateTabletop, type Tabletop } from '../packages/tabletop/index.js';
import {
  readCharacter,
  writeCharacter,
  characterSummary,
  type CharacterParticipant,
} from '../packages/campaign-characters/index.js';
import type { Sheet } from '../packages/sheet-engine/index.js';
import { campaignStatusLabels } from '../packages/campaign-types/index.js';
import { createHash, randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

import type {
  CampaignRole,
  CampaignStatus,
  CampaignState,
  CampaignEvent,
  CampaignParticipant,
} from '../packages/campaign-types/index.js';
export type {
  CampaignRole,
  CampaignStatus,
  CampaignState,
  CampaignEvent,
  CampaignParticipant,
} from '../packages/campaign-types/index.js';
type Participant = CharacterParticipant & { openId?: string };
type Session = { sessionHash: string; participantId: string; role: CampaignRole };
type Internal = Omit<CampaignState, 'participants'> & {
  tabletop?: Tabletop;
  inviteHash: string;
  participants: Participant[];
  sessions: Session[];
};
type Db = Pool | PoolConnection;
const now = () => new Date().toISOString();
const token = () => randomBytes(24).toString('base64url');
const id = (prefix: string) => `${prefix}_${randomBytes(12).toString('hex')}`;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function clean(value: unknown, max: number) {
  return typeof value === 'string'
    ? value
        .trim()
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .slice(0, max)
    : '';
}
function publicState(c: Internal): CampaignState {
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    participants: c.participants.map(({ openId, character, ...p }) => ({
      ...p,
      character: characterSummary(character),
    })),
    events: c.events.slice(-80).map((e) => ({ ...e })),
    createdAt: c.createdAt,
    revoked: c.revoked,
  };
}
function record(c: Internal, kind: CampaignEvent['kind'], author: string, body: string) {
  c.events.push({ id: id('evt'), kind, author, body, createdAt: now() });
  c.events = c.events.slice(-80);
}
function auth(c: Internal, session: string, openId?: string, dm = false) {
  const s = c.sessions.find((s) => s.sessionHash === hash(session));
  const p =
    (openId ? c.participants.find((p) => p.openId === openId) : undefined) ??
    c.participants.find((p) => p.id === s?.participantId && !p.openId);
  if (!p || (dm && p.role !== 'dm'))
    throw new Error(
      dm
        ? 'Apenas o DM pode gerenciar a campanha.'
        : 'Sessão de campanha inválida. Entre novamente pelo convite ou pela conta.',
    );
  return p;
}
export interface CampaignStore {
  tabletop(locator: string, session: string, openId?: string, action?: unknown): Promise<Tabletop>;
  kind: 'memory' | 'mysql';
  create(
    name: string,
    dmName: string,
    openId?: string,
  ): Promise<{ state: CampaignState; inviteToken: string; sessionToken: string }>;
  join(
    invite: string,
    name: string,
    openId?: string,
  ): Promise<{ state: CampaignState; sessionToken: string; role: CampaignRole }>;
  get(
    locator: string,
    session: string,
    openId?: string,
  ): Promise<{
    state: CampaignState;
    role: CampaignRole;
    participantId: string;
    accountLinked: boolean;
  }>;
  character(
    locator: string,
    session: string,
    participantId?: string,
    openId?: string,
  ): Promise<ReturnType<typeof readCharacter>>;
  saveCharacter(
    locator: string,
    session: string,
    sheet: Sheet | null,
    revision: unknown,
    openId?: string,
  ): Promise<ReturnType<typeof readCharacter>>;
  event(locator: string, session: string, body: string, openId?: string): Promise<CampaignState>;
  status(
    locator: string,
    session: string,
    status: CampaignStatus,
    openId?: string,
  ): Promise<CampaignState>;
  revoke(locator: string, session: string, openId?: string): Promise<CampaignState>;
  claim(locator: string, session: string, openId: string): Promise<CampaignState>;
  rotate(
    locator: string,
    session: string,
    openId?: string,
  ): Promise<{ state: CampaignState; inviteToken: string }>;
  remove(
    locator: string,
    session: string,
    participantId: string,
    openId?: string,
  ): Promise<CampaignState>;
  list(openId: string): Promise<CampaignState[]>;
  close(): Promise<void>;
}

class Store implements CampaignStore {
  readonly kind: 'memory' | 'mysql';
  private memory = new Map<string, Internal>();
  private pool?: Pool;
  private schema?: Promise<void>;
  constructor(url?: string) {
    this.kind = url ? 'mysql' : 'memory';
    if (url) this.pool = mysql.createPool(url);
  }
  private ready() {
    return (this.schema ??= this.init());
  }
  private async init() {
    if (!this.pool) return;
    await this.pool.query(
      'CREATE TABLE IF NOT EXISTS inferus_campaign_tabletops (campaign_id VARCHAR(40) PRIMARY KEY,document JSON NOT NULL)',
    );
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS inferus_campaigns (id VARCHAR(40) PRIMARY KEY,name VARCHAR(100) NOT NULL,invite_hash CHAR(64) UNIQUE NOT NULL,status VARCHAR(12) NOT NULL,revoked BOOLEAN NOT NULL DEFAULT FALSE,created_at DATETIME(3) NOT NULL)`,
    );
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS inferus_campaign_participants (id VARCHAR(40) PRIMARY KEY,campaign_id VARCHAR(40) NOT NULL,name VARCHAR(60) NOT NULL,role VARCHAR(8) NOT NULL,online BOOLEAN NOT NULL DEFAULT TRUE,joined_at DATETIME(3) NOT NULL,UNIQUE(campaign_id,name),INDEX(campaign_id))`,
    );
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS inferus_campaign_sessions (session_hash CHAR(64) PRIMARY KEY,campaign_id VARCHAR(40) NOT NULL,participant_id VARCHAR(40) NOT NULL,role VARCHAR(8) NOT NULL,INDEX(campaign_id))`,
    );
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS inferus_campaign_events (id VARCHAR(40) PRIMARY KEY,campaign_id VARCHAR(40) NOT NULL,kind VARCHAR(10) NOT NULL,author VARCHAR(60) NOT NULL,body VARCHAR(500) NOT NULL,created_at DATETIME(3) NOT NULL,INDEX(campaign_id,created_at))`,
    );
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS inferus_campaign_characters (participant_id VARCHAR(40) PRIMARY KEY,campaign_id VARCHAR(40) NOT NULL,document JSON NOT NULL,INDEX(campaign_id))`,
    );
    // Separate table is an additive migration for installations with existing guest campaigns.
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS inferus_campaign_accounts (participant_id VARCHAR(40) PRIMARY KEY,campaign_id VARCHAR(40) NOT NULL,open_id VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,UNIQUE(campaign_id,open_id),INDEX(open_id))`,
    );
  }
  private async load(db: Db, locator: string, lock = false): Promise<Internal> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM inferus_campaigns WHERE invite_hash=? OR id=?${lock ? ' FOR UPDATE' : ''}`,
      [hash(locator), locator],
    );
    const r = rows[0];
    if (!r) throw new Error('Campanha ou convite inexistente.');
    const [ps] = await db.query<RowDataPacket[]>(
      'SELECT p.*,a.open_id,ch.document AS character_document FROM inferus_campaign_participants p LEFT JOIN inferus_campaign_accounts a ON a.participant_id=p.id LEFT JOIN inferus_campaign_characters ch ON ch.participant_id=p.id WHERE p.campaign_id=? ORDER BY p.joined_at,p.id',
      [r.id],
    );
    const [ss] = await db.query<RowDataPacket[]>(
      'SELECT * FROM inferus_campaign_sessions WHERE campaign_id=?',
      [r.id],
    );
    const [es] = await db.query<RowDataPacket[]>(
      'SELECT * FROM inferus_campaign_events WHERE campaign_id=? ORDER BY created_at DESC,id DESC LIMIT 80',
      [r.id],
    );
    const [boards] = await db.query<RowDataPacket[]>(
      'SELECT document FROM inferus_campaign_tabletops WHERE campaign_id=?',
      [r.id],
    );
    const board = boards[0]?.document;
    return {
      tabletop: typeof board === 'string' ? JSON.parse(board) : board,
      id: r.id,
      name: r.name,
      inviteHash: r.invite_hash,
      status: r.status,
      revoked: Boolean(r.revoked),
      createdAt: new Date(r.created_at).toISOString(),
      participants: ps.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        online: Boolean(p.online),
        joinedAt: new Date(p.joined_at).toISOString(),
        openId: p.open_id ?? undefined,
        character: p.character_document
          ? typeof p.character_document === 'string'
            ? JSON.parse(p.character_document)
            : p.character_document
          : undefined,
      })),
      sessions: ss.map((s) => ({
        sessionHash: s.session_hash,
        participantId: s.participant_id,
        role: s.role,
      })),
      events: es.reverse().map((e) => ({
        id: e.id,
        kind: e.kind,
        author: e.author,
        body: e.body,
        createdAt: new Date(e.created_at).toISOString(),
      })),
    };
  }
  private async save(db: Db, c: Internal, previousCharacters?: string) {
    if (c.tabletop)
      await db.query(
        'INSERT INTO inferus_campaign_tabletops (campaign_id,document) VALUES (?,?) ON DUPLICATE KEY UPDATE document=VALUES(document)',
        [c.id, JSON.stringify(c.tabletop)],
      );
    await db.query('UPDATE inferus_campaigns SET status=?,revoked=?,invite_hash=? WHERE id=?', [
      c.status,
      c.revoked,
      c.inviteHash,
      c.id,
    ]);
    // All writes run under the campaign row lock, including capacity and permission checks.
    for (const table of [
      'inferus_campaign_accounts',
      'inferus_campaign_sessions',
      'inferus_campaign_participants',
    ])
      await db.query(`DELETE FROM ${table} WHERE campaign_id=?`, [c.id]);
    for (const p of c.participants) {
      await db.query(
        'INSERT INTO inferus_campaign_participants (id,campaign_id,name,role,online,joined_at) VALUES (?,?,?,?,?,?)',
        [p.id, c.id, p.name, p.role, p.online, new Date(p.joinedAt)],
      );
      if (p.openId)
        await db.query(
          'INSERT INTO inferus_campaign_accounts (participant_id,campaign_id,open_id) VALUES (?,?,?)',
          [p.id, c.id, p.openId],
        );
    }
    const characters = c.participants.filter((p) => p.character).map((p) => [p.id, p.character]);
    if (JSON.stringify(characters) !== previousCharacters) {
      await db.query('DELETE FROM inferus_campaign_characters WHERE campaign_id=?', [c.id]);
      for (const p of c.participants)
        if (p.character)
          await db.query(
            'INSERT INTO inferus_campaign_characters (participant_id,campaign_id,document) VALUES (?,?,?)',
            [p.id, c.id, JSON.stringify(p.character)],
          );
    }
    for (const s of c.sessions)
      await db.query(
        'INSERT INTO inferus_campaign_sessions (session_hash,campaign_id,participant_id,role) VALUES (?,?,?,?)',
        [s.sessionHash, c.id, s.participantId, s.role],
      );
    for (const e of c.events)
      await db.query(
        'INSERT IGNORE INTO inferus_campaign_events (id,campaign_id,kind,author,body,created_at) VALUES (?,?,?,?,?,?)',
        [e.id, c.id, e.kind, e.author, e.body, new Date(e.createdAt)],
      );
  }
  private async run<T>(locator: string, write: boolean, fn: (c: Internal) => T): Promise<T> {
    if (!this.pool) {
      const original = [...this.memory.values()].find(
        (c) => c.id === locator || c.inviteHash === hash(locator),
      );
      if (!original) throw new Error('Campanha ou convite inexistente.');
      const c = structuredClone(original),
        result = fn(c);
      if (write) this.memory.set(c.id, c);
      return result;
    }
    await this.ready();
    const db = await this.pool.getConnection();
    try {
      await db.beginTransaction();
      const c = await this.load(db, locator, true);
      const before = JSON.stringify(
        c.participants.filter((p) => p.character).map((p) => [p.id, p.character]),
      );
      const result = fn(c);
      if (write) await this.save(db, c, before);
      await db.commit();
      return result;
    } catch (e) {
      await db.rollback();
      throw e;
    } finally {
      db.release();
    }
  }
  async tabletop(locator: string, session: string, openId?: string, action?: unknown) {
    return this.run(locator, action !== undefined, (c) => {
      const actor = auth(c, session, openId);
      if (action !== undefined)
        c.tabletop = updateTabletop(c.tabletop, actor, c.participants, c.status, action);
      return visibleTabletop(c.tabletop, actor, c.participants);
    });
  }
  async create(name: string, dmName: string, openId?: string) {
    const n = clean(name, 100),
      d = clean(dmName, 60);
    if (!n || !d) throw new Error('Informe o nome da campanha e o nome do DM.');
    const invite = token(),
      session = token(),
      p: Participant = {
        id: id('part'),
        name: d,
        role: 'dm',
        online: true,
        joinedAt: now(),
        openId,
      };
    const c: Internal = {
      id: id('camp'),
      name: n,
      inviteHash: hash(invite),
      status: 'lobby',
      revoked: false,
      createdAt: now(),
      participants: [p],
      sessions: [
        {
          sessionHash: hash(session),
          participantId: p.id,
          role: 'dm',
        },
      ],
      events: [],
    };
    record(c, 'system', 'Inferus', `${d} criou a campanha.`);
    if (this.pool) {
      await this.ready();
      const db = await this.pool.getConnection();
      try {
        await db.beginTransaction();
        await db.query(
          'INSERT INTO inferus_campaigns (id,name,invite_hash,status,revoked,created_at) VALUES (?,?,?,?,?,?)',
          [c.id, c.name, c.inviteHash, c.status, false, new Date(c.createdAt)],
        );
        await this.save(db, c);
        await db.commit();
      } catch (e) {
        await db.rollback();
        throw e;
      } finally {
        db.release();
      }
    } else this.memory.set(c.id, c);
    return {
      state: publicState(c),
      inviteToken: invite,
      sessionToken: session,
      participantId: p.id,
    };
  }
  async join(invite: string, name: string, openId?: string) {
    return this.run(invite, true, (c) => {
      if (c.revoked || c.inviteHash !== hash(invite))
        throw new Error('Este convite não existe ou foi revogado.');
      if (c.status === 'closed') throw new Error('A campanha está encerrada.');
      let p = openId ? c.participants.find((p) => p.openId === openId) : undefined;
      if (!p) {
        const n = clean(name, 60);
        if (!n) throw new Error('Informe um nome de mesa.');
        if (c.participants.some((p) => p.name.toLocaleLowerCase() === n.toLocaleLowerCase()))
          throw new Error('Nome já utilizado. Use outro nome ou retome pela sua conta/sessão.');
        if (c.participants.length >= 10)
          throw new Error('A campanha já está cheia: o limite é 1 DM + 9 jogadores.');
        p = { id: id('part'), name: n, role: 'player', online: true, joinedAt: now(), openId };
        c.participants.push(p);
        record(c, 'system', 'Inferus', `${n} entrou na campanha.`);
      }
      const session = token();
      c.sessions = c.sessions.filter((s) => s.participantId !== p.id);
      c.sessions.push({
        sessionHash: hash(session),
        participantId: p.id,
        role: p.role,
      });
      return { state: publicState(c), sessionToken: session, participantId: p.id, role: p.role };
    });
  }
  async get(locator: string, session: string, openId?: string) {
    return this.run(locator, false, (c) => {
      const p = auth(c, session, openId);
      return {
        state: publicState(c),
        role: p.role,
        participantId: p.id,
        accountLinked: Boolean(p.openId),
      };
    });
  }
  async character(locator: string, session: string, participantId?: string, openId?: string) {
    return this.run(locator, false, (c) =>
      readCharacter(c.participants, auth(c, session, openId), participantId),
    );
  }
  async saveCharacter(
    locator: string,
    session: string,
    sheet: Sheet | null,
    revision: unknown,
    openId?: string,
  ) {
    return this.run(locator, true, (c) => {
      const viewer = auth(c, session, openId);
      writeCharacter(viewer, sheet, revision);
      return readCharacter(c.participants, viewer);
    });
  }
  async event(locator: string, session: string, body: string, openId?: string) {
    return this.run(locator, true, (c) => {
      const p = auth(c, session, openId),
        text = clean(body, 500);
      if (c.status === 'closed')
        throw new Error('A campanha está encerrada. Peça ao mestre para reabrir a sessão.');
      if (!text) throw new Error('A mensagem não pode estar vazia.');
      record(c, 'message', p.name, text);
      return publicState(c);
    });
  }
  async status(locator: string, session: string, status: CampaignStatus, openId?: string) {
    return this.run(locator, true, (c) => {
      auth(c, session, openId, true);
      if (!['lobby', 'active', 'paused', 'closed'].includes(status))
        throw new Error('Estado de campanha inválido.');
      if (c.status === status) return publicState(c);
      c.status = status;
      record(c, 'status', 'DM', `Sessão: ${campaignStatusLabels[status]}.`);
      return publicState(c);
    });
  }
  async revoke(locator: string, session: string, openId?: string) {
    return this.run(locator, true, (c) => {
      auth(c, session, openId, true);
      c.revoked = true;
      return publicState(c);
    });
  }
  async claim(locator: string, session: string, openId: string) {
    return this.run(locator, true, (c) => {
      if (c.participants.some((p) => p.openId === openId))
        throw new Error('Esta conta já participa da campanha.');
      const p = auth(c, session);
      p.openId = openId;
      return publicState(c);
    });
  }
  async rotate(locator: string, session: string, openId?: string) {
    return this.run(locator, true, (c) => {
      auth(c, session, openId, true);
      const inviteToken = token();
      c.inviteHash = hash(inviteToken);
      c.revoked = false;
      return { state: publicState(c), inviteToken };
    });
  }
  async remove(locator: string, session: string, participantId: string, openId?: string) {
    return this.run(locator, true, (c) => {
      auth(c, session, openId, true);
      const p = c.participants.find((p) => p.id === participantId);
      if (!p || p.role === 'dm') throw new Error('Selecione um jogador para remover.');
      c.participants = c.participants.filter((p) => p.id !== participantId);
      c.sessions = c.sessions.filter((s) => s.participantId !== participantId);
      record(c, 'system', 'Inferus', `${p.name} saiu da campanha.`);
      return publicState(c);
    });
  }
  async list(openId: string) {
    if (!this.pool)
      return [...this.memory.values()]
        .filter((c) => c.participants.some((p) => p.openId === openId))
        .map(publicState);
    await this.ready();
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT campaign_id FROM inferus_campaign_accounts WHERE open_id=?',
      [openId],
    );
    return Promise.all(rows.map((r) => this.get(r.campaign_id, '', openId).then((r) => r.state)));
  }
  async close() {
    await this.pool?.end();
  }
}
export function createCampaignStore(url = process.env.DATABASE_URL): CampaignStore {
  return new Store(url);
}
