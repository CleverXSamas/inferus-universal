import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignStore } from '../server/campaigns.ts';
import { createEdgeCampaignStore } from '../edge/campaigns.ts';
import { sqliteD1 } from './helpers/d1.ts';
import type { Sheet } from '../packages/sheet-engine/index.ts';
const sheet: Sheet = {
  id: 'heroi',
  name: 'Personagem privado',
  sections: [
    {
      id: 'atributos',
      label: 'Atributos',
      fields: [{ id: 'forca', label: 'Força', type: 'number', value: 17 }],
    },
  ],
};
for (const kind of ['memory', 'd1'] as const)
  test(`${kind}: personagem é do jogador, DM consulta, terceiros não recebem dados e revisão impede perda`, async () => {
    const db = kind === 'd1' ? sqliteD1() : null;
    const store = kind === 'd1' ? createEdgeCampaignStore(db!) : createCampaignStore('');
    try {
      const campaign = await store.create('Mesa', 'Mestre', 'dm');
      const a = await store.join(campaign.inviteToken, 'Jogador A', 'a');
      const b = await store.join(campaign.inviteToken, 'Jogador B', 'b');
      const own = await store.get(campaign.state.id, a.sessionToken, 'a');
      const saved = await store.saveCharacter(campaign.state.id, a.sessionToken, sheet, 0, 'a');
      assert(saved.sheet?.skillTree?.skills.length);
      assert.equal(saved.canEdit, true);
      assert.equal(saved.revision, 1);
      const observed = await store.character(campaign.state.id, '', own.participantId, 'dm');
      assert.equal(observed.sheet?.name, sheet.name);
      assert.equal(observed.canEdit, false);
      await assert.rejects(
        store.character(campaign.state.id, b.sessionToken, own.participantId, 'b'),
        /dono e ao DM/,
      );
      const publicData = JSON.stringify(
        (await store.get(campaign.state.id, b.sessionToken, 'b')).state,
      );
      assert(!publicData.includes('sections'));
      assert(!publicData.includes('forca'));
      assert(publicData.includes('Personagem privado'));
      const edits = await Promise.allSettled([
        store.saveCharacter(campaign.state.id, '', { ...sheet, name: 'Edição 1' }, 1, 'a'),
        store.saveCharacter(campaign.state.id, '', { ...sheet, name: 'Edição 2' }, 1, 'a'),
      ]);
      assert.equal(edits.filter((e) => e.status === 'fulfilled').length, 1);
      assert.equal(edits.filter((e) => e.status === 'rejected').length, 1);
      await store.saveCharacter(campaign.state.id, '', null, 2, 'a');
      await assert.rejects(
        store.saveCharacter(campaign.state.id, '', sheet, 0, 'a'),
        /outra sessão/,
      );
      assert.equal((await store.character(campaign.state.id, '', undefined, 'a')).revision, 3);
      await store.remove(campaign.state.id, '', own.participantId, 'dm');
      await assert.rejects(
        store.character(campaign.state.id, a.sessionToken, undefined, 'a'),
        /Sessão/,
      );
    } finally {
      if ('close' in store) await store.close();
      db?.close();
    }
  });
