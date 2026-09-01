import { ClientResponseError } from 'pocketbase';
import type {
  ChatApi,
  CreateConversationInput,
  EditMessageInput,
  GetMessagesParams,
  MuteConversationInput,
  SendMessageOptions,
  UpdateConversationInput,
  UploadAttachmentInput,
} from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import {
  mapConversationMemberRecord,
  mapConversationRecord,
  mapLessonRecord,
  mapMessageRecord,
  mapUserRecord,
} from '@/services/api/pocketbase/mappers';
import { escapePbFilter, pbEqOr, relId } from '@/services/api/pocketbase/helpers';
import { compareIsoDates } from '@/utils/dates';
import {
  resolveMessage,
  resolveMessages,
  uploadStoredFile,
} from '@/services/api/pocketbase/files';
import { can } from '@/permissions';
import { formatUserName } from '@/utils';
import {
  canAccessConversation,
  canAddMember,
  canCreateGroupChat,
  canCreatePersonalChat,
  canDeleteConversation,
  canLeaveConversation,
  canRemoveMember,
  canSendToConversation,
  canUpdateConversation,
  getConversationMember,
} from '@/services/chat/access';
import {
  computeUnreadCount,
  getConversationDisplayTitle,
  isValidMessageText,
  matchesMessageSearch,
  normalizeMessageText,
} from '@/services/chat/helpers';
import { canDeleteMessage, canEditMessage, canPinMessage } from '@/services/chat/messages';
import { MESSAGE_MAX_LENGTH, MESSAGE_PAGE_SIZE, MESSAGE_SEARCH_MIN_LENGTH } from '@/services/chat/constants';
import { detectAttachmentType, validateAttachment, validateMessageContent } from '@/services/chat/validation';
import { chatRealtimeService } from '@/services/chat/realtime';
import { findConversationForLesson } from '@/services/lessons/helpers';
import type {
  Conversation,
  ConversationMember,
  Message,
  MessageAttachment,
  MessageSearchResult,
  MessageSystemMetadata,
  User,
} from '@/types';

const PINNED_MESSAGES_LIMIT = 5;
const openConversations = new Map<string, string>();

function uid(prefix: string): string {
  const suffix = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${suffix}`;
}

async function getRequesterUser(userId: string): Promise<User> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('users').getOne(userId);
    return mapUserRecord(record);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

async function loadConversationOrThrow(conversationId: string): Promise<Conversation> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('conversations').getOne(conversationId);
    return mapConversationRecord(record);
  } catch (error) {
    if (error instanceof ClientResponseError && (error.status === 404 || error.status === 403)) {
      throw new ApiError('Чат не найден', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

async function loadMembers(conversationId: string): Promise<ConversationMember[]> {
  const pb = getPocketBase();
  const records = await pb.collection('conversation_members').getFullList({
    filter: `conversation = "${escapePbFilter(conversationId)}"`,
  });
  return records.map(mapConversationMemberRecord);
}

async function loadUserMembers(userId: string): Promise<ConversationMember[]> {
  const pb = getPocketBase();
  const records = await pb.collection('conversation_members').getFullList({
    filter: `user = "${escapePbFilter(userId)}"`,
  });
  return records.map(mapConversationMemberRecord);
}

async function loadMessagesForConversations(conversationIds: string[]): Promise<Message[]> {
  if (conversationIds.length === 0) return [];
  const pb = getPocketBase();
  const filter = pbEqOr('conversation', conversationIds);
  const records = await pb.collection('messages').getFullList({ filter });
  return records.map(mapMessageRecord);
}

async function findMemberRecord(conversationId: string, userId: string) {
  const pb = getPocketBase();
  try {
    return await pb
      .collection('conversation_members')
      .getFirstListItem(
        `conversation = "${escapePbFilter(conversationId)}" && user = "${escapePbFilter(userId)}"`,
      );
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) return null;
    throw error;
  }
}

async function assertConversationAccess(
  conversationId: string,
  userId: string,
): Promise<{ user: User; conversation: Conversation; members: ConversationMember[] }> {
  const user = await getRequesterUser(userId);
  if (!can(user, 'chat:read')) {
    throw new ApiError('Нет доступа к чату', 'FORBIDDEN', 403);
  }
  const conversation = await loadConversationOrThrow(conversationId);
  const members = await loadMembers(conversationId);
  if (!canAccessConversation(user, conversation, members)) {
    throw new ApiError('Нет доступа к чату', 'FORBIDDEN', 403);
  }
  return { user, conversation, members };
}

function enrichConversation(
  conv: Conversation,
  userId: string,
  messages: Message[],
  members: ConversationMember[],
): Conversation {
  const member = getConversationMember(conv.id, userId, members);
  const convMessages = messages.filter((m) => m.conversationId === conv.id);
  const unreadCount = computeUnreadCount(conv.id, userId, convMessages, member);
  const visible = convMessages.filter((m) => !m.deletedAt || m.senderId === userId);
  const lastMessage = [...visible]
    .sort((a, b) => compareIsoDates(a.createdAt, b.createdAt))
    .at(-1);

  return {
    ...conv,
    unreadCount,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          text: lastMessage.deletedAt ? 'Сообщение удалено' : lastMessage.text,
          senderId: lastMessage.senderId,
          createdAt: lastMessage.createdAt,
        }
      : conv.lastMessage,
    lastMessageAt: lastMessage?.createdAt ?? conv.lastMessageAt,
    updatedAt: lastMessage?.createdAt ?? conv.updatedAt,
  };
}

async function createSystemMessage(
  conversationId: string,
  actorId: string,
  text: string,
  event: MessageSystemMetadata,
): Promise<Message> {
  const pb = getPocketBase();
  const record = await pb.collection('messages').create({
    conversation: conversationId,
    sender: actorId,
    text,
    status: 'sent',
    readBy: [actorId],
    messageType: 'system',
    metadata: { system: event },
  });
        return resolveMessage(mapMessageRecord(record));
}

async function updateParticipantIds(conversationId: string, participantIds: string[]): Promise<void> {
  const pb = getPocketBase();
  await pb.collection('conversations').update(conversationId, { participantIds });
}

export const pocketbaseChatApi: ChatApi = {
  async getConversations(userId) {
    return withPbError(async () => {
      const user = await getRequesterUser(userId);
      if (!can(user, 'chat:read')) throw new ApiError('Нет доступа', 'FORBIDDEN', 403);

      const pb = getPocketBase();
      const records = await pb.collection('conversations').getFullList({
        sort: '-lastMessageAt,-id',
      });
      const conversations = records.map(mapConversationRecord);
      const userMembers = await loadUserMembers(userId);
      const accessible = conversations.filter((c) => canAccessConversation(user, c, userMembers));
      const messages = await loadMessagesForConversations(accessible.map((c) => c.id));

      return accessible
        .map((c) => enrichConversation(c, userId, messages, userMembers))
        .sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt));
    });
  },

  async getConversation(conversationId, userId) {
    return withPbError(async () => {
      const { conversation, members } = await assertConversationAccess(conversationId, userId);
      const messages = await loadMessagesForConversations([conversationId]);
      return enrichConversation(conversation, userId, messages, members);
    });
  },

  async getConversationForLesson(lessonId, userId) {
    return withPbError(async () => {
      const user = await getRequesterUser(userId);
      if (!can(user, 'chat:read')) return null;

      const pb = getPocketBase();
      let lesson;
      try {
        lesson = mapLessonRecord(await pb.collection('lessons').getOne(lessonId));
      } catch (error) {
        if (error instanceof ClientResponseError && (error.status === 404 || error.status === 403)) {
          return null;
        }
        throw error;
      }

      const conversations = await pocketbaseChatApi.getConversations(userId);
      const conversation = findConversationForLesson(conversations, lesson);
      if (!conversation) return null;
      return conversation;
    });
  },

  async getMessages(conversationId, userId, params: GetMessagesParams = {}) {
    return withPbError(async () => {
      await assertConversationAccess(conversationId, userId);
      const limit = params.limit ?? MESSAGE_PAGE_SIZE;
      const pb = getPocketBase();

      let createdFilter = '';
      if (params.cursor) {
        try {
          const cursorRecord = await pb.collection('messages').getOne(params.cursor);
          if (relId(cursorRecord.conversation) !== conversationId) {
            throw new ApiError('Сообщение не найдено', 'NOT_FOUND', 404);
          }
          createdFilter = ` && created < "${escapePbFilter(cursorRecord.created)}"`;
        } catch (error) {
          if (error instanceof ApiError) throw error;
          if (error instanceof ClientResponseError && error.status === 404) {
            throw new ApiError('Сообщение не найдено', 'NOT_FOUND', 404);
          }
          throw error;
        }
      }

      const result = await pb.collection('messages').getList(1, limit + 1, {
        filter: `conversation = "${escapePbFilter(conversationId)}"${createdFilter}`,
        sort: '-id',
      });

      const hasMore = result.items.length > limit;
      const page = hasMore ? result.items.slice(0, limit) : result.items;
      const messages = await resolveMessages(page.map(mapMessageRecord).reverse());
      const nextCursor = hasMore ? messages[0]?.id : undefined;
      return { messages, nextCursor, hasMore };
    });
  },

  async getMessage(conversationId, messageId, userId) {
    return withPbError(async () => {
      await assertConversationAccess(conversationId, userId);
      const pb = getPocketBase();
      try {
        const record = await pb.collection('messages').getOne(messageId);
        const message = await resolveMessage(mapMessageRecord(record));
        if (message.conversationId !== conversationId) {
          throw new ApiError('Сообщение не найдено', 'NOT_FOUND', 404);
        }
        return message;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Сообщение не найдено', 'NOT_FOUND', 404);
        }
        throw error;
      }
    });
  },

  async sendMessage(conversationId, userId, text, options: SendMessageOptions = {}) {
    return withPbError(async () => {
      const { user, conversation, members } = await assertConversationAccess(conversationId, userId);
      if (!canSendToConversation(user, conversation, members)) {
        throw new ApiError('Нет доступа к чату', 'FORBIDDEN', 403);
      }

      const pb = getPocketBase();

      if (options.clientMutationId) {
        try {
          const dup = await pb.collection('messages').getFirstListItem(
            `conversation = "${escapePbFilter(conversationId)}" && sender = "${escapePbFilter(userId)}" && clientMutationId = "${escapePbFilter(options.clientMutationId)}"`,
          );
          return resolveMessage(mapMessageRecord(dup));
        } catch (error) {
          if (!(error instanceof ClientResponseError) || error.status !== 404) throw error;
        }
      }

      const attachments = options.attachments ?? [];
      const contentCheck = validateMessageContent(text, attachments.length);
      if (!contentCheck.valid) {
        throw new ApiError(contentCheck.error ?? 'Некорректное сообщение', 'VALIDATION', 400);
      }

      const normalized = normalizeMessageText(text);
      if (normalized.length > MESSAGE_MAX_LENGTH) {
        throw new ApiError('Некорректное сообщение', 'VALIDATION', 400);
      }

      if (options.replyToMessageId) {
        try {
          const replyTarget = await pb.collection('messages').getOne(options.replyToMessageId);
          if (relId(replyTarget.conversation) !== conversationId) {
            throw new ApiError('Сообщение для ответа не найдено', 'NOT_FOUND', 404);
          }
        } catch (error) {
          if (error instanceof ApiError) throw error;
          if (error instanceof ClientResponseError && error.status === 404) {
            throw new ApiError('Сообщение для ответа не найдено', 'NOT_FOUND', 404);
          }
          throw error;
        }
      }

      const body: Record<string, unknown> = {
        conversation: conversationId,
        sender: userId,
        text: normalized || attachments[0]?.filename || 'Вложение',
        status: 'sent',
        readBy: [userId],
        messageType: 'user',
      };
      if (options.clientMutationId) body.clientMutationId = options.clientMutationId;
      if (options.replyToMessageId) body.replyToMessageId = options.replyToMessageId;
      if (attachments.length > 0) body.attachments = attachments;

      const record = await pb.collection('messages').create(body);
      const msg = await resolveMessage(mapMessageRecord(record));

      const memberRecord = await findMemberRecord(conversationId, userId);
      if (memberRecord) {
        await pb.collection('conversation_members').update(memberRecord.id, {
          lastReadMessageId: msg.id,
          lastReadAt: new Date().toISOString(),
        });
      }

      chatRealtimeService.emit({ type: 'message.created', conversationId, message: msg });
      return msg;
    });
  },

  async editMessage(conversationId, messageId, userId, input: EditMessageInput) {
    return withPbError(async () => {
      const { user } = await assertConversationAccess(conversationId, userId);
      const msg = await pocketbaseChatApi.getMessage(conversationId, messageId, userId);

      if (!canEditMessage(user, msg)) {
        throw new ApiError('Нет прав на редактирование', 'FORBIDDEN', 403);
      }

      const normalized = normalizeMessageText(input.text);
      if (!isValidMessageText(normalized, MESSAGE_MAX_LENGTH)) {
        throw new ApiError('Некорректное сообщение', 'VALIDATION', 400);
      }

      const pb = getPocketBase();
      const now = new Date().toISOString();
      const record = await pb.collection('messages').update(messageId, {
        text: normalized,
        editedAt: now,
      });
      const updated = await resolveMessage(mapMessageRecord(record));
      chatRealtimeService.emit({ type: 'message.updated', conversationId, message: updated });
      return updated;
    });
  },

  async deleteMessage(conversationId, messageId, userId) {
    return withPbError(async () => {
      const { user } = await assertConversationAccess(conversationId, userId);
      const msg = await pocketbaseChatApi.getMessage(conversationId, messageId, userId);

      if (!canDeleteMessage(user, msg)) {
        throw new ApiError('Нет прав на удаление', 'FORBIDDEN', 403);
      }

      const pb = getPocketBase();
      const now = new Date().toISOString();
      const record = await pb.collection('messages').update(messageId, { deletedAt: now });
      const updated = await resolveMessage(mapMessageRecord(record));
      chatRealtimeService.emit({ type: 'message.deleted', conversationId, message: updated });
      return updated;
    });
  },

  async markAsRead(conversationId, userId) {
    return withPbError(async () => {
      await assertConversationAccess(conversationId, userId);
      const pb = getPocketBase();
      const memberRecord = await findMemberRecord(conversationId, userId);
      const last = await pb.collection('messages').getList(1, 1, {
        filter: `conversation = "${escapePbFilter(conversationId)}"`,
        sort: '-id',
      });
      const lastMsg = last.items[0];
      const now = new Date().toISOString();

      if (memberRecord && lastMsg) {
        await pb.collection('conversation_members').update(memberRecord.id, {
          lastReadMessageId: lastMsg.id,
          lastReadAt: now,
        });
      }

      chatRealtimeService.emit({ type: 'message.read', conversationId, userId });
    });
  },

  async setOpenConversation(userId, conversationId) {
    if (conversationId) openConversations.set(userId, conversationId);
    else openConversations.delete(userId);
  },

  async createConversation(userId, input: CreateConversationInput) {
    return withPbError(async () => {
      const user = await getRequesterUser(userId);
      const uniqueParticipants = [...new Set([userId, ...input.participantIds])];
      if (uniqueParticipants.length < 2) {
        throw new ApiError('Укажите участников', 'VALIDATION', 400);
      }

      const pb = getPocketBase();

      if (input.type === 'personal') {
        if (!canCreatePersonalChat(user)) {
          throw new ApiError('Нет прав на создание чата', 'FORBIDDEN', 403);
        }
        if (uniqueParticipants.length !== 2) {
          throw new ApiError('Личный чат — только два участника', 'VALIDATION', 400);
        }
        const existingRecords = await pb.collection('conversations').getFullList({
          filter: 'type = "personal"',
        });
        const existing = existingRecords.map(mapConversationRecord).find((c) => {
          const ids = new Set(c.participantIds);
          return uniqueParticipants.every((id) => ids.has(id)) && ids.size === 2;
        });
        if (existing) {
          const members = await loadMembers(existing.id);
          const messages = await loadMessagesForConversations([existing.id]);
          return enrichConversation(existing, userId, messages, members);
        }
      } else {
        if (!canCreateGroupChat(user)) {
          throw new ApiError('Нет прав на создание группы', 'FORBIDDEN', 403);
        }
        const title = input.title?.trim();
        if (!title) throw new ApiError('Укажите название группы', 'VALIDATION', 400);
      }

      for (const participantId of uniqueParticipants) {
        await getRequesterUser(participantId);
      }

      const otherId = uniqueParticipants.find((id) => id !== userId);
      const otherUser = otherId ? await getRequesterUser(otherId) : undefined;
      const title =
        input.type === 'personal'
          ? otherUser
            ? formatUserName(otherUser)
            : 'Личный чат'
          : input.title!.trim();

      const convRecord = await pb.collection('conversations').create({
        type: input.type,
        title,
        participantIds: uniqueParticipants,
        metadata: input.metadata ?? {},
        pinnedMessageIds: [],
      });

      for (const participantId of uniqueParticipants) {
        await pb.collection('conversation_members').create({
          conversation: convRecord.id,
          user: participantId,
          role: participantId === userId ? 'owner' : 'member',
          muted: false,
        });
      }

      const conv = mapConversationRecord(convRecord);
      const members = await loadMembers(conv.id);
      chatRealtimeService.emit({ type: 'conversation.updated', conversationId: conv.id, conversation: conv });
      return enrichConversation(conv, userId, [], members);
    });
  },

  async getTotalUnread(userId) {
    const conversations = await pocketbaseChatApi.getConversations(userId);
    return conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  },

  async searchMessages(userId, query) {
    return withPbError(async () => {
      const user = await getRequesterUser(userId);
      if (!can(user, 'chat:read')) throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
      const q = query.trim();
      if (q.length < MESSAGE_SEARCH_MIN_LENGTH) return [];

      const conversations = await pocketbaseChatApi.getConversations(userId);
      const convIds = new Set(conversations.map((c) => c.id));
      if (convIds.size === 0) return [];

      const pb = getPocketBase();
      const records = await pb.collection('messages').getFullList({
        filter: pbEqOr('conversation', [...convIds]),
        expand: 'sender',
        sort: '-id',
      });

      const results: MessageSearchResult[] = [];
      for (const record of records) {
        const msg = await resolveMessage(mapMessageRecord(record));
        if (!convIds.has(msg.conversationId)) continue;
        if (!matchesMessageSearch(msg, q)) continue;
        const conv = conversations.find((c) => c.id === msg.conversationId);
        if (!conv) continue;
        const expanded = record.expand?.sender;
        const senderRecord = Array.isArray(expanded) ? expanded[0] : expanded;
        const senderName = senderRecord
          ? formatUserName(mapUserRecord(senderRecord))
          : 'Неизвестный';
        results.push({
          message: msg,
          conversationId: conv.id,
          conversationTitle: getConversationDisplayTitle(conv, userId, []),
          senderName,
        });
      }

      return results.slice(0, 50);
    });
  },

  async getMembers(conversationId, userId) {
    return withPbError(async () => {
      await assertConversationAccess(conversationId, userId);
      return loadMembers(conversationId);
    });
  },

  async addMember(conversationId, userId, targetUserId) {
    return withPbError(async () => {
      const { user, conversation, members } = await assertConversationAccess(conversationId, userId);
      if (!canAddMember(user, conversationId, members)) {
        throw new ApiError('Нет прав на управление участниками', 'FORBIDDEN', 403);
      }
      if (conversation.type === 'personal') {
        throw new ApiError('Нельзя добавить участника в личный чат', 'VALIDATION', 400);
      }

      await getRequesterUser(targetUserId);
      if (getConversationMember(conversationId, targetUserId, members)) {
        throw new ApiError('Участник уже в чате', 'VALIDATION', 400);
      }

      const pb = getPocketBase();
      const record = await pb.collection('conversation_members').create({
        conversation: conversationId,
        user: targetUserId,
        role: 'member',
        muted: false,
      });
      await updateParticipantIds(conversationId, [...new Set([...conversation.participantIds, targetUserId])]);

      const target = await getRequesterUser(targetUserId);
      await createSystemMessage(conversationId, userId, `${formatUserName(user)} добавил ${formatUserName(target)}`, {
        event: 'member_added',
        actorId: userId,
        targetUserId,
      });

      chatRealtimeService.emit({ type: 'member.joined', conversationId, userId: targetUserId });
      return mapConversationMemberRecord(record);
    });
  },

  async removeMember(conversationId, userId, targetUserId) {
    return withPbError(async () => {
      const { user, conversation, members } = await assertConversationAccess(conversationId, userId);
      if (!canRemoveMember(user, conversationId, targetUserId, members)) {
        throw new ApiError('Нет прав на удаление участника', 'FORBIDDEN', 403);
      }

      const pb = getPocketBase();
      const targetRecord = await findMemberRecord(conversationId, targetUserId);
      if (targetRecord) await pb.collection('conversation_members').delete(targetRecord.id);
      await updateParticipantIds(
        conversationId,
        conversation.participantIds.filter((id) => id !== targetUserId),
      );

      const target = await getRequesterUser(targetUserId);
      await createSystemMessage(conversationId, userId, `${formatUserName(user)} удалил ${formatUserName(target)}`, {
        event: 'member_removed',
        actorId: userId,
        targetUserId,
      });

      chatRealtimeService.emit({ type: 'member.left', conversationId, userId: targetUserId });
    });
  },

  async leaveConversation(conversationId, userId) {
    return withPbError(async () => {
      const { user, conversation, members } = await assertConversationAccess(conversationId, userId);
      if (!canLeaveConversation(user, conversation, members)) {
        throw new ApiError('Нельзя покинуть этот чат', 'FORBIDDEN', 403);
      }

      const pb = getPocketBase();
      await createSystemMessage(conversationId, userId, `${formatUserName(user)} покинул чат`, {
        event: 'member_left',
        actorId: userId,
      });

      const memberRecord = await findMemberRecord(conversationId, userId);
      if (memberRecord) await pb.collection('conversation_members').delete(memberRecord.id);
      await updateParticipantIds(
        conversationId,
        conversation.participantIds.filter((id) => id !== userId),
      );

      chatRealtimeService.emit({ type: 'member.left', conversationId, userId });
    });
  },

  async updateConversation(conversationId, userId, input: UpdateConversationInput) {
    return withPbError(async () => {
      const { user, conversation, members } = await assertConversationAccess(conversationId, userId);
      if (!canUpdateConversation(user, conversationId, members)) {
        throw new ApiError('Нет прав на изменение чата', 'FORBIDDEN', 403);
      }

      const previousTitle = conversation.title;
      const body: Record<string, unknown> = {};
      if (input.title?.trim()) body.title = input.title.trim();
      if (input.avatarUrl !== undefined) body.avatarUrl = input.avatarUrl;

      const pb = getPocketBase();
      const record =
        Object.keys(body).length > 0
          ? await pb.collection('conversations').update(conversationId, body)
          : await pb.collection('conversations').getOne(conversationId);
      const updated = mapConversationRecord(record);

      if (input.title && input.title.trim() !== previousTitle) {
        await createSystemMessage(conversationId, userId, `Название группы изменено на «${updated.title}»`, {
          event: 'title_changed',
          actorId: userId,
          previousTitle,
          newTitle: updated.title,
        });
      }

      const messages = await loadMessagesForConversations([conversationId]);
      chatRealtimeService.emit({ type: 'conversation.updated', conversationId, conversation: updated });
      return enrichConversation(updated, userId, messages, members);
    });
  },

  async muteConversation(conversationId, userId, input: MuteConversationInput) {
    return withPbError(async () => {
      await assertConversationAccess(conversationId, userId);
      const memberRecord = await findMemberRecord(conversationId, userId);
      if (!memberRecord) throw new ApiError('Участник не найден', 'NOT_FOUND', 404);

      const pb = getPocketBase();
      const record = await pb.collection('conversation_members').update(memberRecord.id, {
        muted: input.muted,
        mutedUntil: input.mutedUntil ?? '',
      });
      const member = mapConversationMemberRecord(record);
      member.mutedUntil = input.mutedUntil ?? null;
      return member;
    });
  },

  async pinMessage(conversationId, messageId, userId) {
    return withPbError(async () => {
      const { user, conversation, members } = await assertConversationAccess(conversationId, userId);
      const msg = await pocketbaseChatApi.getMessage(conversationId, messageId, userId);

      if (!canPinMessage(user, members, conversationId)) {
        throw new ApiError('Нет прав на закрепление', 'FORBIDDEN', 403);
      }
      if (msg.deletedAt) {
        throw new ApiError('Нельзя закрепить удалённое сообщение', 'VALIDATION', 400);
      }

      const pinned = conversation.pinnedMessageIds ?? [];
      const next = pinned.includes(messageId) ? pinned : [messageId, ...pinned].slice(0, PINNED_MESSAGES_LIMIT);

      const pb = getPocketBase();
      const record = await pb.collection('conversations').update(conversationId, {
        pinnedMessageIds: next,
      });
      const updated = mapConversationRecord(record);
      const messages = await loadMessagesForConversations([conversationId]);
      chatRealtimeService.emit({ type: 'conversation.updated', conversationId, conversation: updated });
      return enrichConversation(updated, userId, messages, members);
    });
  },

  async unpinMessage(conversationId, messageId, userId) {
    return withPbError(async () => {
      const { user, conversation, members } = await assertConversationAccess(conversationId, userId);
      if (!canPinMessage(user, members, conversationId)) {
        throw new ApiError('Нет прав на открепление', 'FORBIDDEN', 403);
      }

      const next = (conversation.pinnedMessageIds ?? []).filter((id) => id !== messageId);
      const pb = getPocketBase();
      const record = await pb.collection('conversations').update(conversationId, {
        pinnedMessageIds: next,
      });
      const updated = mapConversationRecord(record);
      const messages = await loadMessagesForConversations([conversationId]);
      chatRealtimeService.emit({ type: 'conversation.updated', conversationId, conversation: updated });
      return enrichConversation(updated, userId, messages, members);
    });
  },

  async deleteConversation(conversationId, userId) {
    return withPbError(async () => {
      const { user, members } = await assertConversationAccess(conversationId, userId);
      if (!canDeleteConversation(user, conversationId, members)) {
        throw new ApiError('Нет прав на удаление чата', 'FORBIDDEN', 403);
      }
      const pb = getPocketBase();
      await pb.collection('conversations').delete(conversationId);
    });
  },

  async uploadAttachment(conversationId, userId, input: UploadAttachmentInput) {
    return withPbError(async () => {
      await assertConversationAccess(conversationId, userId);

      const err = validateAttachment({
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
      });
      if (err) throw new ApiError(err.message, err.code, 400);

      const type = detectAttachmentType(input.mimeType, input.filename);
      if (!type) throw new ApiError('Тип файла не поддерживается', 'UNSUPPORTED_TYPE', 400);

      if (!input.dataUrl) {
        throw new ApiError('Файл не передан', 'VALIDATION_ERROR', 400);
      }

      const stored = await uploadStoredFile({
        userId,
        purpose: 'chat',
        contextId: conversationId,
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        dataUrl: input.dataUrl,
      });

      const attachment: MessageAttachment = {
        id: uid('att'),
        type,
        filename: stored.filename,
        mimeType: stored.mimeType,
        size: stored.size,
        url: stored.url,
      };
      return attachment;
    });
  },

  async sendTyping(conversationId, userId, isTyping) {
    await withPbError(async () => {
      await assertConversationAccess(conversationId, userId);
    });
    chatRealtimeService.sendTyping(conversationId, userId, isTyping);
  },
};
