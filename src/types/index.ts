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
}

export interface ConversationMetadata {
  lessonId?: string;
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

export interface MessageMetadata {
  system?: MessageSystemMetadata;
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
  status: MessageStatus;
  readBy: string[];
  attachments?: MessageAttachment[];
  clientMutationId?: string;
  replyToMessageId?: string;
  messageType?: MessageType;
  metadata?: MessageMetadata;
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
  registeredUserIds: string[];
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

// Stage 2 — Assignments (homework)
export type AssignmentStatus = 'assigned' | 'submitted' | 'reviewed';
export type AssignmentResponseType = 'text' | 'audio' | 'video' | 'image' | 'file';

export interface AssignmentMaterial {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
}

export interface AssignmentSubmission {
  text?: string;
  attachmentUrl?: string;
  attachmentFilename?: string;
  attachmentMimeType?: string;
  submittedAt: string;
}

export interface AssignmentFeedback {
  text?: string;
  rating?: number;
  audioUrl?: string;
  audioFilename?: string;
  audioMimeType?: string;
  createdAt: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  studentId: string;
  lessonId?: string;
  dueDate: string;
  responseType: AssignmentResponseType;
  status: AssignmentStatus;
  materials: AssignmentMaterial[];
  submission?: AssignmentSubmission;
  feedback?: AssignmentFeedback;
  createdAt: string;
  updatedAt: string;
}

export type AssignmentDisplayStatus = AssignmentStatus | 'overdue';

// Stage 2 — Progress & Achievements
export interface Skill {
  id: string;
  name: string;
  description?: string;
  directionId?: string;
  maxLevel: number;
}

export interface StudentSkillProgress {
  id: string;
  studentId: string;
  skillId: string;
  level: number;
  note?: string;
  updatedAt: string;
}

export type ProgressGoalStatus = 'active' | 'completed';

export interface ProgressGoal {
  id: string;
  studentId: string;
  teacherId?: string;
  title: string;
  description?: string;
  targetDate?: string;
  status: ProgressGoalStatus;
  createdAt: string;
  completedAt?: string;
}

export type ProgressHistoryType =
  | 'lesson'
  | 'assignment'
  | 'skill'
  | 'goal'
  | 'achievement'
  | 'event';

export interface ProgressHistoryEntry {
  id: string;
  studentId: string;
  type: ProgressHistoryType;
  title: string;
  description?: string;
  createdAt: string;
}

export interface AchievementDefinition {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
}

export interface UserAchievement {
  id: string;
  studentId: string;
  achievementId: string;
  unlockedAt: string;
}

export interface StudentProgressSummary {
  studentId: string;
  lessonsCompleted: number;
  lessonsUpcoming: number;
  lessonsTotal: number;
  lessonsAttended: number;
  lessonsMissed: number;
  lessonsCancelled: number;
  /** 0–100; null when no past lessons to measure */
  attendanceRate: number | null;
  assignmentsReviewed: number;
  assignmentsTotal: number;
  activeGoals: number;
  completedGoals: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  averageSkillLevel: number;
}

export interface SkillWithProgress extends Skill {
  level: number;
  progressId?: string;
  note?: string;
  updatedAt?: string;
}

export interface AchievementWithStatus extends AchievementDefinition {
  unlocked: boolean;
  unlockedAt?: string;
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
}

export interface PublicContactInfo {
  phone: string;
  email: string;
  address: string;
  workingHours: string;
}

export interface PublicSchoolInfo {
  name: string;
  tagline: string;
  about: string;
  contacts: PublicContactInfo;
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
  unreadAlerts: number;
  lastLoginAt?: string;
  passwordChangedAt?: string;
}

export type LegalDocumentType =
  | 'privacy_policy'
  | 'personal_data'
  | 'terms_of_service'
  | 'school_rules';

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
}
