import { test, expect } from '@playwright/test';
test('Discord: prévia local, comando público, alvo e exemplos orientam sem enviar mensagens', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.goto('/discord');
  await expect(page.getByText('Conexão por prefixo pendente', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Adicionar ao servidor Discord', exact: true }),
  ).toHaveAttribute('href', /permissions=274877926400/);
  await page.getByLabel('Expressão de dados no Discord', { exact: true }).fill('1d6+5');
  await page.getByLabel('Dificuldade opcional', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Testar prévia', exact: true }).click();
  await expect(page.locator('.roll-card-meta')).toContainText('Passou');
  await page.getByRole('button', { name: 'Copiar !rolar', exact: true }).click();
  const command = await page.evaluate(() => navigator.clipboard.readText());
  expect(command).toContain('!rolar 1d6+5');
  expect(command).toContain('alvo:1');
  expect(command).toContain('| Teste de percepção');
  expect(command).not.toContain('privado');
  expect(posts).toHaveLength(0);
  await page.getByLabel('Expressão de dados no Discord', { exact: true }).fill('não é dado');
  await page.getByRole('button', { name: 'Testar prévia', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Vantagem', exact: true }).click();
  await expect(page.getByLabel('Expressão de dados no Discord', { exact: true })).toHaveValue(
    '2d20kh1+5',
  );
});
test('Discord: falha de remoção limpa token e permite nova tentativa sem armazenamento', async ({
  page,
}) => {
  await page.goto('/discord');
  await page
    .getByRole('link', { name: 'Entre para gerenciar os comandos antigos', exact: true })
    .click();
  await page.getByRole('button', { name: 'Discord', exact: true }).click();
  await page.getByText('Remover comandos de barra antigos', { exact: true }).click();
  await page.route('**/api/discord/setup', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Aguarde antes de tentar novamente.' }),
    }),
  );
  await page.getByLabel('Novo token do bot', { exact: true }).fill('fixture-rejected-token');
  await page.getByRole('button', { name: 'Remover comandos de barra', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Aguarde');
  await expect(page.getByLabel('Novo token do bot', { exact: true })).toHaveValue('');
  expect(
    await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage)),
  ).not.toContain('fixture-rejected-token');
  await expect(
    page.getByRole('button', { name: 'Remover comandos de barra', exact: true }),
  ).toBeDisabled();
});
