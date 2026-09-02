import { describe, it, expect, beforeEach } from 'vitest';
import { mockPublicApi, mockSchoolSettingsApi, resetMockDatabase } from '@/services/api/mock';

describe('mockSchoolSettingsApi', () => {
  beforeEach(() => resetMockDatabase());

  it('returns school settings for admin', async () => {
    const settings = await mockSchoolSettingsApi.getSchoolSettings('user-admin');
    expect(settings.name).toBe('Квартира');
    expect(settings.contacts.phone).toBeTruthy();
    expect(settings.socialLinks).toBeDefined();
  });

  it('returns school settings for student (read-only)', async () => {
    const settings = await mockSchoolSettingsApi.getSchoolSettings('user-student');
    expect(settings.name).toBe('Квартира');
    expect(settings.about).toBeTruthy();
  });

  it('returns school settings for teacher', async () => {
    const settings = await mockSchoolSettingsApi.getSchoolSettings('user-teacher-1');
    expect(settings.name).toBe('Квартира');
  });

  it('denies update for student', async () => {
    await expect(
      mockSchoolSettingsApi.updateSchoolSettings({ name: 'Hack' }, 'user-student'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('updates settings and reflects on public landing', async () => {
    await mockSchoolSettingsApi.updateSchoolSettings(
      {
        name: 'Новое имя школы',
        tagline: 'Новый слоган',
        socialLinks: {
          vk: 'https://vk.com/kvartira',
          telegram: 'https://t.me/kvartira',
          youtube: '',
          website: 'https://kvartira-music.ru',
          twoGis: '',
          yandexMaps: 'https://yandex.ru/maps/-/test',
        },
      },
      'user-admin',
    );

    const landing = await mockPublicApi.getLandingData();
    expect(landing.school.name).toBe('Новое имя школы');
    expect(landing.school.tagline).toBe('Новый слоган');
    expect(landing.school.socialLinks.vk).toBe('https://vk.com/kvartira');
    expect(landing.school.socialLinks.website).toBe('https://kvartira-music.ru');
  });

  it('rejects invalid social link url', async () => {
    await expect(
      mockSchoolSettingsApi.updateSchoolSettings(
        { socialLinks: { vk: 'not a link' } },
        'user-admin',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('normalizes social link without protocol on save', async () => {
    await mockSchoolSettingsApi.updateSchoolSettings(
      { socialLinks: { vk: 'vk.com/kvartira' } },
      'user-admin',
    );
    const settings = await mockSchoolSettingsApi.getSchoolSettings('user-admin');
    expect(settings.socialLinks.vk).toBe('https://vk.com/kvartira');
  });

  it('uploads and removes directions video', async () => {
    const video = await mockSchoolSettingsApi.uploadDirectionsVideo(
      {
        filename: 'route.mp4',
        mimeType: 'video/mp4',
        size: 2048,
        dataUrl: 'data:video/mp4;base64,AAAA',
      },
      'user-admin',
    );
    expect(video.filename).toBe('route.mp4');

    const withVideo = await mockSchoolSettingsApi.getSchoolSettings('user-student');
    expect(withVideo.directionsVideo?.filename).toBe('route.mp4');

    const cleared = await mockSchoolSettingsApi.removeDirectionsVideo('user-admin');
    expect(cleared.directionsVideo).toBeUndefined();
  });

  it('denies video upload for student', async () => {
    await expect(
      mockSchoolSettingsApi.uploadDirectionsVideo(
        {
          filename: 'route.mp4',
          mimeType: 'video/mp4',
          size: 100,
          dataUrl: 'data:video/mp4;base64,AA',
        },
        'user-student',
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
