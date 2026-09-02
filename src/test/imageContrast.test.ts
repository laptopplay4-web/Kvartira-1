import { describe, it, expect } from 'vitest';
import { luminanceFromRgb, detectImageTextContrast } from '@/services/images/contrast';

describe('luminanceFromRgb', () => {
  it('returns higher value for white than black', () => {
    expect(luminanceFromRgb(255, 255, 255)).toBeGreaterThan(luminanceFromRgb(0, 0, 0));
  });

  it('returns ~1 for white', () => {
    expect(luminanceFromRgb(255, 255, 255)).toBeCloseTo(1, 2);
  });

  it('returns 0 for black', () => {
    expect(luminanceFromRgb(0, 0, 0)).toBe(0);
  });
});

describe('detectImageTextContrast', () => {
  it('falls back to on-dark when image cannot load', async () => {
    await expect(
      detectImageTextContrast('', { loadTimeoutMs: 50 }),
    ).resolves.toBe('on-dark');
  });
});
