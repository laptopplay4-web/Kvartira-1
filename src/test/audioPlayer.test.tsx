import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  AUDIO_PLAYBACK_SPEEDS,
  formatAudioDuration,
  formatPlaybackSpeedLabel,
  getNextPlaybackSpeed,
  seekRatioFromPointer,
} from '@/services/audio/helpers';
import { AudioPlayer } from '@/components/ui/AudioPlayer';

describe('audio helpers', () => {
  it('formats duration as m:ss', () => {
    expect(formatAudioDuration(0)).toBe('0:00');
    expect(formatAudioDuration(65)).toBe('1:05');
    expect(formatAudioDuration(3661)).toBe('1:01:01');
  });

  it('handles invalid duration', () => {
    expect(formatAudioDuration(Number.NaN)).toBe('0:00');
    expect(formatAudioDuration(-5)).toBe('0:00');
  });

  it('cycles playback speeds', () => {
    expect(getNextPlaybackSpeed(1)).toBe(1.25);
    expect(getNextPlaybackSpeed(2)).toBe(0.75);
    expect(getNextPlaybackSpeed(99)).toBe(1);
  });

  it('formats speed label', () => {
    expect(formatPlaybackSpeedLabel(1)).toBe('1×');
    expect(formatPlaybackSpeedLabel(1.5)).toBe('1.5×');
  });

  it('calculates seek ratio from pointer', () => {
    const rect = { left: 100, width: 200 } as DOMRect;
    expect(seekRatioFromPointer(150, rect)).toBe(0.25);
    expect(seekRatioFromPointer(50, rect)).toBe(0);
    expect(seekRatioFromPointer(350, rect)).toBe(1);
  });

  it('exports ordered speed presets', () => {
    expect(AUDIO_PLAYBACK_SPEEDS).toEqual([0.75, 1, 1.25, 1.5, 2]);
  });
});

describe('AudioPlayer', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  it('renders title, play control and speed button', () => {
    render(<AudioPlayer src="mock://audio/demo.mp3" title="Демо" />);

    expect(screen.getByTestId('audio-player')).toBeInTheDocument();
    expect(screen.getByText('Демо')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Воспроизвести' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скорость воспроизведения 1×' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Прогресс воспроизведения' })).toBeInTheDocument();
  });

  it('cycles speed on click', () => {
    render(<AudioPlayer src="mock://audio/demo.mp3" />);

    const speedButton = screen.getByRole('button', { name: 'Скорость воспроизведения 1×' });
    fireEvent.click(speedButton);
    expect(screen.getByRole('button', { name: 'Скорость воспроизведения 1.25×' })).toBeInTheDocument();
  });

  it('shows download link when provided', () => {
    render(
      <AudioPlayer
        src="mock://audio/demo.mp3"
        downloadUrl="mock://audio/demo.mp3"
        downloadFilename="demo.mp3"
      />,
    );

    expect(screen.getByRole('link', { name: 'Скачать аудио' })).toHaveAttribute(
      'href',
      'mock://audio/demo.mp3',
    );
  });

  it('uses compact styling for chat variant', () => {
    render(<AudioPlayer src="mock://audio/demo.mp3" variant="compact" isOwn />);
    expect(screen.getByTestId('audio-player')).toHaveClass('border-brand/30');
  });
});
