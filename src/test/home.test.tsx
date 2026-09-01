import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PROGRESS_FEATURE_ENABLED } from '@/config/features';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { getNextUpcomingEvent } from '@/services/events/helpers';
import { formatUserName } from '@/utils';
import type { SchoolEvent, User } from '@/types';

const mockGetLessons = vi.fn();
const mockGetDirections = vi.fn();
const mockGetTeachers = vi.fn();
const mockGetEvents = vi.fn();
const mockGetConversations = vi.fn();
const mockGetAllUsers = vi.fn();
const mockGetProgressSummary = vi.fn();
const mockGetProgressSkills = vi.fn();
const mockGetAssignments = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    lessons: {
      getLessons: (...args: unknown[]) => mockGetLessons(...args),
      getDirections: (...args: unknown[]) => mockGetDirections(...args),
      getTeachers: (...args: unknown[]) => mockGetTeachers(...args),
    },
    events: {
      getEvents: (...args: unknown[]) => mockGetEvents(...args),
    },
    chat: {
      getConversations: (...args: unknown[]) => mockGetConversations(...args),
    },
    users: {
      getAllUsers: (...args: unknown[]) => mockGetAllUsers(...args),
    },
    progress: {
      getSummary: (...args: unknown[]) => mockGetProgressSummary(...args),
      getSkills: (...args: unknown[]) => mockGetProgressSkills(...args),
    },
    assignments: {
      getAssignments: (...args: unknown[]) => mockGetAssignments(...args),
    },
  },
}));

let mockUser: User;

vi.mock('@/stores/authStore', () => ({
  useCurrentUser: () => mockUser,
}));

import HomePage from '@/pages/home/HomePage';

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const studentUser: User = {
  id: 'student-1',
  role: 'student',
  firstName: 'Анна',
  lastName: 'Иванова',
  phone: '+79001111111',
};

const teacherUser: User = {
  id: 'teacher-1',
  role: 'teacher',
  firstName: 'Мария',
  lastName: 'Петрова',
  phone: '+79002222222',
};

const teacherStudent: User = {
  id: 'student-2',
  role: 'student',
  firstName: 'Иван',
  lastName: 'Сидоров',
  phone: '+79003333333',
};

const lesson = {
  id: 'lesson-1',
  studentId: 'student-2',
  teacherId: 'teacher-1',
  directionId: 'dir-1',
  date: '2099-12-31',
  startTime: '18:30',
  durationMinutes: 60,
  status: 'scheduled' as const,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const progressSummary = {
  studentId: 'student-1',
  lessonsCompleted: 3,
  lessonsUpcoming: 1,
  lessonsTotal: 4,
  lessonsAttended: 3,
  lessonsMissed: 1,
  lessonsCancelled: 0,
  attendanceRate: 75,
  assignmentsTotal: 2,
  activeGoals: 1,
  completedGoals: 1,
  achievementsUnlocked: 2,
  achievementsTotal: 5,
  averageSkillLevel: 45,
};

function mockProgressDefaults() {
  mockGetProgressSummary.mockResolvedValue(progressSummary);
  mockGetProgressSkills.mockResolvedValue([
    { id: 'skill-1', name: 'Интонция', maxLevel: 100, level: 60, category: 'vocal' },
    { id: 'skill-2', name: 'Сцена', maxLevel: 100, level: 30, category: 'performance' },
  ]);
}

function mockAssignmentsDefaults() {
  mockGetAssignments.mockResolvedValue([]);
}

describe('getNextUpcomingEvent', () => {
  const now = new Date('2026-08-31T12:00:00');

  it('returns undefined for empty array', () => {
    expect(getNextUpcomingEvent([], now)).toBeUndefined();
  });

  it('returns the only upcoming event', () => {
    const events: SchoolEvent[] = [
      {
        id: 'e1',
        title: 'Concert',
        type: 'concert',
        date: '2099-06-01',
        startTime: '19:00',
        location: 'Hall',
        description: '',
        registeredUserIds: [],
      },
    ];
    expect(getNextUpcomingEvent(events, now)?.id).toBe('e1');
  });

  it('picks nearest event when array order is not chronological', () => {
    const events: SchoolEvent[] = [
      {
        id: 'later',
        title: 'Later',
        type: 'concert',
        date: '2099-12-01',
        startTime: '19:00',
        location: 'Hall',
        description: '',
        registeredUserIds: [],
      },
      {
        id: 'nearest',
        title: 'Nearest',
        type: 'concert',
        date: '2099-06-01',
        startTime: '19:00',
        location: 'Hall',
        description: '',
        registeredUserIds: [],
      },
    ];
    expect(getNextUpcomingEvent(events, now)?.id).toBe('nearest');
  });

  it('ignores past events', () => {
    const events: SchoolEvent[] = [
      {
        id: 'past',
        title: 'Past',
        type: 'concert',
        date: '2020-01-01',
        startTime: '19:00',
        location: 'Hall',
        description: '',
        registeredUserIds: [],
      },
      {
        id: 'future',
        title: 'Future',
        type: 'concert',
        date: '2099-06-01',
        startTime: '19:00',
        location: 'Hall',
        description: '',
        registeredUserIds: [],
      },
    ];
    expect(getNextUpcomingEvent(events, now)?.id).toBe('future');
  });

  it('sorts by time on the same date', () => {
    const events: SchoolEvent[] = [
      {
        id: 'late',
        title: 'Late',
        type: 'concert',
        date: '2099-06-01',
        startTime: '20:00',
        location: 'Hall',
        description: '',
        registeredUserIds: [],
      },
      {
        id: 'early',
        title: 'Early',
        type: 'concert',
        date: '2099-06-01',
        startTime: '10:00',
        location: 'Hall',
        description: '',
        registeredUserIds: [],
      },
    ];
    expect(getNextUpcomingEvent(events, now)?.id).toBe('early');
  });

  it('does not mutate the input array', () => {
    const events: SchoolEvent[] = [
      {
        id: 'b',
        title: 'B',
        type: 'concert',
        date: '2099-12-01',
        startTime: '19:00',
        location: 'Hall',
        description: '',
        registeredUserIds: [],
      },
      {
        id: 'a',
        title: 'A',
        type: 'concert',
        date: '2099-06-01',
        startTime: '19:00',
        location: 'Hall',
        description: '',
        registeredUserIds: [],
      },
    ];
    const copy = [...events];
    getNextUpcomingEvent(events, now);
    expect(events).toEqual(copy);
  });
});

describe('HomePage P0', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDirections.mockResolvedValue([{ id: 'dir-1', name: 'Фортепиано' }]);
    mockGetTeachers.mockResolvedValue([teacherUser]);
    mockGetConversations.mockResolvedValue([]);
    mockGetEvents.mockResolvedValue([]);
    mockProgressDefaults();
    mockAssignmentsDefaults();
  });

  it('teacher sees student name in next lesson, not direction', async () => {
    mockUser = teacherUser;
    mockGetLessons.mockResolvedValue([lesson]);
    mockGetAllUsers.mockResolvedValue([teacherStudent]);

    renderHome();

    const studentName = formatUserName(teacherStudent);
    expect(await screen.findByRole('heading', { name: studentName })).toBeInTheDocument();
    expect(screen.getByText('Фортепиано')).toBeInTheDocument();
    expect(screen.queryByText(teacherStudent.phone)).not.toBeInTheDocument();
  });

  it('student still sees teacher name in next lesson', async () => {
    mockUser = studentUser;
    mockGetLessons.mockResolvedValue([
      { ...lesson, studentId: studentUser.id, teacherId: teacherUser.id },
    ]);

    renderHome();

    expect(await screen.findByRole('heading', { name: formatUserName(teacherUser) })).toBeInTheDocument();
  });

  it('shows ErrorState with retry on lessons error without technical details', async () => {
    mockUser = studentUser;
    mockGetLessons.mockRejectedValue(new Error('Internal DB connection failed'));

    renderHome();

    expect(await screen.findByText('Что-то пошло не так')).toBeInTheDocument();
    expect(screen.getByText('Не удалось загрузить данные')).toBeInTheDocument();
    expect(screen.queryByText(/Internal DB/i)).not.toBeInTheDocument();

    mockGetLessons.mockResolvedValue([
      { ...lesson, studentId: studentUser.id, teacherId: teacherUser.id },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByRole('heading', { name: formatUserName(teacherUser) })).toBeInTheDocument();
  });

  it('shows ErrorState with retry on events error', async () => {
    mockUser = studentUser;
    mockGetLessons.mockResolvedValue([
      { ...lesson, studentId: studentUser.id, teacherId: teacherUser.id },
    ]);
    mockGetEvents.mockRejectedValue(new Error('Events API down'));

    renderHome();

    expect(await screen.findByText('Что-то пошло не так')).toBeInTheDocument();
    expect(screen.queryByText(/Events API/i)).not.toBeInTheDocument();

    mockGetEvents.mockResolvedValue([
      {
        id: 'e1',
        title: 'Concert',
        type: 'concert',
        date: '2099-06-01',
        startTime: '19:00',
        location: 'Hall',
        description: '',
        registeredUserIds: [],
      },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByText('Concert')).toBeInTheDocument();
  });
});

describe('HomePage P1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDirections.mockResolvedValue([{ id: 'dir-1', name: 'Фортепиано' }]);
    mockGetTeachers.mockResolvedValue([teacherUser]);
    mockGetConversations.mockResolvedValue([]);
    mockGetEvents.mockResolvedValue([]);
    mockProgressDefaults();
    mockAssignmentsDefaults();
  });

  it('shows LessonCardSkeleton while nearest lesson is loading', () => {
    mockUser = studentUser;
    mockGetLessons.mockReturnValue(new Promise(() => {}));

    const { container } = renderHome();

    expect(screen.getByText('Ближайшее занятие')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(screen.queryByText('Пока нет предстоящих занятий')).not.toBeInTheDocument();
    expect(screen.queryByText('Что-то пошло не так')).not.toBeInTheDocument();
  });

  it('shows lesson card when nearest lesson loads', async () => {
    mockUser = studentUser;
    mockGetLessons.mockResolvedValue([
      { ...lesson, studentId: studentUser.id, teacherId: teacherUser.id },
    ]);

    renderHome();

    expect(await screen.findByRole('heading', { name: formatUserName(teacherUser) })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows empty state when no upcoming lessons', async () => {
    mockUser = studentUser;
    mockGetLessons.mockResolvedValue([]);

    renderHome();

    expect(await screen.findAllByText('Пока нет предстоящих занятий')).toHaveLength(2);
  });

  it('shows ErrorState on lessons error in nearest lesson block', async () => {
    mockUser = studentUser;
    mockGetLessons.mockRejectedValue(new Error('fail'));

    renderHome();

    expect(await screen.findByText('Что-то пошло не так')).toBeInTheDocument();
    expect(screen.queryByText('Пока нет предстоящих занятий')).not.toBeInTheDocument();
  });

  it('does not render notification entry on Home', async () => {
    mockUser = studentUser;
    mockGetLessons.mockResolvedValue([
      { ...lesson, studentId: studentUser.id, teacherId: teacherUser.id },
    ]);
    mockGetConversations.mockResolvedValue([]);

    renderHome();

    await screen.findByRole('heading', { name: formatUserName(teacherUser) });
    expect(screen.queryByRole('link', { name: /уведомлен/i })).not.toBeInTheDocument();
  });

  it('does not duplicate BottomNav shortcuts as quick action tiles', async () => {
    mockUser = studentUser;
    mockGetLessons.mockResolvedValue([
      { ...lesson, studentId: studentUser.id, teacherId: teacherUser.id },
    ]);

    renderHome();

    await screen.findByRole('heading', { name: formatUserName(teacherUser) });
    expect(screen.queryByRole('link', { name: /^Занятия$/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Чат')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^События$/ })).not.toBeInTheDocument();
  });
});

const adminUser: User = {
  id: 'admin-1',
  role: 'admin',
  firstName: 'Мария',
  lastName: 'Иванова',
  phone: '+79009999999',
};

describe('HomePage Admin P1', () => {
  const today = new Date().toISOString().slice(0, 10);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDirections.mockResolvedValue([{ id: 'dir-1', name: 'Фортепиано' }]);
    mockGetTeachers.mockResolvedValue([teacherUser]);
    mockGetEvents.mockResolvedValue([]);
    mockGetConversations.mockResolvedValue([]);
  });

  it('shows administrative overview header and KPI stats', async () => {
    mockUser = adminUser;
    mockGetLessons.mockResolvedValue([
      { ...lesson, date: today, studentId: studentUser.id, teacherId: teacherUser.id },
      { ...lesson, id: 'lesson-2', date: '2099-01-01', studentId: studentUser.id, teacherId: teacherUser.id },
    ]);
    mockGetAllUsers.mockResolvedValue([adminUser, teacherUser, studentUser]);

    renderHome();

    expect(await screen.findByText('Административный обзор')).toBeInTheDocument();
    expect(screen.getByText('Сегодня')).toBeInTheDocument();

    await waitFor(() => {
      const todayCard = screen.getByText('Занятий сегодня').parentElement!;
      expect(within(todayCard).getByText('1')).toBeInTheDocument();
      const upcomingCard = screen.getByText('Предстоящих').parentElement!;
      expect(within(upcomingCard).getByText('2')).toBeInTheDocument();
      const teachersCard = screen.getByText('Преподавателей').parentElement!;
      expect(within(teachersCard).getByText('1')).toBeInTheDocument();
      const studentsCard = screen.getByText('Учеников').parentElement!;
      expect(within(studentsCard).getByText('1')).toBeInTheDocument();
    });
  });

  it('does not show book CTA or upcoming lessons list for admin', async () => {
    mockUser = adminUser;
    mockGetLessons.mockResolvedValue([lesson]);
    mockGetAllUsers.mockResolvedValue([teacherUser, studentUser]);

    renderHome();

    await screen.findByText('Административный обзор');
    expect(screen.queryByText('Записаться на занятие')).not.toBeInTheDocument();
    expect(screen.queryByText('Предстоящие занятия')).not.toBeInTheDocument();
    expect(screen.queryByText('Чат')).not.toBeInTheDocument();
  });

  it('shows teacher and student in next school lesson', async () => {
    mockUser = adminUser;
    mockGetLessons.mockResolvedValue([
      { ...lesson, studentId: studentUser.id, teacherId: teacherUser.id },
    ]);
    mockGetAllUsers.mockResolvedValue([teacherUser, studentUser]);

    renderHome();

    const combined = `${formatUserName(teacherUser)} · ${formatUserName(studentUser)}`;
    expect(await screen.findByRole('heading', { name: combined })).toBeInTheDocument();
    expect(screen.getByText('Ближайшее занятие школы')).toBeInTheDocument();
    expect(screen.queryByText(studentUser.phone)).not.toBeInTheDocument();
    expect(screen.queryByText(teacherUser.phone)).not.toBeInTheDocument();
  });

  it('shows admin quick actions for schedule, users, legal, events and school', async () => {
    mockUser = adminUser;
    mockGetLessons.mockResolvedValue([]);
    mockGetAllUsers.mockResolvedValue([]);

    renderHome();

    await screen.findByText('Быстрые действия');
    expect(screen.getByRole('link', { name: /Расписание/i })).toHaveAttribute('href', '/admin/schedule');
    expect(screen.getByRole('link', { name: /Пользователи/i })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByRole('link', { name: /Документы/i })).toHaveAttribute('href', '/admin/legal');
    expect(screen.getByRole('link', { name: /Мероприятия/i })).toHaveAttribute('href', '/admin/events');
    expect(screen.getByRole('link', { name: /Школа/i })).toHaveAttribute('href', '/admin/school');
  });

  it('does not duplicate events nav as admin quick action tile', async () => {
    mockUser = adminUser;
    mockGetLessons.mockResolvedValue([]);
    mockGetAllUsers.mockResolvedValue([]);

    renderHome();

    await screen.findByText('Быстрые действия');
    expect(screen.queryByRole('link', { name: /^События$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Все$/ })).toHaveAttribute('href', '/events');
  });

  it('shows LessonCardSkeleton while admin lesson block is loading', () => {
    mockUser = adminUser;
    mockGetLessons.mockReturnValue(new Promise(() => {}));
    mockGetAllUsers.mockReturnValue(new Promise(() => {}));

    const { container } = renderHome();

    expect(screen.getByText('Ближайшее занятие школы')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });
});

describe.skipIf(!PROGRESS_FEATURE_ENABLED)('HomePage progress block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDirections.mockResolvedValue([{ id: 'dir-1', name: 'Фортепиано' }]);
    mockGetTeachers.mockResolvedValue([teacherUser]);
    mockGetEvents.mockResolvedValue([]);
    mockProgressDefaults();
    mockAssignmentsDefaults();
  });

  it('student sees progress summary and link to progress page', async () => {
    mockUser = studentUser;
    mockGetLessons.mockResolvedValue([
      { ...lesson, studentId: studentUser.id, teacherId: teacherUser.id },
    ]);

    renderHome();

    expect(await screen.findByText('Прогресс')).toBeInTheDocument();
    expect(await screen.findByText('Интонция')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Подробнее/i })).toHaveAttribute('href', '/profile/progress');
    expect(mockGetProgressSummary).toHaveBeenCalledWith(studentUser.id, studentUser.id);
  });

  it('shows ErrorState on progress error without blocking lessons', async () => {
    mockUser = studentUser;
    mockGetLessons.mockResolvedValue([
      { ...lesson, studentId: studentUser.id, teacherId: teacherUser.id },
    ]);
    mockGetProgressSummary.mockRejectedValue(new Error('progress fail'));

    renderHome();

    expect(await screen.findByRole('heading', { name: formatUserName(teacherUser) })).toBeInTheDocument();
    expect(screen.getByText('Прогресс')).toBeInTheDocument();
    expect(screen.getByText('Что-то пошло не так')).toBeInTheDocument();
  });

  it('teacher does not fetch or show progress block', async () => {
    mockUser = teacherUser;
    mockGetLessons.mockResolvedValue([lesson]);
    mockGetAllUsers.mockResolvedValue([teacherStudent]);

    renderHome();

    await screen.findByRole('heading', { name: formatUserName(teacherStudent) });
    expect(screen.queryByText('Прогресс')).not.toBeInTheDocument();
    expect(mockGetProgressSummary).not.toHaveBeenCalled();
  });

  it('admin does not show progress block', async () => {
    mockUser = adminUser;
    mockGetLessons.mockResolvedValue([]);
    mockGetAllUsers.mockResolvedValue([]);

    renderHome();

    await screen.findByText('Административный обзор');
    expect(screen.queryByText('Прогресс')).not.toBeInTheDocument();
    expect(mockGetProgressSummary).not.toHaveBeenCalled();
  });
});

describe.skipIf(PROGRESS_FEATURE_ENABLED)('HomePage progress block hidden', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDirections.mockResolvedValue([{ id: 'dir-1', name: 'Фортепиано' }]);
    mockGetTeachers.mockResolvedValue([teacherUser]);
    mockGetEvents.mockResolvedValue([]);
    mockProgressDefaults();
    mockAssignmentsDefaults();
  });

  it('student does not fetch or show progress when feature is disabled', async () => {
    mockUser = studentUser;
    mockGetLessons.mockResolvedValue([
      { ...lesson, studentId: studentUser.id, teacherId: teacherUser.id },
    ]);

    renderHome();

    await screen.findByRole('heading', { name: formatUserName(teacherUser) });
    expect(screen.queryByText('Прогресс')).not.toBeInTheDocument();
    expect(mockGetProgressSummary).not.toHaveBeenCalled();
  });
});

describe('HomePage assignments block', () => {
  const pendingAssignment = {
    id: 'asgn-home-1',
    title: 'Дыхательная гимнастика',
    description: 'Упражнения',
    teacherId: teacherUser.id,
    groupId: 'grp-vocalists',
    dueDate: '2099-06-15',
    contentBlocks: [{ id: 'blk-1', type: 'text' as const, order: 0, text: 'Текст' }],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDirections.mockResolvedValue([{ id: 'dir-1', name: 'Фортепиано' }]);
    mockGetTeachers.mockResolvedValue([teacherUser]);
    mockGetEvents.mockResolvedValue([]);
    mockProgressDefaults();
    mockAssignmentsDefaults();
  });

  it('student sees pending assignments and link to assignments page', async () => {
    mockUser = studentUser;
    mockGetLessons.mockResolvedValue([
      { ...lesson, studentId: studentUser.id, teacherId: teacherUser.id },
    ]);
    mockGetAssignments.mockResolvedValue([pendingAssignment]);

    renderHome();

    expect(await screen.findByText('Домашние задания')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: pendingAssignment.title })).toBeInTheDocument();
    const allLinks = screen.getAllByRole('link', { name: 'Все' });
    expect(allLinks.some((link) => link.getAttribute('href') === '/assignments')).toBe(true);
    expect(mockGetAssignments).toHaveBeenCalledWith({ requesterId: studentUser.id });
  });

  it('shows ErrorState on assignments error without blocking lessons', async () => {
    mockUser = studentUser;
    mockGetLessons.mockResolvedValue([
      { ...lesson, studentId: studentUser.id, teacherId: teacherUser.id },
    ]);
    mockGetAssignments.mockRejectedValue(new Error('assignments fail'));

    renderHome();

    expect(await screen.findByRole('heading', { name: formatUserName(teacherUser) })).toBeInTheDocument();
    expect(screen.getByText('Домашние задания')).toBeInTheDocument();
    expect(screen.getByText('Что-то пошло не так')).toBeInTheDocument();
  });

  it('teacher does not fetch or show assignments block', async () => {
    mockUser = teacherUser;
    mockGetLessons.mockResolvedValue([lesson]);
    mockGetAllUsers.mockResolvedValue([teacherStudent]);

    renderHome();

    await screen.findByRole('heading', { name: formatUserName(teacherStudent) });
    expect(screen.queryByText('Домашние задания')).not.toBeInTheDocument();
    expect(mockGetAssignments).not.toHaveBeenCalled();
  });
});
