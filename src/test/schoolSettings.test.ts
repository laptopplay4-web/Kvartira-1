import { describe, it, expect, beforeEach } from 'vitest';
import { mockPublicApi, mockSchoolSettingsApi, resetMockDatabase } from '@/services/api/mock';

describe('mockSchoolSettingsApi', () => {
  beforeEach(() => resetMockDatabase());

  it('returns school settings for admin', async () => {
    const settings = await mockSchoolSettingsApi.getSchoolSettings('user-admin');
    expect(settings.name).toBe('Квартира');
    expect(settings.contacts.phone).toBeTruthy();
  });

  it('denies access for student', async () => {
    await expect(mockSchoolSettingsApi.getSchoolSettings('user-student')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('updates settings and reflects on public landing', async () => {
    await mockSchoolSettingsApi.updateSchoolSettings(
      { name: 'Новое имя школы', tagline: 'Новый слоган' },
      'user-admin',
    );

    const landing = await mockPublicApi.getLandingData();
    expect(landing.school.name).toBe('Новое имя школы');
    expect(landing.school.tagline).toBe('Новый слоган');
  });
});
