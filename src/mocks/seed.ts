import { addDays, format, getDay } from 'date-fns';
import type {
  AchievementDefinition,
  AppNotification,
  Assignment,
  AssignmentGroup,
  Conversation,
  ConversationMember,
  Direction,
  Lesson,
  LessonHistoryEntry,
  Message,
  ProgressGoal,
  ProgressHistoryEntry,
  SchoolEvent,
  Skill,
  StudentSkillProgress,
  TeacherAvailability,
  User,
  UserAchievement,
  HelpArticle,
  SupportTicket,
  PublicSchoolInfo,
  PublicNewsItem,
  LoginHistoryEntry,
  SecurityAlert,
  LegalDocument,
  UserConsent,
} from '@/types';

export const DEMO_ACCOUNTS = {
  student: { phone: '+79001234567', password: 'student123' },
  teacher: { phone: '+79007654321', password: 'teacher123' },
  admin: { phone: '+79009999999', password: 'admin123' },
} as const;

export const directions: Direction[] = [
  { id: 'dir-vocal', name: 'Вокал', description: 'Современный и академический вокал', icon: '🎤' },
  { id: 'dir-piano', name: 'Фортепиано', description: 'Классика и джаз', icon: '🎹' },
  { id: 'dir-guitar', name: 'Гитара', description: 'Акустика и электрогитара', icon: '🎸' },
  { id: 'dir-drums', name: 'Ударные', description: 'Ритм-секция и импровизация', icon: '🥁' },
];

const today = new Date();

export const studentDirections: Record<string, string[]> = {
  'user-student': ['dir-vocal'],
  'user-student-2': ['dir-guitar'],
};

export const teacherDirections: Record<string, string[]> = {
  'user-teacher-1': ['dir-vocal'],
  'user-teacher-2': ['dir-piano', 'dir-guitar'],
};

export const users: User[] = [
  {
    id: 'user-student',
    phone: DEMO_ACCOUNTS.student.phone,
    role: 'student',
    firstName: 'Анна',
    lastName: 'Смирнова',
    bio: 'Учусь вокалу',
    directionIds: studentDirections['user-student'],
  },
  {
    id: 'user-teacher-1',
    phone: DEMO_ACCOUNTS.teacher.phone,
    role: 'teacher',
    firstName: 'Елена',
    lastName: 'Волкова',
    bio: 'Преподаватель вокала, 12 лет опыта',
    directionIds: teacherDirections['user-teacher-1'],
  },
  {
    id: 'user-teacher-2',
    phone: '+79001112233',
    role: 'teacher',
    firstName: 'Дмитрий',
    lastName: 'Козлов',
    bio: 'Пианист, джаз и классика',
    directionIds: teacherDirections['user-teacher-2'],
  },
  {
    id: 'user-admin',
    phone: DEMO_ACCOUNTS.admin.phone,
    role: 'admin',
    firstName: 'Мария',
    lastName: 'Иванова',
    bio: 'Администратор школы',
  },
  {
    id: 'user-student-2',
    phone: '+79005556677',
    role: 'student',
    firstName: 'Игорь',
    lastName: 'Петров',
    directionIds: studentDirections['user-student-2'],
  },
];

const defaultSchedule = [
  { dayOfWeek: 1, ranges: [{ start: '10:00', end: '18:00' }], breaks: [{ start: '13:00', end: '14:00' }] },
  { dayOfWeek: 2, ranges: [{ start: '10:00', end: '18:00' }], breaks: [{ start: '13:00', end: '14:00' }] },
  { dayOfWeek: 3, ranges: [{ start: '10:00', end: '18:00' }], breaks: [{ start: '13:00', end: '14:00' }] },
  { dayOfWeek: 4, ranges: [{ start: '10:00', end: '18:00' }], breaks: [{ start: '13:00', end: '14:00' }] },
  { dayOfWeek: 5, ranges: [{ start: '10:00', end: '16:00' }], breaks: [{ start: '13:00', end: '14:00' }] },
];

export const teacherAvailabilities: TeacherAvailability[] = [
  {
    teacherId: 'user-teacher-1',
    slotIntervalMinutes: 30,
    defaultLessonDurationMinutes: 60,
    schedule: defaultSchedule,
  },
  {
    teacherId: 'user-teacher-2',
    slotIntervalMinutes: 40,
    defaultLessonDurationMinutes: 60,
    schedule: defaultSchedule,
  },
];

export const initialLessons: Lesson[] = [
  {
    id: 'lesson-1',
    studentId: 'user-student',
    teacherId: 'user-teacher-1',
    directionId: 'dir-vocal',
    date: format(addDays(today, 1), 'yyyy-MM-dd'),
    startTime: '11:00',
    durationMinutes: 60,
    status: 'confirmed',
    location: 'Кабинет 3',
    materials: [
      {
        id: 'lesson-mat-1',
        filename: 'Разминка.pdf',
        mimeType: 'application/pdf',
        url: 'https://example.com/materials/warmup.pdf',
      },
      {
        id: 'lesson-mat-2',
        filename: 'Песня — ноты.pdf',
        mimeType: 'application/pdf',
        url: 'https://example.com/materials/song-notes.pdf',
      },
    ],
    teacherNotes: 'Работать над дыханием и артикуляцией. Повторить куплет из прошлого урока.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lesson-2',
    studentId: 'user-student-2',
    teacherId: 'user-teacher-1',
    directionId: 'dir-vocal',
    date: format(addDays(today, 2), 'yyyy-MM-dd'),
    startTime: '14:00',
    durationMinutes: 60,
    status: 'scheduled',
    location: 'Кабинет 3',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lesson-3',
    studentId: 'user-student',
    teacherId: 'user-teacher-2',
    directionId: 'dir-piano',
    date: format(addDays(today, -3), 'yyyy-MM-dd'),
    startTime: '15:00',
    durationMinutes: 60,
    status: 'completed',
    location: 'Кабинет 1',
    materials: [
      {
        id: 'lesson-mat-3',
        filename: 'Гаммы — упражнение.pdf',
        mimeType: 'application/pdf',
        url: 'https://example.com/materials/scales.pdf',
      },
    ],
    teacherNotes: 'Хороший прогресс по гаммам. На следующем уроке — аккорды.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lesson-4',
    studentId: 'user-student',
    teacherId: 'user-teacher-1',
    directionId: 'dir-vocal',
    date: format(addDays(today, -7), 'yyyy-MM-dd'),
    startTime: '10:00',
    durationMinutes: 60,
    status: 'no_show',
    location: 'Кабинет 3',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const initialHistory: LessonHistoryEntry[] = [
  {
    id: 'hist-1',
    lessonId: 'lesson-1',
    action: 'created',
    newDate: format(addDays(today, 1), 'yyyy-MM-dd'),
    newStartTime: '11:00',
    userId: 'user-student',
    createdAt: new Date().toISOString(),
  },
];

const seedNow = new Date().toISOString();
const hourAgo = new Date(Date.now() - 3600000).toISOString();
const halfHourAgo = new Date(Date.now() - 1800000).toISOString();
const fifteenMinAgo = new Date(Date.now() - 900000).toISOString();
const dayAgo = new Date(Date.now() - 86400000).toISOString();
const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();

export const conversations: Conversation[] = [
  {
    id: 'conv-1',
    type: 'personal',
    title: 'Елена Волкова',
    participantIds: ['user-student', 'user-teacher-1'],
    createdAt: twoDaysAgo,
    updatedAt: fifteenMinAgo,
    lastMessageAt: fifteenMinAgo,
    lastMessage: {
      id: 'msg-3',
      text: 'Спасибо, Елена! Обязательно подготовлю.',
      senderId: 'user-student',
      createdAt: fifteenMinAgo,
    },
    metadata: { lessonId: 'lesson-1' },
    unreadCount: 0,
  },
  {
    id: 'conv-2',
    type: 'study',
    title: 'Группа: Вокал — начальный',
    participantIds: ['user-student', 'user-teacher-1', 'user-student-2'],
    createdAt: twoDaysAgo,
    updatedAt: dayAgo,
    lastMessageAt: dayAgo,
    lastMessage: {
      id: 'msg-4',
      text: 'Напоминаю: на следующей неделе репетиция в субботу.',
      senderId: 'user-teacher-1',
      createdAt: dayAgo,
    },
    unreadCount: 0,
  },
  {
    id: 'conv-3',
    type: 'personal',
    title: 'Игорь Петров',
    participantIds: ['user-teacher-1', 'user-student-2'],
    createdAt: dayAgo,
    updatedAt: hourAgo,
    lastMessageAt: hourAgo,
    lastMessage: {
      id: 'msg-5',
      text: 'Игорь, домашнее задание выполнено?',
      senderId: 'user-teacher-1',
      createdAt: hourAgo,
    },
    unreadCount: 1,
  },
  {
    id: 'conv-4',
    type: 'organizational',
    title: 'Педагоги школы',
    participantIds: ['user-admin', 'user-teacher-1', 'user-teacher-2'],
    createdAt: twoDaysAgo,
    updatedAt: seedNow,
    lastMessageAt: seedNow,
    lastMessage: {
      id: 'msg-7',
      text: 'Расписание на сентябрь обновлено.',
      senderId: 'user-admin',
      createdAt: seedNow,
    },
    unreadCount: 1,
  },
  {
    id: 'conv-5',
    type: 'personal',
    title: 'Дмитрий Козлов',
    participantIds: ['user-student', 'user-teacher-2'],
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo,
    lastMessageAt: twoDaysAgo,
    lastMessage: {
      id: 'msg-8',
      text: 'До встречи на занятии!',
      senderId: 'user-teacher-2',
      createdAt: twoDaysAgo,
    },
    metadata: { lessonId: 'lesson-3' },
    unreadCount: 1,
  },
];

export const conversationMembers: ConversationMember[] = [
  { conversationId: 'conv-1', userId: 'user-student', role: 'member', joinedAt: twoDaysAgo, lastReadMessageId: 'msg-3', lastReadAt: fifteenMinAgo, muted: false },
  { conversationId: 'conv-1', userId: 'user-teacher-1', role: 'member', joinedAt: twoDaysAgo, lastReadMessageId: 'msg-3', lastReadAt: fifteenMinAgo, muted: false },
  { conversationId: 'conv-2', userId: 'user-student', role: 'member', joinedAt: twoDaysAgo, lastReadMessageId: 'msg-4', lastReadAt: dayAgo, muted: false },
  { conversationId: 'conv-2', userId: 'user-teacher-1', role: 'owner', joinedAt: twoDaysAgo, lastReadMessageId: 'msg-4', lastReadAt: dayAgo, muted: false },
  { conversationId: 'conv-2', userId: 'user-student-2', role: 'member', joinedAt: twoDaysAgo, muted: false },
  { conversationId: 'conv-3', userId: 'user-teacher-1', role: 'member', joinedAt: dayAgo, lastReadMessageId: 'msg-5', lastReadAt: hourAgo, muted: false },
  { conversationId: 'conv-3', userId: 'user-student-2', role: 'member', joinedAt: dayAgo, muted: false },
  { conversationId: 'conv-4', userId: 'user-admin', role: 'owner', joinedAt: twoDaysAgo, lastReadMessageId: 'msg-7', lastReadAt: seedNow, muted: false },
  { conversationId: 'conv-4', userId: 'user-teacher-1', role: 'member', joinedAt: twoDaysAgo, muted: false },
  { conversationId: 'conv-4', userId: 'user-teacher-2', role: 'member', joinedAt: twoDaysAgo, lastReadMessageId: 'msg-7', lastReadAt: seedNow, muted: false },
  { conversationId: 'conv-5', userId: 'user-student', role: 'member', joinedAt: twoDaysAgo, muted: false },
  { conversationId: 'conv-5', userId: 'user-teacher-2', role: 'member', joinedAt: twoDaysAgo, lastReadMessageId: 'msg-8', lastReadAt: twoDaysAgo, muted: false },
];

export const messages: Message[] = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-teacher-1',
    text: 'Анна, не забудьте разминку перед занятием!',
    createdAt: hourAgo,
    status: 'read',
    readBy: ['user-student', 'user-teacher-1'],
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    senderId: 'user-teacher-1',
    text: 'Также подготовьте песню, которую разбирали на прошлом уроке.',
    createdAt: halfHourAgo,
    status: 'read',
    readBy: ['user-student', 'user-teacher-1'],
  },
  {
    id: 'msg-3',
    conversationId: 'conv-1',
    senderId: 'user-student',
    text: 'Спасибо, Елена! Обязательно подготовлю.',
    createdAt: fifteenMinAgo,
    status: 'read',
    readBy: ['user-student', 'user-teacher-1'],
  },
  {
    id: 'msg-4',
    conversationId: 'conv-2',
    senderId: 'user-teacher-1',
    text: 'Напоминаю: на следующей неделе репетиция в субботу.',
    createdAt: dayAgo,
    status: 'read',
    readBy: ['user-student', 'user-teacher-1'],
  },
  {
    id: 'msg-5',
    conversationId: 'conv-3',
    senderId: 'user-teacher-1',
    text: 'Игорь, домашнее задание выполнено?',
    createdAt: hourAgo,
    status: 'sent',
    readBy: ['user-teacher-1'],
  },
  {
    id: 'msg-6',
    conversationId: 'conv-3',
    senderId: 'user-student-2',
    text: 'Да, записал этюд три раза.',
    createdAt: halfHourAgo,
    status: 'sent',
    readBy: ['user-student-2'],
  },
  {
    id: 'msg-7',
    conversationId: 'conv-4',
    senderId: 'user-admin',
    text: 'Расписание на сентябрь обновлено.',
    createdAt: seedNow,
    status: 'sent',
    readBy: ['user-admin', 'user-teacher-2'],
  },
  {
    id: 'msg-8',
    conversationId: 'conv-5',
    senderId: 'user-teacher-2',
    text: 'До встречи на занятии!',
    createdAt: twoDaysAgo,
    status: 'sent',
    readBy: ['user-teacher-2'],
  },
];

export const events: SchoolEvent[] = [
  {
    id: 'event-1',
    title: 'Весенний концерт',
    description: 'Выступление учеников школы в концертном зале',
    type: 'concert',
    date: format(addDays(today, 14), 'yyyy-MM-dd'),
    startTime: '18:00',
    endTime: '21:00',
    location: 'Концертный зал «Гармония»',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=450&fit=crop',
    maxParticipants: 50,
    registeredUserIds: ['user-student'],
  },
  {
    id: 'event-2',
    title: 'Мастер-класс по джазовому вокалу',
    description: 'Приглашённый педагог — импровизация и scat',
    type: 'masterclass',
    date: format(addDays(today, 7), 'yyyy-MM-dd'),
    startTime: '15:00',
    endTime: '17:00',
    location: 'Студия 2',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=450&fit=crop',
    maxParticipants: 12,
    registeredUserIds: [],
  },
  {
    id: 'event-3',
    title: 'Конкурс молодых вокалистов',
    description: 'Региональный отборочный этап',
    type: 'competition',
    date: format(addDays(today, 21), 'yyyy-MM-dd'),
    startTime: '10:00',
    location: 'Филармония',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=450&fit=crop',
    registeredUserIds: [],
  },
];

export const notifications: AppNotification[] = [
  {
    id: 'notif-1',
    userId: 'user-student',
    type: 'lesson',
    title: 'Занятие подтверждено',
    body: 'Вокал с Еленой Волковой завтра в 11:00',
    read: false,
    createdAt: new Date().toISOString(),
    link: '/lessons/lesson-1',
  },
  {
    id: 'notif-2',
    userId: 'user-student',
    type: 'message',
    title: 'Новое сообщение',
    body: 'Елена Волкова: не забудьте разминку',
    read: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    link: '/chat/conv-1',
  },
  {
    id: 'notif-3',
    userId: 'user-student',
    type: 'event',
    title: 'Мастер-класс через неделю',
    body: 'Запись открыта: джазовый вокал',
    read: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    link: '/events/event-2',
  },
];

export const initialAssignmentGroups: AssignmentGroup[] = [
  {
    id: 'grp-general',
    name: 'Общее задание',
    teacherId: 'user-teacher-1',
    memberIds: ['user-student', 'user-student-2'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'grp-vocalists',
    name: 'Вокалисты',
    teacherId: 'user-teacher-1',
    memberIds: ['user-student'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'grp-guitarists',
    name: 'Гитаристы',
    teacherId: 'user-teacher-1',
    memberIds: ['user-student-2'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const initialAssignments: Assignment[] = [
  {
    id: 'asgn-1',
    title: 'Дыхательная гимнастика',
    description: 'Материалы для вокальной группы — выполните упражнения из методички.',
    teacherId: 'user-teacher-1',
    groupId: 'grp-vocalists',
    dueDate: format(addDays(today, 5), 'yyyy-MM-dd'),
    contentBlocks: [
      {
        id: 'blk-1',
        type: 'text',
        order: 0,
        text: 'Выполните упражнения из методички (стр. 12–15). Запишите 2 минуты вокальной разминки.',
      },
      {
        id: 'blk-2',
        type: 'pdf',
        order: 1,
        filename: 'breathing-exercises.pdf',
        mimeType: 'application/pdf',
        url: '#',
      },
      {
        id: 'blk-3',
        type: 'voice',
        order: 2,
        filename: 'demo-warmup.mp3',
        mimeType: 'audio/mpeg',
        url: '#',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'asgn-2',
    title: 'Этюд №3',
    description: 'Материалы для гитаристов — отработка первых 16 тактов.',
    teacherId: 'user-teacher-1',
    groupId: 'grp-guitarists',
    dueDate: format(addDays(today, 7), 'yyyy-MM-dd'),
    contentBlocks: [
      {
        id: 'blk-4',
        type: 'text',
        order: 0,
        text: 'Отработайте первые 16 тактов с метрономом 60 bpm.',
      },
      {
        id: 'blk-5',
        type: 'video',
        order: 1,
        filename: 'etude-demo.mp4',
        mimeType: 'video/mp4',
        url: '#',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const skills: Skill[] = [
  {
    id: 'skill-breathing',
    name: 'Дыхание',
    description: 'Контроль дыхания и опора',
    directionId: 'dir-vocal',
    maxLevel: 100,
  },
  {
    id: 'skill-intonation',
    name: 'Интонция',
    description: 'Точность высоты и тембр',
    directionId: 'dir-vocal',
    maxLevel: 100,
  },
  {
    id: 'skill-stage',
    name: 'Сценическое движение',
    description: 'Подвижность и выразительность на сцене',
    directionId: 'dir-vocal',
    maxLevel: 100,
  },
  {
    id: 'skill-scales',
    name: 'Гаммы и арпеджио',
    description: 'Техника фортепианной школы',
    directionId: 'dir-piano',
    maxLevel: 100,
  },
];

export const initialSkillProgress: StudentSkillProgress[] = [
  {
    id: 'prog-1',
    studentId: 'user-student',
    skillId: 'skill-breathing',
    level: 45,
    note: 'Стабильнее на средних нотах',
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'prog-2',
    studentId: 'user-student',
    skillId: 'skill-intonation',
    level: 60,
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'prog-3',
    studentId: 'user-student',
    skillId: 'skill-stage',
    level: 30,
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'prog-4',
    studentId: 'user-student-2',
    skillId: 'skill-scales',
    level: 55,
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

export const initialProgressGoals: ProgressGoal[] = [
  {
    id: 'goal-1',
    studentId: 'user-student',
    teacherId: 'user-teacher-1',
    title: 'Подготовить арию к концерту',
    description: 'Выучить партию и отработать с аккомпанементом',
    targetDate: format(addDays(today, 14), 'yyyy-MM-dd'),
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'goal-2',
    studentId: 'user-student',
    teacherId: 'user-teacher-1',
    title: 'Освоить сольфеджио — мажорные интервалы',
    status: 'completed',
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    completedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'goal-3',
    studentId: 'user-student-2',
    teacherId: 'user-teacher-1',
    title: 'Сыграть этюд без остановок',
    targetDate: format(addDays(today, 7), 'yyyy-MM-dd'),
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
];

export const initialProgressHistory: ProgressHistoryEntry[] = [
  {
    id: 'hist-prog-1',
    studentId: 'user-student',
    type: 'lesson',
    title: 'Занятие по вокалу завершено',
    description: 'Отработали дыхательные упражнения',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'hist-prog-2',
    studentId: 'user-student',
    type: 'assignment',
    title: 'Задание отправлено на проверку',
    description: 'Анализ произведения',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'hist-prog-3',
    studentId: 'user-student',
    type: 'skill',
    title: 'Прогресс: Интонция',
    description: 'Уровень повышен до 60%',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'hist-prog-4',
    studentId: 'user-student',
    type: 'achievement',
    title: 'Достижение: Первое занятие',
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: 'hist-prog-5',
    studentId: 'user-student-2',
    type: 'assignment',
    title: 'Задание проверено',
    description: 'Гаммы соль мажор — оценка 4',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const achievementDefinitions: AchievementDefinition[] = [
  {
    id: 'ach-first-lesson',
    code: 'first_lesson',
    title: 'Первое занятие',
    description: 'Посетили первое занятие в школе',
    icon: 'music',
  },
  {
    id: 'ach-ten-lessons',
    code: 'ten_lessons',
    title: '10 занятий',
    description: 'Провели 10 занятий',
    icon: 'calendar',
  },
  {
    id: 'ach-skill-master',
    code: 'skill_master',
    title: 'Освоенный навык',
    description: 'Достигли 80% по любому навыку',
    icon: 'star',
  },
  {
    id: 'ach-regular',
    code: 'regularity',
    title: 'Регулярность',
    description: 'Занимались 4 недели подряд',
    icon: 'award',
  },
  {
    id: 'ach-performance',
    code: 'first_performance',
    title: 'Первое выступление',
    description: 'Участие в концерте или мероприятии',
    icon: 'mic',
  },
];

export const initialUserAchievements: UserAchievement[] = [
  {
    id: 'uach-1',
    studentId: 'user-student',
    achievementId: 'ach-first-lesson',
    unlockedAt: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: 'uach-2',
    studentId: 'user-student-2',
    achievementId: 'ach-first-lesson',
    unlockedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: 'uach-3',
    studentId: 'user-student-2',
    achievementId: 'ach-skill-master',
    unlockedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

export const helpArticles: HelpArticle[] = [
  {
    id: 'faq-1',
    question: 'Как записаться на занятие?',
    answer:
      'Откройте раздел «Занятия» → «Записаться», выберите направление, преподавателя, дату и свободный слот. После подтверждения занятие появится в расписании.',
    category: 'booking',
    keywords: ['запись', 'занятие', 'слот', 'расписание'],
  },
  {
    id: 'faq-2',
    question: 'Как перенести или отменить занятие?',
    answer:
      'Откройте карточку занятия и нажмите «Перенести» или «Отменить». Доступные действия зависят от времени до начала занятия и вашей роли.',
    category: 'booking',
    keywords: ['перенос', 'отмена', 'занятие'],
  },
  {
    id: 'faq-3',
    question: 'Как сдать домашнее задание?',
    answer:
      'В разделе «Домашние задания» откройте задание, загрузите ответ (текст или файл — в зависимости от типа) и отправьте. Статус изменится после проверки преподавателем.',
    category: 'assignments',
    keywords: ['домашнее', 'задание', 'ответ', 'сдать'],
  },
  {
    id: 'faq-4',
    question: 'Как написать преподавателю в чате?',
    answer:
      'Перейдите в «Чат», выберите существующий диалог или создайте новый. Сообщения синхронизируются в реальном времени, когда вы онлайн.',
    category: 'chat',
    keywords: ['чат', 'сообщение', 'преподаватель'],
  },
  {
    id: 'faq-5',
    question: 'Приложение не работает без интернета',
    answer:
      'Большинство действий требуют подключения к сети. При offline вы можете просматривать уже загруженные данные; запись, отправка сообщений и загрузка файлов будут недоступны.',
    category: 'technical',
    keywords: ['offline', 'интернет', 'ошибка', 'сеть'],
  },
];

export const initialSupportTickets: SupportTicket[] = [
  {
    id: 'ticket-1',
    userId: 'user-student',
    subject: 'Не вижу свободные слоты',
    message: 'При записи на занятие к преподавателю Ивановой на следующую неделю слоты не отображаются.',
    category: 'booking',
    status: 'answered',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    adminReply: {
      text: 'Проверьте, что выбрана правильная дата и направление. Если проблема сохраняется — уточните у преподавателя расписание в чате.',
      authorId: 'user-admin',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    attachments: [],
  },
  {
    id: 'ticket-2',
    userId: 'user-student-2',
    subject: 'Не загружается файл к заданию',
    message: 'При отправке домашнего задания по вокалу файл mp3 не прикрепляется, появляется ошибка.',
    category: 'assignments',
    status: 'open',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    attachments: [
      {
        id: 'attach-1',
        filename: 'homework-error.mp3',
        mimeType: 'audio/mpeg',
        url: 'mock://support/homework-error.mp3',
      },
    ],
  },
];

export interface SecuritySessionRecord {
  id: string;
  userId: string;
  token: string;
  deviceLabel: string;
  platform: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
}

export const initialLoginHistory: LoginHistoryEntry[] = [
  {
    id: 'login-1',
    userId: 'user-student',
    deviceLabel: 'Chrome · Windows',
    ipAddress: '192.168.1.10',
    success: true,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'login-2',
    userId: 'user-student',
    deviceLabel: 'Safari · iPhone',
    ipAddress: '10.0.0.5',
    success: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'login-3',
    userId: 'user-student',
    deviceLabel: 'Неизвестное устройство',
    ipAddress: '203.0.113.42',
    success: false,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

export const initialSecurityAlerts: SecurityAlert[] = [
  {
    id: 'sec-alert-1',
    userId: 'user-student',
    type: 'new_device',
    title: 'Вход с нового устройства',
    message: 'Обнаружен вход с Chrome на Windows. Если это были не вы — смените пароль.',
    read: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'sec-alert-2',
    userId: 'user-student',
    type: 'failed_login',
    title: 'Неудачная попытка входа',
    message: 'Кто-то пытался войти в аккаунт с неверным паролем.',
    read: true,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

export const initialSecuritySessions: SecuritySessionRecord[] = [
  {
    id: 'sess-1',
    userId: 'user-student',
    token: 'seed-token-student-desktop',
    deviceLabel: 'Chrome · Windows',
    platform: 'web',
    ipAddress: '192.168.1.10',
    lastActiveAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'sess-2',
    userId: 'user-student',
    token: 'seed-token-student-mobile',
    deviceLabel: 'Safari · iPhone',
    platform: 'ios',
    ipAddress: '10.0.0.5',
    lastActiveAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
  },
];

const LEGAL_DISCLAIMER =
  'Текст носит демонстрационный характер и требует юридической проверки перед публикацией.';

export const initialLegalDocuments: LegalDocument[] = [
  {
    id: 'legal-privacy',
    type: 'privacy_policy',
    title: 'Политика конфиденциальности',
    content: `Политика описывает, как школа «Квартира» обрабатывает персональные данные учеников и посетителей сайта.\n\n${LEGAL_DISCLAIMER}`,
    currentVersion: '2.0',
    effectiveAt: format(addDays(today, -14), 'yyyy-MM-dd'),
    requiresConsent: true,
    versionHistory: [
      {
        version: '2.0',
        effectiveAt: format(addDays(today, -14), 'yyyy-MM-dd'),
        changeSummary: 'Уточнены цели обработки и сроки хранения данных.',
      },
      {
        version: '1.0',
        effectiveAt: format(addDays(today, -365), 'yyyy-MM-dd'),
        changeSummary: 'Первая публикуемая версия.',
      },
    ],
  },
  {
    id: 'legal-personal-data',
    type: 'personal_data',
    title: 'Согласие на обработку персональных данных',
    content: `Документ определяет перечень обрабатываемых данных, цели и права субъекта персональных данных.\n\n${LEGAL_DISCLAIMER}`,
    currentVersion: '1.0',
    effectiveAt: format(addDays(today, -180), 'yyyy-MM-dd'),
    requiresConsent: true,
    versionHistory: [
      {
        version: '1.0',
        effectiveAt: format(addDays(today, -180), 'yyyy-MM-dd'),
        changeSummary: 'Первая публикуемая версия.',
      },
    ],
  },
  {
    id: 'legal-terms',
    type: 'terms_of_service',
    title: 'Пользовательское соглашение',
    content: `Условия использования приложения школы «Квартира»: регистрация, запись на занятия, чат и уведомления.\n\n${LEGAL_DISCLAIMER}`,
    currentVersion: '1.0',
    effectiveAt: format(addDays(today, -180), 'yyyy-MM-dd'),
    requiresConsent: true,
    versionHistory: [
      {
        version: '1.0',
        effectiveAt: format(addDays(today, -180), 'yyyy-MM-dd'),
        changeSummary: 'Первая публикуемая версия.',
      },
    ],
  },
  {
    id: 'legal-school-rules',
    type: 'school_rules',
    title: 'Правила школы',
    content: `Внутренние правила посещения занятий, отмены, поведения на мероприятиях и в общих пространствах.\n\n${LEGAL_DISCLAIMER}`,
    currentVersion: '1.0',
    effectiveAt: format(addDays(today, -90), 'yyyy-MM-dd'),
    requiresConsent: false,
    versionHistory: [
      {
        version: '1.0',
        effectiveAt: format(addDays(today, -90), 'yyyy-MM-dd'),
        changeSummary: 'Первая публикуемая версия.',
      },
    ],
  },
];

export const initialUserConsents: UserConsent[] = [
  {
    id: 'consent-1',
    userId: 'user-student',
    documentId: 'legal-privacy',
    documentType: 'privacy_policy',
    documentTitle: 'Политика конфиденциальности',
    version: '1.0',
    acceptedAt: new Date(Date.now() - 86400000 * 200).toISOString(),
  },
  {
    id: 'consent-2',
    userId: 'user-student',
    documentId: 'legal-personal-data',
    documentType: 'personal_data',
    documentTitle: 'Согласие на обработку персональных данных',
    version: '1.0',
    acceptedAt: new Date(Date.now() - 86400000 * 150).toISOString(),
  },
  {
    id: 'consent-3',
    userId: 'user-student',
    documentId: 'legal-terms',
    documentType: 'terms_of_service',
    documentTitle: 'Пользовательское соглашение',
    version: '1.0',
    acceptedAt: new Date(Date.now() - 86400000 * 150).toISOString(),
  },
  {
    id: 'consent-4',
    userId: 'user-teacher',
    documentId: 'legal-privacy',
    documentType: 'privacy_policy',
    documentTitle: 'Политика конфиденциальности',
    version: '2.0',
    acceptedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'consent-5',
    userId: 'user-teacher',
    documentId: 'legal-personal-data',
    documentType: 'personal_data',
    documentTitle: 'Согласие на обработку персональных данных',
    version: '1.0',
    acceptedAt: new Date(Date.now() - 86400000 * 100).toISOString(),
  },
  {
    id: 'consent-6',
    userId: 'user-teacher',
    documentId: 'legal-terms',
    documentType: 'terms_of_service',
    documentTitle: 'Пользовательское соглашение',
    version: '1.0',
    acceptedAt: new Date(Date.now() - 86400000 * 100).toISOString(),
  },
];

export const publicSchoolInfo: PublicSchoolInfo = {
  name: 'Квартира',
  tagline: 'Школа музыки и вокала',
  about:
    '«Квартира» — это пространство, где музыка становится частью жизни. Индивидуальные занятия, концерты, мастер-классы и поддержка на каждом этапе — от первой ноты до сцены.',
  contacts: {
    phone: '+7 (900) 123-45-67',
    email: 'hello@kvartira-music.ru',
    address: 'г. Москва, ул. Музыкальная, 12',
    workingHours: 'Пн–Сб: 10:00–20:00',
  },
};

export const publicNews: PublicNewsItem[] = [
  {
    id: 'news-1',
    title: 'Открыта запись на весенний концерт',
    excerpt: 'Ученики школы готовят программу из любимых произведений. Репетиции стартуют в марте.',
    publishedAt: format(addDays(today, -3), 'yyyy-MM-dd'),
  },
  {
    id: 'news-2',
    title: 'Новое направление — ударные',
    excerpt: 'Групповые и индивидуальные занятия для начинающих и продолжающих.',
    publishedAt: format(addDays(today, -10), 'yyyy-MM-dd'),
  },
];

export function getDayOfWeekFromDate(dateStr: string): number {
  return getDay(new Date(dateStr + 'T12:00:00'));
}
