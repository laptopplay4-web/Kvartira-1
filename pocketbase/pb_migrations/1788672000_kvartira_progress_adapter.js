/// <reference path="../pb_data/types.d.ts" />

/**
 * ROADMAP 2.6 — progress adapter RBAC:
 * student may create own user_achievements and progress_history
 * (auto-unlock on progress read). Teacher/admin unchanged.
 */

migrate(
  (app) => {
    const achievements = app.findCollectionByNameOrId('user_achievements');
    achievements.createRule =
      '@request.auth.role = "admin" || @request.auth.role = "teacher" || (@request.auth.id != "" && student = @request.auth.id)';
    app.save(achievements);

    const history = app.findCollectionByNameOrId('progress_history');
    history.createRule =
      '@request.auth.role = "admin" || @request.auth.role = "teacher" || (@request.auth.id != "" && student = @request.auth.id)';
    app.save(history);
  },
  (app) => {
    const achievements = app.findCollectionByNameOrId('user_achievements');
    achievements.createRule =
      '@request.auth.role = "admin" || @request.auth.role = "teacher"';
    app.save(achievements);

    const history = app.findCollectionByNameOrId('progress_history');
    history.createRule =
      '@request.auth.role = "admin" || @request.auth.role = "teacher"';
    app.save(history);
  },
);
