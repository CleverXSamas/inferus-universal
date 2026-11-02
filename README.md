# Fragmentos

Aplicação local-first para mesa de campanha: rolador auditável, ficha personalizável, skill tree radial determinística e adaptador de comandos Discord.

## Rodar

```bash
npm install
npm run dev
```

O servidor escuta em `http://localhost:3000`. `npm run build` produz o frontend em `dist/` e o servidor compilado em `dist-server/`. `npm run check` e `npm test` validam o núcleo.

## O que mudou na versão 1.1

A aplicação começa perguntando como a mesa gosta de jogar, em vez de pedir uma planilha vazia. Há presets de pool de dados por pontos, dois dados de atributo, escada narrativa, ação com posição/efeito, d20 contido e pool modular por tamanhos de dado. Eles são sínteses originais, não oficiais, com fontes na interface.

Os presets não são sistemas fechados. O usuário pode trocar o ponto de partida, editar o resultado, adicionar seções e inserir campos próprios. Na árvore, o fluxo também começa por uma escolha guiada e permite adicionar uma skill customizada conectada ao centro. A árvore visual é radial: o centro fica fixo e a progressão abre para fora conforme os nós são comprados.

As rolagens têm som opcional sintetizado localmente pela Web Audio API. Nenhum áudio ou dado da rolagem é enviado para um provedor de som.

## Limites honestos

O bot é um adaptador pronto para receber um `discord.js` Interaction, mas não registra uma aplicação Discord sem `DISCORD_TOKEN`, OAuth e URL pública. O demo guarda histórico e ficha no navegador para funcionar sem conta. Antes de produção, ligue autenticação, SQLite e armazenamento privado; o endpoint HTTP já está separado para essa evolução.

A suíte estatística de 10^6 amostras não roda no caminho rápido de CI desta entrega. O parser ainda precisa receber as funções `floor`, `ceil`, `min`, `max` e `abs` previstas na especificação original.
