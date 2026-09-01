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

module.exports = {
  relId,
  isDeletedMessage,
  syncConversationLastMessage,
  syncReadReceipts,
};
