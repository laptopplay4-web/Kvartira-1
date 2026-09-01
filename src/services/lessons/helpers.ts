import type { Conversation, Lesson, User } from '@/types';

export function findConversationForLesson(
  conversations: Conversation[],
  lesson: Lesson,
): Conversation | undefined {
  const byMetadata = conversations.find((c) => c.metadata?.lessonId === lesson.id);
  if (byMetadata) return byMetadata;

  return conversations.find(
    (c) =>
      c.type === 'personal' &&
      c.participantIds.includes(lesson.studentId) &&
      c.participantIds.includes(lesson.teacherId),
  );
}

export function canViewTeacherNotes(user: User): boolean {
  return user.role === 'teacher' || user.role === 'admin';
}

export function sanitizeLessonForViewer<T extends Lesson>(lesson: T, user: User): T {
  if (canViewTeacherNotes(user)) return lesson;
  const { teacherNotes: _teacherNotes, ...rest } = lesson;
  return rest as T;
}
