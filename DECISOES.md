# Decisões

- 2026-11-02: implementado um motor próprio, sem copiar código do repositório Dado Aberto, pois a referência não declara licença. Regras confirmadas: explosão até 64 níveis, máximo de 40 dados por grupo e sucesso separado de soma.
- 2026-11-02: `kh/kl/dh/dl` exige N e rejeita N fora do intervalo do grupo; não há `>N`.
- 2026-11-02: na rolagem real, dados extras herdam explosão e não recebem keep/drop; a interface permite até 6 extras.
- 2026-11-02: fichas e histórico do demo ficam no navegador para permitir execução sem credenciais; a API mantém o mesmo contrato e deve ser ligada ao SQLite antes de produção.
- 2026-11-02: o bot Discord é um adaptador HTTP isolado. Sem `DISCORD_TOKEN` e OAuth configurados, não é possível alegar integração publicada.
- 2026-11-02: consumo de nós desligado por padrão e moeda padrão `Fragmentos`.
