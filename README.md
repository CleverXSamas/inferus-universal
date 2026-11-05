# Inferus Universal

Fichas universais, skill trees e integração com Discord. O site abre na ficha e mantém três áreas: **Criar ficha**, **Criar árvore** e **Discord**.

## Desenvolvimento

Node 22.18 ou superior:

```bash
npm ci
npm run build
npm run dev
```

O frontend compilado fica em `dist/` e o servidor em `dist-server/`. Em produção Node, use `npm start`. Variáveis em `.env.example`; mantenha segredos nas variáveis da hospedagem.

## Ficha e skill tree

A ficha aceita atributos, texto, recursos, listas, fórmulas e ações de dados. Sistema e conceito são livres. Fixe os campos essenciais com ☆ para vê-los em **Modo jogo → Em jogo**. A busca encontra campos por nome ou referência sem alterar o documento. Importação JSON de até 128 KB valida ficha e árvore, pede confirmação e permite desfazer. A exportação inclui a árvore do personagem.

No estúdio, crie skills e ramos, reutilize modelos da biblioteca, mova sequências e remova skills/ramos com confirmação e Desfazer. **Localizar skill no mapa** seleciona e centraliza qualquer skill. Custos e efeitos são aplicados manualmente na ficha.

A cópia local é salva no navegador. **Salvar na conta** sincroniza explicitamente a ficha e sua árvore; depois carregue-a em outro dispositivo. O salvamento mais recente substitui a cópia da conta. Fórmulas usam referências e funções permitidas, sem executar JavaScript.

## Discord

Use `!login`, gere um código no site, envie `!vincular CÓDIGO` e confirme sua identidade no site. Depois:

- `!fichas [página]` lista suas fichas salvas.
- `!ficha usar Nome completo` ou `!ficha usar ID` escolhe o personagem.
- `!ficha` resume atributos e recursos; `!skills [página]` lista desbloqueios.
- `!acoes [página]` mostra comandos; `!acao Ataque alvo:15` rola uma ação da ficha.
- `!rolar 1d20+5 alvo:15 | Percepção` continua disponível no Discord.
- `!ajuda`, `!ajuda personagem`, `!ajuda expressoes` e `!ajuda privacidade` orientam o uso.

Comandos e respostas são públicos no canal. O bot só lê fichas do dono vinculado; campos de texto da ficha são excluídos da resposta. Uma seleção antiga de modo removido exige escolher novamente uma ficha. O site não hospeda o Discord Gateway: rode `npm run build && npm run start:bot` em processo Node persistente com Message Content Intent habilitado. Consulte [docs/DISCORD.md](docs/DISCORD.md) e o pacote Discloud.

## Hospedagem e dados

Site: https://inferus-universal.peneseretu.chatgpt.site

Sites usa login ChatGPT com vínculo confirmado ao Discord e persistência D1. A alternativa Node usa Manus OAuth e MySQL (`DATABASE_URL`); configure `MANUS_PROJECT_ID`, `MANUS_OAUTH_API_URL`, `MANUS_OAUTH_PORTAL_URL` e `PUBLIC_ORIGIN`. `MANUS_JWT_SECRET` serve para sessões JWT de Preview. Sem banco, o servidor Node usa memória apenas para desenvolvimento.

Campanha, VTT e Dado Aberto foram retirados da interface, dos módulos, das APIs e dos comandos do bot. Links antigos abrem a ficha. Migrações históricas do banco são preservadas para atualizar instalações existentes, sem apagar registros por uma mudança de interface. Rolagens da ficha e do bot usam o mesmo motor.

## Validação

```bash
npm run check
npm run check:edge
npm test
npm run test:browser
npm run test:browser:edge
```

`npm test` limpa os artefatos compilados antigos antes de executar a suíte. `npm run test:full` provisiona MySQL descartável com Docker; também aceita `TEST_DATABASE_URL` de banco dedicado a testes. Nunca use banco de produção. O CI executa os testes de persistência com MySQL. `npm run package:sites` prepara o Worker; `npm run package:bot` gera o ZIP do bot com token vazio.

### Comandos V13

Atalhos: `!d d20+5 Percepção`, `!dice d%`, `!r 6#4d6d1 | Atributos`, `!help`, `!ajuda dados` e `!ping`. Repetições têm resultados independentes, até dez por lote e cem dados iniciais no total. Os comandos anteriores continuam válidos. [Referências e limites](docs/BOT-REFERENCES.md).
