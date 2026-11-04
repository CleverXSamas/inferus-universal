import { evaluateSheet, resolveActionExpression } from '../packages/sheet-engine/index.js';
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
  | { kind: 'login' | 'sheet' | 'skills' | 'campaigns' }
  | { kind: 'pair'; code: string }
  | { kind: 'action'; name: string; target?: number }
  | { kind: 'roll'; expression: string; target?: number; reason: string };
export function parsePrefixCommand(content: string): PrefixCommand | null {
  const match = content.match(
    /^!(rolar|roll|r|ajuda|login|vincular|ficha|skills|campanhas|acao|ação)(?=\s|$)\s*([\s\S]*)$/i,
  );
  if (!match) return null;
  if (content.length > 350) throw new Error('Use um comando de até 350 caracteres.');
  const verb = match[1].toLocaleLowerCase('pt-BR');
  const simple: Record<string, 'login' | 'sheet' | 'skills' | 'campaigns'> = {
    login: 'login',
    ficha: 'sheet',
    skills: 'skills',
    campanhas: 'campaigns',
  };
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
      !/^!(rolar|roll|r|ajuda|login|vincular|ficha|skills|campanhas|acao|ação)(?=\s|$)/i.test(
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
        const safe = (value: string) =>
          value
            .slice(0, 160)
            .replace(/([\\`*_{}\[\]()<>~|])/g, '\\$1')
            .replace(/@/g, '@\u200b');
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
          response = {
            content: `Entre na sua conta do Inferus em ${new URL('/discord', origin).href}. Gere um código, envie !vincular CÓDIGO e confirme sua identidade no site. Depois escolha o personagem ativo. Nunca envie senha ou Bot Token.`,
          };
        else {
          if (!site)
            throw new Error('A integração com o site não está configurada no serviço do bot.');
          if (command.kind === 'pair') {
            await site.pair(message.userId, command.code, message.displayName ?? message.userId);
            response = {
              content:
                'Pedido enviado. Confirme sua identidade na página Discord do Inferus e escolha o personagem ativo. Nenhuma ficha foi liberada antes dessa confirmação.',
            };
          } else if (command.kind === 'campaigns') {
            const list = await site.campaigns(message.userId);
            response = {
              content: list.length
                ? `**Suas campanhas**\n${list
                    .slice(0, 10)
                    .map(
                      (c) =>
                        `• ${safe(c.name)} · ${campaignStatusLabels[c.status]} · ${c.participants}/10`,
                    )
                    .join('\n')}${list.length > 10 ? '\nVeja as demais no site.' : ''}`
                : 'Sua conta ainda não participa de campanhas no site.',
            };
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
                    : 'Ação não encontrada na ficha ativa. Confira seu nome no site.',
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
              response = {
                content: `**Skills de ${safe(sheet.name)}**\n${
                  skills.length
                    ? skills
                        .slice(0, 10)
                        .map((s) => `• ${safe(s.name)}`)
                        .join('\n')
                    : 'Nenhuma skill desbloqueada ainda.'
                }${skills.length > 10 ? '\nVeja as demais na árvore do site.' : ''}`,
              };
            } else {
              const fields = sheet.sections
                .flatMap((s) => s.fields)
                .filter((f) => ['number', 'resource', 'calculated'].includes(f.type))
                .slice(0, 6);
              response = {
                content: `**${safe(sheet.name)}**\n${fields.map((f) => `• ${safe(f.label)}: ${f.type === 'resource' ? `${(f.value as { current: number; max: number }).current}/${(f.value as { current: number; max: number }).max}` : (values[f.id] ?? f.value ?? '—')}`).join('\n')}\n${sheet.skillTree?.skills.filter((s) => s.unlocked).length ?? 0} skills desbloqueadas · Use !skills ou !acao Nome da ação.`,
              };
            }
          }
        }
      } catch (error) {
        response = formatRollError(error);
      }
      await message.reply(presentMessage(response, message.richAllowed));
    } finally {
      active.delete(message.userId);
    }
  };
}
