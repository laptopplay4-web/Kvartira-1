/// <reference path="../pb_data/types.d.ts" />
/**
 * ROADMAP 2.3 — event registration hooks:
 * - capacity check (maxParticipants → 409 «Мест больше нет»)
 * - sync events.registeredUserIds after create/delete
 * - hide the participant id lists from everyone but staff
 */

/**
 * `events` is publicly readable (landing page), so the raw record used to ship
 * the full roster of who is invited and who signed up.
 *
 * The UI needs two things from those lists and nothing else: how many seats are
 * taken, and whether the current user is in them. So for non-staff every other
 * id is replaced with an opaque placeholder — the length and the self-check
 * still work, the roster no longer leaks.
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

  /** @param {string} field */
  const redact = (field) => {
    const raw = e.record.get(field);
    if (!Array.isArray(raw)) return;
    e.record.set(
      field,
      raw.map((id) => (viewerId && String(id) === viewerId ? viewerId : 'hidden')),
    );
  };

  redact('registeredUserIds');
  redact('invitedUserIds');

  e.next();
}, 'events');

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
