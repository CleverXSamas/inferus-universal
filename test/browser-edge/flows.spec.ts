import { test, expect } from '@playwright/test';
test('Worker: login ChatGPT, ficha persistente e logout', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Entrar.*ChatGPT/ }).click();
  await page.getByRole('button', { name: 'Criar ficha', exact: true }).click();
  await page.getByRole('button', { name: /Atributos contidos d20/ }).click();
  await page.getByLabel('Nome da ficha').fill('Ficha D1');
  await page.getByLabel('Força', { exact: true }).fill('17');
  await page.getByRole('button', { name: 'Salvar na conta' }).click();
  await expect(page.getByRole('status')).toContainText('Ficha salva');
  const context = await browser.newContext();
  try {
    await context.addCookies([
      { name: 'edge-test-user', value: 'preview-owner', url: 'http://127.0.0.1:3103' },
    ]);
    const other = await context.newPage();
    await other.goto('/');
    await other.getByRole('button', { name: 'Criar ficha', exact: true }).click();
    await other.getByLabel('Carregar ficha da conta').selectOption({ label: 'Ficha D1' });
    await expect(other.getByLabel('Força', { exact: true })).toHaveValue('17');
    await other.getByRole('link', { name: 'Sair', exact: true }).click();
    await expect(other.getByRole('link', { name: /Entrar.*ChatGPT/ })).toBeVisible();
  } finally {
    await context.close();
  }
});
test('Worker: remoção de slash limpa token e mantém conexão por prefixo pendente', async ({
  page,
}) => {
  await page.goto('/discord');
  await page.getByRole('link', { name: 'Entre para gerenciar os comandos antigos' }).click();
  await page.getByRole('button', { name: 'Discord', exact: true }).click();
  await page.getByText('Remover comandos de barra antigos', { exact: true }).click();
  await page.getByLabel('Novo token do bot').fill('edge-fixture-token');
  await page.getByRole('button', { name: 'Remover comandos de barra', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(
    'Comandos de barra globais antigos removidos',
  );
  await expect(page.getByLabel('Novo token do bot')).toHaveValue('');
  await expect(page.getByRole('link', { name: 'Adicionar ao servidor Discord' })).toHaveAttribute(
    'href',
    /client_id=1528465674731782347/,
  );
  await expect(page.getByText('Conexão por prefixo pendente', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'edge-fixture-token',
  );
});
