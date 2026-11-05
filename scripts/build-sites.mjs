import { readFile, writeFile, mkdir, readdir, rm, cp } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit' });
const assets = {};
async function collect(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, file.name);
    if (file.isDirectory()) await collect(path);
    else {
      const relative = '/' + path.slice(resolve(root, 'dist').length + 1).replaceAll('\\', '/');
      const ext = extname(path);
      if (!['.html', '.js', '.css', '.json', '.svg', '.gif'].includes(ext))
        throw new Error(`Asset não suportado no bundle: ${relative}`);
      assets[relative] = {
        content:
          ext === '.gif' ? (await readFile(path)).toString('base64') : await readFile(path, 'utf8'),
        ...(ext === '.gif' ? { encoding: 'base64' } : {}),
        type: {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json',
          '.svg': 'image/svg+xml',
          '.gif': 'image/gif',
        }[ext],
      };
    }
  }
}
await collect(resolve(root, 'dist'));
await mkdir(resolve(root, 'work'), { recursive: true });
await writeFile(
  resolve(root, 'work/site-assets.js'),
  'export const assets = ' + JSON.stringify(assets) + ';\n',
);
await rm(resolve(root, 'site-dist'), { recursive: true, force: true });
await mkdir(resolve(root, 'site-dist/server'), { recursive: true });
await mkdir(resolve(root, 'site-dist/.openai'), { recursive: true });
await build({
  entryPoints: ['edge/index.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  outfile: 'site-dist/server/index.js',
  minify: true,
  plugins: [
    {
      name: 'site-assets',
      setup(b) {
        b.onResolve({ filter: /^\.\/site-assets\.js$/ }, () => ({
          path: resolve(root, 'work/site-assets.js'),
        }));
      },
    },
  ],
});
await cp(resolve(root, '.openai/hosting.json'), resolve(root, 'site-dist/.openai/hosting.json'));
await cp(resolve(root, 'drizzle'), resolve(root, 'site-dist/drizzle'), { recursive: true });
console.log('Bundle Worker ESM gerado em site-dist/.');
