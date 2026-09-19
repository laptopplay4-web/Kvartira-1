/**
 * Start pocketbase.exe with env from `node --env-file=.env`
 * (hooks need WEB_PUSH_* / VAPID_* / YCLIENTS_*).
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
  console.error(
    'Use Docker instead: npm run pb:up (set WEB_PUSH_RELAY_URL=http://host.docker.internal:3001/send in .env)',
  );
  process.exit(1);
}

const ycCompany = Boolean(process.env.YCLIENTS_COMPANY_ID?.trim());
const ycPartner = Boolean(process.env.YCLIENTS_PARTNER_TOKEN?.trim());
const ycUser = Boolean(process.env.YCLIENTS_USER_TOKEN?.trim());
console.log(
  `[pb:serve] YCLIENTS: company=${ycCompany ? 'ok' : 'MISSING'} partner=${ycPartner ? 'ok' : 'MISSING'} userToken=${ycUser ? 'ok' : 'missing (cancel needs it)'}`,
);
if (!ycCompany || !ycPartner) {
  console.warn(
    '[pb:serve] Заполните YCLIENTS_COMPANY_ID и YCLIENTS_PARTNER_TOKEN в .env (или pocketbase/yclients.env)',
  );
}

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
