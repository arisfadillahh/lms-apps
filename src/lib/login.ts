import { signIn, type SignInResponse } from 'next-auth/react';

export function isCsrfFailure(result: SignInResponse | undefined): boolean {
  if (!result?.url) return false;
  try { return new URL(result.url, 'http://localhost').searchParams.get('csrf') === 'true'; }
  catch { return false; }
}

export async function signInWithCsrfRetry(credentials: { username: string; password: string }) {
  let result = await signIn('credentials', { ...credentials, redirect: false });
  // Initial anonymous session requests can race to set the first CSRF cookie.
  // Only retry an explicit CSRF rejection; NextAuth fetches the current token
  // and validates it again. Never retry a rejected password or bypass CSRF.
  if (isCsrfFailure(result)) result = await signIn('credentials', { ...credentials, redirect: false });
  return result;
}
