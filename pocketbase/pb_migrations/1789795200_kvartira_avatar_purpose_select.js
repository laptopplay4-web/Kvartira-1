/// <reference path="../pb_data/types.d.ts" />

/**
 * Fix kvmartira_files.purpose — add "avatar" to select values.
 * PB rejects purpose=avatar with "invalid value avatar" until values updated.
 * Restart `serve` after migrate (PB caches collection schema).
 */

const PURPOSE_VALUES = ['chat', 'assignment', 'support', 'avatar'];

migrate(
  (app) => {
    const files = app.findCollectionByNameOrId('kvartira_files');
    const purposeField = files.fields.getByName('purpose');
    if (!purposeField) return;
    purposeField.values = PURPOSE_VALUES;
    app.save(files);
  },
  (app) => {
    const files = app.findCollectionByNameOrId('kvartira_files');
    const purposeField = files.fields.getByName('purpose');
    if (!purposeField) return;
    purposeField.values = ['chat', 'assignment', 'support'];
    app.save(files);
  },
);
