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
- [x] Associar campanhas e fichas ao `openId` autenticado e permitir gestão de membros por conta, além do convite privado.
- [x] Implementar runtime Discord, registro de `/rolar`, URL OAuth2 de instalação, opções e tratamento de resposta adiada.
- [x] Preparar imagem de produção, configurações Railway para web/bot, validação de ambiente e conferência token–Application ID Discord.
- [ ] Conectar a conta Railway, configurar os segredos externos, autorizar o callback Manus no domínio publicado, instalar o bot e confirmar o deploy público. Application ID Discord informado: `1528465674731782347`.
- [x] Adicionar funções `floor`, `ceil`, `min`, `max` e `abs` ao parser de fórmulas.
- [x] Rodar suíte estatística de 10^6 amostras em job separado de CI.

## Pendências identificadas na revisão

- [ ] Integrar custo/moeda e efeitos de árvore à ficha; a demonstração atual apenas desbloqueia nós.
- [x] Vincular Discord à conta Sites com código temporário, confirmação na conta e seleção do personagem ativo; manter Manus separado.
- [x] Integrar ficha e árvore ao personagem de campanha com permissões de dono/consulta do DM e revisão de salvamento.
- [x] Implementar !login, !vincular, !ficha, !skills, !campanhas e !acao, sem comandos de barra.
- [ ] Persistir histórico e árvores da API; hoje permanecem em memória.

## Princípio de extensibilidade

Todo preset deve ser duplicável, editável e abandonável. Nenhum preset pode bloquear um campo, dado, recurso, tipo de nó ou regra nova criada pelo usuário.

## Hospedagem sem servidor

- [x] Publicar Worker com interface e API, sem servidor Node contínuo.
- [x] Persistir campanhas, fichas, histórico e árvores da API em D1, com isolamento por conta.
- [x] Usar identidade ChatGPT gerenciada pelo Sites; preservar Manus na versão Node/MySQL.
- [x] Validar assinaturas Ed25519 no endpoint legado; rolagens atuais usam mensagens públicas por prefixo.
- [x] Fornecer remoção dos comandos globais antigos com token transitório, sem armazená-lo.
- [x] Publicação e health check D1 confirmados pelo proprietário.
- [x] Implementar !rolar, !r e !ajuda, comandos visíveis, limites e descarte de mensagens comuns/bots.
- [x] Simplificar cartões, juntar modificador e dados, animar rolagens e compartilhar som na ficha.
- [ ] Habilitar Message Content Intent e configurar um serviço Gateway contínuo com token válido no cofre; confirmar uso real de !rolar no canal.
- [ ] Remover rolar/ajuda do catálogo real do Discord com o formulário autenticado ou bot:remove-slash; incluir servidores com registro específico.
