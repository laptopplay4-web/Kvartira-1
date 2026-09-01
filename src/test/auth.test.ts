import { describe, it, expect, beforeEach } from 'vitest';
import { mockAuthApi, resetMockDatabase } from '@/services/api/mock';
import { DEMO_ACCOUNTS } from '@/mocks/seed';
import { MOCK_PASSWORD_RESET_CODE } from '@/services/auth/constants';

describe('mock auth', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('logs in with valid credentials', async () => {
    const session = await mockAuthApi.login(DEMO_ACCOUNTS.student.phone, DEMO_ACCOUNTS.student.password);
    expect(session.user.role).toBe('student');
    expect(session.token).toBeTruthy();
  });

  it('rejects invalid credentials', async () => {
    await expect(mockAuthApi.login(DEMO_ACCOUNTS.student.phone, 'wrong')).rejects.toThrow();
  });

  it('demo login works for all roles', async () => {
    for (const role of ['student', 'teacher', 'admin'] as const) {
      const session = await mockAuthApi.demoLogin(role);
      expect(session.user.role).toBe(role);
    }
  });

  it('requests password reset and returns demo code', async () => {
    const result = await mockAuthApi.requestPasswordReset(DEMO_ACCOUNTS.student.phone);
    expect(result.resetId).toBeTruthy();
    expect(result.demoCode).toBe(MOCK_PASSWORD_RESET_CODE);
  });

  it('does not reveal unknown phone on password reset request', async () => {
    const result = await mockAuthApi.requestPasswordReset('+79999999999');
    expect(result.resetId).toBeTruthy();
  });

  it('completes password reset with valid code', async () => {
    const { resetId } = await mockAuthApi.requestPasswordReset(DEMO_ACCOUNTS.student.phone);
    await mockAuthApi.completePasswordReset({
      resetId,
      code: MOCK_PASSWORD_RESET_CODE,
      newPassword: 'newpass123',
    });
    const session = await mockAuthApi.login(DEMO_ACCOUNTS.student.phone, 'newpass123');
    expect(session.user.role).toBe('student');
  });

  it('rejects invalid reset code', async () => {
    const { resetId } = await mockAuthApi.requestPasswordReset(DEMO_ACCOUNTS.student.phone);
    await expect(
      mockAuthApi.completePasswordReset({
        resetId,
        code: '111111',
        newPassword: 'newpass123',
      }),
    ).rejects.toThrow();
  });

  it('rejects reset for unknown phone on completion', async () => {
    const { resetId } = await mockAuthApi.requestPasswordReset('+79999999999');
    await expect(
      mockAuthApi.completePasswordReset({
        resetId,
        code: MOCK_PASSWORD_RESET_CODE,
        newPassword: 'newpass123',
      }),
    ).rejects.toThrow();
  });
});
