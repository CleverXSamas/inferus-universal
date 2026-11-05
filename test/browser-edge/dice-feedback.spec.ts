import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
test('GIF servido pelo Worker preserva bytes e tipo de imagem', async ({ request }) => {
  const response = await request.get('/assets/inferus-roll.gif?roll=fixture');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toBe('image/gif');
  const bytes = await response.body();
  expect(bytes.subarray(0, 6).toString()).toBe('GIF89a');
  expect(bytes).toEqual(await readFile('public/assets/inferus-roll.gif'));
  expect(bytes.includes(Buffer.from('NETSCAPE2.0'))).toBe(false);
});
