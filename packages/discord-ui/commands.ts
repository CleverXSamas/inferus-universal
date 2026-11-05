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
    command: '!rolar 1d20+5 alvo:15 | Percepção',
    title: 'Rolar com contexto',
    description: 'Alvo e título são opcionais. Também aceita !r.',
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
