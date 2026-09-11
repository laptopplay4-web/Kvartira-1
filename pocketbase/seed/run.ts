/**
 * Port mocks/seed.ts → PocketBase collections.
 * ROADMAP 1.5
 */

import {
  conversationMembers,
  conversations,
  DEMO_ACCOUNTS,
  directions,
  events,
  helpArticles,
  initialAssignments,
  initialAssignmentGroups,
  initialHistory,
  initialLegalDocuments,
  initialLessons,
  initialLoginHistory,
  initialSecurityAlerts,
  initialSecuritySessions,
  initialSupportTickets,
  initialUserConsents,
  messages,
  notifications,
  publicNews,
  publicSchoolInfo,
  studentDirections,
  teacherAvailabilities,
  teacherDirections,
  users,
} from '../../src/mocks/seed';
import { createDefaultNotificationPreferences } from '../../src/services/notifications/helpers';
import type { PbClient } from './pbClient';
import {
  IdMap,
  passwordForPhone,
  phoneToEmail,
  remapLink,
  remapMetadata,
  patchRecordTimestamps,
} from './helpers';

export interface SeedOptions {
  force?: boolean;
}

export interface SeedResult {
  skipped: boolean;
  counts: Record<string, number>;
}

export async function runSeed(client: PbClient, options: SeedOptions = {}): Promise<SeedResult> {
  const counts: Record<string, number> = {};
  const ids = new IdMap();

  const existingDemo = await client.countRecords(
    'users',
    `phone = "${DEMO_ACCOUNTS.student.phone}"`,
  );
  if (existingDemo > 0 && !options.force) {
    return { skipped: true, counts };
  }

  // ── Directions ───────────────────────────────────────────────────────
  for (const dir of directions) {
    const rec = await client.createRecord('directions', {
      name: dir.name,
      description: dir.description,
      icon: dir.icon,
    });
    ids.set(dir.id, rec.id);
  }
  counts.directions = directions.length;

  // ── Users ──────────────────────────────────────────────────────────────
  for (const user of users) {
    const password = passwordForPhone(user.phone);
    const seedDirectionIds =
      user.role === 'teacher'
        ? ids.remapIds(teacherDirections[user.id] ?? [])
        : ids.remapIds(studentDirections[user.id] ?? []);
    const rec = await client.createRecord('users', {
      email: phoneToEmail(user.phone),
      password,
      passwordConfirm: password,
      phone: user.phone,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
      ...(user.avatarOriginalUrl ? { avatarOriginalUrl: user.avatarOriginalUrl } : {}),
      ...(user.bio ? { bio: user.bio } : {}),
      directionIds: seedDirectionIds,
      emailVisibility: false,
    });
    ids.set(user.id, rec.id);
  }
  counts.users = users.length;

  // ── Teacher availability ───────────────────────────────────────────────
  for (const avail of teacherAvailabilities) {
    await client.createRecord('teacher_availability', {
      teacher: ids.get(avail.teacherId),
      slotIntervalMinutes: avail.slotIntervalMinutes,
      defaultLessonDurationMinutes: avail.defaultLessonDurationMinutes,
      schedule: avail.schedule,
      exceptions: avail.exceptions ?? [],
      planningPeriod: avail.planningPeriod ?? null,
    });
  }
  counts.teacher_availability = teacherAvailabilities.length;

  // ── Lessons ──────────────────────────────────────────────────────────
  for (const lesson of initialLessons) {
    const rec = await client.createRecord('lessons', {
      student: ids.get(lesson.studentId),
      teacher: ids.get(lesson.teacherId),
      direction: ids.get(lesson.directionId),
      date: lesson.date,
      startTime: lesson.startTime,
      durationMinutes: lesson.durationMinutes,
      status: lesson.status,
      location: lesson.location ?? '',
      materials: lesson.materials ?? [],
      teacherNotes: lesson.teacherNotes ?? '',
      cancelReason: lesson.cancelReason ?? '',
    });
    await patchRecordTimestamps(client, 'lessons', rec.id, lesson.createdAt, lesson.updatedAt);
    ids.set(lesson.id, rec.id);
  }
  counts.lessons = initialLessons.length;

  // ── Lesson history ─────────────────────────────────────────────────────
  for (const entry of initialHistory) {
    const rec = await client.createRecord('lesson_history', {
      lesson: ids.get(entry.lessonId),
      action: entry.action,
      previousDate: entry.previousDate ?? '',
      previousStartTime: entry.previousStartTime ?? '',
      newDate: entry.newDate ?? '',
      newStartTime: entry.newStartTime ?? '',
      reason: entry.reason ?? '',
      user: ids.get(entry.userId),
    });
    await patchRecordTimestamps(client, 'lesson_history', rec.id, entry.createdAt);
  }
  counts.lesson_history = initialHistory.length;

  // ── Conversations (lastMessage patched after messages) ───────────────────
  for (const conv of conversations) {
    const rec = await client.createRecord('conversations', {
      type: conv.type,
      title: conv.title,
      ...(conv.avatarUrl ? { avatarUrl: conv.avatarUrl } : {}),
      participantIds: ids.remapIds(conv.participantIds),
      ...(conv.lastMessageAt ? { lastMessageAt: conv.lastMessageAt } : {}),
      metadata: remapMetadata(conv.metadata, ids) ?? {},
      pinnedMessageIds: conv.pinnedMessageIds ?? [],
    });
    await patchRecordTimestamps(client, 'conversations', rec.id, conv.createdAt, conv.updatedAt);
    ids.set(conv.id, rec.id);
  }
  counts.conversations = conversations.length;

  // ── Messages ───────────────────────────────────────────────────────────
  for (const msg of messages) {
    const rec = await client.createRecord('messages', {
      conversation: ids.get(msg.conversationId),
      sender: ids.get(msg.senderId),
      text: msg.text,
      ...(msg.editedAt ? { editedAt: msg.editedAt } : {}),
      ...(msg.deletedAt ? { deletedAt: msg.deletedAt } : {}),
      status: msg.status,
      readBy: ids.remapIds(msg.readBy ?? []),
      attachments: msg.attachments ?? [],
      ...(msg.clientMutationId ? { clientMutationId: msg.clientMutationId } : {}),
      ...(msg.replyToMessageId ? { replyToMessageId: msg.replyToMessageId } : {}),
      messageType: msg.messageType ?? 'user',
      metadata: msg.metadata ?? {},
    });
    await client.updateRecord('messages', rec.id, {
      created: msg.createdAt,
      updated: msg.updatedAt ?? msg.createdAt,
    });
    ids.set(msg.id, rec.id);
  }
  counts.messages = messages.length;

  // Patch conversations lastMessage + members read pointers
  for (const conv of conversations) {
    if (!conv.lastMessage) continue;
    const pbConvId = ids.get(conv.id);
    const lm = conv.lastMessage;
    const senderPb = ids.tryGet(lm.senderId);
    await client.updateRecord('conversations', pbConvId, {
      lastMessage: {
        id: ids.tryGet(lm.id) ?? lm.id,
        text: lm.text,
        senderId: senderPb ?? lm.senderId,
        createdAt: lm.createdAt,
      },
    });
  }

  for (const member of conversationMembers) {
    const convPb = ids.get(member.conversationId);
    const userPb = ids.get(member.userId);
    const rec = await client.createRecord('conversation_members', {
      conversation: convPb,
      user: userPb,
      role: member.role,
      ...(member.lastReadMessageId
        ? { lastReadMessageId: ids.tryGet(member.lastReadMessageId) ?? member.lastReadMessageId }
        : {}),
      ...(member.lastReadAt ? { lastReadAt: member.lastReadAt } : {}),
      muted: member.muted ?? false,
      ...(member.mutedUntil ? { mutedUntil: member.mutedUntil } : {}),
    });
    await patchRecordTimestamps(client, 'conversation_members', rec.id, member.joinedAt);
  }
  counts.conversation_members = conversationMembers.length;

  // ── Events + registrations ─────────────────────────────────────────────
  let registrationCount = 0;
  for (const event of events) {
    const rec = await client.createRecord('events', {
      title: event.title,
      description: event.description,
      type: event.type,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime ?? '',
      location: event.location,
      imageUrl: event.imageUrl ?? '',
      ...(event.maxParticipants ? { maxParticipants: event.maxParticipants } : {}),
      registeredUserIds: ids.remapIds(event.registeredUserIds ?? []),
      invitedUserIds: ids.remapIds(event.invitedUserIds ?? []),
    });
    ids.set(event.id, rec.id);

    for (const userId of event.registeredUserIds ?? []) {
      await client.createRecord('event_registrations', {
        event: rec.id,
        user: ids.get(userId),
      });
      registrationCount += 1;
    }
  }
  counts.events = events.length;
  counts.event_registrations = registrationCount;

  // ── Assignment groups ──────────────────────────────────────────────────
  for (const group of initialAssignmentGroups) {
    const rec = await client.createRecord('assignment_groups', {
      name: group.name,
      teacher: ids.get(group.teacherId),
      kind: group.id === 'grp-general' || group.isGeneral ? 'general' : 'custom',
      members: group.memberIds.map((id) => ids.get(id)).filter(Boolean),
    });
    await patchRecordTimestamps(client, 'assignment_groups', rec.id, group.createdAt, group.updatedAt);
    ids.set(group.id, rec.id);
  }
  counts.assignment_groups = initialAssignmentGroups.length;

  // ── Assignments ────────────────────────────────────────────────────────
  for (const asgn of initialAssignments) {
    const rec = await client.createRecord('assignments', {
      title: asgn.title,
      description: asgn.description,
      teacher: ids.get(asgn.teacherId),
      group: ids.get(asgn.groupId),
      ...(asgn.dueDate ? { dueDate: asgn.dueDate } : {}),
      contentBlocks: asgn.contentBlocks ?? [],
    });
    await patchRecordTimestamps(client, 'assignments', rec.id, asgn.createdAt, asgn.updatedAt);
    ids.set(asgn.id, rec.id);
  }
  counts.assignments = initialAssignments.length;

  // ── Support ────────────────────────────────────────────────────────────
  for (const article of helpArticles) {
    await client.createRecord('help_articles', {
      question: article.question,
      answer: article.answer,
      category: article.category,
      keywords: article.keywords ?? [],
    });
  }
  counts.help_articles = helpArticles.length;

  for (const ticket of initialSupportTickets) {
    const rec = await client.createRecord('support_tickets', {
      user: ids.get(ticket.userId),
      subject: ticket.subject,
      message: ticket.message,
      category: ticket.category,
      status: ticket.status,
      attachments: ticket.attachments ?? [],
      adminReply: ticket.adminReply ?? null,
    });
    await patchRecordTimestamps(client, 'support_tickets', rec.id, ticket.createdAt, ticket.updatedAt);
  }
  counts.support_tickets = initialSupportTickets.length;

  // ── Legal ──────────────────────────────────────────────────────────────
  for (const doc of initialLegalDocuments) {
    const rec = await client.createRecord('legal_documents', {
      type: doc.type,
      title: doc.title,
      content: doc.content,
      currentVersion: doc.currentVersion,
      effectiveAt: doc.effectiveAt,
      requiresConsent: doc.requiresConsent,
      purpose: doc.purpose ?? '',
      required: doc.required ?? false,
      versionHistory: doc.versionHistory ?? [],
    });
    ids.set(doc.id, rec.id);
  }
  counts.legal_documents = initialLegalDocuments.length;

  for (const consent of initialUserConsents) {
    await client.createRecord('user_consents', {
      user: ids.get(consent.userId),
      document: ids.get(consent.documentId),
      documentType: consent.documentType,
      documentTitle: consent.documentTitle,
      version: consent.version,
      purpose: consent.purpose ?? '',
      consentTextVersion: consent.consentTextVersion ?? consent.version,
      acceptedAt: consent.acceptedAt,
    });
  }
  counts.user_consents = initialUserConsents.length;

  // ── Security ───────────────────────────────────────────────────────────
  for (const session of initialSecuritySessions) {
    const rec = await client.createRecord('security_sessions', {
      user: ids.get(session.userId),
      deviceLabel: session.deviceLabel,
      platform: session.platform,
      ipAddress: session.ipAddress,
      lastActiveAt: session.lastActiveAt,
      isCurrent: session.token.includes('desktop'),
    });
    await patchRecordTimestamps(client, 'security_sessions', rec.id, session.createdAt, session.lastActiveAt);
  }
  counts.security_sessions = initialSecuritySessions.length;

  for (const entry of initialLoginHistory) {
    await client.createRecord('login_history', {
      user: ids.get(entry.userId),
      deviceLabel: entry.deviceLabel,
      ipAddress: entry.ipAddress,
      success: entry.success,
      created: entry.createdAt,
    });
  }
  counts.login_history = initialLoginHistory.length;

  for (const alert of initialSecurityAlerts) {
    await client.createRecord('security_alerts', {
      user: ids.get(alert.userId),
      type: alert.type,
      title: alert.title,
      message: alert.message,
      read: alert.read,
      created: alert.createdAt,
    });
  }
  counts.security_alerts = initialSecurityAlerts.length;

  // ── Notifications ──────────────────────────────────────────────────────
  for (const notif of notifications) {
    await client.createRecord('notifications', {
      user: ids.get(notif.userId),
      type: notif.type,
      title: notif.title,
      body: notif.body,
      read: notif.read,
      link: remapLink(notif.link, ids) ?? '',
      created: notif.createdAt,
    });
  }
  counts.notifications = notifications.length;

  for (const user of users) {
    const prefs = createDefaultNotificationPreferences(user.id);
    await client.createRecord('notification_preferences', {
      user: ids.get(user.id),
      pushEnabled: prefs.pushEnabled,
      categories: {},
      channels: {},
    });
  }
  counts.notification_preferences = users.length;

  // ── Public / school ────────────────────────────────────────────────────
  await client.createRecord('school_settings', {
    name: publicSchoolInfo.name,
    tagline: publicSchoolInfo.tagline ?? '',
    about: publicSchoolInfo.about ?? '',
    contacts: {
      ...publicSchoolInfo.contacts,
      socialLinks: publicSchoolInfo.socialLinks ?? {},
      directionsVideo: publicSchoolInfo.directionsVideo ?? null,
      // Public, committed token — PocketBase refuses it unless KVARTIRA_DEV=1.
      // Rotate via /admin/registration-qr before opening registration.
      registrationInvite: {
        token: 'kvartira-school-invite-7f3a9c2e1b8d4e6f0a5c9d2e8b1f4a7c',
        rotatedAt: new Date().toISOString(),
      },
    },
  });
  counts.school_settings = 1;

  for (const item of publicNews) {
    await client.createRecord('public_news', {
      title: item.title,
      excerpt: item.excerpt,
      publishedAt: item.publishedAt,
    });
  }
  counts.public_news = publicNews.length;

  return { skipped: false, counts };
}
