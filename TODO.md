# Entregas

- [x] Fase 0: monorepo TypeScript, configuração, lint/check, rotas, README, decisões e changelog.
- [x] Fase 1: dice-core com parser em português, rolagem criptográfica, auditoria, recalcular, presets, histórico, API e adaptador Discord.
- [x] Fase 2: ficha configurável com tipos, limites, fórmulas próprias, ciclo/referência/divisão por zero e ações.
- [x] Fase 3: árvore DAG com seed determinística, validação, preview, compra atômica/idempotente e efeitos.
- [x] Fase 4: duelo real, acessibilidade, movimento reduzido, desempenho demonstrável e documentação.
- [ ] Credenciais externas: registrar aplicação Discord, OAuth2, token do bot e produção persistente SQLite/PostgreSQL.

## Critérios preservados
Nenhuma rolagem real usa Math.random; fórmulas não executam código arbitrário; compras usam chave idempotente; cor não é o único indicador; textos visíveis são em português; fichas são privadas no contrato da API; respostas de bot têm adaptador de defer/erro, aguardando credenciais.
