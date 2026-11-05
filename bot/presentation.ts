import type { DiscordMessage } from '../packages/discord-ui/index.js';
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
export function commandError(error: unknown, content: string, origin?: string) {
  const detail = error instanceof Error ? error.message : 'Tente novamente em instantes.';
  return botCard('Não foi possível concluir o comando', safe(detail, 500), origin, {
    error: true,
    fields: [
      {
        name: 'Próximo passo',
        value: /^!(acao|ação|acoes|ações)(?=\s|$)/i.test(content)
          ? 'Use `!acoes` para ver as ações do personagem ativo e `!login` para conferir seu vínculo.'
          : /^!ajuda(?=\s|$)/i.test(content)
            ? 'Consulte `!ajuda`, `!ajuda personagem` ou `!ajuda expressoes`.'
            : 'Use `!login` para conferir o vínculo e `!ajuda personagem` para consultar os comandos.',
      },
    ],
  });
}
