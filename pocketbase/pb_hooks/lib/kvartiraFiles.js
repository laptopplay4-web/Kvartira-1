/// @ts-check
/**
 * ROADMAP 3.1 — kvartira_files create/update guards.
 */

const PURPOSES = ['chat', 'assignment', 'support'];

/**
 * @param {import('pocketbase').App} app
 * @param {import('pocketbase').RecordRequestEvent} e
 */
function assertFileCreate(app, e) {
  const auth = e.auth;
  if (!auth?.id) {
    throw new Error('Unauthorized');
  }

  const owner = e.record.get('owner');
  if (owner !== auth.id && auth.get('role') !== 'admin') {
    throw new Error('owner must match authenticated user');
  }

  const purpose = e.record.get('purpose');
  if (!PURPOSES.includes(purpose)) {
    throw new Error('invalid purpose');
  }

  const size = Number(e.record.get('size'));
  if (!Number.isFinite(size) || size < 1) {
    throw new Error('invalid size');
  }

  const filename = String(e.record.get('originalFilename') ?? '').trim();
  if (!filename) {
    throw new Error('originalFilename required');
  }

  const mimeType = String(e.record.get('mimeType') ?? '').trim();
  if (!mimeType) {
    throw new Error('mimeType required');
  }
}

/**
 * @param {import('pocketbase').App} app
 * @param {import('pocketbase').RecordRequestEvent} e
 */
function assertFileUpdate(app, e) {
  const auth = e.auth;
  if (!auth?.id) {
    throw new Error('Unauthorized');
  }

  if (auth.get('role') === 'admin') {
    return;
  }

  const old = e.record.original();
  if (old.get('owner') !== auth.id) {
    throw new Error('forbidden');
  }

  for (const field of ['owner', 'purpose', 'originalFilename', 'mimeType', 'size', 'file']) {
    if (e.record.get(field) !== old.get(field)) {
      throw new Error(`field locked: ${field}`);
    }
  }
}

module.exports = {
  assertFileCreate,
  assertFileUpdate,
};
