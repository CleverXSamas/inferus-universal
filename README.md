# Fragmentos

Aplicação local-first para mesa de campanha: rolador auditável, ficha personalizável, skill tree determinística e adaptador de comandos Discord.

## Rodar

```bash
npm install
npm run dev
```

O servidor escuta em `http://localhost:3000`. `npm run build` produz o frontend em `dist/` e o servidor compilado em `dist-server/`. `npm run check` e `npm test` validam o núcleo.

## O que está implementado

A interface tem quatro áreas: Dado Aberto, Ficha, Árvore e Duelo. O núcleo de dados aceita XdY, explosão, manter/descartar, grupos com sinal, bônus, sucesso `>=N`, alvo e auditoria. A fonte aleatória é criptográfica; não existe `Math.random` em rolagem real.

A ficha implementa seções, campos, recursos, ações e fórmulas com parser próprio. A árvore valida DAG, gera pela seed de personagem/nível/mundo, oferece formas visuais distintas por tipo e compra idempotente no contrato do núcleo/API.

## Limites honestos

O bot é um adaptador pronto para receber um `discord.js` Interaction, mas não registra uma aplicação Discord sem `DISCORD_TOKEN`, OAuth e URL pública. O demo guarda histórico e ficha no navegador para funcionar sem conta. Antes de produção, ligue autenticação, SQLite e armazenamento privado; o endpoint HTTP já está separado para essa evolução.

A suíte estatística de 10^6 amostras não roda no caminho rápido de CI desta entrega. Ela deve ser adicionada como job separado antes de afirmar conformidade estatística de produção.
