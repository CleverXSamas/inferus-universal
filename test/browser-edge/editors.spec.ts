import { test, expect, type Page } from '@playwright/test';
async function openTree(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar árvore', exact: true }).click();
  await expect(page.getByTestId('skill-map')).toBeVisible();
}
async function storedTree(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('inferus-tree-studio-v1')!));
}
test('estúdio: skill reutilizável, qualquer ramo, mapa móvel e persistência', async ({ page }) => {
  await openTree(page);
  await page.getByRole('button', { name: /^Ramos/ }).click();
  await page.getByRole('button', { name: 'Criar ramo', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome do ramo').fill('Sombras');
  await dialog.getByRole('button', { name: 'Criar ramo', exact: true }).click();
  await page.getByRole('button', { name: /^Biblioteca/ }).click();
  await page.getByRole('button', { name: 'Criar skill', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome da skill', { exact: true }).fill('Passo das sombras');
  await dialog.getByLabel('Descrição e regras').fill('Atravesse a penumbra.');
  await dialog.getByRole('button', { name: 'Só salvar na biblioteca' }).click();
  expect((await storedTree(page)).skills.some((n: any) => n.name === 'Passo das sombras')).toBe(
    false,
  );
  for (const branch of ['Sombras', 'Mente e magia']) {
    await page
      .getByRole('button', { name: 'Adicionar Passo das sombras a um ramo', exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Ramo de destino').selectOption({ label: branch });
    await dialog.getByLabel('Conectar após').selectOption({ label: 'Despertar' });
    await dialog.getByRole('button', { name: 'Adicionar ao ramo', exact: true }).click();
  }
  let doc = await storedTree(page);
  const copies = doc.skills.filter((n: any) => n.name === 'Passo das sombras');
  expect(copies).toHaveLength(2);
  expect(new Set(copies.map((n: any) => n.branchId)).size).toBe(2);
  const before = doc.viewport;
  const box = (await page.getByTestId('skill-map').boundingBox())!;
  await page.mouse.move(box.x + 15, box.y + 110);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 180, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(async () => JSON.stringify((await storedTree(page)).viewport))
    .not.toBe(JSON.stringify(before));
  const priorZoom = (await storedTree(page)).viewport.zoom;
  await page.getByRole('button', { name: 'Aumentar zoom', exact: true }).click();
  await expect.poll(async () => (await storedTree(page)).viewport.zoom).toBeGreaterThan(priorZoom);
  await page.getByRole('button', { name: 'Enquadrar árvore', exact: true }).click();
  await page.waitForTimeout(300);
  const selected = page.getByRole('button', {
    name: 'Selecionar skill Brasa interna',
    exact: true,
  });
  await selected.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const nodebox = (await selected.boundingBox())!;
  const original = (await storedTree(page)).skills.find((n: any) => n.id === 'brasa').position;
  await page.mouse.move(nodebox.x + nodebox.width / 2, nodebox.y + nodebox.height / 2);
  await page.mouse.down();
  await page.mouse.move(nodebox.x + nodebox.width / 2 + 60, nodebox.y + nodebox.height / 2 + 40, {
    steps: 10,
  });
  await page.mouse.up();
  await expect
    .poll(async () =>
      JSON.stringify((await storedTree(page)).skills.find((n: any) => n.id === 'brasa').position),
    )
    .not.toBe(JSON.stringify(original));
  await page.reload();
  await page.getByRole('button', { name: 'Criar árvore', exact: true }).click();
  doc = await storedTree(page);
  expect(doc.skills.filter((n: any) => n.name === 'Passo das sombras')).toHaveLength(2);
});
test('estúdio: mover sequência, excluir skill, excluir ramo e desfazer', async ({ page }) => {
  await openTree(page);
  await page.getByRole('button', { name: 'Selecionar skill Brasa interna', exact: true }).click();
  const inspector = page.getByRole('region', { name: 'Editor da skill' });
  await inspector.getByLabel('Ramo de destino').selectOption({ label: 'Mente e magia' });
  await inspector.getByLabel('Conectar após').selectOption({ label: 'Eco arcano' });
  await inspector.getByRole('button', { name: 'Aplicar alterações' }).click();
  let doc = await storedTree(page);
  expect(doc.skills.find((n: any) => n.id === 'investida').branchId).toBe('mente');
  expect(doc.skills.find((n: any) => n.id === 'brasa').parentId).toBe('eco');
  await inspector.getByRole('button', { name: 'Excluir só esta skill' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar exclusão' }).click();
  doc = await storedTree(page);
  expect(doc.skills.find((n: any) => n.id === 'investida').parentId).toBe('eco');
  expect(doc.skills.some((n: any) => n.id === 'brasa')).toBe(false);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  expect((await storedTree(page)).skills.some((n: any) => n.id === 'brasa')).toBe(true);
  await page.getByRole('button', { name: /^Ramos/ }).click();
  await page.getByRole('button', { name: 'Excluir ramo Mente e magia', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar exclusão' }).click();
  doc = await storedTree(page);
  expect(doc.branches.some((b: any) => b.id === 'mente')).toBe(false);
  expect(doc.skills).toHaveLength(1);
  expect(doc.library).toHaveLength(5);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  expect((await storedTree(page)).skills).toHaveLength(5);
  await page.getByRole('button', { name: 'Refazer', exact: true }).click();
  expect((await storedTree(page)).skills).toHaveLength(1);
  await page.getByRole('button', { name: 'Selecionar skill Despertar', exact: true }).click();
  await inspector.getByRole('button', { name: 'Excluir só esta skill' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(
    page.getByRole('heading', { name: 'Toda jornada começa com uma skill.' }),
  ).toBeVisible();
});
test('personagem: módulos, fórmula, recurso, ação, modo jogo e recuperação de exclusão', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar ficha', exact: true }).click();
  await page.getByRole('button', { name: /Atributos contidos d20/ }).click();
  await page.getByLabel('Nome da ficha', { exact: true }).fill('A guardiã da aurora');
  await page.getByLabel('Força', { exact: true }).fill('18');
  await page.getByRole('button', { name: 'Adicionar módulo Vitalidade', exact: true }).click();
  await page.getByRole('button', { name: 'Reduzir Vida', exact: true }).click();
  await expect(page.getByLabel('Vida atual', { exact: true })).toHaveValue('9');
  await page
    .getByRole('button', { name: 'Adicionar campo em Atributos e escolhas', exact: true })
    .click();
  await page.getByRole('button', { name: /Calculado/ }).click();
  await page.getByLabel('Nome do novo campo', { exact: true }).fill('Bônus de força');
  await page.getByRole('button', { name: 'Adicionar campo', exact: true }).click();
  const calc = page
    .locator('.character-field')
    .filter({ has: page.getByLabel('Resultado de Bônus de força', { exact: true }) });
  await calc.getByText('Ajustar campo', { exact: true }).click();
  await page
    .getByLabel('Fórmula de Bônus de força', { exact: true })
    .fill('floor((@forca - 10) / 2)');
  await expect(page.getByLabel('Resultado de Bônus de força', { exact: true })).toHaveText('4');
  await page.getByRole('button', { name: 'Adicionar módulo Ações', exact: true }).click();
  const attack = page
    .locator('.character-field')
    .filter({ has: page.getByRole('button', { name: 'Rolar Ataque', exact: true }) });
  await attack.getByText('Ajustar campo', { exact: true }).click();
  await page.getByLabel('Expressão de Ataque', { exact: true }).fill('1d20 + @bonus_de_forca');
  await page.getByLabel('Força', { exact: true }).fill('8');
  await expect(page.getByLabel('Resultado de Bônus de força', { exact: true })).toHaveText('-1');

  await page.getByRole('button', { name: 'Modo jogo', exact: true }).click();
  await page.getByRole('button', { name: 'Rolar Ataque', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Rolagem da ficha' })).toBeInViewport();
  await expect(page.getByRole('status', { name: 'Resultado da rolagem' })).toContainText('Ataque:');
  await expect(page.getByRole('status', { name: 'Resultado da rolagem' })).toContainText('1d20-1');
  await page.getByRole('button', { name: 'Fechar rolagem', exact: true }).click();
  await expect(page.getByRole('button', { name: /Remover campo/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Montar ficha', exact: true }).click();
  await page.getByRole('button', { name: 'Remover seção Vitalidade', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(page.getByLabel('Vida atual', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.getByLabel('Vida atual', { exact: true })).toHaveValue('9');
  await page.reload();
  await page.getByRole('button', { name: 'Criar ficha', exact: true }).click();
  await expect(page.getByLabel('Nome da ficha', { exact: true })).toHaveValue(
    'A guardiã da aurora',
  );
  await expect(page.getByLabel('Vida atual', { exact: true })).toHaveValue('9');
  await expect(page.getByLabel('Resultado de Bônus de força', { exact: true })).toHaveText('-1');
});
test('celular: mapa acompanha arraste e pinça; criação funciona em uma árvore vazia', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:3103',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await openTree(page);
    await page
      .getByTestId('skill-map')
      .evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const box = (await page.getByTestId('skill-map').boundingBox())!,
      session = await context.newCDPSession(page),
      before = (await storedTree(page)).viewport;
    const x = box.x + 25,
      y = box.y + 90;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + i * 10, y: y + i * 5 }],
      });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect
      .poll(async () => JSON.stringify((await storedTree(page)).viewport))
      .not.toBe(JSON.stringify(before));
    const zoom = (await storedTree(page)).viewport.zoom,
      cx = box.x + box.width / 2,
      cy = box.y + box.height / 2;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { id: 1, x: cx - 35, y: cy },
        { id: 2, x: cx + 35, y: cy },
      ],
    });
    for (let i = 1; i <= 8; i++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { id: 1, x: cx - 35 - i * 6, y: cy },
          { id: 2, x: cx + 35 + i * 6, y: cy },
        ],
      });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await storedTree(page)).viewport.zoom).toBeGreaterThan(zoom);
    await page.getByRole('button', { name: 'Modelos / nova árvore', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Tela em branco/ })
      .click();
    await page.getByRole('button', { name: 'Criar primeira skill', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome da skill', { exact: true }).fill('Origem móvel');
    await dialog.getByRole('button', { name: 'Criar e adicionar', exact: true }).click();
    expect((await storedTree(page)).skills).toHaveLength(1);
    await expect(
      page.getByRole('button', { name: 'Selecionar skill Origem móvel', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Criar ficha', exact: true }).click();
    await page.getByRole('button', { name: /Começar do zero/ }).click();
    await expect(
      page.getByRole('button', { name: 'Ferramentas e módulos', exact: true }),
    ).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Ferramentas e módulos', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar módulo Vitalidade', exact: true }).click();
    await expect(page.getByLabel('Vida atual', { exact: true })).toHaveValue('10');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  } finally {
    await context.close();
  }
});
