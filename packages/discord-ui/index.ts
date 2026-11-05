import { commandCatalog } from './commands.js';
import { parseExpression, type RollRecord } from '../dice-core/index.js';
export const diceExamples = [
  {
    id: 'teste',
    name: 'Teste simples',
    expression: '1d20+5',
    description: 'Um dado e um modificador para resolver uma ação.',
  },
  {
    id: 'vantagem',
    name: 'Vantagem',
    expression: '2d20kh1+5',
    description: 'Role dois d20 e mantenha o maior.',
  },
  {
    id: 'desvantagem',
    name: 'Desvantagem',
    expression: '2d20kl1+5',
    description: 'Role dois d20 e mantenha o menor.',
  },
  {
    id: 'dano',
    name: 'Dano',
    expression: '2d6+3',
    description: 'Some os dados e acrescente o bônus.',
  },
  {
    id: 'sucessos',
    name: 'Pool de sucessos',
    expression: '6d10>=8',
    description: 'Conte os dados que atingirem 8 ou mais.',
  },
  {
    id: 'explosivos',
    name: 'Dados explosivos',
    expression: '3d6!',
    description: 'Resultados máximos geram novas rolagens.',
  },
  {
    id: 'atributos',
    name: 'Atributos',
    expression: '4d6kh3',
    description: 'Role quatro d6 e mantenha os três maiores.',
  },
] as const;
export type HelpTopic = 'inicio' | 'expressoes' | 'privacidade' | 'personagem';
export const helpTopics = [
  { name: 'Primeiros passos', value: 'inicio' },
  { name: 'Seu personagem', value: 'personagem' },
  { name: 'Expressões e exemplos', value: 'expressoes' },
  { name: 'Privacidade e limites', value: 'privacidade' },
] as const;
export type DiscordEmbed = {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
};
export type DiscordText = { type: 10; id?: number; content: string };
export type DiscordSeparator = { type: 14; id?: number; spacing: 1; divider: true };
export type DiscordSection = {
  type: 9;
  id: 32;
  components: DiscordText[];
  accessory: { type: 11; id: 33; media: { url: string }; description: string };
};
export type DiscordContainer = {
  type: 17;
  id: 1;
  accent_color: number;
  components: (DiscordText | DiscordSeparator | DiscordSection)[];
};
export type DiscordActionRow = {
  type: 1;
  components: { type: 2; style: 5; label: string; url: string }[];
};
export type DiscordMessage = {
  /** Local presentation hint; stripped before sending a rich Discord payload. */
  fallbackContent?: string;
  content?: string;
  flags?: 32768;
  embeds?: DiscordEmbed[];
  components?: (DiscordActionRow | DiscordContainer)[];
};
export const ROLL_LEGEND = 'Destaque = mantido · riscado = descartado';
export type RollCardModel = {
  title: string;
  total: number;
  unit: string;
  expression: string;
  description: string;
  groups: {
    expression: string;
    label: string;
    dice: { total: number; kept: boolean; raw: number[]; omittedFaces: number }[];
    omitted: number;
    explosions: string;
  }[];
  omittedGroups: number;
  modifier: string;
  target?: number;
  passed?: boolean;
};
export function describeDice(expression: string) {
  const spec = parseExpression(expression);
  return spec.groups
    .map((g) => {
      const parts = [
        `${g.sign < 0 ? 'Subtrair ' : ''}${g.count} ${g.count === 1 ? 'dado' : 'dados'} de ${g.sides} lados`,
      ];
      if (g.explode) parts.push('explosivos');
      if (g.keepMode !== 'all') {
        const direction =
          g.keepMode === 'high'
            ? g.keepCount === 1
              ? 'o maior'
              : `os ${g.keepCount} maiores`
            : g.keepCount === 1
              ? 'o menor'
              : `os ${g.keepCount} menores`;
        parts.push(`manter ${direction}`);
      }
      if (g.successTarget !== undefined) parts.push(`sucesso em ${g.successTarget}+`);
      return parts.join(' · ');
    })
    .join(' / ');
}
export function rollCardModel(result: RollRecord, reason = ''): RollCardModel {
  return {
    title: reason.trim().slice(0, 80) || 'Rolagem de dados',
    total: result.total,
    unit: result.mode === 'success' ? (result.total === 1 ? 'sucesso' : 'sucessos') : '',
    expression: result.expression,
    description:
      result.groups.length === 1
        ? describeDice(result.expression)
        : `${result.groups.length} grupos de dados`,
    groups: result.groups.slice(0, 5).map((g) => {
      const dice = g.dice.slice(0, 20).map((d) => ({
        total: d.total,
        kept: d.kept,
        raw: d.raw.slice(0, 8),
        omittedFaces: Math.max(0, d.raw.length - 8),
      }));
      const explosions = dice
        .filter((d) => d.raw.length > 1)
        .map((d) => `${d.total} = ${d.raw.join(' + ')}${d.omittedFaces ? ' + …' : ''}`)
        .join('; ');
      return {
        expression: g.raw,
        label: describeDice(g.raw),
        dice,
        omitted: g.dice.length - dice.length,
        explosions: explosions.length > 160 ? `${explosions.slice(0, 155)}…` : explosions,
      };
    }),
    omittedGroups: Math.max(0, result.groups.length - 5),
    modifier: `${result.bonus >= 0 ? '+' : ''}${result.bonus}`,
    target: result.target,
    passed: result.passed,
  };
}
export function rollOptions(options: Record<string, unknown>) {
  if (
    typeof options.expressao !== 'string' ||
    options.expressao.length < 2 ||
    options.expressao.length > 160
  )
    throw new Error('Informe uma expressão de 2 a 160 caracteres, como 1d20+5.');
  parseExpression(options.expressao);
  if (
    options.alvo !== undefined &&
    (!Number.isInteger(options.alvo) || Number(options.alvo) < -50 || Number(options.alvo) > 1000)
  )
    throw new Error('O alvo deve ser um inteiro entre -50 e 1000.');
  if (options.privado !== undefined && typeof options.privado !== 'boolean')
    throw new Error('A opção privado deve ser verdadeira ou falsa.');
  if (
    options.motivo !== undefined &&
    (typeof options.motivo !== 'string' || options.motivo.length > 80)
  )
    throw new Error('Use um motivo de até 80 caracteres.');
  return {
    expression: options.expressao,
    target: options.alvo as number | undefined,
    private: options.privado === true,
    reason:
      typeof options.motivo === 'string'
        ? options.motivo.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
        : '',
  };
}
const escape = (s: string) => s.replace(/([\\`*_{}\[\]()<>~|])/g, '\\$1').replace(/@/g, '@\u200b');
function siteButton(origin?: string) {
  try {
    const url = new URL('/discord', origin);
    if (url.protocol !== 'https:') return {};
    return {
      components: [
        {
          type: 1 as const,
          components: [
            {
              type: 2 as const,
              style: 5 as const,
              label: 'Guia e exemplos no Inferus',
              url: url.href,
            },
          ],
        },
      ],
    };
  } catch {
    return {};
  }
}
export function formatRoll(result: RollRecord, reason = '', origin?: string): DiscordMessage {
  const card = rollCardModel(result, reason);
  const text = (id: number, content: string): DiscordText => ({ type: 10, id, content });
  const separator = (id: number): DiscordSeparator => ({ type: 14, id, spacing: 1, divider: true });
  const components: (DiscordText | DiscordSeparator | DiscordSection)[] = [
    text(2, `**${escape(card.title)}**`),
    text(3, `# ${card.total}${card.unit ? ` ${card.unit}` : ''}`),
    text(4, `-# ${card.description}`),
  ];
  card.groups.forEach((g, i) => {
    components.push(separator(5 + i));
    const dice = g.dice
      .map((d) =>
        d.kept
          ? `**\`${d.total}${d.raw.length > 1 ? '!' : ''}\`**`
          : `~~\`${d.total}${d.raw.length > 1 ? '!' : ''}\`~~`,
      )
      .join(' ');
    const omitted = g.omitted ? `\n… ${g.omitted} dados omitidos.` : '';
    components.push(
      text(
        10 + i,
        `${card.groups.length > 1 ? `-# ${g.label}\n\n` : ''}${dice}${i === card.groups.length - 1 && result.bonus !== 0 ? `  **${card.modifier}**` : ''}${omitted}${g.explosions ? `\n-# Explosões: ${g.explosions}` : ''}`,
      ),
    );
  });
  if (card.omittedGroups)
    components.push(
      text(25, `-# Mais ${card.omittedGroups} grupos omitidos para manter a leitura.`),
    );
  if (card.target !== undefined)
    components.push(
      separator(26),
      text(30, `Alvo ${card.target} · **${card.passed ? 'Passou' : 'Não atingiu'}**`),
    );
  components.push(text(31, `-# ${ROLL_LEGEND}`));
  try {
    const url = new URL('/assets/inferus-roll.gif', origin);
    if (url.protocol === 'https:') {
      url.searchParams.set('roll', result.roll_id);
      const header = components.splice(0, 3) as DiscordText[];
      components.unshift({
        type: 9,
        id: 32,
        components: header,
        accessory: {
          type: 11,
          id: 33,
          media: { url: url.href },
          description: 'Animação curta de um dado girando e parando.',
        },
      });
    }
  } catch {}
  return { flags: 32768, components: [{ type: 17, id: 1, accent_color: 0xb79be7, components }] };
}
/** One response for a bounded batch; each total remains independent. */
export function formatRollBatch(
  results: RollRecord[],
  reason = '',
  origin?: string,
): DiscordMessage {
  if (results.length < 1 || results.length > 10) throw new Error('Lote inválido.');
  const first = rollCardModel(results[0], reason);
  return {
    fallbackContent: [
      `**${escape(reason || 'Rolagens repetidas')}**`,
      `${results.length} rolagens independentes · ${first.description}`,
      ...results.map(
        (r, i) =>
          `${i + 1} · **${r.total}**${r.mode === 'success' ? ' sucessos' : ''}${r.target !== undefined ? ` · Alvo ${r.target} · ${r.passed ? 'Passou' : 'Não atingiu'}` : ''}`,
      ),
      'INFERUS · Todos os totais acima; detalhes dos dados exigem embeds.',
    ].join('\n'),
    embeds: [
      {
        title: escape(reason || 'Rolagens repetidas'),
        description: `${results.length} rolagens independentes · ${first.description}`,
        color: 0xb79be7,
        fields: results.map((r, i) => {
          const dice = r.groups.flatMap((g) =>
            g.dice.map((d) => ({ ...d, negative: g.raw.startsWith('-') })),
          );
          const shown = dice
            .slice(0, 10)
            .map((d) =>
              d.kept
                ? `**${d.negative ? '−' : ''}${d.total}**`
                : `~~${d.negative ? '−' : ''}${d.total}~~`,
            )
            .join(' · ');
          return {
            name: `${i + 1} · ${r.total}${r.mode === 'success' ? ' sucessos' : ''}${r.target !== undefined ? ` · Alvo ${r.target} · ${r.passed ? 'Passou' : 'Não atingiu'}` : ''}`,
            value:
              shown +
              (dice.length > 10 ? ' · …' : '') +
              (r.bonus ? ` · Bônus ${r.bonus > 0 ? '+' : ''}${r.bonus}` : ''),
          };
        }),
        footer: { text: 'INFERUS · Cada linha é uma jogada · Resposta pública' },
      },
    ],
    ...siteButton(origin),
  };
}
export function formatHelp(topic: unknown = 'inicio', origin?: string): DiscordMessage {
  const selected = helpTopics.some((t) => t.value === topic) ? topic : 'inicio';
  const fields =
    selected === 'personagem'
      ? commandCatalog
          .filter((c) => c.group === 'Personagem')
          .map((c) => ({ name: c.title, value: `\`${c.command}\`\n${c.description}` }))
      : selected === 'expressoes'
        ? [
            ...diceExamples,
            {
              name: 'Abreviações',
              expression: 'd20 · d% · 4d6k3 · 4d6d1',
              description: 'Um dado, percentual, manter maiores e descartar menor.',
            },
            {
              name: 'Repetições no bot',
              expression: '!r 6#4d6d1 | Atributos',
              description:
                'Seis resultados independentes; no máximo 10 repetições e 100 dados iniciais por lote.',
            },
          ].map((p) => ({
            name: p.name,
            value: `\`${p.expression}\` — ${p.description}`,
          }))
        : selected === 'privacidade'
          ? [
              {
                name: 'Só você',
                value:
                  'Comandos e resultados são públicos no canal. Use o rolador da ficha para uma jogada reservada.',
              },
              {
                name: 'No canal',
                value:
                  'Digite !rolar ou !r. O comando permanece na conversa e a resposta fica visível para a mesa. O bot processa apenas mensagens com seus comandos e não busca o histórico.',
              },
              {
                name: 'Limites de dados',
                value:
                  'De 1 a 40 dados por grupo, de 2 a 1000 lados e expressão de até 160 caracteres; 1–10 repetições e até 100 dados iniciais por lote. Bônus total entre -50 e +50.',
              },
              {
                name: 'Fichas e árvores',
                value:
                  'O bot não vincula contas sem confirmação. Use !login, confirme a identidade no site e escolha a ficha ativa para !ficha, !skills e !acao.',
              },
            ]
          : [
              {
                name: '1 · Faça sua primeira jogada',
                value:
                  '`!rolar 1d20+5`\nTambém aceita !r, !d e !dice. Envie como uma mensagem normal no canal.',
              },
              {
                name: '2 · Dê contexto',
                value:
                  'Exemplo: `!rolar 1d20+5 alvo:15 | Percepção`. Também aceita `!d d20+5 Percepção` sem separador.',
              },
              {
                name: '3 · Sua conta e seu personagem',
                value:
                  'Use !login para vincular a conta; depois !ficha, !skills ou !acao Nome da ação. Respostas e rolagens aparecem no canal.',
              },
              {
                name: 'Leia cada dado',
                value:
                  'Valores em destaque foram mantidos; valores riscados foram descartados. Explosões mostram a soma das faces.',
              },
            ];
  return {
    content: '',
    embeds: [
      {
        title: `Inferus · ${helpTopics.find((t) => t.value === selected)?.name}`,
        description: 'Sua mesa. Seus dados. Use !ajuda personagem para continuar.',
        color: 0xb79be7,
        fields,
        footer: { text: 'INFERUS · !ajuda personagem · !ajuda expressoes' },
      },
    ],
    ...siteButton(origin),
  };
}
export function formatRollError(error: unknown): DiscordMessage {
  const detail = error instanceof Error ? error.message : 'Tente novamente em alguns instantes.';
  return {
    content: `Não foi possível concluir a rolagem: ${escape(detail.slice(0, 350))}`,
    embeds: [
      {
        title: 'Vamos ajustar esta jogada',
        description:
          'Experimente `1d20+5`, `2d20kh1+5` ou `6d10>=8`.\nUse `!ajuda` para consultar exemplos e limites.',
        color: 0xdf8fa4,
      },
    ],
  };
}
export function expressionSuggestions(input: unknown) {
  const query =
    typeof input === 'string' ? input.slice(0, 160).trim().toLocaleLowerCase('pt-BR') : '';
  const suggestions = diceExamples
    .filter((p) => `${p.name} ${p.expression}`.toLocaleLowerCase('pt-BR').includes(query))
    .map((p) => ({ name: `${p.name} · ${p.expression}`, value: p.expression as string }));
  if (query && query.length <= 100) {
    try {
      parseExpression(query);
      if (!suggestions.some((s) => s.value === query))
        suggestions.unshift({ name: `Usar ${query}`, value: query });
    } catch {}
  }
  return suggestions.slice(0, 25);
}
export function embedsPermitted(permissions: unknown) {
  if (permissions === undefined) return true;
  if (typeof permissions !== 'string' || !/^\d{1,30}$/.test(permissions)) return false;
  return (BigInt(permissions) & (1n << 14n)) !== 0n;
}
export function presentMessage(message: DiscordMessage, rich = true): DiscordMessage {
  if (message.fallbackContent) {
    const { fallbackContent, ...payload } = message;
    return rich ? payload : { content: fallbackContent, components: message.components };
  }
  if (rich) return message;
  if (message.flags === 32768) {
    const blocks = (message.components ?? [])
      .filter((c): c is DiscordContainer => c.type === 17)
      .flatMap((c) => c.components)
      .flatMap((c) => (c.type === 9 ? c.components : [c]))
      .filter((c): c is DiscordText => c.type === 10);
    const summary = blocks.filter((c) => (c.id ?? 0) < 10 || (c.id ?? 0) >= 30),
      audit = blocks.filter((c) => (c.id ?? 0) >= 10 && (c.id ?? 0) < 30);
    const text = [...summary, ...audit].map((c) => c.content).join('\n\n');
    return {
      content:
        text.length > 1900
          ? `${text.slice(0, 1830)}\n… Mensagem abreviada para caber no Discord.`
          : text,
    };
  }
  if (!message.embeds?.length) return message;
  const blocks = [message.content];
  for (const embed of message.embeds) {
    blocks.push(`**${embed.title}**`, embed.description ?? '');
    for (const field of embed.fields ?? []) blocks.push(`**${field.name}**\n${field.value}`);
    if (embed.footer) blocks.push(embed.footer.text);
  }
  const text = blocks.filter(Boolean).join('\n\n');
  return {
    content:
      text.length > 1900
        ? `${text.slice(0, 1830)}\n… Mensagem abreviada para caber no Discord.`
        : text,
    components: message.components,
  };
}
