import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignStore } from '../server/campaigns.ts';
import { createEdgeCampaignStore } from '../edge/campaigns.ts';
import { sqliteD1 } from './helpers/d1.ts';
import { validateSheet } from '../packages/sheet-engine/index.ts';
for (const kind of ['memory', 'd1', 'mysql'] as const)
  test(
    `${kind}: mesa persiste, protege tokens, rejeita conflitos e revoga acesso`,
    { skip: kind === 'mysql' && !process.env.TEST_DATABASE_URL },
    async () => {
      const db = kind === 'd1' ? sqliteD1() : null;
      const store = db
        ? createEdgeCampaignStore(db)
        : createCampaignStore(kind === 'mysql' ? process.env.TEST_DATABASE_URL : '');
      try {
        const c = await store.create('Mesa VTT', 'DM', 'vtt-dm');
        const p = await store.join(c.inviteToken, 'Jogador', 'vtt-player');
        const own = await store.get(c.state.id, p.sessionToken, 'vtt-player');
        await store.saveCharacter(
          c.state.id,
          p.sessionToken,
          {
            id: 'heroi',
            name: 'Aris',
            system: 'Sistema da mesa',
            concept: 'Explorador',
            sections: [
              {
                id: 'recursos',
                label: 'Recursos',
                fields: [
                  {
                    id: 'vida',
                    label: 'Vitalidade',
                    type: 'resource',
                    value: { current: 8, max: 10 },
                    pinned: true,
                  },
                ],
              },
            ],
          },
          0,
          'vtt-player',
        );
        let s = await store.tabletop(c.state.id, '', 'vtt-dm', {
          kind: 'add',
          revision: 0,
          name: 'Segredo do mestre',
          hidden: true,
        });
        assert.equal((await store.tabletop(c.state.id, '', 'vtt-player')).tokens.length, 0);
        assert(
          !JSON.stringify((await store.get(c.state.id, '', 'vtt-player')).state).includes(
            'Segredo do mestre',
          ),
        );
        await assert.rejects(
          store.tabletop(c.state.id, '', 'vtt-player', {
            kind: 'move',
            id: s.tokens[0].id,
            x: 2,
            y: 2,
            revision: 1,
          }),
          /Token não encontrado/,
        );
        await assert.rejects(
          store.tabletop(c.state.id, '', 'vtt-player', {
            kind: 'configure',
            columns: 20,
            rows: 20,
            revision: 1,
          }),
          /Apenas o mestre/,
        );
        s = await store.tabletop(c.state.id, '', 'vtt-player', {
          kind: 'add',
          revision: 1,
          participantId: own.participantId,
          name: 'Aris',
        });
        const id = s.tokens[0].id;
        const changes = await Promise.allSettled(
          [2, 3].map((x) =>
            store.tabletop(c.state.id, '', 'vtt-player', {
              kind: 'move',
              id,
              x,
              y: 4,
              revision: 2,
            }),
          ),
        );
        assert.equal(changes.filter((r) => r.status === 'fulfilled').length, 1);
        s = await store.tabletop(c.state.id, '', 'vtt-dm');
        assert.equal(s.revision, 3);
        await assert.rejects(
          store.tabletop(c.state.id, '', 'vtt-dm', {
            kind: 'configure',
            columns: 10,
            rows: 10,
            map: 'javascript:alert(1)',
            revision: 3,
          }),
          /HTTPS/,
        );
        await assert.rejects(
          store.tabletop(c.state.id, '', 'vtt-player', {
            kind: 'move',
            id,
            x: -1,
            y: 4,
            revision: 3,
          }),
          /Posição/,
        );
        assert.equal((await store.tabletop(c.state.id, '', 'vtt-dm')).revision, 3);
        if (kind === 'mysql') {
          const reopened = createCampaignStore(process.env.TEST_DATABASE_URL);
          try {
            assert.deepEqual(await reopened.tabletop(c.state.id, '', 'vtt-dm'), s);
          } finally {
            await reopened.close();
          }
        }
        await store.status(c.state.id, '', 'closed', 'vtt-dm');
        await assert.rejects(
          store.tabletop(c.state.id, '', 'vtt-player', { kind: 'remove', id, revision: 3 }),
          /encerrada/,
        );
        await store.status(c.state.id, '', 'active', 'vtt-dm');
        await store.remove(c.state.id, '', own.participantId, 'vtt-dm');
        await assert.rejects(store.tabletop(c.state.id, p.sessionToken, 'vtt-player'), /Sessão/);
        assert.equal((await store.tabletop(c.state.id, '', 'vtt-dm')).tokens.length, 1);
      } finally {
        if ('close' in store) await store.close();
        db?.close();
      }
    },
  );
test('ficha universal preserva campos fixados e rejeita metadados inválidos', () => {
  const sheet = {
    id: 'heroi',
    name: 'Aris',
    system: 'Regras próprias',
    concept: 'Viajante',
    sections: [
      {
        id: 'acao',
        label: 'Ações',
        fields: [
          {
            id: 'ataque',
            label: 'Ataque',
            type: 'action' as const,
            expression: '1d20',
            pinned: true,
          },
        ],
      },
    ],
  };
  assert.equal(validateSheet(sheet).sections[0].fields[0].pinned, true);
  assert.throws(() => validateSheet({ ...sheet, system: 'x'.repeat(161) }), /Sistema/);
  assert.throws(
    () =>
      validateSheet({
        ...sheet,
        sections: [
          {
            ...sheet.sections[0],
            fields: [{ ...sheet.sections[0].fields[0], pinned: 'sim' as unknown as boolean }],
          },
        ],
      }),
    /Favorito/,
  );
});
