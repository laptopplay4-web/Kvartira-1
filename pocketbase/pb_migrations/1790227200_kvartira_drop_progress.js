/// <reference path="../pb_data/types.d.ts" />

/**
 * Drop the Progress & Achievements module.
 *
 * The feature was hidden behind a flag and is now removed from the app. Its
 * collections also carried an IDOR hole: `user_achievements` and
 * `progress_history` allowed a student to create own rows, i.e. hand
 * themselves achievements.
 *
 * Historical migrations are left untouched — this one drops the collections in
 * dependency order (children before parents) so already-deployed databases stay
 * consistent. Down migration is intentionally a no-op: the data is gone.
 */

// Child collections first — relations point at `skills` / `achievement_definitions`.
const COLLECTIONS = [
  'student_skill_progress',
  'progress_goals',
  'progress_history',
  'user_achievements',
  'achievement_definitions',
  'skills',
];

migrate(
  (app) => {
    for (const name of COLLECTIONS) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {
        // Already absent (fresh install or partial previous run).
      }
    }
  },
  (_app) => {
    // Irreversible: progress data is not restorable from the schema alone.
  },
);
