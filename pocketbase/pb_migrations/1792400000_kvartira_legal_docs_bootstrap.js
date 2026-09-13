/// <reference path="../pb_data/types.d.ts" />

/**
 * Legal documents production hardening:
 * - `requiresConsent` / `required` optional bools (false ≠ blank in PB)
 * - autodate created/updated for list sort
 * - bootstrap missing registration docs so `/legal` + `/register` work without manual seed
 */

const PURPOSE_SERVICE = 'service';
const PURPOSE_GUARDIAN = 'minor_guardian';

const DISCLAIMER =
  '\n\n---\nШаблон. Проверить у юриста перед публикацией. Текст носит демонстрационный характер и не заменяет юридическую консультацию.';

/** Minimal texts so registration/list work before `npm run pb:seed:legal` refreshes full copy. */
const BOOTSTRAP_DOCS = [
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
      'Без этого согласия пользоваться Приложением нельзя. Права субъекта — по 152-ФЗ (доступ, уточнение, экспорт, удаление аккаунта).' +
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
      'Регистрация по приглашению Школы и отметка согласий означают принятие условий использования PWA «Квартира».\n\n' +
      'Пользователь несёт ответственность за загружаемый контент в чатах. Жалобы — через «Помощь» или «Пожаловаться» у сообщения.' +
      DISCLAIMER,
  },
  {
    type: 'school_rules',
    purpose: '',
    title: 'Правила школы',
    currentVersion: '2.1',
    requiresConsent: false,
    required: false,
    content:
      'Правила школы «Квартира»\n\n' +
      'Запись, перенос и отмена занятий — через приложение. На занятиях и в чатах — уважительное поведение.' +
      DISCLAIMER,
  },
  {
    type: 'personal_data',
    purpose: PURPOSE_GUARDIAN,
    title: 'Согласие законного представителя',
    currentVersion: '2.1',
    requiresConsent: true,
    required: false,
    content:
      'Согласие законного представителя несовершеннолетнего\n\n' +
      'Я даю согласие школе «Квартира» на обработку персональных данных представляемого мною ребёнка в целях оказания образовательных услуг через PWA «Квартира».' +
      DISCLAIMER,
  },
];

/**
 * @param {import('pocketbase').CoreApp} app
 * @param {string} name
 * @param {string} fieldName
 */
function relaxBoolField(app, name, fieldName) {
  const col = app.findCollectionByNameOrId(name);
  const field = col.fields.getByName(fieldName);
  if (field) {
    field.required = false;
  }
  app.save(col);
}

/**
 * @param {import('pocketbase').CoreApp} app
 * @param {string} name
 */
function ensureAutodateFields(app, name) {
  const col = app.findCollectionByNameOrId(name);
  if (!col.fields.getByName('created')) {
    col.fields.add(
      new Field({
        name: 'created',
        type: 'autodate',
        required: false,
        onCreate: true,
        onUpdate: false,
      }),
    );
  }
  if (!col.fields.getByName('updated')) {
    col.fields.add(
      new Field({
        name: 'updated',
        type: 'autodate',
        required: false,
        onCreate: true,
        onUpdate: true,
      }),
    );
  }
  app.save(col);
}

/**
 * @param {import('pocketbase').CoreApp} app
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
 * @param {import('pocketbase').CoreApp} app
 */
function bootstrapMissingLegalDocuments(app) {
  const collection = app.findCollectionByNameOrId('legal_documents');
  const today = new Date().toISOString().slice(0, 10);

  for (const doc of BOOTSTRAP_DOCS) {
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
        changeSummary: 'Bootstrap при миграции (полный текст — pb:seed:legal / админка).',
      },
    ]);
    app.save(record);
  }
}

migrate(
  (app) => {
    relaxBoolField(app, 'legal_documents', 'requiresConsent');
    relaxBoolField(app, 'legal_documents', 'required');
    ensureAutodateFields(app, 'legal_documents');
    bootstrapMissingLegalDocuments(app);
  },
  (app) => {
    const col = app.findCollectionByNameOrId('legal_documents');
    const requiresConsent = col.fields.getByName('requiresConsent');
    if (requiresConsent) requiresConsent.required = true;
    const required = col.fields.getByName('required');
    if (required) required.required = false;
    col.fields.removeByName('created');
    col.fields.removeByName('updated');
    app.save(col);
  },
);
