import { helpTopics } from '../discord-ui/index.js';
export const commandDefinitions = [
  {
    name: 'rolar',
    description: 'Role dados, veja cada resultado e compartilhe com a mesa',
    options: [
      {
        name: 'expressao',
        description: 'Digite os dados ou escolha um exemplo: 1d20+5, 2d20kh1+5, 6d10>=8',
        type: 3,
        required: true,
        min_length: 3,
        max_length: 160,
        autocomplete: true,
      },
      {
        name: 'alvo',
        description: 'Compare o resultado com esta dificuldade',
        type: 4,
        required: false,
        min_value: -50,
        max_value: 1000,
      },
      {
        name: 'privado',
        description: 'Só você vê o resultado (padrão: visível no canal)',
        type: 5,
        required: false,
      },
      {
        name: 'motivo',
        description: 'Dê um nome à jogada, como Teste de percepção',
        type: 3,
        required: false,
        max_length: 80,
      },
    ],
  },
  {
    name: 'ajuda',
    description: 'Aprenda a usar o Inferus sem sair do Discord',
    options: [
      {
        name: 'topico',
        description: 'O que você quer consultar?',
        type: 3,
        required: false,
        choices: helpTopics.map((t) => ({ ...t })),
      },
    ],
  },
];
