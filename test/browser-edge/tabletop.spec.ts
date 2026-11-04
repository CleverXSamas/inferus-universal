import { test, expect } from '@playwright/test';
test('mesa virtual sincroniza, oculta tokens, move por teclado, persiste e cabe no celular', async ({
  page,
  browser,
}) => {
  await page.goto('/campanhas');
  await page.getByLabel('Seu nome de mesa').fill('Mestre VTT');
  await page.getByLabel('Nome da campanha').fill('Fronteiras');
  await page.getByRole('button', { name: 'Criar como DM' }).click();
  await page.getByText('Convites e controles do mestre', { exact: true }).click();
  const invite = await page.getByLabel('Link de convite', { exact: true }).inputValue();
  const context = await browser.newContext();
  try {
    const player = await context.newPage();
    await player.goto(invite);
    await player.getByLabel('Seu nome de mesa').fill('Jogadora VTT');
    await player.getByRole('button', { name: 'Entrar na campanha' }).click();
    for (const p of [page, player])
      await p.getByRole('button', { name: 'Abrir mesa virtual', exact: true }).click();
    await page.getByLabel('NPC ou criatura').fill('Sentinela');
    await page.getByRole('button', { name: 'Adicionar token', exact: true }).click();
    const token = page.getByRole('button', { name: 'Token Sentinela', exact: true });
    await expect(token).toBeVisible();
    await token.click();
    await token.press('ArrowRight');
    await expect(page.locator('.token-inspector')).toContainText('Coluna 2 · linha 1');
    await expect(player.getByRole('button', { name: 'Token Sentinela', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await player.getByRole('button', { name: 'Token Sentinela', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Retirar da cena', exact: true })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: 'Ocultar dos outros jogadores', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Token Sentinela', exact: true })).toHaveCount(
      0,
      { timeout: 10000 },
    );
    await page.getByRole('button', { name: 'Configurar cena', exact: true }).click();
    await page.getByLabel('Nome da cena', { exact: true }).fill('A ponte antiga');
    await page.getByRole('button', { name: 'Salvar cena', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'A ponte antiga' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Abrir mesa virtual', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'A ponte antiga' })).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
    expect((await page.locator('.tabletop').boundingBox())!.height).toBeLessThan(850);
    await page.screenshot({ path: 'work/tabletop-desktop-v11.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({ path: 'work/tabletop-mobile-v11.png', fullPage: true });
  } finally {
    await context.close();
  }
});

test('ficha universal fixa campos, sincroniza valores e mantém identidade após recarregar', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar ficha', exact: true }).click();
  await page.getByRole('button', { name: /Atributos contidos d20/ }).click();
  await page.getByLabel('Sistema de RPG', { exact: true }).fill('Regras da nossa mesa');
  await page.getByLabel('Conceito do personagem', { exact: true }).fill('Cartógrafa das estrelas');
  await page.getByRole('button', { name: 'Adicionar módulo Vitalidade', exact: true }).click();
  await page.getByRole('button', { name: 'Fixar Vida', exact: true }).click();
  await page.getByRole('button', { name: 'Modo jogo', exact: true }).click();
  const quick = page.getByRole('region', { name: 'Em jogo', exact: true });
  await expect(quick).toBeVisible();
  await quick.getByRole('button', { name: 'Reduzir Vida', exact: true }).click();
  for (const input of await page.getByLabel('Vida atual', { exact: true }).all())
    await expect(input).toHaveValue('9');
  await page.reload();
  await page.getByRole('button', { name: 'Criar ficha', exact: true }).click();
  await expect(page.getByLabel('Sistema de RPG', { exact: true })).toHaveValue(
    'Regras da nossa mesa',
  );
  await expect(page.getByRole('button', { name: 'Desafixar Vida', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Modo jogo', exact: true }).click();
  await expect(quick.getByLabel('Vida atual', { exact: true })).toHaveValue('9');
  await page.screenshot({ path: 'work/sheet-quickplay-v11.png', fullPage: true });
});
