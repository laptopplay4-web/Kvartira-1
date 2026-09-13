export type UserRole = 'student' | 'teacher' | 'admin';

export interface User {
  id: string;
  phone: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  avatarOriginalUrl?: string;
  bio?: string;
  /** Направления обучения (ученик) или преподавания (teacher). */
  directionIds?: string[];
}

export type LessonStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'
  | 'pending'
  | 'no_show';

export interface Direction {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface DayAvailability {
  dayOfWeek: number;
  ranges: TimeRange[];
  breaks?: TimeRange[];
}

export interface AvailabilityException {
  date: string;
  off?: boolean;
  ranges?: TimeRange[];
}

export type SlotInterval = 15 | 30 | 40 | 60;

export interface PlanningPeriod {
  startDate: string;
  endDate: string;
}

export interface TeacherAvailability {
  teacherId: string;
  slotIntervalMinutes: SlotInterval;
  defaultLessonDurationMinutes: number;
  schedule: DayAvailability[];
  exceptions?: AvailabilityException[];
  planningPeriod?: PlanningPeriod;
}

export interface LessonMaterial {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
}

export interface Lesson {
  id: string;
  studentId: string;
  teacherId: string;
  directionId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  status: LessonStatus;
  location?: string;
  materials?: LessonMaterial[];
  teacherNotes?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonHistoryEntry {
  id: string;
  lessonId: string;
  action: 'created' | 'rescheduled' | 'cancelled' | 'confirmed';
  previousDate?: string;
  previousStartTime?: string;
  newDate?: string;
  newStartTime?: string;
  reason?: string;
  userId: string;
  createdAt: string;
}

export interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
}

export type ConversationType = 'personal' | 'group' | 'study' | 'organizational' | 'system';

export type ConversationMemberRole = 'owner' | 'admin' | 'member';

export interface ConversationMember {
  conversationId: string;
  userId: string;
  role: ConversationMemberRole;
  joinedAt: string;
  lastReadMessageId?: string;
  lastReadAt?: string;
  muted: boolean;
  mutedUntil?: string | null;
  /** When set, conversation is pinned at top of this user's list. */
  pinnedAt?: string | null;
}

export interface ConversationMetadata {
  lessonId?: string;
  /** School-wide chat: all users (incl. future registrants) are members. */
  schoolWide?: boolean;
}

export interface ConversationLastMessage {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  avatarUrl?: string;
  participantIds: string[];
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessage?: ConversationLastMessage;
  unreadCount?: number;
  metadata?: ConversationMetadata;
  pinnedMessageIds?: string[];
  /** Set by API for current viewer — pin in own chat list. */
  viewerPinnedAt?: string | null;
  /** Set by API for current viewer — muted notifications. */
  viewerMuted?: boolean;
}

export type MessageStatus = 'sending' | 'sent' | 'read' | 'failed';

export type MessageType = 'user' | 'system';

export type AttachmentType = 'image' | 'file' | 'audio' | 'video';

export interface MessageAttachment {
  id: string;
  type: AttachmentType;
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  /** Voice note from mic; omit/`file` = regular attachment */
  kind?: 'voice' | 'file';
}

export interface MessageSystemMetadata {
  event:
    | 'member_joined'
    | 'member_left'
    | 'member_added'
    | 'member_removed'
    | 'title_changed'
    | 'pinned'
    | 'unpinned';
  actorId?: string;
  targetUserId?: string;
  previousTitle?: string;
  newTitle?: string;
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface MessageMetadata {
  system?: MessageSystemMetadata;
  reactions?: MessageReaction[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  editedAt?: string;
  deletedAt?: string;
  /** User ids who hid this message locally («удалить у себя»). */
  hiddenForUserIds?: string[];
  status: MessageStatus;
  readBy: string[];
  attachments?: MessageAttachment[];
  clientMutationId?: string;
  replyToMessageId?: string;
  messageType?: MessageType;
  metadata?: MessageMetadata;
  reactions?: MessageReaction[];
}

export interface TypingUser {
  userId: string;
  conversationId: string;
  startedAt: string;
}

export interface MessageSearchResult {
  message: Message;
  conversationId: string;
  conversationTitle: string;
  senderName: string;
}

export type EventType = 'concert' | 'masterclass' | 'competition' | 'invited';

export interface CompetitionApplication {
  pieceTitle: string;
  composer: string;
  durationMinutes: number;
  category?: string;
  notes?: string;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  userId: string;
  createdAt: string;
  application?: CompetitionApplication;
}

export interface SchoolEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  date: string;
  startTime: string;
  endTime?: string;
  location: string;
  imageUrl?: string;
  maxParticipants?: number;
  /** Источник правды для UI мест; синхронизируется с регистрациями. */
  registeredCount?: number;
  registeredUserIds: string[];
  /** Для текущего зрителя (удобно после redact roster). */
  isRegistered?: boolean;
  invitedUserIds?: string[];
}

export type NotificationType =
  | 'lesson'
  | 'reschedule'
  | 'cancel'
  | 'message'
  | 'event'
  | 'assignment'
  | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  link?: string;
  /** Срочное — выделяется в UI (напр. настройка направлений преподавателя). */
  urgent?: boolean;
}

export interface NotificationPreferences {
  userId: string;
  pushEnabled: boolean;
}

export interface UpdateNotificationPreferencesInput {
  pushEnabled?: boolean;
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string;
}

export interface WebPushClientState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  configured: boolean;
}

export interface AuthSession {
  user: User;
  token: string;
}

export interface BookLessonInput {
  teacherId: string;
  directionId: string;
  date: string;
  startTime: string;
  durationMinutes?: number;
}

export interface RescheduleLessonInput {
  date: string;
  startTime: string;
}

// Stage 2 — Assignments (homework materials for groups)
export type AssignmentContentType = 'voice' | 'text' | 'pdf' | 'video' | 'image';

export interface AssignmentContentBlock {
  id: string;
  type: AssignmentContentType;
  order: number;
  text?: string;
  url?: string;
  filename?: string;
  mimeType?: string;
}

export interface AssignmentGroup {
  id: string;
  name: string;
  teacherId: string;
  memberIds: string[];
  /** School-wide recipients (all students). Survives PB id remap. */
  isGeneral?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Group detail with resolved members for UI. */
export interface AssignmentGroupDetail extends AssignmentGroup {
  members: User[];
  canManage: boolean;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  groupId: string;
  dueDate?: string;
  contentBlocks: AssignmentContentBlock[];
  createdAt: string;
  updatedAt: string;
}

// Stage 2 — Support / Help
export type SupportTicketCategory = 'booking' | 'assignments' | 'chat' | 'technical' | 'other';
export type SupportTicketStatus = 'open' | 'answered' | 'closed';

export interface HelpArticle {
  id: string;
  question: string;
  answer: string;
  category: SupportTicketCategory;
  keywords: string[];
}

export interface SupportTicketReply {
  text: string;
  authorId: string;
  createdAt: string;
}

export interface SupportTicketAttachment {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
}

export type MessageReportReason = 'image_rights' | 'harassment' | 'spam' | 'other';

export interface SupportTicketReportContext {
  conversationId: string;
  messageId: string;
  reason: MessageReportReason;
}

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  message: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  attachments: SupportTicketAttachment[];
  adminReply?: SupportTicketReply;
  reportContext?: SupportTicketReportContext;
}

export interface PublicContactInfo {
  phone: string;
  email: string;
  address: string;
  workingHours: string;
}

/** Ссылки школы (опциональные; пустая строка = не задано). */
export interface SchoolSocialLinks {
  vk: string;
  telegram: string;
  youtube: string;
  website: string;
  twoGis: string;
  yandexMaps: string;
}

export interface SchoolDirectionsVideo {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface PublicSchoolInfo {
  name: string;
  tagline: string;
  about: string;
  contacts: PublicContactInfo;
  socialLinks: SchoolSocialLinks;
  directionsVideo?: SchoolDirectionsVideo;
}

export interface PublicTeacher {
  id: string;
  firstName: string;
  lastName: string;
  bio?: string;
  avatarUrl?: string;
  directions: Pick<Direction, 'id' | 'name' | 'icon'>[];
}

export interface PublicEvent {
  id: string;
  title: string;
  description: string;
  type: Exclude<EventType, 'invited'>;
  date: string;
  startTime: string;
  endTime?: string;
  location: string;
  imageUrl?: string;
  maxParticipants?: number;
  spotsLeft?: number;
}

export interface PublicNewsItem {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: string;
}

export interface PublicDirectionDetail extends Direction {
  teachers: PublicTeacher[];
}

export interface PublicLandingData {
  school: PublicSchoolInfo;
  directions: Direction[];
  teachers: PublicTeacher[];
  events: PublicEvent[];
  news: PublicNewsItem[];
}

export type SecurityAlertType =
  | 'new_device'
  | 'password_changed'
  | 'failed_login'
  | 'session_revoked';

export interface SecuritySession {
  id: string;
  userId: string;
  deviceLabel: string;
  platform: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface LoginHistoryEntry {
  id: string;
  userId: string;
  deviceLabel: string;
  ipAddress: string;
  success: boolean;
  createdAt: string;
}

export interface SecurityAlert {
  id: string;
  userId: string;
  type: SecurityAlertType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface SecurityOverview {
  activeSessions: number;
  lastLoginAt?: string;
  passwordChangedAt?: string;
}

export type LegalDocumentType =
  | 'privacy_policy'
  | 'personal_data'
  | 'terms_of_service'
  | 'school_rules';

/**
 * Purpose of processing (152-ФЗ, ст. 9 ч. 4 п. 4).
 *
 * Since 01.09.2025 consent must be collected separately for each purpose, so a
 * document is bound to exactly one purpose and a consent record carries it.
 *
 * - `service` — оказание услуг: запись на занятия, расписание, домашние задания
 * - `communication` — уведомления и рассылки
 * - `publication` — размещение фото/видео и имени на ресурсах школы
 * - `minor_guardian` — согласие законного представителя (ученик младше 18)
 */
export type ConsentPurpose = 'service' | 'communication' | 'publication' | 'minor_guardian';

export interface LegalDocumentVersionHistory {
  version: string;
  effectiveAt: string;
  changeSummary: string;
}

export interface LegalDocument {
  id: string;
  type: LegalDocumentType;
  title: string;
  content: string;
  currentVersion: string;
  effectiveAt: string;
  requiresConsent: boolean;
  /** Purpose this document asks consent for. Absent = informational document. */
  purpose?: ConsentPurpose;
  /** Registration cannot proceed without it (service purposes). */
  required?: boolean;
  versionHistory: LegalDocumentVersionHistory[];
}

export interface UserConsent {
  id: string;
  userId: string;
  documentId: string;
  documentType: LegalDocumentType;
  documentTitle: string;
  version: string;
  acceptedAt: string;
  purpose?: ConsentPurpose;
  /** Set when the subject withdrew consent (152-ФЗ, ст. 9 ч. 2). */
  revokedAt?: string;
  /** Proof of consent — captured server-side, never from the client. */
  ipAddress?: string;
  userAgent?: string;
  /** Version of the consent wording shown at the moment of acceptance. */
  consentTextVersion?: string;
  /** Who signed, when the subject is a minor (purpose `minor_guardian`). */
  guardian?: GuardianDetails;
}

/** Legal representative of a student under 18 (152-ФЗ, ст. 9 ч. 6). */
export interface GuardianDetails {
  fullName: string;
  phone: string;
  relation: string;
}
