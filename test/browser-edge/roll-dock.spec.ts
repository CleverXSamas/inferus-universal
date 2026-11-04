import { test, expect, type Page } from '@playwright/test';
async function character(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar ficha', exact: true }).click();
  await page.getByRole('button', { name: /Atributos contidos d20/ }).click();
}
test('ficha: ação mostra resultado no canto, acompanha scroll e permite recolher/fechar', async ({
  page,
}) => {
  await character(page);
  await page.getByRole('button', { name: 'Adicionar módulo Ações', exact: true }).click();
  await page.getByRole('button', { name: 'Rolar Ataque', exact: true }).click();
  const dock = page.getByRole('region', { name: 'Rolagem da ficha' });
  await expect(dock).toBeInViewport();
  await expect(dock.locator('.roll-card-title')).toHaveText('Ataque');
  await expect(dock.locator('.roll-card-total')).toHaveText(/^\d+$/);
  expect(await dock.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(dock).toBeInViewport();
  await page.getByRole('button', { name: 'Recolher rolagem', exact: true }).click();
  await expect(dock.locator('.roll-card')).not.toBeVisible();
  await expect(dock).toContainText('Ataque ·');
  await page.getByRole('button', { name: 'Rolar dados', exact: true }).click();
  await expect(dock.locator('.roll-card')).toBeVisible();
  await page.getByLabel('Expressão dos dados da ficha', { exact: true }).fill('1d6+5');
  await dock.getByRole('button', { name: 'Rolar', exact: true }).click();
  await expect(dock.locator('.roll-card-expression')).toHaveText('1d6+5');
  await page.getByLabel('Expressão dos dados da ficha', { exact: true }).fill('invalido');
  await dock.getByRole('button', { name: 'Rolar', exact: true }).click();
  await expect(dock.getByRole('alert')).toBeInViewport();
  await page.getByRole('button', { name: 'Fechar rolagem', exact: true }).click();
  await expect(dock).toHaveCount(0);
});
test('celular: dados da ficha permanecem visíveis sem transbordar ou apagar a edição', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await character(page);
  await page.getByLabel('Nome da ficha', { exact: true }).fill('Personagem em criação');
  await page.getByRole('button', { name: 'Rolar dados', exact: true }).click();
  const dock = page.getByRole('region', { name: 'Rolagem da ficha' });
  await page.getByLabel('Expressão dos dados da ficha', { exact: true }).fill('4d6kh3');
  await dock.getByRole('button', { name: 'Rolar', exact: true }).click();
  await expect(dock.locator('.roll-card-dice span')).toHaveCount(4);
  await expect(dock.locator('.roll-card-dice .discarded')).toHaveCount(1);
  await expect(dock).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(dock).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button', { name: 'Fechar rolagem', exact: true }).click();
  await expect(page.getByLabel('Nome da ficha', { exact: true })).toHaveValue(
    'Personagem em criação',
  );
});
test('prévia reproduz o exemplo do print usando o mesmo modelo do cartão Discord', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let i = 0;
    const original = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', {
      value: (array: Uint32Array) => {
        if (array instanceof Uint32Array && array.length === 1) {
          array[0] = [14, 11][i++ % 2];
          return array;
        }
        return original(array);
      },
    });
  });
  await page.goto('/discord');
  await page.getByLabel('Expressão de dados no Discord', { exact: true }).fill('2d20kh1+5');
  await page.getByRole('button', { name: 'Testar prévia', exact: true }).click();
  const card = page.getByTestId('roll-card');
  await expect(card.locator('.roll-card-title')).toHaveText('Teste de percepção');
  await expect(card.locator('.roll-card-total')).toHaveText('20');
  await expect(card.locator('.roll-card-expression')).toHaveText('2d20kh1+5');
  await expect(card.locator('.roll-card-dice .kept')).toHaveText('15');
  await expect(card.locator('.roll-card-dice .discarded')).toHaveText('12');
  await expect(card.locator('.roll-card-meta')).toContainText('Modificador +5');
  await expect(card.locator('.roll-card-legend')).toHaveText(
    'Destaque = mantido · riscado = descartado',
  );
});
