import { test, expect, type Page } from '@playwright/test';
import { roll } from '../../packages/dice-core';
async function campaign(page: Page) {
  await page.goto('/campanhas');
  await page.getByRole('link', { name: /Entrar.*ChatGPT/ }).click();
  await page.getByLabel('Seu nome de mesa').fill('Guia da revisão');
  await page.getByLabel('Nome da campanha').fill('Campanha da revisão');
  await page.getByLabel('Nome da campanha').press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Campanha da revisão', exact: true }),
  ).toBeVisible();
}
test('campanha: seletor acompanha sala, criação pode cancelar e sessão usa português', async ({
  page,
}) => {
  await campaign(page);
  const saved = await page.evaluate(() => localStorage.getItem('inferus-campaign-access-v2'));
  await expect(page.getByLabel('Abrir campanha da conta')).not.toHaveValue('');
  const toolbar = page.getByRole('region', { name: 'Gerenciar campanhas' });
  await expect(toolbar.getByRole('button', { name: 'Criar outra campanha' })).toBeVisible();
  await page.getByRole('button', { name: 'Criar outra campanha' }).click();
  await expect(page.getByLabel('Nome da campanha')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar à campanha' }).click();
  expect(await page.evaluate(() => localStorage.getItem('inferus-campaign-access-v2'))).toBe(saved);
  await expect(page.locator('.campaign-status')).toHaveText('Aguardando jogadores');
  await page.getByRole('button', { name: 'Iniciar sessão' }).click();
  await expect(page.locator('.campaign-status')).toHaveText('Em andamento');
  await page.getByRole('button', { name: 'Pausar sessão' }).click();
  await expect(page.locator('.campaign-status')).toHaveText('Pausada');
  await expect(page.getByRole('log')).toContainText('Sessão: Pausada.');
  await page.reload();
  await expect(page.locator('.campaign-status')).toHaveText('Pausada');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(toolbar.getByRole('button', { name: 'Criar outra campanha' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
});
test('navegação preserva tela ao recarregar, voltar e entrar na conta', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar ficha', exact: true }).click();
  await expect(page).toHaveURL(/\/ficha$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Criar ficha', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Criar árvore', exact: true }).click();
  await expect(page).toHaveURL(/\/arvore$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Criar ficha', exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Criar árvore', exact: true })).toBeVisible();
  await page.goto('/discord');
  const login = page.getByRole('link', { name: /Entrar.*ChatGPT/ });
  await expect(login).toHaveAttribute('href', /return_to=%2Fdiscord/);
  await login.click();
  await expect(page).toHaveURL(/\/discord$/);
  await expect(page.getByRole('heading', { name: 'Discord', exact: true })).toBeVisible();
});
test('histórico parcialmente corrompido mantém só jogadas válidas sem quebrar o resultado', async ({
  page,
}) => {
  const good = roll('2d20kh1+5');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    (result) =>
      localStorage.setItem(
        'fragmentos-rolls',
        JSON.stringify([
          { roll_id: 'quebrado', groups: [{ dice: [] }] },
          { ...result, expression: 'expressão inválida' },
          { ...result, groups: [{ raw: '2d20kh1', dice: [{}] }] },
          result,
        ]),
      ),
    good,
  );
  await page.goto('/');
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.locator('.history-item').click();
  await expect(page.locator('.big-number')).toHaveText(String(good.total));
  expect(errors).toEqual([]);
});
test('diário preserva texto digitado enquanto a mensagem anterior está sendo enviada', async ({
  page,
}) => {
  await campaign(page);
  let release!: () => void,
    held = false;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/campaigns/event', async (route) => {
    const response = await route.fetch();
    held = true;
    await pending;
    await route.fulfill({ response });
  });
  const input = page.getByLabel('Mensagem para a mesa');
  await input.fill('Mensagem enviada');
  await input.press('Enter');
  await expect.poll(() => held).toBe(true);
  await input.fill('Próxima mensagem ainda em rascunho');
  release();
  await expect(page.getByRole('log')).toContainText('Mensagem enviada');
  await expect(input).toHaveValue('Próxima mensagem ainda em rascunho');
});
test('erro HTML do serviço vira aviso legível e permite tentar novamente', async ({ page }) => {
  await page.route(
    '**/api/campaigns',
    (route) =>
      route.fulfill({ status: 503, contentType: 'text/html', body: '<h1>Unavailable</h1>' }),
    { times: 1 },
  );
  await page.goto('/campanhas');
  await page.getByLabel('Seu nome de mesa').fill('Guia');
  await page.getByLabel('Nome da campanha').fill('Mesa com nova tentativa');
  await page.getByRole('button', { name: 'Criar como DM' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível concluir a ação');
  await expect(page.getByRole('alert')).not.toContainText('JSON');
  await page.getByRole('button', { name: 'Criar como DM' }).click();
  await expect(
    page.getByRole('heading', { name: 'Mesa com nova tentativa', exact: true }),
  ).toBeVisible();
});
