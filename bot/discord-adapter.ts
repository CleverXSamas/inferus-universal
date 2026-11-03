import {
  expressionSuggestions,
  presentMessage,
  formatHelp,
  formatRoll,
  formatRollError,
  rollOptions,
  type DiscordMessage,
} from '../packages/discord-ui/index.js';
import type { RollRecord } from '../packages/dice-core/index.js';
export type Interaction = {
  commandName: string;
  options: Record<string, unknown>;
  userId: string;
  embedsAllowed?: boolean;
  reply: (body: DiscordMessage & { ephemeral?: boolean }) => Promise<void>;
  deferReply: (opts: { ephemeral?: boolean }) => Promise<void>;
  editReply: (body: DiscordMessage) => Promise<void>;
};
const api = () => process.env.FRAGMENTOS_API_URL ?? 'http://localhost:3000';
async function call(body: unknown): Promise<RollRecord> {
  const response = await fetch(`${api()}/api/roll`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error || 'A mesa não respondeu agora. Tente novamente em alguns instantes.',
    );
  }
  return response.json();
}
export async function handleInteraction(i: Interaction) {
  let deferred = false;
  const present = (body: DiscordMessage) => presentMessage(body, i.embedsAllowed ?? true);
  try {
    if (i.commandName === 'ajuda')
      return await i.reply({
        ...present(formatHelp(i.options.topico, process.env.PUBLIC_ORIGIN)),
        ephemeral: true,
      });
    if (i.commandName !== 'rolar')
      return await i.reply({
        content: 'Comando não reconhecido. Use /ajuda para começar.',
        ephemeral: true,
      });
    const input = rollOptions(i.options);
    await i.deferReply({ ephemeral: input.private });
    deferred = true;
    const result = await call({
      expression: input.expression,
      target: input.target,
      user: i.userId,
      channel: 'discord',
    });
    return await i.editReply(present(formatRoll(result, input.reason, process.env.PUBLIC_ORIGIN)));
  } catch (e) {
    const message = present(formatRollError(e));
    if (deferred) return await i.editReply(message);
    return await i.reply({ ...message, ephemeral: true });
  }
}
export { expressionSuggestions };
export { commandDefinitions } from '../packages/discord-commands/index.js';
