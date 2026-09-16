import type {
  Conversation,
  ConversationMember,
  Lesson,
  Message,
  MessageAttachment,
  MessageSearchResult,
  User,
} from '@/types';
import { can } from '@/permissions';
import { formatUserName } from '@/utils';
import { ApiError } from '@/services/api/types';
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
import {
  canAccessConversation,
  canAddMember,
  canCreateGroupChat,
  canCreatePersonalChat,
  canCreateSchoolWideChat,
  canDeleteConversation,
  canLeaveConversation,
  canRemoveMember,
  canSendToConversation,
  canUpdateConversation,
  getConversationMember,
  isMemberMuted,
  isValidTeacherStudentPersonalPair,
} from '@/services/chat/access';
import {
  computeUnreadCount,
  conversationPreviewFromMessage,
  getConversationDisplayTitle,
  isValidMessageText,
  matchesMessageSearch,
  normalizeMessageText,
  sortConversationsWithPins,
} from '@/services/chat/helpers';
import {
  canDeleteMessage,
  canDeleteMessageForMe,
  canEditMessage,
  canPinMessage,
  isMessageHiddenForUser,
  toggleReactionList,
  withUserHidden,
} from '@/services/chat/messages';
import {
  MESSAGE_MAX_LENGTH,
  MESSAGE_PAGE_SIZE,
  MESSAGE_SEARCH_MIN_LENGTH,
  SCHOOL_WIDE_CHAT_DEFAULT_TITLE,
} from '@/services/chat/constants';
import { detectAttachmentType, validateAttachment, validateMessageContent } from '@/services/chat/validation';
import { getAttachmentsPreviewLabel } from '@/services/chat/attachments';
import { chatRealtimeService } from '@/services/chat/realtime';
import { findConversationForLesson } from '@/services/lessons/helpers';
import { ensureSchoolWideMembership, isSchoolWideConversation } from '@/services/chat/schoolWide';
import {
  ensureAdminGroupMembership,
  withAdminsInParticipants,
} from '@/services/chat/adminGroups';

export interface MockChatDb {
  users: User[];
  lessons: Lesson[];
  conversations: Conversation[];
  conversationMembers: ConversationMember[];
  messages: Message[];
  notifications: {
    id: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
    link?: string;
  }[];
  openConversations: Map<string, string>;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createSystemMessage(
  conversationId: string,
  text: string,
  event: NonNullable<Message['metadata']>['system'],
): Message {
  const now = new Date().toISOString();
  return {
    id: uid('msg'),
    conversationId,
    senderId: 'system',
    text,
    createdAt: now,
    status: 'sent',
    readBy: [],
    messageType: 'system',
    metadata: { system: event },
  };
}

export function createMockChatApi(db: MockChatDb, delay: (ms?: number) => Promise<void>): ChatApi {
  function getUserById(userId: string): User {
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    return user;
  }

  function getConversationOrThrow(conversationId: string): Conversation {
    const conv = db.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new ApiError('Чат не найден', 'NOT_FOUND', 404);
    return conv;
  }

  function assertConversationAccess(conversationId: string, userId: string): Conversation {
    const user = getUserById(userId);
    const conv = getConversationOrThrow(conversationId);
    if (user.role === 'admin') {
      // Moderation / report deep-link: admin may open any chat by id (list stays membership-based).
      if (conv.type !== 'personal') {
        ensureAdminGroupMembership(db, userId);
      }
      return conv;
    }
    if (!canAccessConversation(user, conv, db.conversationMembers)) {
      throw new ApiError('Нет доступа к чату', 'FORBIDDEN', 403);
    }
    return conv;
  }

  function getMessageOrThrow(conversationId: string, messageId: string): Message {
    const msg = db.messages.find((m) => m.id === messageId && m.conversationId === conversationId);
    if (!msg) throw new ApiError('Сообщение не найдено', 'NOT_FOUND', 404);
    return msg;
  }

  function enrichConversation(conv: Conversation, userId: string): Conversation {
    const member = getConversationMember(conv.id, userId, db.conversationMembers);
    const convMessages = db.messages.filter(
      (m) =>
        m.conversationId === conv.id &&
        !m.deletedAt &&
        !isMessageHiddenForUser(m, userId),
    );
    const unreadCount = computeUnreadCount(conv.id, userId, convMessages, member);
    const lastFromScan = [...convMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);

    let lastMessage = conv.lastMessage;
    if (lastMessage) {
      const storedMsg = db.messages.find((m) => m.id === lastMessage!.id);
      if (
        storedMsg &&
        (storedMsg.deletedAt || isMessageHiddenForUser(storedMsg, userId))
      ) {
        lastMessage = undefined;
      }
    }
    if (!lastMessage && lastFromScan) {
      lastMessage = conversationPreviewFromMessage(lastFromScan);
    }

    return {
      ...conv,
      unreadCount,
      viewerPinnedAt: member?.pinnedAt ?? null,
      viewerMuted: member ? isMemberMuted(member) : false,
      lastMessage,
      lastMessageAt: lastMessage?.createdAt ?? conv.lastMessageAt,
      updatedAt: lastMessage?.createdAt ?? conv.updatedAt,
    };
  }

  function syncConversationMeta(conversationId: string) {
    const conv = db.conversations.find((c) => c.id === conversationId);
    if (!conv) return;
    const convMessages = db.messages
      .filter((m) => m.conversationId === conversationId && !m.deletedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = convMessages.at(-1);
    if (last) {
      conv.lastMessageAt = last.createdAt;
      conv.updatedAt = last.createdAt;
      conv.lastMessage = conversationPreviewFromMessage(last);
    } else {
      delete conv.lastMessage;
      delete conv.lastMessageAt;
    }
  }

  function createChatNotification(
    recipientId: string,
    sender: User,
    conversationId: string,
    preview: string,
  ) {
    db.notifications.unshift({
      id: uid('notif'),
      userId: recipientId,
      type: 'message',
      title: 'Новое сообщение',
      body: `${formatUserName(sender)}: ${preview.slice(0, 80)}`,
      read: false,
      createdAt: new Date().toISOString(),
      link: `/chat/${conversationId}`,
    });
    try {
      // Dynamic import avoids circular deps with notifications module.
      void import('./notifications').then(({ tryPushNotification }) => {
        tryPushNotification(
          db as never,
          recipientId,
          'message',
          'Новое сообщение',
          `${formatUserName(sender)}: ${preview.slice(0, 80)}`,
          `/chat/${conversationId}`,
        );
      });
    } catch {
      /* ignore push failures */
    }
  }

  function notifyMembers(conversationId: string, senderId: string, preview: string, suppress = false) {
    if (suppress) return;
    const sender = getUserById(senderId);
    for (const member of db.conversationMembers.filter((m) => m.conversationId === conversationId)) {
      if (member.userId === senderId || isMemberMuted(member)) continue;
      if (db.openConversations.get(member.userId) === conversationId) continue;
      createChatNotification(member.userId, sender, conversationId, preview);
    }
  }

  const api: ChatApi = {
    async getConversations(userId) {
      await delay();
      const user = getUserById(userId);
      if (!can(user, 'chat:read')) throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
      ensureSchoolWideMembership(db, userId);
      if (user.role === 'admin') {
        ensureAdminGroupMembership(db, userId);
      }
      const list = db.conversations
        .filter((c) => canAccessConversation(user, c, db.conversationMembers))
        .map((c) => enrichConversation(c, userId));
      return sortConversationsWithPins(list, db.conversationMembers, userId);
    },

    async getConversation(conversationId, userId) {
      await delay();
      const conv = assertConversationAccess(conversationId, userId);
      return enrichConversation(conv, userId);
    },

    async getConversationForLesson(lessonId, userId) {
      await delay();
      const user = getUserById(userId);
      if (!can(user, 'chat:read')) return null;

      const lesson = db.lessons.find((l) => l.id === lessonId);
      if (!lesson) return null;

      const conversation = findConversationForLesson(db.conversations, lesson);
      if (!conversation) return null;
      if (!canAccessConversation(user, conversation, db.conversationMembers)) return null;

      return enrichConversation(conversation, userId);
    },

    async getMessages(conversationId, userId, params: GetMessagesParams = {}) {
      await delay();
      assertConversationAccess(conversationId, userId);
      const limit = params.limit ?? MESSAGE_PAGE_SIZE;
      const sorted = db.messages
        .filter(
          (m) =>
            m.conversationId === conversationId &&
            !m.deletedAt &&
            !isMessageHiddenForUser(m, userId),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      let slice = sorted;
      if (params.cursor) {
        const cursorMsg = sorted.find((m) => m.id === params.cursor);
        if (cursorMsg) {
          slice = sorted.filter((m) => m.createdAt < cursorMsg.createdAt);
        }
      }

      const hasMore = slice.length > limit;
      const messages = slice.slice(-limit);
      const nextCursor = hasMore ? messages[0]?.id : undefined;
      return { messages, nextCursor, hasMore };
    },

    async getMessage(conversationId, messageId, userId) {
      await delay();
      assertConversationAccess(conversationId, userId);
      const msg = getMessageOrThrow(conversationId, messageId);
      if (isMessageHiddenForUser(msg, userId)) {
        throw new ApiError('Сообщение не найдено', 'NOT_FOUND', 404);
      }
      return msg;
    },

    async sendMessage(conversationId, userId, text, options: SendMessageOptions = {}) {
      await delay(100);
      const user = getUserById(userId);
      const conv = assertConversationAccess(conversationId, userId);
      if (!canSendToConversation(user, conv, db.conversationMembers)) {
        throw new ApiError('Нет доступа к чату', 'FORBIDDEN', 403);
      }

      if (options.clientMutationId) {
        const dup = db.messages.find(
          (m) =>
            m.clientMutationId === options.clientMutationId &&
            m.senderId === userId &&
            m.conversationId === conversationId,
        );
        if (dup) return dup;
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
        const replyTarget = db.messages.find(
          (m) => m.id === options.replyToMessageId && m.conversationId === conversationId,
        );
        if (!replyTarget) {
          throw new ApiError('Сообщение для ответа не найдено', 'NOT_FOUND', 404);
        }
      }

      const now = new Date().toISOString();
      const msg: Message = {
        id: uid('msg'),
        conversationId,
        senderId: userId,
        text: normalized,
        createdAt: now,
        status: 'sent',
        readBy: [userId],
        clientMutationId: options.clientMutationId,
        replyToMessageId: options.replyToMessageId,
        attachments: attachments.length > 0 ? attachments : undefined,
        messageType: 'user',
      };
      db.messages.push(msg);
      syncConversationMeta(conversationId);

      const senderMember = getConversationMember(conversationId, userId, db.conversationMembers);
      if (senderMember) {
        senderMember.lastReadMessageId = msg.id;
        senderMember.lastReadAt = now;
      }

      const preview =
        normalized || getAttachmentsPreviewLabel(attachments);
      notifyMembers(conversationId, userId, preview, options.suppressNotification);

      chatRealtimeService.emit({ type: 'message.created', conversationId, message: msg });
      return msg;
    },

    async editMessage(conversationId, messageId, userId, input: EditMessageInput) {
      await delay(80);
      const user = getUserById(userId);
      assertConversationAccess(conversationId, userId);
      const msg = getMessageOrThrow(conversationId, messageId);

      if (!canEditMessage(user, msg)) {
        throw new ApiError('Нет прав на редактирование', 'FORBIDDEN', 403);
      }

      const normalized = normalizeMessageText(input.text);
      if (!isValidMessageText(normalized, MESSAGE_MAX_LENGTH)) {
        throw new ApiError('Некорректное сообщение', 'VALIDATION', 400);
      }

      const now = new Date().toISOString();
      msg.text = normalized;
      msg.updatedAt = now;
      msg.editedAt = now;
      syncConversationMeta(conversationId);

      chatRealtimeService.emit({ type: 'message.updated', conversationId, message: msg });
      return msg;
    },

    async deleteMessage(conversationId, messageId, userId, options) {
      await delay(80);
      const user = getUserById(userId);
      const conv = assertConversationAccess(conversationId, userId);
      const msg = getMessageOrThrow(conversationId, messageId);
      const scope = options?.scope ?? 'everyone';

      if (scope === 'me') {
        if (!canDeleteMessageForMe(user, msg, conv, db.conversationMembers)) {
          throw new ApiError('Нет прав на удаление', 'FORBIDDEN', 403);
        }
        const updated = withUserHidden(msg, userId);
        const idx = db.messages.findIndex((m) => m.id === messageId);
        if (idx >= 0) db.messages[idx] = updated;
        chatRealtimeService.emit({ type: 'message.updated', conversationId, message: updated });
        return updated;
      }

      if (!canDeleteMessage(user, msg, conv)) {
        throw new ApiError('Нет прав на удаление', 'FORBIDDEN', 403);
      }

      const snapshot = { ...msg, deletedAt: new Date().toISOString() };
      db.messages = db.messages.filter((m) => m.id !== messageId);
      if (conv.pinnedMessageIds?.includes(messageId)) {
        conv.pinnedMessageIds = conv.pinnedMessageIds.filter((id) => id !== messageId);
      }
      syncConversationMeta(conversationId);

      chatRealtimeService.emit({ type: 'message.deleted', conversationId, message: snapshot });
      return snapshot;
    },

    async pinConversation(conversationId, userId, pinned) {
      await delay(50);
      assertConversationAccess(conversationId, userId);
      const member = getConversationMember(conversationId, userId, db.conversationMembers);
      if (!member) throw new ApiError('Участник не найден', 'NOT_FOUND', 404);
      member.pinnedAt = pinned ? new Date().toISOString() : null;
      return member;
    },

    async setMessageReaction(conversationId, messageId, userId, emoji) {
      await delay(50);
      assertConversationAccess(conversationId, userId);
      const msg = getMessageOrThrow(conversationId, messageId);
      if (msg.deletedAt) throw new ApiError('Сообщение удалено', 'NOT_FOUND', 404);
      const next = toggleReactionList(msg.reactions ?? [], emoji, userId);
      msg.reactions = next;
      msg.metadata = { ...msg.metadata, reactions: next };
      msg.updatedAt = new Date().toISOString();
      chatRealtimeService.emit({ type: 'message.updated', conversationId, message: msg });
      return msg;
    },

    async forwardMessage(sourceConversationId, messageId, userId, targetConversationIds) {
      await delay(100);
      const user = getUserById(userId);
      assertConversationAccess(sourceConversationId, userId);
      const source = getMessageOrThrow(sourceConversationId, messageId);
      if (source.deletedAt) throw new ApiError('Сообщение удалено', 'NOT_FOUND', 404);

      const created: Message[] = [];
      for (const targetId of targetConversationIds) {
        const conv = assertConversationAccess(targetId, userId);
        if (!canSendToConversation(user, conv, db.conversationMembers)) {
          throw new ApiError('Нет доступа к чату', 'FORBIDDEN', 403);
        }
        const forwarded = await api.sendMessage(targetId, userId, source.text, {
          attachments: source.attachments,
          suppressNotification: false,
        });
        created.push(forwarded);
      }
      return created;
    },

    async markAsRead(conversationId, userId) {
      await delay(50);
      assertConversationAccess(conversationId, userId);
      const member = getConversationMember(conversationId, userId, db.conversationMembers);
      const convMessages = db.messages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const last = convMessages.at(-1);
      const now = new Date().toISOString();

      if (member && last) {
        member.lastReadMessageId = last.id;
        member.lastReadAt = now;
      }

      db.messages
        .filter((m) => m.conversationId === conversationId)
        .forEach((m) => {
          if (!m.readBy.includes(userId)) m.readBy.push(userId);
          if (m.senderId !== userId) m.status = 'read';
        });

      chatRealtimeService.emit({ type: 'message.read', conversationId, userId });
    },

    async setOpenConversation(userId, conversationId) {
      await delay(0);
      if (conversationId) {
        db.openConversations.set(userId, conversationId);
      } else {
        db.openConversations.delete(userId);
      }
    },

    async createConversation(userId, input: CreateConversationInput) {
      await delay(120);
      const user = getUserById(userId);

      let uniqueParticipants: string[];
      if (input.allUsers) {
        if (input.type === 'personal') {
          throw new ApiError('Общий чат не может быть личным', 'VALIDATION', 400);
        }
        if (!canCreateSchoolWideChat(user)) {
          throw new ApiError('Нет прав на создание общего чата', 'FORBIDDEN', 403);
        }
        const fromClient = input.participantIds ?? [];
        uniqueParticipants =
          fromClient.length > 0
            ? [...new Set([userId, ...fromClient])]
            : [...new Set(db.users.map((u) => u.id))];
        if (!uniqueParticipants.includes(userId)) {
          uniqueParticipants.push(userId);
        }
      } else {
        uniqueParticipants = [...new Set([userId, ...input.participantIds])];
        if (uniqueParticipants.length < 2) {
          throw new ApiError('Укажите участников', 'VALIDATION', 400);
        }
      }

      if (input.type === 'personal') {
        if (!canCreatePersonalChat(user)) {
          throw new ApiError('Нет прав на создание чата', 'FORBIDDEN', 403);
        }
        if (uniqueParticipants.length !== 2) {
          throw new ApiError('Личный чат — только два участника', 'VALIDATION', 400);
        }
        const pair = uniqueParticipants.map((id) => getUserById(id));
        if (!isValidTeacherStudentPersonalPair(pair)) {
          throw new ApiError('Личный чат только между преподавателем и учеником', 'VALIDATION', 400);
        }
        const existing = db.conversations.find((c) => {
          if (c.type !== 'personal') return false;
          const ids = new Set(c.participantIds);
          return uniqueParticipants.every((id) => ids.has(id)) && ids.size === 2;
        });
        if (existing) {
          if (input.metadata?.lessonId) {
            existing.metadata = { ...existing.metadata, ...input.metadata };
          }
          return enrichConversation(existing, userId);
        }
      } else {
        if (!input.allUsers && !canCreateGroupChat(user)) {
          throw new ApiError('Нет прав на создание группы', 'FORBIDDEN', 403);
        }
        if (!input.allUsers) {
          const title = input.title?.trim();
          if (!title) throw new ApiError('Укажите название группы', 'VALIDATION', 400);
        }
        // Admin is always a participant of every group chat.
        uniqueParticipants = withAdminsInParticipants(uniqueParticipants, db.users);
      }

      const now = new Date().toISOString();
      const otherUser = db.users.find((u) => u.id === uniqueParticipants.find((id) => id !== userId));
      const title =
        input.type === 'personal'
          ? otherUser
            ? formatUserName(otherUser)
            : 'Личный чат'
          : input.allUsers
            ? input.title?.trim() || SCHOOL_WIDE_CHAT_DEFAULT_TITLE
            : input.title!.trim();

      const conv: Conversation = {
        id: uid('conv'),
        type: input.type,
        title,
        participantIds: uniqueParticipants,
        createdAt: now,
        updatedAt: now,
        metadata: {
          ...input.metadata,
          ...(input.allUsers ? { schoolWide: true as const } : {}),
        },
        unreadCount: 0,
        pinnedMessageIds: [],
      };
      if (!conv.metadata?.lessonId && !conv.metadata?.schoolWide) {
        delete conv.metadata;
      }
      if (input.avatarUrl?.trim()) {
        conv.avatarUrl = input.avatarUrl.trim();
      }
      db.conversations.push(conv);

      uniqueParticipants.forEach((pid) => {
        db.conversationMembers.push({
          conversationId: conv.id,
          userId: pid,
          role: pid === userId ? 'owner' : 'member',
          joinedAt: now,
          muted: false,
        });
      });

      chatRealtimeService.emit({ type: 'conversation.updated', conversationId: conv.id, conversation: conv });
      return enrichConversation(conv, userId);
    },

    async getTotalUnread(userId) {
      await delay(30);
      const conversations = await api.getConversations(userId);
      return conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
    },

    async searchMessages(userId, query) {
      await delay(80);
      const user = getUserById(userId);
      if (!can(user, 'chat:read')) throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
      const q = query.trim();
      if (q.length < MESSAGE_SEARCH_MIN_LENGTH) return [];

      const conversations = db.conversations.filter((c) =>
        canAccessConversation(user, c, db.conversationMembers),
      );
      const convIds = new Set(conversations.map((c) => c.id));

      const results: MessageSearchResult[] = [];
      for (const msg of db.messages) {
        if (!convIds.has(msg.conversationId)) continue;
        if (isMessageHiddenForUser(msg, userId)) continue;
        if (!matchesMessageSearch(msg, q)) continue;
        const conv = conversations.find((c) => c.id === msg.conversationId)!;
        const sender = db.users.find((u) => u.id === msg.senderId);
        results.push({
          message: msg,
          conversationId: conv.id,
          conversationTitle: getConversationDisplayTitle(conv, userId, db.users),
          senderName: sender ? formatUserName(sender) : 'Неизвестный',
        });
      }

      return results.sort((a, b) => b.message.createdAt.localeCompare(a.message.createdAt)).slice(0, 50);
    },

    async getMembers(conversationId, userId) {
      await delay();
      assertConversationAccess(conversationId, userId);
      return db.conversationMembers.filter((m) => m.conversationId === conversationId);
    },

    async addMember(conversationId, userId, targetUserId) {
      const [member] = await api.addMembers(conversationId, userId, [targetUserId]);
      if (!member) {
        throw new ApiError('Участник уже в чате', 'VALIDATION', 400);
      }
      return member;
    },

    async addMembers(conversationId, userId, targetUserIds) {
      await delay(80);
      const uniqueIds = [...new Set(targetUserIds.filter(Boolean))];
      if (uniqueIds.length === 0) return [];

      const user = getUserById(userId);
      assertConversationAccess(conversationId, userId);
      const conv = getConversationOrThrow(conversationId);
      if (!canAddMember(user, conversationId, db.conversationMembers, conv)) {
        throw new ApiError('Нет прав на управление участниками', 'FORBIDDEN', 403);
      }

      if (conv.type === 'personal') {
        throw new ApiError('Нельзя добавить участника в личный чат', 'VALIDATION', 400);
      }
      if (isSchoolWideConversation(conv)) {
        throw new ApiError('В общем чате нельзя управлять участниками', 'FORBIDDEN', 403);
      }

      const toAdd = uniqueIds.filter(
        (id) => !getConversationMember(conversationId, id, db.conversationMembers),
      );
      if (toAdd.length === 0) {
        if (uniqueIds.length === 1) {
          throw new ApiError('Участник уже в чате', 'VALIDATION', 400);
        }
        return [];
      }

      const now = new Date().toISOString();
      const actor = getUserById(userId);
      const added: ConversationMember[] = [];

      for (const targetUserId of toAdd) {
        const target = getUserById(targetUserId);
        const member: ConversationMember = {
          conversationId,
          userId: targetUserId,
          role: 'member',
          joinedAt: now,
          muted: false,
        };
        db.conversationMembers.push(member);
        added.push(member);

        const sysMsg = createSystemMessage(
          conv.id,
          `${formatUserName(actor)} добавил ${formatUserName(target)}`,
          {
            event: 'member_added',
            actorId: userId,
            targetUserId,
          },
        );
        db.messages.push(sysMsg);
        chatRealtimeService.emit({ type: 'member.joined', conversationId, userId: targetUserId });
      }

      conv.participantIds = [...new Set([...conv.participantIds, ...toAdd])];
      return added;
    },

    async removeMember(conversationId, userId, targetUserId) {
      await delay(80);
      const user = getUserById(userId);
      assertConversationAccess(conversationId, userId);
      const conv = getConversationOrThrow(conversationId);
      if (!canRemoveMember(user, conversationId, targetUserId, db.conversationMembers, conv)) {
        throw new ApiError('Нет прав на удаление участника', 'FORBIDDEN', 403);
      }
      if (isSchoolWideConversation(conv)) {
        throw new ApiError('В общем чате нельзя управлять участниками', 'FORBIDDEN', 403);
      }
      db.conversationMembers = db.conversationMembers.filter(
        (m) => !(m.conversationId === conversationId && m.userId === targetUserId),
      );
      conv.participantIds = conv.participantIds.filter((id) => id !== targetUserId);

      const target = getUserById(targetUserId);
      const actor = getUserById(userId);
      const sysMsg = createSystemMessage(conv.id, `${formatUserName(actor)} удалил ${formatUserName(target)}`, {
        event: 'member_removed',
        actorId: userId,
        targetUserId,
      });
      db.messages.push(sysMsg);

      chatRealtimeService.emit({ type: 'member.left', conversationId, userId: targetUserId });
    },

    async leaveConversation(conversationId, userId) {
      await delay(80);
      const user = getUserById(userId);
      const conv = assertConversationAccess(conversationId, userId);
      if (!canLeaveConversation(user, conv, db.conversationMembers)) {
        throw new ApiError('Нельзя покинуть этот чат', 'FORBIDDEN', 403);
      }

      db.conversationMembers = db.conversationMembers.filter(
        (m) => !(m.conversationId === conversationId && m.userId === userId),
      );
      conv.participantIds = conv.participantIds.filter((id) => id !== userId);

      const sysMsg = createSystemMessage(conv.id, `${formatUserName(user)} покинул чат`, {
        event: 'member_left',
        actorId: userId,
      });
      db.messages.push(sysMsg);

      chatRealtimeService.emit({ type: 'member.left', conversationId, userId });
    },

    async updateConversation(conversationId, userId, input: UpdateConversationInput) {
      await delay(80);
      const user = getUserById(userId);
      const conv = assertConversationAccess(conversationId, userId);
      if (!canUpdateConversation(user, conversationId, db.conversationMembers)) {
        throw new ApiError('Нет прав на изменение чата', 'FORBIDDEN', 403);
      }

      const previousTitle = conv.title;
      if (input.title?.trim()) conv.title = input.title.trim();
      if (input.avatarUrl !== undefined) {
        if (input.avatarUrl.trim()) conv.avatarUrl = input.avatarUrl.trim();
        else delete conv.avatarUrl;
      }
      conv.updatedAt = new Date().toISOString();

      if (input.title && input.title.trim() !== previousTitle) {
        const sysMsg = createSystemMessage(conv.id, `Название группы изменено на «${conv.title}»`, {
          event: 'title_changed',
          actorId: userId,
          previousTitle,
          newTitle: conv.title,
        });
        db.messages.push(sysMsg);
      }

      chatRealtimeService.emit({ type: 'conversation.updated', conversationId, conversation: conv });
      return enrichConversation(conv, userId);
    },

    async muteConversation(conversationId, userId, input: MuteConversationInput) {
      await delay(50);
      assertConversationAccess(conversationId, userId);
      const member = getConversationMember(conversationId, userId, db.conversationMembers);
      if (!member) throw new ApiError('Участник не найден', 'NOT_FOUND', 404);

      member.muted = input.muted;
      member.mutedUntil = input.mutedUntil ?? null;
      return member;
    },

    async pinMessage(conversationId, messageId, userId) {
      await delay(50);
      const user = getUserById(userId);
      assertConversationAccess(conversationId, userId);
      const msg = getMessageOrThrow(conversationId, messageId);

      if (!canPinMessage(user, db.conversationMembers, conversationId)) {
        throw new ApiError('Нет прав на закрепление', 'FORBIDDEN', 403);
      }
      if (msg.deletedAt) {
        throw new ApiError('Нельзя закрепить удалённое сообщение', 'VALIDATION', 400);
      }

      const conv = getConversationOrThrow(conversationId);
      const pinned = conv.pinnedMessageIds ?? [];
      if (!pinned.includes(messageId)) {
        conv.pinnedMessageIds = [messageId, ...pinned].slice(0, 5);
      }

      chatRealtimeService.emit({ type: 'conversation.updated', conversationId, conversation: conv });
      return enrichConversation(conv, userId);
    },

    async unpinMessage(conversationId, messageId, userId) {
      await delay(50);
      const user = getUserById(userId);
      assertConversationAccess(conversationId, userId);

      if (!canPinMessage(user, db.conversationMembers, conversationId)) {
        throw new ApiError('Нет прав на открепление', 'FORBIDDEN', 403);
      }

      const conv = getConversationOrThrow(conversationId);
      conv.pinnedMessageIds = (conv.pinnedMessageIds ?? []).filter((id) => id !== messageId);

      chatRealtimeService.emit({ type: 'conversation.updated', conversationId, conversation: conv });
      return enrichConversation(conv, userId);
    },

    async deleteConversation(conversationId, userId) {
      await delay(80);
      const user = getUserById(userId);
      assertConversationAccess(conversationId, userId);
      if (!canDeleteConversation(user, conversationId, db.conversationMembers)) {
        throw new ApiError('Нет прав на удаление чата', 'FORBIDDEN', 403);
      }

      db.conversations = db.conversations.filter((c) => c.id !== conversationId);
      db.conversationMembers = db.conversationMembers.filter((m) => m.conversationId !== conversationId);
      db.messages = db.messages.filter((m) => m.conversationId !== conversationId);
    },

    async uploadAttachment(conversationId, userId, input: UploadAttachmentInput) {
      await delay(150);
      assertConversationAccess(conversationId, userId);

      const err = validateAttachment({
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
      });
      if (err) throw new ApiError(err.message, err.code, 400);

      const type = detectAttachmentType(input.mimeType, input.filename);
      if (!type) throw new ApiError('Тип файла не поддерживается', 'UNSUPPORTED_TYPE', 400);

      const attachment: MessageAttachment = {
        id: uid('att'),
        type,
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        url: input.dataUrl ?? `mock://attachments/${uid('file')}`,
        ...(input.kind ? { kind: input.kind } : {}),
      };
      return attachment;
    },

    async sendTyping(conversationId, userId, isTyping) {
      await delay(0);
      assertConversationAccess(conversationId, userId);
      chatRealtimeService.sendTyping(conversationId, userId, isTyping);
    },
  };

  return api;
}
