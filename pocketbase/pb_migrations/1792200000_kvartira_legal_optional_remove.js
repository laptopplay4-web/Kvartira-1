/// <reference path="../pb_data/types.d.ts" />

/**
 * Soft-disable legacy optional consent docs (communication / publication).
 * Keeps rows for user_consents history; registration no longer requires them.
 *
 * PB quirk: required bool treats `false`/`null` as blank — relax fields first.
 */

function relaxBoolField(app, collectionName, fieldName) {
  const col = app.findCollectionByNameOrId(collectionName);
  const field = col.fields.getByName(fieldName);
  if (!field) return;
  field.required = false;
  app.save(col);
}

migrate(
  (app) => {
    relaxBoolField(app, 'legal_documents', 'requiresConsent');
    relaxBoolField(app, 'legal_documents', 'required');

    const collection = app.findCollectionByNameOrId('legal_documents');
    const records = app.findRecordsByFilter(
      collection.id,
      'purpose = "communication" || purpose = "publication"',
      '',
      100,
      0,
    );
    for (const record of records) {
      record.set('requiresConsent', false);
      record.set('required', false);
      app.save(record);
    }
  },
  () => {
    // Irreversible soft-disable; restore via admin CMS / seed if needed.
  },
);
