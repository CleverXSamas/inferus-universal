import test from 'node:test';
import assert from 'node:assert/strict';
import { createSheetStore } from '../server/sheets.ts';

for (const [kind, url] of [
  ['memory', ''],
  ['mysql', process.env.TEST_DATABASE_URL],
] as const) {
  test(
    `${kind}: fichas pertencem à conta e sobrevivem à nova conexão`,
    { skip: url === undefined },
    async () => {
      const store = createSheetStore(url),
        owner = `sheet-owner-${Date.now()}`;
      const sheet = { id: 'ficha', name: 'Heroína', sections: [] };
      try {
        await store.save(owner, sheet);
        assert.deepEqual(await store.list(owner), [sheet]);
        assert.deepEqual(await store.list('stranger'), []);
        await store.delete('stranger', sheet.id);
        assert.equal((await store.list(owner)).length, 1);
        if (url) {
          const other = createSheetStore(url);
          try {
            assert.deepEqual(await other.list(owner), [sheet]);
          } finally {
            await other.close();
          }
        }
        await store.delete(owner, sheet.id);
        assert.deepEqual(await store.list(owner), []);
      } finally {
        await store.close();
      }
    },
  );
}
