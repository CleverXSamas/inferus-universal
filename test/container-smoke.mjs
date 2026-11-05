import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createApplication } from '/app/dist-server/server/index.js';
assert.notEqual(process.getuid(), 0);
assert.equal(existsSync('/app/.env'), false);
assert.equal(existsSync('/app/src'), false);
assert.equal(existsSync('/app/dist/index.html'), true);
const app = createApplication({ databaseUrl: '' });
await new Promise((resolve) => app.server.listen(0, '::', resolve));
try {
  const response = await fetch(`http://127.0.0.1:${app.server.address().port}/api/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sheetStorage, 'memory');
  console.log(
    'Imagem validada: usuário sem root, frontend/servidor disponíveis, listener IPv6 e endpoint HTTP funcionais.',
  );
} finally {
  await new Promise((resolve) => app.server.close(resolve));
  await app.close();
}
