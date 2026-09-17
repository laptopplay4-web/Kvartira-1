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
 * Decode conversations.participantIds from JS array or PB JSONRaw ([]byte).
 * Must not treat JSONRaw byte arrays as id lists — that would wipe participants.
 *
 * @param {unknown} raw
 * @returns {string[]}
 */
function asParticipantIdArray(raw) {
  if (raw == null) return [];

  if (typeof raw === 'string') {
    try {
      return asParticipantIdArray(JSON.parse(raw));
    } catch (_) {
      return [];
    }
  }

  if (typeof raw === 'object') {
    const keys = Object.keys(/** @type {object} */ (raw));
    const len = Array.isArray(raw) ? raw.length : keys.length;
    const looksIndexed =
      Array.isArray(raw) || (keys.length > 0 && keys.every((k) => /^\d+$/.test(k)));

    if (looksIndexed && len > 0) {
      const first = /** @type {any} */ (raw)[0];
      // JSONRaw: numeric char codes → JSON text like `["id1","id2"]`
      if (typeof first === 'number') {
        let jsonText = '';
        for (let i = 0; i < len; i += 1) {
          const code = /** @type {any} */ (raw)[i];
          if (typeof code !== 'number') return [];
          jsonText += String.fromCharCode(code);
        }
        try {
          return asParticipantIdArray(JSON.parse(jsonText));
        } catch (_) {
          return [];
        }
      }
    }

    if (Array.isArray(raw)) {
      return [...new Set(raw.map(String).filter(Boolean))];
    }
  }

  return [];
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
 * @param {unknown} attachments
 * @returns {string}
 */
function attachmentsPreviewLabel(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return 'Вложение';
  if (attachments.length !== 1) return 'Вложение';
  const a = attachments[0];
  if (!a || typeof a !== 'object') return 'Вложение';
  const type = String(/** @type {{ type?: string }} */ (a).type || '');
  const filename = String(/** @type {{ filename?: string }} */ (a).filename || '');
  const kind = String(/** @type {{ kind?: string }} */ (a).kind || '');
  if (type === 'image') return 'Фото';
  if (type === 'video') return 'Видео';
  if (kind === 'voice' || (type === 'audio' && filename.startsWith('voice-'))) return 'Голосовое';
  if (type === 'audio') return filename || 'Аудио';
  return filename || 'Файл';
}

/**
 * @param {string} text
 * @param {unknown} attachments
 * @returns {boolean}
 */
function isSyntheticMediaCaption(text, attachments) {
  const trimmed = String(text || '').trim();
  if (!trimmed || !Array.isArray(attachments) || attachments.length === 0) return false;
  const placeholders = new Set(['Вложение', 'Фото', 'Видео', 'Голосовое', 'Аудио', 'Файл']);
  if (placeholders.has(trimmed)) return true;
  return attachments.some(
    (a) => a && typeof a === 'object' && String(/** @type {{ filename?: string }} */ (a).filename || '') === trimmed,
  );
}

/**
 * @param {core.Record} record
 * @returns {string}
 */
function previewTextFromMessage(record) {
  const text = record.getString('text');
  /** @type {unknown} */
  let attachments = record.get('attachments');
  if (typeof attachments === 'string') {
    try {
      attachments = JSON.parse(attachments);
    } catch {
      attachments = [];
    }
  }
  if (text && !isSyntheticMediaCaption(text, attachments)) return text;
  return attachmentsPreviewLabel(attachments) || text || 'Вложение';
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
    // Sort by created (not id) — PB ids are not chronological.
    const msgs = app.findRecordsByFilter(
      'messages',
      `conversation = "${conversationId}"`,
      '-created',
      50,
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
        text: previewTextFromMessage(last),
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
        participantIds = asParticipantIdArray(conv.get('participantIds'));
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

/**
 * @param {core.App} app
 * @param {string} conversationId
 * @param {string} userId
 */
function ensureMemberInConversation(app, conversationId, userId) {
  if (!conversationId || !userId) return;

  try {
    app.findFirstRecordByFilter(
      'conversation_members',
      `conversation = "${conversationId}" && user = "${userId}"`,
    );
    return;
  } catch (_) {
    /* not found — add */
  }

  const membersCol = app.findCollectionByNameOrId('conversation_members');
  const member = new Record(membersCol);
  member.set('conversation', conversationId);
  member.set('user', userId);
  member.set('role', 'member');
  member.set('muted', null);
  app.save(member);

  try {
    const conv = app.findRecordById('conversations', conversationId);
    let participantIds = [];
    try {
      participantIds = asParticipantIdArray(conv.get('participantIds'));
    } catch (_) {
      participantIds = [];
    }
    if (!participantIds.includes(userId)) {
      participantIds.push(userId);
      conv.set('participantIds', participantIds);
      app.save(conv);
    }
  } catch (err) {
    console.error('ensureMemberInConversation participants', err);
  }
}

/**
 * After a group chat is created — every admin becomes a member.
 *
 * @param {core.App} app
 * @param {core.Record} conversationRecord
 */
function joinAdminsToGroupConversation(app, conversationRecord) {
  if (!conversationRecord) return;
  const type = String(conversationRecord.getString('type') || '');
  if (type === 'personal') return;

  const convId = String(conversationRecord.id);
  /** @type {core.Record[]} */
  let admins = [];
  try {
    admins = app.findRecordsByFilter('users', 'role = "admin"', '-id', 100, 0) || [];
  } catch (_) {
    admins = [];
  }
  if (!Array.isArray(admins)) admins = [];

  for (const admin of admins) {
    try {
      ensureMemberInConversation(app, convId, String(admin.id));
    } catch (err) {
      console.error('joinAdminsToGroupConversation', err);
    }
  }
}

/**
 * When a user becomes admin — join every group conversation (not personal).
 *
 * @param {core.App} app
 * @param {string} userId
 */
function joinAdminToAllGroupChats(app, userId) {
  if (!userId) return;

  try {
    /** @type {core.Record[]} */
    let convs = [];
    // Prefer type = "group" — `!=` filters are unreliable across PB versions
    // and may return an empty list without throwing (skipping the fallback).
    try {
      convs = app.findRecordsByFilter('conversations', 'type = "group"', '-id', 500, 0) || [];
    } catch (_) {
      convs = [];
    }
    if (!Array.isArray(convs) || convs.length === 0) {
      try {
        convs = (app.findRecordsByFilter('conversations', '', '-id', 500, 0) || []).filter(
          (c) => String(c.getString('type') || '') === 'group',
        );
      } catch (_) {
        convs = [];
      }
    }
    if (!Array.isArray(convs)) convs = [];

    for (const conv of convs) {
      if (String(conv.getString('type') || '') !== 'group') continue;
      ensureMemberInConversation(app, String(conv.id), userId);
    }
  } catch (err) {
    console.error('joinAdminToAllGroupChats', err);
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
  asParticipantIdArray,
  isDeletedMessage,
  syncConversationLastMessage,
  syncReadReceipts,
  joinUserToSchoolWideChats,
  joinAdminsToGroupConversation,
  joinAdminToAllGroupChats,
  assertConversationPinUpdate,
};
