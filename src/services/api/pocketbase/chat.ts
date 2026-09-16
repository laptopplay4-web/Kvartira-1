import { ClientResponseError, type RecordModel } from 'pocketbase';
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
import { getRequesterUser } from '@/services/api/pocketbase/requester';
import { isSchoolWideConversation } from '@/services/chat/schoolWide';
import { compareIsoDates } from '@/utils/dates';
import {
  deleteStoredFiles,
  isStoredFileRef,
  linkStoredFilesToContext,
  parseStoredFileRef,
  resolveConversationAvatars,
  resolveMessage,
  resolveMessages,
  resolveStoredFileUrl,
  uploadStoredFile,
} from '@/services/api/pocketbase/files';
import { can } from '@/permissions';
import { formatUserName } from '@/utils';
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
  getLocalPinnedAtMap,
  setLocalConversationPinned,
} from '@/services/chat/listPins';
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

/** Join current user into school-wide chats they are not yet in (idempotent). */
async function ensureSchoolWideMembershipPb(userId: string, conversations: Conversation[]): Promise<void> {
  const pb = getPocketBase();
  const members = await loadUserMembers(userId);
  for (const conv of conversations) {
    if (!isSchoolWideConversation(conv)) continue;
    if (members.some((m) => m.conversationId === conv.id && m.userId === userId)) continue;
    try {
      await pb.collection('conversation_members').create({
        conversation: conv.id,
        user: userId,
        role: 'member',
        muted: false,
      });
      if (!conv.participantIds.includes(userId)) {
        const nextIds = [...conv.participantIds, userId];
        await pb.collection('conversations').update(conv.id, { participantIds: nextIds });
        conv.participantIds = nextIds;
      }
    } catch {
      /* race / already member — ignore */
    }
  }
}

/** Join admin into every non-personal chat (idempotent). */
async function ensureAdminGroupMembershipPb(
  userId: string,
  conversations: Conversation[],
): Promise<void> {
  const pb = getPocketBase();
  const members = await loadUserMembers(userId);
  for (const conv of conversations) {
    if (conv.type === 'personal') continue;
    if (members.some((m) => m.conversationId === conv.id && m.userId === userId)) continue;
    try {
      await pb.collection('conversation_members').create({
        conversation: conv.id,
        user: userId,
        role: 'member',
        muted: false,
      });
      if (!conv.participantIds.includes(userId)) {
        const nextIds = [...conv.participantIds, userId];
        await pb.collection('conversations').update(conv.id, { participantIds: nextIds });
        conv.participantIds = nextIds;
      }
      members.push({
        conversationId: conv.id,
        userId,
        role: 'member',
        joinedAt: new Date().toISOString(),
        muted: false,
      });
    } catch {
      /* race / already member — ignore */
    }
  }
}

/**
 * PocketBase filter for messages that may count as unread for `userId`.
 * Does not load full history — only candidates after each membership lastReadAt.
 */
export function buildUnreadCandidateFilter(
  conversationIds: string[],
  userId: string,
  members: ConversationMember[],
): string {
  if (conversationIds.length === 0) return '';

  const memberByConv = new Map<string, ConversationMember>();
  for (const m of members) {
    if (m.userId === userId) memberByConv.set(m.conversationId, m);
  }

  const clauses = conversationIds.map((id) => {
    const member = memberByConv.get(id);
    const base = `conversation = "${escapePbFilter(id)}"`;
    if (member?.lastReadAt) {
      return `(${base} && created > "${escapePbFilter(member.lastReadAt)}")`;
    }
    return `(${base})`;
  });

  return `(${clauses.join(' || ')}) && sender != "${escapePbFilter(userId)}" && messageType != "system"`;
}

const UNREAD_CANDIDATE_CONV_CHUNK = 30;

async function loadUnreadCandidateMessages(
  conversationIds: string[],
  userId: string,
  members: ConversationMember[],
): Promise<Message[]> {
  if (conversationIds.length === 0) return [];
  const pb = getPocketBase();
  const out: Message[] = [];

  for (let i = 0; i < conversationIds.length; i += UNREAD_CANDIDATE_CONV_CHUNK) {
    const chunk = conversationIds.slice(i, i + UNREAD_CANDIDATE_CONV_CHUNK);
    const filter = buildUnreadCandidateFilter(chunk, userId, members);
    if (!filter) continue;
    const records = await pb.collection('messages').getFullList({ filter });
    out.push(...records.map(mapMessageRecord));
  }

  return out;
}

async function loadMessagesByIds(ids: string[]): Promise<Message[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const pb = getPocketBase();
  const out: Message[] = [];
  for (let i = 0; i < unique.length; i += UNREAD_CANDIDATE_CONV_CHUNK) {
    const chunk = unique.slice(i, i + UNREAD_CANDIDATE_CONV_CHUNK);
    const filter = pbEqOr('id', chunk);
    if (!filter) continue;
    const records = await pb.collection('messages').getFullList({ filter });
    out.push(...records.map(mapMessageRecord));
  }
  return out;
}

/** Recent messages for rare cases (e.g. last preview hidden for viewer). */
async function loadRecentMessagesForConversations(
  conversationIds: string[],
  limit = 40,
): Promise<Message[]> {
  if (conversationIds.length === 0) return [];
  const pb = getPocketBase();
  const out: Message[] = [];
  for (const id of conversationIds) {
    const result = await pb.collection('messages').getList(1, limit, {
      filter: `conversation = "${escapePbFilter(id)}"`,
      sort: '-created,-id',
    });
    out.push(...result.items.map(mapMessageRecord));
  }
  return out;
}

/**
 * Unread candidates + lastMessage rows (+ recent fallback when last is hidden for viewer).
 */
async function loadMessagesForConversationEnrichment(
  conversations: Conversation[],
  userId: string,
  members: ConversationMember[],
): Promise<Message[]> {
  const conversationIds = conversations.map((c) => c.id);
  const unread = await loadUnreadCandidateMessages(conversationIds, userId, members);
  const byId = new Map(unread.map((m) => [m.id, m]));

  const lastIds = conversations
    .map((c) => c.lastMessage?.id)
    .filter((id): id is string => !!id && !byId.has(id));
  const previewRows = await loadMessagesByIds(lastIds);
  for (const m of previewRows) byId.set(m.id, m);

  const needRecent: string[] = [];
  for (const conv of conversations) {
    if (!conv.lastMessage) continue;
    const msg = byId.get(conv.lastMessage.id);
    if (msg && (msg.deletedAt || isMessageHiddenForUser(msg, userId))) {
      needRecent.push(conv.id);
    }
  }
  if (needRecent.length > 0) {
    const recent = await loadRecentMessagesForConversations(needRecent);
    for (const m of recent) byId.set(m.id, m);
  }

  return [...byId.values()];
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

function isPbUniqueViolation(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return false;
  if (error.status === 409) return true;
  const raw =
    typeof error.response?.message === 'string' ? error.response.message : error.message;
  if (/unique|not unique|duplicate/i.test(raw)) return true;
  const data = error.response?.data;
  if (data && typeof data === 'object') {
    for (const field of Object.values(data as Record<string, unknown>)) {
      if (!field || typeof field !== 'object') continue;
      const code = String((field as { code?: string }).code ?? '');
      const message = String((field as { message?: string }).message ?? '');
      if (/unique/i.test(code) || /unique/i.test(message)) return true;
    }
  }
  return false;
}

function memberRoleFromRecord(record: RecordModel): string {
  const withGet = record as RecordModel & { get?: (key: string) => unknown; getString?: (key: string) => string };
  if (typeof withGet.getString === 'function') {
    try {
      return withGet.getString('role') || '';
    } catch {
      /* fall through */
    }
  }
  return String((record as { role?: unknown }).role ?? '');
}

/**
 * Create membership idempotently — races with joinAdmins hooks (idx_conv_member).
 * Promotes to owner when needed.
 */
async function ensureConversationMember(
  conversationId: string,
  userId: string,
  role: 'owner' | 'admin' | 'member',
): Promise<void> {
  const pb = getPocketBase();
  const existing = await findMemberRecord(conversationId, userId);
  if (existing) {
    if (role === 'owner' && memberRoleFromRecord(existing) !== 'owner') {
      await pb.collection('conversation_members').update(existing.id, { role: 'owner' });
    }
    return;
  }
  try {
    await pb.collection('conversation_members').create({
      conversation: conversationId,
      user: userId,
      role,
    });
  } catch (error) {
    if (isPbUniqueViolation(error)) {
      if (role === 'owner') {
        const raced = await findMemberRecord(conversationId, userId);
        if (raced && memberRoleFromRecord(raced) !== 'owner') {
          await pb.collection('conversation_members').update(raced.id, { role: 'owner' });
        }
      }
      return;
    }
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
  if (user.role === 'admin') {
    // Moderation / report deep-link: admin may open any chat by id (list stays membership-based).
    if (conversation.type !== 'personal') {
      await ensureAdminGroupMembershipPb(userId, [conversation]);
    }
    const members = await loadMembers(conversationId);
    return { user, conversation, members };
  }
  const members = await loadMembers(conversationId);
  if (!canAccessConversation(user, conversation, members)) {
    throw new ApiError('Нет доступа к чату', 'FORBIDDEN', 403);
  }
  return { user, conversation, members };
}

/**
 * Enrich list/detail conversation row.
 * `messages` should be unread candidates (+ lastMessage rows), not full history.
 * Preview uses stored `lastMessage` when visible; falls back to scanned messages.
 */
function enrichConversation(
  conv: Conversation,
  userId: string,
  messages: Message[],
  members: ConversationMember[],
): Conversation {
  const member = getConversationMember(conv.id, userId, members);
  const convMessages = messages.filter(
    (m) =>
      m.conversationId === conv.id &&
      !m.deletedAt &&
      !isMessageHiddenForUser(m, userId),
  );
  const unreadCount = computeUnreadCount(conv.id, userId, convMessages, member);
  const localPinAt = getLocalPinnedAtMap(userId);
  const viewerPinnedAt = member?.pinnedAt ?? localPinAt.get(conv.id) ?? null;

  let lastMessage = conv.lastMessage;
  if (lastMessage) {
    const storedMsg = messages.find((m) => m.id === lastMessage!.id);
    if (storedMsg && (storedMsg.deletedAt || isMessageHiddenForUser(storedMsg, userId))) {
      lastMessage = undefined;
    }
  }
  if (!lastMessage && convMessages.length > 0) {
    const last = [...convMessages]
      .sort((a, b) => compareIsoDates(a.createdAt, b.createdAt))
      .at(-1)!;
    lastMessage = conversationPreviewFromMessage(last);
  }

  const lastMessageAt = lastMessage?.createdAt ?? conv.lastMessageAt;

  return {
    ...conv,
    participantIds: [...new Set(conv.participantIds)],
    unreadCount,
    viewerPinnedAt,
    viewerMuted: member ? isMemberMuted(member) : false,
    lastMessage,
    lastMessageAt,
    updatedAt: lastMessageAt ?? conv.updatedAt,
  };
}

async function resolveConversationAvatar(conv: Conversation): Promise<Conversation> {
  const [resolved] = await resolveConversationAvatars([conv]);
  return resolved ?? conv;
}

function isPbUrlFieldError(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return false;
  const data = error.response?.data;
  if (!data || typeof data !== 'object') return false;
  const avatar = (data as Record<string, unknown>).avatarUrl;
  if (!avatar || typeof avatar !== 'object') return false;
  const message = String((avatar as { message?: string }).message ?? '');
  return /valid url/i.test(message);
}

async function persistConversationAvatar(
  userId: string,
  dataUrlOrEmpty: string,
  previousUrl?: string,
  contextId?: string,
): Promise<string | undefined> {
  const trimmed = dataUrlOrEmpty.trim();
  if (!trimmed) {
    await deleteStoredFiles(previousUrl);
    return '';
  }
  if (!trimmed.startsWith('data:')) {
    return trimmed;
  }
  const uploaded = await uploadStoredFile({
    userId,
    purpose: 'chat',
    contextId,
    filename: 'chat-avatar.jpg',
    mimeType: 'image/jpeg',
    size: Math.ceil((trimmed.length * 3) / 4),
    dataUrl: trimmed,
  });
  if (previousUrl && previousUrl !== uploaded.url) {
    await deleteStoredFiles(previousUrl);
  }
  return uploaded.url;
}

/** Prefer pbfile: ref; fall back to signed URL when schema still has avatarUrl type=url. */
async function resolveAvatarValueForPbWrite(avatarRef: string): Promise<{ primary: string; fallback?: string }> {
  if (!isStoredFileRef(avatarRef)) {
    return { primary: avatarRef };
  }
  const signed = await resolveStoredFileUrl(avatarRef);
  return { primary: avatarRef, fallback: signed && signed !== avatarRef ? signed : undefined };
}

async function createConversationWithAvatar(
  base: Record<string, unknown>,
  avatarRef?: string,
): Promise<RecordModel> {
  const pb = getPocketBase();
  if (!avatarRef) {
    return pb.collection('conversations').create(base);
  }
  const { primary, fallback } = await resolveAvatarValueForPbWrite(avatarRef);
  try {
    return await pb.collection('conversations').create({ ...base, avatarUrl: primary });
  } catch (error) {
    if (!fallback || !isPbUrlFieldError(error)) throw error;
    return pb.collection('conversations').create({ ...base, avatarUrl: fallback });
  }
}

async function updateConversationWithAvatar(
  conversationId: string,
  body: Record<string, unknown>,
): Promise<RecordModel> {
  const pb = getPocketBase();
  if (body.avatarUrl === undefined || body.avatarUrl === '' || typeof body.avatarUrl !== 'string') {
    return pb.collection('conversations').update(conversationId, body);
  }
  const avatarRef = body.avatarUrl;
  const { primary, fallback } = await resolveAvatarValueForPbWrite(avatarRef);
  try {
    return await pb.collection('conversations').update(conversationId, { ...body, avatarUrl: primary });
  } catch (error) {
    if (!fallback || !isPbUrlFieldError(error)) throw error;
    return pb.collection('conversations').update(conversationId, { ...body, avatarUrl: fallback });
  }
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
  // System lines have no attachments — skip file resolve.
  const message = mapMessageRecord(record);
  chatRealtimeService.emit({ type: 'message.created', conversationId, message });
  return message;
}

async function updateParticipantIds(conversationId: string, participantIds: string[]): Promise<void> {
  const pb = getPocketBase();
  await pb.collection('conversations').update(conversationId, { participantIds });
}

/** Source of truth for roster = conversation_members; heal bloated/stale participantIds JSON. */
async function reconcileParticipantIds(
  conversation: Conversation,
  members: ConversationMember[],
): Promise<Conversation> {
  if (isSchoolWideConversation(conversation)) return conversation;
  const fromMembers = [...new Set(members.map((m) => m.userId))];
  const current = [...new Set(conversation.participantIds)];
  const same =
    fromMembers.length === current.length && fromMembers.every((id) => current.includes(id));
  if (same) {
    return fromMembers.length === conversation.participantIds.length
      ? conversation
      : { ...conversation, participantIds: fromMembers };
  }
  try {
    await updateParticipantIds(conversation.id, fromMembers);
  } catch {
    /* best-effort heal — still return corrected view */
  }
  return { ...conversation, participantIds: fromMembers };
}

/** Cascade may be missing on live DB — purge dependents before conversation delete. */
async function purgeConversationDependents(conversationId: string): Promise<void> {
  const pb = getPocketBase();
  const filter = `conversation = "${escapePbFilter(conversationId)}"`;

  const deleteRows = async (collection: string) => {
    try {
      const rows = await pb.collection(collection).getFullList({ filter });
      await Promise.all(
        rows.map(async (row) => {
          try {
            await pb.collection(collection).delete(row.id);
          } catch {
            /* already gone / cascade */
          }
        }),
      );
    } catch {
      /* list may fail; conversation delete still attempted */
    }
  };

  // Messages first (no FK to members), then memberships.
  await deleteRows('messages');
  await deleteRows('conversation_members');
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
      await ensureSchoolWideMembershipPb(userId, conversations);
      if (user.role === 'admin') {
        await ensureAdminGroupMembershipPb(userId, conversations);
      }
      const userMembers = await loadUserMembers(userId);
      const accessible = conversations.filter((c) => canAccessConversation(user, c, userMembers));
      const messages = await loadMessagesForConversationEnrichment(
        accessible,
        userId,
        userMembers,
      );

      const enriched = accessible.map((c) => enrichConversation(c, userId, messages, userMembers));
      const sorted = sortConversationsWithPins(enriched, userMembers, userId);
      return resolveConversationAvatars(sorted);
    });
  },

  async getConversation(conversationId, userId) {
    return withPbError(async () => {
      const { conversation, members } = await assertConversationAccess(conversationId, userId);
      const healed = await reconcileParticipantIds(conversation, members);
      const messages = await loadMessagesForConversationEnrichment([healed], userId, members);
      return resolveConversationAvatar(enrichConversation(healed, userId, messages, members));
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

      // Newest-first by created (not id — PB ids are random). Reverse → chrono ASC for UI.
      const result = await pb.collection('messages').getList(1, limit + 1, {
        filter: `conversation = "${escapePbFilter(conversationId)}"${createdFilter}`,
        sort: '-created,-id',
      });

      const hasMore = result.items.length > limit;
      const page = hasMore ? result.items.slice(0, limit) : result.items;
      const messages = (await resolveMessages(page.map(mapMessageRecord).reverse()))
        .filter((m) => !m.deletedAt && !isMessageHiddenForUser(m, userId))
        .sort((a, b) => compareIsoDates(a.createdAt, b.createdAt) || a.id.localeCompare(b.id));
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
        if (isMessageHiddenForUser(message, userId)) {
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
      const pb = getPocketBase();
      // Fast path: self user + conversation + own membership (not full member list).
      const [user, conversation, memberRecord] = await Promise.all([
        getRequesterUser(userId),
        loadConversationOrThrow(conversationId),
        findMemberRecord(conversationId, userId),
      ]);
      const members = memberRecord ? [mapConversationMemberRecord(memberRecord)] : [];
      if (!canSendToConversation(user, conversation, members)) {
        throw new ApiError('Нет доступа к чату', 'FORBIDDEN', 403);
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
        text: normalized || getAttachmentsPreviewLabel(attachments),
        status: 'sent',
        readBy: [userId],
        messageType: 'user',
      };
      if (options.clientMutationId) body.clientMutationId = options.clientMutationId;
      if (options.replyToMessageId) body.replyToMessageId = options.replyToMessageId;
      if (attachments.length > 0) body.attachments = attachments;

      let record;
      try {
        record = await pb.collection('messages').create(body);
      } catch (error) {
        // Retry path: unique clientMutationId — return existing instead of pre-flight 404 roundtrip.
        if (
          options.clientMutationId &&
          error instanceof ClientResponseError &&
          (error.status === 400 || error.status === 409)
        ) {
          try {
            const dup = await pb.collection('messages').getFirstListItem(
              `conversation = "${escapePbFilter(conversationId)}" && sender = "${escapePbFilter(userId)}" && clientMutationId = "${escapePbFilter(options.clientMutationId)}"`,
            );
            return attachments.length > 0
              ? resolveMessage(mapMessageRecord(dup))
              : mapMessageRecord(dup);
          } catch {
            /* fall through */
          }
        }
        throw error;
      }
      // Text-only: skip attachment URL resolve (extra PB file roundtrips).
      const msg =
        attachments.length > 0
          ? await resolveMessage(mapMessageRecord(record))
          : mapMessageRecord(record);

      try {
        chatRealtimeService.emit({ type: 'message.created', conversationId, message: msg });
      } catch {
        /* local UI emit only */
      }

      // Fire-and-forget read cursor — must not delay the optimistic → sent transition.
      void (async () => {
        try {
          const row = memberRecord ?? (await findMemberRecord(conversationId, userId));
          if (row) {
            await pb.collection('conversation_members').update(row.id, {
              lastReadMessageId: msg.id,
              lastReadAt: new Date().toISOString(),
            });
          }
        } catch {
          /* best-effort */
        }
      })();

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

  async deleteMessage(conversationId, messageId, userId, options) {
    return withPbError(async () => {
      const { user, conversation, members } = await assertConversationAccess(conversationId, userId);
      const pb = getPocketBase();
      let msg: Message;
      try {
        const record = await pb.collection('messages').getOne(messageId);
        msg = await resolveMessage(mapMessageRecord(record));
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Сообщение не найдено', 'NOT_FOUND', 404);
        }
        throw error;
      }
      if (msg.conversationId !== conversationId) {
        throw new ApiError('Сообщение не найдено', 'NOT_FOUND', 404);
      }

      const scope = options?.scope ?? 'everyone';

      if (scope === 'me') {
        if (!canDeleteMessageForMe(user, msg, conversation, members)) {
          throw new ApiError('Нет прав на удаление', 'FORBIDDEN', 403);
        }
        const updated = withUserHidden(msg, userId);
        const record = await pb.collection('messages').update(messageId, {
          hiddenForUserIds: updated.hiddenForUserIds ?? [],
        });
        const mapped = await resolveMessage(mapMessageRecord(record));
        chatRealtimeService.emit({ type: 'message.updated', conversationId, message: mapped });
        return mapped;
      }

      if (!canDeleteMessage(user, msg, conversation)) {
        throw new ApiError('Нет прав на удаление', 'FORBIDDEN', 403);
      }

      const snapshot = { ...msg, deletedAt: new Date().toISOString() };
      await pb.collection('messages').delete(messageId);
      chatRealtimeService.emit({ type: 'message.deleted', conversationId, message: snapshot });
      return snapshot;
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
      const pb = getPocketBase();

      let uniqueParticipants: string[];
      if (input.allUsers) {
        if (input.type === 'personal') {
          throw new ApiError('Общий чат не может быть личным', 'VALIDATION', 400);
        }
        if (!canCreateSchoolWideChat(user)) {
          throw new ApiError('Нет прав на создание общего чата', 'FORBIDDEN', 403);
        }
        // Prefer client-provided ids (avoids directory RBAC gaps); fall back to PB list
        const fromClient = input.participantIds ?? [];
        if (fromClient.length > 0) {
          uniqueParticipants = [...new Set([userId, ...fromClient])];
        } else {
          const allUsers = await pb.collection('users').getFullList({ fields: 'id' });
          uniqueParticipants = [...new Set(allUsers.map((r) => r.id))];
          if (!uniqueParticipants.includes(userId)) {
            uniqueParticipants.push(userId);
          }
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
        const pair = await Promise.all(uniqueParticipants.map((id) => getRequesterUser(id)));
        if (!isValidTeacherStudentPersonalPair(pair)) {
          throw new ApiError('Личный чат только между преподавателем и учеником', 'VALIDATION', 400);
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
          const messages = await loadMessagesForConversationEnrichment([existing], userId, members);
          return enrichConversation(existing, userId, messages, members);
        }
      } else {
        if (!input.allUsers && !canCreateGroupChat(user)) {
          throw new ApiError('Нет прав на создание группы', 'FORBIDDEN', 403);
        }
        if (!input.allUsers) {
          const title = input.title?.trim();
          if (!title) throw new ApiError('Укажите название группы', 'VALIDATION', 400);
        }
      }

      // Admin is always a participant of every group chat (hooks also enforce).
      let autoAdminIds: string[] = [];
      if (input.type !== 'personal') {
        try {
          const adminRecords = await pb.collection('users').getFullList({
            filter: 'role = "admin"',
            fields: 'id',
          });
          autoAdminIds = adminRecords.map((r) => r.id);
          uniqueParticipants = [...new Set([...uniqueParticipants, ...autoAdminIds])];
        } catch {
          /* directory RBAC — fall through; hooks + getConversations ensure */
        }
      }

      // School-wide: skip per-user getOne (directory RBAC can 403 on some roles and
      // N serial requests hang the create modal). IDs already come from list/client.
      // Auto-added admins: skip getOne (same RBAC risk); membership created below / by hook.
      if (!input.allUsers) {
        const skipValidate = new Set(autoAdminIds);
        for (const participantId of uniqueParticipants) {
          if (skipValidate.has(participantId)) continue;
          await getRequesterUser(participantId);
        }
      }

      const otherId = uniqueParticipants.find((id) => id !== userId);
      const otherUser =
        input.type === 'personal' && otherId ? await getRequesterUser(otherId) : undefined;
      const title =
        input.type === 'personal'
          ? otherUser
            ? formatUserName(otherUser)
            : 'Личный чат'
          : input.allUsers
            ? input.title?.trim() || SCHOOL_WIDE_CHAT_DEFAULT_TITLE
            : input.title!.trim();

      const avatarRef =
        input.type !== 'personal' && input.avatarUrl?.trim()
          ? await persistConversationAvatar(userId, input.avatarUrl)
          : undefined;

      const convRecord = await createConversationWithAvatar(
        {
          type: input.type,
          title,
          participantIds: uniqueParticipants,
          metadata: {
            ...(input.metadata ?? {}),
            ...(input.allUsers ? { schoolWide: true } : {}),
          },
          pinnedMessageIds: [],
        },
        avatarRef,
      );

      // Owner + members idempotently (hooks may already have joined admins).
      await ensureConversationMember(convRecord.id, userId, 'owner');
      const others = uniqueParticipants.filter((id) => id !== userId);
      const memberResults = await Promise.allSettled(
        others.map((participantId) =>
          ensureConversationMember(convRecord.id, participantId, 'member'),
        ),
      );
      const memberFailures = memberResults.filter((r) => r.status === 'rejected');
      if (memberFailures.length > 0) {
        const first = memberFailures[0] as PromiseRejectedResult;
        throw first.reason instanceof Error
          ? first.reason
          : new ApiError('Не удалось добавить участников', 'INTERNAL', 500);
      }

      // Heal participantIds from actual membership (selected students must be present).
      const membersAfter = await loadMembers(convRecord.id);
      const memberIds = [...new Set(membersAfter.map((m) => m.userId))];
      const missing = uniqueParticipants.filter((id) => !memberIds.includes(id));
      if (missing.length > 0) {
        throw new ApiError('Не удалось добавить участников', 'INTERNAL', 500);
      }
      const healedParticipantIds = [...new Set([...uniqueParticipants, ...memberIds])];
      await updateParticipantIds(convRecord.id, healedParticipantIds);

      if (avatarRef) {
        const fileId = parseStoredFileRef(avatarRef);
        if (fileId) await linkStoredFilesToContext([fileId], convRecord.id);
      }

      const conv = await resolveConversationAvatar({
        ...(await loadConversationOrThrow(convRecord.id)),
        participantIds: healedParticipantIds,
      });
      chatRealtimeService.emit({ type: 'conversation.updated', conversationId: conv.id, conversation: conv });
      return enrichConversation(conv, userId, [], membersAfter);
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
        if (isMessageHiddenForUser(msg, userId)) continue;
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
    const [member] = await pocketbaseChatApi.addMembers(conversationId, userId, [targetUserId]);
    if (!member) {
      throw new ApiError('Участник уже в чате', 'VALIDATION', 400);
    }
    return member;
  },

  async addMembers(conversationId, userId, targetUserIds) {
    return withPbError(async () => {
      const uniqueIds = [...new Set(targetUserIds.filter(Boolean))];
      if (uniqueIds.length === 0) return [];

      const { user, conversation, members } = await assertConversationAccess(conversationId, userId);
      if (!canAddMember(user, conversationId, members, conversation)) {
        throw new ApiError('Нет прав на управление участниками', 'FORBIDDEN', 403);
      }
      if (conversation.type === 'personal') {
        throw new ApiError('Нельзя добавить участника в личный чат', 'VALIDATION', 400);
      }
      if (isSchoolWideConversation(conversation)) {
        throw new ApiError('В общем чате нельзя управлять участниками', 'FORBIDDEN', 403);
      }

      const toAdd = uniqueIds.filter((id) => !getConversationMember(conversationId, id, members));
      if (toAdd.length === 0) {
        if (uniqueIds.length === 1) {
          throw new ApiError('Участник уже в чате', 'VALIDATION', 400);
        }
        return [];
      }

      const targets = await Promise.all(toAdd.map((id) => getRequesterUser(id)));
      await Promise.all(
        toAdd.map((targetUserId) => ensureConversationMember(conversationId, targetUserId, 'member')),
      );

      await updateParticipantIds(conversationId, [
        ...new Set([...conversation.participantIds, ...toAdd]),
      ]);

      const now = new Date().toISOString();
      const added: ConversationMember[] = toAdd.map((targetUserId) => ({
        conversationId,
        userId: targetUserId,
        role: 'member',
        joinedAt: now,
        muted: false,
      }));

      // System messages + member.joined — fire-and-forget so UI is not blocked 3–4s.
      void Promise.all(
        targets.map((target, index) => {
          const targetUserId = toAdd[index]!;
          return createSystemMessage(
            conversationId,
            userId,
            `${formatUserName(user)} добавил ${formatUserName(target)}`,
            {
              event: 'member_added',
              actorId: userId,
              targetUserId,
            },
          )
            .then(() => {
              chatRealtimeService.emit({
                type: 'member.joined',
                conversationId,
                userId: targetUserId,
              });
            })
            .catch(() => {
              /* best-effort system line */
            });
        }),
      );

      return added;
    });
  },

  async removeMember(conversationId, userId, targetUserId) {
    return withPbError(async () => {
      const { user, conversation, members } = await assertConversationAccess(conversationId, userId);
      if (!canRemoveMember(user, conversationId, targetUserId, members, conversation)) {
        throw new ApiError('Нет прав на удаление участника', 'FORBIDDEN', 403);
      }
      if (isSchoolWideConversation(conversation)) {
        throw new ApiError('В общем чате нельзя управлять участниками', 'FORBIDDEN', 403);
      }

      const pb = getPocketBase();
      const [targetRecord, target] = await Promise.all([
        findMemberRecord(conversationId, targetUserId),
        getRequesterUser(targetUserId),
      ]);

      await Promise.all([
        targetRecord
          ? pb.collection('conversation_members').delete(targetRecord.id)
          : Promise.resolve(),
        updateParticipantIds(
          conversationId,
          conversation.participantIds.filter((id) => id !== targetUserId),
        ),
      ]);

      await createSystemMessage(
        conversationId,
        userId,
        `${formatUserName(user)} удалил ${formatUserName(target)}`,
        {
          event: 'member_removed',
          actorId: userId,
          targetUserId,
        },
      );

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
      if (input.avatarUrl !== undefined) {
        const nextAvatar = await persistConversationAvatar(
          userId,
          input.avatarUrl ?? '',
          conversation.avatarUrl,
          conversationId,
        );
        body.avatarUrl = nextAvatar ?? '';
      }

      const pb = getPocketBase();
      const record =
        Object.keys(body).length > 0
          ? await updateConversationWithAvatar(conversationId, body)
          : await pb.collection('conversations').getOne(conversationId);
      const updated = await resolveConversationAvatar(mapConversationRecord(record));

      if (input.title && input.title.trim() !== previousTitle) {
        await createSystemMessage(conversationId, userId, `Название группы изменено на «${updated.title}»`, {
          event: 'title_changed',
          actorId: userId,
          previousTitle,
          newTitle: updated.title,
        });
      }

      const messages = await loadMessagesForConversationEnrichment([updated], userId, members);
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
      // PB optional bool: false/blank clears; never send mutedUntil:null together with mute-on
      // (some PB builds clear sibling fields oddly). Unmute clears until explicitly.
      const body: Record<string, unknown> = input.muted
        ? { muted: true }
        : { muted: null, mutedUntil: null };
      if (input.muted && input.mutedUntil) {
        body.mutedUntil = input.mutedUntil;
      }
      const record = await pb.collection('conversation_members').update(memberRecord.id, body);
      const member = mapConversationMemberRecord(record);
      member.muted = input.muted;
      member.mutedUntil = input.muted ? (input.mutedUntil ?? null) : null;
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
      const messages = await loadMessagesForConversationEnrichment([updated], userId, members);
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
      const messages = await loadMessagesForConversationEnrichment([updated], userId, members);
      chatRealtimeService.emit({ type: 'conversation.updated', conversationId, conversation: updated });
      return enrichConversation(updated, userId, messages, members);
    });
  },

  async pinConversation(conversationId, userId, pinned) {
    return withPbError(async () => {
      await assertConversationAccess(conversationId, userId);
      setLocalConversationPinned(userId, conversationId, pinned);
      const memberRecord = await findMemberRecord(conversationId, userId);
      if (!memberRecord) throw new ApiError('Участник не найден', 'NOT_FOUND', 404);
      const pb = getPocketBase();
      try {
        const now = new Date().toISOString();
        const record = await pb.collection('conversation_members').update(memberRecord.id, {
          // Always bump pinnedAt so the chat jumps to position 0
          pinnedAt: pinned ? now : '',
        });
        const member = mapConversationMemberRecord(record);
        member.pinnedAt = pinned ? member.pinnedAt || now : null;
        return member;
      } catch {
        const member = mapConversationMemberRecord(memberRecord);
        member.pinnedAt = pinned ? new Date().toISOString() : null;
        return member;
      }
    });
  },

  async setMessageReaction(conversationId, messageId, userId, emoji) {
    return withPbError(async () => {
      await assertConversationAccess(conversationId, userId);
      const msg = await pocketbaseChatApi.getMessage(conversationId, messageId, userId);
      if (msg.deletedAt) throw new ApiError('Сообщение удалено', 'NOT_FOUND', 404);
      const next = toggleReactionList(msg.reactions ?? msg.metadata?.reactions ?? [], emoji, userId);
      const metadata = { ...msg.metadata, reactions: next };
      const pb = getPocketBase();
      const record = await pb.collection('messages').update(messageId, { metadata });
      const updated = await resolveMessage(mapMessageRecord(record));
      updated.reactions = next;
      chatRealtimeService.emit({ type: 'message.updated', conversationId, message: updated });
      return updated;
    });
  },

  async forwardMessage(sourceConversationId, messageId, userId, targetConversationId) {
    return withPbError(async () => {
      await assertConversationAccess(sourceConversationId, userId);
      const source = await pocketbaseChatApi.getMessage(sourceConversationId, messageId, userId);
      if (source.deletedAt) throw new ApiError('Сообщение удалено', 'NOT_FOUND', 404);
      return pocketbaseChatApi.sendMessage(targetConversationId, userId, source.text, {
        attachments: source.attachments,
      });
    });
  },

  async deleteConversation(conversationId, userId) {
    return withPbError(async () => {
      const { user, conversation, members } = await assertConversationAccess(conversationId, userId);
      if (!canDeleteConversation(user, conversationId, members)) {
        throw new ApiError('Нет прав на удаление чата', 'FORBIDDEN', 403);
      }
      const pb = getPocketBase();
      await purgeConversationDependents(conversationId);
      if (conversation.avatarUrl) {
        await deleteStoredFiles(conversation.avatarUrl).catch(() => undefined);
      }
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
        ...(input.kind ? { kind: input.kind } : {}),
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
