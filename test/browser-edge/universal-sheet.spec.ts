import { test, expect } from '@playwright/test';
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
