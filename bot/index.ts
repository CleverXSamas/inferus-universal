import { Client, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { commandDefinitions, handleInteraction } from './discord-adapter.js';
function env(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} não configurado.`);
  return value;
}
async function main() {
  const token = env('DISCORD_TOKEN');
  if (process.argv.includes('--register')) {
    const clientId = env('DISCORD_CLIENT_ID'),
      rest = new REST({ version: '10' }).setToken(token),
      guild = process.env.DISCORD_GUILD_ID;
    await rest.put(
      guild
        ? Routes.applicationGuildCommands(clientId, guild)
        : Routes.applicationCommands(clientId),
      { body: commandDefinitions },
    );
    console.log('Comando /rolar registrado.');
    console.log(
      `Instalação: https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&scope=bot%20applications.commands&permissions=0`,
    );
    return;
  }
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once('clientReady', () => console.log('Inferus Discord conectado.'));
  client.on('interactionCreate', (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    void handleInteraction({
      commandName: interaction.commandName,
      userId: interaction.user.id,
      options: {
        expressao: interaction.options.getString('expressao'),
        alvo: interaction.options.getInteger('alvo') ?? undefined,
        privado: interaction.options.getBoolean('privado') ?? false,
      },
      reply: async (body) => {
        await interaction.reply({
          content: body.content,
          flags: body.ephemeral ? MessageFlags.Ephemeral : undefined,
          allowedMentions: { parse: [] },
        });
      },
      deferReply: async (opts) => {
        await interaction.deferReply({
          flags: opts.ephemeral ? MessageFlags.Ephemeral : undefined,
        });
      },
      editReply: async (body) => {
        await interaction.editReply({ content: body.content, allowedMentions: { parse: [] } });
      },
    }).catch(() => console.error('Falha ao responder à interação Discord.'));
  });
  client.on('error', () => console.error('Falha de conexão Discord.'));
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      client.destroy();
    });
  await client.login(token);
}
main().catch((e: Error) => {
  console.error(e.message);
  process.exitCode = 1;
});
