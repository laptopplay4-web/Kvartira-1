/// @ts-check
/**
 * ROADMAP 2.3 — event registration capacity + registeredUserIds sync.
 * Mirrors mock EventsApi: unique registration, maxParticipants → FULL.
 */

/**
 * @param {string} value
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
 * @param {core.App} app
 * @param {core.Record} record
 */
function assertRegistrationCapacity(app, record) {
  const eventId = relId(record.get('event'));
  if (!eventId) return;

  const event = app.findRecordById('events', eventId);
  const max = event.getInt('maxParticipants');
  if (!max || max < 1) return;

  const existing = app.findRecordsByFilter(
    'event_registrations',
    `event = "${eventId}"`,
    '',
    500,
    0,
  );
  if (existing.length >= max) {
    throw new ApiError(409, 'Мест больше нет');
  }
}

/**
 * Keep events.registeredUserIds in sync so list/detail UI can show spots
 * without listing other users' registrations (RBAC: own-row).
 *
 * @param {core.App} app
 * @param {string} eventId
 */
function syncRegisteredUserIds(app, eventId) {
  if (!eventId) return;

  try {
    const event = app.findRecordById('events', eventId);
    const regs = app.findRecordsByFilter(
      'event_registrations',
      `event = "${eventId}"`,
      '',
      500,
      0,
    );
    const ids = [];
    for (const reg of regs) {
      const userId = relId(reg.get('user'));
      if (userId) ids.push(userId);
    }
    event.set('registeredUserIds', ids);
    app.save(event);
  } catch (err) {
    if (err instanceof NotFoundError) return;
    throw err;
  }
}

module.exports = {
  assertRegistrationCapacity,
  syncRegisteredUserIds,
  relId,
};
