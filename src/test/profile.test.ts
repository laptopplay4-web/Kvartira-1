import { describe, it, expect, beforeEach } from 'vitest';
import { validateUpdateProfileInput } from '@/services/profile/validation';
import {
  clampCropState,
  getAvatarFullPhotoUrl,
  getCoverScale,
  getCropZoomBounds,
  getInitialCropState,
  validateAvatarUpload,
  zoomCropAtPoint,
} from '@/services/profile/avatar';
import { AVATAR_CROP_VIEWPORT, AVATAR_MAX_ZOOM_MULTIPLIER } from '@/services/profile/constants';
import { mockAuthApi, mockUsersApi, resetMockDatabase } from '@/services/api/mock/index';
import { ApiError } from '@/services/api/types';
import { users } from '@/mocks/seed';

const student = users.find((u) => u.id === 'user-student')!;
const teacher = users.find((u) => u.id === 'user-teacher-1')!;

const sampleAvatar = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==';
const sampleOriginal = 'data:image/jpeg;base64,ORIGINAL_FULL_PHOTO';
const sampleThumbnail = 'data:image/jpeg;base64,THUMBNAIL_CROP';

describe('profile validation', () => {
  it('rejects empty update', () => {
    expect(validateUpdateProfileInput({})).toBeTruthy();
  });

  it('validates name length', () => {
    expect(validateUpdateProfileInput({ firstName: 'A' })).toContain('Имя');
    expect(validateUpdateProfileInput({ lastName: 'B' })).toContain('Фамилия');
  });

  it('validates phone format', () => {
    expect(validateUpdateProfileInput({ phone: '123' })).toContain('Формат');
    expect(validateUpdateProfileInput({ phone: '+78001234567' })).toContain('Формат');
  });

  it('accepts valid fields', () => {
    expect(validateUpdateProfileInput({ firstName: 'Иван', lastName: 'Petrov' })).toBeNull();
    expect(validateUpdateProfileInput({ phone: '+79991234567' })).toBeNull();
  });
});

describe('profile update API', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('updates first and last name', async () => {
    const updated = await mockUsersApi.updateProfile(student.id, {
      firstName: 'Новое',
      lastName: 'Имя',
    });
    expect(updated.firstName).toBe('Новое');
    expect(updated.lastName).toBe('Имя');
  });

  it('updates phone', async () => {
    const updated = await mockUsersApi.updateProfile(student.id, {
      phone: '+79991112233',
    });
    expect(updated.phone).toBe('+79991112233');
  });

  it('rejects duplicate phone', async () => {
    await expect(
      mockUsersApi.updateProfile(student.id, { phone: teacher.phone }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects invalid phone', async () => {
    await expect(
      mockUsersApi.updateProfile(student.id, { phone: 'bad' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects unknown user', async () => {
    await expect(
      mockUsersApi.updateProfile('unknown-user', { firstName: 'Test' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('returns updated user on next login', async () => {
    await mockUsersApi.updateProfile(student.id, { firstName: 'Relogin' });
    const session = await mockAuthApi.demoLogin('student');
    expect(session.user.firstName).toBe('Relogin');
  });
});

describe('avatar validation', () => {
  it('rejects unsupported mime type', () => {
    const result = validateAvatarUpload({
      filename: 'photo.gif',
      mimeType: 'image/gif',
      size: 1024,
    });
    expect(result.valid).toBe(false);
  });

  it('rejects oversized file', () => {
    const result = validateAvatarUpload({
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 6 * 1024 * 1024,
    });
    expect(result.valid).toBe(false);
  });

  it('accepts valid image', () => {
    const result = validateAvatarUpload({
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
    });
    expect(result).toEqual({ valid: true });
  });

  it('prefers original url for full photo view', () => {
    expect(
      getAvatarFullPhotoUrl({ avatarUrl: sampleThumbnail, avatarOriginalUrl: sampleOriginal }),
    ).toBe(sampleOriginal);
    expect(getAvatarFullPhotoUrl({ avatarUrl: sampleThumbnail })).toBe(sampleThumbnail);
  });

  it('centers initial crop for portrait image', () => {
    const state = getInitialCropState(400, 800, AVATAR_CROP_VIEWPORT);
    expect(state.scale).toBeCloseTo(getCoverScale(400, 800, AVATAR_CROP_VIEWPORT));
    expect(state.offsetX).toBeCloseTo(0);
    expect(state.offsetY).toBeLessThan(0);
  });

  it('limits zoom between cover fit and max multiplier', () => {
    const bounds = getCropZoomBounds(400, 800, AVATAR_CROP_VIEWPORT);
    expect(bounds.maxScale).toBeCloseTo(bounds.minScale * AVATAR_MAX_ZOOM_MULTIPLIER);
    const initial = getInitialCropState(400, 800, AVATAR_CROP_VIEWPORT);
    const zoomed = clampCropState(
      zoomCropAtPoint(initial, bounds.maxScale * 2, AVATAR_CROP_VIEWPORT / 2, AVATAR_CROP_VIEWPORT / 2),
      400,
      800,
      AVATAR_CROP_VIEWPORT,
    );
    expect(zoomed.scale).toBeCloseTo(bounds.maxScale);
  });
});

describe('avatar API', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('uploads avatar with original and thumbnail', async () => {
    const updated = await mockUsersApi.uploadAvatar(student.id, {
      filename: 'avatar.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      dataUrl: sampleThumbnail,
      originalDataUrl: sampleOriginal,
    });
    expect(updated.avatarUrl).toBe(sampleThumbnail);
    expect(updated.avatarOriginalUrl).toBe(sampleOriginal);
  });

  it('updates thumbnail without replacing original', async () => {
    await mockUsersApi.uploadAvatar(student.id, {
      filename: 'avatar.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      dataUrl: sampleThumbnail,
      originalDataUrl: sampleOriginal,
    });
    const updated = await mockUsersApi.uploadAvatar(student.id, {
      filename: 'avatar.jpg',
      mimeType: 'image/jpeg',
      size: 512,
      dataUrl: sampleAvatar,
      updateThumbnailOnly: true,
    });
    expect(updated.avatarUrl).toBe(sampleAvatar);
    expect(updated.avatarOriginalUrl).toBe(sampleOriginal);
  });

  it('removes avatar and original', async () => {
    await mockUsersApi.uploadAvatar(student.id, {
      filename: 'avatar.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      dataUrl: sampleThumbnail,
      originalDataUrl: sampleOriginal,
    });
    const updated = await mockUsersApi.removeAvatar(student.id);
    expect(updated.avatarUrl).toBeUndefined();
    expect(updated.avatarOriginalUrl).toBeUndefined();
  });

  it('rejects invalid upload', async () => {
    await expect(
      mockUsersApi.uploadAvatar(student.id, {
        filename: 'avatar.gif',
        mimeType: 'image/gif',
        size: 1024,
        dataUrl: sampleAvatar,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('persists avatar in session after upload', async () => {
    await mockUsersApi.uploadAvatar(student.id, {
      filename: 'avatar.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      dataUrl: sampleThumbnail,
      originalDataUrl: sampleOriginal,
    });
    const session = await mockAuthApi.demoLogin('student');
    expect(session.user.avatarUrl).toBe(sampleThumbnail);
    expect(session.user.avatarOriginalUrl).toBe(sampleOriginal);
  });
});
