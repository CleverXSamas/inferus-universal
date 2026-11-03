import { commandDefinitions } from '../packages/discord-commands/index.js';
import { ApiError, type Env } from './types.js';
export const discordUrls = (origin: string, clientId: string) => ({
  applicationId: clientId,
  interactionsEndpoint: `${origin}/api/discord/interactions`,
  installUrl: `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&scope=bot%20applications.commands&permissions=0`,
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
    const r = await fetch(`https://discord.com/api/v10${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok)
      throw new ApiError(
        400,
        `O Discord recusou a configuração (HTTP ${r.status}). Confira o token e a aplicação no Developer Portal.`,
      );
    return r.json() as Promise<any>;
  }
  // Possession of the matching bot token authorizes configuring this specific application.
  // Tokens are used only for these requests; never written to DB, logs, responses or storage.
  const app = await discord('/applications/@me');
  if (app.id !== env.DISCORD_CLIENT_ID)
    throw new ApiError(403, 'O token pertence a outra aplicação Discord.');
  if (String(app.verify_key).toLowerCase() !== env.DISCORD_PUBLIC_KEY.toLowerCase())
    throw new ApiError(409, 'A chave pública informada não corresponde à aplicação Discord.');
  for (const command of commandDefinitions)
    await discord(`/applications/${env.DISCORD_CLIENT_ID}/commands`, {
      method: 'POST',
      body: JSON.stringify(command),
    });
  const urls = discordUrls(origin, env.DISCORD_CLIENT_ID);
  await discord('/applications/@me', {
    method: 'PATCH',
    body: JSON.stringify({ interactions_endpoint_url: urls.interactionsEndpoint }),
  });
  return { ok: true, ...urls };
}
