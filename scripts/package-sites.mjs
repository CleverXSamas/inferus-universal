import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = process.cwd(),
  output = resolve(root, 'work/site-artifact');
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, 'dist'), { recursive: true });
await mkdir(resolve(output, '.openai'), { recursive: true });
await cp(resolve(root, 'site-dist/server'), resolve(output, 'dist/server'), { recursive: true });
await cp(resolve(root, 'site-dist/.openai/hosting.json'), resolve(output, '.openai/hosting.json'));
await cp(resolve(root, 'drizzle'), resolve(output, 'drizzle'), { recursive: true });
execFileSync('tar', ['-czf', resolve(root, 'work/site-version.tar.gz'), '-C', output, '.']);
console.log('Archive: ' + resolve(root, 'work/site-version.tar.gz'));
