/// <reference path="../pb_data/types.d.ts" />

/**
 * 152-ФЗ consent model (в ред. с 01.09.2025).
 *
 * Consent must be collected per purpose, must be withdrawable, and the operator
 * must be able to prove when and from where it was given. That means:
 *
 * - `legal_documents.purpose` — which processing purpose the document covers;
 * - `legal_documents.required` — the account cannot function without it;
 * - `user_consents.purpose` — copied from the document at acceptance time;
 * - `user_consents.revokedAt` — withdrawal timestamp (rows are never deleted,
 *   the journal has to stay intact);
 * - `user_consents.ipAddress` / `userAgent` — filled by a hook from the real
 *   request, never from the client body;
 * - `user_consents.consentTextVersion` — wording shown at that moment.
 */

const PURPOSE_VALUES = ['service', 'communication', 'publication', 'minor_guardian'];

migrate(
  (app) => {
    const documents = app.findCollectionByNameOrId('legal_documents');
    documents.fields.add(
      new SelectField({
        name: 'purpose',
        required: false,
        maxSelect: 1,
        values: PURPOSE_VALUES,
      }),
    );
    documents.fields.add(new BoolField({ name: 'required', required: false }));

    // One document per type is no longer enough: consent is per purpose, so the
    // school needs several "personal_data" documents (services, mailings,
    // photo publication, guardian). Uniqueness moves to (type, purpose).
    documents.indexes = documents.indexes
      .filter((idx) => !idx.includes('idx_legal_doc_type'))
      .concat(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_doc_type_purpose ON legal_documents (type, purpose)',
      );

    app.save(documents);

    const consents = app.findCollectionByNameOrId('user_consents');
    consents.fields.add(
      new SelectField({
        name: 'purpose',
        required: false,
        maxSelect: 1,
        values: PURPOSE_VALUES,
      }),
    );
    consents.fields.add(new DateField({ name: 'revokedAt', required: false }));
    consents.fields.add(new TextField({ name: 'ipAddress', required: false, max: 64 }));
    consents.fields.add(new TextField({ name: 'userAgent', required: false, max: 512 }));
    consents.fields.add(
      new TextField({ name: 'consentTextVersion', required: false, max: 32 }),
    );
    // Who signed for a student under 18 (152-ФЗ, ст. 9 ч. 6).
    consents.fields.add(new JSONField({ name: 'guardian', required: false, maxSize: 2000 }));

    // A withdrawal must be recorded by the hook, not by whoever holds the token.
    consents.updateRule = null;
    app.save(consents);

    // Existing documents predate the purpose split: the privacy/personal-data
    // pair is what the service itself runs on, so mark those required.
    for (const doc of app.findAllRecords('legal_documents')) {
      if (!doc.getBool('requiresConsent')) continue;
      const type = doc.getString('type');
      if (type === 'privacy_policy' || type === 'personal_data') {
        doc.set('purpose', 'service');
        doc.set('required', true);
        app.save(doc);
      }
    }

    for (const consent of app.findAllRecords('user_consents')) {
      const type = consent.getString('documentType');
      if (type === 'privacy_policy' || type === 'personal_data') {
        consent.set('purpose', 'service');
        app.save(consent);
      }
    }

    // Self-service erasure (152-ФЗ, ст. 21) — only your own account.
    const users = app.findCollectionByNameOrId('users');
    users.deleteRule = 'id = @request.auth.id';
    app.save(users);
  },
  (app) => {
    const documents = app.findCollectionByNameOrId('legal_documents');
    documents.fields.removeByName('purpose');
    documents.fields.removeByName('required');
    documents.indexes = documents.indexes
      .filter((idx) => !idx.includes('idx_legal_doc_type_purpose'))
      .concat('CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_doc_type ON legal_documents (type)');
    app.save(documents);

    const consents = app.findCollectionByNameOrId('user_consents');
    consents.fields.removeByName('purpose');
    consents.fields.removeByName('revokedAt');
    consents.fields.removeByName('ipAddress');
    consents.fields.removeByName('userAgent');
    consents.fields.removeByName('consentTextVersion');
    consents.fields.removeByName('guardian');
    consents.updateRule = '@request.auth.role = "admin"';
    app.save(consents);

    const users = app.findCollectionByNameOrId('users');
    users.deleteRule = null;
    app.save(users);
  },
);
