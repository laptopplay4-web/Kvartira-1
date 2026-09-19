/** Default bar count — dense enough for VK-like look on ~240–320px. */
export const VOICE_WAVEFORM_BAR_COUNT = 40;

/**
 * FNV-1a 32-bit hash — stable seed for deterministic fake waveforms
 * (same attachment id → same bars across remounts).
 */
export function hashStringToSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 — small deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Synthetic waveform heights in 12–100 (% of track height).
 * Shape is speech-like: clustered peaks with quiet gaps.
 */
export function generateWaveformHeights(
  seedInput: string,
  barCount: number = VOICE_WAVEFORM_BAR_COUNT,
): number[] {
  const count = Math.max(8, Math.min(64, Math.floor(barCount)));
  const rand = mulberry32(hashStringToSeed(seedInput || 'voice'));
  const heights: number[] = [];

  let envelope = 0.55;
  for (let i = 0; i < count; i++) {
    envelope += (rand() - 0.48) * 0.35;
    envelope = Math.min(0.95, Math.max(0.18, envelope));
    const spike = rand() > 0.82 ? 0.25 + rand() * 0.35 : 0;
    const dip = rand() > 0.9 ? -0.35 : 0;
    const n = envelope + spike + dip + (rand() - 0.5) * 0.12;
    const pct = Math.round(12 + Math.min(1, Math.max(0, n)) * 88);
    heights.push(pct);
  }
  return heights;
}

/** How many leading bars are “played” for a 0…1 progress ratio. */
export function playedBarCount(progress: number, barCount: number): number {
  if (!Number.isFinite(progress) || barCount <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, progress));
  if (ratio <= 0) return 0;
  if (ratio >= 1) return barCount;
  return Math.min(barCount, Math.ceil(ratio * barCount));
}
