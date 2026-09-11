/**
 * One-shot: apply school-wide conversation rules + join all users into schoolWide chats.
 * Usage: node --env-file=.env scripts/fix-school-wide-chats.mjs
 */
const base = (process.env.PB_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const email = process.env.PB_ADMIN_EMAIL;
const password = process.env.PB_ADMIN_PASSWORD;

async function auth() {
  const res = await fetch(`${base}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  if (!res.ok) throw new Error(`auth ${res.status}: ${await res.text()}`);
  return /** @type {{ token: string }} */ (await res.json()).token;
}

async function api(token, path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: token,
      ...(init.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

async function listAll(token, collection, filter) {
  const items = [];
  let page = 1;
  for (;;) {
    const params = new URLSearchParams({ page: String(page), perPage: '100' });
    if (filter) params.set('filter', filter);
    const data = await api(token, `/api/collections/${collection}/records?${params}`);
    items.push(...data.items);
    if (page >= data.totalPages) break;
    page += 1;
  }
  return items;
}

async function main() {
  const token = await auth();

  const ADMIN = '@request.auth.role = "admin"';
  const MEMBER = `${ADMIN} || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id)`;
  const listRule = `${MEMBER} || metadata.schoolWide = true`;

  const col = await api(token, '/api/collections/conversations');
  await api(token, `/api/collections/${col.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ listRule, viewRule: listRule }),
  });
  console.log('updated conversations list/view rules');

  const conversations = await listAll(token, 'conversations');
  const schoolWide = conversations.filter((c) => c.metadata?.schoolWide === true);
  console.log('school-wide chats:', schoolWide.length, schoolWide.map((c) => c.title));

  const users = await listAll(token, 'users');
  let added = 0;

  for (const conv of schoolWide) {
    const members = await listAll(token, 'conversation_members', `conversation="${conv.id}"`);
    const memberIds = new Set(members.map((m) => m.user));
    const participantIds = Array.isArray(conv.participantIds) ? [...conv.participantIds] : [];

    for (const user of users) {
      if (memberIds.has(user.id)) continue;
      await api(token, '/api/collections/conversation_members/records', {
        method: 'POST',
        body: JSON.stringify({
          conversation: conv.id,
          user: user.id,
          role: 'member',
          muted: false,
        }),
      });
      if (!participantIds.includes(user.id)) participantIds.push(user.id);
      added += 1;
      console.log('joined', user.firstName, user.lastName, '→', conv.title);
    }

    await api(token, `/api/collections/conversations/records/${conv.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ participantIds }),
    });
  }

  console.log('done, newly joined:', added);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
