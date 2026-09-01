/// @ts-check
/**
 * ROADMAP 2.7 — support ticket create/update IDOR.
 * User creates own ticket; admin replies via adminReply + status.
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function relId(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    return String(value.id);
  }
  return '';
}

function isUsersAuth(auth) {
  if (!auth) return false;
  try {
    return auth.collection().name === 'users';
  } catch (_) {
    return false;
  }
}

/**
 * @param {core.App} app
 * @param {core.RecordRequestEvent} e
 */
function assertTicketCreate(_app, e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }

  if (isUsersAuth(auth) && auth.getString('role') !== 'admin') {
    e.record.set('user', auth.id);
    e.record.set('status', 'open');
    e.record.set('adminReply', null);
  }

  const subject = e.record.getString('subject').trim();
  const message = e.record.getString('message').trim();
  if (!subject || !message) {
    throw new ApiError(400, 'Заполните тему и сообщение');
  }
  e.record.set('subject', subject);
  e.record.set('message', message);
}

/**
 * @param {core.App} _app
 * @param {core.RecordRequestEvent} e
 */
function assertTicketUpdate(_app, e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }

  const original = typeof e.record.original === 'function' ? e.record.original() : e.record;
  const role = auth.getString('role');

  if (role === 'admin') {
    const newReply = e.record.get('adminReply');
    const newStatus = e.record.getString('status');

    for (const field of ['user', 'subject', 'message', 'category', 'attachments']) {
      e.record.set(field, original.get(field));
    }
    e.record.set('adminReply', newReply);
    e.record.set('status', newStatus);
    return;
  }

  throw new ApiError(403, 'Нельзя изменить обращение');
}

module.exports = {
  assertTicketCreate,
  assertTicketUpdate,
  relId,
};
