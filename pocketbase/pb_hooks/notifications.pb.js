/// <reference path="../pb_data/types.d.ts" />

/**
 * ROADMAP 2.10 — notifications hooks:
 * - create: self / admin / teacher
 * - update: lock content fields (read-only mark-as-read)
 * - preferences: own user only
 */

onRecordCreateRequest((e) => {
  const notificationsModule = require(`${__hooks}/lib/kvartiraNotifications.js`);
  notificationsModule.assertNotificationCreate(e);
  e.next();
}, 'notifications');

onRecordUpdateRequest((e) => {
  const notificationsModule = require(`${__hooks}/lib/kvartiraNotifications.js`);
  notificationsModule.assertNotificationUpdate(e);
  e.next();
}, 'notifications');

onRecordCreateRequest((e) => {
  const notificationsModule = require(`${__hooks}/lib/kvartiraNotifications.js`);
  notificationsModule.assertNotificationPreferencesCreate(e);
  e.next();
}, 'notification_preferences');

onRecordUpdateRequest((e) => {
  const notificationsModule = require(`${__hooks}/lib/kvartiraNotifications.js`);
  notificationsModule.assertNotificationPreferencesUpdate(e);
  e.next();
}, 'notification_preferences');

onRecordAfterCreateSuccess((e) => {
  const pushNotify = require(`${__hooks}/lib/kvartiraPush.js`);
  pushNotify.dispatchPushForNotification($app, e.record);
  e.next();
}, 'notifications');
