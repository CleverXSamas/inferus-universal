import { test, expect, type BrowserContext } from '@playwright/test';
import { createHmac } from 'node:crypto';
async function login(context: BrowserContext, openId: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
    payload = Buffer.from(
      JSON.stringify({
        openId,
        name: 'Pessoa de teste',
        appId: 'browser-tests',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url');
  const signature = createHmac('sha256', 'browser-test-only-secret')
    .update(`${header}.${payload}`)
    .digest('base64url');
  await context.addCookies([
    {
      name: 'webdev_app_session',
      value: `${header}.${payload}.${signature}`,
      url: 'http://127.0.0.1:3100',
      httpOnly: true,
    },
  ]);
}
test('rolagem continua disponível com histórico local corrompido', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fragmentos-rolls', 'corrompido'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Rolar', exact: true }).click();
  await expect(page.locator('.big-number')).toBeVisible();
  await expect(page.locator('.history-item')).toHaveCount(1);
});
test('ficha editável sincroniza pela conta em outro navegador', async ({ browser }) => {
  const first = await browser.newContext(),
    second = await browser.newContext();
  try {
    await login(first, 'sheet-browser-person');
    await login(second, 'sheet-browser-person');
    const a = await first.newPage();
    await a.goto('/');
    await a.getByRole('button', { name: 'Criar ficha', exact: true }).click();
    await a.getByRole('button', { name: /Atributos contidos d20/ }).click();
    await a.getByLabel('Nome da ficha').fill('Ficha sincronizada');
    await a.getByLabel('Força', { exact: true }).fill('18');
    await a.getByRole('button', { name: 'Salvar na conta', exact: true }).click();
    await expect(a.getByRole('status')).toContainText('Ficha salva');
    const b = await second.newPage();
    await b.goto('/');
    await b.getByRole('button', { name: 'Criar ficha', exact: true }).click();
    await expect(
      b.getByLabel('Carregar ficha da conta').getByRole('option', { name: 'Ficha sincronizada' }),
    ).toHaveCount(1);
    await b.getByLabel('Carregar ficha da conta').selectOption({ label: 'Ficha sincronizada' });
    await expect(b.getByLabel('Força', { exact: true })).toHaveValue('18');
    await b.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(b.getByLabel('Carregar ficha da conta')).toHaveCount(0);
  } finally {
    await first.close();
    await second.close();
  }
});
test('convite não permite assumir DM; revogação preserva a sala', async ({ browser }) => {
  const dm = await browser.newContext(),
    player = await browser.newContext();
  try {
    const a = await dm.newPage();
    await a.goto('/');
    await a.getByRole('button', { name: 'Campanha', exact: true }).click();
    await a.getByLabel('Seu nome de mesa').fill('Guia');
    await a.getByLabel('Nome da campanha').fill('Mesa segura');
    await a.getByRole('button', { name: 'Criar como DM' }).click();
    await expect(a.getByRole('heading', { name: 'Mesa segura' })).toBeVisible();
    const invite = a.url();
    const b = await player.newPage();
    await b.goto(invite);
    await b.getByLabel('Seu nome de mesa').fill('Guia');
    await b.getByRole('button', { name: 'Entrar na campanha' }).click();
    await expect(b.getByRole('alert')).toContainText('Nome já utilizado');
    await b.getByLabel('Seu nome de mesa').fill('Jogadora');
    await b.getByRole('button', { name: 'Entrar na campanha' }).click();
    await expect(b.getByRole('heading', { name: 'Mesa segura' })).toBeVisible();
    await expect(b.getByRole('button', { name: 'Iniciar sessão' })).toHaveCount(0);
    await a.getByRole('button', { name: 'Revogar convite' }).click();
    await expect(a.getByText('Convite revogado. Os membros mantêm acesso à mesa.')).toBeVisible();
    await b.reload();
    await expect(b.getByRole('heading', { name: 'Mesa segura' })).toBeVisible();
    await a.getByRole('button', { name: 'Gerar novo convite' }).click();
    await expect(a.locator('.invite-box')).toContainText('LINK PRIVADO');
    expect(a.url()).not.toEqual(invite);
    await a.reload();
    await expect(a.getByRole('heading', { name: 'Mesa segura' })).toBeVisible();
  } finally {
    await dm.close();
    await player.close();
  }
});
test('campanha de convidado pode ser vinculada com sua sessão original', async ({ browser }) => {
  const first = await browser.newContext(),
    second = await browser.newContext();
  try {
    const a = await first.newPage();
    await a.goto('/');
    await a.getByRole('button', { name: 'Campanha', exact: true }).click();
    await a.getByLabel('Seu nome de mesa').fill('Guia migrada');
    await a.getByLabel('Nome da campanha').fill('Campanha da conta');
    await a.getByRole('button', { name: 'Criar como DM' }).click();
    await expect(a.getByRole('heading', { name: 'Campanha da conta' })).toBeVisible();
    await login(first, 'campaign-browser-person');
    await a.reload();
    await a.getByRole('button', { name: 'Vincular participação à conta' }).click();
    await expect(a.getByRole('status')).toContainText('vinculada');
    await login(second, 'campaign-browser-person');
    const b = await second.newPage();
    await b.goto('/');
    await b.getByRole('button', { name: 'Campanha', exact: true }).click();
    await b.getByLabel('Abrir campanha da conta').selectOption({ label: 'Campanha da conta' });
    await expect(b.getByRole('heading', { name: 'Campanha da conta' })).toBeVisible();
    await expect(b.getByRole('button', { name: 'Iniciar sessão' })).toBeVisible();
    await b.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(b.getByRole('heading', { name: 'Campanha da conta' })).toHaveCount(0);
  } finally {
    await first.close();
    await second.close();
  }
});
