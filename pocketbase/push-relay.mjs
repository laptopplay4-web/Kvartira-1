/**
 * ROADMAP 3.3 — optional Web Push relay for PocketBase hooks.
 * PB hook sends POST here when WEB_PUSH_RELAY_URL is set (e.g. http://127.0.0.1:3001/send).
 *
 * Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
 * Usage: npm run push:relay
 */

import http from 'node:http';
import webpush from 'web-push';

const port = Number(process.env.PUSH_RELAY_PORT || 3001);
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@kvartira.local';
const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (!publicKey || !privateKey) {
  console.error('Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to run push relay');
  process.exit(1);
}

webpush.setVapidDetails(subject, publicKey, privateKey);

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/send') {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  try {
    const { subscription, payload } = JSON.parse(body);
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      { TTL: 86400 },
    );
    res.writeHead(204);
    res.end();
  } catch (err) {
    const status = err?.statusCode === 410 || err?.statusCode === 404 ? 410 : 500;
    res.writeHead(status, { 'Content-Type': 'text/plain' });
    res.end(err?.body || String(err));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Push relay listening on http://127.0.0.1:${port}/send`);
});
