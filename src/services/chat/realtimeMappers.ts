import type { RecordSubscription } from 'pocketbase';
import type { ChatRealtimeEvent } from '@/services/chat/realtime';
import {
  mapConversationMemberRecord,
  mapConversationRecord,
  mapMessageRecord,
} from '@/services/api/pocketbase/mappers';

export function mapMessageSubscription(sub: RecordSubscription): ChatRealtimeEvent | null {
  const message = mapMessageRecord(sub.record);
  const conversationId = message.conversationId;

  if (sub.action === 'create') {
    return { type: 'message.created', conversationId, message };
  }

  if (sub.action === 'delete') {
    return { type: 'message.deleted', conversationId, message };
  }

  if (sub.action === 'update') {
    if (message.deletedAt) {
      return { type: 'message.deleted', conversationId, message };
    }
    return { type: 'message.updated', conversationId, message };
  }

  return null;
}

export function mapConversationSubscription(sub: RecordSubscription): ChatRealtimeEvent | null {
  if (sub.action !== 'create' && sub.action !== 'update') return null;
  const conversation = mapConversationRecord(sub.record);
  return { type: 'conversation.updated', conversationId: conversation.id, conversation };
}

export function mapMemberSubscription(sub: RecordSubscription): ChatRealtimeEvent | null {
  const member = mapConversationMemberRecord(sub.record);
  const conversationId = member.conversationId;

  if (sub.action === 'create') {
    return { type: 'member.joined', conversationId, userId: member.userId };
  }

  if (sub.action === 'delete') {
    return { type: 'member.left', conversationId, userId: member.userId };
  }

  if (sub.action === 'update' && member.lastReadAt) {
    return { type: 'message.read', conversationId, userId: member.userId };
  }

  return null;
}
