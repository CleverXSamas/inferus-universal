/** Removes only Inferus' former commands, preserving unrelated application commands. */
export async function removeLegacyCommands(
  request: (path: string, init?: RequestInit) => Promise<unknown>,
  applicationId: string,
  guildId?: string,
) {
  if (!/^\d{17,22}$/.test(applicationId)) throw new Error('Application ID inválido.');
  if (guildId && !/^\d{17,22}$/.test(guildId)) throw new Error('ID do servidor inválido.');
  const bases = [`/applications/${applicationId}/commands`];
  if (guildId) bases.push(`/applications/${applicationId}/guilds/${guildId}/commands`);
  let removed = 0;
  for (const base of bases) {
    const commands = await request(base);
    if (!Array.isArray(commands)) throw new Error('O Discord retornou um catálogo inválido.');
    for (const command of commands) {
      if (command && ['rolar', 'ajuda'].includes(command.name) && /^\d{17,22}$/.test(command.id)) {
        await request(`${base}/${command.id}`, { method: 'DELETE' });
        removed++;
      }
    }
  }
  return removed;
}
