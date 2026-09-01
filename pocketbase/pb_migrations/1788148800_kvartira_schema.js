/// <reference path="../pb_data/types.d.ts" />

/**
 * ROADMAP 1.2 — initial PocketBase collections for «Квартира».
 * API rules: locked (null) until RBAC migration 1.4.
 * Maps to src/types/index.ts and mocks/seed.ts.
 */

/** @param {string} name */
function dropIfExists(app, name) {
  try {
    app.delete(app.findCollectionByNameOrId(name));
  } catch (_) {
    /* not created yet */
  }
}

/** @param {string} collectionId @param {object} [opts] */
function rel(name, collectionId, opts = {}) {
  return {
    name,
    type: 'relation',
    required: opts.required ?? false,
    collectionId,
    maxSelect: opts.maxSelect ?? 1,
    cascadeDelete: opts.cascadeDelete ?? false,
  };
}

/** @param {string} name @param {Array<object>} fields @param {string[]} [indexes] */
function base(name, fields, indexes = []) {
  return new Collection({
    name,
    type: 'base',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields,
    indexes,
  });
}

migrate(
  (app) => {
    // ── Extend auth users (phone login — hooks in 1.3) ─────────────────
    const users = app.findCollectionByNameOrId('users');
    const userFields = [
      { name: 'phone', type: 'text', required: true, min: 10, max: 20 },
      {
        name: 'role',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['student', 'teacher', 'admin'],
      },
      { name: 'firstName', type: 'text', required: true, min: 1, max: 80 },
      { name: 'lastName', type: 'text', required: true, min: 1, max: 80 },
      { name: 'avatarUrl', type: 'url', required: false },
      { name: 'avatarOriginalUrl', type: 'url', required: false },
      { name: 'bio', type: 'text', required: false, max: 2000 },
    ];
    for (const def of userFields) {
      if (!users.fields.getByName(def.name)) {
        users.fields.add(new Field(def));
      }
    }
    users.indexes.push('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users (phone)');
    app.save(users);

    const usersId = users.id;

    // ── Core ───────────────────────────────────────────────────────────
    app.save(
      base('directions', [
        { name: 'name', type: 'text', required: true, max: 120 },
        { name: 'description', type: 'text', max: 2000 },
        { name: 'icon', type: 'text', max: 16 },
      ]),
    );

    const directionsId = app.findCollectionByNameOrId('directions').id;

    app.save(
      base(
        'teacher_availability',
        [
          rel('teacher', usersId, { required: true, cascadeDelete: true }),
          { name: 'slotIntervalMinutes', type: 'number', required: true, min: 15, max: 60 },
          {
            name: 'defaultLessonDurationMinutes',
            type: 'number',
            required: true,
            min: 15,
            max: 180,
          },
          { name: 'schedule', type: 'json', required: true },
          { name: 'exceptions', type: 'json' },
        ],
        ['CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_teacher ON teacher_availability (teacher)'],
      ),
    );

    app.save(
      base(
        'lessons',
        [
          rel('student', usersId, { required: true }),
          rel('teacher', usersId, { required: true }),
          rel('direction', directionsId, { required: true }),
          { name: 'date', type: 'date', required: true },
          { name: 'startTime', type: 'text', required: true, max: 5 },
          { name: 'durationMinutes', type: 'number', required: true, min: 15, max: 240 },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'scheduled',
              'confirmed',
              'completed',
              'cancelled',
              'rescheduled',
              'pending',
              'no_show',
            ],
          },
          { name: 'location', type: 'text', max: 200 },
          { name: 'materials', type: 'json' },
          { name: 'teacherNotes', type: 'text', max: 5000 },
          { name: 'cancelReason', type: 'text', max: 500 },
        ],
        [
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_teacher_slot ON lessons (teacher, date, startTime)',
        ],
      ),
    );

    const lessonsId = app.findCollectionByNameOrId('lessons').id;

    app.save(
      base('lesson_history', [
        rel('lesson', lessonsId, { required: true, cascadeDelete: true }),
        {
          name: 'action',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['created', 'rescheduled', 'cancelled', 'confirmed'],
        },
        { name: 'previousDate', type: 'date' },
        { name: 'previousStartTime', type: 'text', max: 5 },
        { name: 'newDate', type: 'date' },
        { name: 'newStartTime', type: 'text', max: 5 },
        { name: 'reason', type: 'text', max: 500 },
        rel('user', usersId, { required: true }),
      ]),
    );

    // ── Chat ───────────────────────────────────────────────────────────
    app.save(
      base('conversations', [
        {
          name: 'type',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['personal', 'group', 'study', 'organizational', 'system'],
        },
        { name: 'title', type: 'text', required: true, max: 200 },
        { name: 'avatarUrl', type: 'url' },
        { name: 'participantIds', type: 'json', required: true },
        { name: 'lastMessageAt', type: 'date' },
        { name: 'lastMessage', type: 'json' },
        { name: 'metadata', type: 'json' },
        { name: 'pinnedMessageIds', type: 'json' },
      ]),
    );

    const conversationsId = app.findCollectionByNameOrId('conversations').id;

    app.save(
      base(
        'conversation_members',
        [
          rel('conversation', conversationsId, { required: true, cascadeDelete: true }),
          rel('user', usersId, { required: true, cascadeDelete: true }),
          {
            name: 'role',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['owner', 'admin', 'member'],
          },
          { name: 'lastReadMessageId', type: 'text', max: 30 },
          { name: 'lastReadAt', type: 'date' },
          { name: 'muted', type: 'bool', required: true },
          { name: 'mutedUntil', type: 'date' },
        ],
        [
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_member ON conversation_members (conversation, user)',
        ],
      ),
    );

    app.save(
      base('messages', [
        rel('conversation', conversationsId, { required: true, cascadeDelete: true }),
        rel('sender', usersId, { required: true }),
        { name: 'text', type: 'text', required: true, max: 10000 },
        { name: 'editedAt', type: 'date' },
        { name: 'deletedAt', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['sending', 'sent', 'read', 'failed'],
        },
        { name: 'readBy', type: 'json' },
        { name: 'attachments', type: 'json' },
        { name: 'clientMutationId', type: 'text', max: 64 },
        { name: 'replyToMessageId', type: 'text', max: 30 },
        {
          name: 'messageType',
          type: 'select',
          maxSelect: 1,
          values: ['user', 'system'],
        },
        { name: 'metadata', type: 'json' },
      ]),
    );

    // ── Events ───────────────────────────────────────────────────────────
    app.save(
      base('events', [
        { name: 'title', type: 'text', required: true, max: 200 },
        { name: 'description', type: 'text', required: true, max: 10000 },
        {
          name: 'type',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['concert', 'masterclass', 'competition', 'invited'],
        },
        { name: 'date', type: 'date', required: true },
        { name: 'startTime', type: 'text', required: true, max: 5 },
        { name: 'endTime', type: 'text', max: 5 },
        { name: 'location', type: 'text', required: true, max: 300 },
        { name: 'imageUrl', type: 'url' },
        { name: 'maxParticipants', type: 'number', min: 1 },
        { name: 'registeredUserIds', type: 'json' },
        { name: 'invitedUserIds', type: 'json' },
      ]),
    );

    const eventsId = app.findCollectionByNameOrId('events').id;

    app.save(
      base(
        'event_registrations',
        [
          rel('event', eventsId, { required: true, cascadeDelete: true }),
          rel('user', usersId, { required: true, cascadeDelete: true }),
          { name: 'application', type: 'json' },
        ],
        [
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registration ON event_registrations (event, user)',
        ],
      ),
    );

    // ── Assignments ──────────────────────────────────────────────────────
    app.save(
      base('assignments', [
        { name: 'title', type: 'text', required: true, max: 200 },
        { name: 'description', type: 'text', required: true, max: 10000 },
        rel('teacher', usersId, { required: true }),
        rel('student', usersId, { required: true }),
        rel('lesson', lessonsId),
        { name: 'dueDate', type: 'date', required: true },
        {
          name: 'responseType',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['text', 'audio', 'video', 'image', 'file'],
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['assigned', 'submitted', 'reviewed'],
        },
        { name: 'materials', type: 'json' },
        { name: 'submission', type: 'json' },
        { name: 'feedback', type: 'json' },
      ]),
    );

    // ── Progress ─────────────────────────────────────────────────────────
    app.save(
      base('skills', [
        { name: 'name', type: 'text', required: true, max: 120 },
        { name: 'description', type: 'text', max: 2000 },
        rel('direction', directionsId),
        { name: 'maxLevel', type: 'number', required: true, min: 1, max: 10 },
      ]),
    );

    const skillsId = app.findCollectionByNameOrId('skills').id;

    app.save(
      base(
        'student_skill_progress',
        [
          rel('student', usersId, { required: true, cascadeDelete: true }),
          rel('skill', skillsId, { required: true, cascadeDelete: true }),
          { name: 'level', type: 'number', required: true, min: 0, max: 10 },
          { name: 'note', type: 'text', max: 1000 },
        ],
        [
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_progress ON student_skill_progress (student, skill)',
        ],
      ),
    );

    app.save(
      base('progress_goals', [
        rel('student', usersId, { required: true, cascadeDelete: true }),
        rel('teacher', usersId),
        { name: 'title', type: 'text', required: true, max: 200 },
        { name: 'description', type: 'text', max: 2000 },
        { name: 'targetDate', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['active', 'completed'],
        },
        { name: 'completedAt', type: 'date' },
      ]),
    );

    app.save(
      base('progress_history', [
        rel('student', usersId, { required: true, cascadeDelete: true }),
        {
          name: 'type',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['lesson', 'assignment', 'skill', 'goal', 'achievement', 'event'],
        },
        { name: 'title', type: 'text', required: true, max: 200 },
        { name: 'description', type: 'text', max: 2000 },
      ]),
    );

    app.save(
      base('achievement_definitions', [
        { name: 'code', type: 'text', required: true, max: 64 },
        { name: 'title', type: 'text', required: true, max: 120 },
        { name: 'description', type: 'text', required: true, max: 500 },
        { name: 'icon', type: 'text', required: true, max: 16 },
      ], ['CREATE UNIQUE INDEX IF NOT EXISTS idx_achievement_code ON achievement_definitions (code)']),
    );

    const achievementsId = app.findCollectionByNameOrId('achievement_definitions').id;

    app.save(
      base(
        'user_achievements',
        [
          rel('student', usersId, { required: true, cascadeDelete: true }),
          rel('achievement', achievementsId, { required: true, cascadeDelete: true }),
          { name: 'unlockedAt', type: 'date', required: true },
        ],
        [
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_achievement ON user_achievements (student, achievement)',
        ],
      ),
    );

    // ── Support ──────────────────────────────────────────────────────────
    app.save(
      base('help_articles', [
        { name: 'question', type: 'text', required: true, max: 300 },
        { name: 'answer', type: 'text', required: true, max: 10000 },
        {
          name: 'category',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['booking', 'assignments', 'chat', 'technical', 'other'],
        },
        { name: 'keywords', type: 'json' },
      ]),
    );

    app.save(
      base('support_tickets', [
        rel('user', usersId, { required: true, cascadeDelete: true }),
        { name: 'subject', type: 'text', required: true, max: 200 },
        { name: 'message', type: 'text', required: true, max: 10000 },
        {
          name: 'category',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['booking', 'assignments', 'chat', 'technical', 'other'],
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['open', 'answered', 'closed'],
        },
        { name: 'attachments', type: 'json' },
        { name: 'adminReply', type: 'json' },
      ]),
    );

    // ── Legal ────────────────────────────────────────────────────────────
    app.save(
      base('legal_documents', [
        {
          name: 'type',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['privacy_policy', 'personal_data', 'terms_of_service', 'school_rules'],
        },
        { name: 'title', type: 'text', required: true, max: 200 },
        { name: 'content', type: 'editor', required: true },
        { name: 'currentVersion', type: 'text', required: true, max: 20 },
        { name: 'effectiveAt', type: 'date', required: true },
        { name: 'requiresConsent', type: 'bool', required: true },
        { name: 'versionHistory', type: 'json' },
      ], ['CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_doc_type ON legal_documents (type)']),
    );

    const legalDocsId = app.findCollectionByNameOrId('legal_documents').id;

    app.save(
      base('user_consents', [
        rel('user', usersId, { required: true, cascadeDelete: true }),
        rel('document', legalDocsId, { required: true, cascadeDelete: true }),
        {
          name: 'documentType',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['privacy_policy', 'personal_data', 'terms_of_service', 'school_rules'],
        },
        { name: 'documentTitle', type: 'text', required: true, max: 200 },
        { name: 'version', type: 'text', required: true, max: 20 },
        { name: 'acceptedAt', type: 'date', required: true },
      ]),
    );

    // ── Security ─────────────────────────────────────────────────────────
    app.save(
      base('security_sessions', [
        rel('user', usersId, { required: true, cascadeDelete: true }),
        { name: 'deviceLabel', type: 'text', required: true, max: 120 },
        { name: 'platform', type: 'text', required: true, max: 80 },
        { name: 'ipAddress', type: 'text', required: true, max: 45 },
        { name: 'lastActiveAt', type: 'date', required: true },
        { name: 'isCurrent', type: 'bool', required: true },
      ]),
    );

    app.save(
      base('login_history', [
        rel('user', usersId, { required: true, cascadeDelete: true }),
        { name: 'deviceLabel', type: 'text', required: true, max: 120 },
        { name: 'ipAddress', type: 'text', required: true, max: 45 },
        { name: 'success', type: 'bool', required: true },
      ]),
    );

    app.save(
      base('security_alerts', [
        rel('user', usersId, { required: true, cascadeDelete: true }),
        {
          name: 'type',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['new_device', 'password_changed', 'failed_login', 'session_revoked'],
        },
        { name: 'title', type: 'text', required: true, max: 200 },
        { name: 'message', type: 'text', required: true, max: 1000 },
        { name: 'read', type: 'bool', required: true },
      ]),
    );

    // ── Notifications ────────────────────────────────────────────────────
    app.save(
      base('notifications', [
        rel('user', usersId, { required: true, cascadeDelete: true }),
        {
          name: 'type',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['lesson', 'reschedule', 'cancel', 'message', 'event', 'assignment', 'system'],
        },
        { name: 'title', type: 'text', required: true, max: 200 },
        { name: 'body', type: 'text', required: true, max: 2000 },
        { name: 'read', type: 'bool', required: true },
        { name: 'link', type: 'text', max: 300 },
      ]),
    );

    app.save(
      base(
        'notification_preferences',
        [
          rel('user', usersId, { required: true, cascadeDelete: true }),
          { name: 'pushEnabled', type: 'bool', required: true },
          { name: 'categories', type: 'json' },
          { name: 'channels', type: 'json' },
        ],
        ['CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences (user)'],
      ),
    );

    // ── Public / school ──────────────────────────────────────────────────
    app.save(
      base('school_settings', [
        { name: 'name', type: 'text', required: true, max: 200 },
        { name: 'tagline', type: 'text', max: 300 },
        { name: 'about', type: 'text', max: 10000 },
        { name: 'contacts', type: 'json', required: true },
      ]),
    );

    app.save(
      base('public_news', [
        { name: 'title', type: 'text', required: true, max: 200 },
        { name: 'excerpt', type: 'text', required: true, max: 500 },
        { name: 'publishedAt', type: 'date', required: true },
      ]),
    );

    // ── Audit ────────────────────────────────────────────────────────────
    app.save(
      base('audit_logs', [
        rel('actor', usersId),
        { name: 'action', type: 'text', required: true, max: 120 },
        { name: 'entityType', type: 'text', required: true, max: 80 },
        { name: 'entityId', type: 'text', required: true, max: 30 },
        { name: 'metadata', type: 'json' },
      ]),
    );
  },
  (app) => {
    const customCollections = [
      'audit_logs',
      'public_news',
      'school_settings',
      'notification_preferences',
      'notifications',
      'security_alerts',
      'login_history',
      'security_sessions',
      'user_consents',
      'legal_documents',
      'support_tickets',
      'help_articles',
      'user_achievements',
      'achievement_definitions',
      'progress_history',
      'progress_goals',
      'student_skill_progress',
      'skills',
      'assignments',
      'event_registrations',
      'events',
      'messages',
      'conversation_members',
      'conversations',
      'lesson_history',
      'lessons',
      'teacher_availability',
      'directions',
    ];
    for (const name of customCollections) {
      dropIfExists(app, name);
    }

    const users = app.findCollectionByNameOrId('users');
    for (const name of [
      'phone',
      'role',
      'firstName',
      'lastName',
      'avatarUrl',
      'avatarOriginalUrl',
      'bio',
    ]) {
      const field = users.fields.getByName(name);
      if (field) users.fields.remove(field.id);
    }
    app.save(users);
  },
);
