import { describe, expect, it } from 'vitest';
import {
  mapConversationSubscription,
  mapMemberSubscription,
  mapMessageSubscription,
} from '@/services/chat/realtimeMappers';

const baseRecord = {
  id: 'rec-1',
  collectionId: 'c1',
  collectionName: 'messages',
  created: '2026-08-31T10:00:00.000Z',
  updated: '2026-08-31T10:00:00.000Z',
};

describe('chat realtime mappers (ROADMAP 3.2)', () => {
  it('maps message create/update/delete subscriptions', () => {
    const created = mapMessageSubscription({
      action: 'create',
      record: {
        ...baseRecord,
        conversation: 'conv-1',
        sender: 'user-student',
        text: 'Hi',
        status: 'sent',
      },
    });
    expect(created?.type).toBe('message.created');
    expect(created?.conversationId).toBe('conv-1');
    expect(created?.message?.text).toBe('Hi');

    const updated = mapMessageSubscription({
      action: 'update',
      record: {
        ...baseRecord,
        conversation: 'conv-1',
        sender: 'user-student',
        text: 'Hi!',
        status: 'sent',
        editedAt: '2026-08-31T10:01:00.000Z',
      },
    });
    expect(updated?.type).toBe('message.updated');

    const softDeleted = mapMessageSubscription({
      action: 'update',
      record: {
        ...baseRecord,
        conversation: 'conv-1',
        sender: 'user-student',
        text: '',
        status: 'sent',
        deletedAt: '2026-08-31T10:02:00.000Z',
      },
    });
    expect(softDeleted?.type).toBe('message.deleted');

    const deleted = mapMessageSubscription({
      action: 'delete',
      record: {
        ...baseRecord,
        conversation: 'conv-1',
        sender: 'user-student',
        text: 'Hi',
        status: 'sent',
      },
    });
    expect(deleted?.type).toBe('message.deleted');
  });

  it('maps conversation and member subscriptions', () => {
    const conversation = mapConversationSubscription({
      action: 'update',
      record: {
        ...baseRecord,
        collectionName: 'conversations',
        type: 'personal',
        participantIds: ['user-student', 'user-teacher-1'],
      },
    });
    expect(conversation?.type).toBe('conversation.updated');
    expect(conversation?.conversationId).toBe('rec-1');

    const joined = mapMemberSubscription({
      action: 'create',
      record: {
        ...baseRecord,
        collectionName: 'conversation_members',
        conversation: 'conv-1',
        user: 'user-student',
        role: 'member',
        muted: false,
      },
    });
    expect(joined?.type).toBe('member.joined');
    expect(joined?.userId).toBe('user-student');

    const left = mapMemberSubscription({
      action: 'delete',
      record: {
        ...baseRecord,
        collectionName: 'conversation_members',
        conversation: 'conv-1',
        user: 'user-student',
        role: 'member',
        muted: false,
      },
    });
    expect(left?.type).toBe('member.left');

    const read = mapMemberSubscription({
      action: 'update',
      record: {
        ...baseRecord,
        collectionName: 'conversation_members',
        conversation: 'conv-1',
        user: 'user-student',
        role: 'member',
        muted: false,
        lastReadAt: '2026-08-31T10:05:00.000Z',
      },
    });
    expect(read?.type).toBe('message.read');
  });
});
