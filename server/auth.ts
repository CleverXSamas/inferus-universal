import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import mysql from 'mysql2/promise';
import type { Pool, RowDataPacket } from 'mysql2/promise';

export type User = { id: string; openId: string; name: string; email: string | null };
type JwtPayload = { openId?: string; name?: string; email?: string; appId?: string; exp?: number };
type SessionRow = RowDataPacket & {
  id: string;
  open_id: string;
  name: string;
  email: string | null;
  expires_at: Date;
};
const COOKIE = 'webdev_app_session';
const STATE_COOKIE = 'inferus_oauth_state';
const memoryUsers = new Map<string, User>();
const memorySessions = new Map<string, { user: User; expires: number }>();
const pool: Pool | undefined = process.env.DATABASE_URL
  ? mysql.createPool(process.env.DATABASE_URL)
  : undefined;
let schemaReady: Promise<void> | undefined;
function ready() {
  if (!pool) return Promise.resolve();
  if (!schemaReady)
    schemaReady = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS inferus_users (id VARCHAR(40) PRIMARY KEY,open_id VARCHAR(255) UNIQUE NOT NULL,name VARCHAR(120) NOT NULL,email VARCHAR(255) NULL,created_at DATETIME(3) NOT NULL,updated_at DATETIME(3) NOT NULL,INDEX(open_id))`,
      );
      await pool.query(
        `CREATE TABLE IF NOT EXISTS inferus_auth_sessions (token_hash CHAR(64) PRIMARY KEY,user_id VARCHAR(40) NOT NULL,expires_at DATETIME(3) NOT NULL,created_at DATETIME(3) NOT NULL,INDEX(user_id),INDEX(expires_at))`,
      );
    })();
  return schemaReady;
}
function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
function b64(value: string) {
  return Buffer.from(value).toString('base64url');
}
function unb64(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}
function token() {
  return randomBytes(32).toString('base64url');
}
function cookies(req: IncomingMessage) {
  return Object.fromEntries(
    (req.headers.cookie ?? '')
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const i = x.indexOf('=');
        return [i < 0 ? x : x.slice(0, i), i < 0 ? '' : decodeURIComponent(x.slice(i + 1))];
      }),
  );
}
function publicHttps(req: IncomingMessage) {
  return (
    String(req.headers['x-forwarded-proto'] ?? '')
      .split(',')[0]
      .trim() === 'https'
  );
}
function cookie(name: string, value: string, maxAge: number, req: IncomingMessage) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; ${publicHttps(req) ? 'SameSite=None; Secure' : 'SameSite=Lax'}`;
}
function clearCookie(name: string, req: IncomingMessage) {
  return cookie(name, '', 0, req);
}
function origin(req: IncomingMessage) {
  const proto = String(req.headers['x-forwarded-proto'] ?? 'https')
    .split(',')[0]
    .trim();
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost')
    .split(',')[0]
    .trim();
  return `${proto === 'http' ? 'http' : 'https'}://${host}`;
}
function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Autenticação indisponível: ${name} não está configurado.`);
  return value;
}
function writeRedirect(res: ServerResponse, url: string, cookiesToSet: string[] = []) {
  res.writeHead(302, { location: url, 'set-cookie': cookiesToSet });
  res.end();
}
function fixedRedirect(req: IncomingMessage) {
  return `${process.env.PUBLIC_ORIGIN || origin(req)}/api/auth/callback`;
}
function verifyJwt(value: string): JwtPayload | null {
  const secret = process.env.MANUS_JWT_SECRET;
  if (!secret || value.split('.').length !== 3) return null;
  try {
    const [head, payload, signature] = value.split('.');
    const expected = createHmac('sha256', secret).update(`${head}.${payload}`).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(unb64(payload)) as JwtPayload;
    if (JSON.parse(unb64(head)).alg !== 'HS256') return null;
    if (
      typeof data.exp !== 'number' ||
      !Number.isFinite(data.exp) ||
      data.exp <= Math.floor(Date.now() / 1000)
    )
      return null;
    if (!process.env.MANUS_PROJECT_ID || data.appId !== process.env.MANUS_PROJECT_ID) return null;
    if (typeof data.openId !== 'string' || !data.openId) return null;
    return data;
  } catch {
    return null;
  }
}
async function upsert(info: { openId: string; name?: string; email?: string | null }) {
  const user: User = {
    id: `usr_${randomBytes(10).toString('hex')}`,
    openId: info.openId,
    name: (info.name || info.email || 'Usuário').slice(0, 120),
    email: info.email ?? null,
  };
  if (!pool) {
    const old = memoryUsers.get(user.openId);
    if (old) {
      old.name = user.name;
      old.email = user.email;
      return old;
    }
    memoryUsers.set(user.openId, user);
    return user;
  }
  await ready();
  await pool.query(
    `INSERT INTO inferus_users (id,open_id,name,email,created_at,updated_at) VALUES (?,?,?,?,NOW(3),NOW(3)) ON DUPLICATE KEY UPDATE name=VALUES(name),email=VALUES(email),updated_at=NOW(3)`,
    [user.id, user.openId, user.name, user.email],
  );
  const [rows] = await pool.query<
    (RowDataPacket & { id: string; open_id: string; name: string; email: string | null })[]
  >('SELECT id,open_id,name,email FROM inferus_users WHERE open_id=?', [user.openId]);
  const row = rows[0];
  return { id: row.id, openId: row.open_id, name: row.name, email: row.email };
}
async function createSession(user: User) {
  const value = token(),
    expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
  if (!pool) {
    memorySessions.set(hash(value), { user, expires });
    return value;
  }
  await ready();
  await pool.query(
    'INSERT INTO inferus_auth_sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,NOW(3))',
    [hash(value), user.id, new Date(expires)],
  );
  return value;
}
async function fromSession(value: string) {
  if (!pool) {
    const item = memorySessions.get(hash(value));
    if (!item || item.expires < Date.now()) return null;
    return item.user;
  }
  await ready();
  const [rows] = await pool.query<SessionRow[]>(
    `SELECT u.id,s.expires_at,u.open_id,u.name,u.email FROM inferus_auth_sessions s JOIN inferus_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW(3)`,
    [hash(value)],
  );
  const row = rows[0];
  return row ? { id: row.id, openId: row.open_id, name: row.name, email: row.email } : null;
}
export async function currentUser(req: IncomingMessage) {
  const value = cookies(req)[COOKIE];
  if (!value) return null;
  const jwt = verifyJwt(value);
  if (jwt?.openId) return upsert({ openId: jwt.openId, name: jwt.name, email: jwt.email });
  return fromSession(value);
}
export async function requireUser(req: IncomingMessage) {
  const user = await currentUser(req);
  if (!user) throw new Error('Faça login para continuar.');
  return user;
}
async function exchange(code: string, redirectUri: string) {
  const api = env('MANUS_OAUTH_API_URL'),
    response = await fetch(`${api}/webdev.v1.WebDevAuthPublicService/ExchangeToken`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: env('MANUS_PROJECT_ID'),
        grantType: 'authorization_code',
        code,
        redirectUri,
      }),
    });
  if (!response.ok) throw new Error('Não foi possível concluir o login.');
  return (await response.json()) as { accessToken?: string };
}
async function info(
  accessToken: string,
): Promise<{ openId: string; name?: string; email?: string }> {
  const response = await fetch(
    `${env('MANUS_OAUTH_API_URL')}/webdev.v1.WebDevAuthPublicService/GetUserInfo`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    },
  );
  if (!response.ok) throw new Error('Não foi possível carregar sua conta.');
  const data = (await response.json()) as { openId?: string; name?: string; email?: string };
  if (!data.openId) throw new Error('A identidade retornada pelo login é inválida.');
  return { openId: data.openId, name: data.name, email: data.email };
}
export async function begin(req: IncomingMessage, res: ServerResponse) {
  const redirectUri = fixedRedirect(req),
    nonce = token(),
    state = b64(JSON.stringify({ redirectUri, nonce })),
    portal = new URL(`${env('MANUS_OAUTH_PORTAL_URL').replace(/\/$/, '')}/app-auth`);
  portal.searchParams.set('appId', env('MANUS_PROJECT_ID'));
  portal.searchParams.set('redirectUri', redirectUri);
  portal.searchParams.set('state', state);
  portal.searchParams.set('nonce', nonce);
  writeRedirect(res, portal.toString(), [cookie(STATE_COOKIE, nonce, 600, req)]);
}
export async function callback(
  req: IncomingMessage,
  res: ServerResponse,
  code: string,
  stateValue: string,
) {
  const saved = cookies(req)[STATE_COOKIE];
  let state: { redirectUri?: string; nonce?: string };
  try {
    state = JSON.parse(unb64(stateValue));
  } catch {
    throw new Error('Estado de login inválido.');
  }
  if (!saved || !state.nonce || saved !== state.nonce || state.redirectUri !== fixedRedirect(req))
    throw new Error('A validação de segurança do login falhou.');
  const exchanged = await exchange(code, state.redirectUri);
  if (!exchanged.accessToken) throw new Error('O provedor não retornou uma sessão.');
  const user = await upsert(await info(exchanged.accessToken));
  const session = await createSession(user);
  writeRedirect(res, '/', [
    cookie(COOKIE, session, 30 * 24 * 60 * 60, req),
    clearCookie(STATE_COOKIE, req),
  ]);
}
export async function logout(req: IncomingMessage, res: ServerResponse) {
  const value = cookies(req)[COOKIE];
  if (value && pool) {
    await ready();
    await pool.query('DELETE FROM inferus_auth_sessions WHERE token_hash=?', [hash(value)]);
  }
  if (value) memorySessions.delete(hash(value));
  res.writeHead(204, { 'set-cookie': clearCookie(COOKIE, req) });
  res.end();
}
export function storageKind() {
  return pool ? 'mysql' : 'memory';
}
export function publicUser(user: User | null) {
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

export async function closeAuthStore() {
  await pool?.end();
}
