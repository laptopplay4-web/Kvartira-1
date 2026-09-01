import type { AuthSession, EventRegistration, Lesson, SchoolEvent, User, PublicSchoolInfo } from '@/types';
import {
  DEMO_ACCOUNTS,
  conversationMembers as seedConversationMembers,
  conversations as seedConversations,
  directions,
  events as seedEvents,
  publicSchoolInfo as seedSchoolInfo,
  getDayOfWeekFromDate,
  initialHistory,
  initialLessons,
  initialAssignments,
  achievementDefinitions,
  initialProgressGoals,
  initialProgressHistory,
  initialSkillProgress,
  initialUserAchievements,
  helpArticles as seedHelpArticles,
  initialSupportTickets,
  initialLoginHistory,
  initialSecurityAlerts,
  initialSecuritySessions,
  initialLegalDocuments,
  initialUserConsents,
  skills,
  messages as seedMessages,
  notifications as seedNotifications,
  teacherAvailabilities as seedTeacherAvailabilities,
  teacherDirections,
  users,
} from '@/mocks/seed';
import { calculateAvailableSlots, slotsConflict } from '@/services/slots/calculateSlots';
import { canViewLesson, canRescheduleLesson, canCancelLesson, canEditTeacherNotes } from '@/services/lessons/access';
import { sanitizeLessonForViewer } from '@/services/lessons/helpers';
import { validateTeacherAvailability } from '@/services/availability/validateAvailability';
import { can } from '@/permissions';
import { ApiError } from '@/services/api/types';
import type {
  AuthApi,
  AvailabilityApi,
  ChatApi,
  CompletePasswordResetInput,
  CreateEventInput,
  EventsApi,
  LessonsApi,
  UpdateTeacherAvailabilityInput,
  UploadAvatarInput,
  UsersApi,
} from '@/services/api/types';
import { createMockChatApi } from './chat';
import { createMockAssignmentsApi } from './assignments';
import { createMockProgressApi } from './progress';
import { createMockSupportApi } from './support';
import { createMockPublicApi } from './public';
import { buildPasswordMap, createMockSecurityApi, pushAlert, recordAuthLogin } from './security';
import { createMockLegalApi } from './legal';
import { createMockSchoolSettingsApi } from './schoolSettings';
import { createMockNotificationsApi, tryPushNotification } from './notifications';
import { evaluateAndUnlockAchievements } from '@/services/progress/achievements';
import { canManageEventsAdmin } from '@/services/events/access';
import {
  normalizeCompetitionApplication,
  normalizeEventInput,
  validateCompetitionApplication,
  validateEventInput,
} from '@/services/events/validation';
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

class MockDatabase {
  users = structuredClone(users);
  lessons = structuredClone(initialLessons);
  history = structuredClone(initialHistory);
  conversations = structuredClone(seedConversations);
  conversationMembers = structuredClone(seedConversationMembers);
  messages = structuredClone(seedMessages);
  events = structuredClone(seedEvents);
  schoolInfo: PublicSchoolInfo = structuredClone(seedSchoolInfo);
  eventRegistrations: EventRegistration[] = [];
  notifications = structuredClone(seedNotifications);
  notificationPreferences = new Map();
  pushDeliveries = [];
  pushSubscriptions = [];
  teacherAvailabilities = structuredClone(seedTeacherAvailabilities);
  assignments = structuredClone(initialAssignments);
  skills = structuredClone(skills);
  skillProgress = structuredClone(initialSkillProgress);
  progressGoals = structuredClone(initialProgressGoals);
  progressHistory = structuredClone(initialProgressHistory);
  achievementDefinitions = structuredClone(achievementDefinitions);
  userAchievements = structuredClone(initialUserAchievements);
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
  if (teacher.role !== 'teacher') {
    throw new ApiError('Пользователь не является преподавателем', 'INVALID_USER', 400);
  }
}

function bookingLockKey(teacherId: string, date: string, startTime: string): string {
  return `${teacherId}:${date}:${startTime}`;
}

function pushNotification(
  userId: string,
  type: 'lesson' | 'reschedule' | 'cancel' | 'assignment' | 'system',
  title: string,
  body: string,
  link?: string,
) {
  tryPushNotification(db, userId, type, title, body, link);
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
    return session;
  },

  async register(phone, password, firstName, lastName) {
    await delay();
    if (db.users.some((u) => u.phone === phone)) {
      throw new ApiError('Пользователь с таким телефоном уже существует', 'DUPLICATE', 409);
    }
    const user: User = {
      id: uid('user'),
      phone,
      role: 'student',
      firstName,
      lastName,
    };
    db.users.push(user);
    db.passwords.set(user.id, password);
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
};

export const mockLessonsApi: LessonsApi = {
  async getDirections() {
    await delay();
    return directions;
  },

  async getTeachers(directionId) {
    await delay();
    return db.users.filter((u) => {
      if (u.role !== 'teacher') return false;
      if (!directionId) return true;
      return teacherDirections[u.id]?.includes(directionId);
    });
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
export const mockProgressApi = createMockProgressApi(db, delay);
export const mockSupportApi = createMockSupportApi(db, delay);
export const mockPublicApi = createMockPublicApi(db, delay);
export const mockSecurityApi = createMockSecurityApi(db, delay);
export const mockLegalApi = createMockLegalApi(db, delay);
export const mockSchoolSettingsApi = createMockSchoolSettingsApi(db, delay, getUserById);

function assertEventsAdminAccess(requesterId: string) {
  const user = getUserById(requesterId);
  if (!user || !canManageEventsAdmin(user)) {
    throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
  }
}

export const mockEventsApi: EventsApi = {
  async getEvents(userId) {
    await delay();
    return db.events.filter((e) => {
      if (e.type === 'invited') return e.invitedUserIds?.includes(userId);
      return true;
    });
  },

  async getEvent(id, userId) {
    await delay();
    const event = db.events.find((e) => e.id === id);
    if (!event) throw new ApiError('Мероприятие не найдено', 'NOT_FOUND', 404);
    if (event.type === 'invited' && !event.invitedUserIds?.includes(userId)) {
      throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
    }
    return event;
  },

  async getRegistration(eventId, userId) {
    await delay();
    await mockEventsApi.getEvent(eventId, userId);
    return db.eventRegistrations.find((r) => r.eventId === eventId && r.userId === userId) ?? null;
  },

  async register(eventId, userId, application) {
    await delay();
    const event = await mockEventsApi.getEvent(eventId, userId);
    if (event.maxParticipants && event.registeredUserIds.length >= event.maxParticipants) {
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

    if (!event.registeredUserIds.includes(userId)) {
      event.registeredUserIds.push(userId);
      const user = getUserById(userId);
      if (user.role === 'student') {
        evaluateAndUnlockAchievements(db, userId, uid);
      }
    }

    if (event.type === 'competition' && application) {
      const normalized = normalizeCompetitionApplication(application);
      const existing = db.eventRegistrations.find(
        (r) => r.eventId === eventId && r.userId === userId,
      );
      if (existing) {
        existing.application = normalized;
      } else {
        db.eventRegistrations.push({
          id: uid('event-reg'),
          eventId,
          userId,
          createdAt: new Date().toISOString(),
          application: normalized,
        });
      }
    }

    return event;
  },

  async unregister(eventId, userId) {
    await delay();
    const event = await mockEventsApi.getEvent(eventId, userId);
    event.registeredUserIds = event.registeredUserIds.filter((id) => id !== userId);
    db.eventRegistrations = db.eventRegistrations.filter(
      (r) => !(r.eventId === eventId && r.userId === userId),
    );
    return event;
  },

  async getAllEvents(requesterId) {
    await delay();
    assertEventsAdminAccess(requesterId);
    return db.events.map((e) => structuredClone(e));
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
      registeredUserIds: [],
      invitedUserIds: normalized.type === 'invited' ? normalized.invitedUserIds : undefined,
    };

    db.events.push(event);
    return structuredClone(event);
  },

  async updateEvent(id, input, requesterId) {
    await delay();
    assertEventsAdminAccess(requesterId);
    const event = db.events.find((e) => e.id === id);
    if (!event) throw new ApiError('Мероприятие не найдено', 'NOT_FOUND', 404);

    const merged: CreateEventInput = {
      title: input.title ?? event.title,
      description: input.description ?? event.description,
      type: input.type ?? event.type,
      date: input.date ?? event.date,
      startTime: input.startTime ?? event.startTime,
      endTime: input.endTime ?? event.endTime,
      location: input.location ?? event.location,
      imageUrl: input.imageUrl ?? event.imageUrl,
      maxParticipants: input.maxParticipants ?? event.maxParticipants,
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

    return structuredClone(event);
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
  async getUser(id) {
    await delay();
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    return user;
  },

  async getAllUsers() {
    await delay();
    return db.users;
  },

  async updateProfile(requesterId, data) {
    await delay();
    const user = getUserById(requesterId);

    const validationError = validateUpdateProfileInput(data);
    if (validationError) {
      throw new ApiError(validationError, 'VALIDATION_ERROR', 400);
    }

    if (data.phone !== undefined && data.phone !== user.phone) {
      if (db.users.some((u) => u.id !== user.id && u.phone === data.phone)) {
        throw new ApiError('Пользователь с таким телефоном уже существует', 'DUPLICATE', 409);
      }
      user.phone = data.phone;
    }

    if (data.firstName !== undefined) user.firstName = data.firstName.trim();
    if (data.lastName !== undefined) user.lastName = data.lastName.trim();

    syncUserInSessions(user);
    return user;
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
};

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

export function resetMockDatabase() {
  db.users = structuredClone(users);
  db.lessons = structuredClone(initialLessons);
  db.history = structuredClone(initialHistory);
  db.conversations = structuredClone(seedConversations);
  db.conversationMembers = structuredClone(seedConversationMembers);
  db.messages = structuredClone(seedMessages);
  db.events = structuredClone(seedEvents);
  db.schoolInfo = structuredClone(seedSchoolInfo);
  db.eventRegistrations = [];
  db.notifications = structuredClone(seedNotifications);
  db.notificationPreferences = new Map();
  db.pushDeliveries = [];
  db.pushSubscriptions = [];
  db.teacherAvailabilities = structuredClone(seedTeacherAvailabilities);
  db.assignments = structuredClone(initialAssignments);
  db.skills = structuredClone(skills);
  db.skillProgress = structuredClone(initialSkillProgress);
  db.progressGoals = structuredClone(initialProgressGoals);
  db.progressHistory = structuredClone(initialProgressHistory);
  db.achievementDefinitions = structuredClone(achievementDefinitions);
  db.userAchievements = structuredClone(initialUserAchievements);
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
