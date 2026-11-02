# Inferus Universal

Inferus Universal é uma ferramenta local-first para mesa de campanha: rolador auditável, fichas personalizáveis, skill trees radiais, sala de campanha privada e contas persistentes para usar a mesa em diferentes dispositivos.

## Rodar

```bash
npm install
npm run dev
```

O servidor escuta em `http://localhost:3000`. `npm run build` produz o frontend em `dist/` e o servidor compilado em `dist-server/`. `npm run check` e `npm test` validam o núcleo.

## Conta, login e cadastro

A aba superior oferece **Entrar / criar conta**. O botão usa Manus OAuth: quem já tem uma conta entra e quem ainda não tem pode criar uma conta no fluxo do provedor. Não há senha local nem senha armazenada pelo Inferus.

Depois do retorno OAuth, o servidor registra ou atualiza o usuário no MySQL e cria uma sessão persistente de 30 dias. O cookie `webdev_app_session` é HttpOnly, Secure e `SameSite=None`, permitindo uso no Preview incorporado e no site publicado. A sessão não depende de `localStorage`, portanto o mesmo usuário pode entrar em outro dispositivo. Sair revoga a sessão atual.

O fluxo protege o callback com nonce de uso único em cookie curto, compara o `redirectUri` fixo da aplicação, troca o código no servidor e consulta a identidade no provedor. A API não aceita um `redirectUri` arbitrário vindo do navegador.

Sem `DATABASE_URL`, o modo de desenvolvimento usa memória e não oferece sobrevivência entre processos. O health endpoint informa `authStorage: memory` ou `authStorage: mysql`. No projeto gerenciado atual, o banco está habilitado.

## Campanha

Abra a aba Campanha para criar uma mesa. O DM informa o nome da campanha e seu nome de mesa; a aplicação gera um convite privado com token aleatório. O DM pode copiar ou revogar esse convite, ver os participantes, iniciar/pausar a sessão e publicar no diário. Jogadores entram pelo link, escolhem um nome e veem a sala. O limite é rígido: 10 participantes no total, sendo 1 DM e até 9 jogadores.

A sala atualiza por polling cancelável a cada cinco segundos. O servidor verifica o token, o papel e o limite; esconder o botão de DM no navegador não é a única proteção. Mensagens têm limite de 500 caracteres e nomes de 60 caracteres.

Quando `DATABASE_URL` está configurado, as tabelas `inferus_campaigns`, `inferus_campaign_participants`, `inferus_campaign_sessions`, `inferus_campaign_events`, `inferus_users` e `inferus_auth_sessions` são criadas de forma idempotente.

## Núcleo aberto

Presets de pool de dados, atributos contidos, escada narrativa, ação com posição/efeito, d20 e traços são pontos de partida editáveis e não oficiais. Fichas aceitam novas seções e árvores começam no centro, expandindo conforme as compras e aceitando skills próprias.

As rolagens usam fonte criptográfica, mantêm auditoria e têm som opcional local via Web Audio API. Nenhum áudio é enviado a um provedor externo.

## Limites conhecidos

O adaptador Discord ainda precisa de token, OAuth e URL pública. O parser de fórmulas ainda precisa de `floor`, `ceil`, `min`, `max` e `abs`; a suíte estatística de 10^6 amostras ainda é um job separado de CI.
