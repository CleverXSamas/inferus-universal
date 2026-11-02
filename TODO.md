# Entregas

- [x] Rolador auditável com som opcional, histórico e presets.
- [x] Ficha com onboarding por preset, seis filosofias de RPG e possibilidade de trocar/adicionar mecânicas.
- [x] Skill tree radial começando no centro e expandindo para todas as direções após compras.
- [x] Criador guiado de árvore universal com nó customizado conectado ao centro.
- [x] Fontes e créditos separados, com presets rotulados como sínteses originais não oficiais.
- [x] Fase 0: monorepo TypeScript, configuração, rotas, README, decisões e changelog.
- [x] Fase 1: dice-core com parser, rolagem criptográfica, auditoria, recalcular, presets, histórico, API e adaptador Discord.
- [x] Fase 2: ficha configurável com tipos, limites, fórmulas próprias, ciclo/referência/divisão por zero e ações.
- [x] Fase 3: árvore DAG com seed determinística, validação, preview, compra atômica/idempotente e efeitos.
- [x] Fase 4: duelo real, acessibilidade, movimento reduzido, desempenho demonstrável e documentação.
- [ ] Credenciais externas: registrar aplicação Discord, OAuth2, token do bot e produção persistente SQLite/PostgreSQL.
- [ ] Adicionar funções `floor`, `ceil`, `min`, `max` e `abs` ao parser de fórmulas.
- [ ] Rodar suíte estatística de 10^6 amostras em job separado de CI.

## Princípio de extensibilidade

Todo preset deve ser duplicável, editável e abandonável. Nenhum preset pode bloquear um campo, dado, recurso, tipo de nó ou regra nova criada pelo usuário.
