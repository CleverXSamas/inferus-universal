import { test, expect } from '@playwright/test';
test('prévia usa abreviações e lotes, copia comando válido e não publica mensagens', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.goto('/discord');
  await page.getByLabel('Expressão de dados no Discord', { exact: true }).fill('6#4d6d1');
  await page.getByLabel('Nome da jogada', { exact: true }).fill('Atributos');
  await page.getByLabel('Dificuldade opcional', {exact:true}).fill('10');
  await page.getByRole('button', { name: 'Testar prévia', exact: true }).click();
  const batch = page.getByRole('region', { name: 'Prévia de rolagens repetidas' });
  await expect(batch).toContainText('6 rolagens independentes');
  await expect(batch.locator('.roll-batch-entry')).toHaveCount(6);
  await expect(batch).toContainText('Alvo 10');
  await expect(batch.locator('.batch-dropped')).toHaveCount(6);
  await page.getByRole('button', { name: 'Copiar !rolar', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '!rolar 6#4d6kh3 alvo:10 | Atributos',
  );
  await page.getByLabel('Expressão de dados no Discord', { exact: true }).fill('11#d20');
  await page.getByRole('button', { name: 'Testar prévia', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('1 a 10');
  await expect(batch).toHaveCount(0);
  await page.getByLabel('Expressão de dados no Discord', { exact: true }).fill('d%');
  await page.getByRole('button', { name: 'Testar prévia', exact: true }).click();
  await expect(page.locator('.roll-card-total')).toBeVisible();
  expect(posts).toEqual([]);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await page.getByLabel('Expressão de dados no Discord', { exact: true }).fill('6#4d6d1');
  await page.getByRole('button', { name: 'Testar prévia', exact: true }).click();
  await page.screenshot({ path: 'work/bot-batch-desktop-v13.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: 'work/bot-batch-mobile-v13.png', fullPage: true });
});
test('ficha aceita d20 e dado percentual sem reintroduzir rolador avulso', async ({ page }) => {
  await page.goto('/ficha');
  await page.getByRole('button', { name: /Atributos contidos d20/ }).click();
  await page.getByRole('button', { name: 'Rolar dados', exact: true }).click();
  const dock = page.getByRole('region', { name: 'Rolagem da ficha' });
  await page.getByLabel('Expressão dos dados da ficha', { exact: true }).fill('d%');
  await dock.getByRole('button', { name: 'Rolar', exact: true }).click();
  await expect(dock.getByTestId('simple-roll-result')).toBeVisible();
  await expect(dock).not.toContainText('Parte inválida');
  await expect(page.getByRole('navigation', {name:'Ferramentas da mesa'})).not.toContainText('Dado Aberto');
});
