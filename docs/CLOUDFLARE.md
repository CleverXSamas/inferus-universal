# Hospedagem Cloudflare Workers + D1

Publicação: https://inferus-universal.moltencrown1.chatgpt.site

A versão Sites executa a interface React e uma API HTTP em um único Worker, com armazenamento D1 para campanhas, fichas, histórico e árvores da API. Não precisa de servidor Node nem processo contínuo de bot. A alternativa Node/MySQL continua disponível no mesmo repositório, inclusive os comandos de build e testes originais.

## Contas e dados

Nesta publicação, o login é gerenciado pelo Sites com a conta ChatGPT. A identidade vem dos cabeçalhos protegidos do gateway Sites e é usada como chave dos registros. A versão Node mantém Manus OAuth. As identidades são diferentes e os bancos não são compartilhados; não há migração automática de dados de um provedor para o outro.

Os cabeçalhos de identidade deste adaptador só podem ser confiados atrás do gateway Sites. Para publicar o bundle diretamente em uma conta Cloudflare fora do Sites, configure antes um gateway de identidade confiável; não exponha este adaptador sem essa proteção.

Fichas e campanhas vinculadas à conta são acessíveis apenas àquela identidade. A entrada de convidado continua disponível por convite e sessão privada. A árvore visual continua uma demonstração local; o endpoint de árvores é persistente e isolado por conta. O histórico exibido pelo rolador local continua no navegador; o histórico gerado pela API é persistido por conta.

As alterações de campanha usam compare-and-swap com revisão no D1: uma operação concorrente relê o estado antes de alterar. Isso mantém o limite de dez participantes e evita que remoções, mensagens ou alterações de status sobrescrevam umas às outras.

## Discord sem processo contínuo

A aplicação Discord é `1528465674731782347`. A chave pública foi configurada no ambiente da hospedagem. O receptor valida assinatura Ed25519 e timestamp, responde a PING e atende `/rolar`, incluindo respostas privadas. Não precisa de token de bot em cada execução.

Para ativar, abra https://inferus-universal.moltencrown1.chatgpt.site/discord, entre e informe um token novo da aplicação no formulário. A API verifica se o token pertence à aplicação e se a chave pública confere, cria ou atualiza apenas `/rolar` (preservando outros comandos) e configura a URL de interações no Discord. Em seguida, apresenta o link de instalação no servidor.

O token é usado somente nas requisições HTTPS ao Discord, sem gravação em D1, arquivos, logs ou localStorage. O formulário apaga o valor após a tentativa. A configuração só ocorre depois do envio explícito do formulário; os testes usam um token fictício e não ativam a aplicação real.

Endpoint de interações: `https://inferus-universal.moltencrown1.chatgpt.site/api/discord/interactions`.

## Build e validação

```bash
npm ci
npm run check
npm run check:edge
npm test
npm run package:sites
node scripts/validate-artifact.mjs
npx playwright install chromium
npm run test:browser:edge
```

O build usa Vite para a interface e esbuild para gerar um Worker ESM independente, com JS/CSS/HTML incorporados. O artefato fica em `work/site-version.tar.gz`, contendo `.openai/hosting.json`, `dist/server/index.js` e as migrações de `drizzle/`.

O manifesto usa `d1: "DB"` e preserva o project_id emitido pelo Sites. Publicações devem salvar a versão da fonte enviada ao Git gerenciado e construir o artefato a partir desse mesmo commit. Nunca use o SHA do GitHub para representar um commit diferente no repositório gerenciado.

Migrações já aplicadas são imutáveis. Acrescente novas migrações e atualize o journal; não altere `0000_edge.sql` após a publicação. A plataforma aplica as migrações antes de publicar o Worker.

Os testes locais usam SQLite como implementação de teste da interface D1. Os fluxos de navegador simulam o gateway ChatGPT apenas no adaptador em `test/helpers/edge-preview.mjs`; esse adaptador não faz parte do bundle publicado. O CI também mantém os testes de MySQL e da imagem Node.

## Custo e limites

Esta publicação usa Sites sobre Cloudflare e não contratou um plano pago do Railway nem outro servidor contínuo. O orçamento definido para qualquer alternativa paga é menor que US$ 5 e pagamento por PIX; nenhum plano pago foi contratado nesta entrega.

O Cloudflare disponibiliza faixas gratuitas de Workers e D1 com cotas. Isso não significa capacidade ilimitada, disponibilidade garantida ou equivalência de todas as condições entre uma conta Cloudflare própria e a hospedagem gerenciada Sites. Consulte as condições da plataforma antes de ampliar o uso ou contratar um plano.

- Workers: https://developers.cloudflare.com/workers/platform/pricing/
- D1: https://developers.cloudflare.com/d1/platform/pricing/

## Verificação da publicação

A plataforma confirmou o deploy concluído, e o proprietário conferiu `/api/health`: `ok: true`, armazenamento D1 para campanhas/fichas/histórico/árvores, autenticação ChatGPT e transporte Discord HTTP. A ativação real do Discord depende do envio do token novo no formulário e da instalação no servidor.
