# Inferus no Discord

## Mensagens públicas com prefixo

- `!rolar 1d20+5` e o atalho `!r 1d20+5` rolam no canal.
- `!r 2d20kh1+5 alvo:15 | Teste de percepção` compara com o alvo e nomeia a jogada. O alvo vem depois da expressão; o nome vem depois de `|`.
- `!ajuda`, `!ajuda expressoes` e `!ajuda privacidade` respondem no canal.
- O bot não apaga o comando digitado. Comandos, resultados, ajuda e erros são públicos. Para uma rolagem reservada, use o Dado Aberto no site.
- Mensagens comuns, mensagens de bots/webhooks, mensagens de sistema e DMs são ignoradas. O serviço não busca o histórico do canal nem vincula fichas privadas à conta Discord.
- Há um intervalo de 1,5 s e uma execução simultânea por usuário. As expressões mantêm os limites do motor: 1–40 dados por grupo, 2–1000 lados, 160 caracteres e bônus total entre −50 e +50. Nome de até 80 caracteres.

## Cartão e movimento

O total fica em destaque. Os valores mantidos e descartados aparecem na mesma linha do modificador, omitido quando zero. Uma descrição como “2 dados de 20 lados · manter o maior” substitui a fórmula repetida. Grupos diferentes conservam sua identificação, sinal e auditoria de explosões. O modo de sucessos continua identificado no total.

O cartão usa Components V2 com acento violeta. Uma miniatura GIF original de 840 ms gira uma única vez; cada rolagem possui uma URL distinta para reiniciar a apresentação. Ela é ilustrativa: o resultado criptográfico já está definido e é entregue na mesma mensagem, sem edição posterior nem espera. O GIF é servido pelo próprio site em `/assets/inferus-roll.gif`. O cliente Discord controla a reprodução de GIFs conforme suas preferências de acessibilidade. Sem permissão de inserir links, a resposta usa texto e preserva total, alvo e dados dentro do limite de 2.000 caracteres.

No site, Dado Aberto, ficha e prévia têm movimento curto. A ficha usa o resultado simples do Dado Aberto em um painel fixo no canto. O botão de som compartilha a preferência entre os dois roladores e persiste localmente. `prefers-reduced-motion` desativa o movimento no site.

## Ativação do serviço contínuo

A hospedagem Sites publica o site/API em HTTP. Ela não mantém este processo Node conectado ao Discord Gateway. Publicar o site, convidar a aplicação ou remover slash não comprova que o bot esteja online. A página mostra a conexão por prefixo como pendente, sem anunciar uma ativação que não foi verificada.

1. Em Developer Portal → aplicação → Bot, habilite **Message Content Intent**. Aplicações verificadas podem precisar de aprovação do Discord para esse intent.
2. Convide o bot com o escopo `bot` e as permissões Visualizar canais, Enviar mensagens, Inserir links e Enviar mensagens em tópicos. O convite não pede administrador nem leitura de histórico.
3. No cofre do processo persistente, configure `DISCORD_TOKEN` com um token válido. Configure `DISCORD_CLIENT_ID` e `PUBLIC_ORIGIN` com a origem HTTPS do site publicado. Nunca comite `.env` nem envie tokens em mensagens.
4. Execute `npm ci`, `npm run build` e `npm run start:bot`. Para desenvolvimento, `npm run bot`. O motor de rolagem roda localmente no serviço; não exige MySQL ou `FRAGMENTOS_API_URL`.
5. Mantenha uma instância ativa com reinício automático. Valide `!rolar 1d20+5` em um canal e em um tópico. O comando digitado e a resposta devem ser públicos.

O Dockerfile existente também pode ser iniciado com `node dist-server/bot/index.js`. A máquina de desenvolvimento desta conversa não substitui uma hospedagem persistente.

## Remover os comandos de barra antigos

O código não registra slash e não executa rolagens por interações antigas. O endpoint assinado permanece para validação de assinatura/ping e orienta a usar prefixos; autocomplete devolve uma lista vazia. Registros já existentes no catálogo do Discord precisam de uma remoção autenticada:

- No serviço com token no cofre, execute `npm run bot:remove-slash`. Remove somente `rolar` e `ajuda` globais. Com `DISCORD_GUILD_ID`, remove também os registros nesse servidor. Repita para outros servidores onde houve registro específico.
- Alternativamente, entre na página Discord do site e abra **Remover comandos de barra antigos**. O token é enviado uma vez por HTTPS e descartado. A aplicação e sua chave pública precisam corresponder às configurações; somente `rolar` e `ajuda` globais são removidos. Outros comandos são preservados. A ação não conecta o serviço por prefixo.

A remoção pode ser repetida com segurança. Erros do Discord não refletem o token na resposta, e não há persistência desse segredo no site.

## Referências

- [Avrae — comandos](https://avrae.io/commands/): comandos visíveis e expressões próximas da tarefa.
- [Discord — Gateway Intents](https://docs.discord.com/developers/events/gateway#gateway-intents): Guild Messages e Message Content para ler comandos digitados.
- [Discord — Components Reference](https://docs.discord.com/developers/components/reference): Container, Section e Thumbnail; GIF animado no acessório da seção.
- [D&D Beyond — Digital Dice](https://dndbeyond-support.wizards.com/hc/en-us/articles/7747201888404-Digital-Dice-How-to-roll-your-free-or-premium-Digital-Dice): resultado destacado durante a edição da ficha.

## Validação

Os testes cobrem análise de prefixos, expressões inválidas, alvo, título, envio público, canais sem embeds, bloqueio de concorrência, recuperação após erro, descarte de mensagens comuns/bots/DMs, remoção seletiva de comandos e proteção do token. O SDK valida o JSON de Components V2. Os testes de navegador cobrem prévia, cópia de comandos, formato, painel fixo, movimento reduzido, persistência do som e entrega binária do GIF pelo Worker. Os testes usam mensagens e respostas locais; não enviam mensagens reais ao Discord nem confirmam uma conexão Gateway publicada.
