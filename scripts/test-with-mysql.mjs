// Disposable local integration database; never uses a production URL implicitly.
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
const env = { ...process.env };
const name = `inferus-test-${randomBytes(6).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const dockerArgs = process.env.INFERUS_DOCKER_SOCKET
  ? [`--host=${process.env.INFERUS_DOCKER_SOCKET}`]
  : [];
const docker = (...args) =>
  execFileSync('docker', [...dockerArgs, ...args], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
let created = false;
try {
  if (!env.TEST_DATABASE_URL) {
    docker(
      'run',
      '-d',
      '--name',
      name,
      '--tmpfs',
      '/var/lib/mysql:rw,size=512m',
      '-p',
      '127.0.0.1::3306',
      '-e',
      `MYSQL_ROOT_PASSWORD=${password}`,
      '-e',
      'MYSQL_ROOT_HOST=%',
      '-e',
      'MYSQL_DATABASE=inferus_test',
      'mysql:8.4',
      '--innodb-redo-log-capacity=8388608',
      '--innodb-buffer-pool-size=33554432',
    );
    created = true;
    const port = docker('port', name, '3306/tcp').split(':').at(-1);
    env.TEST_DATABASE_URL = `mysql://root:${password}@127.0.0.1:${port}/inferus_test`;
  }
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const db = await mysql.createConnection(env.TEST_DATABASE_URL);
      await db.query('SELECT 1');
      await db.end();
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!ready) throw new Error('MySQL de testes não ficou disponível em 60 segundos.');
  console.log('MySQL disponível. Executando a suíte completa.');
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn('npm', ['test'], { env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} catch (e) {
  console.error(
    created
      ? e.message
      : 'Não foi possível iniciar o MySQL de testes. Verifique Docker, espaço livre e a imagem mysql:8.4.',
  );
  process.exitCode = 1;
} finally {
  if (created) {
    try {
      docker('rm', '-fv', name);
    } catch {
      console.error(`Remova o banco temporário com docker rm -fv ${name}`);
    }
  }
}
