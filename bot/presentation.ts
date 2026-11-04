import type { DiscordMessage } from '../packages/discord-ui/index.js';
import { campaignStatusLabels } from '../packages/campaign-types/index.js';
import type { BotCampaignDetail } from './site-integration.js';
export const safe = (value: string, max = 160) =>
  value
    .slice(0, max)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/([\\`*_{}\[\]()<>~|])/g, '\\$1')
    .replace(/@/g, '@\u200b');
export function botCard(
  title: string,
  description: string,
  origin?: string,
  options: {
    fields?: { name: string; value: string; inline?: boolean }[];
    footer?: string;
    path?: string;
    label?: string;
    error?: boolean;
  } = {},
): DiscordMessage {
  let components: DiscordMessage['components'];
  try {
    const url = new URL(options.path ?? '/discord', origin);
    if (url.protocol === 'https:')
      components = [
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: options.label ?? 'Abrir no Inferus', url: url.href },
          ],
        },
      ];
  } catch {}
  return {
    embeds: [
      {
        title,
        description,
        color: options.error ? 0xdf8fa4 : 0xb79be7,
        fields: options.fields,
        footer: { text: options.footer ?? 'INFERUS · Resposta pública neste canal' },
      },
    ],
    components,
  };
}
export function pageOf<T>(items: T[], page: number, size = 5) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  if (page > pages)
    throw new Error(
      `Essa lista tem ${pages} ${pages === 1 ? 'página' : 'páginas'}. Use um número de 1 a ${pages}.`,
    );
  return {
    items: items.slice((page - 1) * size, page * size),
    footer: `Página ${page}/${pages} · ${items.length} no total · Resposta pública`,
  };
}
export function campaignCard(c: BotCampaignDetail, origin?: string, selected = false) {
  return botCard(
    `${selected ? 'Mesa selecionada' : 'Sua campanha'} · ${safe(c.name, 100)}`,
    `**${campaignStatusLabels[c.status]}** · ${c.participants.length}/10 participantes\nVocê participa como **${c.role === 'dm' ? 'mestre' : 'jogador'}**.`,
    origin,
    {
      path: `/campanhas?mesa=${encodeURIComponent(c.id)}`,
      label: 'Abrir esta campanha',
      fields: [
        {
          name: 'Seu personagem nesta mesa',
          value: c.character
            ? `${safe(c.character)}\n\`!ficha\` · \`!skills\` · \`!acoes\``
            : 'Vincule e salve uma ficha nesta campanha pelo site para usar as ações do personagem.',
        },
        {
          name: 'Continue a sessão',
          value:
            '`!mesa` participantes · `!diario` registros\n`!anotar texto` registra no diário' +
            (c.role === 'dm' ? '\n`!sessao iniciar` · `!sessao pausar` · `!sessao encerrar`' : ''),
        },
      ],
    },
  );
}
export function commandError(error: unknown, content: string, origin?: string) {
  const detail = error instanceof Error ? error.message : 'Tente novamente em instantes.';
  const campaign = /^!(campanha|campanhas|mesa|diario|diário|sessao|sessão|anotar)(?=\s|$)/i.test(
    content,
  );
  return botCard('Não foi possível concluir o comando', safe(detail, 500), origin, {
    error: true,
    fields: [
      {
        name: 'Próximo passo',
        value: campaign
          ? 'Use `!campanhas` para encontrar a mesa e `!ajuda campanhas` para consultar os comandos.'
          : /^!(acao|ação|acoes|ações)(?=\s|$)/i.test(content)
            ? 'Use `!acoes` para ver as ações do personagem ativo e `!login` para conferir seu vínculo.'
            : /^!ajuda(?=\s|$)/i.test(content)
              ? 'Consulte `!ajuda`, `!ajuda campanhas`, `!ajuda personagem` ou `!ajuda expressoes`.'
              : 'Use `!login` para conferir o vínculo e `!ajuda personagem` para consultar os comandos.',
      },
    ],
  });
}
