/**
 * YCLIENTS Partner API proxy helpers (PocketBase JSVM).
 * Env: YCLIENTS_PARTNER_TOKEN, YCLIENTS_USER_TOKEN, YCLIENTS_COMPANY_ID
 * Optional: YCLIENTS_API_BASE (default https://api.yclients.com/api/v1)
 *
 * If process env is empty (pocketbase.exe started without --env-file), also reads
 * keys from `pocketbase/yclients.env` or project `.env` (YCLIENTS_* lines only).
 * Uses global ApiError from PocketBase hooks runtime.
 */

/** @type {Record<string, string>|null} */
let fileEnvCache = null;

function readTextFile(path) {
  try {
    const raw = $os.readFile(path);
    if (raw == null) return '';
    if (typeof raw === 'string') return raw;
    // []byte / JSONRaw-like
    if (typeof raw === 'object') {
      const keys = Object.keys(raw);
      const len = Array.isArray(raw) ? raw.length : keys.length;
      let s = '';
      for (let i = 0; i < len; i += 1) {
        const code = /** @type {any} */ (raw)[i];
        if (typeof code === 'number') s += String.fromCharCode(code);
      }
      return s;
    }
    return String(raw);
  } catch (_) {
    return '';
  }
}

function parseEnvText(text) {
  /** @type {Record<string, string>} */
  const out = {};
  String(text || '')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) return;
      const key = trimmed.slice(0, eq).trim();
      if (!key.startsWith('YCLIENTS_')) return;
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    });
  return out;
}

function loadFileEnv() {
  if (fileEnvCache) return fileEnvCache;
  // Paths relative to pb_hooks → pocketbase/
  const candidates = [
    `${__hooks}/../yclients.env`,
    `${__hooks}/../../.env`,
  ];
  /** @type {Record<string, string>} */
  const merged = {};
  candidates.forEach((p) => {
    const text = readTextFile(p);
    if (!text) return;
    const parsed = parseEnvText(text);
    Object.keys(parsed).forEach((k) => {
      if (parsed[k]) merged[k] = parsed[k];
    });
  });
  fileEnvCache = merged;
  return merged;
}

function envGet(name) {
  const fromOs = String($os.getenv(name) || '').trim();
  if (fromOs) return fromOs;
  const fromFile = loadFileEnv()[name];
  return fromFile ? String(fromFile).trim() : '';
}

function getConfig() {
  const companyId = envGet('YCLIENTS_COMPANY_ID');
  const partnerToken = envGet('YCLIENTS_PARTNER_TOKEN');
  const userToken = envGet('YCLIENTS_USER_TOKEN');
  const base = (
    envGet('YCLIENTS_API_BASE') || 'https://api.yclients.com/api/v1'
  ).replace(/\/$/, '');
  return { companyId, partnerToken, userToken, base };
}

function assertConfigured() {
  const cfg = getConfig();
  if (!cfg.companyId || !cfg.partnerToken) {
    throw new ApiError(
      503,
      'YCLIENTS не настроен: задайте YCLIENTS_COMPANY_ID и YCLIENTS_PARTNER_TOKEN',
    );
  }
  return cfg;
}

function authHeader(cfg) {
  if (cfg.userToken) {
    return `Bearer ${cfg.partnerToken}, User ${cfg.userToken}`;
  }
  return `Bearer ${cfg.partnerToken}`;
}

/**
 * @param {string} method
 * @param {string} path - starts with / after base, may include query
 * @param {object|null} body
 */
function ycRequest(method, path, body) {
  const cfg = assertConfigured();
  const url = path.startsWith('http') ? path : `${cfg.base}${path}`;
  const headers = {
    Accept: 'application/vnd.api.v2+json',
    Authorization: authHeader(cfg),
    'Content-Type': 'application/json',
  };
  const res = $http.send({
    url,
    method: method || 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    timeout: 30,
  });

  let parsed = null;
  try {
    parsed = res.body ? JSON.parse(String(res.body)) : null;
  } catch (_) {
    parsed = null;
  }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    const msg =
      (parsed && (parsed.meta && parsed.meta.message)) ||
      (parsed && parsed.message) ||
      `YCLIENTS HTTP ${res.statusCode}`;
    throw new ApiError(res.statusCode >= 400 && res.statusCode < 600 ? res.statusCode : 502, String(msg));
  }

  return parsed && parsed.data !== undefined ? parsed.data : parsed;
}

function companyId() {
  return assertConfigured().companyId;
}

function normalizePhoneDigits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return '7' + digits.slice(1);
  if (digits.length === 10 && digits.startsWith('9')) return '7' + digits;
  return digits;
}

function toDisplayPhone(digits) {
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+${digits}`;
  }
  return digits ? `+${digits}` : '';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseDatetime(dt) {
  // "2026-09-19 15:00:00" / ISO / date-only "2026-09-19"
  const s = String(dt || '').replace('T', ' ').trim();
  const withTime = s.match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  if (withTime) {
    return {
      date: withTime[1],
      startTime: `${withTime[2]}:${withTime[3]}`,
      datetime: `${withTime[1]}T${withTime[2]}:${withTime[3]}:00`,
    };
  }
  const dateOnly = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) {
    return { date: dateOnly[1], startTime: '', datetime: `${dateOnly[1]}T00:00:00` };
  }
  return { date: '', startTime: '', datetime: s };
}

function mapStaffList(data) {
  const list = Array.isArray(data) ? data : [];
  return list.map((s) => ({
    id: Number(s.id),
    name: String(s.name || s.display_name || ''),
    specialization: s.specialization ? String(s.specialization) : undefined,
    avatarUrl: s.avatar || s.img || undefined,
    bookable: s.bookable !== false && s.fired !== 1,
  }));
}

function mapServices(data) {
  const services = (data && data.services) || (Array.isArray(data) ? data : []);
  const list = Array.isArray(services) ? services : [];
  return list.map((svc) => ({
    id: Number(svc.id),
    title: String(svc.title || svc.name || ''),
    durationMinutes: Number(svc.duration || svc.seance_length || 60) || 60,
    staffIds: Array.isArray(svc.staff)
      ? svc.staff.map((x) => Number(x.id || x)).filter((n) => n > 0)
      : [],
  }));
}

function mapBookTimes(data, date) {
  // data may be array of { time: "15:00" } or nested seances
  const raw = Array.isArray(data) ? data : data && data.seances ? data.seances : [];
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item) => {
      const time = String(item.time || item.datetime || '').slice(0, 5);
      if (!/^\d{2}:\d{2}$/.test(time)) return null;
      const [hh, mm] = time.split(':').map(Number);
      const endMin = hh * 60 + mm + Number(item.length || item.seance_length || 60);
      const endH = Math.floor(endMin / 60) % 24;
      const endM = endMin % 60;
      return {
        date,
        startTime: time,
        endTime: `${pad2(endH)}:${pad2(endM)}`,
        datetime: `${date} ${time}:00`,
      };
    })
    .filter(Boolean);
}

function mapRecord(rec) {
  const dt = parseDatetime(rec.datetime || rec.date);
  const services = Array.isArray(rec.services)
    ? rec.services.map((s) => ({
        id: Number(s.id),
        title: s.title || s.name,
        duration: Number(s.duration || s.length || 0) || undefined,
      }))
    : [];
  const duration =
    Number(rec.seance_length || rec.length || 0) ||
    (services[0] && services[0].duration) ||
    60;
  const client = rec.client || {};
  return {
    id: Number(rec.id),
    staffId: Number(rec.staff_id || (rec.staff && rec.staff.id) || 0),
    services,
    clientId: client.id ? Number(client.id) : rec.client_id ? Number(rec.client_id) : undefined,
    clientPhone: client.phone || rec.client_phone || undefined,
    clientName: client.name || client.display_name || undefined,
    datetime: dt.datetime,
    date: dt.date || String(rec.date || '').slice(0, 10),
    startTime: dt.startTime,
    durationMinutes: duration,
    deleted: Boolean(rec.deleted),
    attendance: rec.attendance !== undefined ? Number(rec.attendance) : undefined,
    comment: rec.comment ? String(rec.comment) : undefined,
  };
}

function getBookStaff(serviceIds) {
  const cid = companyId();
  let path = `/book_staff/${cid}`;
  if (serviceIds && serviceIds.length) {
    path += `?service_ids[]=${serviceIds.join('&service_ids[]=')}`;
  }
  return mapStaffList(ycRequest('GET', path, null));
}

function getBookServices(staffId) {
  const cid = companyId();
  let path = `/book_services/${cid}`;
  if (staffId) path += `?staff_id=${staffId}`;
  return mapServices(ycRequest('GET', path, null));
}

function getBookTimes(staffId, date, serviceIds) {
  const cid = companyId();
  let path = `/book_times/${cid}/${staffId}/${date}`;
  if (serviceIds && serviceIds.length) {
    path += `?service_ids[]=${serviceIds.join('&service_ids[]=')}`;
  }
  return mapBookTimes(ycRequest('GET', path, null), date);
}

/**
 * Find client by phone; create if missing.
 * Uses admin clients API when user token present.
 */
function findOrCreateClient(phone, fullName) {
  const cfg = assertConfigured();
  const digits = normalizePhoneDigits(phone);
  const display = toDisplayPhone(digits);
  if (!digits) {
    throw new ApiError(400, 'Укажите телефон в профиле');
  }

  // Search
  try {
    const found = ycRequest(
      'GET',
      `/clients/${cfg.companyId}?phone=${encodeURIComponent(display)}&page=1&count=5`,
      null,
    );
    const list = Array.isArray(found) ? found : found && found.data ? found.data : [];
    const match = (Array.isArray(list) ? list : []).find((c) => {
      const p = normalizePhoneDigits(c.phone || c.phone_raw || '');
      return p === digits;
    });
    if (match && match.id) {
      return { id: Number(match.id), phone: display, name: match.name || fullName, created: false };
    }
  } catch (_) {
    /* fall through to create */
  }

  const created = ycRequest('POST', `/clients/${cfg.companyId}`, {
    phone: display,
    name: fullName || display,
  });
  const client = Array.isArray(created) ? created[0] : created;
  if (!client || !client.id) {
    throw new ApiError(502, 'Не удалось создать клиента в YCLIENTS');
  }
  return { id: Number(client.id), phone: display, name: client.name || fullName, created: true };
}

function bookRecord(input) {
  const cid = companyId();
  const phone = toDisplayPhone(normalizePhoneDigits(input.phone));
  const appointments = [
    {
      id: 0,
      services: [{ id: Number(input.serviceId) }],
      staff_id: Number(input.staffId),
      datetime: input.datetime,
    },
  ];
  const body = {
    phone,
    fullname: input.fullname || phone,
    email: input.email || '',
    comment: input.comment || 'Запись из приложения Квартира',
    appointments,
  };
  const data = ycRequest('POST', `/book_record/${cid}`, body);
  const list = Array.isArray(data) ? data : [data];
  const first = list[0];
  if (!first) throw new ApiError(502, 'YCLIENTS не вернул запись');
  return mapRecord(first);
}

function listRecords(params) {
  const cfg = assertConfigured();
  const q = [];
  if (params.staffId) q.push(`staff_id=${params.staffId}`);
  if (params.clientId) q.push(`client_id=${params.clientId}`);
  if (params.startDate) q.push(`start_date=${params.startDate}`);
  if (params.endDate) q.push(`end_date=${params.endDate}`);
  q.push('page=1');
  q.push(`count=${params.count || 200}`);
  const path = `/records/${cfg.companyId}?${q.join('&')}`;
  const data = ycRequest('GET', path, null);
  const list = Array.isArray(data) ? data : [];
  return list.map(mapRecord).filter((r) => r && r.id && !r.deleted);
}

function getRecord(recordId) {
  const cfg = assertConfigured();
  const data = ycRequest('GET', `/record/${cfg.companyId}/${recordId}`, null);
  return mapRecord(data);
}

function cancelRecord(recordId) {
  const cfg = assertConfigured();
  if (!cfg.userToken) {
    throw new ApiError(
      503,
      'Отмена записи требует YCLIENTS_USER_TOKEN (токен пользователя с доступом к журналу)',
    );
  }
  ycRequest('DELETE', `/records/${cfg.companyId}/${recordId}`, null);
  return { ok: true, id: Number(recordId) };
}

function isConfigured() {
  const cfg = getConfig();
  return Boolean(cfg.companyId && cfg.partnerToken);
}

function readMappingsFromContacts(contacts) {
  if (!contacts || typeof contacts !== 'object') {
    return { directionToServiceIds: {}, staffToUserId: {} };
  }
  const raw = contacts.yclientsMappings;
  if (!raw || typeof raw !== 'object') {
    return { directionToServiceIds: {}, staffToUserId: {} };
  }
  const directionToServiceIds = {};
  const dir = raw.directionToServiceIds || {};
  Object.keys(dir).forEach((k) => {
    const arr = Array.isArray(dir[k]) ? dir[k].map(Number).filter((n) => n > 0) : [];
    if (arr.length) directionToServiceIds[k] = arr;
  });
  const staffToUserId = {};
  const st = raw.staffToUserId || {};
  Object.keys(st).forEach((k) => {
    if (typeof st[k] === 'string' && st[k].trim()) staffToUserId[String(k)] = st[k].trim();
  });
  return { directionToServiceIds, staffToUserId };
}

function requireAuthUser(e) {
  const rbac = require(`${__hooks}/lib/kvartiraRbac.js`);
  const info = e.requestInfo();
  const auth = info && info.auth;
  if (!auth || !rbac.isUsersAuth(auth)) {
    throw new ApiError(401, 'Нужна авторизация');
  }
  return auth;
}

function roleOf(auth) {
  try {
    return String(auth.getString('role') || '');
  } catch (_) {
    return '';
  }
}

function fullNameOf(auth) {
  const first = String(auth.getString('firstName') || '').trim();
  const last = String(auth.getString('lastName') || '').trim();
  return `${first} ${last}`.trim() || String(auth.getString('phone') || '');
}

function phoneOf(auth) {
  return String(auth.getString('phone') || '');
}

function assertAdmin(auth) {
  if (roleOf(auth) !== 'admin') {
    throw new ApiError(403, 'Только администратор');
  }
}

function findSchoolSettingsRecord(app) {
  try {
    return app.findFirstRecordByFilter('school_settings', 'id != ""');
  } catch (_) {
    return null;
  }
}

function loadMappings(app) {
  const invite = require(`${__hooks}/lib/kvartiraInvite.js`);
  const rec = findSchoolSettingsRecord(app);
  if (!rec) return { directionToServiceIds: {}, staffToUserId: {} };
  const contacts = invite.readJsonObjectField(rec, 'contacts') || {};
  return readMappingsFromContacts(contacts);
}

function saveMappings(app, mappings) {
  const invite = require(`${__hooks}/lib/kvartiraInvite.js`);
  let rec = findSchoolSettingsRecord(app);
  if (!rec) {
    const collection = app.findCollectionByNameOrId('school_settings');
    rec = new Record(collection);
    rec.set('name', 'Школа');
    rec.set('tagline', '');
    rec.set('about', '');
    rec.set('contacts', {});
    app.save(rec);
  }
  const contacts = Object.assign({}, invite.readJsonObjectField(rec, 'contacts') || {});
  contacts.yclientsMappings = {
    directionToServiceIds: mappings.directionToServiceIds || {},
    staffToUserId: mappings.staffToUserId || {},
  };
  rec.set('contacts', contacts);
  app.save(rec);
  return contacts.yclientsMappings;
}

function isApiError(err) {
  return Boolean(
    err &&
      typeof err.status === 'number' &&
      err.status >= 400 &&
      (typeof err.message === 'string' || err.name === 'ApiError'),
  );
}

/**
 * Resolve YCLIENTS staff_id for the authenticated user via staffToUserId mapping.
 * @returns {number|null}
 */
function resolveOwnStaffId(auth, mappings) {
  const userId = String(auth.id);
  const map = (mappings && mappings.staffToUserId) || {};
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i += 1) {
    if (String(map[keys[i]]) === userId) {
      const n = Number(keys[i]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function mapScheduleDay(row) {
  const slotsRaw = Array.isArray(row.slots) ? row.slots : [];
  const slots = slotsRaw
    .map((s) => ({
      from: String((s && s.from) || '').slice(0, 5),
      to: String((s && s.to) || '').slice(0, 5),
    }))
    .filter((s) => /^\d{2}:\d{2}$/.test(s.from) && /^\d{2}:\d{2}$/.test(s.to));
  const date = String(row.date || '').slice(0, 10);
  const isWorking =
    row.is_working === 1 ||
    row.is_working === true ||
    (slots.length > 0 && row.is_working !== 0 && row.is_working !== false);
  return {
    staffId: Number(row.staff_id || 0) || undefined,
    date,
    slots,
    isWorking: Boolean(isWorking && slots.length > 0),
    offDayType:
      row.off_day_type !== undefined && row.off_day_type !== null
        ? Number(row.off_day_type)
        : undefined,
  };
}

/**
 * GET company/{id}/staff/schedule?start_date&end_date&staff_ids[]=
 */
function getStaffSchedule(staffId, startDate, endDate) {
  const cfg = assertConfigured();
  if (!cfg.userToken) {
    throw new ApiError(
      503,
      'График работы требует YCLIENTS_USER_TOKEN (токен пользователя с доступом к журналу)',
    );
  }
  const sid = Number(staffId);
  if (!sid || !/^\d{4}-\d{2}-\d{2}$/.test(String(startDate)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(endDate))) {
    throw new ApiError(400, 'Нужны staff_id, start_date и end_date (YYYY-MM-DD)');
  }
  const q = [
    `start_date=${encodeURIComponent(startDate)}`,
    `end_date=${encodeURIComponent(endDate)}`,
    `staff_ids[]=${sid}`,
    'include[]=off_day_type',
  ];
  const path = `/company/${cfg.companyId}/staff/schedule?${q.join('&')}`;
  const data = ycRequest('GET', path, null);
  const list = Array.isArray(data) ? data : [];
  return list.map(mapScheduleDay).filter((d) => d.date);
}

/**
 * PUT company/{id}/staff/schedule — schedules_to_set / schedules_to_delete
 */
function setStaffSchedule(input) {
  const cfg = assertConfigured();
  if (!cfg.userToken) {
    throw new ApiError(
      503,
      'График работы требует YCLIENTS_USER_TOKEN (токен пользователя с доступом к журналу)',
    );
  }
  const schedulesToSet = Array.isArray(input.schedulesToSet) ? input.schedulesToSet : [];
  const schedulesToDelete = Array.isArray(input.schedulesToDelete)
    ? input.schedulesToDelete
    : [];
  if (!schedulesToSet.length && !schedulesToDelete.length) {
    throw new ApiError(400, 'Нет изменений графика');
  }
  const body = {
    schedules_to_set: schedulesToSet.map((item) => ({
      staff_id: Number(item.staffId),
      dates: Array.isArray(item.dates) ? item.dates.map(String) : [],
      slots: Array.isArray(item.slots)
        ? item.slots.map((s) => ({
            from: String(s.from).slice(0, 5),
            to: String(s.to).slice(0, 5),
          }))
        : [],
    })),
    schedules_to_delete: schedulesToDelete.map((item) => ({
      staff_id: Number(item.staffId),
      dates: Array.isArray(item.dates) ? item.dates.map(String) : [],
    })),
  };
  const data = ycRequest('PUT', `/company/${cfg.companyId}/staff/schedule`, body);
  const list = Array.isArray(data) ? data : [];
  return list.map(mapScheduleDay).filter((d) => d.date);
}

module.exports = {
  getConfig,
  isConfigured,
  assertConfigured,
  getBookStaff,
  getBookServices,
  getBookTimes,
  findOrCreateClient,
  bookRecord,
  listRecords,
  getRecord,
  cancelRecord,
  readMappingsFromContacts,
  normalizePhoneDigits,
  toDisplayPhone,
  mapRecord,
  requireAuthUser,
  roleOf,
  fullNameOf,
  phoneOf,
  assertAdmin,
  loadMappings,
  saveMappings,
  isApiError,
  resolveOwnStaffId,
  getStaffSchedule,
  setStaffSchedule,
  mapScheduleDay,
};
