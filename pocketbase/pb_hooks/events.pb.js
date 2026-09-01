/// <reference path="../pb_data/types.d.ts" />
/**
 * ROADMAP 2.3 — event registration hooks:
 * - capacity check (maxParticipants → 409 «Мест больше нет»)
 * - sync events.registeredUserIds after create/delete
 */

onRecordCreateRequest((e) => {
  const events = require(`${__hooks}/lib/kvartiraEvents.js`);
  events.assertRegistrationCapacity($app, e.record);
  if (e.auth && e.auth.collection().name === 'users' && e.auth.getString('role') !== 'admin') {
    e.record.set('user', e.auth.id);
  }
  e.next();
}, 'event_registrations');

onRecordAfterCreateSuccess((e) => {
  const events = require(`${__hooks}/lib/kvartiraEvents.js`);
  events.syncRegisteredUserIds($app, events.relId(e.record.get('event')));
  e.next();
}, 'event_registrations');

onRecordAfterDeleteSuccess((e) => {
  const events = require(`${__hooks}/lib/kvartiraEvents.js`);
  events.syncRegisteredUserIds($app, events.relId(e.record.get('event')));
  e.next();
}, 'event_registrations');
