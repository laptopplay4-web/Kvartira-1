import { can } from '@/permissions';
import type { Conversation, ConversationMember, ConversationType, User } from '@/types';

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

export function canCreatePersonalChat(user: User): boolean {
  return can(user, 'chat:create') || can(user, 'chat:write');
}

export function canCreateGroupChat(user: User): boolean {
  return can(user, 'chat:create') && (user.role === 'teacher' || user.role === 'admin');
}

export function canManageMembers(
  user: User,
  conversationId: string,
  members: ConversationMember[],
): boolean {
  if (!can(user, 'chat:manage_members')) return false;
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
  const member = getConversationMember(conversationId, user.id, members);
  return member?.role === 'owner' || user.role === 'admin';
}

export function canLeaveConversation(
  user: User,
  conversation: Conversation,
  members: ConversationMember[],
): boolean {
  if (!isConversationMember(conversation.id, user.id, members)) return false;
  return conversation.type !== 'personal';
}

export function canUpdateConversation(
  user: User,
  conversationId: string,
  members: ConversationMember[],
): boolean {
  if (!canManageMembers(user, conversationId, members)) return false;
  return true;
}

export function canAddMember(user: User, conversationId: string, members: ConversationMember[]): boolean {
  return canManageMembers(user, conversationId, members);
}

export function canRemoveMember(
  user: User,
  conversationId: string,
  targetUserId: string,
  members: ConversationMember[],
): boolean {
  if (!canManageMembers(user, conversationId, members)) return false;
  const target = getConversationMember(conversationId, targetUserId, members);
  if (!target) return false;
  if (target.role === 'owner') return false;
  const actor = getConversationMember(conversationId, user.id, members);
  if (actor?.role === 'owner') return true;
  if (actor?.role === 'admin' && target.role === 'member') return true;
  return user.role === 'admin';
}
