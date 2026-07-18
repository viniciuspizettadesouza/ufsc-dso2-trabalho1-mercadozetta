export function classes(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export const fieldClasses =
  'rounded-control border border-theme-border bg-surface px-3 py-2 text-content disabled:cursor-not-allowed disabled:opacity-60';
