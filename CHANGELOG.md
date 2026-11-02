# Changelog

## 1.2.0 — 2026-11-02
- Duelo removido da navegação e substituído por Campanha.
- Campanha privada para 1 DM + até 9 jogadores.
- Convite por token aleatório, entrada idempotente por nome, papéis verificados no servidor e limite rígido de 10 participantes.
- Sala com roster, status de lobby/ativa/pausada/encerrada, diário de mensagens e polling cancelável.
- Persistência MySQL opcional com tabelas criadas de forma idempotente; fallback de memória declarado no health endpoint.
- Marca visual refinada para Inferus Universal e rota direta `/campaign/:token`.

## 1.1.0 — 2026-11-02
- Presets beginner-friendly de seis filosofias de RPG, com fontes e créditos separados.
- Presets agora são pontos de partida editáveis; ficha e árvore aceitam extensão própria.
- Árvore radial começa no centro e abre caminhos em todas as direções após compras.
- Feedback sonoro opcional para rolagens, usando Web Audio API local.
- Criador de ficha em etapas e criador guiado de árvore universal.
