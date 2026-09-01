/** PB schema stores skill level 0–10; app UI and mock use 0–100. */

export function toPbSkillLevel(level: number): number {
  if (level <= 10) return Math.min(10, Math.max(0, Math.round(level)));
  return Math.min(10, Math.max(0, Math.round(level / 10)));
}

export function fromPbSkillLevel(level: number): number {
  if (level <= 10) return Math.round(level * 10);
  return Math.min(100, Math.max(0, Math.round(level)));
}
