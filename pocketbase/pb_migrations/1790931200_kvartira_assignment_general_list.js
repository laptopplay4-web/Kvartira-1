/// <reference path="../pb_data/types.d.ts" />

/**
 * School-wide ДЗ («Все ученики»): list/view via group.kind / group.name;
 * assignment_groups readable by name for labels.
 */
migrate(
  (app) => {
    const access =
      '@request.auth.role = "admin" || teacher = @request.auth.id || group.kind = "general" || group.name = "Все ученики" || (@collection.assignment_groups.id ?= group && (@collection.assignment_groups.kind = "general" || @collection.assignment_groups.members.id ?= @request.auth.id))';
    const assignments = app.findCollectionByNameOrId('assignments');
    assignments.listRule = access;
    assignments.viewRule = access;
    app.save(assignments);

    const groups = app.findCollectionByNameOrId('assignment_groups');
    groups.listRule =
      '@request.auth.role = "admin" || teacher = @request.auth.id || kind = "general" || name = "Все ученики" || members.id ?= @request.auth.id';
    groups.viewRule = groups.listRule;
    app.save(groups);
  },
  (app) => {
    const access =
      '@request.auth.role = "admin" || teacher = @request.auth.id || (@collection.assignment_groups.id ?= group && (@collection.assignment_groups.kind = "general" || @collection.assignment_groups.members.id ?= @request.auth.id))';
    const assignments = app.findCollectionByNameOrId('assignments');
    assignments.listRule = access;
    assignments.viewRule = access;
    app.save(assignments);

    const groups = app.findCollectionByNameOrId('assignment_groups');
    groups.listRule =
      '@request.auth.role = "admin" || teacher = @request.auth.id || kind = "general" || members.id ?= @request.auth.id';
    groups.viewRule = groups.listRule;
    app.save(groups);
  },
);
