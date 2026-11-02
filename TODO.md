# Entregas

- [x] Rolador auditável com som opcional, histórico e presets.
- [x] Ficha com onboarding por preset, seis filosofias de RPG e possibilidade de trocar/adicionar mecânicas.
- [x] Skill tree radial começando no centro e expandindo para todas as direções após compras.
- [x] Criador guiado de árvore universal com nó customizado conectado ao centro.
- [x] Fontes e créditos separados, com presets rotulados como sínteses originais não oficiais.
- [x] Fase 0: monorepo TypeScript, configuração, rotas, README, decisões e changelog.
- [x] Fase 1: dice-core com parser, rolagem criptográfica, auditoria, recalcular, presets, histórico, API e adaptador Discord.
- [x] Fase 2: ficha configurável com tipos, limites, fórmulas próprias, ciclo/referência/divisão por zero e ações.
- [x] Fase 3: árvore DAG com seed determinística, validação, preview, compra idempotente e efeitos.
- [x] Fase 4: interface acessível, movimento reduzido, som local e desempenho demonstrável.
- [x] Fase 5: remover Duelo e entregar Campanha privada com 1 DM + até 9 jogadores, convite por token, papéis no servidor, sala, status, diário e limite rígido de 10.
- [x] Persistir campanhas, participantes e eventos quando `DATABASE_URL` estiver configurado; declarar fallback de memória no health endpoint.
- [x] Atualizar a sala por polling cancelável, limitar nome/mensagem e evitar token em listagens.
- [x] Login/cadastro com Manus OAuth, nonce de callback, sessão HttpOnly de 30 dias, tabelas MySQL de usuários e sessões e suporte a login em outros dispositivos.
- [x] Corrigir filtros de preset e a demonstração da skill tree: seleção inicial, estados bloqueado/disponível, layout radial estável e geração sem nós órfãos.
- [ ] Associar campanhas e fichas ao `openId` autenticado e permitir gestão de membros por conta, além do convite privado.
- [ ] Token Discord, OAuth2, URL pública e publicação do bot.
- [ ] Adicionar funções `floor`, `ceil`, `min`, `max` e `abs` ao parser de fórmulas.
- [ ] Rodar suíte estatística de 10^6 amostras em job separado de CI.

## Princípio de extensibilidade

Todo preset deve ser duplicável, editável e abandonável. Nenhum preset pode bloquear um campo, dado, recurso, tipo de nó ou regra nova criada pelo usuário.
