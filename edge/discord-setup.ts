import { removeLegacyCommands } from '../packages/discord-commands/index.js';
import { ApiError, type Env } from './types.js';
export const discordUrls = (origin: string, clientId: string) => ({
  applicationId: clientId,
  interactionsEndpoint: `${origin}/api/discord/interactions`,
  installUrl: `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&scope=bot&permissions=274877926400`,
});
export async function setupDiscord(botToken: unknown, origin: string, env: Env) {
  if (
    typeof botToken !== 'string' ||
    !botToken.trim() ||
    botToken.length > 512 ||
    /[\r\n]/.test(botToken)
  )
    throw new ApiError(400, 'Informe um token de bot válido.');
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_PUBLIC_KEY)
    throw new ApiError(503, 'A aplicação Discord ainda não foi configurada.');
  const headers = { authorization: `Bot ${botToken.trim()}`, 'content-type': 'application/json' };
  async function discord(path: string, init: RequestInit = {}) {
    let r: Response;
    try {
      r = await fetch(`https://discord.com/api/v10${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ApiError(
        503,
        'O Discord não respondeu à configuração. Tente novamente em alguns instantes.',
      );
    }
    if (r.status === 401)
      throw new ApiError(
        400,
        'O token foi recusado. Gere um novo token na aba Bot do Developer Portal e tente novamente.',
      );
    if (r.status === 403)
      throw new ApiError(
        403,
        'A aplicação não permitiu esta atualização. Confira o token e as configurações no Developer Portal.',
      );
    if (r.status === 429)
      throw new ApiError(
        429,
        'O Discord limitou as tentativas de configuração. Aguarde um pouco antes de tentar novamente.',
      );
    if (!r.ok)
      throw new ApiError(
        r.status >= 500 ? 503 : 400,
        `O Discord recusou a configuração (HTTP ${r.status}). Confira a aplicação no Developer Portal.`,
      );
    return r.status === 204 ? null : (r.json() as Promise<any>);
  }
  // Possession of the matching bot token authorizes configuring this specific application.
  // Tokens are used only for these requests; never written to DB, logs, responses or storage.
  const app = await discord('/applications/@me');
  if (app.id !== env.DISCORD_CLIENT_ID)
    throw new ApiError(403, 'O token pertence a outra aplicação Discord.');
  if (String(app.verify_key).toLowerCase() !== env.DISCORD_PUBLIC_KEY.toLowerCase())
    throw new ApiError(409, 'A chave pública informada não corresponde à aplicação Discord.');
  const removedCommands = await removeLegacyCommands(discord, env.DISCORD_CLIENT_ID);
  return { ok: true, ...discordUrls(origin, env.DISCORD_CLIENT_ID), removedCommands };
}

export function discordConfig(origin: string, env: Env) {
  const ready = Boolean(
    env.DISCORD_CLIENT_ID &&
    /^\d{17,22}$/.test(env.DISCORD_CLIENT_ID) &&
    env.DISCORD_PUBLIC_KEY &&
    /^[a-f0-9]{64}$/i.test(env.DISCORD_PUBLIC_KEY),
  );
  return {
    ...discordUrls(origin, env.DISCORD_CLIENT_ID ?? ''),
    serviceReady: ready,
    transport: 'gateway',
    gatewayStatus: 'unverified',
    hostingRequired: true,
    installUrl: ready ? discordUrls(origin, env.DISCORD_CLIENT_ID!).installUrl : null,
    commands: ['!rolar', '!r', '!ajuda'],
  };
}
