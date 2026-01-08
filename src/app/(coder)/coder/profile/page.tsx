"use server";

import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';

import ChangePasswordForm from '../dashboard/ChangePasswordForm';

export default async function CoderProfilePage() {
  const session = await getSessionOrThrow();

  return (
    <div style={pageContainerStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Profile &amp; Security</h1>
          <p style={subtitleStyle}>Perbarui data akun dan ganti password secara berkala.</p>
        </div>
        <div style={profileBadgeStyle}>
          <span style={{ fontSize: '0.85rem', color: '#475569' }}>Logged in as</span>
          <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{session.user.fullName}</strong>
        </div>
      </header>

      <section style={cardStyle}>
        <h2 style={sectionHeadingStyle}>Ganti Password</h2>
        <p style={sectionSubheadingStyle}>
          Pastikan password minimal 8 karakter dan mudah diingat namun sulit ditebak.
        </p>
        <ChangePasswordForm variant="card" />
      </section>
    </div>
  );
}

const pageContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.75rem',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '1rem',
};

const titleStyle: CSSProperties = {
  fontSize: '1.6rem',
  fontWeight: 600,
  color: '#0f172a',
};

const subtitleStyle: CSSProperties = {
  color: '#64748b',
  fontSize: '0.95rem',
};

const profileBadgeStyle: CSSProperties = {
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: '0.75rem',
  padding: '0.8rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  minWidth: '200px',
};

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '0.85rem',
  border: '1px solid #e2e8f0',
  padding: '1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  maxWidth: '420px',
};

const sectionHeadingStyle: CSSProperties = {
  fontSize: '1.15rem',
  fontWeight: 600,
  color: '#0f172a',
};

const sectionSubheadingStyle: CSSProperties = {
  fontSize: '0.9rem',
  color: '#64748b',
};
