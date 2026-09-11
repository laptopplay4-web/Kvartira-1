import type { Conversation, ConversationMember } from '@/types';
import { isConversationMember } from '@/services/chat/access';

export function isSchoolWideConversation(conversation: Conversation): boolean {
  return conversation.metadata?.schoolWide === true;
}

export interface SchoolWideMembershipDb {
  conversations: Conversation[];
  conversationMembers: ConversationMember[];
}

/** Idempotent: add user to every school-wide chat (membership + participantIds). */
export function ensureSchoolWideMembership(db: SchoolWideMembershipDb, userId: string): number {
  const now = new Date().toISOString();
  let added = 0;

  for (const conv of db.conversations) {
    if (!isSchoolWideConversation(conv)) continue;
    if (isConversationMember(conv.id, userId, db.conversationMembers)) continue;

    db.conversationMembers.push({
      conversationId: conv.id,
      userId,
      role: 'member',
      joinedAt: now,
      muted: false,
    });

    if (!conv.participantIds.includes(userId)) {
      conv.participantIds = [...conv.participantIds, userId];
    }
    added += 1;
  }

  return added;
}
