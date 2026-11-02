# Fragmentos — plano

## Direção
Implementação local completa do núcleo funcional em TypeScript, com uma aplicação web responsiva em React e uma API HTTP compartilhada. A integração real com Discord fica atrás de um adaptador, porque registro OAuth, token e credenciais do bot são externos ao repositório.

## Produto
- Rolador auditável do Dado Aberto: parser, grupos, kh/kl/dh/dl, explosão, sucessos, bônus, alvo, UUID, histórico e presets.
- Ficha configurável: seções, campos e fórmulas seguras com referências `@id`, sem execução de código.
- Skill tree: pool, DAG determinístico por seed, validação, preview, compra idempotente e efeitos.
- Interface escura e sóbria, com forma e rótulo além da cor, responsiva e com `prefers-reduced-motion`.
- API para servir a web e o futuro bot Discord.

## Estilo escolhido
**Arquivo de campanha noturna** (probabilidade 0,06): uma ferramenta de mesa com densidade editorial, contraste alto, superfícies de papel escuro e acentos coloridos de status.

**Princípios:** leitura rápida em mesa; dados sempre explicáveis; ações destrutivas explicitamente marcadas; personalidade sem copiar marcas existentes.

**Cores:** carvão e marfim para reduzir fadiga; violeta, âmbar e coral identificam tipos, mas cada tipo também possui forma e texto.

**Layout:** painel lateral fixo e tela de trabalho em camadas, com a árvore ocupando uma tela ampla e cartões de detalhe na lateral.

**Assinaturas:** régua de status com pequenos marcadores; cartões com “evidência” da rolagem; nós geométricos com brilho contido.

**Interação:** cada resultado mostra como chegou ao total. Animações curtas só reforçam mudança de estado e são desligadas para movimento reduzido.

**Tipografia:** Inter para interface e Space Mono para expressões, números e identificadores.

**Voz:** direta, em português brasileiro. Exemplos: “A rolagem deixa um rastro auditável.” e “Compre o próximo nó quando a cadeia estiver pronta.”

## Estrutura
`packages/dice-core` contém parser e rolagem pura; `sheet-engine` contém esquema e fórmulas; `tree-core` contém DAG, seed e compra; `server` expõe API e serve o build; `src` contém a interface; `test` contém testes determinísticos rápidos.

## Decisões técnicas
Usamos uma implementação independente do motor referenciado. A rolagem usa `crypto.getRandomValues` no navegador e `crypto.randomInt` no Node, com rejeição para evitar viés. O limite de explosão confirmado no motor de referência é 64 níveis. O limite de 40 dados é do núcleo; a interface restringe grupos a 20. A persistência local desta entrega usa memória/localStorage no cliente; o servidor já possui endpoints e pode receber SQLite sem mudar o contrato.
