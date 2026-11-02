# Changelog

## 1.3.1 — 2026-11-02
- Corrigidos os filtros de presets: Escada narrativa e Pool modular de traços agora têm abas próprias.
- A árvore abre com Despertar selecionado para deixar o primeiro passo evidente.
- Nós bloqueados agora informam explicitamente que o pré-requisito precisa ser comprado.
- Layout radial estabilizado por camada, evitando mudança visual causada pela ordem interna dos nós.
- Geração de árvores substituiu ordenação pseudoaleatória por expansão determinística a partir do centro.
- Uma árvore nunca exibe um nó sem caminho de compra; adicionada regressão para esse contrato.

## 1.3.0 — 2026-11-02
- Login e cadastro com Manus OAuth em um fluxo único.
- Usuários e sessões persistidos no MySQL para login em diferentes dispositivos.
- Cookie seguro `webdev_app_session`, logout, endpoint de identidade e proteção de nonce/redirect no callback.
- Controles de conta no cabeçalho da aplicação.

## 1.2.0 — 2026-11-02
- Duelo removido da navegação e substituído por Campanha.
- Campanha privada para 1 DM + até 9 jogadores.
- Convite por token aleatório, entrada idempotente por nome, papéis verificados no servidor e limite rígido de 10 participantes.
- Sala com roster, status de lobby/ativa/pausada/encerrada, diário de mensagens e polling cancelável.
- Persistência MySQL opcional com tabelas criadas de forma idempotente; fallback de memória declarado no health endpoint.
- Marca visual refinada para Inferus Universal e rota direta `/campaign/:token`.
