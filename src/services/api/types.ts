import type {
  AppNotification,
  Assignment,
  AssignmentContentBlock,
  AssignmentContentType,
  AssignmentGroup,
  AssignmentGroupDetail,
  AuthSession,
  BookLessonInput,
  ConsentPurpose,
  Conversation,
  ConversationMember,
  ConversationType,
  DayAvailability,
  Direction,
  AvailabilityException,
  Lesson,
  LessonHistoryEntry,
  Message,
  MessageAttachment,
  MessageSearchResult,
  RescheduleLessonInput,
  SchoolEvent,
  CompetitionApplication,
  EventRegistration,
  SlotInterval,
  TimeSlot,
  TeacherAvailability,
  PlanningPeriod,
  User,
  UserRole,
  HelpArticle,
  SupportTicket,
  SupportTicketAttachment,
  SupportTicketCategory,
  SupportTicketStatus,
  PublicLandingData,
  PublicDirectionDetail,
  PublicTeacher,
  PublicSchoolInfo,
  SecuritySession,
  LoginHistoryEntry,
  SecurityAlert,
  SecurityOverview,
  LegalDocument,
  UserConsent,
  GuardianDetails,
  NotificationPreferences,
  PushSubscriptionInput,
  UpdateNotificationPreferencesInput,
} from '@/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface PasswordResetRequestResult {
  resetId: string;
  /** Mock stub: demo SMS code until a real provider is connected. */
  demoCode?: string;
}

export interface CompletePasswordResetInput {
  resetId: string;
  code: string;
  newPassword: string;
}

export interface ValidateRegistrationInviteResult {
  valid: boolean;
}

export interface AuthApi {
  login(phone: string, password: string): Promise<AuthSession>;
  demoLogin(role: 'student' | 'teacher' | 'admin'): Promise<AuthSession>;
  /** Guest: check invite from QR without revealing the stored secret. */
  validateRegistrationInvite(token: string): Promise<ValidateRegistrationInviteResult>;
  register(
    phone: string,
    password: string,
    firstName: string,
    lastName: string,
    directionIds: string[],
    inviteToken: string,
  ): Promise<AuthSession>;
  requestPasswordReset(phone: string): Promise<PasswordResetRequestResult>;
  completePasswordReset(input: CompletePasswordResetInput): Promise<void>;
  logout(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  /** Fetch latest user profile from server (role, name, …) without re-login. */
  refreshSession(): Promise<AuthSession | null>;
}

export interface CreateDirectionInput {
  name: string;
  description?: string;
  icon?: string;
}

export interface UpdateDirectionInput {
  name?: string;
  description?: string;
  icon?: string;
}

export interface LessonsApi {
  getDirections(): Promise<Direction[]>;
  createDirection(input: CreateDirectionInput, adminId: string): Promise<Direction>;
  updateDirection(id: string, input: UpdateDirectionInput, adminId: string): Promise<Direction>;
  deleteDirection(id: string, adminId: string): Promise<void>;
  getTeachers(directionId?: string): Promise<User[]>;
  getLessons(filters?: {
    studentId?: string;
    teacherId?: string;
    directionId?: string;
    status?: Lesson['status'];
    from?: string;
    to?: string;
    upcoming?: boolean;
    past?: boolean;
    requesterId?: string;
  }): Promise<Lesson[]>;
  getLesson(id: string, userId: string): Promise<Lesson>;
  getAvailableSlots(params: {
    teacherId: string;
    date: string;
    durationMinutes?: number;
    excludeLessonId?: string;
  }): Promise<TimeSlot[]>;
  bookLesson(input: BookLessonInput, studentId: string): Promise<Lesson>;
  rescheduleLesson(id: string, input: RescheduleLessonInput, userId: string): Promise<Lesson>;
  cancelLesson(id: string, userId: string, reason?: string): Promise<Lesson>;
  getLessonHistory(lessonId: string, userId: string): Promise<LessonHistoryEntry[]>;
  updateTeacherNotes(id: string, notes: string, userId: string): Promise<Lesson>;
}

export interface GetMessagesParams {
  limit?: number;
  cursor?: string;
}

export interface GetMessagesResult {
  messages: Message[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface CreateConversationInput {
  type: ConversationType;
  title?: string;
  participantIds: string[];
  metadata?: Conversation['metadata'];
  /** Teacher/admin: include every school user as a participant (group only). */
  allUsers?: boolean;
  /** Optional group/school chat icon (data URL or stored URL). */
  avatarUrl?: string;
}

export interface SendMessageOptions {
  clientMutationId?: string;
  suppressNotification?: boolean;
  replyToMessageId?: string;
  attachments?: MessageAttachment[];
}

export interface EditMessageInput {
  text: string;
}

export interface UpdateConversationInput {
  title?: string;
  avatarUrl?: string;
}

export interface MuteConversationInput {
  muted: boolean;
  mutedUntil?: string | null;
}

export interface UploadAttachmentInput {
  filename: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
}

export interface ChatApi {
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(conversationId: string, userId: string): Promise<Conversation>;
  getMessages(conversationId: string, userId: string, params?: GetMessagesParams): Promise<GetMessagesResult>;
  getMessage(conversationId: string, messageId: string, userId: string): Promise<Message>;
  sendMessage(
    conversationId: string,
    userId: string,
    text: string,
    options?: SendMessageOptions,
  ): Promise<Message>;
  editMessage(
    conversationId: string,
    messageId: string,
    userId: string,
    input: EditMessageInput,
  ): Promise<Message>;
  deleteMessage(conversationId: string, messageId: string, userId: string): Promise<Message>;
  markAsRead(conversationId: string, userId: string): Promise<void>;
  setOpenConversation(userId: string, conversationId: string | null): Promise<void>;
  createConversation(userId: string, input: CreateConversationInput): Promise<Conversation>;
  getTotalUnread(userId: string): Promise<number>;
  searchMessages(userId: string, query: string): Promise<MessageSearchResult[]>;
  getMembers(conversationId: string, userId: string): Promise<ConversationMember[]>;
  addMember(conversationId: string, userId: string, targetUserId: string): Promise<ConversationMember>;
  removeMember(conversationId: string, userId: string, targetUserId: string): Promise<void>;
  leaveConversation(conversationId: string, userId: string): Promise<void>;
  updateConversation(
    conversationId: string,
    userId: string,
    input: UpdateConversationInput,
  ): Promise<Conversation>;
  muteConversation(
    conversationId: string,
    userId: string,
    input: MuteConversationInput,
  ): Promise<ConversationMember>;
  pinMessage(conversationId: string, messageId: string, userId: string): Promise<Conversation>;
  unpinMessage(conversationId: string, messageId: string, userId: string): Promise<Conversation>;
  pinConversation(conversationId: string, userId: string, pinned: boolean): Promise<ConversationMember>;
  setMessageReaction(
    conversationId: string,
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<Message>;
  forwardMessage(
    sourceConversationId: string,
    messageId: string,
    userId: string,
    targetConversationIds: string[],
  ): Promise<Message[]>;
  deleteConversation(conversationId: string, userId: string): Promise<void>;
  getConversationForLesson(lessonId: string, userId: string): Promise<Conversation | null>;
  uploadAttachment(
    conversationId: string,
    userId: string,
    input: UploadAttachmentInput,
  ): Promise<MessageAttachment>;
  sendTyping(conversationId: string, userId: string, isTyping: boolean): Promise<void>;
}

export interface EventsApi {
  getEvents(userId: string): Promise<SchoolEvent[]>;
  getEvent(id: string, userId: string): Promise<SchoolEvent>;
  getAllEvents(requesterId: string): Promise<SchoolEvent[]>;
  createEvent(input: CreateEventInput, requesterId: string): Promise<SchoolEvent>;
  updateEvent(id: string, input: UpdateEventInput, requesterId: string): Promise<SchoolEvent>;
  deleteEvent(id: string, requesterId: string): Promise<void>;
  getRegistration(eventId: string, userId: string): Promise<EventRegistration | null>;
  register(
    eventId: string,
    userId: string,
    application?: CompetitionApplication,
  ): Promise<SchoolEvent>;
  unregister(eventId: string, userId: string): Promise<SchoolEvent>;
}

export interface CreateEventInput {
  title: string;
  description: string;
  type: SchoolEvent['type'];
  date: string;
  startTime: string;
  endTime?: string;
  location: string;
  imageUrl?: string;
  maxParticipants?: number;
  invitedUserIds?: string[];
}

export type UpdateEventInput = Partial<CreateEventInput>;

export interface UpdateSchoolSettingsInput {
  name?: string;
  tagline?: string;
  about?: string;
  contacts?: Partial<PublicSchoolInfo['contacts']>;
  socialLinks?: Partial<PublicSchoolInfo['socialLinks']>;
  /** Передать `null`, чтобы удалить видео «Как добраться». */
  directionsVideo?: PublicSchoolInfo['directionsVideo'] | null;
}

export interface UploadSchoolDirectionsVideoInput {
  filename: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface RegistrationInviteInfoDto {
  token: string;
  registerUrl: string;
  rotatedAt: string;
}

export interface SchoolSettingsApi {
  getSchoolSettings(requesterId: string): Promise<PublicSchoolInfo>;
  updateSchoolSettings(
    input: UpdateSchoolSettingsInput,
    requesterId: string,
  ): Promise<PublicSchoolInfo>;
  uploadDirectionsVideo(
    input: UploadSchoolDirectionsVideoInput,
    requesterId: string,
  ): Promise<NonNullable<PublicSchoolInfo['directionsVideo']>>;
  removeDirectionsVideo(requesterId: string): Promise<PublicSchoolInfo>;
  /** Admin: current wall QR invite (secret token + deep link). */
  getRegistrationInvite(requesterId: string, origin?: string): Promise<RegistrationInviteInfoDto>;
  /** Admin: rotate token — старый QR перестаёт работать. */
  rotateRegistrationInvite(
    requesterId: string,
    origin?: string,
  ): Promise<RegistrationInviteInfoDto>;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  /** Направления обучения (ученик) или преподавания (teacher/admin). */
  directionIds?: string[];
}

export interface UploadAvatarInput {
  filename: string;
  mimeType: string;
  size: number;
  /** Круглая миниатюра для профиля */
  dataUrl: string;
  /** Полное фото до кадрирования */
  originalDataUrl?: string;
  /** Только обновить миниатюру, оригинал не трогать */
  updateThumbnailOnly?: boolean;
}

/** Everything the app holds about one person — 152-ФЗ ст. 14 (право на доступ). */
export interface PersonalDataExport {
  exportedAt: string;
  profile: User;
  consents: UserConsent[];
  lessons: Lesson[];
  assignments: Assignment[];
  notifications: AppNotification[];
  supportTickets: SupportTicket[];
  loginHistory: LoginHistoryEntry[];
}

export interface UsersApi {
  getUser(id: string, requesterId: string): Promise<User>;
  getAllUsers(requesterId: string): Promise<User[]>;
  updateProfile(requesterId: string, data: UpdateProfileInput): Promise<User>;
  updateUserRole(requesterId: string, userId: string, role: Extract<UserRole, 'student' | 'teacher'>): Promise<User>;
  uploadAvatar(requesterId: string, input: UploadAvatarInput): Promise<User>;
  removeAvatar(requesterId: string): Promise<User>;
  /** Self-service erasure (152-ФЗ, ст. 21). Irreversible. */
  deleteOwnAccount(requesterId: string): Promise<void>;
  exportOwnData(requesterId: string): Promise<PersonalDataExport>;
}

export interface NotificationsApi {
  getNotifications(userId: string): Promise<AppNotification[]>;
  markAsRead(id: string, userId: string): Promise<void>;
  /** Помечает прочитанными все пассивные; urgent (требуют действия) не трогает. */
  markAllAsRead(userId: string): Promise<void>;
  getPreferences(requesterId: string): Promise<NotificationPreferences>;
  updatePreferences(
    requesterId: string,
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences>;
  registerPushSubscription(requesterId: string, input: PushSubscriptionInput): Promise<void>;
  unregisterPushSubscription(requesterId: string, endpoint?: string): Promise<void>;
  hasPushSubscription(requesterId: string): Promise<boolean>;
}

export interface UpdateTeacherAvailabilityInput {
  slotIntervalMinutes: SlotInterval;
  schedule: DayAvailability[];
  defaultLessonDurationMinutes?: number;
  exceptions?: AvailabilityException[];
  planningPeriod?: PlanningPeriod;
}

export interface AvailabilityApi {
  getTeacherAvailability(teacherId: string, requesterId: string): Promise<TeacherAvailability | null>;
  updateTeacherAvailability(
    teacherId: string,
    data: UpdateTeacherAvailabilityInput,
    requesterId: string,
  ): Promise<TeacherAvailability>;
}

export interface CreateAssignmentInput {
  title: string;
  description: string;
  groupId: string;
  dueDate?: string;
  contentBlocks: Omit<AssignmentContentBlock, 'id'>[];
}

export interface UploadAssignmentFileInput {
  filename: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
}

export interface AssignmentsApi {
  getAssignments(filters: {
    requesterId: string;
    groupId?: string;
    teacherId?: string;
  }): Promise<Assignment[]>;
  getAssignment(id: string, requesterId: string): Promise<Assignment>;
  createAssignment(input: CreateAssignmentInput, teacherId: string): Promise<Assignment>;
  uploadAssignmentFile(
    input: UploadAssignmentFileInput,
    userId: string,
    contentType: AssignmentContentType,
  ): Promise<Omit<AssignmentContentBlock, 'id' | 'type' | 'order'>>;
}

export interface CreateAssignmentGroupInput {
  name: string;
}

export interface UpdateAssignmentGroupInput {
  name: string;
}

export interface AssignmentGroupsApi {
  getGroups(requesterId: string): Promise<AssignmentGroup[]>;
  getGroup(id: string, requesterId: string): Promise<AssignmentGroupDetail>;
  createGroup(input: CreateAssignmentGroupInput, requesterId: string): Promise<AssignmentGroup>;
  updateGroup(id: string, input: UpdateAssignmentGroupInput, requesterId: string): Promise<AssignmentGroup>;
  addMember(groupId: string, studentId: string, requesterId: string): Promise<AssignmentGroup>;
  removeMember(groupId: string, studentId: string, requesterId: string): Promise<AssignmentGroup>;
  deleteGroup(id: string, requesterId: string): Promise<void>;
}

export interface CreateSupportTicketInput {
  subject: string;
  message: string;
  category: SupportTicketCategory;
  attachments?: Omit<SupportTicketAttachment, 'id'>[];
}

export interface UploadSupportAttachmentInput {
  filename: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
}

export interface ReplySupportTicketInput {
  text: string;
  close?: boolean;
}

export interface CreateHelpArticleInput {
  question: string;
  answer: string;
  category: SupportTicketCategory;
  keywords?: string[];
}

export interface UpdateHelpArticleInput {
  question?: string;
  answer?: string;
  category?: SupportTicketCategory;
  keywords?: string[];
}

export interface SupportApi {
  getFaqArticles(query?: string): Promise<HelpArticle[]>;
  getTickets(filters: {
    requesterId: string;
    status?: SupportTicketStatus;
    category?: SupportTicketCategory;
    query?: string;
  }): Promise<SupportTicket[]>;
  getTicket(id: string, requesterId: string): Promise<SupportTicket>;
  uploadSupportAttachment(
    input: UploadSupportAttachmentInput,
    userId: string,
  ): Promise<Omit<SupportTicketAttachment, 'id'>>;
  createTicket(input: CreateSupportTicketInput, userId: string): Promise<SupportTicket>;
  replyToTicket(id: string, input: ReplySupportTicketInput, adminId: string): Promise<SupportTicket>;
  createFaqArticle(input: CreateHelpArticleInput, adminId: string): Promise<HelpArticle>;
  updateFaqArticle(id: string, input: UpdateHelpArticleInput, adminId: string): Promise<HelpArticle>;
  deleteFaqArticle(id: string, adminId: string): Promise<void>;
}

export interface PublicApi {
  getLandingData(): Promise<PublicLandingData>;
  getDirection(id: string): Promise<PublicDirectionDetail>;
  getTeacher(id: string): Promise<PublicTeacher>;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface SecurityApi {
  getOverview(requesterId: string): Promise<SecurityOverview>;
  changePassword(requesterId: string, input: ChangePasswordInput): Promise<void>;
  getSessions(requesterId: string, currentToken?: string): Promise<SecuritySession[]>;
  revokeSession(sessionId: string, requesterId: string, currentToken?: string): Promise<void>;
  revokeAllOtherSessions(requesterId: string, currentToken: string): Promise<void>;
  getLoginHistory(requesterId: string): Promise<LoginHistoryEntry[]>;
  getSecurityAlerts(requesterId: string): Promise<SecurityAlert[]>;
  markAlertRead(alertId: string, requesterId: string): Promise<void>;
}

export interface UpdateLegalDocumentInput {
  title?: string;
  content?: string;
  requiresConsent?: boolean;
  purpose?: ConsentPurpose | null;
  required?: boolean;
}

export interface PublishLegalVersionInput {
  content: string;
  changeSummary: string;
  effectiveAt: string;
  version?: string;
}

export interface AcceptConsentOptions {
  /** Required when accepting a `minor_guardian` document. */
  guardian?: GuardianDetails;
}

export interface LegalApi {
  getDocuments(): Promise<LegalDocument[]>;
  getDocument(id: string): Promise<LegalDocument>;
  getUserConsents(requesterId: string): Promise<UserConsent[]>;
  getPendingConsents(requesterId: string): Promise<LegalDocument[]>;
  acceptDocument(
    documentId: string,
    requesterId: string,
    options?: AcceptConsentOptions,
  ): Promise<UserConsent>;
  acceptDocuments(
    documentIds: string[],
    requesterId: string,
    options?: AcceptConsentOptions,
  ): Promise<UserConsent[]>;
  /**
   * Withdraw consent (152-ФЗ, ст. 9 ч. 2). Consents for the `service` purpose
   * cannot be withdrawn on their own — the account must be deleted instead.
   */
  revokeConsent(consentId: string, requesterId: string): Promise<UserConsent>;
  canManageDocuments(requesterId: string): Promise<boolean>;
  updateDocument(
    id: string,
    input: UpdateLegalDocumentInput,
    adminId: string,
  ): Promise<LegalDocument>;
  publishVersion(
    id: string,
    input: PublishLegalVersionInput,
    adminId: string,
  ): Promise<LegalDocument>;
}

export interface ApiClient {
  auth: AuthApi;
  lessons: LessonsApi;
  chat: ChatApi;
  events: EventsApi;
  users: UsersApi;
  notifications: NotificationsApi;
  availability: AvailabilityApi;
  assignments: AssignmentsApi;
  assignmentGroups: AssignmentGroupsApi;
  support: SupportApi;
  public: PublicApi;
  security: SecurityApi;
  legal: LegalApi;
  schoolSettings: SchoolSettingsApi;
}
