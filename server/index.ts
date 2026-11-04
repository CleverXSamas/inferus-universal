import { TabletopError } from '../packages/tabletop/index.js';
import { CharacterError } from '../packages/campaign-characters/index.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { roll, PRESETS, type RollRecord } from '../packages/dice-core/index.js';
import {
  defaultPool,
  generateTree,
  buyNode,
  type GeneratedTree,
} from '../packages/tree-core/index.js';
import { createCampaignStore, type CampaignStatus } from './campaigns.js';
import { createSheetStore } from './sheets.js';
import { assertRuntimeConfiguration } from './config.js';
import {
  begin,
  callback,
  currentUser,
  requireUser,
  logout,
  publicUser,
  storageKind,
  databaseHealth,
} from './auth.js';
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256 * 1024) throw new HttpError(413, 'Corpo da requisição excede 256 KB.');
    chunks.push(Buffer.from(chunk));
  }
  const value: unknown = size ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'Envie um objeto JSON.');
  return value as Record<string, any>;
}
function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}
export function createApplication(options: { databaseUrl?: string } = {}) {
  const history = new Map<string, RollRecord[]>(),
    trees = new Map<string, GeneratedTree>();
  const campaigns = createCampaignStore(options.databaseUrl),
    sheets = createSheetStore(options.databaseUrl),
    root = resolve(process.cwd(), 'dist');
  async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      // Cookie-authenticated writes must come from the same application, including embedded HTTPS usage.
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method ?? '') && req.headers.origin) {
        const expected =
          process.env.PUBLIC_ORIGIN ||
          `${String(req.headers['x-forwarded-proto'] ?? 'http')
            .split(',')[0]
            .trim()}://${String(req.headers['x-forwarded-host'] ?? req.headers.host)
            .split(',')[0]
            .trim()}`;
        if (req.headers.origin !== expected)
          throw new HttpError(403, 'Origem da requisição inválida.');
      }
      if (url.pathname === '/api/health' && req.method === 'GET') {
        try {
          await databaseHealth();
        } catch {
          throw new HttpError(503, 'Banco de dados indisponível.');
        }
        return json(res, 200, {
          ok: true,
          campaignStorage: campaigns.kind,
          authStorage: storageKind(),
        });
      }
      if (url.pathname === '/api/presets' && req.method === 'GET') return json(res, 200, PRESETS);
      if (url.pathname === '/api/auth/login' && req.method === 'GET') return await begin(req, res);
      if (url.pathname === '/api/auth/callback' && req.method === 'GET') {
        const code = url.searchParams.get('code'),
          state = url.searchParams.get('state');
        if (!code || !state) throw new HttpError(400, 'Resposta de login incompleta.');
        return await callback(req, res, code, state);
      }
      if (url.pathname === '/api/auth/me' && req.method === 'GET')
        return json(res, 200, { user: publicUser(await currentUser(req)) });
      if (url.pathname === '/api/auth/logout' && req.method === 'POST')
        return await logout(req, res);
      if (url.pathname === '/api/sheets' && ['GET', 'POST', 'DELETE'].includes(req.method ?? '')) {
        const user = await requireUser(req);
        if (req.method === 'GET') return json(res, 200, await sheets.list(user.openId));
        const b = await body(req);
        if (req.method === 'DELETE') {
          await sheets.delete(user.openId, String(b.id));
          return json(res, 200, { ok: true });
        }
        return json(res, 200, await sheets.save(user.openId, b.sheet));
      }
      if (url.pathname === '/api/roll' && req.method === 'POST') {
        const b = await body(req),
          r = roll(String(b.expression), {
            user: String(b.user ?? 'demo'),
            channel: String(b.channel ?? 'web'),
            target: b.target === undefined ? undefined : Number(b.target),
          });
        const key = r.user ?? 'demo';
        history.set(key, [r, ...(history.get(key) ?? [])].slice(0, 50));
        if (history.size > 1000) history.delete(history.keys().next().value!);
        return json(res, 200, r);
      }
      if (url.pathname === '/api/history' && req.method === 'GET')
        return json(res, 200, history.get(url.searchParams.get('user') ?? 'demo') ?? []);
      if (
        (url.pathname === '/api/tree' && req.method === 'GET') ||
        (url.pathname === '/api/tree/buy' && req.method === 'POST')
      ) {
        const b = req.method === 'GET' ? Object.fromEntries(url.searchParams) : await body(req);
        const character = String(b.character ?? 'demo'),
          level = Number(b.level ?? 1);
        if (!Number.isInteger(level) || level < 1 || level > 100 || character.length > 120)
          throw new HttpError(400, 'Personagem ou nível inválido.');
        const key = JSON.stringify([character, level]);
        let tree = trees.get(key) ?? generateTree(defaultPool(), character, level);
        if (req.method === 'POST')
          tree = buyNode(tree, String(b.nodeId), String(b.idempotencyKey ?? ''));
        trees.set(key, tree);
        if (trees.size > 1000) trees.delete(trees.keys().next().value!);
        return json(res, 200, tree);
      }
      if (url.pathname === '/api/campaigns' && req.method === 'GET')
        return json(res, 200, await campaigns.list((await requireUser(req)).openId));
      if (url.pathname === '/api/campaigns' && req.method === 'POST') {
        const b = await body(req),
          user = await currentUser(req),
          created = await campaigns.create(b.name, b.dmName, user?.openId);
        return json(res, 201, { ...created, inviteUrl: `/campaign/${created.inviteToken}` });
      }
      if (url.pathname.startsWith('/api/campaigns/') && req.method === 'POST') {
        const b = await body(req),
          openId = (await currentUser(req))?.openId;
        const locator = String(b.campaignId || b.inviteToken || ''),
          session = String(b.sessionToken ?? '');
        switch (url.pathname) {
          case '/api/campaigns/join':
            return json(
              res,
              200,
              await campaigns.join(String(b.inviteToken ?? ''), b.name, openId),
            );
          case '/api/campaigns/tabletop':
            return json(res, 200, await campaigns.tabletop(locator, session, openId, b.action));
          case '/api/campaigns/state':
            return json(res, 200, await campaigns.get(locator, session, openId));
          case '/api/campaigns/character':
            return json(
              res,
              200,
              await campaigns.character(locator, session, b.participantId, openId),
            );
          case '/api/campaigns/character/save':
            return json(
              res,
              200,
              await campaigns.saveCharacter(locator, session, b.sheet, b.revision, openId),
            );
          case '/api/campaigns/event':
            return json(res, 200, await campaigns.event(locator, session, b.body, openId));
          case '/api/campaigns/status':
            return json(
              res,
              200,
              await campaigns.status(locator, session, String(b.status) as CampaignStatus, openId),
            );
          case '/api/campaigns/revoke':
            return json(res, 200, await campaigns.revoke(locator, session, openId));
          case '/api/campaigns/claim':
            return json(
              res,
              200,
              await campaigns.claim(locator, session, (await requireUser(req)).openId),
            );
          case '/api/campaigns/rotate':
            return json(res, 200, await campaigns.rotate(locator, session, openId));
          case '/api/campaigns/remove':
            return json(
              res,
              200,
              await campaigns.remove(locator, session, String(b.participantId), openId),
            );
        }
      }
      if (url.pathname.startsWith('/api/'))
        throw new HttpError(404, 'Rota de API inexistente ou método não permitido.');
      if (!['GET', 'HEAD'].includes(req.method ?? ''))
        throw new HttpError(405, 'Método não permitido.');
      const pathname = decodeURIComponent(url.pathname),
        filePath = resolve(root, `.${pathname}`);
      if (!filePath.startsWith(root + sep) && filePath !== root)
        throw new HttpError(403, 'Caminho inválido.');
      let data: Buffer,
        extension = extname(filePath);
      try {
        data = await readFile(filePath);
      } catch {
        if (extension) throw new HttpError(404, 'Arquivo inexistente.');
        data = await readFile(resolve(root, 'index.html'));
        extension = '.html';
      }
      const types: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.gif': 'image/gif',
      };
      res.writeHead(200, {
        'content-type': types[extension] ?? 'application/octet-stream',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (e) {
      const status =
        e instanceof HttpError || e instanceof CharacterError || e instanceof TabletopError
          ? e.status
          : e instanceof Error && e.message === 'Faça login para continuar.'
            ? 401
            : 400;
      return json(res, status, { error: e instanceof Error ? e.message : 'Erro interno.' });
    }
  }
  return {
    server: createServer(handler),
    async close() {
      await Promise.all([campaigns.close(), sheets.close()]);
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.env.NODE_ENV === 'production') assertRuntimeConfiguration('web');
  const app = createApplication(),
    port = Number(process.env.PORT ?? 3000);
  app.server.listen(port, process.env.HOST || '0.0.0.0', () =>
    console.log(`Inferus ouvindo em ${port}`),
  );
}
