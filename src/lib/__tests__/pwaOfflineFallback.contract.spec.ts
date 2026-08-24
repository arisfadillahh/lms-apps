import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('PWA offline fallback contract', () => {
  it('registers the service worker from the root experience', () => {
    const source = fs.readFileSync(
      path.join(root, 'src/components/pwa/PwaStartupSplash.tsx'),
      'utf8',
    );

    expect(source).toContain("navigator.serviceWorker.register('/sw.js')");
  });

  it('caches and serves the branded offline navigation fallback', () => {
    const serviceWorker = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
    const offlinePage = fs.readFileSync(path.join(root, 'public/offline.html'), 'utf8');

    expect(serviceWorker).toContain("const OFFLINE_URL = '/offline.html'");
    expect(serviceWorker).toContain("const CACHE_NAME = 'clevio-lms-shell-v4'");
    expect(serviceWorker).toContain("cache.addAll([");
    expect(serviceWorker).toContain("fetch(event.request).catch(() => caches.match(OFFLINE_URL))");
    expect(offlinePage).toContain('KONEKSI TERPUTUS');
    expect(offlinePage).toContain('Clevio Innovator Camp');
    expect(offlinePage).toContain('src="/pwa-icon-192.png"');
    expect(offlinePage).toContain('<strong>clevio</strong>');
    expect(offlinePage).toContain('Coba lagi');
  });
});
