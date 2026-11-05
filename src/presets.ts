export type PresetField = { id: string; label: string; type: string; value: string };
export type RpgPreset = {
  id: string;
  name: string;
  description: string;
  mode: string;
  expression: string;
  tags: string[];
  fields: PresetField[];
  source: string;
};
export const RPG_PRESETS: RpgPreset[] = [
  {
    id: 'pool-dots',
    name: 'Pool por pontos',
    description:
      'Cada ponto relevante vira um dado. Conte sucessos; é visual, flexível e ótimo para começar.',
    mode: 'pool',
    expression: '4d10>=6',
    tags: ['pool de dados', 'sucessos', 'd10'],
    source:
      'Síntese original. Referência mecânica: https://www.paradoxinteractive.com/games/world-of-darkness/community/free-content',
    fields: [
      { id: 'fisico', label: 'Físico', type: 'number', value: '2' },
      { id: 'social', label: 'Social', type: 'number', value: '2' },
      { id: 'mental', label: 'Mental', type: 'number', value: '2' },
      { id: 'competencias', label: 'Competências', type: 'text', value: 'Escolha 2 destaques' },
    ],
  },
  {
    id: 'two-dice',
    name: 'Dois dados de atributo',
    description:
      'Escolha dois atributos, some os dados e compare com a dificuldade. Poucos campos, decisões claras.',
    mode: 'attribute-dice',
    expression: '1d8+1d8',
    tags: ['d6–d12', 'dois atributos', 'dificuldade'],
    source:
      'Síntese original. Referência mecânica: https://app.demiplane.com/nexus/fabulaultima/rule/attribute',
    fields: [
      { id: 'destreza', label: 'Destreza', type: 'die', value: 'd8' },
      { id: 'insight', label: 'Insight', type: 'die', value: 'd10' },
      { id: 'poder', label: 'Poder', type: 'die', value: 'd8' },
      { id: 'vontade', label: 'Vontade', type: 'die', value: 'd6' },
    ],
  },
  {
    id: 'ladder',
    name: 'Escada narrativa',
    description:
      'Em vez de dezenas de números, use uma escada curta e descrições que explicam quem o personagem é.',
    mode: 'narrative',
    expression: '1d20+2',
    tags: ['escada', 'aspectos', 'ficção primeiro'],
    source:
      'Síntese original. Referência mecânica: https://fate-srd.com/fate-core/taking-action-dice-ladder',
    fields: [
      {
        id: 'conceito',
        label: 'Conceito central',
        type: 'text',
        value: 'Uma frase que guia a personagem',
      },
      {
        id: 'complicacao',
        label: 'Complicação',
        type: 'text',
        value: 'Algo que sempre volta para cobrar',
      },
      { id: 'competencias', label: 'Competências', type: 'list', value: 'Médio, Bom, Ótimo' },
    ],
  },
  {
    id: 'position-effect',
    name: 'Ação, risco e efeito',
    description:
      'Comece pela intenção ficcional. A ficha pergunta qual é o risco e qual impacto você quer causar.',
    mode: 'fiction',
    expression: '1d6',
    tags: ['d6', 'posição', 'efeito'],
    source: 'Síntese original. Referência mecânica: https://bladesinthedark.com/action-roll',
    fields: [
      { id: 'acoes', label: 'Ações', type: 'text', value: 'Escolha 3 ações' },
      { id: 'posicao', label: 'Posição', type: 'choice', value: 'Arriscada' },
      { id: 'efeito', label: 'Efeito', type: 'choice', value: 'Padrão' },
      { id: 'custo', label: 'Custo ou estresse', type: 'number', value: '0' },
    ],
  },
  {
    id: 'd20-mod',
    name: 'Atributos contidos d20',
    description:
      'Seis atributos familiares e um teste direto. O preset mais rápido para quem quer começar sem configurar muito.',
    mode: 'd20',
    expression: '1d20+2',
    tags: ['d20', 'modificadores', 'vantagem'],
    source:
      'Síntese original. Referência mecânica: https://www.dndbeyond.com/sources/basic-rules/using-ability-scores',
    fields: [
      { id: 'forca', label: 'Força', type: 'number', value: '15' },
      { id: 'destreza', label: 'Destreza', type: 'number', value: '14' },
      { id: 'constituicao', label: 'Constituição', type: 'number', value: '13' },
      { id: 'inteligencia', label: 'Inteligência', type: 'number', value: '12' },
      { id: 'sabedoria', label: 'Sabedoria', type: 'number', value: '10' },
      { id: 'presenca', label: 'Presença', type: 'number', value: '8' },
    ],
  },
  {
    id: 'trait-pool',
    name: 'Pool modular de traços',
    description:
      'Cada traço entra com um tamanho de dado. A ficha cresce com a história, não com uma planilha enorme.',
    mode: 'traits',
    expression: '1d8+1d6',
    tags: ['pool modular', 'tamanhos de dado', 'traços'],
    source:
      'Síntese original. Referência mecânica: https://www.cortexrpg.com/compendium/explore-the-rules',
    fields: [
      { id: 'fisico', label: 'Físico', type: 'die', value: 'd8' },
      { id: 'mental', label: 'Mental', type: 'die', value: 'd6' },
      { id: 'social', label: 'Social', type: 'die', value: 'd4' },
      { id: 'distincao', label: 'Distinção narrativa', type: 'text', value: 'Uma frase marcante' },
    ],
  },
];
