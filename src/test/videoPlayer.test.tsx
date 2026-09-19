import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoPlayer } from '@/components/ui/VideoPlayer';

describe('VideoPlayer (Video.js)', () => {
  it('renders a native video element for progressive src', () => {
    render(
      <VideoPlayer
        src="https://example.com/demo.mp4"
        mimeType="video/mp4"
        aria-label="Демо видео"
      />,
    );

    const video = document.querySelector('video');
    expect(video).toBeTruthy();
    expect(screen.getByLabelText('Демо видео')).toBeTruthy();
    const source = video?.querySelector('source');
    expect(source?.getAttribute('src')).toBe('https://example.com/demo.mp4');
    expect(source?.getAttribute('type')).toBe('video/mp4');
  });

  it('infers webm mime from url when mimeType omitted', () => {
    render(<VideoPlayer src="https://cdn.example.com/clip.webm?token=1" />);
    const source = document.querySelector('video source');
    expect(source?.getAttribute('type')).toBe('video/webm');
  });
});
