/// <reference path="../pb_data/types.d.ts" />

/**
 * Narrow `users` list/view.
 *
 * Before: `@request.auth.id != ""` — any authenticated account could dump the
 * whole school directory in one request.
 *
 * After: own record, teachers (public landing + booking), staff seeing the
 * student roster, and students seeing only people they share an assignment
 * group or a conversation with. The last two clauses reuse one
 * `@collection.x` alias so both conditions must match within the same joined
 * row — a real join, not two independent existence checks.
 *
 * Keep in sync with `pb_hooks/lib/kvartiraRbac.js` (USER_DIRECTORY_ACCESS).
 */

const USER_DIRECTORY_ACCESS = [
  '@request.auth.role = "admin"',
  'id = @request.auth.id',
  'role = "teacher"',
  '(@request.auth.role = "teacher" && role = "student")',
  '(@collection.assignment_groups.members ?= @request.auth.id && @collection.assignment_groups.members ?= id)',
  '(@collection.conversations.participantIds ?~ @request.auth.id && @collection.conversations.participantIds ?~ id)',
].join(' || ');

const PREVIOUS = '@request.auth.id != "" || role = "teacher"';

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.listRule = USER_DIRECTORY_ACCESS;
    users.viewRule = USER_DIRECTORY_ACCESS;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.listRule = PREVIOUS;
    users.viewRule = PREVIOUS;
    app.save(users);
  },
);
