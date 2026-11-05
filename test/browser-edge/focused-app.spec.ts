import { test, expect } from '@playwright/test';
test('navegação remove os modos antigos e mantém ficha, árvore e Discord sem overflow', async ({
  page,
  request,
}) => {
  for (const old of ['/', '/campanhas', '/campaign/convite-antigo']) {
    await page.goto(old);
    await expect(page).toHaveURL(/\/ficha$/);
    await expect(page.getByRole('navigation')).not.toContainText(/Campanha|Dado Aberto/);
  }
  for (const path of [
    '/api/campaigns',
    '/api/campaigns/tabletop',
    '/api/roll',
    '/api/history',
    '/api/presets',
  ])
    expect((await request.post(path, { data: {} })).status()).toBe(404);
  await page.getByRole('button', { name: 'Criar árvore', exact: true }).click();
  const jump = page.getByLabel('Localizar skill no mapa', { exact: true });
  const id = await jump.locator('option').nth(1).getAttribute('value');
  await jump.selectOption(id!);
  await expect(page.locator('#skill-inspector')).not.toContainText('Explore um caminho.');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await page.screenshot({ path: 'work/focused-tree-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: 'work/focused-tree-mobile.png', fullPage: true });
});
test('ficha busca sem perder campos, importa com confirmação e preserva rolagem com som', async ({
  page,
}) => {
  await page.goto('/ficha');
  await page.getByRole('button', { name: /Atributos contidos d20/ }).click();
  await page.getByLabel('Força', { exact: true }).fill('18');
  await page.getByLabel('Buscar campos na ficha', { exact: true }).fill('forca');
  await expect(page.getByLabel('Força', { exact: true })).toHaveValue('18');
  await expect(page.getByLabel('Destreza', { exact: true })).toHaveCount(0);
  await page.getByLabel('Buscar campos na ficha', { exact: true }).fill('inexistente');
  await expect(
    page.getByRole('status').filter({ hasText: 'Nenhum campo encontrado' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Limpar busca', exact: true }).click();
  await expect(page.getByLabel('Destreza', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rolar dados', exact: true }).click();
  const dock = page.getByRole('region', { name: 'Rolagem da ficha' });
  await page.getByLabel('Expressão dos dados da ficha', { exact: true }).fill('1d6+2');
  await dock.getByRole('button', { name: 'Rolar', exact: true }).click();
  await expect(dock.getByTestId('simple-roll-result')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar rolagem', exact: true }).click();
  const file = {
    name: 'heroi.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        id: 'importado',
        name: 'Nova personagem',
        system: 'Sistema próprio',
        sections: [],
      }),
    ),
  };
  await page.getByLabel('Arquivo da ficha').setInputFiles(file);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Importar esta ficha');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByLabel('Força', { exact: true })).toHaveValue('18');
  await page.getByLabel('Arquivo da ficha').setInputFiles(file);
  await dialog.getByRole('button', { name: 'Importar ficha', exact: true }).click();
  await expect(page.getByLabel('Nome da ficha', { exact: true })).toHaveValue('Nova personagem');
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.getByLabel('Força', { exact: true })).toHaveValue('18');
  await page.getByLabel('Arquivo da ficha').setInputFiles({
    name: 'invalido.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.getByRole('alert')).toContainText('Ficha inválida');
});
