export const AUDIO_PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export type AudioPlaybackSpeed = (typeof AUDIO_PLAYBACK_SPEEDS)[number];

export function formatAudioDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const seconds = Math.floor(totalSeconds);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getNextPlaybackSpeed(current: number): AudioPlaybackSpeed {
  const idx = AUDIO_PLAYBACK_SPEEDS.findIndex((speed) => speed === current);
  if (idx === -1) return 1;
  return AUDIO_PLAYBACK_SPEEDS[(idx + 1) % AUDIO_PLAYBACK_SPEEDS.length];
}

export function seekRatioFromPointer(clientX: number, rect: DOMRect): number {
  if (rect.width <= 0) return 0;
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}

export function formatPlaybackSpeedLabel(speed: number): string {
  return speed === 1 ? '1×' : `${speed}×`;
}
