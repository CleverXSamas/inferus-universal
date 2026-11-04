import { ApiError, hash, token, type Env } from './types.js';
import { createEdgeCampaignStore } from './campaigns.js';
import { withCharacterTree } from '../packages/campaign-characters/index.js';
import type { Sheet } from '../packages/sheet-engine/index.js';
type Link = {
  owner_id: string;
  discord_id: string;
  display_name: string;
  active_kind: 'sheet' | 'campaign' | null;
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
  const campaigns = createEdgeCampaignStore(env.DB);
  async function choices(owner: string) {
    const sheets = await env.DB.prepare('SELECT id,document FROM edge_sheets WHERE owner_id=?')
      .bind(owner)
      .all<{ id: string; document: string }>();
    const result = sheets.results.map((row) => ({
      key: `sheet:${row.id}`,
      label: `Ficha · ${(JSON.parse(row.document) as Sheet).name}`,
    }));
    for (const campaign of await campaigns.list(owner)) {
      const own = await campaigns.get(campaign.id, '', owner);
      const p = own.state.participants.find((p) => p.id === own.participantId);
      result.push({
        key: `campaign:${campaign.id}`,
        label: `${campaign.name} · ${p?.character?.name ?? 'Sem personagem vinculado'}`,
      });
    }
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
                link.active_kind && link.active_id ? `${link.active_kind}:${link.active_id}` : '',
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
          throw new ApiError(403, 'Selecione uma ficha sua ou seu personagem de campanha.');
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
      if (!['character', 'campaigns', 'campaign', 'session', 'note'].includes(body.action))
        throw new ApiError(400, 'Ação do bot inválida.');
      const link = await env.DB.prepare('SELECT * FROM edge_discord_accounts WHERE discord_id=?')
        .bind(discordId)
        .first<Link>();
      if (!link)
        throw new ApiError(403, 'Use !login, vincule seu Discord e confirme a identidade no site.');
      if (body.action === 'campaigns') {
        const list = [];
        for (const c of await campaigns.list(link.owner_id)) {
          const own = await campaigns.get(c.id, '', link.owner_id);
          list.push({
            id: c.id,
            name: own.state.name,
            status: own.state.status,
            participants: own.state.participants.length,
            role: own.role,
            character:
              own.state.participants.find((p) => p.id === own.participantId)?.character?.name ??
              null,
            selected: link.active_kind === 'campaign' && link.active_id === c.id,
          });
        }
        return {
          campaigns: list.sort(
            (a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id),
          ),
        };
      }
      if (['campaign', 'session', 'note'].includes(body.action)) {
        let campaignId = link.active_kind === 'campaign' ? link.active_id : null;
        if (body.action === 'campaign' && body.query !== undefined) {
          const query = String(body.query).trim();
          if (!query || query.length > 100)
            throw new ApiError(400, 'Use !campanha usar Nome da campanha ou ID.');
          const available = await campaigns.list(link.owner_id);
          const exactId = available.find((c) => c.id === query);
          const matches = exactId
            ? [exactId]
            : available.filter(
                (c) => c.name.toLocaleLowerCase('pt-BR') === query.toLocaleLowerCase('pt-BR'),
              );
          if (matches.length !== 1)
            throw new ApiError(
              409,
              matches.length
                ? 'Há campanhas com o mesmo nome. Use o ID exibido em !campanhas.'
                : 'Campanha não encontrada na sua conta. Use !campanhas e copie o nome completo ou ID.',
            );
          campaignId = matches[0].id;
          await campaigns.get(campaignId, '', link.owner_id);
          const changed = await env.DB.prepare(
            "UPDATE edge_discord_accounts SET active_kind='campaign',active_id=? WHERE owner_id=? AND discord_id=?",
          )
            .bind(campaignId, link.owner_id, discordId)
            .run();
          if (changed.meta.changes !== 1)
            throw new ApiError(409, 'O vínculo mudou. Use !login novamente.');
        }
        if (!campaignId)
          throw new ApiError(
            409,
            'Escolha sua mesa com !campanha usar Nome da campanha. Consulte !campanhas.',
          );
        // Every operation rechecks membership; the existing store enforces the DM role.
        let own = await campaigns.get(campaignId, '', link.owner_id);
        if (body.action === 'session') {
          if (!['active', 'paused', 'closed'].includes(body.status))
            throw new ApiError(400, 'Use !sessao iniciar, pausar, retomar ou encerrar.');
          own = {
            ...own,
            state: await campaigns.status(campaignId, '', body.status, link.owner_id),
          };
        }
        if (body.action === 'note') {
          if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 300)
            throw new ApiError(400, 'Use !anotar seguido de uma mensagem de até 300 caracteres.');
          if (own.state.status === 'closed')
            throw new ApiError(
              409,
              'A campanha está encerrada. Peça ao mestre para reabrir a sessão.',
            );
          await campaigns.event(campaignId, '', body.text, link.owner_id);
          return { name: own.state.name };
        }
        return {
          campaign: {
            id: own.state.id,
            name: own.state.name,
            status: own.state.status,
            role: own.role,
            character:
              own.state.participants.find((p) => p.id === own.participantId)?.character?.name ??
              null,
            participants: own.state.participants.map((p) => ({
              name: p.name,
              role: p.role,
              character: p.character?.name ?? null,
              self: p.id === own.participantId,
            })),
            events: own.state.events,
          },
        };
      }
      let sheet: Sheet | null = null;
      if (link.active_kind === 'sheet') {
        const row = await env.DB.prepare(
          'SELECT document FROM edge_sheets WHERE owner_id=? AND id=?',
        )
          .bind(link.owner_id, link.active_id)
          .first<{ document: string }>();
        sheet = row ? JSON.parse(row.document) : null;
      } else if (link.active_kind === 'campaign' && link.active_id) {
        sheet = (await campaigns.character(link.active_id, '', undefined, link.owner_id)).sheet;
      }
      if (!sheet)
        throw new ApiError(
          404,
          'Salve seu personagem na campanha selecionada ou escolha outra ficha na página Discord do site. Use !campanha para conferir a mesa.',
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
