import { describe, it, expect } from 'vitest';
import { getMediaImageGridLayout } from '@/services/media/imageGrid';

describe('getMediaImageGridLayout', () => {
  it('maps counts to VK-like layouts', () => {
    expect(getMediaImageGridLayout(0)).toBe('single');
    expect(getMediaImageGridLayout(1)).toBe('single');
    expect(getMediaImageGridLayout(2)).toBe('pair');
    expect(getMediaImageGridLayout(3)).toBe('triple');
    expect(getMediaImageGridLayout(4)).toBe('quad');
    expect(getMediaImageGridLayout(5)).toBe('many');
  });
});