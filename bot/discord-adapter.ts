import { evaluateSheet, resolveActionExpression } from '../packages/sheet-engine/index.js';
import { botCard, campaignCard, commandError, pageOf, safe } from './presentation.js';
import { campaignStatusLabels } from '../packages/campaign-types/index.js';
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
  | { kind: 'login' | 'sheet' | 'roster' }
  | { kind: 'skills' | 'campaigns' | 'actions' | 'diary'; page: number }
  | { kind: 'campaign'; query?: string }
  | { kind: 'session'; status: 'active' | 'paused' | 'closed' }
  | { kind: 'note'; text: string }
  | { kind: 'pair'; code: string }
  | { kind: 'action'; name: string; target?: number }
  | { kind: 'roll'; expression: string; target?: number; reason: string };
export function parsePrefixCommand(content: string): PrefixCommand | null {
  const match = content.match(
    /^!(rolar|roll|r|ajuda|login|vincular|ficha|skills|campanhas|campanha|mesa|diario|diário|sessao|sessão|anotar|acoes|ações|acao|ação)(?=\s|$)\s*([\s\S]*)$/i,
  );
  if (!match) return null;
  if (content.length > 350) throw new Error('Use um comando de até 350 caracteres.');
  const verb = match[1].toLocaleLowerCase('pt-BR');
  const simple: Record<string, 'login' | 'sheet' | 'roster'> = {
    login: 'login',
    ficha: 'sheet',
    mesa: 'roster',
  };
  const paged: Record<string, 'skills' | 'campaigns' | 'actions' | 'diary'> = {
    skills: 'skills',
    campanhas: 'campaigns',
    acoes: 'actions',
    ações: 'actions',
    diario: 'diary',
    diário: 'diary',
  };
  if (paged[verb]) {
    const input = match[2].trim();
    if (input && !/^[1-9]\d{0,3}$/.test(input))
      throw new Error(`Use !${verb} ou !${verb} 2 para mudar de página.`);
    return { kind: paged[verb], page: input ? Number(input) : 1 };
  }
  if (verb === 'campanha') {
    const arg = match[2].trim();
    if (!arg) return { kind: 'campaign' };
    const query = arg.match(/^usar\s+(.+)$/i)?.[1].trim();
    if (!query || query.length > 100)
      throw new Error(
        'Use !campanha para consultar ou !campanha usar Nome da campanha para escolher.',
      );
    return { kind: 'campaign', query };
  }
  if (verb === 'sessao' || verb === 'sessão') {
    const statuses = {
      iniciar: 'active',
      retomar: 'active',
      pausar: 'paused',
      encerrar: 'closed',
    } as const;
    const action = match[2].trim().toLocaleLowerCase('pt-BR');
    if (!Object.hasOwn(statuses, action))
      throw new Error(
        'Use !sessao iniciar, pausar, retomar ou encerrar. Apenas o mestre pode alterar a sessão.',
      );
    return { kind: 'session', status: statuses[action as keyof typeof statuses] };
  }
  if (verb === 'anotar') {
    const text = match[2].trim();
    if (!text || text.length > 300)
      throw new Error('Use !anotar seguido de uma mensagem de até 300 caracteres.');
    return { kind: 'note', text };
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
    if (!['inicio', 'expressoes', 'privacidade', 'campanhas', 'personagem'].includes(topic))
      throw new Error(
        'Use !ajuda, !ajuda campanhas, !ajuda personagem, !ajuda expressoes ou !ajuda privacidade.',
      );
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
      !/^!(rolar|roll|r|ajuda|login|vincular|ficha|skills|campanhas|campanha|mesa|diario|diário|sessao|sessão|anotar|acoes|ações|acao|ação)(?=\s|$)/i.test(
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
            '1. Abra a página Discord do site e entre na conta.\n2. Gere o código e envie `!vincular CÓDIGO`.\n3. Confirme seu nome e ID no site.\n4. Escolha uma ficha ou use `!campanha usar Nome da campanha`.',
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
          } else if (command.kind === 'campaigns') {
            const list = await site.campaigns(message.userId);
            const page = pageOf(list, command.page);
            response = botCard(
              'Suas campanhas',
              list.length
                ? 'Escolha com `!campanha usar Nome da campanha` ou use o ID. A seleção é pessoal e vale também para sua ficha no bot.'
                : 'Você ainda não participa de uma campanha. Crie uma mesa no site ou entre pelo convite do mestre.',
              origin,
              {
                path: '/campanhas',
                footer:
                  page.footer +
                  (command.page * 5 < list.length ? ` · !campanhas ${command.page + 1}` : ''),
                fields: page.items.map((c) => ({
                  name: `${c.selected ? '◆ ' : ''}${safe(c.name, 100)}`,
                  value: `${campaignStatusLabels[c.status]} · ${c.participants}/10 · ${c.role === 'dm' ? 'Mestre' : 'Jogador'}\n${c.character ? safe(c.character) : 'Sem personagem vinculado'}\nID: \`${c.id}\``,
                })),
              },
            );
          } else if (command.kind === 'note') {
            const result = await site.note(message.userId, command.text);
            response = botCard('Registro salvo no diário', safe(command.text, 300), origin, {
              path: '/campanhas',
              footer: `${safe(result.name, 100)} · !diario para consultar`,
            });
          } else if (['campaign', 'session', 'roster', 'diary'].includes(command.kind)) {
            const c =
              command.kind === 'session'
                ? await site.session(message.userId, command.status)
                : await site.campaign(
                    message.userId,
                    command.kind === 'campaign' ? command.query : undefined,
                  );
            if (command.kind === 'roster') {
              response = botCard(
                `À mesa · ${safe(c.name, 100)}`,
                `${campaignStatusLabels[c.status]} · ${c.participants.length}/10 participantes`,
                origin,
                {
                  path: `/campanhas?mesa=${encodeURIComponent(c.id)}`,
                  fields: c.participants.map((p) => ({
                    name: `${safe(p.name, 60)}${p.self ? ' · você' : ''}`,
                    value: `${p.role === 'dm' ? 'Mestre' : 'Jogador'} · ${p.character ? safe(p.character) : 'Sem personagem vinculado'}`,
                  })),
                },
              );
            } else if (command.kind === 'diary') {
              const page = pageOf([...c.events].reverse(), command.page, 3);
              response = botCard(
                `Diário · ${safe(c.name, 100)}`,
                'Registros mais recentes primeiro. Use `!anotar texto` para registrar na mesa.',
                origin,
                {
                  path: `/campanhas?mesa=${encodeURIComponent(c.id)}`,
                  footer:
                    page.footer +
                    (command.page * 3 < c.events.length ? ` · !diario ${command.page + 1}` : ''),
                  fields: page.items.map((e) => ({
                    name: safe(e.author, 60),
                    value: `${safe(e.body, 480)}\n<t:${Math.floor(Date.parse(e.createdAt) / 1000)}:f>`,
                  })),
                },
              );
            } else
              response = campaignCard(c, origin, command.kind === 'campaign' && !!command.query);
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
                  ? 'Habilidades desbloqueadas do personagem ativo. Custos e efeitos são aplicados manualmente na ficha.'
                  : 'Nenhuma habilidade desbloqueada ainda. Abra a árvore deste personagem no site.',
                origin,
                {
                  footer:
                    page.footer +
                    (command.page * 5 < skills.length ? ` · !skills ${command.page + 1}` : ''),
                  fields: page.items.map((s) => ({
                    name: safe(s.name, 100),
                    value: 'Desbloqueada',
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
                .filter((f) => ['number', 'resource', 'calculated'].includes(f.type));
              response = botCard(
                safe(sheet.name, 100),
                'Personagem ativo · `!acoes` para rolar · `!skills` para habilidades',
                origin,
                {
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
