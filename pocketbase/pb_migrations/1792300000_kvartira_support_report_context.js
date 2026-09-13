/// <reference path="../pb_data/types.d.ts" />

/**
 * Optional JSON context for chat message reports («Пожаловаться»).
 */

migrate(
  (app) => {
    const tickets = app.findCollectionByNameOrId('support_tickets');
    if (!tickets.fields.getByName('reportContext')) {
      tickets.fields.add(new Field({ name: 'reportContext', type: 'json', required: false }));
    }
    app.save(tickets);
  },
  (app) => {
    const tickets = app.findCollectionByNameOrId('support_tickets');
    const field = tickets.fields.getByName('reportContext');
    if (!field) return;
    tickets.fields.removeById(field.id);
    app.save(tickets);
  },
);
