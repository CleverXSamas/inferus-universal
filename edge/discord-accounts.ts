import { ApiError, hash, token, type Env } from './types.js';
import { withCharacterTree } from '../packages/character-tree/index.js';
import type { Sheet } from '../packages/sheet-engine/index.js';
type Link = {
  owner_id: string;
  discord_id: string;
  display_name: string;
  active_kind: string | null;
  active_id: string | null;
};
type Pair = {
  token_hash: string;
  owner_id: string;
  expires_at: number;
  discord_id: string | null;
  display_name: string | null;
};
const verified = new Map<string, number>();
let windowStart = 0,
  misses = 0;
async function verifyBot(request: Request, env: Env) {
  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bot [A-Za-z0-9_.-]{20,250}$/.test(authorization))
    throw new ApiError(401, 'Autenticação do bot ausente ou inválida.');
  const key = await hash(`${env.DISCORD_CLIENT_ID}:${authorization}`),
    now = Date.now();
  if ((verified.get(key) ?? 0) > now) return;
  if (now - windowStart > 60000) {
    windowStart = now;
    misses = 0;
  }
  if (++misses > 12) throw new ApiError(429, 'Aguarde antes de validar o bot novamente.');
  let response: Response;
  try {
    response = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
      headers: { authorization },
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    throw new ApiError(503, 'Não foi possível validar a conexão do bot agora.');
  }
  if (!response.ok)
    throw new ApiError(401, 'A credencial do bot foi recusada. Confira o token no serviço.');
  const app = (await response.json()) as { id?: string };
  if (!env.DISCORD_CLIENT_ID || app.id !== env.DISCORD_CLIENT_ID)
    throw new ApiError(403, 'Este bot não pertence à aplicação Inferus configurada.');
  for (const [id, expiry] of verified) if (expiry <= now) verified.delete(id);
  if (verified.size >= 32) verified.clear();
  // Only a digest is cached. The bot token is neither persisted nor returned.
  verified.set(key, now + 30000);
}
export function discordAccounts(env: Env) {
  async function choices(owner: string) {
    const sheets = await env.DB.prepare('SELECT id,document FROM edge_sheets WHERE owner_id=?')
      .bind(owner)
      .all<{ id: string; document: string }>();
    const result = sheets.results.map((row) => ({
      key: `sheet:${row.id}`,
      label: `Ficha · ${(JSON.parse(row.document) as Sheet).name}`,
    }));
    return result;
  }
  return {
    async status(owner: string) {
      const link = await env.DB.prepare('SELECT * FROM edge_discord_accounts WHERE owner_id=?')
        .bind(owner)
        .first<Link>();
      const pair = await env.DB.prepare(
        'SELECT * FROM edge_discord_pairing WHERE owner_id=? AND expires_at>?',
      )
        .bind(owner, Date.now())
        .first<Pair>();
      return {
        link: link
          ? {
              discordId: link.discord_id,
              displayName: link.display_name,
              active:
                link.active_kind === 'sheet' && link.active_id
                  ? `${link.active_kind}:${link.active_id}`
                  : '',
            }
          : null,
        pending: pair
          ? {
              id: pair.token_hash,
              discordId: pair.discord_id,
              displayName: pair.display_name,
              expiresAt: pair.expires_at,
            }
          : null,
        choices: await choices(owner),
      };
    },
    async change(owner: string, body: Record<string, any>) {
      if (body.action === 'create-pair') {
        const code = token(),
          digest = await hash(code),
          expires = Date.now() + 10 * 60000;
        await env.DB.batch([
          env.DB.prepare('DELETE FROM edge_discord_pairing WHERE owner_id=? OR expires_at<?').bind(
            owner,
            Date.now(),
          ),
          env.DB.prepare(
            'INSERT INTO edge_discord_pairing(token_hash,owner_id,expires_at) VALUES(?,?,?)',
          ).bind(digest, owner, expires),
        ]);
        return { code, expiresAt: expires };
      }
      if (body.action === 'confirm') {
        const pair = await env.DB.prepare(
          'SELECT * FROM edge_discord_pairing WHERE owner_id=? AND token_hash=? AND expires_at>?',
        )
          .bind(owner, String(body.pairId ?? ''), Date.now())
          .first<Pair>();
        if (!pair?.discord_id)
          throw new ApiError(
            409,
            'Peça o vínculo pelo bot e confirme aqui antes do código expirar.',
          );
        const existing = await env.DB.prepare(
          'SELECT owner_id FROM edge_discord_accounts WHERE discord_id=?',
        )
          .bind(pair.discord_id)
          .first<{ owner_id: string }>();
        if (existing && existing.owner_id !== owner)
          throw new ApiError(
            409,
            'Este Discord já está vinculado a outra conta. Desvincule a conta anterior primeiro.',
          );
        const changes = await env.DB.batch([
          env.DB.prepare(
            'INSERT INTO edge_discord_accounts(owner_id,discord_id,display_name) SELECT owner_id,discord_id,display_name FROM edge_discord_pairing WHERE token_hash=? AND owner_id=? AND expires_at>? ON CONFLICT(owner_id) DO UPDATE SET discord_id=excluded.discord_id,display_name=excluded.display_name,active_kind=NULL,active_id=NULL',
          ).bind(pair.token_hash, owner, Date.now()),
          env.DB.prepare('DELETE FROM edge_discord_pairing WHERE owner_id=? AND token_hash=?').bind(
            owner,
            pair.token_hash,
          ),
        ]);
        if (changes[0].meta.changes !== 1)
          throw new ApiError(409, 'O pedido expirou ou foi substituído. Gere outro código.');
        return { ok: true };
      }
      if (body.action === 'select') {
        const available = await choices(owner),
          key = String(body.character ?? '');
        if (!available.some((c) => c.key === key))
          throw new ApiError(403, 'Selecione uma ficha salva na sua conta.');
        const split = key.indexOf(':');
        const result = await env.DB.prepare(
          'UPDATE edge_discord_accounts SET active_kind=?,active_id=? WHERE owner_id=?',
        )
          .bind(key.slice(0, split), key.slice(split + 1), owner)
          .run();
        if (result.meta.changes !== 1)
          throw new ApiError(409, 'Vincule seu Discord antes de escolher o personagem.');
        return { ok: true };
      }
      if (body.action === 'disconnect') {
        await env.DB.batch([
          env.DB.prepare('DELETE FROM edge_discord_accounts WHERE owner_id=?').bind(owner),
          env.DB.prepare('DELETE FROM edge_discord_pairing WHERE owner_id=?').bind(owner),
        ]);
        return { ok: true };
      }
      throw new ApiError(400, 'Ação de vínculo inválida.');
    },
    async bot(request: Request, body: Record<string, any>) {
      await verifyBot(request, env);
      const discordId = String(body.discordId ?? '');
      if (!/^\d{17,22}$/.test(discordId)) throw new ApiError(400, 'Identidade Discord inválida.');
      if (body.action === 'pair') {
        if (typeof body.code !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(body.code))
          throw new ApiError(400, 'Código de vínculo inválido. Gere um código no site.');
        const digest = await hash(body.code),
          displayName = String(body.displayName ?? discordId)
            .replace(/[\u0000-\u001f\u007f]/g, '')
            .slice(0, 80);
        const result = await env.DB.prepare(
          'UPDATE edge_discord_pairing SET discord_id=?,display_name=? WHERE token_hash=? AND expires_at>? AND (discord_id IS NULL OR discord_id=?)',
        )
          .bind(discordId, displayName, digest, Date.now(), discordId)
          .run();
        if (result.meta.changes !== 1)
          throw new ApiError(
            409,
            'O código expirou ou já recebeu outro pedido. Gere outro código no site.',
          );
        return { ok: true, pending: true };
      }
      if (!['character', 'sheets', 'select-sheet'].includes(body.action))
        throw new ApiError(400, 'Ação do bot inválida.');
      const link = await env.DB.prepare('SELECT * FROM edge_discord_accounts WHERE discord_id=?')
        .bind(discordId)
        .first<Link>();
      if (!link)
        throw new ApiError(403, 'Use !login, vincule seu Discord e confirme a identidade no site.');
      if (body.action === 'sheets' || body.action === 'select-sheet') {
        const rows = await env.DB.prepare('SELECT id,document FROM edge_sheets WHERE owner_id=?')
          .bind(link.owner_id)
          .all<{ id: string; document: string }>();
        const sheets = rows.results
          .map((row) => ({
            id: row.id,
            name: (JSON.parse(row.document) as Sheet).name,
            selected: link.active_kind === 'sheet' && link.active_id === row.id,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id));
        if (body.action === 'sheets') return { sheets };
        const query = typeof body.query === 'string' ? body.query.trim() : '';
        if (!query || query.length > 120)
          throw new ApiError(400, 'Use !ficha usar Nome completo ou ID.');
        const exact = sheets.find((s) => s.id === query);
        const matches = exact
          ? [exact]
          : sheets.filter(
              (s) => s.name.toLocaleLowerCase('pt-BR') === query.toLocaleLowerCase('pt-BR'),
            );
        if (matches.length !== 1)
          throw new ApiError(
            409,
            matches.length
              ? 'Há fichas com o mesmo nome. Use o ID mostrado em !fichas.'
              : 'Ficha não encontrada na sua conta. Consulte !fichas.',
          );
        const selected = matches[0];
        const changed = await env.DB.prepare(
          "UPDATE edge_discord_accounts SET active_kind='sheet',active_id=? WHERE owner_id=? AND discord_id=?",
        )
          .bind(selected.id, link.owner_id, discordId)
          .run();
        if (changed.meta.changes !== 1)
          throw new ApiError(409, 'Seu vínculo mudou. Use !login novamente.');
        return { selected };
      }
      let sheet: Sheet | null = null;
      if (link.active_kind === 'sheet') {
        const row = await env.DB.prepare(
          'SELECT document FROM edge_sheets WHERE owner_id=? AND id=?',
        )
          .bind(link.owner_id, link.active_id)
          .first<{ document: string }>();
        sheet = row ? JSON.parse(row.document) : null;
      }
      if (!sheet)
        throw new ApiError(
          404,
          'Escolha uma ficha salva na página Discord do site. Use !login para abrir.',
        );
      const document = withCharacterTree(sheet);
      return {
        sheet: {
          ...document,
          sections: document.sections.map((section) => ({
            ...section,
            fields: section.fields.filter((field) =>
              ['number', 'resource', 'calculated', 'action'].includes(field.type),
            ),
          })),
        },
      };
    },
  };
}
