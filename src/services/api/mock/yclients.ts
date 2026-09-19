import type {
  YclientsMappings,
  YclientsRecordDto,
  YclientsScheduleDayDto,
  YclientsScheduleGetResult,
  YclientsSchedulePutResult,
  YclientsScheduleWritePayload,
  YclientsServiceDto,
  YclientsStaffDto,
} from '@/services/yclients/types';
import { EMPTY_YCLIENTS_MAPPINGS } from '@/services/yclients/types';
import { normalizeYclientsMappings } from '@/services/yclients/mapping';
import type { YclientsStatusDto } from '@/services/api/pocketbase/yclients';
import { ApiError } from '@/services/api/types';

let mockMappings: YclientsMappings = {
  directionToServiceIds: {},
  staffToUserId: {},
};

/** In-memory schedule days keyed by staffId → date → day. */
const mockScheduleByStaff = new Map<number, Map<string, YclientsScheduleDayDto>>();

function getStaffScheduleMap(staffId: number): Map<string, YclientsScheduleDayDto> {
  let m = mockScheduleByStaff.get(staffId);
  if (!m) {
    m = new Map();
    mockScheduleByStaff.set(staffId, m);
  }
  return m;
}

function resolveMockOwnStaffId(): number | null {
  const entries = Object.entries(mockMappings.staffToUserId);
  if (!entries.length) return null;
  const n = Number(entries[0]![0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** In-memory YCLIENTS API for VITE_API_MODE=mock (admin UI + local wiring). */
export const mockYclientsApi = {
  async getStatus(): Promise<YclientsStatusDto> {
    return { configured: false, companyIdSet: false, userTokenSet: false };
  },

  async getMappings(): Promise<YclientsMappings> {
    return normalizeYclientsMappings(mockMappings);
  },

  async updateMappings(mappings: YclientsMappings): Promise<YclientsMappings> {
    mockMappings = normalizeYclientsMappings(mappings);
    return {
      ...mockMappings,
      directionToServiceIds: { ...mockMappings.directionToServiceIds },
      staffToUserId: { ...mockMappings.staffToUserId },
    };
  },

  async getStaff(): Promise<YclientsStaffDto[]> {
    return [];
  },

  async getServices(): Promise<YclientsServiceDto[]> {
    return [];
  },

  async getSlots(): Promise<{ date: string; startTime: string; endTime: string; datetime: string }[]> {
    return [];
  },

  async getRecords(): Promise<YclientsRecordDto[]> {
    return [];
  },

  async getRecord(): Promise<YclientsRecordDto> {
    throw new ApiError('YCLIENTS недоступен в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },

  async book(): Promise<YclientsRecordDto> {
    throw new ApiError('YCLIENTS недоступен в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },

  async cancel(): Promise<void> {
    throw new ApiError('YCLIENTS недоступен в mock-режиме', 'NOT_IMPLEMENTED', 501);
  },

  async getSchedule(params: {
    from: string;
    to: string;
  }): Promise<YclientsScheduleGetResult> {
    const staffId = resolveMockOwnStaffId();
    if (!staffId) {
      throw new ApiError('Сотрудник YCLIENTS не связан с аккаунтом', 'NOT_MAPPED', 404);
    }
    const map = getStaffScheduleMap(staffId);
    const items = [...map.values()].filter(
      (d) => d.date >= params.from && d.date <= params.to,
    );
    return { staffId, from: params.from, to: params.to, items };
  },

  async updateSchedule(
    payload: YclientsScheduleWritePayload,
  ): Promise<YclientsSchedulePutResult> {
    const staffId = resolveMockOwnStaffId();
    if (!staffId) {
      throw new ApiError('Сотрудник YCLIENTS не связан с аккаунтом', 'NOT_MAPPED', 404);
    }
    const map = getStaffScheduleMap(staffId);
    for (const del of payload.schedulesToDelete) {
      for (const date of del.dates) {
        map.delete(date);
      }
    }
    for (const set of payload.schedulesToSet) {
      for (const date of set.dates) {
        map.set(date, {
          staffId,
          date,
          slots: set.slots.map((s) => ({ ...s })),
          isWorking: set.slots.length > 0,
        });
      }
    }
    return { staffId, items: [...map.values()] };
  },
};

export function resetMockYclientsMappings(): void {
  mockMappings = {
    directionToServiceIds: { ...EMPTY_YCLIENTS_MAPPINGS.directionToServiceIds },
    staffToUserId: { ...EMPTY_YCLIENTS_MAPPINGS.staffToUserId },
  };
  mockScheduleByStaff.clear();
}

/** Test helper: seed schedule for a staff id. */
export function seedMockYclientsSchedule(
  staffId: number,
  days: YclientsScheduleDayDto[],
): void {
  const map = getStaffScheduleMap(staffId);
  map.clear();
  for (const day of days) {
    map.set(day.date, { ...day, staffId, slots: day.slots.map((s) => ({ ...s })) });
  }
}
