import { test, expect } from '@playwright/test';

test('mesa organiza diário, confirma controles destrutivos, reabre e recebe convite colado', async ({
  page,
  browser,
}) => {
  await page.goto('/campanhas');
  await page.getByLabel('Seu nome de mesa').fill('Mestre da aventura');
  await page.getByLabel('Nome da campanha').fill('Além da névoa');
  await page.getByRole('button', { name: 'Criar como DM' }).click();
  await expect(page.getByRole('region', { name: 'Resumo da campanha' })).toContainText(
    'Além da névoa',
  );
  await page.getByText('Convites e controles do mestre', { exact: true }).click();
  const invite = await page.getByLabel('Link de convite', { exact: true }).inputValue();
  const context = await browser.newContext();
  try {
    const player = await context.newPage();
    await player.goto('/campanhas');
    await player.getByRole('button', { name: 'Tenho um convite' }).click();
    await player.getByLabel('Convite da campanha', { exact: true }).fill(invite);
    await player.getByRole('button', { name: 'Abrir convite' }).click();
    await player.getByLabel('Seu nome de mesa').fill('Aventureira');
    await player.getByRole('button', { name: 'Entrar na campanha' }).click();
    await expect(player.locator('.participant.is-self')).toContainText('Aventureira · você');
    await expect(player.getByText('Convites e controles do mestre', { exact: true })).toHaveCount(
      0,
    );
    await page.getByLabel('Mensagem para a mesa').fill('Encontramos a torre ao norte.');
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(page.getByRole('log')).toContainText('Encontramos a torre');
    await page.getByRole('button', { name: 'Atividade', exact: true }).click();
    await expect(page.getByRole('log')).not.toContainText('Encontramos a torre');
    await page.getByRole('button', { name: 'Mensagens', exact: true }).click();
    await page.getByLabel('Buscar no diário').fill('ausente');
    await expect(page.getByRole('log')).toContainText('Nenhum registro encontrado');
    await page.getByLabel('Buscar no diário').fill('torre');
    await expect(page.getByRole('log')).toContainText('Encontramos a torre');
    await page.getByRole('button', { name: 'Encerrar sessão', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByLabel('Mensagem para a mesa')).toBeVisible();
    await page.getByRole('button', { name: 'Encerrar sessão', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.locator('.campaign-status')).toHaveText('Encerrada');
    await expect(page.getByLabel('Mensagem para a mesa')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reabrir sessão', exact: true }).click();
    await expect(page.locator('.campaign-status')).toHaveText('Em andamento');
    await expect(page.getByLabel('Mensagem para a mesa')).toBeVisible();
    await page.getByRole('button', { name: 'Remover Aventureira da campanha' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.locator('.participant')).toHaveCount(2);
    await page.getByRole('button', { name: 'Remover Aventureira da campanha' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.locator('.participant')).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole('button', { name: 'Ver diário', exact: true }).click();
    await expect(page.getByRole('log')).toBeVisible();
    await expect(page.locator('.campaign-room')).toBeHidden();
    await page.getByRole('button', { name: 'Ver personagens', exact: true }).click();
    await expect(page.locator('.campaign-room')).toBeVisible();
    await expect(page.getByRole('log')).toBeHidden();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
  } finally {
    await context.close();
  }
});

test('bot seleciona campanha, anota e muda sessão refletindo no site; link abre mesa certa', async ({
  page,
  request,
  browser,
}) => {
  await page
    .context()
    .addCookies([
      { name: 'edge-test-user', value: 'campaign-bot-e2e', url: 'http://127.0.0.1:3103' },
    ]);
  const created = await (
    await page.request.post('/api/campaigns', {
      data: { name: 'Mesa pelo Discord', dmName: 'Mestre conectado' },
    })
  ).json();
  const second = await (
    await page.request.post('/api/campaigns', {
      data: { name: 'Outra mesa', dmName: 'Mesmo mestre' },
    })
  ).json();
  await page.goto(`/campanhas?mesa=${created.state.id}`);
  await expect(page.getByRole('heading', { name: 'Mesa pelo Discord', exact: true })).toBeVisible();
  const code = await (
    await page.request.post('/api/discord/account', { data: { action: 'create-pair' } })
  ).json();
  const headers = { authorization: 'Bot edge-fixture-token-for-discord-link' },
    discordId = '333333333333333333';
  await request.post('/api/discord/bot', {
    headers,
    data: { action: 'pair', discordId, code: code.code, displayName: 'Mestre do bot' },
  });
  const pending = await (await page.request.get('/api/discord/account')).json();
  await page.request.post('/api/discord/account', {
    data: { action: 'confirm', pairId: pending.pending.id },
  });
  expect(
    (
      await request.post('/api/discord/bot', {
        headers,
        data: { action: 'campaign', discordId, query: created.state.id },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post('/api/discord/bot', {
        headers,
        data: { action: 'note', discordId, text: 'O dragão foi avistado.' },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post('/api/discord/bot', {
        headers,
        data: { action: 'session', discordId, status: 'paused' },
      })
    ).ok(),
  ).toBe(true);
  await expect(page.getByRole('log')).toContainText('O dragão foi avistado.', { timeout: 10000 });
  await expect(page.locator('.campaign-status')).toHaveText('Pausada');
  await page.getByLabel('Abrir campanha da conta').selectOption(second.state.id);
  await expect(page.getByRole('heading', { name: 'Outra mesa', exact: true })).toBeVisible();
  await page.goto(`/campanhas?mesa=${created.state.id}`);
  await expect(page.getByRole('heading', { name: 'Mesa pelo Discord', exact: true })).toBeVisible();
  const guest = await browser.newContext();
  try {
    const p = await guest.newPage();
    await p.goto(`/campanhas?mesa=${created.state.id}`);
    await expect(
      p.getByRole('link', { name: 'Entrar para abrir a campanha', exact: true }),
    ).toHaveAttribute('href', new RegExp(`mesa%3D${created.state.id}`));
  } finally {
    await guest.close();
  }
});

test('guia filtra comandos, recupera busca vazia e permanece legível no celular', async ({
  page,
}) => {
  await page.goto('/discord');
  const guide = page.getByRole('region', { name: 'Guia de comandos do Inferus' });
  await guide.getByRole('button', { name: 'Campanha', exact: true }).click();
  await expect(guide).toContainText('!campanha usar Nome da campanha');
  await expect(guide.getByRole('heading', { name: 'Rolar com contexto' })).toHaveCount(0);
  await guide.getByLabel('Buscar comando').fill('sessão');
  await expect(guide.getByRole('heading', { name: 'Controlar a sessão' })).toBeVisible();
  await guide.getByLabel('Buscar comando').fill('impossível');
  await expect(guide).toContainText('Nenhum comando encontrado');
  await guide.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(guide.getByRole('heading', { name: 'Rolar com contexto' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
