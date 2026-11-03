# Bot Inferus: revisão de experiência

A revisão usa o mesmo catálogo de comandos, exemplos e formatadores no bot Node, no endpoint HTTP e no guia web. O motor de dados permanece compartilhado com o rolador da aplicação.

## Referências e aplicação

- [Avrae — catálogo oficial](https://avrae.io/commands/): ajuda organizada por assunto e argumentos próximos da tarefa. Orienta `/ajuda`, os tópicos e a descoberta dos parâmetros do Inferus.
- [Dice Maiden — repositório oficial atual](https://github.com/Humblemonk/dicemaiden-rs): exemplos curtos de notação de dados e ajuda acessível pelo comando. Orienta a coleção de exemplos copiáveis e os atalhos da prévia.
- [Discord — Application Commands](https://docs.discord.com/developers/interactions/application-commands): comandos slash, opções tipadas e autocomplete. Orienta as sugestões de expressões sem restringir a digitação livre.
- [Discord — Receiving and Responding](https://docs.discord.com/developers/interactions/receiving-and-responding): confirmação inicial em até três segundos, respostas efêmeras, permissões da aplicação e controle de menções. Orienta a validação anterior ao defer no Gateway, a ajuda privada e a resposta em texto quando embeds não são permitidos.

Não foram reutilizados código, marcas ou imagens desses bots.

## Comandos

- `/rolar expressao:1d20+5`: expressão livre ou sugestão do menu. Parâmetros opcionais: `alvo` (inteiro de -50 a 1000), `privado` (padrão falso) e `motivo` (até 80 caracteres).
- `/ajuda`: primeiros passos; `topico:expressoes` mostra exemplos; `topico:privacidade` explica visibilidade, limites e o que a integração oferece. A ajuda é sempre privada.

As respostas destacam total, motivo, expressão, dados mantidos/descartados, explosões, modificador e comparação com o alvo. Mensagens extensas abreviam a auditoria de forma explícita e respeitam os limites do Discord. O ID da rolagem permanece no rodapé. A auditoria exibida não implica armazenamento de uma auditoria completa no site.

Quando o canal não permite embeds, o resultado é apresentado como texto, priorizando total, alvo e modificador. Menções são desativadas nos dois transportes e o texto livre do motivo é escapado.

No HTTP, erros de expressão são privados. No Gateway, expressões e opções são validadas antes do defer; falhas de serviço posteriores ao defer mantêm a visibilidade originalmente escolhida, como exige o Discord.

## Tela `/discord`

- Simulador com exemplos, motivo, dificuldade e escolha de privacidade.
- Prévia local de resultados; o simulador não envia mensagens ao Discord.
- Cópia do comando para uso no cliente Discord, onde o usuário confirma os campos.
- Instalação guiada, atualização de comandos reservada a quem mantém a aplicação e solução de problemas.
- “Serviço preparado” verifica somente a configuração do endpoint. A instalação e as permissões do servidor são confirmadas executando `/rolar` no Discord.
- Dados públicos de conexão vêm do servidor; a chave pública e os segredos não são retornados pela rota de configuração.

## Atualizar a aplicação real

A publicação do site atualiza o processamento HTTP, mas não modifica automaticamente o catálogo registrado no Discord. Para disponibilizar `/ajuda`, autocomplete e `motivo`:

1. Abra `/discord` e entre na conta.
2. Em “Configurar ou atualizar comandos”, abra o Developer Portal da aplicação correta.
3. Gere um token novo, informe-o exclusivamente no campo protegido do site e use “Atualizar /rolar e /ajuda”.
4. Instale o bot no servidor e confirme com uma rolagem.

O token é removido do campo ao iniciar a tentativa, usado apenas nas requisições autorizadas ao Discord e não é persistido em banco, conta, armazenamento do navegador ou logs. A atualização verifica ID e chave pública, faz upsert dos comandos e configura o endpoint. Outros comandos existentes da mesma aplicação são preservados. A CLI Node também usa upsert, inclusive com `DISCORD_GUILD_ID`.

Erros de credencial, permissão, limite de tentativas e indisponibilidade recebem instruções específicas sem refletir a resposta bruta ou o token. O convite continua usando permissões zero e não pede administrador.

Fichas e árvores continuam no site; esta revisão não cria vínculo automático de identidade Discord/conta, presença Gateway no serviço HTTP ou consulta remota de instalação.

## Validação

Os testes cobrem exemplos, autocomplete, opções inválidas, formatos rico/texto, limites de mensagem, motivos com menções, ajuda privada, defer/edição de respostas, assinaturas HTTP, configuração pública, autorização de ativação, rate limiting, limpeza do token e prévia sem chamadas de envio.
