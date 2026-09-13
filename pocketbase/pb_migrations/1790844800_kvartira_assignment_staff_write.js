/// <reference path="../pb_data/types.d.ts" />

/**
 * Assignments: any teacher|admin may update/delete (not only author).
 * Students must not write (updateRule was ASSIGNMENT_ACCESS).
 */
migrate(
  (app) => {
    const assignments = app.findCollectionByNameOrId('assignments');
    assignments.updateRule =
      '@request.auth.role = "admin" || @request.auth.role = "teacher"';
    assignments.deleteRule =
      '@request.auth.role = "admin" || @request.auth.role = "teacher"';
    app.save(assignments);
  },
  (app) => {
    const assignments = app.findCollectionByNameOrId('assignments');
    assignments.updateRule =
      '@request.auth.role = "admin" || teacher = @request.auth.id || (@collection.assignment_groups.id ?= group && (@collection.assignment_groups.kind = "general" || @collection.assignment_groups.members.id ?= @request.auth.id))';
    assignments.deleteRule =
      '@request.auth.role = "admin" || (@request.auth.role = "teacher" && teacher = @request.auth.id)';
    app.save(assignments);
  },
);
