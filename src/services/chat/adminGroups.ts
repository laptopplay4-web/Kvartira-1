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

/** Merge all admin ids into a participant list (create-time). */
export function withAdminsInParticipants(participantIds: string[], users: User[]): string[] {
  return [...new Set([...participantIds, ...listAdminUserIds(users)])];
}

/**
 * Idempotent: add admin to every non-personal chat (membership + participantIds).
 * Personal chats stay IDOR-safe (admin is not auto-joined).
 *
 * Call when:
 * - admin opens chat list / conversation (mock + PB client heal)
 * - user is promoted to admin (PB hook `joinAdminToAllGroupChats`)
 */
export function ensureAdminGroupMembership(
  db: Pick<AdminGroupMembershipDb, 'conversations' | 'conversationMembers'>,
  adminUserId: string,
): number {
  const now = new Date().toISOString();
  let added = 0;

  for (const conv of db.conversations) {
    if (!isGroupConversation(conv.type)) continue;
    if (isConversationMember(conv.id, adminUserId, db.conversationMembers)) continue;

    db.conversationMembers.push({
      conversationId: conv.id,
      userId: adminUserId,
      role: 'member',
      joinedAt: now,
      muted: false,
    });

    if (!conv.participantIds.includes(adminUserId)) {
      conv.participantIds = [...conv.participantIds, adminUserId];
    }
    added += 1;
  }

  return added;
}
