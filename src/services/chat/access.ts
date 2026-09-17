import { actsAsTeacher, can } from '@/permissions';
import type { Conversation, ConversationMember, ConversationType, User } from '@/types';
import { isSchoolWideConversation } from '@/services/chat/schoolWide';

export function isGroupConversation(type: ConversationType): boolean {
  return type !== 'personal';
}

export function isConversationMember(
  conversationId: string,
  userId: string,
  members: ConversationMember[],
): boolean {
  return members.some((m) => m.conversationId === conversationId && m.userId === userId);
}

export function getConversationMember(
  conversationId: string,
  userId: string,
  members: ConversationMember[],
): ConversationMember | undefined {
  return members.find((m) => m.conversationId === conversationId && m.userId === userId);
}

export function isMemberMuted(member: ConversationMember): boolean {
  if (member.muted) return true;
  if (member.mutedUntil) return new Date(member.mutedUntil) > new Date();
  return false;
}

export function canAccessConversation(
  user: User,
  conversation: Conversation,
  members: ConversationMember[],
): boolean {
  if (!can(user, 'chat:read')) return false;
  return isConversationMember(conversation.id, user.id, members);
}

export function canSendToConversation(
  user: User,
  conversation: Conversation,
  members: ConversationMember[],
): boolean {
  if (!can(user, 'chat:send') && !can(user, 'chat:write')) return false;
  return isConversationMember(conversation.id, user.id, members);
}

/** Create / edit / delete chats: teacher and admin only. */
export function canManageChats(user: User): boolean {
  return can(user, 'chat:create') && actsAsTeacher(user.role);
}

export function canCreatePersonalChat(user: User): boolean {
  return canManageChats(user);
}

export function canCreateGroupChat(user: User): boolean {
  return canManageChats(user);
}

export function canCreateSchoolWideChat(user: User): boolean {
  return canManageChats(user);
}

/** Personal chats are only teacher|admin ↔ student. */
export function isValidTeacherStudentPersonalPair(participants: User[]): boolean {
  if (participants.length !== 2) return false;
  const roles = participants.map((p) => p.role);
  const hasStudent = roles.includes('student');
  const hasStaff = roles.some((r) => r === 'teacher' || r === 'admin');
  return hasStudent && hasStaff;
}

export function canManageMembers(
  user: User,
  conversationId: string,
  members: ConversationMember[],
  conversation?: Conversation,
): boolean {
  if (conversation?.type === 'personal') return false;
  if (conversation && isSchoolWideConversation(conversation)) return false;
  if (!can(user, 'chat:manage_members')) return false;
  if (!actsAsTeacher(user.role)) return false;

  const member = getConversationMember(conversationId, user.id, members);
  if (!member) return false;

  return member.role === 'owner' || member.role === 'admin' || user.role === 'admin';
}

export function canDeleteConversation(
  user: User,
  conversationId: string,
  members: ConversationMember[],
): boolean {
  if (!can(user, 'chat:delete')) return false;
  if (!actsAsTeacher(user.role)) return false;

  const member = getConversationMember(conversationId, user.id, members);
  return member?.role === 'owner' || user.role === 'admin';
}

export function canLeaveConversation(
  user: User,
  conversation: Conversation,
  members: ConversationMember[],
): boolean {
  if (!isConversationMember(conversation.id, user.id, members)) return false;
  if (conversation.type === 'personal') return false;
  // Students cannot leave groups; staff removes them.
  if (user.role === 'student') return false;
  if (conversation.metadata?.schoolWide) return false;
  return true;
}

export function canUpdateConversation(
  user: User,
  conversationId: string,
  members: ConversationMember[],
): boolean {
  return canManageMembers(user, conversationId, members);
}

export function canAddMember(
  user: User,
  conversationId: string,
  members: ConversationMember[],
  conversation?: Conversation,
): boolean {
  return canManageMembers(user, conversationId, members, conversation);
}

/**
 * School admins are permanent group members (ensureStaffGroupMembership).
 * Teachers are also auto-joined to every group; only a school admin may remove them.
 * Pass `targetUser` so global role can be checked — conversation role alone is not enough
 * (staff are often stored as conversation `member`).
 */
export function canRemoveMember(
  user: User,
  conversationId: string,
  targetUserId: string,
  members: ConversationMember[],
  conversation?: Conversation,
  targetUser?: Pick<User, 'role'> | null,
): boolean {
  if (!canManageMembers(user, conversationId, members, conversation)) return false;

  // Fail closed for groups when caller omitted targetUser (cannot verify staff protection).
  if (!conversation || isGroupConversation(conversation.type)) {
    if (!targetUser) return false;
    if (targetUser.role === 'admin') return false;
    // Teachers: only school administrator may remove (not conversation owner/teacher).
    if (targetUser.role === 'teacher' && user.role !== 'admin') return false;
  }

  const target = getConversationMember(conversationId, targetUserId, members);
  if (!target) return false;
  if (target.role === 'owner') return false;

  const actor = getConversationMember(conversationId, user.id, members);
  if (actor?.role === 'owner') return true;
  if (actor?.role === 'admin' && target.role === 'member') return true;

  return user.role === 'admin';
}
