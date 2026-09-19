import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  AUDIO_PLAYBACK_SPEEDS,
  formatAudioDuration,
  formatPlaybackSpeedLabel,
  getNextPlaybackSpeed,
  seekRatioFromPointer,
} from '@/services/audio/helpers';
import {
  generateWaveformHeights,
  hashStringToSeed,
  playedBarCount,
  VOICE_WAVEFORM_BAR_COUNT,
} from '@/services/audio/waveform';
import { AudioPlayer } from '@/components/ui/AudioPlayer';
import { VoiceMessagePlayer } from '@/components/ui/VoiceMessagePlayer';

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

describe('AudioPlayer (Video.js)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  it('renders native audio + progressive source with mime', () => {
    render(
      <AudioPlayer src="https://example.com/demo.mp3" title="Демо" mimeType="audio/mpeg" />,
    );

    expect(screen.getByTestId('audio-player')).toBeInTheDocument();
    expect(screen.getByText('Демо')).toBeInTheDocument();
    const audio = document.querySelector('audio');
    expect(audio).toBeTruthy();
    const source = audio?.querySelector('source');
    expect(source?.getAttribute('src')).toBe('https://example.com/demo.mp3');
    expect(source?.getAttribute('type')).toBe('audio/mpeg');
  });

  it('infers webm mime from url when mimeType omitted', () => {
    render(<AudioPlayer src="https://cdn.example.com/voice.webm?token=1" />);
    const source = document.querySelector('audio source');
    expect(source?.getAttribute('type')).toBe('audio/webm');
  });

  it('shows download button when provided', () => {
    render(
      <AudioPlayer
        src="mock://audio/demo.mp3"
        downloadUrl="mock://audio/demo.mp3"
        downloadFilename="demo.mp3"
      />,
    );

    expect(screen.getByRole('button', { name: 'Скачать аудио' })).toBeInTheDocument();
  });

  it('uses card styling when not bare', () => {
    render(<AudioPlayer src="mock://audio/demo.mp3" variant="compact" isOwn />);
    expect(screen.getByTestId('audio-player')).toHaveClass('border-brand/30');
  });

  it('uses transparent chrome when bare (chat media)', () => {
    render(<AudioPlayer src="mock://audio/demo.mp3" variant="compact" isOwn bare />);
    const el = screen.getByTestId('audio-player');
    expect(el).toHaveClass('bg-transparent');
    expect(el).not.toHaveClass('border-brand/30');
  });

  it('hides volume and speed via data flags when disabled', () => {
    const { container } = render(
      <AudioPlayer
        src="mock://audio/demo.mp3"
        title="track.mp3"
        downloadUrl="mock://audio/demo.mp3"
        downloadFilename="track.mp3"
        showVolume={false}
        showSpeed={false}
      />,
    );

    const skin = container.querySelector('.kv-audio-skin');
    expect(skin).toHaveAttribute('data-hide-volume');
    expect(skin).toHaveAttribute('data-hide-speed');
    expect(skin).toHaveAttribute('data-elapsed-only');
    expect(screen.getByRole('button', { name: 'Скачать аудио' })).toBeInTheDocument();
    expect(screen.getByText('track.mp3')).toBeInTheDocument();
  });

  it('hides seek in compact (chat) and keeps controls row off for voice-like', () => {
    const { container } = render(
      <AudioPlayer src="mock://audio/voice.webm" variant="compact" showVolume={false} showSpeed={false} />,
    );

    const skin = container.querySelector('.kv-audio-skin');
    expect(skin).toHaveAttribute('data-hide-seek');
    expect(skin).toHaveAttribute('data-hide-volume');
    expect(skin).toHaveAttribute('data-hide-speed');
    expect(skin).toHaveAttribute('data-elapsed-only');
    expect(screen.queryByRole('button', { name: 'Скачать аудио' })).not.toBeInTheDocument();
  });

  it('puts src on audio element for progressive playback clock', () => {
    render(<AudioPlayer src="https://example.com/song.mp3" mimeType="audio/mpeg" />);
    const audio = document.querySelector('audio');
    expect(audio?.getAttribute('src')).toBe('https://example.com/song.mp3');
  });
});

describe('voice waveform helpers', () => {
  it('hashes seed stably', () => {
    expect(hashStringToSeed('att-1')).toBe(hashStringToSeed('att-1'));
    expect(hashStringToSeed('att-1')).not.toBe(hashStringToSeed('att-2'));
  });

  it('generates deterministic bar heights', () => {
    const a = generateWaveformHeights('voice-msg-1');
    const b = generateWaveformHeights('voice-msg-1');
    expect(a).toEqual(b);
    expect(a).toHaveLength(VOICE_WAVEFORM_BAR_COUNT);
    expect(a.every((h) => h >= 12 && h <= 100)).toBe(true);
    expect(generateWaveformHeights('voice-msg-2')).not.toEqual(a);
  });

  it('maps progress to played bar count', () => {
    expect(playedBarCount(0, 40)).toBe(0);
    expect(playedBarCount(1, 40)).toBe(40);
    expect(playedBarCount(0.25, 40)).toBe(10);
    expect(playedBarCount(Number.NaN, 40)).toBe(0);
  });
});

describe('VoiceMessagePlayer (VK-style)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  it('renders play control, waveform bars, and duration', () => {
    const { container } = render(
      <VoiceMessagePlayer src="mock://audio/voice.webm" seed="att-voice-1" mimeType="audio/webm" />,
    );

    expect(screen.getByTestId('voice-message-player')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Воспроизвести' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Позиция в голосовом сообщении' })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden] span, [role="slider"] > span').length).toBeGreaterThanOrEqual(
      VOICE_WAVEFORM_BAR_COUNT,
    );
    expect(screen.getByText('0:00')).toBeInTheDocument();
    const audio = document.querySelector('audio');
    expect(audio?.getAttribute('src')).toBe('mock://audio/voice.webm');
  });

  it('toggles play label via play request', async () => {
    const onPlayRequest = vi.fn();
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
      configurable: true,
      get() {
        return true;
      },
    });

    render(
      <VoiceMessagePlayer
        src="mock://audio/voice.webm"
        seed="att-voice-2"
        onPlayRequest={onPlayRequest}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Воспроизвести' }));
    expect(onPlayRequest).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('renders soft own bubble that contrasts with solid brand play', () => {
    render(
      <VoiceMessagePlayer src="mock://audio/voice.webm" seed="att-voice-own" isOwn />,
    );
    const root = screen.getByTestId('voice-message-player');
    expect(root).toHaveClass('bg-brand-muted');
    expect(root).not.toHaveClass('bg-brand');
    expect(screen.getByRole('button', { name: 'Воспроизвести' })).toHaveClass('bg-brand');
  });

  it('renders elevated bubble for incoming voice', () => {
    render(
      <VoiceMessagePlayer src="mock://audio/voice.webm" seed="att-voice-in" />,
    );
    expect(screen.getByTestId('voice-message-player')).toHaveClass('bg-surface-elevated');
  });
});
