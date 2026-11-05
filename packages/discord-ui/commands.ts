/** Shared by the website and the bot so examples stay in sync. */
export const commandGroups = ['Todos', 'Dados', 'Personagem', 'Conta'] as const;
export const commandCatalog = [
  {
    group: 'Personagem',
    command: '!fichas',
    title: 'Encontrar suas fichas',
    description: 'Lista as fichas salvas na conta. Aceita número de página.',
  },
  {
    group: 'Personagem',
    command: '!ficha usar Nome completo',
    title: 'Escolher personagem',
    description: 'Troque de ficha pelo nome completo ou pelo ID exibido em !fichas.',
  },
  {
    group: 'Dados',
    command: '!d d20+5 Percepção',
    title: 'Rolar com atalho',
    description:
      '!d, !dice, !r e !rolar fazem a mesma jogada. O título pode vir depois da expressão.',
  },
  {
    group: 'Dados',
    command: '!r 6#4d6d1 | Atributos',
    title: 'Repetir uma jogada',
    description:
      'Cada linha é um resultado independente. Até 10 repetições e 100 dados iniciais por lote.',
  },
  {
    group: 'Dados',
    command: '!d d%',
    title: 'Rolar percentual',
    description: 'd% equivale a 1d100. d20 equivale a 1d20; 4d6k3 mantém os três maiores.',
  },
  {
    group: 'Conta',
    command: '!ping',
    title: 'Verificar se o bot responde',
    description:
      'Confirma o processo no canal. Para conferir a ficha e o vínculo com o site, use !ficha.',
  },
  {
    group: 'Dados',
    command: '!rolar 1d20+5 alvo:15 | Percepção',
    title: 'Rolar com contexto',
    description: 'Alvo e título são opcionais. Também aceita !r, !d e !dice.',
  },
  {
    group: 'Personagem',
    command: '!ficha',
    title: 'Consultar personagem',
    description: 'Resumo dos atributos e recursos da ficha ativa.',
  },
  {
    group: 'Personagem',
    command: '!acoes',
    title: 'Encontrar uma ação',
    description:
      'Lista as ações da ficha e o comando exato para rolar. Use !acoes 2 para a próxima página.',
  },
  {
    group: 'Personagem',
    command: '!acao Ataque alvo:15',
    title: 'Rolar uma ação',
    description: 'Usa os valores salvos do personagem ativo; o alvo é opcional.',
  },
  {
    group: 'Personagem',
    command: '!skills',
    title: 'Ver habilidades',
    description: 'Mostra as skills desbloqueadas. Use !skills 2 para continuar.',
  },
  {
    group: 'Conta',
    command: '!login',
    title: 'Conectar sua conta',
    description: 'Abre o vínculo confirmado no site. Depois use !vincular com o código temporário.',
  },
  {
    group: 'Conta',
    command: '!ajuda personagem',
    title: 'Ajuda por assunto',
    description: 'Também aceita expressoes e privacidade.',
  },
] as const;
