# Decisões

- 2026-11-02: implementado um motor próprio, sem copiar código do repositório Dado Aberto, pois a referência não declara licença. Regras confirmadas: explosão até 64 níveis, máximo de 40 dados por grupo e sucesso separado de soma.
- 2026-11-02: `kh/kl/dh/dl` exige N e rejeita N fora do intervalo do grupo; não há `>N`.
- 2026-11-02: fichas e histórico do demo ficam no navegador para permitir execução sem credenciais; a API mantém o mesmo contrato e pode receber persistência.
- 2026-11-02: presets de Vampire, Fabula Ultima, Fate, Blades, D&D e Cortex são sínteses originais, não oficiais. Fontes e caveats ficam visíveis na área de créditos.
- 2026-11-02: preset nunca é molde fechado. O usuário pode trocar de preset, editar seções, adicionar campos e criar skills próprias.
- 2026-11-02: a árvore visual é radial: o nó centro fica fixo e os nós se distribuem por camadas/direções; conexões entre nós comprados acendem.
- 2026-11-02: o som é sintetizado com Web Audio API no gesto de rolagem e pode ser desligado por sessão.
- 2026-11-02: Duelo foi removido para abrir espaço à Campanha, que atende melhor ao objetivo de jogo em mesa.
- 2026-11-02: Campanha aceita 1 DM + 9 jogadores, usa convite com token aleatório e valida papel no servidor. O convite é capacidade privada, não autenticação forte de identidade.
- 2026-11-02: armazenamento MySQL é usado quando `DATABASE_URL` existe; sem banco, o modo memória é explicitamente reportado no health endpoint e é apenas desenvolvimento.
- 2026-11-02: a sala usa polling cancelável em vez de WebSocket nesta fase, reduzindo infraestrutura enquanto mantém sincronização suficiente para até 10 pessoas.
