import type {
  YclientsMappings,
  YclientsRecordDto,
  YclientsScheduleGetResult,
  YclientsSchedulePutResult,
  YclientsScheduleWritePayload,
  YclientsServiceDto,
  YclientsStaffDto,
  YclientsTimeSlotDto,
} from '@/services/yclients/types';
import { EMPTY_YCLIENTS_MAPPINGS } from '@/services/yclients/types';
import { normalizeYclientsMappings } from '@/services/yclients/mapping';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import { ApiError } from '@/services/api/types';

export interface YclientsStatusDto {
  configured: boolean;
  companyIdSet: boolean;
  userTokenSet: boolean;
}

async function send<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const pb = getPocketBase();
  return pb.send(path, {
    method: init?.method ?? 'GET',
    body: init?.body,
  }) as Promise<T>;
}

export const pocketbaseYclientsApi = {
  async getStatus(): Promise<YclientsStatusDto> {
    return withPbError(() => send<YclientsStatusDto>('/api/kvartira/yclients/status'));
  },

  async getMappings(): Promise<YclientsMappings> {
    return withPbError(async () => {
      const raw = await send<unknown>('/api/kvartira/yclients/mappings');
      return normalizeYclientsMappings(raw);
    });
  },

  async updateMappings(mappings: YclientsMappings): Promise<YclientsMappings> {
    return withPbError(async () => {
      const raw = await send<unknown>('/api/kvartira/yclients/mappings', {
        method: 'PUT',
        body: mappings,
      });
      return normalizeYclientsMappings(raw);
    });
  },

  async getStaff(serviceId?: number): Promise<YclientsStaffDto[]> {
    return withPbError(async () => {
      const q = serviceId ? `?service_id=${serviceId}` : '';
      const res = await send<{ items: YclientsStaffDto[] }>(`/api/kvartira/yclients/staff${q}`);
      return res.items ?? [];
    });
  },

  async getServices(staffId?: number): Promise<YclientsServiceDto[]> {
    return withPbError(async () => {
      const q = staffId ? `?staff_id=${staffId}` : '';
      const res = await send<{ items: YclientsServiceDto[] }>(
        `/api/kvartira/yclients/services${q}`,
      );
      return res.items ?? [];
    });
  },

  async getSlots(params: {
    staffId: number;
    date: string;
    serviceId?: number;
  }): Promise<YclientsTimeSlotDto[]> {
    return withPbError(async () => {
      const search = new URLSearchParams({
        staff_id: String(params.staffId),
        date: params.date,
      });
      if (params.serviceId) search.set('service_id', String(params.serviceId));
      const res = await send<{ items: YclientsTimeSlotDto[] }>(
        `/api/kvartira/yclients/slots?${search.toString()}`,
      );
      return res.items ?? [];
    });
  },

  async getRecords(params?: {
    from?: string;
    to?: string;
    staffId?: number;
  }): Promise<YclientsRecordDto[]> {
    return withPbError(async () => {
      const search = new URLSearchParams();
      if (params?.from) search.set('from', params.from);
      if (params?.to) search.set('to', params.to);
      if (params?.staffId) search.set('staff_id', String(params.staffId));
      const q = search.toString();
      const res = await send<{ items: YclientsRecordDto[] }>(
        `/api/kvartira/yclients/records${q ? `?${q}` : ''}`,
      );
      return res.items ?? [];
    });
  },

  async getRecord(recordId: number): Promise<YclientsRecordDto> {
    return withPbError(() =>
      send<YclientsRecordDto>(`/api/kvartira/yclients/records/${recordId}`),
    );
  },

  async book(input: {
    staffId: number;
    serviceId: number;
    datetime: string;
    studentPhone?: string;
    studentName?: string;
    comment?: string;
  }): Promise<YclientsRecordDto> {
    return withPbError(() =>
      send<YclientsRecordDto>('/api/kvartira/yclients/book', {
        method: 'POST',
        body: input,
      }),
    );
  },

  async cancel(recordId: number): Promise<void> {
    return withPbError(async () => {
      await send('/api/kvartira/yclients/cancel', {
        method: 'POST',
        body: { recordId },
      });
    });
  },

  async getSchedule(params: {
    from: string;
    to: string;
  }): Promise<YclientsScheduleGetResult> {
    return withPbError(async () => {
      const search = new URLSearchParams({
        from: params.from,
        to: params.to,
      });
      const res = await send<YclientsScheduleGetResult>(
        `/api/kvartira/yclients/schedule?${search.toString()}`,
      );
      return {
        staffId: Number(res.staffId),
        from: String(res.from),
        to: String(res.to),
        items: Array.isArray(res.items)
          ? res.items.map((d) => ({
              staffId: d.staffId,
              date: String(d.date).slice(0, 10),
              slots: Array.isArray(d.slots)
                ? d.slots.map((s) => ({
                    from: String(s.from).slice(0, 5),
                    to: String(s.to).slice(0, 5),
                  }))
                : [],
              isWorking: Boolean(d.isWorking),
              offDayType: d.offDayType,
            }))
          : [],
      };
    });
  },

  async updateSchedule(
    payload: YclientsScheduleWritePayload,
  ): Promise<YclientsSchedulePutResult> {
    return withPbError(async () => {
      const res = await send<YclientsSchedulePutResult>('/api/kvartira/yclients/schedule', {
        method: 'PUT',
        body: payload,
      });
      return {
        staffId: Number(res.staffId),
        items: Array.isArray(res.items) ? res.items : [],
      };
    });
  },
};

export function emptyMappings(): YclientsMappings {
  return {
    directionToServiceIds: { ...EMPTY_YCLIENTS_MAPPINGS.directionToServiceIds },
    staffToUserId: { ...EMPTY_YCLIENTS_MAPPINGS.staffToUserId },
  };
}

export function mapPbYclientsError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  throw error;
}

// re-export normalize for tests that import from mapping
export { normalizeYclientsMappings };
