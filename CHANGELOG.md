# Changelog

## Atualização de rolagens — 2026-11-04
- Resultados simplificados: descrição legível e modificador junto dos dados, sem repetir a fórmula.
- Animação curta e som compartilhado entre Dado Aberto e ficha; preferência local e suporte a movimento reduzido.
- Miniatura GIF de uma única reprodução no cartão Discord e na prévia; entrega binária no Worker.
- Bot por prefixo público (!rolar, !r e !ajuda), com Message Content Intent e processo Gateway separado da hospedagem HTTP do site.
- Registro slash removido do runtime. Migração autenticada remove apenas rolar/ajuda antigos; endpoint legado orienta a usar prefixos.
- Ativação do Gateway e remoção do catálogo real permanecem pendentes de configuração com credencial válida no serviço persistente.

## 1.5.0 — 2026-11-03
- Publicação em Cloudflare Workers/Sites com API HTTP e persistência D1.
- Login ChatGPT na versão Sites; alternativa Node/MySQL e Manus preservada.
- Transições de campanha atômicas por revisão no D1 para impedir perda de atualizações e respeitar o limite de participantes.
- Receptor Discord com assinatura Ed25519, validação de timestamp e respostas privadas.
- Página de ativação do Discord com token transitório, validação de aplicação e configuração automática de /rolar e endpoint HTTP.
- Build Worker ESM com interface incorporada e empacotamento reproduzível.
- Testes de SQLite/D1, assinatura, isolamento e fluxos de navegador do Worker.

## Não publicado — hospedagem
- Docker multi-stage com dependências de build, imagem final sem usuário root e sem arquivos de ambiente.
- Configuração Railway para aplicação web e processo Discord separados, com referência privada ao MySQL e à API.
- Validação da configuração de produção, conferência token–aplicação Discord e registro opcional ao iniciar.
- Guia de deploy e configuração do Application ID público informado; segredos permanecem externos.

## 1.4.0 — 2026-11-02
- Corrigida escalada de privilégios por nome de participante; convites nunca recuperam o papel de DM.
- Campanhas vinculadas à conta, retomada em outros dispositivos, migração de participação com a sessão original e remoção de membros.
- Entrada MySQL serializada por campanha para respeitar o limite rígido sob concorrência.
- Revogação/rotação do convite preserva membros existentes; sessões removidas perdem acesso.
- Fichas editáveis, cópia local e salvamento privado na conta com persistência MySQL.
- Fórmulas com floor, ceil, min, max e abs, dependências fora de ordem, ciclos e validação de limites.
- Corrigidos keep-low/drop-high, normalização e recálculo de sucessos no rolador.
- Corrigida consulta de sessões MySQL e endurecida validação de JWT de Preview.
- API aguarda handlers assíncronos, limita o corpo JSON e protege escritas de origem externa e arquivos estáticos.
- Polling cancelável, restauração da campanha após recarga e histórico local corrompido tolerado.
- Runtime Discord com registro real de /rolar e resposta correta após defer; comandos de ficha sem implementação removidos do registro.
- CI com regressões, MySQL, navegador e job estatístico independente de um milhão de amostras por dado.

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
