export const commandDefinitions = [
  {
    name: 'rolar',
    description: 'Rola dados auditáveis no Inferus',
    options: [
      {
        name: 'expressao',
        description: 'Ex.: 2d20kh1+5 ou 6d10>=8',
        type: 3,
        required: true,
        max_length: 160,
      },
      {
        name: 'alvo',
        description: 'Alvo opcional',
        type: 4,
        required: false,
        min_value: -50,
        max_value: 1000,
      },
      { name: 'privado', description: 'Visível apenas para você', type: 5, required: false },
    ],
  },
];
