import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
import { getRoleDashboardPath } from '@/lib/routing';

import LoginForm from './LoginForm';

export const metadata = {
  title: 'Login | Clevio LMS',
};

export default async function LoginPage() {
  const session = await getServerAuthSession();
  if (session) {
    redirect(getRoleDashboardPath(session.user.role));
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#ffffff', overflow: 'hidden' }}>

      {/* Left Side - Branding & Illustration */}
      <div style={{
        flex: '1',
        display: 'none', // Hidden on mobile
        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', // Clevio Blue Gradient
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        position: 'relative',
        padding: '3rem'
      }}>
        {/* Background Patterns (Optional decoration) */}
        <div style={{
          position: 'absolute', top: '-10%', left: '-10%', width: '50%', height: '50%',
          background: 'rgba(255,255,255,0.05)', borderRadius: '50%'
        }}></div>
        <div style={{
          position: 'absolute', bottom: '-5%', right: '-5%', width: '40%', height: '40%',
          background: 'rgba(255,255,255,0.05)', borderRadius: '50%'
        }}></div>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
          {/* Mock Illustration */}
          <div style={{
            margin: '0 auto 2.5rem auto',
            width: '320px',
            height: '240px',
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <span style={{ fontSize: '4rem' }}>🎓</span>
          </div>

          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.2 }}>
            Learning Management<br />System
          </h2>
          <p style={{ fontSize: '1.1rem', opacity: 0.9, maxWidth: '80%', margin: '0 auto' }}>
            Clevio Coder Camp - Future Skills for Future Leaders
          </p>
        </div>

        {/* Responsive CSS Injection */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 1024px) {
                div[style*="linear-gradient"] {
                    display: flex !important;
                }
            }
          `}} />
      </div>

      {/* Right Side - Login Form */}
      <div style={{
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: '#ffffff'
      }}>
        <LoginForm />
      </div>
    </div>
  );
}
