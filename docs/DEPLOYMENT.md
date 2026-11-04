# Hospedagem de Inferus Universal no Railway

A aplicação tem três serviços: `web` (HTTP), `bot` (processo contínuo Discord) e `MySQL` (banco com volume persistente). Ambos os serviços Node usam a mesma imagem Docker. O bot também pode ser hospedado sozinho, usando o site Sites e sem depender do MySQL. O processo do bot não recebe domínio público.

## Acesso necessário

Conecte a conta Railway à integração no ChatGPT para permitir criar e configurar os serviços. É necessário um projeto Railway com recursos para os serviços contínuos e armazenamento; preços e disponibilidade dependem da conta. A configuração do repositório já está pronta, mas os arquivos abaixo não criam recursos por conta própria.

No Discord, é necessário ter acesso à aplicação do bot no [Developer Portal](https://discord.com/developers/applications). O Application ID é público; o Bot Token só deve ser inserido como variável secreta do serviço `bot`. Não envie o token no chat, não o coloque em GitHub nem em variáveis do serviço web.

Para o login, use os dados do projeto Manus que emitiu as identidades existentes. O Inferus não pode emitir credenciais em nome do Manus ou do Discord. Gerar uma string aleatória para essas variáveis não cria uma credencial válida.

## Criar os serviços

Use a branch `codex/review-and-pending-fixes` do repositório `CleverXSamas/inferus-universal`, até a integração do PR #1 na main. Não ative deploy da main enquanto as correções não estiverem integradas.

1. Adicione o serviço MySQL do Railway e preserve seu volume. Nomeie-o `MySQL` para usar as referências abaixo.
2. Adicione `web` a partir do repositório e configure **Config File Path** como `/deploy/railway.web.toml`.
3. Gere o domínio HTTPS do serviço `web`, apontando para a porta 3000.
4. Adicione `bot` a partir do mesmo repositório e branch. Use `/deploy/railway.bot.toml` como **Config File Path**. Mantenha uma única réplica; não gere domínio público.
5. Configure as variáveis abaixo antes dos deploys. A aplicação falha na inicialização em produção se faltarem os dados necessários; não usa memória silenciosamente como banco de produção.

### Serviço web

| Variável | Origem do valor |
| --- | --- |
| `PORT` | `3000` |
| `HOST` | `::`, para aceitar a rede privada IPv6 e a conexão pública |
| `DATABASE_URL` | Referência `${{MySQL.MYSQL_URL}}`; mantenha usuário e senha somente no cofre do Railway |
| `PUBLIC_ORIGIN` | `https://${{RAILWAY_PUBLIC_DOMAIN}}`, após gerar o domínio do serviço |
| `MANUS_PROJECT_ID` | `hQ96GtJS3byVQmgSaiY8PV`, informado pelo proprietário |
| `MANUS_OAUTH_API_URL` | `https://api.manus.im`, API padrão do OAuth Manus; validar o login real após o deploy |
| `MANUS_OAUTH_PORTAL_URL` | `https://manus.im`; o código acrescenta `/app-auth` |
| `MANUS_JWT_SECRET` | Opcional, somente se o projeto exigir compatibilidade com JWT do Preview; copie o segredo original, sem substituí-lo por valor aleatório |

O proprietário informou o portal `https://manus.im/app-auth`; configure apenas a origem na variável para evitar duplicar o caminho. A URL da API padrão foi identificada em configuração pública do SDK e ainda precisa ser confirmada pelo fluxo real deste projeto.

Cadastre no provedor OAuth o callback exato `PUBLIC_ORIGIN/api/auth/callback`. Uma mudança de domínio exige atualizar o callback e a origem da aplicação.

### Serviço bot

Aplicação Discord informada: `1528465674731782347`. O token deve pertencer a essa aplicação e ser salvo somente como segredo.

| Variável | Origem do valor |
| --- | --- |
| `DISCORD_CLIENT_ID` | `1528465674731782347` |
| `DISCORD_TOKEN` | Bot Token dessa mesma aplicação; configure como segredo |
| `DISCORD_GUILD_ID` | Opcional, ID do servidor para remover slash legado |
| `PUBLIC_ORIGIN` | Origem HTTPS do site publicado, usada nos links e no GIF |
| `FRAGMENTOS_API_URL` | Não é exigida pelo bot por prefixo; o motor é local |

O bot valida o token na API do Discord e verifica se pertence ao Application ID informado, sem imprimir o segredo. Depois conecta ao Gateway para ler `!rolar`, `!r` e `!ajuda`. Habilite Message Content Intent na aba Bot do Developer Portal. Não exige Client Secret nem endpoint público de interações.

## Instalar o bot

Para a aplicação informada, a [URL de instalação](https://discord.com/oauth2/authorize?client_id=1528465674731782347&scope=bot&permissions=274877926400) já pode ser aberta.

O convite solicita o escopo `bot` e permissões de visualizar canais, enviar mensagens, inserir links e enviar em tópicos. O token nunca aparece nessa URL. Remova os comandos antigos com `npm run bot:remove-slash`; configure `DISCORD_GUILD_ID` se também houve registro específico nesse servidor.

Para conferir credenciais sem registrar comandos nem abrir o gateway:

```bash
npm run bot:check
# Na imagem de produção:
node dist-server/bot/index.js --check
```

Os comandos leem as variáveis do ambiente; não carregam `.env` automaticamente. Uma validação real depende das credenciais e de acesso à API do Discord. Testes automatizados usam respostas simuladas e não substituem essa validação.

## Verificar o deploy

- O deploy web precisa responder a `/api/health` e reportar armazenamento `mysql`; o endpoint verifica a conexão e retorna 503 se o banco estiver indisponível.
- Entre via Manus e salve uma ficha. Abra a conta em outra sessão de navegador e confira a ficha e as campanhas.
- Reinicie o serviço web e confirme que os dados permanecem no MySQL.
- O log do bot deve confirmar conexão ao Discord; envie `!rolar 2d20kh1+5` no servidor em que foi instalado.
- Confirme que o comando digitado e o resultado permanecem visíveis para todos no canal.

A integração Railway permite concluir a criação, o deploy e a leitura de logs quando conectada. A criação da aplicação Discord, a emissão do token, a instalação no servidor e a autorização do callback OAuth Manus exigem acesso às respectivas contas. Não há publicação confirmada até que o provedor retorne o deploy concluído e uma URL real.
