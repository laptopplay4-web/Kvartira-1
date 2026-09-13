/**
 * Start pocketbase.exe with env from `node --env-file=.env`
 * (hooks need WEB_PUSH_RELAY_URL / WEB_PUSH_RELAY_SECRET / VAPID_*).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pbDir = path.join(root, 'pocketbase');
const exe = path.join(pbDir, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');

if (!existsSync(exe)) {
  console.error(`Not found: ${exe}`);
  console.error('Use Docker instead: npm run pb:up (set WEB_PUSH_RELAY_URL=http://host.docker.internal:3001/send in .env)');
  process.exit(1);
}

// No `shell: true` — path with spaces (e.g. "Kvartira 1") breaks otherwise.
const child = spawn(
  exe,
  ['serve', '--dir=./pb_data', '--hooksDir=./pb_hooks', '--migrationsDir=./pb_migrations'],
  { cwd: pbDir, env: process.env, stdio: 'inherit' },
);

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
