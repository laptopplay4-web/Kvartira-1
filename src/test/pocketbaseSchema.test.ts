import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const MIGRATION = resolve(ROOT, 'pocketbase/pb_migrations/1788148800_kvartira_schema.js');
const USER_CASCADE_MIGRATION = resolve(
  ROOT,
  'pocketbase/pb_migrations/1789363200_kvartira_user_cascade_delete.js',
);
const USER_CASCADE_FIX_MIGRATION = resolve(
  ROOT,
  'pocketbase/pb_migrations/1789449600_kvartira_user_cascade_delete_fix.js',
);
const AVATAR_TEXT_MIGRATION = resolve(
  ROOT,
  'pocketbase/pb_migrations/1789536000_kvartira_avatar_text_fields.js',
);
const AVATAR_TEXT_MAX_MIGRATION = resolve(
  ROOT,
  'pocketbase/pb_migrations/1789622400_kvartira_avatar_text_max.js',
);
const USERS_HOOK = resolve(ROOT, 'pocketbase/pb_hooks/users.pb.js');
const USERS_LIB = resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraUsers.js');
const SCHEMA_DOC = resolve(ROOT, 'pocketbase/SCHEMA.md');

/** ROADMAP 1.2 required collection names */
const REQUIRED_COLLECTIONS = [
  'users',
  'directions',
  'teacher_availability',
  'lessons',
  'lesson_history',
  'conversations',
  'conversation_members',
  'messages',
  'events',
  'event_registrations',
  'assignments',
  'skills',
  'student_skill_progress',
  'progress_goals',
  'progress_history',
  'achievement_definitions',
  'user_achievements',
  'help_articles',
  'support_tickets',
  'legal_documents',
  'user_consents',
  'security_sessions',
  'login_history',
  'security_alerts',
  'notifications',
  'notification_preferences',
  'audit_logs',
] as const;

describe('PocketBase schema (ROADMAP 1.2)', () => {
  it('migration file exists and defines all required collections', () => {
    const source = readFileSync(MIGRATION, 'utf8');
    for (const name of REQUIRED_COLLECTIONS) {
      if (name === 'users') {
        expect(source).toContain("findCollectionByNameOrId('users')");
      } else {
        expect(source).toContain(`'${name}'`);
      }
    }
  });

  it('documents double-booking unique index on lessons', () => {
    const source = readFileSync(MIGRATION, 'utf8');
    expect(source).toContain('idx_lessons_teacher_slot');
  });

  it('SCHEMA.md lists roadmap collections', () => {
    const doc = readFileSync(SCHEMA_DOC, 'utf8');
    for (const name of REQUIRED_COLLECTIONS) {
      expect(doc).toContain(`\`${name}\``);
    }
  });

  it('user cascade migration enables cascadeDelete on blocking user relations', () => {
    const source = readFileSync(USER_CASCADE_MIGRATION, 'utf8');
    expect(source).toContain("enableCascadeDelete(lessons, ['student', 'teacher'])");
    expect(source).toContain("enableCascadeDelete(lessonHistory, ['user'])");
    expect(source).toContain("enableCascadeDelete(messages, ['sender'])");
    expect(source).toContain("enableCascadeDelete(assignments, ['teacher', 'group'])");
    expect(source).toContain("enableCascadeDelete(groups, ['teacher'])");
  });

  it('users delete hook clears optional references before record removal', () => {
    const hook = readFileSync(USERS_HOOK, 'utf8');
    const lib = readFileSync(USERS_LIB, 'utf8');
    expect(hook).toContain('onRecordDeleteRequest');
    expect(hook).toContain('cleanupUserReferences');
    expect(lib).toContain('purgeUserDependents');
    expect(lib).toContain('deleteAllByFilter');
    expect(lib).toContain('lessons');
    expect(lib).toContain("clearOptionalRelation(app, 'messages', 'sender'");
    expect(lib).toContain('assignment_groups');
    expect(lib).toContain('audit_logs');
    expect(lib).toContain('participantIds');
  });

  it('message sender keep-history migration makes sender optional without cascade', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1790572800_kvartira_message_sender_keep_history.js'),
      'utf8',
    );
    expect(source).toContain("findCollectionByNameOrId('messages')");
    expect(source).toContain("getByName('sender')");
    expect(source).toContain('required = false');
    expect(source).toContain('cascadeDelete = false');
  });

  it('security session fingerprint migration adds tokenFingerprint field', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1790668800_kvartira_security_session_fingerprint.js'),
      'utf8',
    );
    const doc = readFileSync(SCHEMA_DOC, 'utf8');
    expect(source).toContain("findCollectionByNameOrId('security_sessions')");
    expect(source).toContain('tokenFingerprint');
    expect(doc).toContain('tokenFingerprint');
  });

  it('users enrich hook compares auth.id (not getString id) for own phone', () => {
    const hook = readFileSync(USERS_HOOK, 'utf8');
    expect(hook).toContain('onRecordEnrich');
    expect(hook).toContain('auth.id');
    // goja: hide.apply throws → "Failed to enrich record"; use variadic hide.
    expect(hook).toContain("hide('phone', 'email', 'avatarOriginalUrl')");
    expect(hook).not.toMatch(/hide\.apply\s*\(/);
    expect(hook).not.toContain("getString('id')");
  });

  it('drop progress migration removes all six progress collections', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1790227200_kvartira_drop_progress.js'),
      'utf8',
    );
    for (const name of [
      'skills',
      'student_skill_progress',
      'progress_goals',
      'progress_history',
      'achievement_definitions',
      'user_achievements',
    ]) {
      expect(source).toContain(`'${name}'`);
    }
    expect(source).toContain('app.delete(');
  });

  it('users update hook locks role to admin student↔teacher switch', () => {
    const hook = readFileSync(USERS_HOOK, 'utf8');
    const lib = readFileSync(USERS_LIB, 'utf8');
    expect(hook).toContain('onRecordUpdateRequest');
    expect(hook).toContain('assertUserUpdate');
    expect(lib).toContain('assertUserUpdate');
    expect(lib).toContain('Нельзя изменить роль');
    expect(lib).toContain('Нельзя изменить номер телефона');
    expect(lib).toContain('Можно менять только роли ученика и преподавателя');
  });

  it('user cascade fix migration re-applies cascadeDelete without type guard', () => {
    const source = readFileSync(USER_CASCADE_FIX_MIGRATION, 'utf8');
    expect(source).not.toContain("field.type === 'relation'");
    expect(source).toContain("enableCascadeDelete(assignments, ['teacher', 'group'])");
  });

  it('avatar fields migration changes url type to text for data URLs', () => {
    const source = readFileSync(AVATAR_TEXT_MIGRATION, 'utf8');
    expect(source).toContain("type: 'text'");
    expect(source).toContain('max: 255');
    expect(source).toContain('avatarUrl');
    expect(source).toContain('avatarOriginalUrl');
  });

  it('avatar text max migration sets explicit max (PB max:0 = 5000 default)', () => {
    const source = readFileSync(AVATAR_TEXT_MAX_MIGRATION, 'utf8');
    expect(source).toContain('field.max = 255');
    expect(source).toContain('avatarUrl');
    expect(source).toContain('avatarOriginalUrl');
  });

  it('avatar files migration adds kvmartira_files purpose and short text refs', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1789708800_kvartira_avatar_files.js'),
      'utf8',
    );
    expect(source).toContain("'avatar'");
    expect(source).toContain('kvartira_files');
    expect(source).toContain('AVATAR_REF_MAX');
  });

  it('conversation avatar migration stores text pbfile refs instead of url', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1790140800_kvartira_conversation_avatar_text.js'),
      'utf8',
    );
    expect(source).toContain('conversations');
    expect(source).toContain('avatarUrl');
    expect(source).toContain("type: 'text'");
    expect(source).toContain('AVATAR_REF_MAX');
  });

  it('message hiddenForUserIds migration for delete-for-me', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1792100000_kvartira_message_hidden_for.js'),
      'utf8',
    );
    expect(source).toContain('messages');
    expect(source).toContain('hiddenForUserIds');
    expect(source).toContain("type: 'json'");
  });

  it('legal optional consents soft-remove migration', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1792200000_kvartira_legal_optional_remove.js'),
      'utf8',
    );
    expect(source).toContain('communication');
    expect(source).toContain('publication');
    expect(source).toContain('requiresConsent');
  });

  it('support ticket reportContext migration', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1792300000_kvartira_support_report_context.js'),
      'utf8',
    );
    expect(source).toContain('support_tickets');
    expect(source).toContain('reportContext');
    expect(source).toContain("type: 'json'");
  });

  it('legal docs bootstrap migration relaxes bools and seeds missing docs', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1792400000_kvartira_legal_docs_bootstrap.js'),
      'utf8',
    );
    expect(source).toContain('legal_documents');
    expect(source).toContain('requiresConsent');
    expect(source).toContain('bootstrapMissingLegalDocuments');
    expect(source).toContain('privacy_policy');
    expect(source).toContain('terms_of_service');
  });

  it('accountStatus migration adds pending|active and admin delete rule', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1792500000_kvartira_account_status.js'),
      'utf8',
    );
    expect(source).toContain('accountStatus');
    expect(source).toContain("'pending'");
    expect(source).toContain("'active'");
    expect(source).toContain('role != "admin"');
  });

  it('avatar purpose select fix migration sets full purpose values list', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1789795200_kvartira_avatar_purpose_select.js'),
      'utf8',
    );
    expect(source).toContain("'avatar'");
    expect(source).toContain('PURPOSE_VALUES');
  });

  it('school social + directions video migration adds json fields and school purpose', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1789968000_kvartira_school_social_video.js'),
      'utf8',
    );
    expect(source).toContain('socialLinks');
    expect(source).toContain('directionsVideo');
    expect(source).toContain("'school'");
    expect(source).toContain('purpose = "school"');
  });

  it('notification urgent migration adds bool field', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1790054400_kvartira_notification_urgent.js'),
      'utf8',
    );
    expect(source).toContain('urgent');
    expect(source).toContain('notifications');
  });

  it('users directionIds json migration ensures json field', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1790755200_kvartira_users_direction_ids_json.js'),
      'utf8',
    );
    expect(source).toContain('directionIds');
    expect(source).toContain("type: 'json'");
  });

  it('assignment staff write migration allows any teacher|admin update/delete', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1790844800_kvartira_assignment_staff_write.js'),
      'utf8',
    );
    expect(source).toContain('assignments');
    expect(source).toContain('updateRule');
    expect(source).toContain('deleteRule');
    expect(source).toContain('@request.auth.role = "teacher"');
  });

  it('assignment general list migration exposes school-wide assignments to students', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1790931200_kvartira_assignment_general_list.js'),
      'utf8',
    );
    expect(source).toContain('group.kind = "general"');
    expect(source).toContain('group.name = "Все ученики"');
    expect(source).toContain('assignment_groups');
  });

  it('events registeredCount + image text + event file purpose migration', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1791017600_kvartira_events_count_image.js'),
      'utf8',
    );
    expect(source).toContain('registeredCount');
    expect(source).toContain("type: 'text'");
    expect(source).toContain("'event'");
    expect(source).toContain('purpose = "event"');
  });

  it('event registrations staff list + student-only create migration', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1791104000_kvartira_event_reg_staff_list.js'),
      'utf8',
    );
    expect(source).toContain('event_registrations');
    expect(source).toContain('@request.auth.role = "teacher"');
    expect(source).toContain('@request.auth.role = "student"');
  });

  it('event delete cascade migration enables cascadeDelete on registrations', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1791190400_kvartira_event_delete_cascade.js'),
      'utf8',
    );
    expect(source).toContain('event_registrations');
    expect(source).toContain('cascadeDelete = true');
    expect(source).toContain('@request.auth.role = "teacher"');
  });

  it('pushEnabled bool migration relaxes required on notification_preferences', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1791276800_kvartira_push_enabled_bool.js'),
      'utf8',
    );
    expect(source).toContain('notification_preferences');
    expect(source).toContain('pushEnabled');
    expect(source).toContain('field.required = false');
  });

  it('assignment files school-wide access matches group name «Все ученики»', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1791363200_kvartira_assignment_files_schoolwide.js'),
      'utf8',
    );
    expect(source).toContain('kvartira_files');
    expect(source).toContain('Все ученики');
    expect(source).toContain('purpose = "assignment"');
  });

  it('assignment files access uses nested assignments.group (not broken double join)', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1791450000_kvartira_assignment_files_group_nested.js'),
      'utf8',
    );
    const rbac = readFileSync(
      resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraRbac.js'),
      'utf8',
    );
    expect(source).toContain('@collection.assignments.group.kind = "general"');
    expect(source).toContain('@collection.assignments.group.name = "Все ученики"');
    expect(source).toContain('@collection.assignments.group.members.id ?= @request.auth.id');
    expect(rbac).toContain('@collection.assignments.group.kind = "general"');
    expect(rbac).not.toMatch(
      /FILE_ACCESS[\s\S]*@collection\.assignment_groups\.id \?= @collection\.assignments\.group/,
    );
  });
});
