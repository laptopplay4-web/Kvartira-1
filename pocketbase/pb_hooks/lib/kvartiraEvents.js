/// @ts-check
/**
 * ROADMAP 2.3 — event registration capacity + registeredUserIds sync + staff notify.
 */

/** @type {Set<string>} */
const purgingEventIds = new Set();

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
 * @param {core.Record|null|undefined} auth
 */
function assertRegistrationCreate(app, record, auth) {
  if (!auth || auth.collection().name !== 'users') {
    return;
  }
  const role = auth.getString('role');
  if (role !== 'student') {
    throw new ApiError(403, 'Запись на мероприятие доступна только ученикам');
  }
  assertRegistrationCapacity(app, record);
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
 * Keep events.registeredUserIds + registeredCount in sync.
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
    try {
      event.set('registeredCount', ids.length);
    } catch (_) {
      /* field may be missing until migration */
    }
    app.save(event);
  } catch (err) {
    if (err instanceof NotFoundError) return;
    throw err;
  }
}

/**
 * Notify all teachers + admins about a new registration (events badge; not inbox).
 *
 * @param {core.App} app
 * @param {core.Record} registration
 */
function notifyStaffEventRegistration(app, registration) {
  try {
    const eventId = relId(registration.get('event'));
    const studentId = relId(registration.get('user'));
    if (!eventId || !studentId) return;

    const event = app.findRecordById('events', eventId);
    let studentName = 'Ученик';
    try {
      const student = app.findRecordById('users', studentId);
      studentName = `${student.getString('firstName')} ${student.getString('lastName')}`.trim() || studentName;
    } catch (_) {
      /* keep default */
    }

    const notifications = require(`${__hooks}/lib/kvartiraNotifications.js`);
    const title = 'Новая запись на мероприятие';
    const body = `${studentName} записался(ась) на «${event.getString('title')}»`;
    const link = `/events/${eventId}?p=${encodeURIComponent(studentId)}&c=join`;

    const staff = app.findRecordsByFilter(
      'users',
      'role = "teacher" || role = "admin"',
      '',
      500,
      0,
    );
    for (const user of staff) {
      notifications.createNotificationForUser(app, user.id, 'event', title, body, link);
    }
  } catch (_) {
    /* never fail registration because of notify */
  }
}

/**
 * After delete, relation fields on the record are often empty.
 * Stash event/user (+ auth) in DeleteRequest, consume in AfterDeleteSuccess.
 *
 * @type {Map<string, { eventId: string, studentId: string, authId: string, authRole: string }>}
 */
const pendingUnregistrationNotifies = new Map();

/**
 * @param {core.Record} registration
 * @param {core.Record|null|undefined} [auth]
 */
function stashUnregistrationNotify(registration, auth) {
  try {
    const id = registration && registration.id ? String(registration.id) : '';
    const eventId = relId(registration.get('event'));
    const studentId = relId(registration.get('user'));
    if (!id || !eventId || !studentId) return;
    const authId = auth ? String(auth.id) : '';
    const authRole =
      auth && typeof auth.getString === 'function' ? auth.getString('role') : '';
    pendingUnregistrationNotifies.set(id, { eventId, studentId, authId, authRole });
  } catch (_) {
    /* ignore */
  }
}

/**
 * @param {string} registrationId
 * @returns {{ eventId: string, studentId: string, authId: string, authRole: string }|null}
 */
function takeUnregistrationNotify(registrationId) {
  const key = String(registrationId || '');
  if (!key) return null;
  const data = pendingUnregistrationNotifies.get(key) || null;
  pendingUnregistrationNotifies.delete(key);
  return data;
}

/**
 * Notify staff when a registration is removed (student cancel or staff remove).
 * Skipped while purgeEventDependents runs (event delete).
 * Pass stashed payload from DeleteRequest (relations/auth often missing after delete).
 *
 * @param {core.App} app
 * @param {core.Record} registration
 * @param {{ eventId: string, studentId: string, authId: string, authRole: string }|null|undefined} [stashed]
 */
function notifyStaffEventUnregistration(app, registration, stashed) {
  try {
    const eventId = relId(registration.get('event')) || (stashed && stashed.eventId) || '';
    const studentId = relId(registration.get('user')) || (stashed && stashed.studentId) || '';
    if (!eventId || !studentId) return;
    if (purgingEventIds.has(eventId)) return;

    const event = app.findRecordById('events', eventId);
    let studentName = 'Ученик';
    try {
      const student = app.findRecordById('users', studentId);
      studentName = `${student.getString('firstName')} ${student.getString('lastName')}`.trim() || studentName;
    } catch (_) {
      /* keep default */
    }

    const authId = (stashed && stashed.authId) || '';
    const authRole = (stashed && stashed.authRole) || '';
    const removedByStaff =
      !!authId &&
      (authRole === 'teacher' || authRole === 'admin') &&
      authId !== String(studentId);

    const notifications = require(`${__hooks}/lib/kvartiraNotifications.js`);
    const title = removedByStaff
      ? 'Участник удалён с мероприятия'
      : 'Отмена участия в мероприятии';
    const body = removedByStaff
      ? `${studentName} удалён(а) из «${event.getString('title')}»`
      : `${studentName} отменил(а) участие в «${event.getString('title')}»`;
    const link = `/events/${eventId}?p=${encodeURIComponent(studentId)}&c=leave`;

    const staff = app.findRecordsByFilter(
      'users',
      'role = "teacher" || role = "admin"',
      '',
      500,
      0,
    ) || [];
    for (const user of staff) {
      notifications.createNotificationForUser(app, user.id, 'event', title, body, link);
    }
  } catch (_) {
    /* never fail unregister because of notify */
  }
}

/**
 * Notify students about a newly created event (events badge; not inbox).
 * Invited events → only invited students.
 *
 * @param {core.App} app
 * @param {core.Record} eventRecord
 */
function notifyStudentsNewEvent(app, eventRecord) {
  try {
    const eventId = eventRecord.id;
    if (!eventId) return;

    const type = eventRecord.getString('type');
    const title = 'Новое мероприятие';
    const body = eventRecord.getString('title') || 'Мероприятие школы';
    const link = `/events/${eventId}`;
    const notifications = require(`${__hooks}/lib/kvartiraNotifications.js`);

    /** @type {string[]} */
    let studentIds = [];

    if (type === 'invited') {
      const raw = eventRecord.get('invitedUserIds');
      const invitedIds = Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
      for (const userId of invitedIds) {
        try {
          const user = app.findRecordById('users', userId);
          if (user.getString('role') === 'student') studentIds.push(userId);
        } catch (_) {
          /* skip missing */
        }
      }
    } else {
      const students = app.findRecordsByFilter('users', 'role = "student"', '', 500, 0) || [];
      for (const user of students) {
        if (user && user.id) studentIds.push(user.id);
      }
    }

    for (const userId of studentIds) {
      notifications.createNotificationForUser(app, userId, 'event', title, body, link);
    }
  } catch (_) {
    /* never fail event create because of notify */
  }
}

/**
 * Delete registrations (and best-effort event notifications) before event delete.
 * Needed when cascadeDelete was never applied on live DB.
 *
 * @param {core.App} app
 * @param {string} eventId
 */
function purgeEventDependents(app, eventId) {
  if (!eventId) return;

  purgingEventIds.add(eventId);
  try {
    try {
      const regs =
        app.findRecordsByFilter('event_registrations', `event = "${eventId}"`, '', 500, 0) || [];
      for (const reg of regs) {
        try {
          app.delete(reg);
        } catch (_) {
          /* continue */
        }
      }
    } catch (_) {
      /* ignore */
    }

    try {
      const link = `/events/${eventId}`;
      const notifs =
        app.findRecordsByFilter('notifications', `link = "${link}"`, '', 500, 0) || [];
      for (const n of notifs) {
        try {
          app.delete(n);
        } catch (_) {
          /* continue */
        }
      }
    } catch (_) {
      /* ignore */
    }
  } finally {
    purgingEventIds.delete(eventId);
  }
}

module.exports = {
  assertRegistrationCreate,
  assertRegistrationCapacity,
  syncRegisteredUserIds,
  notifyStaffEventRegistration,
  notifyStaffEventUnregistration,
  stashUnregistrationNotify,
  takeUnregistrationNotify,
  notifyStudentsNewEvent,
  purgeEventDependents,
  relId,
};
