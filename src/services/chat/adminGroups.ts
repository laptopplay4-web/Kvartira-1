import type { Conversation, ConversationMember, User } from '@/types';
import { isConversationMember, isGroupConversation } from '@/services/chat/access';

export interface AdminGroupMembershipDb {
  conversations: Conversation[];
  conversationMembers: ConversationMember[];
  users?: User[];
}

export function listAdminUserIds(users: User[]): string[] {
  return users.filter((u) => u.role === 'admin').map((u) => u.id);
}

export function listTeacherUserIds(users: User[]): string[] {
  return users.filter((u) => u.role === 'teacher').map((u) => u.id);
}

/** School staff who are permanent members of every group chat. */
export function listStaffUserIds(users: User[]): string[] {
  return users.filter((u) => u.role === 'admin' || u.role === 'teacher').map((u) => u.id);
}

/** @deprecated Prefer `withStaffInParticipants` — admins + teachers. */
export function withAdminsInParticipants(participantIds: string[], users: User[]): string[] {
  return withStaffInParticipants(participantIds, users);
}

/** Merge all admins and teachers into a participant list (create-time). */
export function withStaffInParticipants(participantIds: string[], users: User[]): string[] {
  return [...new Set([...participantIds, ...listStaffUserIds(users)])];
}

/**
 * Idempotent: add staff user to every non-personal chat (membership + participantIds).
 * Personal chats stay IDOR-safe (staff is not auto-joined).
 *
 * Call when:
 * - admin|teacher opens chat list / conversation (mock + PB client heal)
 * - user is promoted to admin|teacher (PB hook `joinStaffUserToAllGroupChats`)
 */
export function ensureStaffGroupMembership(
  db: Pick<AdminGroupMembershipDb, 'conversations' | 'conversationMembers'>,
  staffUserId: string,
): number {
  const now = new Date().toISOString();
  let added = 0;

  for (const conv of db.conversations) {
    if (!isGroupConversation(conv.type)) continue;
    if (isConversationMember(conv.id, staffUserId, db.conversationMembers)) continue;

    db.conversationMembers.push({
      conversationId: conv.id,
      userId: staffUserId,
      role: 'member',
      joinedAt: now,
      muted: false,
    });

    if (!conv.participantIds.includes(staffUserId)) {
      conv.participantIds = [...conv.participantIds, staffUserId];
    }
    added += 1;
  }

  return added;
}

/** @deprecated Alias — same as `ensureStaffGroupMembership`. */
export function ensureAdminGroupMembership(
  db: Pick<AdminGroupMembershipDb, 'conversations' | 'conversationMembers'>,
  adminUserId: string,
): number {
  return ensureStaffGroupMembership(db, adminUserId);
}
