

## Revisão — modo Campanha

O Duelo será removido da navegação e substituído por Campanha. Uma campanha terá um DM e até nove jogadores, totalizando no máximo 10 participantes. O DM cria a campanha e recebe um link privado de convite. O link carrega um token de convite aleatório; a API valida o token, impede entradas após o limite, registra participantes e expõe apenas o estado daquela campanha. O primeiro participante é o DM; os demais entram como jogadores. O DM pode copiar e revogar o link, ver participantes, registrar mensagens de mesa e iniciar ou pausar a sessão. Jogadores podem entrar, sair pelo nome local e enviar mensagens públicas.

A camada ficará separada em `server/campaigns.ts`, com armazenamento em memória para desenvolvimento sem banco e persistência MySQL quando `DATABASE_URL` existir. O fallback será declarado no health endpoint e não será apresentado como persistência de produção. A primeira interface usa polling cancelável para refletir até 10 participantes sem introduzir a complexidade de WebSocket antes de haver uma necessidade comprovada.

Não será criado login próprio de e-mail/senha. Nesta versão o token privado funciona como convite/capacidade de acesso e o nome informado define a identidade de mesa; isso é apropriado para um protótipo de campanha, mas não equivale a autenticação forte. Uma etapa posterior pode ligar Manus OAuth a papéis persistentes.
