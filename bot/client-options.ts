import { GatewayIntentBits, Options, type ClientOptions } from 'discord.js';
/** The bot never reads history. Avoid retaining channel messages on small hosts. */
export function botClientOptions(): ClientOptions {
  return {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    allowedMentions: { parse: [], repliedUser: false },
    makeCache: Options.cacheWithLimits({
      MessageManager: 0,
      UserManager: { maxSize: 100, keepOverLimit: (user) => user.id === user.client.user?.id },
      GuildMemberManager: {
        maxSize: 50,
        keepOverLimit: (member) => member.id === member.client.user?.id,
      },
    }),
  };
}
