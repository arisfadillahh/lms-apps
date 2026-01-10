import Link from 'next/link';
import type { ReactNode } from 'react';

import SignOutButton from '@/components/SignOutButton';
import { getServerAuthSession } from '@/lib/auth';

const NAV_LINKS = [
  { href: '/coder/dashboard', label: 'Dashboard' },
  { href: '/coder/materials', label: 'Materials' },
  { href: '/coder/makeup', label: 'Make-Up Tasks' },
  { href: '/coder/reports', label: 'Reports' },
  { href: '/coder/profile', label: 'Profile & Security' },
];

export default async function CoderLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg-page)' }}>
      <aside
        style={{
          width: '220px',
          height: '100vh',
          background: '#1d4ed8',
          color: '#fff',
          padding: '1.5rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          position: 'fixed',
          left: 0,
          top: 0,
          overflowY: 'auto',
        }}
      >
        <div>
          <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Clevio LMS</p>
          <p style={{ fontSize: '0.85rem', color: '#bfdbfe' }}>Coder Portal</p>
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
            <div style={{ fontSize: '0.8rem', color: '#bfdbfe' }}>
              Signed in as
              <br />
              <span style={{ color: '#fff', fontWeight: 600 }}>{session.user.fullName}</span>
            </div>
            <SignOutButton
              style={{
                alignSelf: 'flex-start',
                border: '1px solid rgba(248, 250, 252, 0.45)',
                color: '#f8fafc',
              }}
            />
          </div>
        ) : null}
      </aside>
      <main
        style={{
          flex: 1,
          marginLeft: '220px',
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
