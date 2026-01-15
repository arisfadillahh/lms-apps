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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>

      {/* Left Side - Image Placeholder */}
      <div style={{
        flex: '1',
        display: 'none', // Hidden on mobile by default
        background: 'linear-gradient(135deg, #e0e7ff 0%, #f1f5f9 100%)',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#cbd5e1',
        fontSize: '1.5rem',
        fontWeight: 600,
        borderRight: '1px solid #e2e8f0',
        position: 'relative'
      }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Placeholder for future image */}
          <span style={{ background: 'rgba(255,255,255,0.5)', padding: '1rem 2rem', borderRadius: '12px' }}>
            Image Placeholder
          </span>
        </div>

        {/* Responsive helper using style tag for media query */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 1024px) {
                div[style*="background: linear-gradient"] {
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
        padding: '2rem'
      }}>
        <LoginForm />
      </div>
    </div>
  );
}
