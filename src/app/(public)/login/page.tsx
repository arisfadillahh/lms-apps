import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getServerAuthSession } from '@/lib/auth';
import { getRoleDashboardPath } from '@/lib/routing';

import LoginForm from './LoginForm';

export const metadata = {
  title: 'Login | Clevio LMS',
};

export default async function LoginPage(props: any) {
  const searchParams = props.searchParams ? await Promise.resolve(props.searchParams) : {};
  const lang = searchParams.lang === 'en' ? 'en' : 'id';
  const isEng = lang === 'en';

  const session = await getServerAuthSession();
  if (session) {
    redirect(getRoleDashboardPath(session.user.role));
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 md:p-8 bg-[#ECEFF4] font-display">
      {/* Card Container */}
      <div className="relative w-full max-w-[1400px] h-[95vh] md:h-[88vh] md:min-h-[700px] bg-[#F7F9FE] rounded-[24px] md:rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row">

        {/* Main Content Area overlapping everything */}
        <div className="relative w-full h-full flex flex-col md:flex-row z-10 overflow-y-auto md:overflow-hidden">

          {/* Background Image Area */}
          <div className="absolute top-0 right-0 w-full md:w-[75%] h-[45%] md:h-full z-0 pointer-events-none opacity-90 md:opacity-100">
            <Image
              src="/images/lms_coding_gaming_3d_lightblue.png"
              alt="LMS Coding and Gaming 3D Objects on Light Blue Background"
              fill
              className="object-cover object-[center_20%] md:object-[right_90%]"
              priority
            />

            {/* Desktop Gradient */}
            <div className="hidden md:block absolute inset-0" style={{ background: 'linear-gradient(45deg, #F7F9FE 0%, #F7F9FE 50%, rgba(247,249,254,0.75) 65%, rgba(247,249,254,0.25) 80%, transparent 95%)' }} />
            
            {/* Mobile Gradient */}
            <div className="block md:hidden absolute inset-0 bg-gradient-to-b from-transparent via-[#F7F9FE]/40 to-[#F7F9FE]" />
          </div>

          {/* Independent Dashed Line overlapping the background */}
          <div className="absolute inset-0 z-5 pointer-events-none hidden md:block">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              <path d="M45,0 C65,35 35,65 55,100" fill="none" stroke="rgba(34, 54, 123, 0.2)" strokeWidth="0.15" strokeDasharray="1.5, 2.5" />
            </svg>
          </div>

          {/* Left Side Container for Form */}
          <div className="flex-1 w-full md:max-w-[55%] relative flex flex-col p-6 md:p-12 lg:p-16 z-10 bg-transparent">

            {/* Header / Logos */}
            <div className="flex flex-row items-center justify-between mb-4 mt-6 md:mt-0 md:mb-16 relative z-20">
              <div className="flex items-center gap-3">
                <Image src="/logo/innovator-camp-logo-dark.png" alt="Innovator Camp" width={154} height={42} className="object-contain w-[154px] md:w-[160px] md:h-[44px]" />
              </div>
              <div className="flex items-center gap-4 md:gap-12 md:pr-24">
                <span className="cursor-pointer text-sm text-slate-500 font-semibold hover:text-slate-800 transition-colors hidden md:block">{isEng ? 'Main Website' : 'Website Utama'}</span>

                {/* Language Toggle */}
                <div className="flex items-center bg-white/60 md:bg-slate-200/60 rounded-full p-1 border border-slate-200/50 backdrop-blur-sm transition-colors">
                  <Link href="?lang=id" scroll={false} replace className={`px-3 py-1.5 md:py-1 rounded-full text-[11px] md:text-xs font-bold transition-all ${!isEng ? 'bg-white text-slate-800 shadow-sm pointer-events-none' : 'text-slate-600 hover:text-slate-800'}`}>
                    IND
                  </Link>
                  <Link href="?lang=en" scroll={false} replace className={`px-3 py-1.5 md:py-1 rounded-full text-[11px] md:text-xs font-bold transition-all ${isEng ? 'bg-white text-slate-800 shadow-sm pointer-events-none' : 'text-slate-600 hover:text-slate-800'}`}>
                    ENG
                  </Link>
                </div>
              </div>
            </div>

            {/* Mobile space maker for Image */}
            <div className="w-full h-[35vh] md:hidden shrink-0" />

            {/* Login Form Container */}
            <div className="flex-1 flex flex-col justify-start pt-4 w-full md:max-w-md mx-auto md:mx-0">
              <LoginForm lang={lang} />
            </div>
          </div>

          {/* Right Side Empty Area to show image on desktop */}
          <div className="hidden md:block flex-[0.8] relative pointer-events-none">
          </div>

        </div>
      </div>
    </div>
  );
}
