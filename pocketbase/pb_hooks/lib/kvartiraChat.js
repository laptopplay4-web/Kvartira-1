/// @ts-check
/**
 * ROADMAP 2.4 — chat hooks:
 * - lastMessage / lastMessageAt sync after message create/update
 * - readBy / status sync when a member marks the chat as read
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

/**
 * @param {core.Record} record
 * @returns {boolean}
 */
function isDeletedMessage(record) {
  const value = record.get('deletedAt');
  return !!(value && String(value).length > 0);
}

/**
 * Keep conversations.lastMessage in sync so the chat list does not need
 * to scan every message (mirrors mock syncConversationMeta).
 *
 * @param {core.App} app
 * @param {string} conversationId
 */
function syncConversationLastMessage(app, conversationId) {
  if (!conversationId) return;

  try {
    const conv = app.findRecordById('conversations', conversationId);
    const msgs = app.findRecordsByFilter(
      'messages',
      `conversation = "${conversationId}"`,
      '-id',
      200,
      0,
    );

    /** @type {core.Record | null} */
    let last = null;
    for (const msg of msgs) {
      if (isDeletedMessage(msg)) continue;
      last = msg;
      break;
    }

    if (last) {
      conv.set('lastMessage', {
        id: last.id,
        text: last.getString('text'),
        senderId: relId(last.get('sender')),
        createdAt: String(last.get('created') || ''),
      });
      conv.set('lastMessageAt', last.get('created'));
    } else {
      conv.set('lastMessage', null);
      conv.set('lastMessageAt', '');
    }
    app.save(conv);
  } catch (err) {
    if (err instanceof NotFoundError) return;
    throw err;
  }
}

/**
 * Members cannot update other users' messages (sender-only updateRule).
 * When lastReadAt changes, mark messages as read server-side.
 *
 * @param {core.App} app
 * @param {core.Record} memberRecord
 */
function syncReadReceipts(app, memberRecord) {
  const convId = relId(memberRecord.get('conversation'));
  const userId = relId(memberRecord.get('user'));
  if (!convId || !userId) return;
  if (!memberRecord.get('lastReadAt')) return;

  const msgs = app.findRecordsByFilter(
    'messages',
    `conversation = "${convId}"`,
    '',
    500,
    0,
  );

  for (const msg of msgs) {
    const raw = msg.get('readBy');
    const readBy = Array.isArray(raw) ? raw.map(String) : [];
    let changed = false;
    if (!readBy.includes(userId)) {
      readBy.push(userId);
      msg.set('readBy', readBy);
      changed = true;
    }
    const sender = relId(msg.get('sender'));
    if (sender && sender !== userId && msg.getString('status') !== 'read') {
      msg.set('status', 'read');
      changed = true;
    }
    if (changed) app.save(msg);
  }
}

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
function isSchoolWideMetadata(raw) {
  if (!raw) return false;
  let meta = raw;
  if (typeof raw === 'string') {
    try {
      meta = JSON.parse(raw);
    } catch (_) {
      return false;
    }
  }
  if (!meta || typeof meta !== 'object') return false;
  const flag = /** @type {{ schoolWide?: unknown }} */ (meta).schoolWide;
  return flag === true || flag === 1 || flag === 'true';
}

/**
 * Add a newly registered user to every school-wide conversation.
 *
 * @param {core.App} app
 * @param {string} userId
 */
function joinUserToSchoolWideChats(app, userId) {
  if (!userId) return;

  try {
    /** @type {core.Record[]} */
    let convs = [];
    try {
      convs = app.findRecordsByFilter('conversations', '', '-id', 500, 0) || [];
    } catch (_) {
      convs = [];
    }
    if (!Array.isArray(convs)) convs = [];

    for (const conv of convs) {
      if (!isSchoolWideMetadata(conv.get('metadata'))) continue;

      const convId = String(conv.id);
      try {
        app.findFirstRecordByFilter(
          'conversation_members',
          `conversation = "${convId}" && user = "${userId}"`,
        );
        continue;
      } catch (_) {
        /* not found — add */
      }

      const membersCol = app.findCollectionByNameOrId('conversation_members');
      const member = new Record(membersCol);
      member.set('conversation', convId);
      member.set('user', userId);
      member.set('role', 'member');
      member.set('muted', null);
      app.save(member);

      let participantIds = [];
      try {
        const rawIds = conv.get('participantIds');
        if (Array.isArray(rawIds)) participantIds = rawIds.map(String);
      } catch (_) {
        participantIds = [];
      }
      if (!participantIds.includes(userId)) {
        participantIds.push(userId);
        conv.set('participantIds', participantIds);
        app.save(conv);
      }
    }
  } catch (err) {
    console.error('joinUserToSchoolWideChats', err);
  }
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
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizePinnedIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

/**
 * pinnedMessageIds may only change for teacher|admin (students are conversation
 * members and would otherwise pass updateRule).
 *
 * @param {core.RecordRequestEvent} e
 */
function assertConversationPinUpdate(e) {
  const auth = e.auth;
  if (!isUsersAuth(auth)) return;

  const original = typeof e.record.original === 'function' ? e.record.original() : e.record;
  const oldPins = normalizePinnedIds(original.get('pinnedMessageIds'));
  const newPins = normalizePinnedIds(e.record.get('pinnedMessageIds'));
  if (oldPins.length === newPins.length && oldPins.every((id, i) => id === newPins[i])) {
    return;
  }

  const role = auth.getString('role');
  if (role !== 'teacher' && role !== 'admin') {
    throw new ApiError(403, 'Закреплять сообщения могут только преподаватель и администратор');
  }
}

module.exports = {
  relId,
  isDeletedMessage,
  syncConversationLastMessage,
  syncReadReceipts,
  joinUserToSchoolWideChats,
  assertConversationPinUpdate,
};
