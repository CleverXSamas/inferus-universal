import test from 'node:test';
import assert from 'node:assert/strict';
import { discordAccounts } from '../edge/discord-accounts.ts';
import { sqliteD1 } from './helpers/d1.ts';
import type { Env } from '../edge/types.ts';
import { createEdgeCampaignStore } from '../edge/campaigns.ts';
const discordId = '123456789012345678';
test('vínculo exige bot autenticado e confirmação no site; seleciona apenas dados próprios e desconecta', async (t) => {
  const db = sqliteD1(),
    env: Env = { DB: db, DISCORD_CLIENT_ID: '1528465674731782347' };
  const accounts = discordAccounts(env);
  const secret = 'test-only-discord-bot-credential';
  const request = new Request('https://inferus.example/api/discord/bot', {
    headers: { authorization: `Bot ${secret}` },
  });
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify({ id: env.DISCORD_CLIENT_ID })),
  );
  try {
    const pair = (await accounts.change('owner', { action: 'create-pair' })) as { code: string };
    assert.equal(pair.code.length, 32);
    const docs = JSON.stringify(
      (await db.prepare('SELECT * FROM edge_discord_pairing').all()).results,
    );
    assert(!docs.includes(pair.code));
    await assert.rejects(
      accounts.bot(new Request('https://inferus.example'), {
        action: 'pair',
        code: pair.code,
        discordId,
      }),
      /Autenticação/,
    );
    await accounts.bot(request, {
      action: 'pair',
      code: pair.code,
      discordId,
      displayName: 'Pessoa Discord',
    });
    await assert.rejects(accounts.bot(request, { action: 'character', discordId }), /confirme/);
    const pending = (await accounts.status('owner')).pending!;
    await assert.rejects(
      accounts.change('intruder', { action: 'confirm', pairId: pending.id }),
      /expirar/,
    );
    await accounts.change('owner', { action: 'confirm', pairId: pending.id });
    await assert.rejects(
      accounts.bot(request, { action: 'pair', code: pair.code, discordId }),
      /expirou/,
    );
    const campaigns = createEdgeCampaignStore(db),
      created = await campaigns.create('Mesa vinculada', 'DM', 'owner');
    await campaigns.saveCharacter(
      created.state.id,
      '',
      {
        id: 'hero',
        name: 'Ficha ativa',
        sections: [
          {
            id: 'segredos',
            label: 'História',
            fields: [
              {
                id: 'biografia',
                label: 'Biografia',
                type: 'text',
                value: 'NOTA PRIVADA QUE NAO VAI AO BOT',
              },
            ],
          },
        ],
      },
      0,
      'owner',
    );
    await assert.rejects(
      accounts.change('owner', { action: 'select', character: 'campaign:outra-conta' }),
      /sua/,
    );
    await accounts.change('owner', { action: 'select', character: `campaign:${created.state.id}` });
    const result = (await accounts.bot(request, { action: 'character', discordId })) as {
      sheet: { name: string; skillTree: unknown };
    };
    assert.equal(result.sheet.name, 'Ficha ativa');
    assert(!JSON.stringify(result).includes('NOTA PRIVADA'));
    await assert.rejects(
      discordAccounts({ ...env, DISCORD_CLIENT_ID: '987654321098765432' }).bot(request, {
        action: 'character',
        discordId,
      }),
      /não pertence/,
    );
    assert(result.sheet.skillTree);
    const list = await accounts.bot(request, { action: 'campaigns', discordId });
    assert(JSON.stringify(list).includes('Mesa vinculada'));
    assert(!JSON.stringify(list).includes(created.inviteToken));
    await accounts.change('owner', { action: 'disconnect' });
    await assert.rejects(accounts.bot(request, { action: 'character', discordId }), /Vincule/);
  } finally {
    db.close();
  }
});
