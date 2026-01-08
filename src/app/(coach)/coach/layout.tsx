import Link from 'next/link';
import type { ReactNode } from 'react';

import SignOutButton from '@/components/SignOutButton';
import { getServerAuthSession } from '@/lib/auth';

const NAV_LINKS = [
  { href: '/coach/dashboard', label: 'Dashboard' },
  { href: '/coach/rubrics', label: 'Rubrics' },
  { href: '/coach/makeup', label: 'Make-Up Tasks' },
  { href: '/coach/leave', label: 'Leave Requests' },
];

export default async function CoachLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg-page)' }}>
      <aside
        style={{
          width: '220px',
          background: '#0f172a',
          color: '#fff',
          padding: '1.5rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        <div>
          <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Clevio LMS</p>
          <p style={{ fontSize: '0.85rem', color: '#cbd5f5' }}>Coach Portal</p>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} style={{ color: '#f8fafc', textDecoration: 'none', fontSize: '0.95rem' }}>
              {link.label}
            </Link>
          ))}
        </nav>
        {session ? (
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#cbd5f5' }}>
              Signed in as
              <br />
              <span style={{ color: '#fff' }}>{session.user.fullName}</span>
            </div>
            <SignOutButton
              style={{
                alignSelf: 'flex-start',
                border: '1px solid rgba(248, 250, 252, 0.35)',
                color: '#f8fafc',
              }}
            />
          </div>
        ) : null}
      </aside>
      <main
        style={{
          flex: 1,
          padding: '2rem 2.5rem',
          background: 'transparent',
          color: 'var(--color-text-primary)',
        }}
      >
        {children}
      </main>
    </div>
  );
}
