# Inferus Universal

Ferramenta local-first para mesa de campanha: rolador auditável, fichas personalizáveis, skill trees radiais, campanhas privadas e contas Manus OAuth.

## Executar

Requer Node.js 22.18 ou superior.

```bash
npm ci
npm run build
npm run dev
```

Abra `http://localhost:3000`. O frontend é servido de `dist/`; o servidor compilado fica em `dist-server/`. Em produção, use `npm start`. O comando de desenvolvimento executa o servidor TypeScript; refaça o build para atualizar o frontend.

As variáveis estão em `.env.example`. Configure-as no ambiente do processo ou use `node --env-file=.env dist-server/server/index.js`; os scripts não carregam `.env` automaticamente.

## Contas e fichas

**Entrar / criar conta** inicia Manus OAuth. O Inferus não recebe nem armazena senhas. Configure `MANUS_PROJECT_ID`, `MANUS_OAUTH_API_URL`, `MANUS_OAUTH_PORTAL_URL` e a origem pública fixa em `PUBLIC_ORIGIN`. `MANUS_JWT_SECRET` é necessário apenas para aceitar sessões JWT assinadas do Preview; tokens precisam de HS256, expiração e `appId` correspondente ao projeto.

A sessão própria tem 30 dias e usa token aleatório, armazenado apenas por hash. O cookie é HttpOnly, Secure e `SameSite=None` em HTTPS encaminhado pelo proxy; no desenvolvimento HTTP usa `SameSite=Lax`. O logout é POST e revoga a sessão própria atual. O proxy de produção deve sobrescrever os cabeçalhos encaminhados de protocolo e host.

Fichas podem ser editadas, ampliadas e salvas localmente. **Salvar na conta** grava uma cópia privada associada ao `openId` autenticado. Em outro dispositivo, faça login e selecione a ficha em **Fichas da conta**. A sincronização é explícita: o salvamento mais recente substitui a cópia da conta. A cópia local continua no navegador após logout ou remoção da cópia da conta.

Fórmulas aceitam `@referencia`, `+`, `-`, `*`, `×`, `/`, parênteses e `floor`, `ceil`, `min`, `max`, `abs`. Dependências são resolvidas independentemente da ordem dos campos; ciclos, referências inválidas e divisão por zero geram erro. Não há execução de JavaScript.

## Campanhas

Uma mesa aceita 1 DM e até 9 jogadores. Criação e entrada autenticadas vinculam a participação ao `openId`; **Minhas campanhas** permite retomá-la em outro dispositivo. O DM pode iniciar/pausar a sessão, remover jogadores, revogar e gerar novos convites. Mensagens têm até 500 caracteres e nomes de mesa até 60.

O convite permite criar uma participação de jogador, sem conceder o papel do DM. Um nome já utilizado exige outra escolha; nomes não recuperam identidade nem privilégios. Sem conta, preserve a sessão do navegador. Para vincular uma participação antiga, entre na conta no navegador que possui a sessão original e use **Vincular participação à conta**. Uma sessão vinculada exige aquela conta; não pode ser revendicada com outra conta ou apenas com o nome.

Revogar ou substituir o convite bloqueia novas entradas pelo link antigo e mantém o acesso dos membros existentes. Remover um jogador invalida suas sessões e sua participação na conta; se ele ainda tiver um convite válido, poderá pedir nova entrada como jogador. O DM pode revogar o convite para impedir isso.

A sala usa polling a cada cinco segundos, com cancelamento da requisição ao sair e sem sobreposição entre polls. As permissões e o limite são verificados no servidor. No MySQL, a verificação de capacidade e a entrada ocorrem sob bloqueio transacional da campanha.

## Persistência

Com `DATABASE_URL`, usuários, sessões, campanhas, participantes, vínculos de conta, eventos e fichas são persistidos em MySQL. As tabelas são criadas de forma idempotente. Os vínculos novos usam tabelas adicionais, preservando campanhas anteriores. `GET /api/health` informa `campaignStorage` e `authStorage`.

Sem banco, o modo memória serve para desenvolvimento e perde dados ao reiniciar. Histórico de rolagens e árvores da API também ficam em memória; a demonstração de árvore permanece local. Fichas e histórico locais usam o armazenamento do navegador.

## Discord

O bot inclui o comando funcional `/rolar`, com expressão obrigatória, alvo opcional e resposta privada opcional. Usa a API de dados da mesma aplicação e não requer o intent de conteúdo de mensagens.

1. Crie uma aplicação/bot no Discord Developer Portal.
2. Configure `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` e `FRAGMENTOS_API_URL` no ambiente. A API precisa ser alcançável pelo processo do bot; use HTTPS ao atravessar a internet.
3. Opcionalmente configure `DISCORD_GUILD_ID` para registrar o comando apenas em um servidor de teste.
4. Execute `npm run bot:register` e abra a URL OAuth2 de instalação emitida.
5. Execute `npm run bot`, ou `npm run build` seguido de `npm run start:bot`.

Token, instalação no Discord, URL pública e hospedagem do processo continuam dependendo da configuração externa. Nenhuma credencial é incluída no repositório. Comandos de ficha só devem ser publicados após implementar o vínculo explícito entre conta Discord e conta Manus; os placeholders anteriores foram removidos do registro.

## Validação

```bash
npm run check
npm test
npm run test:statistics
npx playwright install chromium
npm run test:browser
```

`npm test` verifica tipos e executa testes de núcleo, permissões, HTTP, OAuth e Discord. Para incluir persistência MySQL e concorrência, configure `TEST_DATABASE_URL` apontando a um **banco descartável**. Esses testes criam registros no banco indicado.

O CI possui um job com MySQL e fluxos de navegador e outro job estatístico separado, com 1.000.000 amostras por dado (d6 e d20). A tolerância estatística de sete desvios padrão é um detector de viés, não uma prova de aleatoriedade. As faces usam fonte criptográfica com rejeição para evitar viés de módulo.

## Presets e limites

Os seis presets de RPG são sínteses originais, editáveis e não oficiais. As fontes ficam disponíveis no seletor de fichas. O som é sintetizado localmente via Web Audio API.

A árvore visual demonstra geração e progressão, mas ainda não desconta uma moeda nem aplica os efeitos na ficha. A interface informa efeitos desbloqueados. A integração completa árvore–ficha e comandos Discord de ficha estão no backlog.

## Hospedagem

A versão gratuita adaptada está publicada em **https://inferus-universal.peneseretu.chatgpt.site**. Consulte o [guia Cloudflare/Sites](docs/CLOUDFLARE.md) para login ChatGPT, D1, build e ativação do Discord por HTTP. A versão Node/MySQL mantém Manus e não é substituída.


O [guia de deploy no Railway](docs/DEPLOYMENT.md) descreve os serviços web, bot e MySQL, as referências privadas e o armazenamento dos segredos. Os arquivos `deploy/railway.web.toml` e `deploy/railway.bot.toml` configuram build, comandos de inicialização e reinício. Em produção, o servidor exige banco, origem HTTPS e OAuth configurados. `npm run bot:check` valida o token e a aplicação Discord sem registrar comandos.
