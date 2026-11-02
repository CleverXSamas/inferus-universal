# Inferus Universal

Inferus Universal é uma ferramenta local-first para mesa de campanha: rolador auditável, fichas personalizáveis, skill trees radiais e uma sala de campanha privada para um DM e até nove jogadores.

## Rodar

```bash
npm install
npm run dev
```

O servidor escuta em `http://localhost:3000`. `npm run build` produz o frontend em `dist/` e o servidor compilado em `dist-server/`. `npm run check` e `npm test` validam o núcleo.

## Campanha

Abra a aba Campanha para criar uma mesa. O DM informa o nome da campanha e seu nome de mesa; a aplicação gera um convite privado com token aleatório. O DM pode copiar ou revogar esse convite, ver os participantes, iniciar/pausar a sessão e publicar no diário. Jogadores entram pelo link, escolhem um nome e veem a sala. O limite é rígido: 10 participantes no total, sendo 1 DM e até 9 jogadores.

A sala atualiza por polling cancelável a cada cinco segundos. O servidor verifica o token, o papel e o limite; esconder o botão de DM no navegador não é a única proteção. Mensagens têm limite de 500 caracteres e nomes de 60 caracteres.

Quando `DATABASE_URL` está configurado, as tabelas `inferus_campaigns`, `inferus_campaign_participants`, `inferus_campaign_sessions` e `inferus_campaign_events` são criadas de forma idempotente e a campanha sobrevive ao reinício do processo. Sem banco, o health endpoint informa `campaignStorage: memory`; esse modo é apenas desenvolvimento e perde campanhas ao reiniciar.

O convite é uma capacidade privada, não autenticação forte de identidade. Nesta versão não há login próprio e nomes não são prova de identidade. Para uma operação pública com controle de conta, a próxima etapa é ligar Manus OAuth e associar participantes a usuários persistentes.

## Núcleo aberto

Presets de pool de dados, atributos contidos, escada narrativa, ação com posição/efeito, d20 e traços são pontos de partida editáveis e não oficiais. Fichas aceitam novas seções e árvores começam no centro, expandindo conforme as compras e aceitando skills próprias.

As rolagens usam fonte criptográfica, mantêm auditoria e têm som opcional local via Web Audio API. Nenhum áudio é enviado a um provedor externo.

## Limites conhecidos

O adaptador Discord ainda precisa de token, OAuth e URL pública. O parser de fórmulas ainda precisa de `floor`, `ceil`, `min`, `max` e `abs`; a suíte estatística de 10^6 amostras ainda é um job separado de CI.
