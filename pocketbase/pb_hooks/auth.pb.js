/// <reference path="../pb_data/types.d.ts" />
/**
 * ROADMAP 1.3 — phone+password auth, JWT (built-in PB token), login history hooks.
 *
 * Client: POST /api/collections/users/auth-with-password
 *   { "identity": "+79001234567", "password": "..." }
 * Hook resolves identity via users.phone when email lookup misses.
 */

onRecordAuthWithPasswordRequest((e) => {
  const auth = require(`${__hooks}/lib/kvartiraAuth.js`);

  if (!e.record && e.identity) {
    const phone = auth.normalizePhone(e.identity);
    if (auth.isValidPhone(phone)) {
      try {
        e.record = $app.findFirstRecordByData('users', 'phone', phone);
      } catch (_) {
        /* user not found — PB returns generic invalid credentials */
      }
    }
  }

  const record = e.record;
  if (record && e.password && !record.validatePassword(e.password)) {
    auth.recordLoginAttempt($app, record.id, false, e);
    throw new BadRequestError('Invalid login credentials.');
  }

  e.next();
}, 'users');

onRecordAuthRequest((e) => {
  const auth = require(`${__hooks}/lib/kvartiraAuth.js`);
  const securityAuth = require(`${__hooks}/lib/kvartiraSecurity.js`);

  if (e.record && e.authMethod === 'password') {
    auth.recordLoginAttempt($app, e.record.id, true, e);
    securityAuth.recordSecuritySession($app, e.record.id, e);
  }
  e.next();
}, 'users');

onRecordCreateRequest((e) => {
  const auth = require(`${__hooks}/lib/kvartiraAuth.js`);
  const record = e.record;
  const phone = auth.normalizePhone(record.getString('phone'));

  if (!auth.isValidPhone(phone)) {
    throw new BadRequestError('Формат телефона: +79XXXXXXXXX');
  }

  try {
    $app.findFirstRecordByData('users', 'phone', phone);
    throw new BadRequestError('Пользователь с таким телефоном уже существует');
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    /* record not found — ok to create */
  }

  record.set('phone', phone);

  if (!record.getString('email')) {
    record.set('email', auth.phoneToEmail(phone));
  }

  if (!record.getString('role')) {
    record.set('role', 'student');
  }

  e.next();
}, 'users');
