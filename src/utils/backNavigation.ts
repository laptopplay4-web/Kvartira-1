/** React Router browser history tracks stack index in state.idx. */
export function canNavigateBack(): boolean {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' && state.idx > 0;
}
