import { describe, it, expect, beforeEach } from 'vitest';
import { format, addDays } from 'date-fns';
import { mockAssignmentsApi, resetMockDatabase } from '@/services/api/mock';
import {
  canViewAssignment,
  canSubmitAssignment,
  canReviewAssignment,
  canCreateAssignment,
} from '@/services/assignments/access';
import { getAssignmentDisplayStatus, getUpcomingAssignmentsForHome } from '@/services/assignments/helpers';
import {
  responseTypeMatchesFile,
  validateAssignmentMaterial,
  validateAssignmentResponseFile,
  validateAssignmentFeedbackAudio,
} from '@/services/assignments/validation';
import type { Assignment, User } from '@/types';

const student: User = {
  id: 'user-student',
  phone: '+7',
  role: 'student',
  firstName: 'A',
  lastName: 'B',
};
const teacher: User = {
  id: 'user-teacher-1',
  phone: '+7',
  role: 'teacher',
  firstName: 'C',
  lastName: 'D',
};
const otherStudent: User = {
  id: 'user-student-2',
  phone: '+7',
  role: 'student',
  firstName: 'E',
  lastName: 'F',
};

const baseAssignment: Assignment = {
  id: 'asgn-test',
  title: 'Test',
  description: 'Desc',
  teacherId: teacher.id,
  studentId: student.id,
  dueDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
  responseType: 'text',
  status: 'assigned',
  materials: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('assignment access', () => {
  it('student can view own assignment', () => {
    expect(canViewAssignment(student, baseAssignment)).toBe(true);
  });

  it('student cannot view others assignment', () => {
    expect(canViewAssignment(student, { ...baseAssignment, studentId: otherStudent.id })).toBe(false);
  });

  it('teacher can view assigned student work', () => {
    expect(canViewAssignment(teacher, baseAssignment)).toBe(true);
  });

  it('student can submit when assigned', () => {
    expect(canSubmitAssignment(student, baseAssignment)).toBe(true);
  });

  it('student cannot submit reviewed assignment', () => {
    expect(canSubmitAssignment(student, { ...baseAssignment, status: 'reviewed' })).toBe(false);
  });

  it('teacher can review submitted assignment', () => {
    expect(
      canReviewAssignment(teacher, { ...baseAssignment, status: 'submitted', submission: { submittedAt: new Date().toISOString() } }),
    ).toBe(true);
  });

  it('teacher can create assignments', () => {
    expect(canCreateAssignment(teacher)).toBe(true);
    expect(canCreateAssignment(student)).toBe(false);
  });

  it('marks overdue when past due and still assigned', () => {
    const overdue = { ...baseAssignment, dueDate: '2020-01-01', status: 'assigned' as const };
    expect(getAssignmentDisplayStatus(overdue)).toBe('overdue');
  });
});

describe('assignment home helpers', () => {
  it('filters pending assignments and sorts by due date', () => {
    const reviewed = { ...baseAssignment, id: 'a1', dueDate: '2099-01-01', status: 'reviewed' as const };
    const overdue = { ...baseAssignment, id: 'a2', dueDate: '2020-01-01', status: 'assigned' as const };
    const upcoming = { ...baseAssignment, id: 'a3', dueDate: '2099-06-01', status: 'assigned' as const };
    const submitted = {
      ...baseAssignment,
      id: 'a4',
      dueDate: '2099-03-01',
      status: 'submitted' as const,
      submission: { submittedAt: new Date().toISOString() },
    };

    const result = getUpcomingAssignmentsForHome([reviewed, overdue, upcoming, submitted]);

    expect(result.map((a) => a.id)).toEqual(['a2', 'a4', 'a3']);
  });

  it('limits home assignments to three items', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      ...baseAssignment,
      id: `a${i}`,
      dueDate: format(addDays(new Date(), i + 1), 'yyyy-MM-dd'),
    }));

    expect(getUpcomingAssignmentsForHome(items).length).toBe(3);
  });
});

describe('assignment file validation', () => {
  it('accepts pdf as material', () => {
    const result = validateAssignmentMaterial({
      filename: 'sheet.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    });
    expect(result.valid).toBe(true);
  });

  it('matches audio response type', () => {
    expect(responseTypeMatchesFile('audio', 'audio/mpeg', 'warmup.mp3')).toBe(true);
    expect(responseTypeMatchesFile('audio', 'image/png', 'photo.png')).toBe(false);
  });

  it('rejects wrong file for response type', () => {
    const result = validateAssignmentResponseFile(
      { filename: 'photo.png', mimeType: 'image/png', size: 1024 },
      'audio',
    );
    expect(result.valid).toBe(false);
  });
});

describe('mock assignments API', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('student sees only own assignments', async () => {
    const list = await mockAssignmentsApi.getAssignments({ requesterId: student.id });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((a) => a.studentId === student.id)).toBe(true);
  });

  it('teacher sees assignments for their students', async () => {
    const list = await mockAssignmentsApi.getAssignments({ requesterId: teacher.id });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((a) => a.teacherId === teacher.id)).toBe(true);
  });

  it('blocks IDOR on getAssignment', async () => {
    await expect(mockAssignmentsApi.getAssignment('asgn-4', student.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('student submits text response', async () => {
    const created = await mockAssignmentsApi.createAssignment(
      {
        title: 'Текстовое',
        description: 'Описание',
        studentId: student.id,
        dueDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
        responseType: 'text',
      },
      teacher.id,
    );
    const updated = await mockAssignmentsApi.submitAssignment(
      created.id,
      { text: 'Выполнено' },
      student.id,
    );
    expect(updated.status).toBe('submitted');
    expect(updated.submission?.text).toBe('Выполнено');
  });

  it('student submits audio file for audio assignment', async () => {
    const updated = await mockAssignmentsApi.submitAssignment(
      'asgn-1',
      {
        attachmentUrl: 'mock://audio.mp3',
        attachmentFilename: 'warmup.mp3',
        attachmentMimeType: 'audio/mpeg',
      },
      student.id,
    );
    expect(updated.status).toBe('submitted');
    expect(updated.submission?.attachmentFilename).toBe('warmup.mp3');
  });

  it('rejects text-only submit for audio assignment', async () => {
    await expect(
      mockAssignmentsApi.submitAssignment('asgn-2', { text: 'Только текст' }, student.id),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('uploads assignment material for teacher', async () => {
    const file = await mockAssignmentsApi.uploadAssignmentFile(
      { filename: 'notes.pdf', mimeType: 'application/pdf', size: 2048 },
      teacher.id,
      'material',
    );
    expect(file.filename).toBe('notes.pdf');
  });

  it('validates feedback audio file', () => {
    expect(
      validateAssignmentFeedbackAudio({ filename: 'comment.mp3', mimeType: 'audio/mpeg', size: 1024 }).valid,
    ).toBe(true);
    expect(
      validateAssignmentFeedbackAudio({ filename: 'photo.png', mimeType: 'image/png', size: 1024 }).valid,
    ).toBe(false);
  });

  it('teacher reviews submission', async () => {
    const updated = await mockAssignmentsApi.reviewAssignment(
      'asgn-3',
      { text: 'Отлично', rating: 5 },
      teacher.id,
    );
    expect(updated.status).toBe('reviewed');
    expect(updated.feedback?.text).toBe('Отлично');
  });

  it('teacher reviews with audio comment', async () => {
    const updated = await mockAssignmentsApi.reviewAssignment(
      'asgn-3',
      {
        audioUrl: 'mock://feedback/review.mp3',
        audioFilename: 'review.mp3',
        audioMimeType: 'audio/mpeg',
        rating: 5,
      },
      teacher.id,
    );
    expect(updated.status).toBe('reviewed');
    expect(updated.feedback?.audioUrl).toBe('mock://feedback/review.mp3');
    expect(updated.feedback?.text).toBeUndefined();
  });

  it('rejects review without text or audio', async () => {
    await expect(
      mockAssignmentsApi.reviewAssignment('asgn-3', { rating: 5 }, teacher.id),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('teacher uploads feedback audio', async () => {
    const file = await mockAssignmentsApi.uploadAssignmentFile(
      { filename: 'feedback.mp3', mimeType: 'audio/mpeg', size: 2048 },
      teacher.id,
      'feedback',
    );
    expect(file.filename).toBe('feedback.mp3');
  });

  it('rejects non-audio feedback upload', async () => {
    await expect(
      mockAssignmentsApi.uploadAssignmentFile(
        { filename: 'photo.png', mimeType: 'image/png', size: 1024 },
        teacher.id,
        'feedback',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('teacher creates assignment for student', async () => {
    const dueDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    const beforeCount = (await mockAssignmentsApi.getAssignments({ requesterId: student.id })).length;
    const created = await mockAssignmentsApi.createAssignment(
      {
        title: 'Новое задание',
        description: 'Описание',
        studentId: student.id,
        dueDate,
        responseType: 'text',
      },
      teacher.id,
    );
    expect(created.teacherId).toBe(teacher.id);
    expect(created.studentId).toBe(student.id);
    expect(created.status).toBe('assigned');

    const after = await mockAssignmentsApi.getAssignments({ requesterId: student.id });
    expect(after.length).toBe(beforeCount + 1);
  });

  it('notifies student when assignment is created', async () => {
    const { mockNotificationsApi } = await import('@/services/api/mock');
    const before = await mockNotificationsApi.getNotifications(student.id);
    await mockAssignmentsApi.createAssignment(
      {
        title: 'Уведомление тест',
        description: 'Описание',
        studentId: student.id,
        dueDate: format(addDays(new Date(), 4), 'yyyy-MM-dd'),
        responseType: 'text',
      },
      teacher.id,
    );
    const after = await mockNotificationsApi.getNotifications(student.id);
    expect(after.length).toBe(before.length + 1);
    expect(after[0].type).toBe('assignment');
    expect(after[0].title).toBe('Новое домашнее задание');
  });

  it('admin can view all assignments', async () => {
    const list = await mockAssignmentsApi.getAssignments({ requesterId: 'user-admin' });
    expect(list.some((a) => a.studentId === otherStudent.id)).toBe(true);
  });
});
