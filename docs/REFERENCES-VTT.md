# Ficha universal e mesa virtual — revisão V11

Referências públicas consultadas em 4 de novembro de 2026:

- [LichRPG](https://lichrpg.com.br/): personalização de atributos, recursos e ações, mesa 2D e tokens. Inspira a combinação de ficha flexível com mesa; não usamos código, imagens ou textos proprietários.
- [RPGpedia](https://rpgpedia.com/): ficha universal e campanhas. Algumas ferramentas de VTT aparecem como metas/planejamento na página pública; não foram tratadas como recursos já disponíveis nem acessamos áreas pagas.
- Foundry VTT: [cenas](https://foundryvtt.com/article/scenes/), [atores](https://foundryvtt.com/article/actors/), [tokens](https://foundryvtt.com/article/tokens/) e [permissões](https://foundryvtt.com/article/users/). Inspira separar a representação na cena da ficha e verificar o controle pelo participante.

## Decisões implementadas

- Uma cena compartilhada por campanha, com nome, grade de 8–60 linhas/colunas e imagem de mapa HTTPS opcional. Zoom e posição de câmera são locais; posição dos tokens é compartilhada e persistente.
- DM configura a cena, adiciona NPCs e personagens vinculados e pode ocultar tokens. Jogadores adicionam/controlam apenas o próprio personagem. Tokens ocultos são filtrados no servidor; o dono ainda vê seu próprio token.
- Token vinculado abre a ficha e a árvore existentes, com as mesmas permissões da campanha. Retirar um token não apaga a ficha. Ao remover o participante, seu token deixa de ser retornado.
- D1 salva o documento com compare-and-swap; MySQL usa a transação e trava da campanha com tabela adicional. Revisão da cena evita sobrescrever movimentos concorrentes. Campanha encerrada fica somente para leitura.
- Ficha sem sistema obrigatório: sistema e conceito livres, campos fixados no painel Em jogo, valores compartilhados com as seções originais e árvore integrada preservada.

## Uso concreto do REA

Repositório oficial: https://github.com/morluto/rea (MIT), pacote oficial `rea-agents@6.8.0`.
Instalação isolada fora da aplicação; não virou dependência do site. O diagnóstico indicou que Node 24.19 era inferior ao mínimo suportado; a análise concluída usou Node 24.22.1, instalado separadamente.

Executamos `analyze-javascript-application` sobre JavaScript compilado do motor de mesa e do componente CampaignTabletop, salvando Evidence bundles e resumos em arquivos de trabalho. Ambos concluíram com um arquivo examinado e zero falhas de parsing. A primeira tentativa sobre todo o frontend minificado teve timeout e não é tratada como análise completa.

A projeção semântica da UI identifica `setInterval` de 4.000 ms, AbortController e cancelamento. A revisão desse fluxo levou à guarda contra consultas sobrepostas, pausa quando o documento está oculto e atualização ao retornar. A análise estática orienta a leitura; as verificações de permissão, concorrência e persistência foram confirmadas por testes executáveis, não pelo REA sozinho.

Resumos de evidência antes do último ajuste de polling:
- Motor: artifact SHA-256 `32206e87c1c9d1c2203d9065c5cff8de2ba601ba45eab8969bccab801877e1ec`; 750 nós AST visitados.
- UI: artifact SHA-256 `846e160ec92f8f0875a9cac0452e4bd1ce41fcc95c1940ed4f3f8f4139416aee`; 2.129 nós AST visitados.

## Limites desta entrega

É uma mesa 2D inicial, não uma reprodução de todos os recursos do Foundry. Ainda não há múltiplas cenas, iluminação/visão dinâmica, paredes, névoa de guerra, iniciativa ou upload próprio de mapas. A imagem HTTPS é pública para quem participa da mesa; ocultar token não oculta partes da imagem. A atualização usa polling de 4 segundos, não WebSocket.

## Ambiente e verificação

O disco cheio impedia a criação do MySQL. Cache da tarefa foi liberado e ferramentas/artefatos temporários foram movidos para `/tmp`; nenhum dado publicado foi removido. MySQL 8.4 usa banco descartável em tmpfs de 512 MB, somente em loopback.

`npm run test:full` provisiona um MySQL descartável, espera ficar disponível, executa a suíte sem os skips de banco e remove seu próprio container. Requer Docker e a imagem mysql:8.4 (será baixada se ausente). Alternativamente, aceita TEST_DATABASE_URL de um banco dedicado a testes. Não aponte para produção. Em ambientes com socket explícito: `INFERUS_DOCKER_SOCKET=unix:///var/run/docker.sock npm run test:full`.

Resultado: 66 testes de lógica/integração passaram, zero skips, incluindo MySQL real. 26 cenários distintos de navegador no Worker e 4 no Node passaram (a suíte inicial do Worker tinha 25; os 2 cenários de mesa/ficha foram executados novamente após correções). Capturas em 320–1440 px confirmaram ausência de overflow e correção da altura do painel lateral. TypeScript de frontend, Node e Worker passou.

Após os testes, removemos somente o container e a imagem MySQL baixados nesta tarefa, recuperando aproximadamente 4 GB. A imagem preexistente inferus-hosting-review foi preservada. Dependências e artefatos do projeto voltaram às pastas originais; REA e seu runtime continuam isolados em /tmp. O caminho test:full com TEST_DATABASE_URL foi validado; a criação automática pelo script depende do espaço disponível para baixar a imagem.
