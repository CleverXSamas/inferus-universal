import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('Dado Aberto e ficha compartilham formato, animação e preferência de som', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__diceSounds = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (when?: number) {
      (window as any).__diceSounds++;
      return start.call(this, when);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Rolar', exact: true }).click();
  const main = page.getByTestId('simple-roll-result');
  await expect(main).toHaveClass(/is-roll-animating/);
  await expect(main.locator('.big-number')).toHaveText(/^\d+$/);
  expect(await page.evaluate(() => (window as any).__diceSounds)).toBeGreaterThan(0);
  await page.getByRole('button', { name: /Som ligado/ }).click();
  const sounds = await page.evaluate(() => (window as any).__diceSounds);
  await page.getByRole('button', { name: 'Rolar', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__diceSounds)).toBe(sounds);
  await page.getByRole('button', { name: 'Criar ficha', exact: true }).click();
  await page.getByRole('button', { name: /Atributos contidos d20/ }).click();
  await page.getByRole('button', { name: 'Rolar dados', exact: true }).click();
  const dock = page.getByRole('region', { name: 'Rolagem da ficha' });
  await expect(dock.getByRole('button', { name: 'Som desligado', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await dock.getByRole('button', { name: 'Som desligado', exact: true }).click();
  await page.getByLabel('Expressão dos dados da ficha', { exact: true }).fill('2d20kh1+5');
  await dock.getByRole('button', { name: 'Rolar', exact: true }).click();
  await expect(dock.getByTestId('simple-roll-result')).toHaveClass(/is-roll-animating/);
  await expect(dock.locator('.audit-label')).toContainText('Dados');
  await expect(dock.locator('.dice-row .roll-inline-modifier')).toHaveText('+5');
  await expect(dock.locator('.roll-id')).toContainText('ID ');
  expect(await page.evaluate(() => (window as any).__diceSounds)).toBeGreaterThan(sounds);
  await page.reload();
  await expect(page.getByRole('button', { name: /Som ligado/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
test('movimento reduzido mantém resultados imediatos sem animação', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Rolar', exact: true }).click();
  await expect(page.locator('.big-number')).toHaveText(/^\d+$/);
  expect(
    await page
      .locator('.die')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
});
test('GIF servido pelo Worker preserva bytes e tipo de imagem', async ({ request }) => {
  const response = await request.get('/assets/inferus-roll.gif?roll=fixture');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toBe('image/gif');
  const bytes = await response.body();
  expect(bytes.subarray(0, 6).toString()).toBe('GIF89a');
  expect(bytes).toEqual(await readFile('public/assets/inferus-roll.gif'));
  expect(bytes.includes(Buffer.from('NETSCAPE2.0'))).toBe(false);
});
