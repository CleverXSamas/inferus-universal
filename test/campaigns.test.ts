import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignStore } from '../server/campaigns.ts';
import { createSheetStore } from '../server/sheets.ts';

for (const [kind, url] of [
  ['memory', ''],
  ['mysql', process.env.TEST_DATABASE_URL],
] as const) {
  test(
    `${kind}: permissões, revogação, contas e limite concorrente`,
    { skip: url === undefined },
    async () => {
      const store = createCampaignStore(url);
      try {
        const c = await store.create('Mesa', 'DM', 'owner');
        await assert.rejects(store.join(c.inviteToken, 'DM', 'attacker'), /Nome já utilizado/);
        await assert.rejects(store.get(c.state.id, c.sessionToken), /Sessão/);
        const p = await store.join(c.inviteToken, 'Jogador', 'player');
        assert.equal(p.role, 'player');
        await assert.rejects(
          store.status(c.state.id, p.sessionToken, 'active', 'player'),
          /Apenas o DM/,
        );
        assert.equal((await store.get(c.state.id, '', 'owner')).role, 'dm');
        assert.equal(
          (await store.list('owner')).some((s) => s.id === c.state.id),
          true,
        );
        assert.equal((await store.list('stranger')).length, 0);
        assert.equal(
          (await store.join(c.inviteToken, 'outro nome', 'player')).state.participants.length,
          2,
        );
        const results = await Promise.allSettled(
          Array.from({ length: 15 }, (_, i) =>
            store.join(c.inviteToken, `Pessoa ${i}`, `account-${i}`),
          ),
        );
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 8);
        assert.equal((await store.get(c.state.id, '', 'owner')).state.participants.length, 10);
        const revoked = await store.revoke(c.state.id, '', 'owner');
        assert.equal(revoked.revoked, true);
        await assert.rejects(store.join(c.inviteToken, 'Visitante'), /revogado/);
        assert.equal((await store.get(c.state.id, '', 'player')).role, 'player');
        const playerId = (await store.get(c.state.id, '', 'player')).participantId;
        await store.remove(c.state.id, '', playerId, 'owner');
        await assert.rejects(store.get(c.state.id, p.sessionToken, 'player'), /Sessão/);
        assert.equal(
          (await store.list('player')).some((s) => s.id === c.state.id),
          false,
        );
        const rotated = await store.rotate(c.state.id, '', 'owner');
        assert.notEqual(rotated.inviteToken, c.inviteToken);
        await assert.rejects(store.join(c.inviteToken, 'Velho'), /inexistente|revogado/);
        const guest = await store.join(rotated.inviteToken, 'Convidado');
        assert.equal(guest.role, 'player');
        const guestState = await store.get(c.state.id, guest.sessionToken);
        assert.equal(guestState.role, 'player');
        await assert.rejects(store.status(c.state.id, guest.sessionToken, 'active'), /DM/);
        assert.equal(JSON.stringify(guestState.state).includes('openId'), false);
        assert.equal(JSON.stringify(guestState.state).includes('sessionHash'), false);
        const status = await store.status(c.state.id, '', 'active', 'owner');
        assert.equal(status.status, 'active');
        if (url) {
          const other = createCampaignStore(url);
          try {
            assert.equal((await other.get(c.state.id, '', 'owner')).state.status, 'active');
          } finally {
            await other.close();
          }
        }
      } finally {
        await store.close();
      }
    },
  );
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
test('nome nunca recupera DM, inclusive em campanhas sem conta', async () => {
  const store = createCampaignStore('');
  const c = await store.create('Mesa', 'DM');
  await assert.rejects(store.join(c.inviteToken, 'dm'), /Nome já utilizado/);
  assert.equal((await store.get(c.state.id, c.sessionToken)).role, 'dm');
  await store.revoke(c.state.id, c.sessionToken);
  assert.equal((await store.get(c.state.id, c.sessionToken)).role, 'dm');
});

test('vinculação exige sessão original de participação ainda não vinculada', async () => {
  const store = createCampaignStore('');
  const c = await store.create('Mesa de convidado', 'DM');
  await assert.rejects(store.claim(c.state.id, 'invalid', 'attacker'), /Sessão/);
  await store.claim(c.state.id, c.sessionToken, 'owner');
  assert.equal((await store.get(c.state.id, '', 'owner')).accountLinked, true);
  await assert.rejects(store.get(c.state.id, c.sessionToken), /Sessão/);
  await assert.rejects(store.claim(c.state.id, c.sessionToken, 'attacker'), /Sessão/);
  assert.equal((await store.list('attacker')).length, 0);
});
