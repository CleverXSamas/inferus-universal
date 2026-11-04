import { roll } from '../packages/dice-core/index.js';
import {
  formatHelp,
  formatRoll,
  formatRollError,
  presentMessage,
  rollOptions,
  type DiscordMessage,
} from '../packages/discord-ui/index.js';
export type PrefixCommand =
  | { kind: 'help'; topic: string }
  | { kind: 'roll'; expression: string; target?: number; reason: string };
export function parsePrefixCommand(content: string): PrefixCommand | null {
  const match = content.match(/^!(rolar|roll|r|ajuda)(?=\s|$)\s*([\s\S]*)$/i);
  if (!match) return null;
  if (content.length > 350) throw new Error('Use um comando de até 350 caracteres.');
  if (match[1].toLowerCase() === 'ajuda') {
    const topic = match[2].trim() || 'inicio';
    if (!['inicio', 'expressoes', 'privacidade'].includes(topic))
      throw new Error('Use !ajuda, !ajuda expressoes ou !ajuda privacidade.');
    return { kind: 'help', topic };
  }
  const [options, ...caption] = match[2].split('|');
  const target = options.match(/\s+alvo:(-?\d+)\s*$/i);
  const input = rollOptions({
    expressao: target ? options.slice(0, target.index).trim() : options.trim(),
    alvo: target ? Number(target[1]) : undefined,
    motivo: caption.join('|').trim(),
  });
  return { kind: 'roll', expression: input.expression, target: input.target, reason: input.reason };
}
export type PrefixMessage = {
  content: string;
  userId: string;
  isBot: boolean;
  inGuild: boolean;
  richAllowed: boolean;
  reply: (body: DiscordMessage) => Promise<void>;
};
/** Does not read history, delete the player's command or emit mentions. */
export function createPrefixHandler(origin?: string, now = Date.now) {
  const active = new Set<string>();
  const recent = new Map<string, number>();
  return async (message: PrefixMessage) => {
    if (
      message.isBot ||
      !message.inGuild ||
      !/^!(rolar|roll|r|ajuda)(?=\s|$)/i.test(message.content)
    )
      return;
    const time = now();
    if (active.has(message.userId) || time - (recent.get(message.userId) ?? -Infinity) < 1500)
      return;
    // Bound the cache; expired entries never authorize parallel requests.
    for (const [id, at] of recent) if (time - at >= 1500) recent.delete(id);
    if (recent.size >= 10000) return;
    recent.set(message.userId, time);
    active.add(message.userId);
    try {
      let response: DiscordMessage;
      try {
        const command = parsePrefixCommand(message.content)!;
        response =
          command.kind === 'help'
            ? formatHelp(command.topic, origin)
            : formatRoll(
                roll(command.expression, {
                  target: command.target,
                  user: message.userId,
                  channel: 'discord',
                }),
                command.reason,
                origin,
              );
      } catch (error) {
        response = formatRollError(error);
      }
      await message.reply(presentMessage(response, message.richAllowed));
    } finally {
      active.delete(message.userId);
    }
  };
}
