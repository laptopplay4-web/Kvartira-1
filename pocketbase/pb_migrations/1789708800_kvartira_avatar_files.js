/// <reference path="../pb_data/types.d.ts" />

/**
 * Avatar uploads → kvmartira_files (pbfile: refs in users, not base64 in text).
 * PB text max: 0 still defaults to 5000 — set explicit max for short refs.
 */

const AVATAR_REF_MAX = 255;

migrate(
  (app) => {
    const files = app.findCollectionByNameOrId('kvartira_files');
    const purposeField = files.fields.getByName('purpose');
    if (purposeField) {
      purposeField.values = ['chat', 'assignment', 'support', 'avatar'];
    }
    app.save(files);

    const users = app.findCollectionByNameOrId('users');
    for (const name of ['avatarUrl', 'avatarOriginalUrl']) {
      const field = users.fields.getByName(name);
      if (!field) continue;
      if (field.type === 'url') {
        users.fields.removeById(field.id);
        users.fields.add(new Field({ name, type: 'text', required: false, max: AVATAR_REF_MAX }));
        continue;
      }
      if (field.type === 'text') {
        field.max = AVATAR_REF_MAX;
      }
    }
    app.save(users);
  },
  (app) => {
    const files = app.findCollectionByNameOrId('kvartira_files');
    const purposeField = files.fields.getByName('purpose');
    if (purposeField && purposeField.type === 'select') {
      purposeField.values = (purposeField.values ?? []).filter((v) => v !== 'avatar');
    }
    app.save(files);
  },
);
