import type { RecordModel } from 'pocketbase';
import type {
  AchievementDefinition,
  AppNotification,
  Assignment,
  AssignmentContentBlock,
  AssignmentGroup,
  CompetitionApplication,
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
  ProgressGoal,
  ProgressGoalStatus,
  PublicNewsItem,
  ProgressHistoryEntry,
  ProgressHistoryType,
  PublicSchoolInfo,
  SchoolEvent,
  Skill,
  StudentSkillProgress,
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
  UserAchievement,
  UserRole,
  AvailabilityException,
} from '@/types';
import { fromPbSkillLevel } from '@/services/progress/skillLevel';
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

export function mapUserRecord(record: PbUserRecord | RecordModel): User {
  const r = record as PbUserRecord & { email?: string };
  const phone =
    (typeof r.phone === 'string' && r.phone) || phoneFromSyntheticEmail(r.email) || '';
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
  const directionIds = (r as { directionIds?: string[] }).directionIds;
  if (directionIds?.length) user.directionIds = directionIds;

  return user;
}

export function userToPbRecord(user: User): PbUserRecord {
  return {
    id: user.id,
    collectionId: 'users',
    collectionName: 'users',
    created: '',
    updated: '',
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
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
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
  registeredUserIds?: string[];
  invitedUserIds?: string[];
}

export function mapEventRecord(record: PbEventRecord | RecordModel): SchoolEvent {
  const r = record as PbEventRecord;
  const event: SchoolEvent = {
    id: record.id,
    title: r.title,
    description: r.description,
    type: r.type,
    date: normalizePbDate(r.date),
    startTime: r.startTime,
    location: r.location,
    registeredUserIds: asIdList(r.registeredUserIds),
  };

  const endTime = emptyToUndefined(r.endTime);
  if (endTime) event.endTime = endTime;

  const imageUrl = emptyToUndefined(r.imageUrl);
  if (imageUrl) event.imageUrl = imageUrl;

  if (typeof r.maxParticipants === 'number' && r.maxParticipants > 0) {
    event.maxParticipants = r.maxParticipants;
  }

  const invitedUserIds = asIdList(r.invitedUserIds);
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

  if (r.metadata && typeof r.metadata === 'object' && r.metadata.lessonId) {
    conversation.metadata = { lessonId: r.metadata.lessonId };
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

  return member;
}

export interface PbMessageRecord extends RecordModel {
  conversation: string | RecordModel;
  sender: string | RecordModel;
  text: string;
  editedAt?: string;
  deletedAt?: string;
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

  if (Array.isArray(r.attachments) && r.attachments.length > 0) {
    message.attachments = r.attachments;
  }

  const clientMutationId = emptyToUndefined(r.clientMutationId);
  if (clientMutationId) message.clientMutationId = clientMutationId;

  const replyToMessageId = emptyToUndefined(r.replyToMessageId);
  if (replyToMessageId) message.replyToMessageId = replyToMessageId;

  if (r.messageType) message.messageType = r.messageType;

  if (r.metadata && typeof r.metadata === 'object' && r.metadata.system) {
    message.metadata = r.metadata;
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

export interface PbSkillRecord extends RecordModel {
  name: string;
  description?: string;
  direction?: string | RecordModel | null;
  maxLevel: number;
}

export function mapSkillRecord(record: PbSkillRecord | RecordModel): Skill {
  const r = record as PbSkillRecord;
  const skill: Skill = {
    id: record.id,
    name: r.name,
    maxLevel: fromPbSkillLevel(r.maxLevel || 10),
  };

  const description = emptyToUndefined(r.description);
  if (description) skill.description = description;

  const directionId = emptyToUndefined(relId(r.direction));
  if (directionId) skill.directionId = directionId;

  return skill;
}

export interface PbSkillProgressRecord extends RecordModel {
  student: string | RecordModel;
  skill: string | RecordModel;
  level: number;
  note?: string;
}

export function mapSkillProgressRecord(
  record: PbSkillProgressRecord | RecordModel,
): StudentSkillProgress {
  const r = record as PbSkillProgressRecord;
  const progress: StudentSkillProgress = {
    id: record.id,
    studentId: relId(r.student),
    skillId: relId(r.skill),
    level: fromPbSkillLevel(r.level ?? 0),
    updatedAt: getPbRecordUpdatedAt(record),
  };

  const note = emptyToUndefined(r.note);
  if (note) progress.note = note;

  return progress;
}

export interface PbProgressGoalRecord extends RecordModel {
  student: string | RecordModel;
  teacher?: string | RecordModel | null;
  title: string;
  description?: string;
  targetDate?: string;
  status: ProgressGoalStatus;
  completedAt?: string;
}

export function mapProgressGoalRecord(record: PbProgressGoalRecord | RecordModel): ProgressGoal {
  const r = record as PbProgressGoalRecord;
  const goal: ProgressGoal = {
    id: record.id,
    studentId: relId(r.student),
    title: r.title,
    status: r.status,
    createdAt: getPbRecordCreatedAt(record, r.completedAt),
  };

  const teacherId = emptyToUndefined(relId(r.teacher));
  if (teacherId) goal.teacherId = teacherId;

  const description = emptyToUndefined(r.description);
  if (description) goal.description = description;

  const targetDate = normalizePbDate(r.targetDate);
  if (targetDate) goal.targetDate = targetDate;

  const completedAt = normalizePbDateTime(r.completedAt);
  if (completedAt) goal.completedAt = completedAt;

  return goal;
}

export interface PbProgressHistoryRecord extends RecordModel {
  student: string | RecordModel;
  type: ProgressHistoryType;
  title: string;
  description?: string;
}

export function mapProgressHistoryRecord(
  record: PbProgressHistoryRecord | RecordModel,
): ProgressHistoryEntry {
  const r = record as PbProgressHistoryRecord;
  const entry: ProgressHistoryEntry = {
    id: record.id,
    studentId: relId(r.student),
    type: r.type,
    title: r.title,
    createdAt: getPbRecordCreatedAt(record),
  };

  const description = emptyToUndefined(r.description);
  if (description) entry.description = description;

  return entry;
}

export interface PbAchievementDefinitionRecord extends RecordModel {
  code: string;
  title: string;
  description: string;
  icon: string;
}

export function mapAchievementDefinitionRecord(
  record: PbAchievementDefinitionRecord | RecordModel,
): AchievementDefinition {
  const r = record as PbAchievementDefinitionRecord;
  return {
    id: record.id,
    code: r.code,
    title: r.title,
    description: r.description,
    icon: r.icon,
  };
}

export interface PbUserAchievementRecord extends RecordModel {
  student: string | RecordModel;
  achievement: string | RecordModel;
  unlockedAt: string;
}

export function mapUserAchievementRecord(
  record: PbUserAchievementRecord | RecordModel,
): UserAchievement {
  const r = record as PbUserAchievementRecord;
  return {
    id: record.id,
    studentId: relId(r.student),
    achievementId: relId(r.achievement),
    unlockedAt: normalizePbDateTime(r.unlockedAt) ?? r.unlockedAt,
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

  return ticket;
}

export interface PbLegalDocumentRecord extends RecordModel {
  type: LegalDocumentType;
  title: string;
  content: string;
  currentVersion: string;
  effectiveAt: string;
  requiresConsent: boolean;
  versionHistory?: LegalDocumentVersionHistory[];
}

export function mapLegalDocumentRecord(
  record: PbLegalDocumentRecord | RecordModel,
): LegalDocument {
  const r = record as PbLegalDocumentRecord;
  return {
    id: record.id,
    type: r.type,
    title: r.title,
    content: r.content,
    currentVersion: r.currentVersion,
    effectiveAt: normalizePbDate(r.effectiveAt),
    requiresConsent: Boolean(r.requiresConsent),
    versionHistory: Array.isArray(r.versionHistory) ? r.versionHistory : [],
  };
}

export interface PbUserConsentRecord extends RecordModel {
  user: string | RecordModel;
  document: string | RecordModel;
  documentType: LegalDocumentType;
  documentTitle: string;
  version: string;
  acceptedAt: string;
}

export function mapUserConsentRecord(record: PbUserConsentRecord | RecordModel): UserConsent {
  const r = record as PbUserConsentRecord;
  return {
    id: record.id,
    userId: relId(r.user),
    documentId: relId(r.document),
    documentType: r.documentType,
    documentTitle: r.documentTitle,
    version: r.version,
    acceptedAt: normalizePbDateTime(r.acceptedAt) ?? r.acceptedAt,
  };
}

export interface PbSecuritySessionRecord extends RecordModel {
  user: string | RecordModel;
  deviceLabel: string;
  platform: string;
  ipAddress: string;
  lastActiveAt: string;
  isCurrent: boolean;
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
  return {
    id: record.id,
    userId: relId(r.user),
    type: r.type,
    title: r.title,
    body: r.body,
    read: Boolean(r.read),
    createdAt: getPbRecordCreatedAt(record),
    link: emptyToUndefined(r.link),
  };
}

interface PbNotificationPreferencesRecord {
  user: unknown;
  pushEnabled: boolean;
}

export function mapNotificationPreferencesRecord(
  record: PbNotificationPreferencesRecord | RecordModel,
): NotificationPreferences {
  const r = record as PbNotificationPreferencesRecord;
  return {
    userId: relId(r.user),
    pushEnabled: Boolean(r.pushEnabled),
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
