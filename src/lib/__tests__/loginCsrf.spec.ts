import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
import { signIn } from 'next-auth/react';
import { isCsrfFailure, signInWithCsrfRetry } from '@/lib/login';
const rejected = { ok: true, status: 200, error: null, url: 'http://localhost/api/auth/signin?csrf=true' };
const success = { ok: true, status: 200, error: null, url: 'http://localhost/' };
const credentials = { username: 'demo', password: 'local-test-only' };
describe('login CSRF race recovery', () => {
  beforeEach(() => vi.mocked(signIn).mockReset());
  it('retries an explicit CSRF rejection once through the normal authenticated sign-in path', async () => {
    vi.mocked(signIn).mockResolvedValueOnce(rejected).mockResolvedValueOnce(success);
    expect(await signInWithCsrfRetry(credentials)).toEqual(success);
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(signIn).toHaveBeenLastCalledWith('credentials', { ...credentials, redirect: false });
  });
  it('does not retry invalid credentials', async () => {
    const invalid = { ok: false, status: 401, error: 'CredentialsSignin', url: null };
    vi.mocked(signIn).mockResolvedValue(invalid);
    expect(await signInWithCsrfRetry(credentials)).toEqual(invalid);
    expect(signIn).toHaveBeenCalledTimes(1);
  });
  it('stops after one retry so persistent rejection can be shown to the user', async () => {
    vi.mocked(signIn).mockResolvedValue(rejected);
    expect(isCsrfFailure(await signInWithCsrfRetry(credentials))).toBe(true);
    expect(signIn).toHaveBeenCalledTimes(2);
  });
});
