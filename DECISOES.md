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
- 2026-11-02: login e cadastro usam Manus OAuth, conforme o contrato padrão do Webdev. O mesmo botão inicia login ou criação de conta no provedor; o Inferus nunca recebe senha.
- 2026-11-02: usuários são identificados pelo `openId` do provedor e persistidos em `inferus_users`. Sessões são tokens aleatórios armazenados apenas por hash em `inferus_auth_sessions`, com cookie HttpOnly `webdev_app_session` de 30 dias.
- 2026-11-02: o callback OAuth exige nonce em cookie curto, `redirectUri` fixo e troca de código no servidor. O fluxo aceita também JWT HS256 válido fornecido pelo Preview, validando assinatura, expiração e `appId`.
- 2026-11-02: auditoria encontrou filtros sem abas para os modos `narrative` e `traits`; ambos foram adicionados, em vez de remover os presets.
- 2026-11-02: geração de árvore usa expansão por fronteira a partir de `centro`. Isso impede que o sorteio mostre uma skill cujo pré-requisito não esteja presente e evita um bloqueio permanente.

- 2026-11-02: nomes de mesa são apenas apresentação. Participações antigas só são vinculadas à conta mediante prova da sessão original; participações vinculadas exigem o `openId` autenticado.
- 2026-11-02: revogar convite afeta novas entradas, e não membros existentes. A remoção de membro invalida sessões e vínculo. As mutações MySQL bloqueiam a linha da campanha para serializar capacidade e permissões.
- 2026-11-02: fichas mantêm cópia local e sincronização explícita na conta. O salvamento mais recente substitui o documento remoto; não há mescla automática concorrente.
- 2026-11-02: custos e efeitos de árvore ainda não são aplicados na ficha; a interface deixa de afirmar que esses efeitos já foram aplicados.
- 2026-11-02: apenas /rolar é registrado no Discord. Comandos de ficha aguardam vínculo explícito Discord–Manus; configuração de credenciais e publicação são etapas externas.

- 2026-11-04: a pedido do proprietário, comandos Discord passam a mensagens públicas por prefixo (!rolar/!r/!ajuda). O runtime não registra slash; remoção seletiva dos registros antigos requer credencial válida. A hospedagem HTTP Sites permanece para o site, e a conexão Gateway exige um serviço contínuo separado com Message Content Intent.
- 2026-11-04: modificador fica junto dos valores dos dados; fórmulas repetidas são substituídas por descrição legível. Animações são breves e não atrasam ou alteram o resultado; som é opcional e compartilhado entre ficha e Dado Aberto.

- O proprietário escolheu manter a hospedagem atual e vincular Discord à conta existente. Códigos só pedem vínculo; o dono confirma o ID no site antes de liberar consultas. A ficha ativa é selecionada explicitamente. Não se coleta senha ou Bot Token em comandos.
- Personagens de campanha são cópias explícitas da ficha e árvore; dono edita, DM consulta e os demais recebem apenas identificação resumida. Revisões impedem sobrescrita silenciosa entre abas. Custos e efeitos continuam manuais.
- Toda alteração solicitada passa por revisão, verificações e correção de falhas observadas antes da entrega; limites de verificação e operações externas pendentes são informados.
