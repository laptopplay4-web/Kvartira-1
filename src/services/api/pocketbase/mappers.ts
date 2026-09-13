import type { RecordModel } from 'pocketbase';
import type {
  AppNotification,
  Assignment,
  AssignmentContentBlock,
  AssignmentGroup,
  CompetitionApplication,
  ConsentPurpose,
  Conversation,
  ConversationLastMessage,
  ConversationMember,
  ConversationMemberRole,
  ConversationMetadata,
  ConversationType,
  DayAvailability,
  Direction,
  EventRegistration,
  EventType,
  GuardianDetails,
  Lesson,
  LessonHistoryEntry,
  LessonMaterial,
  LessonStatus,
  Message,
  MessageAttachment,
  MessageMetadata,
  MessageStatus,
  MessageType,
  PlanningPeriod,
  PublicNewsItem,
  PublicSchoolInfo,
  SchoolEvent,
  SupportTicket,
  SupportTicketAttachment,
  SupportTicketCategory,
  SupportTicketReply,
  SupportTicketStatus,
  HelpArticle,
  LegalDocument,
  LegalDocumentType,
  LegalDocumentVersionHistory,
  LoginHistoryEntry,
  NotificationPreferences,
  SecurityAlert,
  SecurityAlertType,
  SecuritySession,
  UserConsent,
  SlotInterval,
  TeacherAvailability,
  User,
  UserRole,
  AvailabilityException,
} from '@/types';
import {
  emptyToUndefined,
  getPbRecordCreatedAt,
  getPbRecordUpdatedAt,
  normalizePbDate,
  normalizePbDateTime,
  relId,
} from '@/services/api/pocketbase/helpers';
import { phoneFromSyntheticEmail } from '@/utils/phone';
import {
  extractSchoolExtrasFromContacts,
  normalizeSchoolSocialLinks,
  parseSchoolDirectionsVideo,
} from '@/services/school/helpers';

export interface PbUserRecord extends RecordModel {
  phone: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  avatarOriginalUrl?: string;
  bio?: string;
  directionIds?: string[];
}

export interface MapUserRecordOptions {
  /**
   * Recover the phone from the synthetic `{digits}@kvartira.local` email.
   * Only allowed for the viewer's OWN record — otherwise it re-creates the
   * phone that PocketBase deliberately hid.
   */
  ownRecord?: boolean;
}

export function parseDirectionIds(value: unknown): string[] | undefined {
  if (value == null) return undefined;

  if (Array.isArray(value)) {
    const ids = value
      .map((item) => {
        if (typeof item === 'string' && item.trim()) return item.trim();
        if (item && typeof item === 'object' && 'id' in item) {
          const id = (item as { id: unknown }).id;
          return typeof id === 'string' && id.trim() ? id.trim() : '';
        }
        return '';
      })
      .filter(Boolean);
    return ids.length > 0 ? [...new Set(ids)] : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
      return parseDirectionIds(JSON.parse(trimmed) as unknown);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function mapUserRecord(
  record: PbUserRecord | RecordModel,
  options: MapUserRecordOptions = {},
): User {
  const r = record as PbUserRecord & { email?: string; directionIds?: unknown };
  const phone =
    (typeof r.phone === 'string' && r.phone) ||
    (options.ownRecord ? phoneFromSyntheticEmail(r.email) : '') ||
    '';
  const user: User = {
    id: record.id,
    phone,
    role: r.role,
    firstName: r.firstName,
    lastName: r.lastName,
  };

  if (r.avatarUrl) user.avatarUrl = r.avatarUrl;
  if (r.avatarOriginalUrl) user.avatarOriginalUrl = r.avatarOriginalUrl;
  if (r.bio) user.bio = r.bio;
  const directionIds = parseDirectionIds(r.directionIds);
  if (directionIds?.length) user.directionIds = directionIds;

  return user;
}

export function userToPbRecord(user: User, base?: Partial<RecordModel>): PbUserRecord {
  return {
    id: user.id,
    collectionId: base?.collectionId ?? 'users',
    collectionName: base?.collectionName ?? 'users',
    created: typeof base?.created === 'string' ? base.created : '',
    updated: typeof base?.updated === 'string' ? base.updated : '',
    phone: user.phone,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl ?? '',
    avatarOriginalUrl: user.avatarOriginalUrl ?? '',
    bio: user.bio ?? '',
    directionIds: user.directionIds ?? [],
  };
}

export interface PbDirectionRecord extends RecordModel {
  name: string;
  description?: string;
  icon?: string;
}

export function mapDirectionRecord(record: PbDirectionRecord | RecordModel): Direction {
  const r = record as PbDirectionRecord;
  const direction: Direction = {
    id: record.id,
    name: r.name,
  };
  const description = emptyToUndefined(r.description);
  const icon = emptyToUndefined(r.icon);
  if (description) direction.description = description;
  if (icon) direction.icon = icon;
  return direction;
}

export interface PbLessonRecord extends RecordModel {
  student: string | RecordModel;
  teacher: string | RecordModel;
  direction: string | RecordModel;
  date: string;
  startTime: string;
  durationMinutes: number;
  status: LessonStatus;
  location?: string;
  materials?: LessonMaterial[];
  teacherNotes?: string;
  cancelReason?: string;
}

export function mapLessonRecord(record: PbLessonRecord | RecordModel): Lesson {
  const r = record as PbLessonRecord;
  const lesson: Lesson = {
    id: record.id,
    studentId: relId(r.student),
    teacherId: relId(r.teacher),
    directionId: relId(r.direction),
    date: normalizePbDate(r.date),
    startTime: r.startTime,
    durationMinutes: r.durationMinutes,
    status: r.status,
    createdAt: getPbRecordCreatedAt(record, `${normalizePbDate(r.date)}T${r.startTime}:00`),
    updatedAt: getPbRecordUpdatedAt(record, `${normalizePbDate(r.date)}T${r.startTime}:00`),
  };

  const location = emptyToUndefined(r.location);
  if (location) lesson.location = location;

  if (Array.isArray(r.materials) && r.materials.length > 0) {
    lesson.materials = r.materials;
  }

  const teacherNotes = emptyToUndefined(r.teacherNotes);
  if (teacherNotes) lesson.teacherNotes = teacherNotes;

  const cancelReason = emptyToUndefined(r.cancelReason);
  if (cancelReason) lesson.cancelReason = cancelReason;

  return lesson;
}

export interface PbAvailabilityRecord extends RecordModel {
  teacher: string | RecordModel;
  slotIntervalMinutes: SlotInterval;
  defaultLessonDurationMinutes: number;
  schedule: DayAvailability[];
  exceptions?: AvailabilityException[];
  planningPeriod?: PlanningPeriod | null;
}

export function mapAvailabilityRecord(record: PbAvailabilityRecord | RecordModel): TeacherAvailability {
  const r = record as PbAvailabilityRecord;
  const availability: TeacherAvailability = {
    teacherId: relId(r.teacher),
    slotIntervalMinutes: r.slotIntervalMinutes,
    defaultLessonDurationMinutes: r.defaultLessonDurationMinutes,
    schedule: r.schedule ?? [],
  };

  if (Array.isArray(r.exceptions) && r.exceptions.length > 0) {
    availability.exceptions = r.exceptions;
  }

  if (r.planningPeriod && typeof r.planningPeriod === 'object') {
    const period = r.planningPeriod as PlanningPeriod;
    if (period.startDate && period.endDate) {
      availability.planningPeriod = {
        startDate: normalizePbDate(period.startDate),
        endDate: normalizePbDate(period.endDate),
      };
    }
  }

  return availability;
}

export interface PbLessonHistoryRecord extends RecordModel {
  lesson: string | RecordModel;
  action: LessonHistoryEntry['action'];
  previousDate?: string;
  previousStartTime?: string;
  newDate?: string;
  newStartTime?: string;
  reason?: string;
  user: string | RecordModel;
}

export function mapLessonHistoryRecord(record: PbLessonHistoryRecord | RecordModel): LessonHistoryEntry {
  const r = record as PbLessonHistoryRecord;
  const entry: LessonHistoryEntry = {
    id: record.id,
    lessonId: relId(r.lesson),
    action: r.action,
    userId: relId(r.user),
    createdAt: getPbRecordCreatedAt(record),
  };

  const previousDate = normalizePbDate(r.previousDate);
  if (previousDate) entry.previousDate = previousDate;

  const previousStartTime = emptyToUndefined(r.previousStartTime);
  if (previousStartTime) entry.previousStartTime = previousStartTime;

  const newDate = normalizePbDate(r.newDate);
  if (newDate) entry.newDate = newDate;

  const newStartTime = emptyToUndefined(r.newStartTime);
  if (newStartTime) entry.newStartTime = newStartTime;

  const reason = emptyToUndefined(r.reason);
  if (reason) entry.reason = reason;

  return entry;
}

function asIdList(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return asIdList(JSON.parse(trimmed) as unknown);
    } catch {
      return trimmed ? [trimmed] : [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string' && item.length > 0) return item;
      if (item && typeof item === 'object' && 'id' in item) {
        const id = (item as { id: unknown }).id;
        return typeof id === 'string' && id.length > 0 ? id : '';
      }
      return '';
    })
    .filter(Boolean);
}

function readRecordField(record: RecordModel, field: string): unknown {
  const withGet = record as RecordModel & { get?: (key: string) => unknown };
  if (typeof withGet.get === 'function') {
    try {
      return withGet.get(field);
    } catch {
      /* fall through */
    }
  }
  return (record as Record<string, unknown>)[field];
}

export interface PbEventRecord extends RecordModel {
  title: string;
  description: string;
  type: EventType;
  date: string;
  startTime: string;
  endTime?: string;
  location: string;
  imageUrl?: string;
  maxParticipants?: number;
  registeredCount?: number;
  registeredUserIds?: string[];
  invitedUserIds?: string[];
}

export function mapEventRecord(record: PbEventRecord | RecordModel): SchoolEvent {
  const r = record as PbEventRecord;
  const registeredUserIds = asIdList(
    readRecordField(record, 'registeredUserIds') ?? r.registeredUserIds,
  );
  const registeredCountRaw = readRecordField(record, 'registeredCount') ?? r.registeredCount;
  const registeredCount =
    typeof registeredCountRaw === 'number' && registeredCountRaw >= 0
      ? registeredCountRaw
      : registeredUserIds.length;

  const event: SchoolEvent = {
    id: record.id,
    title: String(readRecordField(record, 'title') ?? r.title ?? ''),
    description: String(readRecordField(record, 'description') ?? r.description ?? ''),
    type: (readRecordField(record, 'type') ?? r.type) as EventType,
    date: normalizePbDate(readRecordField(record, 'date') ?? r.date),
    startTime: String(readRecordField(record, 'startTime') ?? r.startTime ?? ''),
    location: String(readRecordField(record, 'location') ?? r.location ?? ''),
    registeredCount,
    registeredUserIds,
  };

  const endTime = emptyToUndefined(
    (readRecordField(record, 'endTime') ?? r.endTime) as string | undefined,
  );
  if (endTime) event.endTime = endTime;

  const imageUrl = emptyToUndefined(
    (readRecordField(record, 'imageUrl') ?? r.imageUrl) as string | undefined,
  );
  if (imageUrl) event.imageUrl = imageUrl;

  const maxParticipants = readRecordField(record, 'maxParticipants') ?? r.maxParticipants;
  if (typeof maxParticipants === 'number' && maxParticipants > 0) {
    event.maxParticipants = maxParticipants;
  }

  const invitedUserIds = asIdList(
    readRecordField(record, 'invitedUserIds') ?? r.invitedUserIds,
  );
  if (invitedUserIds.length > 0) event.invitedUserIds = invitedUserIds;

  return event;
}

export interface PbEventRegistrationRecord extends RecordModel {
  event: string | RecordModel;
  user: string | RecordModel;
  application?: CompetitionApplication | null;
}

export function mapEventRegistrationRecord(
  record: PbEventRegistrationRecord | RecordModel,
): EventRegistration {
  const r = record as PbEventRegistrationRecord;
  const registration: EventRegistration = {
    id: record.id,
    eventId: relId(r.event),
    userId: relId(r.user),
    createdAt: getPbRecordCreatedAt(record),
  };

  if (r.application && typeof r.application === 'object') {
    registration.application = r.application;
  }

  return registration;
}

export interface PbConversationRecord extends RecordModel {
  type: ConversationType;
  title: string;
  avatarUrl?: string;
  participantIds?: string[];
  lastMessageAt?: string;
  lastMessage?: ConversationLastMessage | null;
  metadata?: ConversationMetadata | null;
  pinnedMessageIds?: string[];
}

function mapLastMessage(value: unknown): ConversationLastMessage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<ConversationLastMessage>;
  if (!raw.id || !raw.text || !raw.senderId || !raw.createdAt) return undefined;
  return {
    id: raw.id,
    text: raw.text,
    senderId: raw.senderId,
    createdAt: normalizePbDateTime(raw.createdAt) ?? raw.createdAt,
  };
}

export function mapConversationRecord(record: PbConversationRecord | RecordModel): Conversation {
  const r = record as PbConversationRecord;
  const conversation: Conversation = {
    id: record.id,
    type: r.type,
    title: r.title,
    participantIds: asIdList(r.participantIds),
    createdAt: getPbRecordCreatedAt(record, r.lastMessageAt),
    updatedAt: getPbRecordUpdatedAt(record, r.lastMessageAt),
  };

  const avatarUrl = emptyToUndefined(r.avatarUrl);
  if (avatarUrl) conversation.avatarUrl = avatarUrl;

  const lastMessageAt = normalizePbDateTime(r.lastMessageAt);
  if (lastMessageAt) conversation.lastMessageAt = lastMessageAt;

  const lastMessage = mapLastMessage(r.lastMessage);
  if (lastMessage) conversation.lastMessage = lastMessage;

  if (r.metadata && typeof r.metadata === 'object') {
    const meta: Conversation['metadata'] = {};
    if (typeof r.metadata.lessonId === 'string' && r.metadata.lessonId) {
      meta.lessonId = r.metadata.lessonId;
    }
    if (r.metadata.schoolWide === true) {
      meta.schoolWide = true;
    }
    if (Object.keys(meta).length > 0) {
      conversation.metadata = meta;
    }
  }

  const pinned = asIdList(r.pinnedMessageIds);
  if (pinned.length > 0) conversation.pinnedMessageIds = pinned;

  return conversation;
}

export interface PbConversationMemberRecord extends RecordModel {
  conversation: string | RecordModel;
  user: string | RecordModel;
  role: ConversationMemberRole;
  lastReadMessageId?: string;
  lastReadAt?: string;
  muted: boolean;
  mutedUntil?: string;
}

export function mapConversationMemberRecord(
  record: PbConversationMemberRecord | RecordModel,
): ConversationMember {
  const r = record as PbConversationMemberRecord;
  const member: ConversationMember = {
    conversationId: relId(r.conversation),
    userId: relId(r.user),
    role: r.role,
    joinedAt: getPbRecordCreatedAt(record, r.lastReadAt),
    muted: Boolean(r.muted),
  };

  const lastReadMessageId = emptyToUndefined(r.lastReadMessageId);
  if (lastReadMessageId) member.lastReadMessageId = lastReadMessageId;

  const lastReadAt = normalizePbDateTime(r.lastReadAt);
  if (lastReadAt) member.lastReadAt = lastReadAt;

  const mutedUntil = normalizePbDateTime(r.mutedUntil);
  if (mutedUntil) member.mutedUntil = mutedUntil;

  const pinnedAt = normalizePbDateTime((r as { pinnedAt?: string }).pinnedAt);
  if (pinnedAt) member.pinnedAt = pinnedAt;

  return member;
}

export interface PbMessageRecord extends RecordModel {
  conversation: string | RecordModel;
  sender: string | RecordModel;
  text: string;
  editedAt?: string;
  deletedAt?: string;
  hiddenForUserIds?: string[] | null;
  status: MessageStatus;
  readBy?: string[];
  attachments?: MessageAttachment[];
  clientMutationId?: string;
  replyToMessageId?: string;
  messageType?: MessageType;
  metadata?: MessageMetadata | null;
}

export function mapMessageRecord(record: PbMessageRecord | RecordModel): Message {
  const r = record as PbMessageRecord;
  const message: Message = {
    id: record.id,
    conversationId: relId(r.conversation),
    senderId: relId(r.sender),
    text: r.text ?? '',
    createdAt: getPbRecordCreatedAt(record, r.editedAt),
    status: r.status ?? 'sent',
    readBy: asIdList(r.readBy),
  };

  const updatedAt = getPbRecordUpdatedAt(record, r.editedAt);
  if (updatedAt !== message.createdAt) message.updatedAt = updatedAt;

  const editedAt = normalizePbDateTime(r.editedAt);
  if (editedAt) message.editedAt = editedAt;

  const deletedAt = normalizePbDateTime(r.deletedAt);
  if (deletedAt) message.deletedAt = deletedAt;

  const hiddenIds = asIdList(r.hiddenForUserIds);
  if (hiddenIds.length > 0) message.hiddenForUserIds = hiddenIds;

  if (Array.isArray(r.attachments) && r.attachments.length > 0) {
    message.attachments = r.attachments;
  }

  const clientMutationId = emptyToUndefined(r.clientMutationId);
  if (clientMutationId) message.clientMutationId = clientMutationId;

  const replyToMessageId = emptyToUndefined(r.replyToMessageId);
  if (replyToMessageId) message.replyToMessageId = replyToMessageId;

  if (r.messageType) message.messageType = r.messageType;

  if (r.metadata && typeof r.metadata === 'object') {
    message.metadata = r.metadata;
    if (Array.isArray(r.metadata.reactions)) {
      message.reactions = r.metadata.reactions;
    }
  }

  return message;
}

export interface PbAssignmentRecord extends RecordModel {
  title: string;
  description: string;
  teacher: string | RecordModel;
  group?: string | RecordModel | null;
  dueDate?: string;
  contentBlocks?: AssignmentContentBlock[];
}

export function mapAssignmentRecord(record: PbAssignmentRecord | RecordModel): Assignment {
  const r = record as PbAssignmentRecord;
  const groupId = emptyToUndefined(relId(r.group)) ?? '';
  return {
    id: record.id,
    title: r.title,
    description: r.description,
    teacherId: relId(r.teacher),
    groupId,
    dueDate: r.dueDate ? normalizePbDate(r.dueDate) : undefined,
    contentBlocks: Array.isArray(r.contentBlocks) ? r.contentBlocks : [],
    createdAt: getPbRecordCreatedAt(record, normalizePbDate(r.dueDate ?? '')),
    updatedAt: getPbRecordUpdatedAt(record, normalizePbDate(r.dueDate ?? '')),
  };
}

export interface PbAssignmentGroupRecord extends RecordModel {
  name: string;
  teacher: string | RecordModel;
  kind?: 'general' | 'custom';
  members?: Array<string | RecordModel>;
  memberIds?: string[];
}

export function mapAssignmentGroupRecord(record: PbAssignmentGroupRecord | RecordModel): AssignmentGroup {
  const r = record as PbAssignmentGroupRecord;
  const members = Array.isArray(r.members)
    ? r.members.map(relId).filter(Boolean)
    : Array.isArray(r.memberIds)
      ? r.memberIds
      : [];
  return {
    id: record.id,
    name: r.name,
    teacherId: relId(r.teacher),
    memberIds: members,
    isGeneral: r.kind === 'general',
    createdAt: getPbRecordCreatedAt(record),
    updatedAt: getPbRecordUpdatedAt(record),
  };
}

export interface PbHelpArticleRecord extends RecordModel {
  question: string;
  answer: string;
  category: SupportTicketCategory;
  keywords?: string[];
}

export function mapHelpArticleRecord(record: PbHelpArticleRecord | RecordModel): HelpArticle {
  const r = record as PbHelpArticleRecord;
  return {
    id: record.id,
    question: r.question,
    answer: r.answer,
    category: r.category,
    keywords: Array.isArray(r.keywords) ? r.keywords.filter((k): k is string => typeof k === 'string') : [],
  };
}

export interface PbSupportTicketRecord extends RecordModel {
  user: string | RecordModel;
  subject: string;
  message: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  attachments?: SupportTicketAttachment[];
  adminReply?: SupportTicketReply | null;
  reportContext?: SupportTicket['reportContext'] | null;
}

export function mapSupportTicketRecord(record: PbSupportTicketRecord | RecordModel): SupportTicket {
  const r = record as PbSupportTicketRecord;
  const ticket: SupportTicket = {
    id: record.id,
    userId: relId(r.user),
    subject: r.subject,
    message: r.message,
    category: r.category,
    status: r.status,
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    createdAt: getPbRecordCreatedAt(record, r.adminReply?.createdAt),
    updatedAt: getPbRecordUpdatedAt(record, r.adminReply?.createdAt),
  };

  if (r.adminReply && typeof r.adminReply === 'object') {
    ticket.adminReply = r.adminReply;
  }

  if (r.reportContext && typeof r.reportContext === 'object') {
    ticket.reportContext = r.reportContext as SupportTicket['reportContext'];
  }

  return ticket;
}

export interface PbLegalDocumentRecord extends RecordModel {
  type: LegalDocumentType;
  title: string;
  content: string;
  currentVersion: string;
  effectiveAt: string;
  requiresConsent: boolean;
  purpose?: ConsentPurpose | '';
  required?: boolean;
  versionHistory?: LegalDocumentVersionHistory[];
}

export function mapLegalDocumentRecord(
  record: PbLegalDocumentRecord | RecordModel,
): LegalDocument {
  const r = record as PbLegalDocumentRecord;
  const document: LegalDocument = {
    id: record.id,
    type: r.type,
    title: r.title,
    content: r.content,
    currentVersion: r.currentVersion,
    effectiveAt: normalizePbDate(r.effectiveAt),
    requiresConsent: Boolean(r.requiresConsent),
    versionHistory: Array.isArray(r.versionHistory) ? r.versionHistory : [],
  };
  // Do not coerce missing `required` to false — helpers fall back to purpose.
  if (typeof r.required === 'boolean') document.required = r.required;
  if (r.purpose) document.purpose = r.purpose;
  return document;
}

export interface PbUserConsentRecord extends RecordModel {
  user: string | RecordModel;
  document: string | RecordModel;
  documentType: LegalDocumentType;
  documentTitle: string;
  version: string;
  acceptedAt: string;
  purpose?: ConsentPurpose | '';
  revokedAt?: string;
  ipAddress?: string;
  userAgent?: string;
  consentTextVersion?: string;
  guardian?: GuardianDetails | null;
}

export function mapUserConsentRecord(record: PbUserConsentRecord | RecordModel): UserConsent {
  const r = record as PbUserConsentRecord;
  const consent: UserConsent = {
    id: record.id,
    userId: relId(r.user),
    documentId: relId(r.document),
    documentType: r.documentType,
    documentTitle: r.documentTitle,
    version: r.version,
    acceptedAt: normalizePbDateTime(r.acceptedAt) ?? r.acceptedAt,
  };

  if (r.purpose) consent.purpose = r.purpose;
  if (r.revokedAt) consent.revokedAt = normalizePbDateTime(r.revokedAt) ?? r.revokedAt;
  if (r.ipAddress) consent.ipAddress = r.ipAddress;
  if (r.userAgent) consent.userAgent = r.userAgent;
  if (r.consentTextVersion) consent.consentTextVersion = r.consentTextVersion;
  if (r.guardian && typeof r.guardian === 'object') consent.guardian = r.guardian;

  return consent;
}

export interface PbSecuritySessionRecord extends RecordModel {
  user: string | RecordModel;
  deviceLabel: string;
  platform: string;
  ipAddress: string;
  lastActiveAt: string;
  isCurrent: boolean;
  tokenFingerprint?: string;
}

export function mapSecuritySessionRecord(
  record: PbSecuritySessionRecord | RecordModel,
): SecuritySession {
  const r = record as PbSecuritySessionRecord;
  return {
    id: record.id,
    userId: relId(r.user),
    deviceLabel: r.deviceLabel,
    platform: r.platform,
    ipAddress: r.ipAddress,
    lastActiveAt: normalizePbDateTime(r.lastActiveAt) ?? r.lastActiveAt,
    createdAt: getPbRecordCreatedAt(record, r.lastActiveAt),
    isCurrent: Boolean(r.isCurrent),
  };
}

/** Internal fingerprint for matching the viewing JWT (not exposed on SecuritySession). */
export function getSecuritySessionTokenFingerprint(
  record: PbSecuritySessionRecord | RecordModel,
): string {
  const r = record as PbSecuritySessionRecord & { getString?: (key: string) => string };
  if (typeof r.getString === 'function') {
    return r.getString('tokenFingerprint') || '';
  }
  return typeof r.tokenFingerprint === 'string' ? r.tokenFingerprint : '';
}

export interface PbLoginHistoryRecord extends RecordModel {
  user: string | RecordModel;
  deviceLabel: string;
  ipAddress: string;
  success: boolean;
}

export function mapLoginHistoryRecord(
  record: PbLoginHistoryRecord | RecordModel,
): LoginHistoryEntry {
  const r = record as PbLoginHistoryRecord;
  return {
    id: record.id,
    userId: relId(r.user),
    deviceLabel: r.deviceLabel,
    ipAddress: r.ipAddress,
    success: Boolean(r.success),
    createdAt: getPbRecordCreatedAt(record),
  };
}

export interface PbSecurityAlertRecord extends RecordModel {
  user: string | RecordModel;
  type: SecurityAlertType;
  title: string;
  message: string;
  read: boolean;
}

export function mapSecurityAlertRecord(
  record: PbSecurityAlertRecord | RecordModel,
): SecurityAlert {
  const r = record as PbSecurityAlertRecord;
  return {
    id: record.id,
    userId: relId(r.user),
    type: r.type,
    title: r.title,
    message: r.message,
    read: Boolean(r.read),
    createdAt: getPbRecordCreatedAt(record),
  };
}

interface PbNotificationRecord extends RecordModel {
  user: unknown;
  type: AppNotification['type'];
  title: string;
  body: string;
  read: boolean;
  link?: string;
}

export function mapNotificationRecord(
  record: PbNotificationRecord | RecordModel,
): AppNotification {
  const r = record as PbNotificationRecord;
  const notification: AppNotification = {
    id: record.id,
    userId: relId(r.user),
    type: r.type,
    title: r.title,
    body: r.body,
    read: Boolean(r.read),
    createdAt: getPbRecordCreatedAt(record),
    link: emptyToUndefined(r.link),
  };
  if ((r as { urgent?: boolean }).urgent) {
    notification.urgent = true;
  }
  return notification;
}

interface PbNotificationPreferencesRecord {
  user: unknown;
  pushEnabled: boolean;
}

export function mapNotificationPreferencesRecord(
  record: PbNotificationPreferencesRecord | RecordModel,
): NotificationPreferences {
  const r = record as PbNotificationPreferencesRecord;
  // Optional bool in PB may arrive as false | null | undefined | 0/1 after OFF.
  const raw: unknown = (record as { pushEnabled?: unknown }).pushEnabled;
  return {
    userId: relId(r.user),
    pushEnabled: raw === true || raw === 1 || raw === 'true',
  };
}

interface PbSchoolSettingsRecord {
  name: string;
  tagline?: string;
  about?: string;
  contacts: unknown;
  socialLinks?: unknown;
  directionsVideo?: unknown;
}

function parseSchoolContacts(value: unknown): PublicSchoolInfo['contacts'] {
  const contacts = coerceJsonObjectFromContacts(value);
  return {
    phone: typeof contacts.phone === 'string' ? contacts.phone : '',
    email: typeof contacts.email === 'string' ? contacts.email : '',
    address: typeof contacts.address === 'string' ? contacts.address : '',
    workingHours: typeof contacts.workingHours === 'string' ? contacts.workingHours : '',
  };
}

function coerceJsonObjectFromContacts(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function mapSchoolSettingsRecord(
  record: PbSchoolSettingsRecord | RecordModel,
): PublicSchoolInfo {
  const r = record as PbSchoolSettingsRecord;
  const extrasFromContacts = extractSchoolExtrasFromContacts(r.contacts);
  const topLevelSocial = normalizeSchoolSocialLinks(r.socialLinks);
  const hasTopLevelSocial = Object.values(topLevelSocial).some((v) => !!v);
  const topLevelVideo = parseSchoolDirectionsVideo(r.directionsVideo);

  const result: PublicSchoolInfo = {
    name: typeof r.name === 'string' ? r.name : '',
    tagline: typeof r.tagline === 'string' ? r.tagline : '',
    about: typeof r.about === 'string' ? r.about : '',
    contacts: parseSchoolContacts(r.contacts),
    socialLinks: hasTopLevelSocial ? topLevelSocial : extrasFromContacts.socialLinks,
  };

  const video = topLevelVideo ?? extrasFromContacts.directionsVideo;
  if (video) result.directionsVideo = video;
  return result;
}

export interface PbPublicNewsRecord extends RecordModel {
  title: string;
  excerpt: string;
  publishedAt: string;
}

export function mapPublicNewsRecord(record: PbPublicNewsRecord | RecordModel): PublicNewsItem {
  const r = record as PbPublicNewsRecord;
  return {
    id: record.id,
    title: r.title,
    excerpt: r.excerpt,
    publishedAt: normalizePbDate(r.publishedAt),
  };
}
