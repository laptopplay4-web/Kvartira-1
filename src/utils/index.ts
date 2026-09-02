import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function getInitials(firstName: string, lastName: string): string {
  const first = firstName?.charAt(0) ?? '';
  const last = lastName?.charAt(0) ?? '';
  const initials = `${first}${last}`.trim();
  return (initials || '?').toUpperCase();
}

export function formatUserName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 4)} *** ** ${phone.slice(-2)}`;
}
