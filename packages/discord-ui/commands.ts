/** Shared by the website and the bot so examples stay in sync. */
export const commandGroups = ['Todos', 'Dados', 'Personagem', 'Campanha', 'Conta'] as const;
export const commandCatalog = [
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
    group: 'Campanha',
    command: '!campanhas',
    title: 'Encontrar sua mesa',
    description: 'Lista suas campanhas e seus IDs. Aceita número de página.',
  },
  {
    group: 'Campanha',
    command: '!campanha usar Nome da campanha',
    title: 'Escolher campanha',
    description:
      'Use o nome completo ou ID. A ficha dessa campanha passa a ser seu personagem ativo.',
  },
  {
    group: 'Campanha',
    command: '!campanha',
    title: 'Resumo da mesa',
    description: 'Mostra a campanha selecionada, o estado da sessão e seu personagem.',
  },
  {
    group: 'Campanha',
    command: '!mesa',
    title: 'Ver participantes',
    description: 'Mostra jogadores e personagens da campanha selecionada.',
  },
  {
    group: 'Campanha',
    command: '!diario',
    title: 'Ler o diário',
    description: 'Publica os registros recentes no canal. Use !diario 2 para registros anteriores.',
  },
  {
    group: 'Campanha',
    command: '!anotar Encontramos a passagem secreta.',
    title: 'Registrar na campanha',
    description: 'Salva uma mensagem no diário, com seu nome de mesa. Até 300 caracteres.',
  },
  {
    group: 'Campanha',
    command: '!sessao iniciar',
    title: 'Controlar a sessão',
    description:
      'Só o mestre. Aceita iniciar, pausar, retomar ou encerrar. Encerrar mantém os dados e permite reabrir.',
  },
  {
    group: 'Conta',
    command: '!login',
    title: 'Conectar sua conta',
    description: 'Abre o vínculo confirmado no site. Depois use !vincular com o código temporário.',
  },
  {
    group: 'Conta',
    command: '!ajuda campanhas',
    title: 'Ajuda por assunto',
    description: 'Também aceita personagem, expressoes e privacidade.',
  },
] as const;
