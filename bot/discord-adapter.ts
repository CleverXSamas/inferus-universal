import { evaluateSheet, resolveActionExpression } from '../packages/sheet-engine/index.js';
import { botCard, commandError, pageOf, safe } from './presentation.js';
import type { SiteIntegration } from './site-integration.js';
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
  | { kind: 'login' }
  | { kind: 'sheet'; query?: string }
  | { kind: 'skills' | 'actions' | 'sheets'; page: number }
  | { kind: 'pair'; code: string }
  | { kind: 'action'; name: string; target?: number }
  | { kind: 'roll'; expression: string; target?: number; reason: string };
export function parsePrefixCommand(content: string): PrefixCommand | null {
  const match = content.match(
    /^!(rolar|roll|r|ajuda|login|vincular|fichas|ficha|skills|acoes|ações|acao|ação)(?=\s|$)\s*([\s\S]*)$/i,
  );
  if (!match) return null;
  if (content.length > 350) throw new Error('Use um comando de até 350 caracteres.');
  const verb = match[1].toLocaleLowerCase('pt-BR');
  const simple: Record<string, 'login'> = {
    login: 'login',
  };
  const paged: Record<string, 'skills' | 'actions' | 'sheets'> = {
    skills: 'skills',
    fichas: 'sheets',
    acoes: 'actions',
    ações: 'actions',
  };
  if (paged[verb]) {
    const input = match[2].trim();
    if (input && !/^[1-9]\d{0,3}$/.test(input))
      throw new Error(`Use !${verb} ou !${verb} 2 para mudar de página.`);
    return { kind: paged[verb], page: input ? Number(input) : 1 };
  }
  if (verb === 'ficha') {
    const arg = match[2].trim();
    if (!arg) return { kind: 'sheet' };
    const query = arg.match(/^usar\s+(.+)$/i)?.[1].trim();
    if (!query || query.length > 120)
      throw new Error('Use !ficha ou !ficha usar Nome completo ou ID.');
    return { kind: 'sheet', query };
  }
  if (simple[verb]) {
    if (match[2].trim()) throw new Error(`Use !${verb} sem argumentos.`);
    return { kind: simple[verb] };
  }
  if (verb === 'vincular') {
    if (!/^[A-Za-z0-9_-]{32}$/.test(match[2].trim()))
      throw new Error(
        'Gere seu código temporário na página Discord do site. Use !login para abrir.',
      );
    return { kind: 'pair', code: match[2].trim() };
  }
  if (verb === 'acao' || verb === 'ação') {
    const target = match[2].match(/\s+alvo:(-?\d+)\s*$/i);
    const name = (target ? match[2].slice(0, target.index) : match[2]).trim();
    const value = target ? Number(target[1]) : undefined;
    if (
      !name ||
      name.length > 80 ||
      (value !== undefined && (!Number.isInteger(value) || value < -50 || value > 1000))
    )
      throw new Error('Use !acao Nome da ação alvo:15 (alvo opcional).');
    return { kind: 'action', name, target: value };
  }
  if (match[1].toLowerCase() === 'ajuda') {
    const topic =
      match[2]
        .trim()
        .toLocaleLowerCase('pt-BR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') || 'inicio';
    if (!['inicio', 'expressoes', 'privacidade', 'personagem'].includes(topic))
      throw new Error('Use !ajuda, !ajuda personagem, !ajuda expressoes ou !ajuda privacidade.');
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
  displayName?: string;
  reply: (body: DiscordMessage) => Promise<void>;
};
/** Does not read history, delete the player's command or emit mentions. */
export function createPrefixHandler(origin?: string, now = Date.now, site?: SiteIntegration) {
  const active = new Set<string>();
  const recent = new Map<string, number>();
  return async (message: PrefixMessage) => {
    if (
      message.isBot ||
      !message.inGuild ||
      !/^!(rolar|roll|r|ajuda|login|vincular|fichas|ficha|skills|acoes|ações|acao|ação)(?=\s|$)/i.test(
        message.content,
      )
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
        if (command.kind === 'help') response = formatHelp(command.topic, origin);
        else if (command.kind === 'roll')
          response = formatRoll(
            roll(command.expression, {
              target: command.target,
              user: message.userId,
              channel: 'discord',
            }),
            command.reason,
            origin,
          );
        else if (command.kind === 'login')
          response = botCard(
            'Conecte sua conta ao Inferus',
            '1. Abra a página Discord do site e entre na conta.\n2. Gere o código e envie `!vincular CÓDIGO`.\n3. Confirme seu nome e ID no site.\n4. Escolha sua ficha salva no site.',
            origin,
            {
              label: 'Vincular minha conta',
              footer: 'O código expira em 10 min · Confirmação obrigatória no site',
            },
          );
        else {
          if (!site)
            throw new Error('A integração com o site não está configurada no serviço do bot.');
          if (command.kind === 'pair') {
            await site.pair(message.userId, command.code, message.displayName ?? message.userId);
            response = botCard(
              'Pedido enviado · confirme no site',
              'Confirme seu nome e ID do Discord na página de vínculo para liberar o acesso. Depois escolha o personagem ativo.',
              origin,
              { label: 'Confirmar meu Discord' },
            );
          } else if (command.kind === 'sheets') {
            const list = await site.sheets(message.userId),
              page = pageOf(list, command.page);
            response = botCard(
              'Suas fichas',
              list.length
                ? 'Escolha com `!ficha usar Nome completo` ou use o ID.'
                : 'Salve sua primeira ficha na conta pelo site.',
              origin,
              {
                path: '/ficha',
                fields: page.items.map((s) => ({
                  name: `${s.selected ? '◆ ' : ''}${safe(s.name, 100)}`,
                  value: `ID: \`${s.id}\``,
                })),
                footer: page.footer,
              },
            );
          } else if (command.kind === 'sheet' && command.query) {
            const selected = await site.selectSheet(message.userId, command.query);
            response = botCard(
              `Personagem selecionado · ${safe(selected.name, 100)}`,
              '`!ficha` resumo · `!acoes` ações · `!skills` habilidades',
              origin,
              { path: '/ficha' },
            );
          } else {
            const sheet = await site.character(message.userId);
            const values = evaluateSheet(sheet);
            if (command.kind === 'action') {
              const query = command.name.toLocaleLowerCase('pt-BR');
              const actions = sheet.sections
                .flatMap((s) => s.fields)
                .filter(
                  (f) =>
                    f.type === 'action' &&
                    (f.id.toLocaleLowerCase('pt-BR') === query ||
                      f.label.toLocaleLowerCase('pt-BR') === query),
                );
              if (actions.length !== 1)
                throw new Error(
                  actions.length
                    ? 'Há ações com o mesmo nome. Use a referência única do campo.'
                    : 'Ação não encontrada na ficha ativa. Use !acoes para ver os nomes e comandos disponíveis.',
                );
              const action = actions[0];
              response = formatRoll(
                roll(resolveActionExpression(action.expression ?? '1d20', values), {
                  target: command.target,
                  user: message.userId,
                  channel: 'discord',
                }),
                action.label,
                origin,
              );
            } else if (command.kind === 'skills') {
              const skills = sheet.skillTree?.skills.filter((s) => s.unlocked) ?? [];
              const page = pageOf(skills, command.page);
              response = botCard(
                `Habilidades · ${safe(sheet.name, 100)}`,
                skills.length
                  ? 'Habilidades desbloqueadas da ficha ativa. Custos e efeitos são aplicados manualmente na ficha.'
                  : 'Nenhuma habilidade desbloqueada ainda. Abra a árvore deste personagem no site.',
                origin,
                {
                  footer:
                    page.footer +
                    (command.page * 5 < skills.length ? ` · !skills ${command.page + 1}` : ''),
                  fields: page.items.map((s) => ({
                    name: safe(s.name, 100),
                    value: s.description ? safe(s.description, 300) : 'Desbloqueada',
                  })),
                },
              );
            } else if (command.kind === 'actions') {
              const actions = sheet.sections
                .flatMap((s) => s.fields)
                .filter((f) => f.type === 'action');
              const page = pageOf(actions, command.page);
              response = botCard(
                `Ações · ${safe(sheet.name, 100)}`,
                actions.length
                  ? 'Copie o comando da ação. Acrescente `alvo:15` se houver uma dificuldade.'
                  : 'Esta ficha ainda não tem ações. Adicione um campo de ação no site e salve o personagem.',
                origin,
                {
                  footer:
                    page.footer +
                    (command.page * 5 < actions.length ? ` · !acoes ${command.page + 1}` : ''),
                  fields: page.items.map((a) => ({
                    name: safe(a.label, 100),
                    value: `\`!acao ${a.id}\``,
                  })),
                },
              );
            } else {
              const fields = sheet.sections
                .flatMap((s) => s.fields)
                .filter((f) => ['number', 'resource', 'calculated'].includes(f.type))
                .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
              response = botCard(
                safe(sheet.name, 100),
                `${sheet.system ? safe(sheet.system, 100) + ' · ' : ''}Personagem ativo · \`!acoes\` para rolar · \`!skills\` para habilidades`,
                origin,
                {
                  path: '/ficha',
                  fields: fields.slice(0, 12).map((f) => ({
                    name: safe(f.label, 100),
                    inline: true,
                    value: String(
                      f.type === 'resource'
                        ? `${(f.value as { current: number; max: number }).current}/${(f.value as { current: number; max: number }).max}`
                        : (values[f.id] ?? f.value ?? '—'),
                    ),
                  })),
                  footer: `${sheet.skillTree?.skills.filter((s) => s.unlocked).length ?? 0} skills desbloqueadas${fields.length > 12 ? ' · Mais atributos no site' : ''} · Resposta pública`,
                },
              );
            }
          }
        }
      } catch (error) {
        response = /^!(r|roll|rolar)(?=\s|$)/i.test(message.content)
          ? formatRollError(error)
          : commandError(error, message.content, origin);
      }
      await message.reply(presentMessage(response, message.richAllowed));
    } finally {
      active.delete(message.userId);
    }
  };
}
