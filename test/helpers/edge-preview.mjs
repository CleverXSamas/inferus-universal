// Local test adapter for the hosted Worker. Fake identity is available only here,
// never in the production bundle or in the deployed service.
import { createServer } from 'node:http';
import worker from '../../site-dist/server/index.js';
import { sqliteD1 } from '../../work/test-build/test/helpers/d1.js';
const db = sqliteD1(),
  port = 3103;
const env = {
  DB: db,
  DISCORD_CLIENT_ID: '1528465674731782347',
  DISCORD_PUBLIC_KEY: '0722c1522e9d351cbefad62580429fc3d26cebd9fec24cd359fda0225d55a243',
};
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, init) => {
  if (
    String(url).startsWith('https://discord.com/api/v10/') &&
    init?.headers?.authorization === 'Bot edge-fixture-token'
  )
    return Promise.resolve(
      init?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : new Response(
            JSON.stringify(
              String(url).endsWith('/commands')
                ? [
                    { id: '111111111111111111', name: 'rolar' },
                    { id: '222222222222222222', name: 'ajuda' },
                  ]
                : { id: env.DISCORD_CLIENT_ID, verify_key: env.DISCORD_PUBLIC_KEY },
            ),
          ),
    );
  return originalFetch(url, init);
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:' + port);
    if (url.pathname === '/signin-with-chatgpt' || url.pathname === '/signout-with-chatgpt') {
      res.writeHead(302, {
        location: '/',
        'set-cookie':
          url.pathname === '/signin-with-chatgpt'
            ? 'edge-test-user=preview-owner; Path=/; HttpOnly; SameSite=Lax'
            : 'edge-test-user=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
      });
      return res.end();
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value && !key.startsWith('oai-authenticated-')) headers.set(key, String(value));
    const user = req.headers.cookie?.match(/edge-test-user=([^;]+)/)?.[1];
    if (user) {
      headers.set('oai-authenticated-user-id', user);
      headers.set('oai-authenticated-user-email', `${user}@sites.test`);
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const response = await worker.fetch(
      new Request(url, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
      }),
      env,
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end('Preview failure.');
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Edge preview listening on http://127.0.0.1:${port}`),
);
process.on('SIGTERM', () =>
  server.close(() => {
    db.close();
    process.exit(0);
  }),
);
