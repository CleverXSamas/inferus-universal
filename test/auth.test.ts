import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
for (const [kind, url] of [
  ['memory', ''],
  ['mysql', process.env.TEST_DATABASE_URL],
] as const) {
  test(
    `${kind}: OAuth, sessão, logout e validação de JWT`,
    { skip: url === undefined },
    async () => {
      await exec(
        process.execPath,
        [fileURLToPath(new URL('./helpers/auth-roundtrip.js', import.meta.url))],
        { env: { ...process.env, DATABASE_URL: url }, timeout: 20000 },
      );
    },
  );
}
