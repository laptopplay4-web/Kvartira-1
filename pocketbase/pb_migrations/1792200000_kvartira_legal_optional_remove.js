/// <reference path="../pb_data/types.d.ts" />

/**
 * Soft-disable legacy optional consent docs (communication / publication).
 * Keeps rows for user_consents history; registration no longer requires them.
 */

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('legal_documents');
    const records = app.findRecordsByFilter(
      collection.id,
      'purpose = "communication" || purpose = "publication"',
      '',
      100,
      0,
    );
    for (const record of records) {
      record.set('requiresConsent', null);
      record.set('required', null);
      app.save(record);
    }
  },
  () => {
    // Irreversible soft-disable; restore via admin CMS / seed if needed.
  },
);
