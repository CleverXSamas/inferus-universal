import { createSiteIntegration } from './site-integration.js';
import { botClientOptions } from './client-options.js';
import { Client, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { createPrefixHandler } from './discord-adapter.js';
import { removeLegacyCommands } from '../packages/discord-commands/index.js';
import { validateDiscordCredentials } from './credentials.js';
import { assertRuntimeConfiguration } from '../server/config.js';
function env(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} não configurado.`);
  return value;
}
async function main() {
  const token = env('DISCORD_TOKEN'),
    clientId = env('DISCORD_CLIENT_ID');
  await validateDiscordCredentials(token, clientId);
  if (process.argv.includes('--check')) {
    console.log(`Credenciais Discord validadas para a aplicação ${clientId}.`);
    return;
  }
  if (process.argv.includes('--remove-slash')) {
    const removed = await removeLegacyCommands(
      async (path, init = {}) => {
        const response = await fetch(`https://discord.com/api/v10${path}`, {
          ...init,
          headers: { authorization: `Bot ${token}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`Discord recusou a remoção (HTTP ${response.status}).`);
        return response.status === 204 ? null : response.json();
      },
      clientId,
      process.env.DISCORD_GUILD_ID,
    );
    console.log(`${removed} comandos antigos removidos. Nenhum comando de barra foi registrado.`);
    return;
  }
  assertRuntimeConfiguration('bot');
  const client = new Client(botClientOptions());
  const handle = createPrefixHandler(
    process.env.PUBLIC_ORIGIN,
    Date.now,
    createSiteIntegration(env('PUBLIC_ORIGIN'), token),
  );
  client.once('clientReady', () =>
    console.log('Inferus conectado. Comandos públicos: !rolar, !r e !ajuda.'),
  );
  client.on('messageCreate', (message) => {
    if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
    const permissions = message.channel.permissionsFor(client.user!);
    const sendPermission = message.channel.isThread()
      ? PermissionFlagsBits.SendMessagesInThreads
      : PermissionFlagsBits.SendMessages;
    if (!permissions?.has([PermissionFlagsBits.ViewChannel, sendPermission])) return;
    void handle({
      content: message.content,
      userId: message.author.id,
      displayName: message.member?.displayName ?? message.author.username,
      isBot: message.author.bot,
      inGuild: true,
      richAllowed: permissions.has(PermissionFlagsBits.EmbedLinks),
      reply: async (body) => {
        // Sending to the same channel keeps the typed command and result public.
        await message.channel.send(
          body.flags === 32768
            ? {
                components: body.components,
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
              }
            : {
                content: body.content,
                embeds: body.embeds,
                components: body.components,
                allowedMentions: { parse: [] },
              },
        );
      },
    }).catch(() =>
      console.error('Falha ao responder ao comando Discord. Confira as permissões do canal.'),
    );
  });
  client.on('error', () =>
    console.error(
      'Falha de conexão Discord. Confira Message Content Intent e o token no cofre da hospedagem.',
    ),
  );
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => client.destroy());
  await client.login(token);
}
main().catch((error: unknown) => {
  // Gateway errors may contain request details; never print the raw error or token.
  console.error(
    error instanceof Error &&
      /^(DISCORD_|Configuração|Discord recusou|DISCORD_TOKEN e)/.test(error.message)
      ? error.message
      : 'Não foi possível conectar o bot. Confira o token, o Application ID e Message Content Intent.',
  );
  process.exitCode = 1;
});
