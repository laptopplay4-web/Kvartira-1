import type { Assignment, AssignmentContentType } from '@/types';
import { ApiError } from '@/services/api/types';
import type { AssignmentsApi, CreateAssignmentInput, UploadAssignmentFileInput } from '@/services/api/types';

/** PocketBase assignments adapter — use mock mode until schema migration is applied. */
export const pocketbaseAssignmentsApi: AssignmentsApi = {
  async getAssignments() {
    throw new ApiError('Новый формат ДЗ доступен только в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },
  async getAssignment() {
    throw new ApiError('Новый формат ДЗ доступен только в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },
  async createAssignment(_input: CreateAssignmentInput, _teacherId: string): Promise<Assignment> {
    throw new ApiError('Новый формат ДЗ доступен только в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },
  async uploadAssignmentFile(
    _input: UploadAssignmentFileInput,
    _userId: string,
    _contentType: AssignmentContentType,
  ) {
    throw new ApiError('Новый формат ДЗ доступен только в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },
};
