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
export type HelpTopic = 'inicio' | 'expressoes' | 'privacidade';
export const helpTopics = [
  { name: 'Primeiros passos', value: 'inicio' },
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
export type DiscordMessage = {
  content: string;
  embeds?: DiscordEmbed[];
  components?: { type: 1; components: { type: 2; style: 5; label: string; url: string }[] }[];
};
export function rollOptions(options: Record<string, unknown>) {
  if (
    typeof options.expressao !== 'string' ||
    options.expressao.length < 3 ||
    options.expressao.length > 160
  )
    throw new Error('Informe uma expressão de 3 a 160 caracteres, como 1d20+5.');
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
  const shown = result.groups.slice(0, 5);
  const fields: NonNullable<DiscordEmbed['fields']> = shown.map((g, i) => {
    const tokens = g.dice.map((d) => {
      const raw =
        d.raw.length > 1 ? ` (${d.raw.slice(0, 8).join('+')}${d.raw.length > 8 ? '+…' : ''})` : '';
      const text = `${d.total}${raw}`;
      return d.kept ? `**${text}**` : `~~${text}~~`;
    });
    const kept: string[] = [];
    let length = 0;
    for (const token of tokens) {
      if (length + token.length > 720) break;
      kept.push(token);
      length += token.length + 3;
    }
    const more =
      kept.length < tokens.length ? `\n… ${tokens.length - kept.length} dados omitidos.` : '';
    return {
      name: `${g.raw} · grupo ${i + 1}`,
      value: `${kept.join(' · ')}${more}\n${result.mode === 'success' ? 'Sucessos' : 'Subtotal'}: **${g.subtotal}**`,
      inline: false,
    };
  });
  if (result.groups.length > shown.length)
    fields.push({
      name: 'Auditoria resumida',
      value: `Mais ${result.groups.length - shown.length} grupos não exibidos para manter a mensagem legível.`,
    });
  fields.push({
    name: 'Modificador',
    value: `${result.bonus >= 0 ? '+' : ''}${result.bonus}`,
    inline: true,
  });
  if (result.target !== undefined)
    fields.push({
      name: `Alvo ${result.target}`,
      value: result.passed ? 'Passou ✓' : 'Não atingiu o alvo',
      inline: true,
    });
  return {
    content: '',
    embeds: [
      {
        title: `${result.total}${result.mode === 'success' ? ' sucessos' : ' · resultado'}`,
        description: `${reason ? `**${escape(reason.slice(0, 80))}**\n` : ''}\`${result.expression}\``,
        color: result.passed === undefined ? 0xb79be7 : result.passed ? 0x81bba4 : 0xdf8fa4,
        fields,
        footer: { text: `INFERUS · ${result.roll_id} · riscados = descartados` },
        timestamp: result.created_at,
      },
    ],
    ...siteButton(origin),
  };
}
export function formatHelp(topic: unknown = 'inicio', origin?: string): DiscordMessage {
  const selected = helpTopics.some((t) => t.value === topic) ? topic : 'inicio';
  const fields =
    selected === 'expressoes'
      ? diceExamples
          .slice(0, 6)
          .map((p) => ({ name: p.name, value: `\`${p.expression}\` — ${p.description}` }))
      : selected === 'privacidade'
        ? [
            {
              name: 'Só você',
              value: 'Use `privado:true` em /rolar. A ajuda e os erros de expressão são privados.',
            },
            {
              name: 'No canal',
              value:
                'Sem a opção privado, o resultado aparece para a mesa. O Inferus não lê o histórico da conversa.',
            },
            {
              name: 'Limites de dados',
              value:
                'De 1 a 40 dados por grupo, de 2 a 1000 lados e expressão de até 160 caracteres. Bônus total entre -50 e +50.',
            },
            {
              name: 'Fichas e árvores',
              value:
                'Use o site para editar personagens e skills. Esta versão do bot não vincula automaticamente fichas à sua conta Discord.',
            },
          ]
        : [
            {
              name: '1 · Faça sua primeira jogada',
              value:
                '`/rolar expressao:1d20+5`\nDigite a expressão ou escolha uma sugestão no menu.',
            },
            {
              name: '2 · Dê contexto',
              value:
                'Use `motivo` para nomear a jogada e `alvo` para comparar o total com uma dificuldade.',
            },
            {
              name: '3 · Escolha quem vê',
              value:
                'Use `privado:true` para receber a rolagem só para você. O padrão é mostrar no canal.',
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
        description: 'Sua mesa. Seus dados. Um caminho claro para a próxima jogada.',
        color: 0xb79be7,
        fields,
        footer: { text: 'INFERUS UNIVERSAL · /ajuda topico:expressoes para mais exemplos' },
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
          'Experimente `1d20+5`, `2d20kh1+5` ou `6d10>=8`.\nUse `/ajuda` para consultar exemplos e limites.',
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
  if (rich || !message.embeds?.length) return message;
  const blocks = [message.content];
  for (const embed of message.embeds) {
    blocks.push(`**${embed.title}**`, embed.description ?? '');
    const fields = embed.fields ?? [];
    const summary = fields.filter((f) => !f.name.includes(' · grupo ')),
      audit = fields.filter((f) => f.name.includes(' · grupo '));
    for (const field of [...summary, ...audit]) blocks.push(`**${field.name}**\n${field.value}`);
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
