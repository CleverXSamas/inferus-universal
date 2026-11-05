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
  if (interaction.type === 4) return json({ type: 8, data: { choices: [] } });
  return json({
    type: 4,
    data: {
      content:
        'O Inferus usa mensagens públicas: !rolar 1d20+5 ou !ajuda. O modo por prefixo precisa estar conectado no servidor.',
      flags: 64,
      allowed_mentions: { parse: [] },
    },
  });
}
