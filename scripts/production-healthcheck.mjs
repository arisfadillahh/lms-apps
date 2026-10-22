#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function checkHealth(base, { full = false, fetchImpl = globalThis.fetch } = {}) {
  const url = new URL(base);
  if (!['127.0.0.1', 'lms.clev.io'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.hostname === 'lms.clev.io' && url.protocol !== 'https:') || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid health-check origin');
  const routes = [['/login', 200], ...(full ? [
    ['/admin/dashboard', 307], ['/coach/dashboard', 307], ['/coder/dashboard', 307], ['/api/admin/invoice-checkouts', 401],
  ] : [])];
  for (const [route, expected] of routes) {
    const response = await fetchImpl(new URL(route, base), { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    // Fully consume Next's streaming response, rather than aborting the stream.
    await response.arrayBuffer();
    if (response.status !== expected) throw new Error(`Health check ${route}: unexpected status`);
    if (expected === 307 && !new URL(response.headers.get('location') || '/', base).pathname.startsWith('/login')) throw new Error('Protected route did not redirect to login');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await checkHealth(process.argv[2], { full: process.argv[3] === 'full' }); }
  catch { process.exitCode = 1; }
}
