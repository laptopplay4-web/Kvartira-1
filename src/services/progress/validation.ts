export function validateGoalTitle(title: string): { valid: boolean; message?: string } {
  const trimmed = title.trim();
  if (!trimmed) return { valid: false, message: 'Введите название цели' };
  if (trimmed.length > 120) return { valid: false, message: 'Название слишком длинное' };
  return { valid: true };
}

export function validateSkillLevel(level: number, maxLevel: number): { valid: boolean; message?: string } {
  if (!Number.isFinite(level) || level < 0 || level > maxLevel) {
    return { valid: false, message: `Уровень должен быть от 0 до ${maxLevel}` };
  }
  return { valid: true };
}
