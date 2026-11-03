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
  if (interaction.application_id && interaction.application_id !== env.DISCORD_CLIENT_ID)
    return json({ error: 'Aplicação Discord incorreta.' }, 403);
  if (interaction.type === 1) return json({ type: 1 });
  if (interaction.type !== 2 || interaction.data?.name !== 'rolar')
    return json({ type: 4, data: { content: 'Comando não reconhecido.', flags: 64 } });
  const options = Object.fromEntries(
    (interaction.data.options ?? []).map((o: any) => [o.name, o.value]),
  );
  try {
    if (options.alvo !== undefined && typeof options.alvo !== 'number')
      throw new Error('Alvo inválido.');
    const result = roll(String(options.expressao ?? ''), {
      target: options.alvo as number | undefined,
      user: interaction.member?.user?.id ?? interaction.user?.id,
      channel: 'discord',
    });
    const audit = result.groups
      .map((g) => g.dice.map((d) => (d.kept ? d.total : `~~${d.total}~~`)).join(' · '))
      .join('\n');
    const content = `**${result.expression}** → **${result.total}**\n${audit}`;
    return json({
      type: 4,
      data: {
        content:
          content.length > 1900 ? `${content.slice(0, 1850)}\n… auditoria abreviada.` : content,
        flags: options.privado === true ? 64 : 0,
        allowed_mentions: { parse: [] },
      },
    });
  } catch (e) {
    return json({
      type: 4,
      data: {
        content:
          `Não foi possível rolar: ${e instanceof Error ? e.message : 'Expressão inválida.'}`.slice(
            0,
            1900,
          ),
        flags: 64,
        allowed_mentions: { parse: [] },
      },
    });
  }
}
