/**
 * Idempotent ensure of registration/consent legal_documents.
 * Called from onBootstrap so empty production DB still serves /legal + /register.
 */

const PURPOSE_SERVICE = 'service';
const PURPOSE_GUARDIAN = 'minor_guardian';

const DISCLAIMER =
  '\n\n---\nШаблон. Проверить у юриста перед публикацией. Текст носит демонстрационный характер и не заменяет юридическую консультацию.';

const DOCS = [
  {
    type: 'privacy_policy',
    purpose: PURPOSE_SERVICE,
    title: 'Политика конфиденциальности',
    currentVersion: '3.1',
    requiresConsent: true,
    required: true,
    content:
      'Политика конфиденциальности веб-приложения и PWA «Квартира» школы музыки и вокала «Квартира».\n\n' +
      'Оператор обрабатывает персональные данные для оказания образовательных услуг: аккаунт, занятия, чат, ДЗ, мероприятия, безопасность.\n\n' +
      'Актуальный полный текст публикуется в приложении (/legal). При существенных изменениях потребуется повторное согласие.' +
      DISCLAIMER,
  },
  {
    type: 'personal_data',
    purpose: PURPOSE_SERVICE,
    title: 'Согласие на обработку персональных данных',
    currentVersion: '2.1',
    requiresConsent: true,
    required: true,
    content:
      'Согласие на обработку персональных данных\n\n' +
      'Я даю согласие Оператору — школа музыки и вокала «Квартира» — на обработку моих персональных данных в целях оказания образовательных услуг через веб-приложение и PWA «Квартира».\n\n' +
      'Без этого согласия пользоваться Приложением нельзя.' +
      DISCLAIMER,
  },
  {
    type: 'terms_of_service',
    purpose: PURPOSE_SERVICE,
    title: 'Пользовательское соглашение',
    currentVersion: '3.0',
    requiresConsent: true,
    required: true,
    content:
      'Пользовательское соглашение\n\n' +
      'Регистрация по приглашению Школы и отметка согласий означают принятие условий использования PWA «Квартира».' +
      DISCLAIMER,
  },
  {
    type: 'school_rules',
    purpose: '',
    title: 'Правила школы',
    currentVersion: '2.1',
    requiresConsent: false,
    required: false,
    content: 'Правила школы «Квартира». Запись и отмена занятий — через приложение.' + DISCLAIMER,
  },
  {
    type: 'personal_data',
    purpose: PURPOSE_GUARDIAN,
    title: 'Согласие законного представителя',
    currentVersion: '2.1',
    requiresConsent: true,
    required: false,
    content:
      'Согласие законного представителя несовершеннолетнего на обработку ПДн ребёнка для обучения в PWA «Квартира».' +
      DISCLAIMER,
  },
];

/**
 * @param {*} app
 * @param {{ type: string, purpose: string }} doc
 */
function findExisting(app, doc) {
  const collection = app.findCollectionByNameOrId('legal_documents');
  let filter = `type = "${doc.type}"`;
  if (doc.purpose) {
    filter += ` && purpose = "${doc.purpose}"`;
  } else {
    filter += ' && (purpose = "" || purpose = null)';
  }
  try {
    const rows = app.findRecordsByFilter(collection.id, filter, '', 1, 0);
    return rows && rows.length > 0 ? rows[0] : null;
  } catch (_) {
    return null;
  }
}

/**
 * Create missing required legal docs only (never overwrite admin/seed content).
 * @param {*} app
 * @returns {{ created: number }}
 */
function ensureRequiredLegalDocuments(app) {
  const collection = app.findCollectionByNameOrId('legal_documents');
  const today = new Date().toISOString().slice(0, 10);
  let created = 0;

  for (const doc of DOCS) {
    if (findExisting(app, doc)) continue;

    const record = new Record(collection);
    record.set('type', doc.type);
    record.set('title', doc.title);
    record.set('content', doc.content);
    record.set('currentVersion', doc.currentVersion);
    record.set('effectiveAt', today);
    record.set('purpose', doc.purpose || '');
    record.set('requiresConsent', doc.requiresConsent === true);
    record.set('required', doc.required === true);
    record.set('versionHistory', [
      {
        version: doc.currentVersion,
        effectiveAt: today,
        changeSummary: 'Bootstrap при старте PB (полный текст — pb:seed:legal).',
      },
    ]);
    app.save(record);
    created += 1;
  }

  return { created };
}

module.exports = {
  ensureRequiredLegalDocuments,
};
