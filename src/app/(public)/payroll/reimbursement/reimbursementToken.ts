/** Fragments stay in the browser; query strings must never carry these tokens. */
export function tokenFromFragment(fragment: string): string {
  if (!fragment.startsWith('#')) return '';
  const params = new URLSearchParams(fragment.slice(1));
  return params.getAll('token').length === 1 ? params.get('token') ?? '' : '';
}
