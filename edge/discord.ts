import {
  expressionSuggestions,
  embedsPermitted,
  presentMessage,
  type DiscordMessage,
  formatHelp,
  formatRoll,
  formatRollError,
  rollOptions,
} from '../packages/discord-ui/index.js';
import { roll } from '../packages/dice-core/index.js';
import { json, type Env } from './types.js';
const hexBytes = (value: string) =>
  Uint8Array.from(value.match(/.{2}/g) ?? [], (n) => parseInt(n, 16));
export async function discordInteraction(request: Request, env: Env) {
  if (!env.DISCORD_PUBLIC_KEY || !/^[a-f0-9]{64}$/i.test(env.DISCORD_PUBLIC_KEY))
    return json({ error: 'Discord ainda não configurado.' }, 503);
  const signature = request.headers.get('x-signature-ed25519') ?? '',
    timestamp = request.headers.get('x-signature-timestamp') ?? '';
  if (
    !/^[a-f0-9]{128}$/i.test(signature) ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  )
    return json({ error: 'Assinatura Discord inválida.' }, 401);
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length > 32768) return json({ error: 'Interação muito grande.' }, 413);
  const prefix = new TextEncoder().encode(timestamp),
    message = new Uint8Array(prefix.length + body.length);
  message.set(prefix);
  message.set(body, prefix.length);
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      hexBytes(env.DISCORD_PUBLIC_KEY),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    if (!(await crypto.subtle.verify('Ed25519', key, hexBytes(signature), message)))
      return json({ error: 'Assinatura Discord inválida.' }, 401);
  } catch {
    return json({ error: 'Assinatura Discord inválida.' }, 401);
  }
  let interaction: any;
  try {
    interaction = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return json({ error: 'Interação inválida.' }, 400);
  }
  if (!interaction || typeof interaction !== 'object')
    return json({ error: 'Interação inválida.' }, 400);
  if (interaction.application_id && interaction.application_id !== env.DISCORD_CLIENT_ID)
    return json({ error: 'Aplicação Discord incorreta.' }, 403);
  if (interaction.type === 1) return json({ type: 1 });
  const items = Array.isArray(interaction.data?.options) ? interaction.data.options : [];
  if (interaction.type === 4) {
    const focused = items.find((o: any) => o?.focused === true && o.name === 'expressao');
    return json({
      type: 8,
      data: {
        choices:
          interaction.data?.name === 'rolar' && focused ? expressionSuggestions(focused.value) : [],
      },
    });
  }
  const respond = (data: DiscordMessage, privateReply = true) => {
    const message = presentMessage(data, embedsPermitted(interaction.app_permissions));
    return json({
      type: 4,
      data: {
        ...message,
        flags: (message.flags ?? 0) | (privateReply ? 64 : 0),
        allowed_mentions: { parse: [] },
      },
    });
  };
  if (interaction.type !== 2)
    return respond({ content: 'Interação não reconhecida. Use /ajuda para começar.' });
  const options = Object.fromEntries(
    items.filter((o: any) => o && typeof o.name === 'string').map((o: any) => [o.name, o.value]),
  );
  if (interaction.data?.name === 'ajuda')
    return respond(formatHelp(options.topico, new URL(request.url).origin));
  if (interaction.data?.name !== 'rolar')
    return respond({ content: 'Comando não reconhecido. Use /ajuda para consultar o Inferus.' });
  try {
    const input = rollOptions(options);
    const result = roll(input.expression, {
      target: input.target,
      user: interaction.member?.user?.id ?? interaction.user?.id,
      channel: 'discord',
    });
    return respond(formatRoll(result, input.reason, new URL(request.url).origin), input.private);
  } catch (e) {
    return respond(formatRollError(e));
  }
}
