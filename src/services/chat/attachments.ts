import type { AttachmentType, MessageAttachment } from '@/types';
import { detectAttachmentType } from './validation';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function createAttachmentFromFile(file: File, id: string): MessageAttachment | null {
  const type = detectAttachmentType(file.type, file.name);
  if (!type) return null;
  return {
    id,
    type,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    url: URL.createObjectURL(file),
  };
}

export function groupImages(attachments: MessageAttachment[]): MessageAttachment[][] {
  const images = attachments.filter((a) => a.type === 'image');
  const others = attachments.filter((a) => a.type !== 'image');
  const groups: MessageAttachment[][] = images.length > 0 ? [images] : [];
  for (const att of others) {
    groups.push([att]);
  }
  return groups;
}

export function getAttachmentIcon(type: AttachmentType): string {
  switch (type) {
    case 'image':
      return 'image';
    case 'file':
      return 'file';
    case 'audio':
      return 'audio';
    case 'video':
      return 'video';
  }
}
