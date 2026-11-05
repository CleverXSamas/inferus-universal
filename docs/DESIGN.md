# Design do Inferus Universal

A atualização mantém a identidade escura e violeta do Inferus e organiza o produto como um espaço de jogo: navegação persistente, contexto da ferramenta e ações próximas do conteúdo.

## Referências consultadas

- [D&D Beyond — ferramentas para jogadores](https://www.dndbeyond.com/en/players) e [organização das seções da ficha](https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193946388-Sheet-Sections): informação dividida por função, resultados e atributos fáceis de localizar. No Inferus, isso orienta os blocos de ficha, cabeçalhos e controles consistentes.
- [Demiplane — Character Tools](https://resources.demiplane.com/nexus/pathfinder/character-tools): distinção entre criação e uso da ficha, ferramentas acessíveis durante a partida. No Inferus, isso orienta os cartões de presets, os atalhos de dados e a hierarquia das ações.
- [Alchemy](https://alchemyrpg.com/) e [Sheet Builder](https://help.alchemyrpg.com/en/articles/11050124-sheet-builder): atmosfera e blocos modulares. No Inferus, isso orienta as superfícies escuras, os acentos violeta, os ícones próprios e a divisão em painéis.

Não foram reutilizados logotipos, imagens, textos ou componentes desses produtos.

## Aplicação

- Navegação com ícones SVG, ferramenta ativa identificada e adaptação para abas horizontais no celular.
- Rolador com atalhos d4–d20, envio por Enter, controle de som com estado acessível, resultado anunciado e histórico com horário.
- Estúdio de personagens com catálogo filtrável, criação do zero, módulos, campos personalizados, índice de seções e modos de montagem/jogo.
- Estúdio de árvores com biblioteca, mapa React Flow com pan/zoom e drag, ramos nomeados e inspetor contextual. A criação, movimentação e exclusão preservam a integridade das conexões.
- Foco de teclado visível, suporte a movimento reduzido e layouts verificados entre 360 e 1440 pixels.

Os editores preservam autenticação e permissões. A árvore visual possui salvamento local versionado, importação/exportação e histórico de desfazer/refazer. As fichas mantêm o armazenamento local anterior e a sincronização pela conta. Consulte [EDITORS.md](EDITORS.md) para comportamento, limites e instruções.
