import Link from 'next/link';
import type { ReactNode } from 'react';

import SignOutButton from '@/components/SignOutButton';
import { getServerAuthSession } from '@/lib/auth';

const NAV_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/classes', label: 'Classes' },
  { href: '/admin/curriculum', label: 'Curriculum' },
  { href: '/admin/leave', label: 'Coach Leave' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/whatsapp', label: 'WhatsApp' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg-page)' }}>
      <aside
        style={{
          width: '220px',
          background: '#111827',
          color: '#f9fafb',
          padding: '1.5rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        <div>
          <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Clevio LMS</p>
          <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Admin Console</p>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} style={{ color: '#f9fafb', textDecoration: 'none', fontSize: '0.95rem' }}>
              {link.label}
            </Link>
          ))}
        </nav>
        {session ? (
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Signed in as
              <br />
              <span style={{ color: '#f9fafb' }}>{session.user.fullName}</span>
            </div>
            <SignOutButton
              style={{
                alignSelf: 'flex-start',
                border: '1px solid rgba(249, 250, 251, 0.35)',
                color: '#f9fafb',
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
