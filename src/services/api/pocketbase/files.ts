import type { RecordModel } from 'pocketbase';
import type {
  Assignment,
  Message,
  MessageAttachment,
  SupportTicket,
  SupportTicketAttachment,
} from '@/types';
import type { User } from '@/types';
import { getPocketBase } from '@/services/api/pocketbase/client';

export const PB_FILE_URL_PREFIX = 'pbfile:';

export type StoredFilePurpose = 'chat' | 'assignment' | 'support' | 'avatar' | 'school' | 'event';

export interface UploadStoredFileInput {
  userId: string;
  purpose: StoredFilePurpose;
  contextId?: string;
  filename: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface UploadedStoredFile {
  fileId: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface KvartiraFileRecord extends RecordModel {
  owner: string;
  purpose: StoredFilePurpose;
  contextId?: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  file: string;
}

export function isStoredFileRef(value: string | undefined): boolean {
  return !!value && value.startsWith(PB_FILE_URL_PREFIX);
}

export function storedFileRef(fileId: string): string {
  return `${PB_FILE_URL_PREFIX}${fileId}`;
}

export function parseStoredFileRef(value: string): string | null {
  if (!value.startsWith(PB_FILE_URL_PREFIX)) return null;
  const id = value.slice(PB_FILE_URL_PREFIX.length).trim();
  return id || null;
}

export function dataUrlToFile(dataUrl: string, filename: string, mimeType: string): File {
  const [meta, base64] = dataUrl.split(',');
  const match = /data:(.*?);base64/.exec(meta ?? '');
  const type = match?.[1] ?? mimeType;
  const binary = atob(base64 ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type });
}

function getSignedUrl(record: KvartiraFileRecord): string {
  const pb = getPocketBase();
  const token = pb.authStore.token;
  return pb.files.getURL(record, record.file, token ? { token } : undefined);
}

async function loadFileRecord(fileId: string): Promise<KvartiraFileRecord> {
  const pb = getPocketBase();
  return pb.collection('kvartira_files').getOne<KvartiraFileRecord>(fileId);
}

export async function resolveStoredFileUrl(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;
  if (!isStoredFileRef(url)) return url;
  const fileId = parseStoredFileRef(url);
  if (!fileId) return url;
  try {
    const record = await loadFileRecord(fileId);
    return getSignedUrl(record);
  } catch {
    return url;
  }
}

export async function resolveUserAvatars(user: User): Promise<User> {
  const [avatarUrl, avatarOriginalUrl] = await Promise.all([
    resolveStoredFileUrl(user.avatarUrl),
    resolveStoredFileUrl(user.avatarOriginalUrl),
  ]);

  if (avatarUrl === user.avatarUrl && avatarOriginalUrl === user.avatarOriginalUrl) {
    return user;
  }

  const resolved: User = { ...user };
  if (avatarUrl) resolved.avatarUrl = avatarUrl;
  else delete resolved.avatarUrl;
  if (avatarOriginalUrl) resolved.avatarOriginalUrl = avatarOriginalUrl;
  else delete resolved.avatarOriginalUrl;
  return resolved;
}

export async function resolveUsersAvatars(users: User[]): Promise<User[]> {
  return Promise.all(users.map(resolveUserAvatars));
}

export async function deleteStoredFiles(...urls: Array<string | undefined>): Promise<void> {
  const ids = collectStoredFileIds(...urls);
  if (ids.length === 0) return;
  const pb = getPocketBase();
  await Promise.all(
    ids.map((id) => pb.collection('kvartira_files').delete(id).catch(() => undefined)),
  );
}

export async function uploadStoredFile(input: UploadStoredFileInput): Promise<UploadedStoredFile> {
  const pb = getPocketBase();
  const file = dataUrlToFile(input.dataUrl, input.filename, input.mimeType);
  const formData = new FormData();
  formData.append('owner', input.userId);
  formData.append('purpose', input.purpose);
  if (input.contextId) formData.append('contextId', input.contextId);
  formData.append('originalFilename', input.filename);
  formData.append('mimeType', input.mimeType);
  formData.append('size', String(input.size));
  formData.append('file', file, input.filename);

  const record = await pb.collection('kvartira_files').create<KvartiraFileRecord>(formData);
  return {
    fileId: record.id,
    url: storedFileRef(record.id),
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.size,
  };
}

export async function linkStoredFilesToContext(fileIds: string[], contextId: string): Promise<void> {
  if (fileIds.length === 0 || !contextId) return;
  const pb = getPocketBase();
  const uniqueIds = [...new Set(fileIds)];
  await Promise.all(
    uniqueIds.map((id) => pb.collection('kvartira_files').update(id, { contextId })),
  );
}

export function collectStoredFileIds(...urls: Array<string | undefined>): string[] {
  const ids: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    const id = parseStoredFileRef(url);
    if (id) ids.push(id);
  }
  return ids;
}

export async function resolveMessageAttachments(
  attachments: MessageAttachment[] | undefined,
): Promise<MessageAttachment[] | undefined> {
  if (!attachments?.length) return attachments;
  return Promise.all(
    attachments.map(async (attachment) => {
      const url = await resolveStoredFileUrl(attachment.url);
      return url && url !== attachment.url ? { ...attachment, url } : attachment;
    }),
  );
}

export async function resolveMessage(message: Message): Promise<Message> {
  if (!message.attachments?.length) return message;
  const attachments = await resolveMessageAttachments(message.attachments);
  return attachments ? { ...message, attachments } : message;
}

export async function resolveMessages(messages: Message[]): Promise<Message[]> {
  return Promise.all(messages.map(resolveMessage));
}

export async function resolveAssignment(assignment: Assignment): Promise<Assignment> {
  const contentBlocks = assignment.contentBlocks?.length
    ? await Promise.all(
        assignment.contentBlocks.map(async (block) => {
          if (!block.url) return block;
          const url = await resolveStoredFileUrl(block.url);
          return url && url !== block.url ? { ...block, url } : block;
        }),
      )
    : assignment.contentBlocks;

  return {
    ...assignment,
    contentBlocks: contentBlocks ?? assignment.contentBlocks,
  };
}

export async function resolveSupportAttachments(
  attachments: SupportTicketAttachment[],
): Promise<SupportTicketAttachment[]> {
  return Promise.all(
    attachments.map(async (attachment) => {
      const url = await resolveStoredFileUrl(attachment.url);
      return url && url !== attachment.url ? { ...attachment, url } : attachment;
    }),
  );
}

export async function resolveSupportTicket(ticket: SupportTicket): Promise<SupportTicket> {
  if (!ticket.attachments.length) return ticket;
  const attachments = await resolveSupportAttachments(ticket.attachments);
  return { ...ticket, attachments };
}
