/// <reference path="../pb_data/types.d.ts" />
/**
 * ROADMAP 2.3 — event registration hooks:
 * - capacity check (maxParticipants → 409 «Мест больше нет»)
 * - sync events.registeredUserIds + registeredCount after create/delete
 * - notify staff on new registration
 * - notify students on new event
 * - hide participant id lists from everyone but staff; expose count via registeredCount
 */

onRecordAfterCreateSuccess((e) => {
  // Student notify is done from the FE adapter after create (reliable with current auth).
  // Keep hook export for server-side reseed / future use — avoid duplicate notices.
  e.next();
}, 'events');

onRecordDeleteRequest((e) => {
  const events = require(`${__hooks}/lib/kvartiraEvents.js`);
  events.purgeEventDependents($app, e.record.id);
  e.next();
}, 'events');

/**
 * Non-staff: clear roster arrays (length lied after 'hidden' placeholders).
 * registeredCount stays on the record for capacity UI; isRegistered via own id check
 * is reconstructed client-side from a single-element list when viewer is registered.
 */
onRecordEnrich((e) => {
  const auth = e.auth;
  let isStaff = false;
  let viewerId = '';

  if (auth) {
    try {
      const isUser = auth.collection().name === 'users';
      const role = isUser ? auth.getString('role') : 'admin';
      isStaff = role === 'admin' || role === 'teacher';
      viewerId = isUser ? auth.id : '';
    } catch (_) {
      isStaff = false;
    }
  }

  if (isStaff) {
    e.next();
    return;
  }

  const rawRegistered = e.record.get('registeredUserIds');
  const ids = Array.isArray(rawRegistered) ? rawRegistered.map(String) : [];
  const isRegistered = !!(viewerId && ids.includes(viewerId));

  // Prefer stored registeredCount; fall back to roster length before redact.
  let count = 0;
  try {
    count = e.record.getInt('registeredCount');
  } catch (_) {
    count = 0;
  }
  if (!count && count !== 0) {
    count = ids.length;
  }
  if (typeof count !== 'number' || count < 0) {
    count = ids.length;
  }
  try {
    e.record.set('registeredCount', count);
  } catch (_) {
    /* field may be missing until migration */
  }
  e.record.set('registeredUserIds', isRegistered && viewerId ? [viewerId] : []);

  const rawInvited = e.record.get('invitedUserIds');
  if (Array.isArray(rawInvited)) {
    e.record.set(
      'invitedUserIds',
      rawInvited
        .map(String)
        .filter((id) => (viewerId ? id === viewerId : false)),
    );
  }

  e.next();
}, 'events');

onRecordCreateRequest((e) => {
  const events = require(`${__hooks}/lib/kvartiraEvents.js`);
  events.assertRegistrationCreate($app, e.record, e.auth);
  if (e.auth && e.auth.collection().name === 'users' && e.auth.getString('role') !== 'admin') {
    e.record.set('user', e.auth.id);
  }
  e.next();
}, 'event_registrations');

onRecordAfterCreateSuccess((e) => {
  const events = require(`${__hooks}/lib/kvartiraEvents.js`);
  const eventId = events.relId(e.record.get('event'));
  events.syncRegisteredUserIds($app, eventId);
  events.notifyStaffEventRegistration($app, e.record);
  e.next();
}, 'event_registrations');

/** Stash event/user/auth before delete — AfterDelete often has empty relations; auth only on *Request. */
onRecordDeleteRequest((e) => {
  const events = require(`${__hooks}/lib/kvartiraEvents.js`);
  events.stashUnregistrationNotify(e.record, e.auth);
  e.next();
}, 'event_registrations');

onRecordAfterDeleteSuccess((e) => {
  const events = require(`${__hooks}/lib/kvartiraEvents.js`);
  const stashed = events.takeUnregistrationNotify(e.record.id);
  const eventId =
    events.relId(e.record.get('event')) || (stashed && stashed.eventId) || '';
  if (eventId) {
    events.syncRegisteredUserIds($app, eventId);
  }
  events.notifyStaffEventUnregistration($app, e.record, stashed);
  e.next();
}, 'event_registrations');
