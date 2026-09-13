/// <reference path="../pb_data/types.d.ts" />

/**
 * Events: registeredCount (capacity UI) + imageUrl text (file upload via pbfile:)
 * + kvartira_files purpose "event".
 */

const PURPOSE_VALUES = ['chat', 'assignment', 'support', 'avatar', 'school', 'event'];

const AUTH = '@request.auth.id != ""';
const ADMIN = '@request.auth.role = "admin"';
const FILE_ACCESS = `${ADMIN} || owner = @request.auth.id || purpose = "school" || purpose = "event" || (purpose = "chat" && contextId != "" && @collection.conversation_members.conversation ?= contextId && @collection.conversation_members.user ?= @request.auth.id) || (purpose = "assignment" && contextId != "" && @collection.assignments.id ?= contextId && (@collection.assignments.teacher ?= @request.auth.id || (@collection.assignment_groups.id ?= @collection.assignments.group && (@collection.assignment_groups.kind = "general" || @collection.assignment_groups.members.id ?= @request.auth.id)))) || (purpose = "support" && contextId != "" && @collection.support_tickets.id ?= contextId && (@collection.support_tickets.user ?= @request.auth.id || @request.auth.role = "admin"))`;

migrate(
  (app) => {
    const events = app.findCollectionByNameOrId('events');

    if (!events.fields.getByName('registeredCount')) {
      events.fields.add(
        new Field({
          name: 'registeredCount',
          type: 'number',
          required: false,
          min: 0,
          onlyInt: true,
        }),
      );
    }

    const imageUrl = events.fields.getByName('imageUrl');
    if (imageUrl && imageUrl.type !== 'text') {
      events.fields.removeById(imageUrl.id);
      events.fields.add(new Field({ name: 'imageUrl', type: 'text', required: false, max: 255 }));
    }

    app.save(events);

    // Backfill registeredCount from event_registrations
    const allEvents = app.findRecordsByFilter('events', '', '', 500, 0);
    for (const event of allEvents) {
      const regs = app.findRecordsByFilter(
        'event_registrations',
        `event = "${event.id}"`,
        '',
        500,
        0,
      );
      event.set('registeredCount', regs.length);
      const ids = [];
      for (const reg of regs) {
        const user = reg.get('user');
        const id =
          typeof user === 'string'
            ? user
            : user && typeof user === 'object' && 'id' in user
              ? String(user.id)
              : '';
        if (id) ids.push(id);
      }
      event.set('registeredUserIds', ids);
      app.save(event);
    }

    const files = app.findCollectionByNameOrId('kvartira_files');
    const purposeField = files.fields.getByName('purpose');
    if (purposeField) {
      purposeField.values = PURPOSE_VALUES;
    }
    files.listRule = FILE_ACCESS;
    files.viewRule = FILE_ACCESS;
    app.save(files);
  },
  (app) => {
    const events = app.findCollectionByNameOrId('events');
    const countField = events.fields.getByName('registeredCount');
    if (countField) events.fields.removeById(countField.id);

    const imageUrl = events.fields.getByName('imageUrl');
    if (imageUrl && imageUrl.type === 'text') {
      events.fields.removeById(imageUrl.id);
      events.fields.add(new Field({ name: 'imageUrl', type: 'url', required: false }));
    }
    app.save(events);

    const files = app.findCollectionByNameOrId('kvartira_files');
    const purposeField = files.fields.getByName('purpose');
    if (purposeField) {
      purposeField.values = ['chat', 'assignment', 'support', 'avatar', 'school'];
    }
    app.save(files);
  },
);
