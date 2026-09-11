import { describe, it, expect, beforeEach } from 'vitest';
import { format, addDays } from 'date-fns';
import {
  mockAssignmentsApi,
  mockAssignmentGroupsApi,
  resetMockDatabase,
} from '@/services/api/mock';
import { canViewAssignment, canCreateAssignment } from '@/services/assignments/access';
import {
  canEditAssignmentGroup,
  canManageAssignmentGroups,
  canViewAssignmentGroup,
} from '@/services/assignments/groups/access';
import {
  filterStudentsByDirection,
  isUserAmongMembers,
} from '@/services/assignments/groups/helpers';
import { getRecentAssignmentsForHome } from '@/services/assignments/helpers';
import {
  validateAssignmentContentFile,
  validateContentBlock,
  validateGroupName,
} from '@/services/assignments/validation';
import type { Assignment, AssignmentGroup, User } from '@/types';

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
const admin: User = {
  id: 'user-admin',
  phone: '+7',
  role: 'admin',
  firstName: 'G',
  lastName: 'H',
};

const vocalGroup: AssignmentGroup = {
  id: 'grp-vocalists',
  name: 'Вокалисты',
  teacherId: teacher.id,
  memberIds: [student.id],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const guitarGroup: AssignmentGroup = {
  id: 'grp-guitarists',
  name: 'Гитаристы',
  teacherId: teacher.id,
  memberIds: [otherStudent.id],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const baseAssignment: Assignment = {
  id: 'asgn-test',
  title: 'Test',
  description: 'Desc',
  teacherId: teacher.id,
  groupId: vocalGroup.id,
  dueDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
  contentBlocks: [{ id: 'blk-1', type: 'text', order: 0, text: 'Hello' }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('assignment access', () => {
  it('student can view assignment in their group', () => {
    expect(canViewAssignment(student, baseAssignment, [vocalGroup])).toBe(true);
  });

  it('student cannot view assignment for other group', () => {
    expect(
      canViewAssignment(student, { ...baseAssignment, groupId: guitarGroup.id }, [guitarGroup]),
    ).toBe(false);
  });

  it('teacher can view own assignments', () => {
    expect(canViewAssignment(teacher, baseAssignment, [vocalGroup])).toBe(true);
  });

  it('teacher can create assignments', () => {
    expect(canCreateAssignment(teacher)).toBe(true);
    expect(canCreateAssignment(student)).toBe(false);
  });
});

describe('assignment group access', () => {
  it('teacher can manage groups', () => {
    expect(canManageAssignmentGroups(teacher)).toBe(true);
    expect(canManageAssignmentGroups(student)).toBe(false);
  });

  it('student can view own group', () => {
    expect(canViewAssignmentGroup(student, vocalGroup)).toBe(true);
  });

  it('teacher can edit own group', () => {
    expect(canEditAssignmentGroup(teacher, vocalGroup)).toBe(true);
  });

  it('admin can edit any group', () => {
    expect(canEditAssignmentGroup(admin, vocalGroup)).toBe(true);
  });
});

describe('assignment home helpers', () => {
  it('returns recent assignments limited to three', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      ...baseAssignment,
      id: `a${i}`,
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
    }));

    expect(getRecentAssignmentsForHome(items).length).toBe(3);
  });
});

describe('assignment content validation', () => {
  it('accepts mp3 for voice block', () => {
    const result = validateAssignmentContentFile(
      { filename: 'warmup.mp3', mimeType: 'audio/mpeg', size: 1024 },
      'voice',
    );
    expect(result.valid).toBe(true);
  });

  it('accepts pdf block', () => {
    const result = validateAssignmentContentFile(
      { filename: 'sheet.pdf', mimeType: 'application/pdf', size: 1024 },
      'pdf',
    );
    expect(result.valid).toBe(true);
  });

  it('validates text block', () => {
    expect(validateContentBlock('text', '  Hello  ').valid).toBe(true);
    expect(validateContentBlock('text', '').valid).toBe(false);
  });

  it('validates group name', () => {
    expect(validateGroupName('Вокалисты').valid).toBe(true);
    expect(validateGroupName('A').valid).toBe(false);
  });
});

describe('mock assignments API', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('student sees assignments for their groups only', async () => {
    const list = await mockAssignmentsApi.getAssignments({ requesterId: student.id });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((a) => a.groupId === 'grp-vocalists')).toBe(true);
  });

  it('teacher sees own assignments', async () => {
    const list = await mockAssignmentsApi.getAssignments({ requesterId: teacher.id });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((a) => a.teacherId === teacher.id)).toBe(true);
  });

  it('blocks IDOR on getAssignment', async () => {
    await expect(mockAssignmentsApi.getAssignment('asgn-2', student.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('teacher creates assignment with content blocks for group', async () => {
    const created = await mockAssignmentsApi.createAssignment(
      {
        title: 'Новое задание',
        description: 'Описание',
        groupId: 'grp-vocalists',
        dueDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        contentBlocks: [
          { type: 'text', order: 0, text: 'Текст задания' },
          {
            type: 'pdf',
            order: 1,
            url: 'mock://file.pdf',
            filename: 'file.pdf',
            mimeType: 'application/pdf',
          },
        ],
      },
      teacher.id,
    );
    expect(created.groupId).toBe('grp-vocalists');
    expect(created.contentBlocks).toHaveLength(2);
  });

  it('notifies group members when assignment is created', async () => {
    const { mockNotificationsApi } = await import('@/services/api/mock');
    const before = await mockNotificationsApi.getNotifications(student.id);
    await mockAssignmentsApi.createAssignment(
      {
        title: 'Уведомление тест',
        description: 'Описание',
        groupId: 'grp-vocalists',
        contentBlocks: [{ type: 'text', order: 0, text: 'Материал' }],
      },
      teacher.id,
    );
    const after = await mockNotificationsApi.getNotifications(student.id);
    expect(after.length).toBe(before.length + 1);
    expect(after[0].type).toBe('assignment');
  });

  it('admin can view all assignments', async () => {
    const list = await mockAssignmentsApi.getAssignments({ requesterId: admin.id });
    expect(list.some((a) => a.groupId === 'grp-guitarists')).toBe(true);
  });
});

describe('mock assignment groups API', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('teacher creates group and adds member', async () => {
    const group = await mockAssignmentGroupsApi.createGroup({ name: 'Барабанщики' }, teacher.id);
    expect(group.name).toBe('Барабанщики');

    const updated = await mockAssignmentGroupsApi.addMember(group.id, student.id, teacher.id);
    expect(updated.memberIds).toContain(student.id);
  });

  it('student cannot create group', async () => {
    await expect(
      mockAssignmentGroupsApi.createGroup({ name: 'Хакеры' }, student.id),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('teacher removes member from group', async () => {
    const updated = await mockAssignmentGroupsApi.removeMember(
      'grp-vocalists',
      student.id,
      teacher.id,
    );
    expect(updated.memberIds).not.toContain(student.id);
  });

  it('getGroup returns members and canManage', async () => {
    const detail = await mockAssignmentGroupsApi.getGroup('grp-vocalists', teacher.id);
    expect(detail.canManage).toBe(true);
    expect(detail.members.length).toBeGreaterThan(0);
    expect(detail.members.some((m) => m.id === student.id)).toBe(true);
  });

  it('teacher deletes custom group and cascades assignments', async () => {
    const before = await mockAssignmentsApi.getAssignments({ requesterId: teacher.id });
    expect(before.some((a) => a.groupId === 'grp-vocalists')).toBe(true);

    await mockAssignmentGroupsApi.deleteGroup('grp-vocalists', teacher.id);

    const groups = await mockAssignmentGroupsApi.getGroups(teacher.id);
    expect(groups.some((g) => g.id === 'grp-vocalists')).toBe(false);

    const after = await mockAssignmentsApi.getAssignments({ requesterId: teacher.id });
    expect(after.every((a) => a.groupId !== 'grp-vocalists')).toBe(true);
  });

  it('cannot delete general assignment group', async () => {
    await expect(
      mockAssignmentGroupsApi.deleteGroup('grp-general', teacher.id),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('student cannot delete group (IDOR)', async () => {
    await expect(
      mockAssignmentGroupsApi.deleteGroup('grp-vocalists', student.id),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('assignment group member helpers', () => {
  it('filters students by direction', () => {
    const vocalStudent = { ...student, directionIds: ['dir-vocal'] };
    const guitarStudent = { ...student, id: 's2', directionIds: ['dir-guitar'] };
    const list = [vocalStudent, guitarStudent];

    expect(filterStudentsByDirection(list, 'dir-vocal')).toHaveLength(1);
    expect(filterStudentsByDirection(list, 'all')).toHaveLength(2);
  });

  it('isUserAmongMembers matches by id', () => {
    const member = { ...student, phone: '' };
    const other = { ...otherStudent, phone: '' };
    expect(isUserAmongMembers(member, [member])).toBe(true);
    expect(isUserAmongMembers(other, [member])).toBe(false);
  });

  it('empty phones do not false-positive membership', () => {
    const member = { ...student, phone: '' };
    const other = { ...otherStudent, phone: '' };
    const sanitized = { ...otherStudent, id: 'user-student-3', phone: undefined as unknown as string };

    expect(isUserAmongMembers(other, [member])).toBe(false);
    expect(isUserAmongMembers(sanitized, [member])).toBe(false);
    expect(isUserAmongMembers({ ...other, phone: '   ' }, [{ ...member, phone: '   ' }])).toBe(
      false,
    );
  });

  it('non-empty matching phones still identify same person', () => {
    const member = { ...student, phone: '+79001112233' };
    const samePhoneOtherId = { ...otherStudent, phone: '+79001112233' };
    expect(isUserAmongMembers(samePhoneOtherId, [member])).toBe(true);
  });
});
