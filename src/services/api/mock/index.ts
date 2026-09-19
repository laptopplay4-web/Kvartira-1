import type { AuthSession, Direction, EventRegistration, Lesson, SchoolEvent, User, PublicSchoolInfo } from '@/types';
import {
  DEMO_ACCOUNTS,
  conversationMembers as seedConversationMembers,
  conversations as seedConversations,
  directions as seedDirections,
  events as seedEvents,
  publicSchoolInfo as seedSchoolInfo,
  getDayOfWeekFromDate,
  initialHistory,
  initialLessons,
  initialAssignments,
  initialAssignmentGroups,
  helpArticles as seedHelpArticles,
  initialSupportTickets,
  initialLoginHistory,
  initialSecurityAlerts,
  initialSecuritySessions,
  initialLegalDocuments,
  initialUserConsents,
  messages as seedMessages,
  notifications as seedNotifications,
  teacherAvailabilities as seedTeacherAvailabilities,
  users,
} from '@/mocks/seed';
import { calculateAvailableSlots, slotsConflict } from '@/services/slots/calculateSlots';
import { canViewLesson, canRescheduleLesson, canCancelLesson, canEditTeacherNotes } from '@/services/lessons/access';
import { sanitizeLessonForViewer } from '@/services/lessons/helpers';
import { validateTeacherAvailability } from '@/services/availability/validateAvailability';
import { actsAsTeacher, can, getRoleLabel } from '@/permissions';
import { ApiError } from '@/services/api/types';
import type {
  AuthApi,
  AvailabilityApi,
  ChatApi,
  CompletePasswordResetInput,
  CreateDirectionInput,
  CreateEventInput,
  EventsApi,
  LessonsApi,
  UpdateDirectionInput,
  UpdateTeacherAvailabilityInput,
  UploadAvatarInput,
  UsersApi,
} from '@/services/api/types';
import { createMockChatApi } from './chat';
import { ensureSchoolWideMembership } from '@/services/chat/schoolWide';
import { createMockAssignmentsApi } from './assignments';
import { createMockAssignmentGroupsApi } from './groups';
import { createMockSupportApi } from './support';
import { createMockPublicApi } from './public';
import { buildPasswordMap, createMockSecurityApi, pushAlert, recordAuthLogin } from './security';
import { createMockLegalApi } from './legal';
import { createMockSchoolSettingsApi } from './schoolSettings';
import { createMockNotificationsApi, tryPushNotification } from './notifications';
import { canManageEvents, canRegisterForEvents, canViewSchoolEvent } from '@/services/events/access';
import {
  presentSchoolEvent,
  syncEventRegistrationFields,
} from '@/services/events/registration';
import { eventDetailPath, eventParticipationNotifyLink } from '@/services/events/unread';
import {
  createSeedRegistrationInvite,
  inviteTokensEqual,
  normalizeRegistrationInviteToken,
} from '@/services/registration/invite';
import {
  INVALID_REGISTRATION_INVITE_MESSAGE,
  MISSING_REGISTRATION_INVITE_MESSAGE,
} from '@/services/registration/constants';
import {
  normalizeCompetitionApplication,
  normalizeEventInput,
  validateCompetitionApplication,
  validateEventInput,
} from '@/services/events/validation';
import { resolveEventImageWriteInput } from '@/services/events/imageWrite';
import {
  MOCK_PASSWORD_RESET_CODE,
  PASSWORD_RESET_MIN_LENGTH,
  PASSWORD_RESET_TTL_MS,
} from '@/services/auth/constants';
import {
  validatePasswordResetCode,
  validatePasswordResetNewPassword,
  validatePasswordResetPhone,
} from '@/services/auth/validation';
import { validateUpdateProfileInput } from '@/services/profile/validation';
import { validateAvatarUpload } from '@/services/profile/avatar';
import { buildPersonalDataExport } from '@/services/profile/dataExport';
import {
  getAccountApprovalError,
  getAccountRejectError,
  getUserRoleChangeError,
} from '@/services/users/access';
import {
  ACCOUNT_APPROVED_NOTIFY_BODY,
  ACCOUNT_APPROVED_NOTIFY_LINK,
  ACCOUNT_APPROVED_NOTIFY_TITLE,
  ACCOUNT_STATUS_ACTIVE,
  ACCOUNT_STATUS_PENDING,
  PENDING_REGISTRATION_NOTIFY_LINK,
  PENDING_REGISTRATION_NOTIFY_TITLE,
  pendingRegistrationNotifyBody,
} from '@/services/users/accountStatus';
import { sanitizeUserPhoneForViewer, sanitizeUsersPhoneForViewer, preserveOwnPhone } from '@/services/users/helpers';
import { readPersistedLoginPhone, resolveOwnPhoneNumber } from '@/services/auth/ownPhone';
import { canManageDirections } from '@/services/directions/access';
import {
  normalizeDirectionIds,
  normalizeDirectionInput,
  validateDirectionIdsSelection,
  validateDirectionInput,
} from '@/services/directions/validation';
import {
  TEACHER_DIRECTIONS_SETUP_BODY,
  TEACHER_DIRECTIONS_SETUP_LINK,
  TEACHER_DIRECTIONS_SETUP_TITLE,
} from '@/services/directions/constants';
import {
  ensureTeacherDirectionsSetupNotification,
  markTeacherDirectionsSetupNotificationsRead,
} from '@/services/directions/notifications';

interface PasswordResetRequest {
  id: string;
  userId: string | null;
  phone: string;
  code: string;
  expiresAt: string;
  used: boolean;
}

const delay = (ms = 120): Promise<void> => new Promise((r) => setTimeout(r, ms));

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function seedEventRegistrationsFromEvents(eventsList: SchoolEvent[]): EventRegistration[] {
  const regs: EventRegistration[] = [];
  for (const event of eventsList) {
    syncEventRegistrationFields(event);
    for (const userId of event.registeredUserIds) {
      regs.push({
        id: `event-reg-seed-${event.id}-${userId}`,
        eventId: event.id,
        userId,
        createdAt: '2026-08-01T00:00:00.000Z',
      });
    }
  }
  return regs;
}

class MockDatabase {
  users = structuredClone(users);
  directions: Direction[] = structuredClone(seedDirections);
  lessons = structuredClone(initialLessons);
  history = structuredClone(initialHistory);
  conversations = structuredClone(seedConversations);
  conversationMembers = structuredClone(seedConversationMembers);
  messages = structuredClone(seedMessages);
  events = structuredClone(seedEvents);
  schoolInfo: PublicSchoolInfo = structuredClone(seedSchoolInfo);
  registrationInvite = createSeedRegistrationInvite('2026-09-01T00:00:00.000Z');
  eventRegistrations: EventRegistration[] = seedEventRegistrationsFromEvents(this.events);
  notifications = structuredClone(seedNotifications);
  notificationPreferences = new Map();
  pushDeliveries = [];
  pushSubscriptions = [];
  teacherAvailabilities = structuredClone(seedTeacherAvailabilities);
  assignments = structuredClone(initialAssignments);
  assignmentGroups = structuredClone(initialAssignmentGroups);
  helpArticles = structuredClone(seedHelpArticles);
  supportTickets = structuredClone(initialSupportTickets);
  loginHistory = structuredClone(initialLoginHistory);
  securityAlerts = structuredClone(initialSecurityAlerts);
  securitySessions = structuredClone(initialSecuritySessions);
  legalDocuments = structuredClone(initialLegalDocuments);
  userConsents = structuredClone(initialUserConsents);
  passwords = buildPasswordMap(users);
  passwordChangedAt = new Map<string, string>();
  passwordResets = new Map<string, PasswordResetRequest>();
  sessions = new Map<string, AuthSession>();
  bookingLocks = new Map<string, Promise<void>>();
  openConversations = new Map<string, string>();
}

const db = new MockDatabase();

function getPasswordForUser(user: User): string {
  return db.passwords.get(user.id) ?? 'password';
}

function getUserById(userId: string): User {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
  return user;
}

function assertLessonAccess(lesson: Lesson, userId: string): void {
  const user = getUserById(userId);
  if (!canViewLesson(user, lesson)) {
    throw new ApiError('Нет доступа к занятию', 'FORBIDDEN', 403);
  }
}

function assertAvailabilityAccess(teacherId: string, requesterId: string): void {
  const requester = getUserById(requesterId);
  if (!can(requester, 'availability:manage')) {
    throw new ApiError('Нет доступа к графику работы', 'FORBIDDEN', 403);
  }
  if (requester.role === 'teacher' && requester.id !== teacherId) {
    throw new ApiError('Нет доступа к графику работы', 'FORBIDDEN', 403);
  }
  const teacher = getUserById(teacherId);
  if (!actsAsTeacher(teacher.role)) {
    throw new ApiError('Пользователь не является преподавателем', 'INVALID_USER', 400);
  }
}

function bookingLockKey(teacherId: string, date: string, startTime: string): string {
  return `${teacherId}:${date}:${startTime}`;
}

function pushNotification(
  userId: string,
  type: 'lesson' | 'reschedule' | 'cancel' | 'assignment' | 'system' | 'event',
  title: string,
  body: string,
  link?: string,
  urgent?: boolean,
) {
  tryPushNotification(db, userId, type, title, body, link, urgent);
}

function afterAuthSession(user: User): void {
  ensureTeacherDirectionsSetupNotification(user, db.notifications, pushNotification);
}

async function withBookingLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = db.bookingLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const current = previous.then(() => gate);
  db.bookingLocks.set(key, current);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (db.bookingLocks.get(key) === current) {
      db.bookingLocks.delete(key);
    }
  }
}

export const mockAuthApi: AuthApi = {
  async login(phone, password) {
    await delay();
    const user = db.users.find((u) => u.phone === phone);
    if (!user || getPasswordForUser(user) !== password) {
      if (user) {
        recordAuthLogin(db, user.id, uid('token'), false);
      }
      throw new ApiError('Неверный телефон или пароль', 'INVALID_CREDENTIALS', 401);
    }
    const session: AuthSession = { user, token: uid('token') };
    db.sessions.set(session.token, session);
    recordAuthLogin(db, user.id, session.token, true);
    afterAuthSession(user);
    return session;
  },

  async demoLogin(role) {
    await delay(80);
    const account = DEMO_ACCOUNTS[role];
    const user = db.users.find((u) => u.phone === account.phone);
    if (!user) throw new ApiError('Демо-аккаунт не найден', 'NOT_FOUND', 404);
    const session: AuthSession = { user, token: uid('token') };
    db.sessions.set(session.token, session);
    recordAuthLogin(db, user.id, session.token, true);
    afterAuthSession(user);
    return session;
  },

  async validateRegistrationInvite(token) {
    await delay(40);
    const normalized = normalizeRegistrationInviteToken(token);
    const stored = db.registrationInvite?.token ?? '';
    return { valid: !!normalized && inviteTokensEqual(normalized, stored) };
  },

  async register(phone, password, firstName, lastName, directionIds, inviteToken) {
    await delay();
    const normalizedInvite = normalizeRegistrationInviteToken(inviteToken);
    if (!normalizedInvite) {
      throw new ApiError(MISSING_REGISTRATION_INVITE_MESSAGE, 'INVITE_REQUIRED', 403);
    }
    if (!inviteTokensEqual(normalizedInvite, db.registrationInvite.token)) {
      throw new ApiError(INVALID_REGISTRATION_INVITE_MESSAGE, 'INVITE_INVALID', 403);
    }
    if (db.users.some((u) => u.phone === phone)) {
      throw new ApiError('Пользователь с таким телефоном уже существует', 'DUPLICATE', 409);
    }
    const idsError = validateDirectionIdsSelection(directionIds, db.directions, { required: true });
    if (idsError) {
      throw new ApiError(idsError, 'VALIDATION_ERROR', 400);
    }
    const user: User = {
      id: uid('user'),
      phone,
      role: 'student',
      firstName,
      lastName,
      directionIds: normalizeDirectionIds(directionIds),
      accountStatus: ACCOUNT_STATUS_PENDING,
    };
    db.users.push(user);
    db.passwords.set(user.id, password);
    ensureSchoolWideMembership(db, user.id);
    const notifyBody = pendingRegistrationNotifyBody(user);
    for (const admin of db.users.filter((u) => u.role === 'admin')) {
      tryPushNotification(
        db,
        admin.id,
        'system',
        PENDING_REGISTRATION_NOTIFY_TITLE,
        notifyBody,
        PENDING_REGISTRATION_NOTIFY_LINK,
        true,
      );
    }
    const session: AuthSession = { user, token: uid('token') };
    db.sessions.set(session.token, session);
    recordAuthLogin(db, user.id, session.token, true);
    return session;
  },

  async requestPasswordReset(phone) {
    await delay();
    const phoneError = validatePasswordResetPhone(phone);
    if (phoneError) {
      throw new ApiError(phoneError, 'VALIDATION', 400);
    }

    const user = db.users.find((u) => u.phone === phone) ?? null;
    const resetId = uid('reset');
    const request: PasswordResetRequest = {
      id: resetId,
      userId: user?.id ?? null,
      phone,
      code: MOCK_PASSWORD_RESET_CODE,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString(),
      used: false,
    };
    db.passwordResets.set(resetId, request);

    return {
      resetId,
      demoCode: MOCK_PASSWORD_RESET_CODE,
    };
  },

  async completePasswordReset(input: CompletePasswordResetInput) {
    await delay();
    const codeError = validatePasswordResetCode(input.code);
    if (codeError) {
      throw new ApiError(codeError, 'VALIDATION', 400);
    }
    const passwordError = validatePasswordResetNewPassword(input.newPassword, input.newPassword);
    if (passwordError) {
      throw new ApiError(passwordError, 'VALIDATION', 400);
    }
    if (input.newPassword.length < PASSWORD_RESET_MIN_LENGTH) {
      throw new ApiError(
        `Пароль должен содержать минимум ${PASSWORD_RESET_MIN_LENGTH} символов`,
        'VALIDATION',
        400,
      );
    }

    const request = db.passwordResets.get(input.resetId);
    if (!request || request.used) {
      throw new ApiError('Неверный или просроченный код', 'INVALID_RESET', 400);
    }
    if (new Date(request.expiresAt) < new Date()) {
      throw new ApiError('Неверный или просроченный код', 'INVALID_RESET', 400);
    }
    if (!request.userId || request.code !== input.code.trim()) {
      throw new ApiError('Неверный или просроченный код', 'INVALID_RESET', 400);
    }

    const user = getUserById(request.userId);
    const currentPassword = getPasswordForUser(user);
    if (currentPassword === input.newPassword) {
      throw new ApiError('Новый пароль должен отличаться от текущего', 'VALIDATION', 400);
    }

    db.passwords.set(request.userId, input.newPassword);
    const changedAt = new Date().toISOString();
    db.passwordChangedAt.set(request.userId, changedAt);
    request.used = true;

    pushAlert(
      db,
      request.userId,
      'password_changed',
      'Пароль изменён',
      'Пароль вашего аккаунта был успешно обновлён через восстановление.',
    );
  },

  async logout() {
    await delay(50);
  },

  async getSession() {
    return null;
  },

  async refreshSession() {
    await delay(30);
    const { useAuthStore } = await import('@/stores/authStore');
    const current = useAuthStore.getState().session;
    if (!current?.user?.id || !current.token) return null;
    const user = db.users.find((u) => u.id === current.user.id);
    if (!user) {
      throw new ApiError('Сессия недействительна', 'UNAUTHORIZED', 401);
    }
    const session: AuthSession = {
      token: current.token,
      user: structuredClone(user),
    };
    db.sessions.set(current.token, session);
    return session;
  },
};

export const mockLessonsApi: LessonsApi = {
  async getDirections() {
    await delay();
    return structuredClone(db.directions);
  },

  async createDirection(input: CreateDirectionInput, adminId) {
    await delay();
    const admin = getUserById(adminId);
    if (!canManageDirections(admin)) {
      throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
    }
    const validationError = validateDirectionInput(input);
    if (validationError) {
      throw new ApiError(validationError, 'VALIDATION_ERROR', 400);
    }
    const normalized = normalizeDirectionInput(input);
    const duplicate = db.directions.some(
      (d) => d.name.toLowerCase() === normalized.name.toLowerCase(),
    );
    if (duplicate) {
      throw new ApiError('Направление с таким названием уже есть', 'DUPLICATE', 409);
    }
    const direction: Direction = {
      id: uid('dir'),
      ...normalized,
    };
    db.directions.push(direction);
    return structuredClone(direction);
  },

  async updateDirection(id: string, input: UpdateDirectionInput, adminId) {
    await delay();
    const admin = getUserById(adminId);
    if (!canManageDirections(admin)) {
      throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
    }
    const direction = db.directions.find((d) => d.id === id);
    if (!direction) {
      throw new ApiError('Направление не найдено', 'NOT_FOUND', 404);
    }
    const nextName = input.name !== undefined ? input.name : direction.name;
    const nextDescription =
      input.description !== undefined ? input.description : direction.description;
    const nextIcon = input.icon !== undefined ? input.icon : direction.icon;
    const validationError = validateDirectionInput({
      name: nextName,
      description: nextDescription,
      icon: nextIcon,
    });
    if (validationError) {
      throw new ApiError(validationError, 'VALIDATION_ERROR', 400);
    }
    const normalized = normalizeDirectionInput({
      name: nextName,
      description: nextDescription,
      icon: nextIcon,
    });
    const duplicate = db.directions.some(
      (d) => d.id !== id && d.name.toLowerCase() === normalized.name.toLowerCase(),
    );
    if (duplicate) {
      throw new ApiError('Направление с таким названием уже есть', 'DUPLICATE', 409);
    }
    direction.name = normalized.name;
    if (normalized.description) direction.description = normalized.description;
    else delete direction.description;
    if (normalized.icon) direction.icon = normalized.icon;
    else delete direction.icon;
    return structuredClone(direction);
  },

  async deleteDirection(id: string, adminId) {
    await delay();
    const admin = getUserById(adminId);
    if (!canManageDirections(admin)) {
      throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
    }
    const index = db.directions.findIndex((d) => d.id === id);
    if (index < 0) {
      throw new ApiError('Направление не найдено', 'NOT_FOUND', 404);
    }
    if (db.lessons.some((l) => l.directionId === id)) {
      throw new ApiError('Нельзя удалить направление: есть занятия', 'CONFLICT', 409);
    }
    if (db.users.some((u) => u.directionIds?.includes(id))) {
      throw new ApiError('Нельзя удалить направление: оно назначено пользователям', 'CONFLICT', 409);
    }
    db.directions.splice(index, 1);
  },

  async getTeachers(directionId) {
    await delay();
    return db.users
      .filter((u) => {
        if (u.role !== 'teacher') return false;
        if (!directionId) return true;
        return u.directionIds?.includes(directionId);
      })
      .map((u) => ({ ...u, phone: '' }));
  },

  async getLessons(filters) {
    await delay();
    const now = new Date();
    const requester = filters?.requesterId ? getUserById(filters.requesterId) : null;

    return db.lessons.filter((lesson) => {
      if (requester && !canViewLesson(requester, lesson)) return false;
      if (filters?.studentId && lesson.studentId !== filters.studentId) return false;
      if (filters?.teacherId && lesson.teacherId !== filters.teacherId) return false;
      if (filters?.directionId && lesson.directionId !== filters.directionId) return false;
      if (filters?.status && lesson.status !== filters.status) return false;
      if (filters?.from && lesson.date < filters.from) return false;
      if (filters?.to && lesson.date > filters.to) return false;

      const lessonDate = new Date(`${lesson.date}T${lesson.startTime}`);
      if (filters?.upcoming && lessonDate < now && lesson.status !== 'scheduled' && lesson.status !== 'confirmed') {
        return false;
      }
      if (filters?.past && lessonDate >= now && lesson.status !== 'completed' && lesson.status !== 'cancelled') {
        return false;
      }
      return true;
    });
  },

  async getLesson(id, userId) {
    await delay();
    const lesson = db.lessons.find((l) => l.id === id);
    if (!lesson) throw new ApiError('Занятие не найдено', 'NOT_FOUND', 404);
    assertLessonAccess(lesson, userId);
    const user = getUserById(userId);
    return sanitizeLessonForViewer(lesson, user);
  },

  async getAvailableSlots({ teacherId, date, durationMinutes, excludeLessonId }) {
    await delay();
    const availability = db.teacherAvailabilities.find((a) => a.teacherId === teacherId);
    if (!availability) return [];

    return calculateAvailableSlots({
      availability,
      existingLessons: db.lessons,
      date,
      dayOfWeek: getDayOfWeekFromDate(date),
      lessonDurationMinutes: durationMinutes ?? availability.defaultLessonDurationMinutes,
      excludeLessonId,
    });
  },

  async bookLesson(input, studentId) {
    const lockKey = bookingLockKey(input.teacherId, input.date, input.startTime);
    return withBookingLock(lockKey, async () => {
      await delay(150);
      const availability = db.teacherAvailabilities.find((a) => a.teacherId === input.teacherId);
      if (!availability) throw new ApiError('Преподаватель недоступен', 'NOT_FOUND', 404);

      const duration = input.durationMinutes ?? availability.defaultLessonDurationMinutes;
      const slots = await mockLessonsApi.getAvailableSlots({
        teacherId: input.teacherId,
        date: input.date,
        durationMinutes: duration,
      });

      const slotExists = slots.some((s) => s.startTime === input.startTime);
      if (!slotExists) {
        throw new ApiError(
          'Этот слот уже занят. Выберите другое время.',
          'SLOT_UNAVAILABLE',
          409,
        );
      }

      if (slotsConflict(db.lessons, input.teacherId, input.date, input.startTime, duration)) {
        throw new ApiError('Этот слот уже занят. Выберите другое время.', 'SLOT_CONFLICT', 409);
      }

      const now = new Date().toISOString();
      const lesson: Lesson = {
        id: uid('lesson'),
        studentId,
        teacherId: input.teacherId,
        directionId: input.directionId,
        date: input.date,
        startTime: input.startTime,
        durationMinutes: duration,
        status: 'scheduled',
        location: 'Студия',
        createdAt: now,
        updatedAt: now,
      };

      db.lessons.push(lesson);
      db.history.push({
        id: uid('hist'),
        lessonId: lesson.id,
        action: 'created',
        newDate: lesson.date,
        newStartTime: lesson.startTime,
        userId: studentId,
        createdAt: now,
      });

      pushNotification(
        studentId,
        'lesson',
        'Занятие запланировано',
        `${lesson.date} в ${lesson.startTime}`,
        `/lessons/${lesson.id}`,
      );

      const teacher = db.users.find((u) => u.id === input.teacherId);
      if (teacher) {
        pushNotification(
          teacher.id,
          'lesson',
          'Новая запись',
          `${lesson.date} в ${lesson.startTime}`,
          `/lessons/${lesson.id}`,
        );
      }

      return lesson;
    });
  },

  async rescheduleLesson(id, input, userId) {
    const lesson = db.lessons.find((l) => l.id === id);
    if (!lesson) throw new ApiError('Занятие не найдено', 'NOT_FOUND', 404);

    const user = getUserById(userId);
    if (!canRescheduleLesson(user, lesson)) {
      throw new ApiError('Нет прав на перенос занятия', 'FORBIDDEN', 403);
    }

    const lockKey = bookingLockKey(lesson.teacherId, input.date, input.startTime);
    return withBookingLock(lockKey, async () => {
      await delay(150);
      if (lesson.status === 'cancelled' || lesson.status === 'completed') {
        throw new ApiError('Нельзя перенести это занятие', 'INVALID_STATUS', 400);
      }

      const availability = db.teacherAvailabilities.find((a) => a.teacherId === lesson.teacherId);
      if (!availability) throw new ApiError('Преподаватель недоступен', 'NOT_FOUND', 404);

      const slots = await mockLessonsApi.getAvailableSlots({
        teacherId: lesson.teacherId,
        date: input.date,
        durationMinutes: lesson.durationMinutes,
        excludeLessonId: id,
      });

      if (!slots.some((s) => s.startTime === input.startTime)) {
        throw new ApiError('Это время больше недоступно. Выберите другое.', 'SLOT_UNAVAILABLE', 409);
      }

      if (
        slotsConflict(
          db.lessons,
          lesson.teacherId,
          input.date,
          input.startTime,
          lesson.durationMinutes,
          id,
        )
      ) {
        throw new ApiError('Это время больше недоступно. Выберите другое.', 'SLOT_CONFLICT', 409);
      }

      const prevDate = lesson.date;
      const prevTime = lesson.startTime;
      lesson.date = input.date;
      lesson.startTime = input.startTime;
      lesson.status = 'rescheduled';
      lesson.updatedAt = new Date().toISOString();

      db.history.push({
        id: uid('hist'),
        lessonId: id,
        action: 'rescheduled',
        previousDate: prevDate,
        previousStartTime: prevTime,
        newDate: input.date,
        newStartTime: input.startTime,
        userId,
        createdAt: lesson.updatedAt,
      });

      pushNotification(
        lesson.studentId,
        'reschedule',
        'Занятие перенесено',
        `${prevDate} ${prevTime} → ${input.date} ${input.startTime}`,
        `/lessons/${id}`,
      );

      if (lesson.teacherId !== userId) {
        pushNotification(
          lesson.teacherId,
          'reschedule',
          'Занятие перенесено',
          `${prevDate} ${prevTime} → ${input.date} ${input.startTime}`,
          `/lessons/${id}`,
        );
      }

      return lesson;
    });
  },

  async cancelLesson(id, userId, reason) {
    await delay(150);
    const lesson = db.lessons.find((l) => l.id === id);
    if (!lesson) throw new ApiError('Занятие не найдено', 'NOT_FOUND', 404);

    const user = getUserById(userId);
    if (!canCancelLesson(user, lesson)) {
      throw new ApiError('Нет прав на отмену занятия', 'FORBIDDEN', 403);
    }
    if (lesson.status === 'cancelled') {
      throw new ApiError('Занятие уже отменено', 'ALREADY_CANCELLED', 400);
    }

    lesson.status = 'cancelled';
    lesson.cancelReason = reason;
    lesson.updatedAt = new Date().toISOString();

    db.history.push({
      id: uid('hist'),
      lessonId: id,
      action: 'cancelled',
      reason,
      userId,
      createdAt: lesson.updatedAt,
    });

    pushNotification(
      lesson.studentId,
      'cancel',
      'Занятие отменено',
      `${lesson.date} в ${lesson.startTime}`,
      `/lessons/${id}`,
    );

    if (lesson.teacherId !== userId) {
      pushNotification(
        lesson.teacherId,
        'cancel',
        'Занятие отменено',
        `${lesson.date} в ${lesson.startTime}`,
        `/lessons/${id}`,
      );
    }

    return lesson;
  },

  async getLessonHistory(lessonId, userId) {
    await delay();
    const lesson = db.lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new ApiError('Занятие не найдено', 'NOT_FOUND', 404);
    assertLessonAccess(lesson, userId);
    return db.history.filter((h) => h.lessonId === lessonId);
  },

  async updateTeacherNotes(id, notes, userId) {
    await delay();
    const lesson = db.lessons.find((l) => l.id === id);
    if (!lesson) throw new ApiError('Занятие не найдено', 'NOT_FOUND', 404);

    const user = getUserById(userId);
    if (!canEditTeacherNotes(user, lesson)) {
      throw new ApiError('Нет прав на редактирование заметок', 'FORBIDDEN', 403);
    }

    lesson.teacherNotes = notes.trim() || undefined;
    lesson.updatedAt = new Date().toISOString();
    return lesson;
  },
};

export const mockChatApi: ChatApi = createMockChatApi(db, delay);
export const mockAssignmentsApi = createMockAssignmentsApi(db, delay);
export const mockAssignmentGroupsApi = createMockAssignmentGroupsApi(db, delay);
export const mockSupportApi = createMockSupportApi(db, delay);
export const mockPublicApi = createMockPublicApi(db, delay);
export const mockSecurityApi = createMockSecurityApi(db, delay);
export const mockLegalApi = createMockLegalApi(db, delay);
export const mockSchoolSettingsApi = createMockSchoolSettingsApi(db, delay, getUserById);


function notifyStaffEventRegistration(event: SchoolEvent, studentId: string) {
  const student = getUserById(studentId);
  const studentName = student
    ? `${student.firstName} ${student.lastName}`.trim()
    : 'Ученик';
  const title = 'Новая запись на мероприятие';
  const body = `${studentName} записался(ась) на «${event.title}»`;
  const link = eventParticipationNotifyLink(event.id, studentId, 'join');
  for (const user of db.users) {
    if (user.role === 'teacher' || user.role === 'admin') {
      tryPushNotification(db, user.id, 'event', title, body, link);
    }
  }
}

function notifyStaffEventCancellation(
  event: SchoolEvent,
  studentId: string,
  reason: 'cancelled' | 'removed',
) {
  const student = getUserById(studentId);
  const studentName = student
    ? `${student.firstName} ${student.lastName}`.trim()
    : 'Ученик';
  const title =
    reason === 'removed' ? 'Участник удалён с мероприятия' : 'Отмена участия в мероприятии';
  const body =
    reason === 'removed'
      ? `${studentName} удалён(а) из «${event.title}»`
      : `${studentName} отменил(а) участие в «${event.title}»`;
  const link = eventParticipationNotifyLink(event.id, studentId, 'leave');
  for (const user of db.users) {
    if (user.role === 'teacher' || user.role === 'admin') {
      tryPushNotification(db, user.id, 'event', title, body, link);
    }
  }
}

/** Ученикам — о новом мероприятии (бейдж «События»; не inbox). */
function notifyStudentsNewEvent(event: SchoolEvent) {
  const title = 'Новое мероприятие';
  const body = event.title;
  const link = eventDetailPath(event.id);
  const invited =
    event.type === 'invited' ? new Set(event.invitedUserIds ?? []) : null;

  for (const user of db.users) {
    if (user.role !== 'student') continue;
    if (invited && !invited.has(user.id)) continue;
    tryPushNotification(db, user.id, 'event', title, body, link);
  }
}

function assertEventsAdminAccess(requesterId: string) {
  const user = getUserById(requesterId);
  if (!user || !canManageEvents(user)) {
    throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
  }
}

function presentEventForViewer(event: SchoolEvent, userId: string): SchoolEvent {
  syncEventRegistrationFields(event);
  const viewer = getUserById(userId);
  const hideRoster = !canManageEvents(viewer);
  return presentSchoolEvent(structuredClone(event), userId, { hideRoster });
}

export const mockEventsApi: EventsApi = {
  async getEvents(userId) {
    await delay();
    const viewer = getUserById(userId);
    return db.events
      .filter((e) => canViewSchoolEvent(userId, e, viewer))
      .map((e) => presentEventForViewer(e, userId));
  },

  async getEvent(id, userId) {
    await delay();
    const event = db.events.find((e) => e.id === id);
    if (!event) throw new ApiError('Мероприятие не найдено', 'NOT_FOUND', 404);
    const viewer = getUserById(userId);
    if (!canViewSchoolEvent(userId, event, viewer)) {
      throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
    }
    return presentEventForViewer(event, userId);
  },

  async getRegistration(eventId, userId) {
    await delay();
    await mockEventsApi.getEvent(eventId, userId);
    return db.eventRegistrations.find((r) => r.eventId === eventId && r.userId === userId) ?? null;
  },

  async getEventParticipants(eventId, requesterId) {
    await delay();
    assertEventsAdminAccess(requesterId);
    const event = db.events.find((e) => e.id === eventId);
    if (!event) throw new ApiError('Мероприятие не найдено', 'NOT_FOUND', 404);
    const viewer = getUserById(requesterId)!;
    const fromRegs = db.eventRegistrations
      .filter((r) => r.eventId === eventId)
      .map((r) => r.userId);
    const memberIds = fromRegs.length > 0 ? fromRegs : event.registeredUserIds;
    return [...new Set(memberIds)]
      .map((id) => getUserById(id))
      .filter((u): u is User => !!u)
      .map((u) => sanitizeUserPhoneForViewer(u, viewer));
  },

  async register(eventId, userId, application) {
    await delay();
    const requester = getUserById(userId);
    if (!canRegisterForEvents(requester)) {
      throw new ApiError('Запись на мероприятие доступна только ученикам', 'FORBIDDEN', 403);
    }
    const event = db.events.find((e) => e.id === eventId);
    if (!event) throw new ApiError('Мероприятие не найдено', 'NOT_FOUND', 404);
    if (event.type === 'invited' && !event.invitedUserIds?.includes(userId)) {
      throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
    }

    syncEventRegistrationFields(event);
    const alreadyRegistered = event.registeredUserIds.includes(userId);
    if (
      !alreadyRegistered &&
      event.maxParticipants &&
      (event.registeredCount ?? event.registeredUserIds.length) >= event.maxParticipants
    ) {
      throw new ApiError('Мест больше нет', 'FULL', 409);
    }

    if (event.type === 'competition') {
      if (!application) {
        throw new ApiError('Заполните заявку на конкурс', 'VALIDATION', 400);
      }
      const validationError = validateCompetitionApplication(application);
      if (validationError) {
        throw new ApiError(validationError, 'VALIDATION', 400);
      }
    }

    let createdNew = false;
    if (!alreadyRegistered) {
      event.registeredUserIds.push(userId);
      syncEventRegistrationFields(event);
      createdNew = true;
    }

    const existingReg = db.eventRegistrations.find(
      (r) => r.eventId === eventId && r.userId === userId,
    );
    const normalized =
      event.type === 'competition' && application
        ? normalizeCompetitionApplication(application)
        : undefined;

    if (existingReg) {
      if (normalized) existingReg.application = normalized;
    } else {
      db.eventRegistrations.push({
        id: uid('event-reg'),
        eventId,
        userId,
        createdAt: new Date().toISOString(),
        ...(normalized ? { application: normalized } : {}),
      });
    }

    if (createdNew) {
      notifyStaffEventRegistration(event, userId);
    }

    return presentEventForViewer(event, userId);
  },

  async unregister(eventId, userId) {
    await delay();
    const requester = getUserById(userId);
    if (!canRegisterForEvents(requester)) {
      throw new ApiError('Отмена участия доступна только ученикам', 'FORBIDDEN', 403);
    }
    const event = db.events.find((e) => e.id === eventId);
    if (!event) throw new ApiError('Мероприятие не найдено', 'NOT_FOUND', 404);
    if (event.type === 'invited' && !event.invitedUserIds?.includes(userId)) {
      throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
    }
    const wasRegistered =
      event.registeredUserIds.includes(userId) ||
      db.eventRegistrations.some((r) => r.eventId === eventId && r.userId === userId);
    event.registeredUserIds = event.registeredUserIds.filter((id) => id !== userId);
    syncEventRegistrationFields(event);
    db.eventRegistrations = db.eventRegistrations.filter(
      (r) => !(r.eventId === eventId && r.userId === userId),
    );
    if (wasRegistered) {
      notifyStaffEventCancellation(event, userId, 'cancelled');
    }
    return presentEventForViewer(event, userId);
  },

  async removeEventParticipant(eventId, participantUserId, requesterId) {
    await delay();
    assertEventsAdminAccess(requesterId);
    const event = db.events.find((e) => e.id === eventId);
    if (!event) throw new ApiError('Мероприятие не найдено', 'NOT_FOUND', 404);
    const wasRegistered =
      event.registeredUserIds.includes(participantUserId) ||
      db.eventRegistrations.some(
        (r) => r.eventId === eventId && r.userId === participantUserId,
      );
    event.registeredUserIds = event.registeredUserIds.filter((id) => id !== participantUserId);
    syncEventRegistrationFields(event);
    db.eventRegistrations = db.eventRegistrations.filter(
      (r) => !(r.eventId === eventId && r.userId === participantUserId),
    );
    if (wasRegistered) {
      notifyStaffEventCancellation(event, participantUserId, 'removed');
    }
    return presentEventForViewer(event, requesterId);
  },

  async getAllEvents(requesterId) {
    await delay();
    assertEventsAdminAccess(requesterId);
    return db.events.map((e) => {
      syncEventRegistrationFields(e);
      return presentSchoolEvent(structuredClone(e), requesterId, { hideRoster: false });
    });
  },

  async createEvent(input, requesterId) {
    await delay();
    assertEventsAdminAccess(requesterId);
    const normalized = normalizeEventInput(input) as CreateEventInput;
    const validationError = validateEventInput(normalized);
    if (validationError) {
      throw new ApiError(validationError, 'VALIDATION', 400);
    }

    const event: SchoolEvent = {
      id: uid('event'),
      title: normalized.title,
      description: normalized.description,
      type: normalized.type,
      date: normalized.date,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      location: normalized.location,
      imageUrl: normalized.imageUrl,
      maxParticipants: normalized.maxParticipants,
      registeredCount: 0,
      registeredUserIds: [],
      invitedUserIds: normalized.type === 'invited' ? normalized.invitedUserIds : undefined,
    };

    db.events.push(event);
    notifyStudentsNewEvent(event);
    return presentEventForViewer(event, requesterId);
  },

  async updateEvent(id, input, requesterId) {
    await delay();
    assertEventsAdminAccess(requesterId);
    const event = db.events.find((e) => e.id === id);
    if (!event) throw new ApiError('Мероприятие не найдено', 'NOT_FOUND', 404);

    const imageProvided = Object.prototype.hasOwnProperty.call(input, 'imageUrl');
    const merged: CreateEventInput = {
      title: input.title ?? event.title,
      description: input.description ?? event.description,
      type: input.type ?? event.type,
      date: input.date ?? event.date,
      startTime: input.startTime ?? event.startTime,
      endTime: input.endTime ?? event.endTime,
      location: input.location ?? event.location,
      imageUrl: resolveEventImageWriteInput(
        imageProvided ? input.imageUrl : undefined,
        event.imageUrl,
        imageProvided,
      ),
      maxParticipants: Object.prototype.hasOwnProperty.call(input, 'maxParticipants')
        ? input.maxParticipants
        : event.maxParticipants,
      invitedUserIds: input.invitedUserIds ?? event.invitedUserIds,
    };

    const normalized = normalizeEventInput(merged) as CreateEventInput;
    const validationError = validateEventInput(normalized);
    if (validationError) {
      throw new ApiError(validationError, 'VALIDATION', 400);
    }

    Object.assign(event, {
      ...normalized,
      invitedUserIds: normalized.type === 'invited' ? normalized.invitedUserIds : undefined,
    });
    if (!normalized.imageUrl) delete event.imageUrl;
    syncEventRegistrationFields(event);

    return presentEventForViewer(event, requesterId);
  },

  async deleteEvent(id, requesterId) {
    await delay();
    assertEventsAdminAccess(requesterId);
    const index = db.events.findIndex((e) => e.id === id);
    if (index === -1) throw new ApiError('Мероприятие не найдено', 'NOT_FOUND', 404);
    db.events.splice(index, 1);
    db.eventRegistrations = db.eventRegistrations.filter((r) => r.eventId !== id);
  },
};

function syncUserInSessions(user: User): void {
  for (const [token, session] of db.sessions) {
    if (session.user.id === user.id) {
      db.sessions.set(token, { ...session, user });
    }
  }
}

export const mockUsersApi: UsersApi = {
  async getUser(id, requesterId) {
    await delay();
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    const viewer = getUserById(requesterId);
    const sanitized = sanitizeUserPhoneForViewer(user, viewer);
    const fallback = resolveOwnPhoneNumber(
      requesterId,
      user.phone,
      readPersistedLoginPhone(requesterId),
    );
    return preserveOwnPhone(sanitized, requesterId, fallback);
  },

  async getAllUsers(requesterId) {
    await delay();
    const viewer = getUserById(requesterId);
    return sanitizeUsersPhoneForViewer(db.users, viewer);
  },

  async updateProfile(requesterId, data) {
    await delay();
    const user = getUserById(requesterId);

    const validationError = validateUpdateProfileInput(data);
    if (validationError) {
      throw new ApiError(validationError, 'VALIDATION_ERROR', 400);
    }

    if (data.firstName !== undefined) user.firstName = data.firstName.trim();
    if (data.lastName !== undefined) user.lastName = data.lastName.trim();
    if (data.directionIds !== undefined) {
      const idsError = validateDirectionIdsSelection(data.directionIds, db.directions, {
        required: user.role !== 'admin',
      });
      if (idsError) {
        throw new ApiError(idsError, 'VALIDATION_ERROR', 400);
      }
      user.directionIds = normalizeDirectionIds(data.directionIds);
      if (user.role === 'teacher') {
        markTeacherDirectionsSetupNotificationsRead(db.notifications, user.id);
      }
    }

    syncUserInSessions(user);
    return user;
  },

  async updateUserRole(requesterId, userId, role) {
    await delay();
    const requester = getUserById(requesterId);
    const user = getUserById(userId);
    const error = getUserRoleChangeError(requester, user, role);
    if (error) {
      const forbidden = error === 'Нет доступа';
      throw new ApiError(error, forbidden ? 'FORBIDDEN' : 'VALIDATION_ERROR', forbidden ? 403 : 400);
    }

    user.role = role;
    user.accountStatus = ACCOUNT_STATUS_ACTIVE;
    if (role === 'teacher') {
      user.directionIds = [];
      tryPushNotification(
        db,
        user.id,
        'system',
        TEACHER_DIRECTIONS_SETUP_TITLE,
        TEACHER_DIRECTIONS_SETUP_BODY,
        TEACHER_DIRECTIONS_SETUP_LINK,
        true,
      );
    }
    syncUserInSessions(user);
    tryPushNotification(
      db,
      user.id,
      'system',
      'Роль изменена',
      `Ваша роль в школе: ${getRoleLabel(role)}`,
      '/profile',
    );
    return user;
  },

  async approveUser(requesterId, userId) {
    await delay();
    const requester = getUserById(requesterId);
    const user = getUserById(userId);
    const error = getAccountApprovalError(requester, user);
    if (error) {
      const forbidden = error === 'Нет доступа';
      throw new ApiError(error, forbidden ? 'FORBIDDEN' : 'VALIDATION_ERROR', forbidden ? 403 : 400);
    }
    user.accountStatus = ACCOUNT_STATUS_ACTIVE;
    syncUserInSessions(user);
    tryPushNotification(
      db,
      user.id,
      'system',
      ACCOUNT_APPROVED_NOTIFY_TITLE,
      ACCOUNT_APPROVED_NOTIFY_BODY,
      ACCOUNT_APPROVED_NOTIFY_LINK,
    );
    return user;
  },

  async rejectUser(requesterId, userId) {
    await delay();
    const requester = getUserById(requesterId);
    const user = getUserById(userId);
    const error = getAccountRejectError(requester, user);
    if (error) {
      const forbidden = error === 'Нет доступа';
      throw new ApiError(error, forbidden ? 'FORBIDDEN' : 'VALIDATION_ERROR', forbidden ? 403 : 400);
    }
    purgeUserFromMockDb(user.id);
  },

  async uploadAvatar(requesterId, input: UploadAvatarInput) {
    await delay();
    const user = getUserById(requesterId);

    const validation = validateAvatarUpload(input);
    if (!validation.valid) {
      throw new ApiError(validation.message, 'VALIDATION_ERROR', 400);
    }

    user.avatarUrl = input.dataUrl;
    if (input.originalDataUrl) {
      user.avatarOriginalUrl = input.originalDataUrl;
    } else if (!input.updateThumbnailOnly) {
      user.avatarOriginalUrl = input.dataUrl;
    }
    syncUserInSessions(user);
    return user;
  },

  async removeAvatar(requesterId) {
    await delay();
    const user = getUserById(requesterId);
    delete user.avatarUrl;
    delete user.avatarOriginalUrl;
    syncUserInSessions(user);
    return user;
  },

  async deleteOwnAccount(requesterId) {
    await delay(150);
    const user = getUserById(requesterId);
    purgeUserFromMockDb(user.id);
  },

  async exportOwnData(requesterId) {
    await delay(150);
    getUserById(requesterId);
    // Always use the mock client: the singleton `api` may be pocketbase in local .env.
    return buildPersonalDataExport(
      {
        users: mockUsersApi,
        legal: mockLegalApi,
        lessons: mockLessonsApi,
        assignments: mockAssignmentsApi,
        notifications: mockNotificationsApi,
        support: mockSupportApi,
        security: mockSecurityApi,
      } as Parameters<typeof buildPersonalDataExport>[0],
      requesterId,
    );
  },
};

/**
 * Erase a person from the in-memory database.
 *
 * Mirrors `purgeUserDependents` in pb_hooks/lib/kvartiraUsers.js: rows that
 * cannot exist without the user are removed, references from shared rows are
 * dropped, and the consent journal goes with the account.
 */
function purgeUserFromMockDb(userId: string): void {
  db.lessons = db.lessons.filter((l) => l.studentId !== userId && l.teacherId !== userId);
  // Keep messages; clear sender so personal chats retain history for the other party
  for (const message of db.messages) {
    if (message.senderId === userId) {
      message.senderId = '';
    }
  }
  db.conversationMembers = db.conversationMembers.filter((m) => m.userId !== userId);
  db.conversations = db.conversations.map((c) => ({
    ...c,
    participantIds: c.participantIds.filter((id) => id !== userId),
  }));
  db.assignments = db.assignments.filter((a) => a.teacherId !== userId);
  db.assignmentGroups = db.assignmentGroups
    .filter((g) => g.teacherId !== userId)
    .map((g) => ({ ...g, memberIds: g.memberIds.filter((id) => id !== userId) }));
  db.teacherAvailabilities = db.teacherAvailabilities.filter((a) => a.teacherId !== userId);
  db.events = db.events.map((e) => ({
    ...e,
    registeredUserIds: e.registeredUserIds.filter((id) => id !== userId),
    invitedUserIds: e.invitedUserIds?.filter((id) => id !== userId),
  }));
  db.eventRegistrations = db.eventRegistrations.filter((r) => r.userId !== userId);
  db.notifications = db.notifications.filter((n) => n.userId !== userId);
  db.supportTickets = db.supportTickets.filter((t) => t.userId !== userId);
  db.userConsents = db.userConsents.filter((c) => c.userId !== userId);
  db.securitySessions = db.securitySessions.filter((s) => s.userId !== userId);
  db.loginHistory = db.loginHistory.filter((h) => h.userId !== userId);
  db.securityAlerts = db.securityAlerts.filter((a) => a.userId !== userId);
  db.users = db.users.filter((u) => u.id !== userId);

  for (const [token, session] of db.sessions) {
    if (session.user.id === userId) db.sessions.delete(token);
  }
  db.passwords.delete(userId);
  db.passwordChangedAt.delete(userId);
  db.notificationPreferences.delete(userId);
}

export const mockAvailabilityApi: AvailabilityApi = {
  async getTeacherAvailability(teacherId, requesterId) {
    await delay();
    assertAvailabilityAccess(teacherId, requesterId);
    return db.teacherAvailabilities.find((a) => a.teacherId === teacherId) ?? null;
  },

  async updateTeacherAvailability(teacherId, data: UpdateTeacherAvailabilityInput, requesterId) {
    await delay(150);
    assertAvailabilityAccess(teacherId, requesterId);

    const errors = validateTeacherAvailability(data);
    if (errors.length > 0) {
      throw new ApiError(errors[0]!.message, 'VALIDATION_ERROR', 400);
    }

    const existing = db.teacherAvailabilities.find((a) => a.teacherId === teacherId);
    const updated = {
      teacherId,
      slotIntervalMinutes: data.slotIntervalMinutes,
      defaultLessonDurationMinutes:
        data.defaultLessonDurationMinutes ?? existing?.defaultLessonDurationMinutes ?? 60,
      schedule: data.schedule,
      exceptions: data.exceptions !== undefined ? data.exceptions : existing?.exceptions,
      planningPeriod:
        data.planningPeriod !== undefined ? data.planningPeriod : existing?.planningPeriod,
    };

    if (existing) {
      Object.assign(existing, updated);
      return existing;
    }

    db.teacherAvailabilities.push(updated);
    return updated;
  },
};

export const mockNotificationsApi = createMockNotificationsApi(db, delay, getUserById);

/** Test helper: mock push outbox after tryPushNotification. */
export function getMockPushDeliveries(): Array<{
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  createdAt: string;
}> {
  return structuredClone(db.pushDeliveries);
}

/** Test helper: wipe roster JSON while keeping event_registrations. */
export function clearMockEventRoster(eventId: string): void {
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return;
  event.registeredUserIds = [];
  event.registeredCount = 0;
}

export function resetMockDatabase() {
  db.users = structuredClone(users);
  db.directions = structuredClone(seedDirections);
  db.lessons = structuredClone(initialLessons);
  db.history = structuredClone(initialHistory);
  db.conversations = structuredClone(seedConversations);
  db.conversationMembers = structuredClone(seedConversationMembers);
  db.messages = structuredClone(seedMessages);
  db.events = structuredClone(seedEvents);
  db.schoolInfo = structuredClone(seedSchoolInfo);
  db.registrationInvite = createSeedRegistrationInvite('2026-09-01T00:00:00.000Z');
  db.eventRegistrations = seedEventRegistrationsFromEvents(db.events);
  db.notifications = structuredClone(seedNotifications);
  db.notificationPreferences = new Map();
  db.pushDeliveries = [];
  db.pushSubscriptions = [];
  db.teacherAvailabilities = structuredClone(seedTeacherAvailabilities);
  db.assignments = structuredClone(initialAssignments);
  db.assignmentGroups = structuredClone(initialAssignmentGroups);
  db.helpArticles = structuredClone(seedHelpArticles);
  db.supportTickets = structuredClone(initialSupportTickets);
  db.loginHistory = structuredClone(initialLoginHistory);
  db.securityAlerts = structuredClone(initialSecurityAlerts);
  db.securitySessions = structuredClone(initialSecuritySessions);
  db.legalDocuments = structuredClone(initialLegalDocuments);
  db.userConsents = structuredClone(initialUserConsents);
  db.passwords = buildPasswordMap(db.users);
  db.passwordChangedAt = new Map();
  db.passwordResets = new Map();
  db.openConversations.clear();
  db.sessions.clear();
  db.bookingLocks.clear();
}
