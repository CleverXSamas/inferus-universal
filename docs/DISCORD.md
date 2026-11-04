# Inferus no Discord

## Mensagens públicas com prefixo

- `!rolar 1d20+5` e o atalho `!r 1d20+5` rolam no canal.
- `!r 2d20kh1+5 alvo:15 | Teste de percepção` compara com o alvo e nomeia a jogada. O alvo vem depois da expressão; o nome vem depois de `|`.
- `!ajuda`, `!ajuda expressoes` e `!ajuda privacidade` respondem no canal.
- O bot não apaga o comando digitado. Comandos, resultados, ajuda e erros são públicos. Para uma rolagem reservada, use o Dado Aberto no site.
- Mensagens comuns, mensagens de bots/webhooks, mensagens de sistema e DMs são ignoradas. O serviço não busca o histórico do canal. Consultas de personagem exigem vínculo confirmado e seleção explícita no site ou por `!campanha usar`.
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

O código não registra slash e não executa rolagens por interações antigas. Os comandos de conta e personagem também usam prefixo. O endpoint assinado permanece para validação de assinatura/ping e orienta a usar prefixos; autocomplete devolve uma lista vazia. Registros já existentes no catálogo do Discord precisam de uma remoção autenticada:

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

## Conta vinculada, personagens e campanhas

A hospedagem atual e o acesso ChatGPT foram mantidos por escolha do proprietário. O Discord é vinculado à conta existente, sem senha no chat e sem OAuth paralelo.

1. Use `!login` e abra a página Discord do site. Entre na conta existente.
2. Gere um código temporário e envie `!vincular CODIGO` ao Inferus. O código dura dez minutos, fica armazenado apenas como hash e não libera fichas sozinho.
3. Confirme no site o nome e o ID Discord que pediram o vínculo. Essa segunda confirmação impede que alguém assuma a conta apenas vendo o código no canal.
4. Escolha a ficha ativa no site ou envie `!campanhas` e `!campanha usar Nome da campanha`. A seleção é pessoal e vale entre canais. Selecionar uma ficha avulsa no site sai do contexto de campanha. Comandos e respostas são públicos no canal.

Comandos adicionais: `!ficha` mostra até 12 atributos/recursos; `!skills [página]` lista habilidades desbloqueadas; `!acoes [página]` lista ações com a referência exata para copiar; `!campanhas [página]` lista as campanhas da conta; `!acao Nome da ação alvo:15` resolve a ação pelos valores da ficha salva. As listas usam páginas de cinco itens; `!diario [página]` mostra três registros por página. `!ajuda campanhas` e `!ajuda personagem` explicam cada fluxo. Referências únicas de campos podem substituir nomes repetidos. Textos de biografia e notas não entram no resumo público da ficha. Rascunhos ainda não salvos não são consultados.

O Gateway informa a identidade do autor; o comando não aceita um usuário arbitrário como argumento. O endpoint de integração valida a credencial do bot na aplicação Discord configurada. A credencial é transitória em HTTPS, não é salva em D1 e não aparece em respostas. Somente seu digest é mantido em cache breve para limitar validações externas. O bot deve apontar `PUBLIC_ORIGIN` para o site Inferus confiável.

“Desconectar Discord” bloqueia novas consultas. Participações removidas deixam de autorizar acesso à ficha de campanha. Identidades antigas de Manus continuam separadas do Sites. O vínculo utiliza a API hospedada Sites/D1; a alternativa Node/Manus mantém fichas e campanhas, mas não oferece esse endpoint de vínculo.

## Pacote de hospedagem do bot

`npm run package:bot` gera `work/inferus-bot-discloud-revisado.zip`, com JavaScript e dependências compilados, bootstrap de `.env`, configuração Discloud e instruções. O ZIP não contém credenciais reais e não precisa compilar na hospedagem. Configure seu `.env` privado antes do upload e preserve as variáveis do serviço ao atualizar. O novo código só entra em um bot já hospedado depois dessa atualização; publicar o site não atualiza o processo Gateway externo.

O cache do bot não retém mensagens de canais e limita usuários/membros, preservando o próprio bot para cálculo de permissões. Isso reduz crescimento de memória em hospedagens pequenas; não garante que qualquer servidor caiba em 100 MB.


## Comandos de campanha e experiência de uso

`!campanha usar Nome completo` ou `!campanha usar ID` seleciona uma mesa e o personagem nela. Nomes duplicados exigem ID; o ID aparece como código copiável sem escapes extras. `!campanha` resume a seleção, `!mesa` lista participantes, `!diario` consulta os últimos registros, `!anotar texto` grava uma mensagem e `!sessao iniciar|pausar|retomar|encerrar` controla o estado (apenas DM). As permissões do autor são revalidadas em cada operação. Detalhes em [Campanhas](CAMPAIGNS.md).

Cartões de conta, personagem e campanha têm título, contexto, próxima ação e link para o site. Erros de conta/campanha recebem orientação própria, sem serem descritos como falhas de dados. Mensagens sem embeds têm fallback limitado a 2.000 caracteres; nomes e texto escapam menções e Markdown. O catálogo filtrável do site e a ajuda de personagem/campanha usam a mesma fonte de comandos.

A confirmação do vínculo informa consultas e gravação no diário, além de controle de sessões nas mesas do mestre. Respostas do diário são públicas no canal onde o comando é enviado. O bot não envia convites, tokens de sessão, biografias nem campos de texto privados de fichas.
