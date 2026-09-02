import { describe, it, expect, beforeEach } from 'vitest';
import { mockLessonsApi, resetMockDatabase } from '@/services/api/mock';
import { createMockChatApi } from '@/services/api/mock/chat';
import {
  conversations as seedConversations,
  conversationMembers as seedConversationMembers,
  initialLessons,
  messages as seedMessages,
  users,
} from '@/mocks/seed';
import {
  findConversationForLesson,
  sanitizeLessonForViewer,
  canViewTeacherNotes,
} from '@/services/lessons/helpers';
import { canEditTeacherNotes } from '@/services/lessons/access';
import type { User } from '@/types';

const delay = async () => undefined;

function createChatApi(lessons = initialLessons) {
  return createMockChatApi(
    {
      users,
      lessons,
      conversations: structuredClone(seedConversations),
      conversationMembers: structuredClone(seedConversationMembers),
      messages: structuredClone(seedMessages),
      notifications: [],
      openConversations: new Map(),
    },
    delay,
  );
}

const teacher: User = {
  id: 'user-teacher-1',
  phone: '+7',
  role: 'teacher',
  firstName: 'Elena',
  lastName: 'Volkova',
};

const student: User = {
  id: 'user-student',
  phone: '+7',
  role: 'student',
  firstName: 'Anna',
  lastName: 'Ivanova',
};

const sampleMaterials = [
  {
    id: 'm1',
    filename: 'notes.pdf',
    mimeType: 'application/pdf',
    url: '/files/notes.pdf',
  },
  {
    id: 'm2',
    filename: 'song.pdf',
    mimeType: 'application/pdf',
    url: '/files/song.pdf',
  },
];

const lessonWithMaterials = {
  ...initialLessons.find((l) => l.id === 'lesson-1')!,
  materials: sampleMaterials,
};

describe('lesson detail helpers', () => {
  it('finds conversation by lesson metadata', () => {
    const conversation = findConversationForLesson(seedConversations, lessonWithMaterials);
    expect(conversation?.id).toBe('conv-1');
    expect(conversation?.metadata?.lessonId).toBe('lesson-1');
  });

  it('falls back to personal chat between student and teacher', () => {
    const lesson = initialLessons.find((l) => l.id === 'lesson-2')!;

    const conversation = findConversationForLesson(seedConversations, lesson);
    expect(conversation?.id).toBe('conv-3');
  });

  it('hides teacher notes from student in sanitizeLessonForViewer', () => {
    const sanitized = sanitizeLessonForViewer(lessonWithMaterials, student);
    expect(sanitized.materials?.length).toBeGreaterThan(0);
    expect(sanitized.teacherNotes).toBeUndefined();
  });

  it('keeps teacher notes for teacher and admin', () => {
    expect(sanitizeLessonForViewer(lessonWithMaterials, teacher).teacherNotes).toBeTruthy();
    expect(
      sanitizeLessonForViewer(lessonWithMaterials, {
        ...teacher,
        id: 'user-admin',
        role: 'admin',
      }).teacherNotes,
    ).toBeTruthy();
  });

  it('canViewTeacherNotes is teacher/admin only', () => {
    expect(canViewTeacherNotes(student)).toBe(false);
    expect(canViewTeacherNotes(teacher)).toBe(true);
  });

  it('canEditTeacherNotes is lesson teacher only', () => {
    expect(canEditTeacherNotes(teacher, lessonWithMaterials)).toBe(true);
    expect(canEditTeacherNotes(student, lessonWithMaterials)).toBe(false);
  });
});

describe('lesson detail API', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('getLesson hides teacher notes from student', async () => {
    const lesson = await mockLessonsApi.getLesson('lesson-1', student.id);
    expect(lesson.teacherNotes).toBeUndefined();
  });

  it('getLesson returns teacher notes for teacher', async () => {
    const lesson = await mockLessonsApi.getLesson('lesson-1', teacher.id);
    expect(lesson.teacherNotes).toContain('дыханием');
  });

  it('updateTeacherNotes saves for lesson teacher', async () => {
    const updated = await mockLessonsApi.updateTeacherNotes('lesson-1', 'Новая заметка', teacher.id);
    expect(updated.teacherNotes).toBe('Новая заметка');

    const lesson = await mockLessonsApi.getLesson('lesson-1', teacher.id);
    expect(lesson.teacherNotes).toBe('Новая заметка');
  });

  it('updateTeacherNotes rejects student', async () => {
    await expect(
      mockLessonsApi.updateTeacherNotes('lesson-1', 'hack', student.id),
    ).rejects.toThrow('заметок');
  });

  it('getConversationForLesson returns linked chat', async () => {
    const chatApi = createChatApi();
    const conversation = await chatApi.getConversationForLesson('lesson-1', student.id);
    expect(conversation?.id).toBe('conv-1');
  });

  it('getConversationForLesson returns lesson-3 chat via metadata', async () => {
    const chatApi = createChatApi();
    const conversation = await chatApi.getConversationForLesson('lesson-3', student.id);
    expect(conversation?.id).toBe('conv-5');
  });
});
