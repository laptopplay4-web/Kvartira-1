/// <reference path="../pb_data/types.d.ts" />

/**
 * Account approval: users.accountStatus pending|active;
 * guest self-reg → pending; migration sets all non-admin → pending;
 * admin may delete pending (reject) users.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    if (!users.fields.getByName('accountStatus')) {
      users.fields.add(
        new Field({
          name: 'accountStatus',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pending', 'active'],
        }),
      );
    }

    // Self-delete OR admin deleting a non-admin (reject pending / cleanup).
    users.deleteRule =
      'id = @request.auth.id || (@request.auth.role = "admin" && role != "admin" && id != @request.auth.id)';

    app.save(users);

    /** @type {Record[]} */
    let rows = [];
    try {
      rows = app.findRecordsByFilter('users', 'id != ""', '-id', 500, 0) || [];
    } catch (_) {
      rows = [];
    }

    for (const row of rows) {
      const role = row.getString('role');
      row.set('accountStatus', role === 'admin' ? 'active' : 'pending');
      try {
        app.save(row);
      } catch (_) {
        /* best-effort backfill */
      }
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const field = users.fields.getByName('accountStatus');
    if (field) {
      users.fields.removeById(field.id);
    }
    users.deleteRule = 'id = @request.auth.id';
    app.save(users);
  },
);
