# Campanha, personagem e progressão

A mesa possui 1 DM e até 9 jogadores. A barra superior mantém a seleção atual e reúne a criação de outra campanha. Abrir a criação permite voltar à sessão atual sem perder o acesso. Estados e eventos são apresentados em português; o diário preserva texto novo digitado durante um envio anterior.

## Mesa de jogo

O painel destaca nome, estado, participantes e fichas vinculadas. A ação principal inicia, pausa, retoma ou reabre a sessão. O participante atual é identificado como “você”; não se afirma presença online sem um sinal real de conexão.

No celular, os botões “Ver personagens” e “Ver diário” alternam os painéis. “Convidar jogadores” abre diretamente os controles de convite. O comando para selecionar a mesa no Discord pode ser copiado no painel de personagens.

O diário oferece filtros Tudo/Mensagens/Atividade, busca nos últimos 80 registros, separação por dia e retorno aos novos registros quando o leitor está consultando mensagens antigas. Enviar não apaga um novo rascunho digitado durante a requisição. A sessão encerrada mantém o diário em consulta e rejeita novas mensagens no servidor; reabrir restaura o envio.

“Convites e controles do mestre” reúne o link, cópia com seleção manual como alternativa, rotação, revogação e encerramento. Remover participante, substituir/revogar convite e encerrar pedem confirmação na interface, explicando o efeito. O endereço da mesa `/campanhas?mesa=ID` abre uma participação autenticada; ele não substitui o convite `/campaign/TOKEN`. Na entrada, “Tenho um convite” aceita o link ou código enviado pelo mestre.

## Personagem dentro da campanha

Cada participante tem uma ficha de campanha. No cartão da mesa, abra “Vincular ficha”: use uma ficha da conta, uma cópia deste navegador ou crie uma nova por preset. O personagem recebe uma árvore própria automaticamente. “Salvar ficha e árvore na campanha” publica as duas juntas; rascunhos não substituem a versão salva.

O dono edita e o DM consulta em modo somente leitura. Os demais jogadores recebem apenas nome e contagem de skills no grupo; a API não expõe campos, biografia ou árvore completa. Uma cópia vinculada à campanha é independente da ficha privada da conta. Remover o participante remove seu acesso e seu documento da campanha.

A árvore fica na ficha, com mapa móvel, zoom, inspeção e desbloqueio respeitando nível e pré-requisitos. “Usar árvore do estúdio” importa uma cópia da árvore criada no editor. Árvores de personagens diferentes são independentes e acompanham salvamento na conta, exportação/importação e campanha. Custos e efeitos ainda são ajustados manualmente: o desbloqueio registra progressão, sem alterar atributos ou carteira automaticamente.

Salvamentos possuem revisão. Duas abas não sobrescrevem uma à outra silenciosamente: a segunda recebe aviso para reabrir a ficha. O documento compartilhado admite até 96 KB, incluindo árvore. D1 mantém esses dados no documento atômico da campanha; MySQL usa uma tabela adicional de personagens e o bloqueio transacional da campanha. Mensagens não regravam os documentos de personagem no MySQL quando nada mudou.

## Referências que orientaram a organização

- [Foundry — Actors](https://foundryvtt.com/article/actors/): personagem como documento próprio e distinção entre observar e ser dono. No Inferus, o DM consulta e o jogador edita; a permissão é validada no servidor.
- [Foundry — Users and Permissions](https://foundryvtt.com/article/users/): associação entre jogador e personagem, sem confundir acesso à mesa com acesso a todos os documentos.
- [D&D Beyond — Connected Players Menu](https://dndbeyond-support.wizards.com/hc/en-us/articles/46385405994900-Connected-Players-Menu): acesso à ficha a partir do participante conectado. No Inferus, cada participante possui o atalho “Ficha + árvore”.
- [Roll20 — discussão sobre ficha mostrando apenas Bio & Info](https://app.roll20.net/forum/post/9853734/character-sheet-only-showing-bio-and-info): exemplo recorrente de confusão entre visibilidade e controle. A interface do Inferus identifica a consulta do DM como somente leitura e não oferece edição de fichas de terceiros.
- [Roll20 — discussão sobre permissões de fichas importadas](https://app.roll20.net/forum/post/11781750/cannot-edit-permissions-on-the-d-and-d-5th-edition-character-sheets-when-a-character-is-imported): motivou a cópia explícita para a campanha, com dono e permissões claros, preservando a ficha privada original.

As referências orientam fluxo e permissões; não indicam compatibilidade com os sistemas desses produtos nem cópia de regras proprietárias.

## Discord e conta existente

A decisão nesta entrega é manter Sites/ChatGPT para a conta já existente e vincular o Discord. Não há migração destrutiva de identidades ou troca de hospedagem. Veja [Discord](DISCORD.md) para vínculo, comandos e atualização do bot.


## Campanha pelo bot

Após `!login` e confirmação no site, `!campanhas` lista suas mesas. `!campanha usar Nome completo` (ou ID) seleciona a campanha e seu personagem nela. A seleção é pessoal, vale entre canais e é a mesma usada pela página Discord. Uma mesa sem ficha pode ser selecionada para diário e sessão; `!ficha` orienta a vincular o personagem, sem reutilizar a ficha de outra mesa.

- `!campanha`: estado, papel e personagem ativo, com botão para abrir a mesa certa.
- `!mesa`: participantes e nomes de personagens, sem conteúdo privado das fichas.
- `!diario [página]`: registros recentes, publicados no canal por pedido do membro.
- `!anotar texto`: registra como o participante autenticado, até 300 caracteres.
- `!sessao iniciar|pausar|retomar|encerrar`: só DM, com permissão revalidada no servidor. Repetir o mesmo estado não duplica eventos.

O bot não cria convites nem remove jogadores. Nomes duplicados exigem o ID de `!campanhas`. Remover alguém da campanha bloqueia as próximas consultas e mutações, mesmo que essa campanha ainda esteja selecionada no Discord. Comandos e respostas são públicos: consultar o diário em um canal o compartilha com as pessoas que podem ler esse canal.
