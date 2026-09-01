/// <reference path="../pb_data/types.d.ts" />

/**
 * ROADMAP 2.2 — fields for lessons/availability adapter:
 * - users.directionIds (teacher ↔ direction booking filter)
 * - teacher_availability.planningPeriod (availability calendar period)
 * - lesson_history list/view for lesson participants
 */

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    if (!users.fields.getByName('directionIds')) {
      users.fields.add(new Field({ name: 'directionIds', type: 'json' }));
    }
    app.save(users);

    const availability = app.findCollectionByNameOrId('teacher_availability');
    if (!availability.fields.getByName('planningPeriod')) {
      availability.fields.add(new Field({ name: 'planningPeriod', type: 'json' }));
    }
    app.save(availability);

    const lessonHistory = app.findCollectionByNameOrId('lesson_history');
    const lessonHistoryAccess =
      '@request.auth.role = "admin" || (@collection.lessons.id ?= lesson && (@collection.lessons.student ?= @request.auth.id || @collection.lessons.teacher ?= @request.auth.id))';
    lessonHistory.listRule = lessonHistoryAccess;
    lessonHistory.viewRule = lessonHistoryAccess;
    app.save(lessonHistory);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const directionIdsField = users.fields.getByName('directionIds');
    if (directionIdsField) {
      users.fields.removeById(directionIdsField.id);
    }
    app.save(users);

    const availability = app.findCollectionByNameOrId('teacher_availability');
    const planningField = availability.fields.getByName('planningPeriod');
    if (planningField) {
      availability.fields.removeById(planningField.id);
    }
    app.save(availability);

    const lessonHistory = app.findCollectionByNameOrId('lesson_history');
    lessonHistory.listRule = '@request.auth.role = "admin" || user = @request.auth.id';
    lessonHistory.viewRule = '@request.auth.role = "admin" || user = @request.auth.id';
    app.save(lessonHistory);
  },
);
