import { build } from 'esbuild';
import { mkdir, rm, writeFile, copyFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = process.cwd(),
  output = resolve(root, 'work/discloud-bot');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({
  entryPoints: [resolve(root, 'bot/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: resolve(output, 'inferus.cjs'),
  external: ['zlib-sync', '@discordjs/zlib-sync', 'bufferutil', 'utf-8-validate'],
  legalComments: 'eof',
  minify: true,
});
await writeFile(
  resolve(output, 'index.cjs'),
  "const fs = require('node:fs');\nif (fs.existsSync('.env')) process.loadEnvFile('.env');\nrequire('./inferus.cjs');\n",
);
await writeFile(
  resolve(output, 'package.json'),
  JSON.stringify(
    {
      name: 'inferus-discord-bot',
      version: JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version,
      private: true,
      main: 'index.cjs',
      scripts: {
        start: 'node index.cjs',
        check: 'node index.cjs --check',
        'remove-slash': 'node index.cjs --remove-slash',
      },
      engines: { node: '>=22.18.0' },
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  resolve(output, 'discloud.config'),
  'NAME=Inferus Universal\nTYPE=bot\nMAIN=index.cjs\nRAM=100\nVERSION=latest\nSTART=node index.cjs\n',
);
await writeFile(
  resolve(output, '.env'),
  'DISCORD_TOKEN=\nDISCORD_CLIENT_ID=1528465674731782347\nPUBLIC_ORIGIN=https://inferus-universal.peneseretu.chatgpt.site\nNODE_ENV=production\nDISCORD_GUILD_ID=\n',
);
await writeFile(resolve(output, '.gitignore'), '.env\nnode_modules/\n');
await copyFile(resolve(root, 'deploy/discloud/LEIA-ME.txt'), resolve(output, 'LEIA-ME.txt'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
await writeFile(
  resolve(output, 'SOURCE.txt'),
  `https://github.com/CleverXSamas/inferus-universal\nSource commit: ${commit}\n`,
);
const archive = resolve(root, 'work/inferus-bot-discloud-revisado.zip');
await rm(archive, { force: true });
execFileSync('zip', ['-q', '-r', archive, '.'], { cwd: output });
console.log(`Bot ZIP: ${archive}`);
