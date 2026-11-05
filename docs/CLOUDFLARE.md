# Hospedagem Cloudflare Workers + D1

Publicação: https://inferus-universal.peneseretu.chatgpt.site

A interface React e a API HTTP executam em um Worker com D1 para fichas e árvores. O bot por prefixo usa um processo Node separado, conectado ao Gateway.


## Contas e dados

Nesta publicação, o login é gerenciado pelo Sites com a conta ChatGPT. A identidade vem dos cabeçalhos protegidos do gateway Sites e é usada como chave dos registros. A versão Node mantém Manus OAuth. As identidades são diferentes e os bancos não são compartilhados; não há migração automática de dados de um provedor para o outro.

Os cabeçalhos de identidade deste adaptador só podem ser confiados atrás do gateway Sites. Para publicar o bundle diretamente em uma conta Cloudflare fora do Sites, configure antes um gateway de identidade confiável; não exponha este adaptador sem essa proteção.



## Discord por prefixo

A aplicação Discord é `1528465674731782347`. O bot agora usa `!rolar`, `!r` e `!ajuda` como mensagens públicas. Isso exige um processo Node conectado ao Discord Gateway com Message Content Intent habilitado, fora da hospedagem HTTP do site. Consulte [o guia do bot](DISCORD.md) para configurar o serviço e remover os comandos de barra antigos.

A página Discord inclui remoção autenticada dos antigos comandos globais. O token é usado somente nas requisições HTTPS ao Discord, sem gravação em D1, arquivos, logs ou localStorage. O formulário apaga o valor após a tentativa. A remoção não ativa o serviço por prefixo, e os testes usam um token fictício.

O endpoint legado `https://inferus-universal.peneseretu.chatgpt.site/api/discord/interactions` continua validando assinatura Ed25519 e timestamp para ping e orientação de migração. Ele não executa rolagens por slash.

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

A plataforma confirma a publicação do site e seu armazenamento D1. `/api/health` verifica o banco e informa `discordTransport: "gateway-required"`; isso indica o modo necessário e não atesta que o bot esteja conectado.

A tela `/discord` mantém a conexão por prefixo como pendente até haver uma confirmação operacional externa. Publicar o site e remover comandos de barra não substituem a ativação do serviço contínuo.

A migração aditiva 0001_discord_accounts cria vínculos Discord e códigos temporários. Não altera as tabelas anteriores. O login gerenciado Sites permanece; o vínculo Discord é confirmado na conta existente e não mescla identidades de provedores diferentes.

A API atual mantém fichas e árvores isoladas por conta no D1. As tabelas históricas das migrações permanecem por compatibilidade; os endpoints de campanhas, rolagem avulsa, presets e histórico foram removidos. O login do Sites continua com ChatGPT e vínculo confirmado ao Discord.
