import test from 'node:test';
import assert from 'node:assert/strict';
import { discordAccounts } from '../edge/discord-accounts.ts';
import { sqliteD1 } from './helpers/d1.ts';
import type { Env } from '../edge/types.ts';
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
    await db
      .prepare('INSERT INTO edge_sheets(owner_id,id,document,updated_at) VALUES(?,?,?,?)')
      .bind(
        'owner',
        'hero',
        JSON.stringify({
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
        }),
        new Date().toISOString(),
      )
      .run();
    await assert.rejects(
      accounts.change('owner', { action: 'select', character: 'sheet:outra-conta' }),
      /sua/,
    );
    await accounts.change('owner', { action: 'select', character: 'sheet:hero' });
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
    const list = await accounts.bot(request, { action: 'sheets', discordId });
    assert(JSON.stringify(list).includes('Ficha ativa'));
    await assert.rejects(
      accounts.bot(request, { action: 'select-sheet', discordId, query: 'Outra conta' }),
      /não encontrada/,
    );
    await accounts.bot(request, { action: 'select-sheet', discordId, query: 'Ficha ativa' });
    for (const action of ['campaigns', 'campaign', 'session', 'note'])
      await assert.rejects(accounts.bot(request, { action, discordId }), /inválida/);
    await db
      .prepare(
        "UPDATE edge_discord_accounts SET active_kind='campaign',active_id='legacy' WHERE owner_id='owner'",
      )
      .run();
    assert.equal((await accounts.status('owner')).link?.active, '');
    await assert.rejects(
      accounts.bot(request, { action: 'character', discordId }),
      /Escolha uma ficha/,
    );
    await accounts.bot(request, { action: 'select-sheet', discordId, query: 'hero' });
    await accounts.change('owner', { action: 'disconnect' });
    await assert.rejects(accounts.bot(request, { action: 'character', discordId }), /vincule/i);
  } finally {
    db.close();
  }
});
