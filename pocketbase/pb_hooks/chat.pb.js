/// <reference path="../pb_data/types.d.ts" />
/**
 * ROADMAP 2.4 — chat hooks:
 * - force message sender = auth (non-admin)
 * - sync conversations.lastMessage after message write
 * - sync read receipts when conversation_members.lastReadAt changes
 */

onRecordCreateRequest((e) => {
  if (
    e.auth &&
    e.auth.collection().name === 'users' &&
    e.auth.getString('role') !== 'admin'
  ) {
    e.record.set('sender', e.auth.id);
  }
  e.next();
}, 'messages');

onRecordAfterCreateSuccess((e) => {
  const chat = require(`${__hooks}/lib/kvartiraChat.js`);
  chat.syncConversationLastMessage($app, chat.relId(e.record.get('conversation')));
  e.next();
}, 'messages');

onRecordAfterUpdateSuccess((e) => {
  const chat = require(`${__hooks}/lib/kvartiraChat.js`);
  chat.syncConversationLastMessage($app, chat.relId(e.record.get('conversation')));
  e.next();
}, 'messages');

onRecordAfterDeleteSuccess((e) => {
  const chat = require(`${__hooks}/lib/kvartiraChat.js`);
  chat.syncConversationLastMessage($app, chat.relId(e.record.get('conversation')));
  e.next();
}, 'messages');

onRecordAfterUpdateSuccess((e) => {
  const chat = require(`${__hooks}/lib/kvartiraChat.js`);
  chat.syncReadReceipts($app, e.record);
  e.next();
}, 'conversation_members');
