import { test, expect } from '@playwright/test';

test('guia filtra comandos, recupera busca vazia e permanece legível no celular', async ({
  page,
}) => {
  await page.goto('/discord');
  const guide = page.getByRole('region', { name: 'Guia de comandos do Inferus' });
  await guide.getByRole('button', { name: 'Personagem', exact: true }).click();
  await expect(guide).toContainText('!ficha usar Nome completo');
  await expect(guide.getByRole('heading', { name: 'Rolar com contexto' })).toHaveCount(0);
  await guide.getByLabel('Buscar comando').fill('escolher');
  await expect(guide.getByRole('heading', { name: 'Escolher personagem' })).toBeVisible();
  await guide.getByLabel('Buscar comando').fill('impossível');
  await expect(guide).toContainText('Nenhum comando encontrado');
  await guide.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(guide.getByRole('heading', { name: 'Rolar com contexto' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
