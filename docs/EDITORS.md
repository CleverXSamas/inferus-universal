# Estúdios de árvores e personagens

## Árvore de skills

O editor possui três áreas: biblioteca reutilizável, mapa e inspetor da skill selecionada.

- Arraste o fundo para mover o mapa. Use scroll ou pinça para zoom; os botões também permitem aproximar, afastar, mover e enquadrar tudo. O minimapa oferece uma visão geral.
- Arraste cada skill para reorganizar sua posição. As conexões acompanham o movimento.
- Na aba **Ramos**, crie um caminho, escolha o nome e a cor. Ramos podem existir sem skills e receber habilidades depois.
- **Criar skill** permite definir nome, tipo, custo, descrição e efeito registrado. É possível salvar apenas na biblioteca ou criar e colocar no mapa de uma vez.
- Na biblioteca, **Adicionar ao mapa** cria uma cópia em qualquer ramo e permite escolher o pré-requisito. A mesma skill pode aparecer em vários lugares.
- No inspetor, altere o ramo ou a conexão anterior. As skills seguintes acompanham a mudança de ramo. A lista de conexões exclui a própria skill e suas descendentes para impedir ciclos.
- **Excluir só esta skill** remove o nó e reconecta as skills seguintes ao pré-requisito anterior.
- **Excluir skill e sequência** remove o nó e todas as dependências seguintes.
- **Excluir ramo** remove o ramo e todas as suas skills do mapa. A biblioteca permanece disponível.
- Qualquer nó pode ser removido, incluindo a origem. Um mapa vazio permite criar uma nova origem.
- Excluir um modelo da biblioteca preserva as cópias já colocadas no mapa.
- **Desfazer/Refazer** recupera alterações recentes. Modelos de árvore substituem o mapa, preservam a biblioteca e também podem ser desfeitos.

A árvore do estúdio, a biblioteca, as posições e a câmera são salvas **neste navegador**. Exportação e importação JSON permitem cópia de segurança e transferência entre dispositivos. Renomear o personagem ou mudar o nível não regenera o mapa. Os efeitos registrados não são aplicados automaticamente à ficha, e o custo não representa uma carteira de fragmentos.

A API anterior de árvores geradas permanece separada, com seu armazenamento existente.

## Ficha de personagem

- Escolha um dos seis modelos, filtre por estilo ou comece do zero. A ficha atual é preservada enquanto você consulta outros modelos; escolher um substitui o rascunho e permite desfazer.
- **Montar ficha** exibe ferramentas de criação, módulos e ajustes de campos. **Modo jogo** prioriza valores, recursos e ações.
- Adicione módulos de Atributos, Vitalidade, Inventário, História e Ações. Também é possível criar seções e campos próprios.
- Tipos disponíveis: número, texto, marcador, recurso, lista, calculado e ação. O criador de campos pertence à seção de destino.
- Seções podem ser renomeadas, reordenadas, recolhidas e excluídas. Exclusões locais pedem confirmação e permitem desfazer.
- Cada campo mostra em **Ajustar campo** sua referência de fórmula. Nomes novos recebem referências legíveis e únicas, como `@coragem` e `@coragem_2`.
- Campos calculados usam as funções do motor de fichas, por exemplo `floor((@forca - 10) / 2)`.
- Ações podem referenciar valores numéricos e calculados: `1d20 + @bonus`. Modificadores negativos são resolvidos corretamente. A rolagem usa o mesmo motor criptográfico do rolador.
- Recursos mantêm o valor atual entre zero e o máximo e possuem controles rápidos para gastar e recuperar pontos.

A cópia local continua usando a chave anterior, preservando fichas já existentes. **Salvar na conta** mantém a sincronização existente entre dispositivos. A exclusão da conta preserva a cópia local e pode ser revertida salvando-a novamente. A exportação JSON permite guardar uma cópia externa.

## Validação

Os testes cobrem reutilização, movimentação de dependências, prevenção de ciclos, exclusões, mapa vazio e validação de documentos. Os fluxos de navegador verificam pan/zoom, drag de nós, gestos por toque, desfazer/refazer, persistência após recarga, fórmulas, recursos, ações e salvamento de fichas na conta.

## Resultado de dados visível durante a criação

A ficha possui “Rolar dados” na barra de ferramentas. Rolagens de ações e rolagens livres abrem um painel fixo no canto inferior direito, com total destacado e auditoria dos dados. O painel acompanha a rolagem da página e não desaparece por tempo. Pode ser recolhido, expandido, reaberto ou fechado; o fechamento preserva a posição de leitura e o rascunho.

O painel permite outra expressão, nova rolagem e atalhos d20/d6/atributos. Referências de fórmula continuam sendo resolvidas pelos valores atuais da ficha. Falhas aparecem no próprio painel. No celular ele respeita a área disponível, possui rolagem interna e mantém os controles acessíveis. Não são dados 3D nem um envio automático ao Discord.

O painel usa o formato simples do Dado Aberto: total, descrição legível, valores dos dados e modificador juntos, ID e horário. A fórmula de entrada não se repete no resultado. Rolagens possuem uma animação curta, desativada pela preferência de movimento reduzido. O botão de som é compartilhado com o Dado Aberto e sua preferência persiste neste navegador. Os resultados do painel são temporários e não alteram valores da ficha automaticamente. O comportamento se inspira no [Digital Dice do D&D Beyond](https://dndbeyond-support.wizards.com/hc/en-us/articles/7747201888404-Digital-Dice-How-to-roll-your-free-or-premium-Digital-Dice).
