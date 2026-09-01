import type { AssignmentGroup } from '@/types';
import { ApiError } from '@/services/api/types';
import type { AssignmentGroupsApi } from '@/services/api/types';

/** PocketBase groups adapter — use mock mode until assignment_groups migration is applied. */
export const pocketbaseAssignmentGroupsApi: AssignmentGroupsApi = {
  async getGroups() {
    throw new ApiError('Группы ДЗ доступны только в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },
  async getGroup() {
    throw new ApiError('Группы ДЗ доступны только в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },
  async createGroup() {
    throw new ApiError('Группы ДЗ доступны только в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },
  async updateGroup() {
    throw new ApiError('Группы ДЗ доступны только в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },
  async addMember() {
    throw new ApiError('Группы ДЗ доступны только в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },
  async removeMember() {
    throw new ApiError('Группы ДЗ доступны только в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },
  async deleteGroup() {
    throw new ApiError('Группы ДЗ доступны только в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },
};

export type { AssignmentGroup };
