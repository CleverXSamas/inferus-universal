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
