import type { TimeRange } from '@/types';

/** Admin mapping: our Direction / User ↔ YCLIENTS service / staff. */
export interface YclientsMappings {
  /** directionId → YCLIENTS service ids (first used for booking). */
  directionToServiceIds: Record<string, number[]>;
  /** YCLIENTS staff_id (string) → PocketBase user id (teacher/admin). */
  staffToUserId: Record<string, string>;
}

export interface YclientsStaffDto {
  id: number;
  name: string;
  specialization?: string;
  avatarUrl?: string;
  bookable: boolean;
}

export interface YclientsServiceDto {
  id: number;
  title: string;
  durationMinutes: number;
  staffIds: number[];
}

export interface YclientsTimeSlotDto {
  date: string;
  startTime: string;
  endTime: string;
  datetime: string;
}

export interface YclientsRecordDto {
  id: number;
  staffId: number;
  services: { id: number; title?: string; duration?: number }[];
  clientId?: number;
  clientPhone?: string;
  clientName?: string;
  datetime: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  deleted: boolean;
  attendance?: number;
  comment?: string;
}

export const EMPTY_YCLIENTS_MAPPINGS: YclientsMappings = {
  directionToServiceIds: {},
  staffToUserId: {},
};

/** Single work interval as returned by YCLIENTS schedule API. */
export interface YclientsScheduleSlot {
  from: string;
  to: string;
}

export interface YclientsScheduleDayDto {
  staffId?: number;
  date: string;
  slots: YclientsScheduleSlot[];
  isWorking: boolean;
  offDayType?: number;
}

/** UI week-day row (Пн–Вс). */
export interface YclientsWeekDayTemplate {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
  breaks: TimeRange[];
}

export interface YclientsScheduleException {
  date: string;
  /** true = выходной (delete schedule for date). */
  off: boolean;
  startTime?: string;
  endTime?: string;
  breaks?: TimeRange[];
}

export interface YclientsScheduleGetResult {
  staffId: number;
  from: string;
  to: string;
  items: YclientsScheduleDayDto[];
}

export interface YclientsScheduleWritePayload {
  schedulesToSet: {
    staffId: number;
    dates: string[];
    slots: YclientsScheduleSlot[];
  }[];
  schedulesToDelete: {
    staffId: number;
    dates: string[];
  }[];
}

export interface YclientsSchedulePutResult {
  staffId: number;
  items: YclientsScheduleDayDto[];
}
