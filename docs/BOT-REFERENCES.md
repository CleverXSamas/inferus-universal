# Revisão dos comandos — V13

Fontes oficiais consultadas:

- [Rollem: sintaxe V1](https://rollem.rocks/docs/v1-syntax): abreviação dY, seleção de dados, repetição X#A. [Repositório oficial](https://github.com/rollem-discord/rollem-discord) também documenta títulos e rolagens dentro do texto. [Rollem Next](https://rollem.rocks/docs/rollem-next) é o canal de atualizações antecipadas e possui seleção de versões de sintaxe por papéis. Não é uma gramática independente estável para copiar integralmente.
- [Mini Kraken: comandos](https://erpg.app/commands/): categorias de dados e personagens, comandos curtos e verificação de disponibilidade. A documentação atual usa slash; a preferência do Inferus continua sendo prefixos públicos.
- [ERPG Dice: dados](https://dice.erpg.app/docs/core/dice/) e [keep/drop](https://dice.erpg.app/docs/core/keep-drop/): abreviação do número de dados, percentual e aliases de manter/descartar. A documentação [do Core](https://dice.erpg.app/docs/core/) distingue a resolução dos resultados da apresentação visual.

## Aplicação no Inferus

Implementação própria, sem copiar código ou introduzir bibliotecas das referências:

- !r, !d, !dice, !roll e !rolar compartilham o mesmo parser. !help é alias de !ajuda. !ajuda dados abre expressões.
- d20 = 1d20; d% = 1d100; 4d6k3 = 4d6kh3; 4d6d1 = 4d6dl1. Os aliases também funcionam nas rolagens da ficha.
- !d d20+5 Percepção aceita título livre. O separador | permanece disponível para títulos inequívocos. Um título sem separador começa com letra; opções e operadores inválidos continuam sendo erros.
- !r 6#4d6d1 | Atributos cria seis resultados independentes numa única resposta, com descartes e sinais preservados. Todos os argumentos são validados antes de gerar resultados. Máximo de dez repetições e cem dados iniciais por lote; explosões mantêm o teto existente de 64 faces por dado.
- !ping confirma que o processo do bot respondeu naquele canal; não declara o banco ou vínculo de conta funcionando. !ficha continua verificando a integração real.
- Guia e prévia do site acompanham os comandos, inclusive lotes. Cada linha é uma jogada, sem um total agregado enganoso.

## Escopo e compatibilidade

Não há leitura automática de conversa, comandos sem prefixo ou registro de slash. Campanha/VTT/Dado Aberto permanecem removidos. Não se promete compatibilidade completa com Rollem ou ERPG: Fate, aritmética arbitrária, rerolls e modificadores combinados não foram acrescentados. Limites próprios de dados, lados e bônus são preservados. Arquivos de auditoria existentes continuam válidos.

O parser não usa eval nem executa texto do usuário. O bot mantém proteção de menções, restrições de canal, fallback de texto, cooldown por usuário e uma resposta por solicitação. Rolagens repetidas usam um cartão compacto; rolagens simples mantêm a apresentação animada já existente.
