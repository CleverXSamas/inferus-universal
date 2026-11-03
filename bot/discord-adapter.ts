export type Interaction = {
  commandName: string;
  options: Record<string, unknown>;
  userId: string;
  reply: (body: { content: string; ephemeral?: boolean }) => Promise<void>;
  deferReply: (opts: { ephemeral?: boolean }) => Promise<void>;
  editReply: (body: { content: string }) => Promise<void>;
};
const api = () => process.env.FRAGMENTOS_API_URL ?? 'http://localhost:3000';
async function call(body: unknown) {
  const response = await fetch(`${api()}/api/roll`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'API indisponível.');
  }
  return response.json();
}
export async function handleInteraction(i: Interaction) {
  let deferred = false;
  try {
    if (i.commandName !== 'rolar')
      return await i.reply({ content: 'Comando não reconhecido.', ephemeral: true });
    const expression = String(i.options.expressao ?? '');
    if (!expression || expression.length > 160)
      return await i.reply({
        content: 'A expressão deve ter entre 3 e 160 caracteres.',
        ephemeral: true,
      });
    await i.deferReply({ ephemeral: Boolean(i.options.privado) });
    deferred = true;
    const result = await call({
      expression,
      target: i.options.alvo,
      user: i.userId,
      channel: 'discord',
    });
    const content = `**${result.expression}** → **${result.total}**\n${result.groups.map((g: any) => g.dice.map((d: any) => (d.kept ? d.total : `~~${d.total}~~`)).join(' · ')).join('\n')}`;
    return await i.editReply({
      content:
        content.length > 1900
          ? `${content.slice(0, 1850)}\n… auditoria completa na mesa web.`
          : content,
    });
  } catch (e) {
    const content =
      `Não foi possível concluir a rolagem: ${e instanceof Error ? e.message : 'Tente novamente.'}`.slice(
        0,
        1900,
      );
    if (deferred) return await i.editReply({ content });
    return await i.reply({ content, ephemeral: true });
  }
}
// Only functional commands are published. Sheets require explicit Discord/account linking.
export { commandDefinitions } from '../packages/discord-commands/index.js';
