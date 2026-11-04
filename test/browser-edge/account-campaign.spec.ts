import { test, expect } from '@playwright/test';
test('ficha + árvore persistem na campanha e bot só consulta após confirmar conta e escolher personagem', async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.getByRole('link', { name: /Entrar.*ChatGPT/ }).click();
  await page.getByRole('button', { name: 'Criar ficha', exact: true }).click();
  await page.getByRole('button', { name: /Atributos contidos d20/ }).click();
  await page.getByLabel('Nome da ficha', { exact: true }).fill('');
  await expect(page.getByLabel('Nome da ficha', { exact: true })).toHaveValue('');
  await page.getByLabel('Nome da ficha', { exact: true }).fill('Personagem integrado');
  await page.getByLabel('Força', { exact: true }).fill('17');
  await expect(
    page.getByRole('region', { name: 'Árvore de habilidades do personagem' }),
  ).toBeVisible();
  await page.locator('.character-map-skill').first().click();
  await page.getByRole('button', { name: 'Desbloquear skill', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar na conta', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Ficha salva');
  await page.getByRole('button', { name: 'Campanha', exact: true }).click();
  await page.getByLabel('Seu nome de mesa').fill('Mestre integrado');
  await page.getByLabel('Nome da campanha').fill('Campanha integrada ao bot');
  await page.getByRole('button', { name: 'Criar como DM', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir personagem de Mestre integrado' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Vincular ficha da conta')
    .selectOption({ label: 'Personagem integrado' });
  await dialog.getByLabel('Força', { exact: true }).fill('18');
  await dialog.getByRole('button', { name: 'Salvar ficha e árvore na campanha' }).click();
  await expect(dialog.getByRole('status')).toContainText('Ficha e árvore salvas');
  await dialog.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  await expect(page.locator('.campaign-person-name')).toContainText('Personagem integrado');
  await page.reload();
  await page.getByRole('button', { name: 'Abrir personagem de Mestre integrado' }).click();
  await expect(dialog.getByLabel('Força', { exact: true })).toHaveValue('18');
  await expect(
    dialog.getByRole('region', { name: 'Árvore de habilidades do personagem' }),
  ).toContainText('1 de');
  await dialog.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  await page.getByRole('button', { name: 'Discord', exact: true }).click();
  const link = page.getByRole('region', { name: 'Vincular conta ao bot' });
  await link.getByRole('button', { name: 'Gerar código de vínculo' }).click();
  const code = (await link.locator('.discord-link-steps code').innerText()).split(' ')[1];
  const headers = { authorization: 'Bot edge-fixture-token-for-discord-link' };
  const discordId = '222222222222222222';
  const pair = await request.post('/api/discord/bot', {
    headers,
    data: { action: 'pair', code, discordId, displayName: 'Pessoa do teste' },
  });
  expect(pair.ok()).toBe(true);
  expect(
    (
      await request.post('/api/discord/bot', { headers, data: { action: 'character', discordId } })
    ).status(),
  ).toBe(403);
  await link.getByRole('button', { name: 'Confirmar vínculo com este Discord' }).click();
  await link
    .getByLabel('Personagem ativo no bot')
    .selectOption({ label: 'Campanha integrada ao bot · Personagem integrado' });
  await link.getByRole('button', { name: 'Usar este personagem no bot' }).click();
  await expect(link.getByRole('status')).toContainText('Personagem ativo atualizado');
  const response = await request.post('/api/discord/bot', {
    headers,
    data: { action: 'character', discordId },
  });
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(
    data.sheet.sections.flatMap((s: any) => s.fields).find((f: any) => f.id === 'forca').value,
  ).toBe(18);
  expect(data.sheet.skillTree.skills.filter((s: any) => s.unlocked)).toHaveLength(1);
  await link.getByRole('button', { name: 'Desconectar Discord' }).click();
  await expect(link.getByRole('status')).toContainText('Novas consultas foram bloqueadas');
  expect(
    (
      await request.post('/api/discord/bot', { headers, data: { action: 'character', discordId } })
    ).status(),
  ).toBe(403);
});
