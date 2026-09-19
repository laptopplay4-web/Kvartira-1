/// <reference path="../pb_data/types.d.ts" />

/**
 * YCLIENTS BFF — book / cancel / schedule / mappings.
 * Logic lives in lib/kvartiraYclients.js (routerAdd callbacks can't see file-local functions).
 */

routerAdd('GET', '/api/kvartira/yclients/status', (e) => {
  const yc = require(`${__hooks}/lib/kvartiraYclients.js`);
  yc.requireAuthUser(e);
  const cfg = yc.getConfig();
  return e.json(200, {
    configured: yc.isConfigured(),
    companyIdSet: Boolean(cfg.companyId),
    userTokenSet: Boolean(cfg.userToken),
  });
});

routerAdd('GET', '/api/kvartira/yclients/mappings', (e) => {
  const yc = require(`${__hooks}/lib/kvartiraYclients.js`);
  yc.requireAuthUser(e);
  return e.json(200, yc.loadMappings($app));
});

routerAdd('PUT', '/api/kvartira/yclients/mappings', (e) => {
  const yc = require(`${__hooks}/lib/kvartiraYclients.js`);
  const auth = yc.requireAuthUser(e);
  yc.assertAdmin(auth);
  const body = e.requestInfo().body || {};
  const saved = yc.saveMappings($app, {
    directionToServiceIds: body.directionToServiceIds || {},
    staffToUserId: body.staffToUserId || {},
  });
  return e.json(200, saved);
});

routerAdd('GET', '/api/kvartira/yclients/staff', (e) => {
  const yc = require(`${__hooks}/lib/kvartiraYclients.js`);
  const auth = yc.requireAuthUser(e);
  const q = e.requestInfo().query || {};
  const serviceId = q.service_id ? Number(q.service_id) : 0;
  const serviceIds = serviceId > 0 ? [serviceId] : undefined;
  const staff = yc.getBookStaff(serviceIds);
  const role = yc.roleOf(auth);
  const list = role === 'admin' ? staff : staff.filter((s) => s.bookable);
  return e.json(200, { items: list });
});

routerAdd('GET', '/api/kvartira/yclients/services', (e) => {
  const yc = require(`${__hooks}/lib/kvartiraYclients.js`);
  yc.requireAuthUser(e);
  const q = e.requestInfo().query || {};
  const staffId = q.staff_id ? Number(q.staff_id) : 0;
  const services = yc.getBookServices(staffId > 0 ? staffId : undefined);
  return e.json(200, { items: services });
});

routerAdd('GET', '/api/kvartira/yclients/slots', (e) => {
  const yc = require(`${__hooks}/lib/kvartiraYclients.js`);
  yc.requireAuthUser(e);
  const q = e.requestInfo().query || {};
  const staffId = Number(q.staff_id || 0);
  const date = String(q.date || '');
  const serviceId = q.service_id ? Number(q.service_id) : 0;
  if (!staffId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError(400, 'Нужны staff_id и date (YYYY-MM-DD)');
  }
  const slots = yc.getBookTimes(staffId, date, serviceId > 0 ? [serviceId] : undefined);
  return e.json(200, { items: slots });
});

routerAdd('GET', '/api/kvartira/yclients/records', (e) => {
  const yc = require(`${__hooks}/lib/kvartiraYclients.js`);
  const auth = yc.requireAuthUser(e);
  const mappings = yc.loadMappings($app);
  const q = e.requestInfo().query || {};
  const startDate = String(q.from || q.start_date || '');
  const endDate = String(q.to || q.end_date || '');
  const role = yc.roleOf(auth);
  const params = { startDate: startDate || undefined, endDate: endDate || undefined, count: 200 };

  if (role === 'admin') {
    if (q.staff_id) params.staffId = Number(q.staff_id);
  } else if (role === 'teacher') {
    let staffId = null;
    Object.keys(mappings.staffToUserId).forEach((sid) => {
      if (mappings.staffToUserId[sid] === String(auth.id)) staffId = Number(sid);
    });
    if (!staffId) {
      return e.json(200, { items: [] });
    }
    params.staffId = staffId;
  } else {
    const client = yc.findOrCreateClient(yc.phoneOf(auth), yc.fullNameOf(auth));
    params.clientId = client.id;
  }

  const items = yc.listRecords(params);
  return e.json(200, { items });
});

routerAdd('GET', '/api/kvartira/yclients/records/{id}', (e) => {
  const yc = require(`${__hooks}/lib/kvartiraYclients.js`);
  const auth = yc.requireAuthUser(e);
  const mappings = yc.loadMappings($app);
  const id = Number(e.request.pathValue('id'));
  if (!id) throw new ApiError(400, 'Некорректный id');
  const record = yc.getRecord(id);
  const role = yc.roleOf(auth);

  if (role === 'admin') {
    return e.json(200, record);
  }
  if (role === 'teacher') {
    const mapped = mappings.staffToUserId[String(record.staffId)];
    if (mapped !== String(auth.id)) throw new ApiError(403, 'Нет доступа');
    return e.json(200, record);
  }
  const digits = yc.normalizePhoneDigits(yc.phoneOf(auth));
  const recDigits = yc.normalizePhoneDigits(record.clientPhone || '');
  if (digits && recDigits && digits === recDigits) {
    return e.json(200, record);
  }
  try {
    const client = yc.findOrCreateClient(yc.phoneOf(auth), yc.fullNameOf(auth));
    if (record.clientId && Number(record.clientId) === client.id) {
      return e.json(200, record);
    }
  } catch (_) {
    /* deny */
  }
  throw new ApiError(403, 'Нет доступа');
});

routerAdd('POST', '/api/kvartira/yclients/book', (e) => {
  const yc = require(`${__hooks}/lib/kvartiraYclients.js`);
  const auth = yc.requireAuthUser(e);
  const body = e.requestInfo().body || {};
  const staffId = Number(body.staffId || 0);
  const serviceId = Number(body.serviceId || 0);
  const datetime = String(body.datetime || '');
  if (!staffId || !serviceId || !datetime) {
    throw new ApiError(400, 'Нужны staffId, serviceId, datetime');
  }

  const role = yc.roleOf(auth);
  let phone = yc.phoneOf(auth);
  let name = yc.fullNameOf(auth);

  if ((role === 'teacher' || role === 'admin') && body.studentPhone) {
    phone = String(body.studentPhone);
    name = String(body.studentName || phone);
  } else if (role === 'teacher' && !body.studentPhone) {
    throw new ApiError(400, 'Укажите studentPhone ученика');
  }

  yc.findOrCreateClient(phone, name);
  const record = yc.bookRecord({
    phone,
    name,
    staffId,
    serviceId,
    datetime,
    comment: body.comment,
  });
  return e.json(200, record);
});

routerAdd('POST', '/api/kvartira/yclients/cancel', (e) => {
  const yc = require(`${__hooks}/lib/kvartiraYclients.js`);
  const auth = yc.requireAuthUser(e);
  const mappings = yc.loadMappings($app);
  const body = e.requestInfo().body || {};
  const recordId = Number(body.recordId || body.id || 0);
  if (!recordId) throw new ApiError(400, 'Нужен recordId');

  const record = yc.getRecord(recordId);
  const role = yc.roleOf(auth);

  if (role === 'admin') {
    // ok
  } else if (role === 'teacher') {
    const mapped = mappings.staffToUserId[String(record.staffId)];
    if (mapped !== String(auth.id)) throw new ApiError(403, 'Нет доступа');
  } else {
    const digits = yc.normalizePhoneDigits(yc.phoneOf(auth));
    const recDigits = yc.normalizePhoneDigits(record.clientPhone || '');
    let ok = digits && recDigits && digits === recDigits;
    if (!ok) {
      try {
        const client = yc.findOrCreateClient(yc.phoneOf(auth), yc.fullNameOf(auth));
        ok = record.clientId && Number(record.clientId) === client.id;
      } catch (_) {
        ok = false;
      }
    }
    if (!ok) throw new ApiError(403, 'Нет доступа');
  }

  yc.cancelRecord(recordId);
  return e.json(200, { ok: true, id: recordId });
});

routerAdd('GET', '/api/kvartira/yclients/schedule', (e) => {
  const yc = require(`${__hooks}/lib/kvartiraYclients.js`);
  const auth = yc.requireAuthUser(e);
  const role = yc.roleOf(auth);
  if (role !== 'teacher' && role !== 'admin') {
    throw new ApiError(403, 'Нет доступа к графику работы');
  }
  const mappings = yc.loadMappings($app);
  const staffId = yc.resolveOwnStaffId(auth, mappings);
  if (!staffId) {
    throw new ApiError(404, 'Сотрудник YCLIENTS не связан с аккаунтом');
  }
  const q = e.requestInfo().query || {};
  const from = String(q.from || q.start_date || '');
  const to = String(q.to || q.end_date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new ApiError(400, 'Нужны from и to (YYYY-MM-DD)');
  }
  const items = yc.getStaffSchedule(staffId, from, to);
  return e.json(200, { staffId, from, to, items });
});

routerAdd('PUT', '/api/kvartira/yclients/schedule', (e) => {
  const yc = require(`${__hooks}/lib/kvartiraYclients.js`);
  const auth = yc.requireAuthUser(e);
  const role = yc.roleOf(auth);
  if (role !== 'teacher' && role !== 'admin') {
    throw new ApiError(403, 'Нет доступа к графику работы');
  }
  const mappings = yc.loadMappings($app);
  const staffId = yc.resolveOwnStaffId(auth, mappings);
  if (!staffId) {
    throw new ApiError(404, 'Сотрудник YCLIENTS не связан с аккаунтом');
  }
  const body = e.requestInfo().body || {};
  const schedulesToSet = Array.isArray(body.schedulesToSet) ? body.schedulesToSet : [];
  const schedulesToDelete = Array.isArray(body.schedulesToDelete)
    ? body.schedulesToDelete
    : [];
  // Force own staffId — ignore client-supplied staff ids (IDOR)
  const forcedSet = schedulesToSet.map((item) => ({
    staffId,
    dates: item.dates,
    slots: item.slots,
  }));
  const forcedDelete = schedulesToDelete.map((item) => ({
    staffId,
    dates: item.dates,
  }));
  const items = yc.setStaffSchedule({
    schedulesToSet: forcedSet,
    schedulesToDelete: forcedDelete,
  });
  return e.json(200, { staffId, items });
});
