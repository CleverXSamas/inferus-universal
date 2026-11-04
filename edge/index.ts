import { roll, PRESETS } from '../packages/dice-core/index.js';
import { validateSheet, evaluateSheet, type Sheet } from '../packages/sheet-engine/index.js';
import {
  defaultPool,
  generateTree,
  buyNode,
  type GeneratedTree,
} from '../packages/tree-core/index.js';
import type { CampaignStatus } from '../packages/campaign-types/index.js';
import { createEdgeCampaignStore } from './campaigns.js';
import { discordInteraction } from './discord.js';
import { discordConfig, setupDiscord } from './discord-setup.js';
import { ApiError, json, type Env } from './types.js';
// Replaced at build time with the Vite output; no standalone assets or Node server required.
import { assets } from './site-assets.js';
function identity(request: Request) {
  // These identity headers are supplied and protected by the Sites dispatch gateway.
  // A standalone Worker needs its own trusted identity gateway before enabling this adapter.
  const userId = request.headers.get('oai-authenticated-user-id');
  if (!userId) return null;
  let name = request.headers.get('oai-authenticated-user-full-name') || '';
  if (
    request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8'
  ) {
    try {
      name = decodeURIComponent(name);
    } catch {
      name = '';
    }
  }
  const email = request.headers.get('oai-authenticated-user-email');
  return { id: `sites:${userId}`, name: name || email || 'Jogador', email };
}
async function body(request: Request): Promise<Record<string, any>> {
  if (Number(request.headers.get('content-length')) > 262144)
    throw new ApiError(413, 'Corpo excede 256 KB.');
  const reader = request.body?.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  if (reader)
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 262144) {
        await reader.cancel();
        throw new ApiError(413, 'Corpo excede 256 KB.');
      }
      chunks.push(value);
    }
  const bytes = new Uint8Array(length);
  let pos = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, pos);
    pos += chunk.length;
  }
  let value: unknown;
  try {
    value = length ? JSON.parse(new TextDecoder().decode(bytes)) : {};
  } catch {
    throw new ApiError(400, 'JSON inválido.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(400, 'Envie um objeto JSON.');
  return value as Record<string, any>;
}
const loginUrl = '/signin-with-chatgpt?return_to=%2F',
  logoutUrl = '/signout-with-chatgpt?return_to=%2F';
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url),
      user = identity(request);
    const requireOwner = () => {
      if (!user) throw new ApiError(401, 'Faça login para continuar.');
      return user.id;
    };
    try {
      if (url.pathname === '/api/discord/interactions' && request.method === 'POST')
        return await discordInteraction(request, env);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        const origin = request.headers.get('origin');
        if (origin && origin !== url.origin)
          throw new ApiError(403, 'Origem da requisição inválida.');
      }
      if (url.pathname === '/api/discord/config' && request.method === 'GET')
        return json(discordConfig(url.origin, env));
      if (url.pathname === '/api/discord/setup' && request.method === 'POST') {
        requireOwner();
        const b = await body(request);
        if (b.action !== 'remove-slash')
          throw new ApiError(
            400,
            'Reabra a página Discord para remover os comandos de barra antigos.',
          );
        return json(await setupDiscord(b.botToken, url.origin, env));
      }
      if (url.pathname === '/api/auth/me' && request.method === 'GET')
        return json({ user, provider: 'chatgpt', loginUrl, logoutUrl });
      if (url.pathname === '/api/auth/login' && request.method === 'GET')
        return Response.redirect(new URL(loginUrl, url.origin).href, 302);
      if (url.pathname === '/api/auth/logout' && request.method === 'POST')
        return json({ redirect: logoutUrl });
      if (url.pathname === '/api/health' && request.method === 'GET') {
        if (!env.DB) return json({ ok: false, error: 'Banco de dados não configurado.' }, 503);
        await env.DB.prepare('SELECT id FROM edge_campaigns LIMIT 1').all();
        return json({
          ok: true,
          campaignStorage: 'd1',
          sheetStorage: 'd1',
          historyStorage: 'd1',
          treeStorage: 'd1',
          authStorage: 'chatgpt',
          discordTransport: 'gateway-required',
          discordConfigured: Boolean(env.DISCORD_PUBLIC_KEY),
        });
      }
      if (url.pathname === '/api/presets' && request.method === 'GET') return json(PRESETS);
      if (url.pathname === '/api/sheets') {
        const owner = requireOwner();
        if (request.method === 'GET') {
          const rows = await env.DB.prepare(
            'SELECT document FROM edge_sheets WHERE owner_id=? ORDER BY updated_at DESC',
          )
            .bind(owner)
            .all<{ document: string }>();
          return json(rows.results.map((r) => JSON.parse(r.document)));
        }
        const b = await body(request);
        if (request.method === 'POST') {
          const sheet = validateSheet(b.sheet as Sheet);
          evaluateSheet(sheet);
          await env.DB.prepare(
            'INSERT INTO edge_sheets (owner_id,id,document,updated_at) VALUES (?,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET document=excluded.document,updated_at=excluded.updated_at',
          )
            .bind(owner, sheet.id, JSON.stringify(sheet), new Date().toISOString())
            .run();
          return json(sheet);
        }
        if (request.method === 'DELETE') {
          await env.DB.prepare('DELETE FROM edge_sheets WHERE owner_id=? AND id=?')
            .bind(owner, String(b.id))
            .run();
          return json({ ok: true });
        }
      }
      if (url.pathname === '/api/roll' && request.method === 'POST') {
        const b = await body(request),
          r = roll(String(b.expression), {
            user: user?.id,
            channel: 'web',
            target: b.target === undefined ? undefined : Number(b.target),
          });
        if (user)
          await env.DB.batch([
            env.DB.prepare(
              'INSERT INTO edge_rolls (owner_id,id,document,created_at) VALUES (?,?,?,?)',
            ).bind(user.id, r.roll_id, JSON.stringify(r), r.created_at),
            env.DB.prepare(
              'DELETE FROM edge_rolls WHERE owner_id=? AND id NOT IN (SELECT id FROM edge_rolls WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT 50)',
            ).bind(user.id, user.id),
          ]);
        return json(r);
      }
      if (url.pathname === '/api/history' && request.method === 'GET') {
        const owner = requireOwner(),
          rows = await env.DB.prepare(
            'SELECT document FROM edge_rolls WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT 50',
          )
            .bind(owner)
            .all<{ document: string }>();
        return json(rows.results.map((r) => JSON.parse(r.document)));
      }
      if (
        (url.pathname === '/api/tree' && request.method === 'GET') ||
        (url.pathname === '/api/tree/buy' && request.method === 'POST')
      ) {
        const owner = requireOwner(),
          b = request.method === 'GET' ? Object.fromEntries(url.searchParams) : await body(request);
        const character = String(b.character ?? 'demo'),
          level = Number(b.level ?? 1);
        if (!Number.isInteger(level) || level < 1 || level > 100 || character.length > 120)
          throw new ApiError(400, 'Personagem ou nível inválido.');
        for (let attempt = 0; attempt < 12; attempt++) {
          const row = await env.DB.prepare(
            'SELECT revision,document FROM edge_trees WHERE owner_id=? AND character=? AND level=?',
          )
            .bind(owner, character, level)
            .first<{ revision: number; document: string }>();
          let tree: GeneratedTree = row
            ? JSON.parse(row.document)
            : generateTree(defaultPool(), character, level);
          if (request.method === 'POST')
            tree = buyNode(tree, String(b.nodeId), String(b.idempotencyKey ?? ''));
          if (row && request.method === 'GET') return json(tree);
          const result = row
            ? await env.DB.prepare(
                'UPDATE edge_trees SET document=?,revision=revision+1 WHERE owner_id=? AND character=? AND level=? AND revision=?',
              )
                .bind(JSON.stringify(tree), owner, character, level, row.revision)
                .run()
            : await env.DB.prepare(
                'INSERT OR IGNORE INTO edge_trees (owner_id,character,level,document) VALUES (?,?,?,?)',
              )
                .bind(owner, character, level, JSON.stringify(tree))
                .run();
          if (result.meta.changes === 1) return json(tree);
        }
        throw new ApiError(409, 'A árvore recebeu alterações simultâneas. Tente novamente.');
      }
      if (url.pathname.startsWith('/api/campaigns')) {
        const campaigns = createEdgeCampaignStore(env.DB);
        if (url.pathname === '/api/campaigns' && request.method === 'GET')
          return json(await campaigns.list(requireOwner()));
        if (request.method === 'POST') {
          const b = await body(request),
            locator = String(b.campaignId || b.inviteToken || ''),
            session = String(b.sessionToken ?? '');
          switch (url.pathname) {
            case '/api/campaigns': {
              const c = await campaigns.create(b.name, b.dmName, user?.id);
              return json({ ...c, inviteUrl: `/campaign/${c.inviteToken}` }, 201);
            }
            case '/api/campaigns/join':
              return json(await campaigns.join(String(b.inviteToken ?? ''), b.name, user?.id));
            case '/api/campaigns/state':
              return json(await campaigns.get(locator, session, user?.id));
            case '/api/campaigns/event':
              return json(await campaigns.event(locator, session, b.body, user?.id));
            case '/api/campaigns/status':
              return json(
                await campaigns.status(locator, session, b.status as CampaignStatus, user?.id),
              );
            case '/api/campaigns/revoke':
              return json(await campaigns.revoke(locator, session, user?.id));
            case '/api/campaigns/rotate':
              return json(await campaigns.rotate(locator, session, user?.id));
            case '/api/campaigns/remove':
              return json(
                await campaigns.remove(locator, session, String(b.participantId), user?.id),
              );
            case '/api/campaigns/claim':
              return json(await campaigns.claim(locator, session, requireOwner()));
          }
        }
      }
      if (url.pathname.startsWith('/api/'))
        throw new ApiError(404, 'Rota de API inexistente ou método não permitido.');
      if (!['GET', 'HEAD'].includes(request.method))
        throw new ApiError(405, 'Método não permitido.');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('..') || pathname.includes('\\'))
        throw new ApiError(403, 'Caminho inválido.');
      const asset =
        assets[pathname] ??
        (!pathname.split('/').pop()?.includes('.') ? assets['/index.html'] : undefined);
      if (!asset) throw new ApiError(404, 'Arquivo inexistente.');
      return new Response(
        request.method === 'HEAD'
          ? null
          : asset.encoding === 'base64'
            ? Uint8Array.from(atob(asset.content), (c) => c.charCodeAt(0))
            : asset.content,
        {
          headers: {
            'content-type': asset.type,
            'x-content-type-options': 'nosniff',
            'referrer-policy': 'no-referrer',
            'cache-control': pathname.startsWith('/assets/')
              ? 'public,max-age=31536000,immutable'
              : 'no-cache',
          },
        },
      );
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message }, e.status);
      if (
        e instanceof Error &&
        !('code' in e) &&
        !/D1|SQLITE|database|no such table/i.test(e.message)
      )
        return json({ error: e.message }, 400);
      return json({ error: 'Serviço temporariamente indisponível.' }, 503);
    }
  },
};
