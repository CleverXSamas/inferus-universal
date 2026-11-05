export async function validateDiscordCredentials(token: string, clientId: string) {
  const response = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
    headers: { authorization: `Bot ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Discord recusou a validação das credenciais (HTTP ${response.status}).`);
  const app = (await response.json()) as { id?: string };
  if (app.id !== clientId)
    throw new Error('DISCORD_TOKEN e DISCORD_CLIENT_ID pertencem a aplicações diferentes.');
  return app.id;
}
