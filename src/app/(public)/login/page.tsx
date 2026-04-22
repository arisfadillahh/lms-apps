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
    <div className="flex flex-col lg:h-screen min-h-screen items-center justify-center p-4 md:p-8 lg:p-6 bg-gradient-to-br from-[#dbeafe] via-[#f3e8ff] to-[#cffafe] font-display lg:overflow-hidden">
      {/* Card Container */}
      <div className="relative w-full max-w-[1400px] h-auto min-h-max lg:h-full lg:max-h-[88vh] lg:min-h-[600px] bg-[#F7F9FE] rounded-[24px] lg:rounded-[32px] overflow-hidden shadow-2xl flex flex-col lg:flex-row">

        {/* Main Content Area overlapping everything */}
        <div className="relative w-full h-full flex flex-col lg:flex-row z-10 overflow-y-auto overflow-x-hidden">

          {/* Background Image Area */}
          <div className="absolute top-0 right-0 w-full lg:w-[75%] h-[35%] lg:h-full z-0 pointer-events-none opacity-90 lg:opacity-100">
            <Image
              src="/images/lms_coding_gaming_3d_lightblue.png"
              alt="LMS Coding and Gaming 3D Objects on Light Blue Background"
              fill
              className="object-cover object-[center_20%] lg:object-[right_90%]"
              priority
            />

            {/* Desktop Gradient */}
            <div className="hidden lg:block absolute inset-0" style={{ background: 'linear-gradient(45deg, #F7F9FE 0%, #F7F9FE 50%, rgba(247,249,254,0.75) 65%, rgba(247,249,254,0.25) 80%, transparent 95%)' }} />
            
            {/* Mobile Gradient */}
            <div className="block lg:hidden absolute inset-0 bg-gradient-to-b from-transparent via-[#F7F9FE]/40 to-[#F7F9FE]" />
          </div>

          {/* Independent Dashed Line overlapping the background */}
          <div className="absolute inset-0 z-5 pointer-events-none hidden lg:block">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              <path d="M45,0 C65,35 35,65 55,100" fill="none" stroke="rgba(34, 54, 123, 0.2)" strokeWidth="0.15" strokeDasharray="1.5, 2.5" />
            </svg>
          </div>

          {/* Left Side Container for Form */}
          <div className="flex-1 w-full lg:max-w-[55%] relative flex flex-col p-6 md:p-8 lg:p-10 z-10 bg-transparent">

            {/* Header / Logos */}
            <div className="flex flex-row items-center justify-between mb-4 mt-2 lg:mt-0 lg:mb-8 relative z-20">
              <div className="flex items-center gap-3">
                <Image src="/logo/innovator-camp-logo-dark.png" alt="Innovator Camp" width={160} height={44} className="object-contain w-[120px] sm:w-[140px] lg:w-[160px] h-auto" />
              </div>
              <div className="flex items-center gap-4 lg:gap-12 lg:pr-24">
                <a href="https://clev.io" target="_blank" rel="noopener noreferrer" className="cursor-pointer text-sm text-slate-500 font-semibold hover:text-slate-800 transition-colors hidden lg:block">
                  {isEng ? 'Main Website' : 'Website Utama'}
                </a>

                {/* Language Toggle */}
                <div className="flex items-center bg-white/60 lg:bg-slate-200/60 rounded-full p-1 border border-slate-200/50 backdrop-blur-sm transition-colors">
                  <Link href="?lang=id" scroll={false} replace className={`px-3 py-1.5 lg:py-1 rounded-full text-[11px] lg:text-xs font-bold transition-all ${!isEng ? 'bg-white text-slate-800 shadow-sm pointer-events-none' : 'text-slate-600 hover:text-slate-800'}`}>
                    IND
                  </Link>
                  <Link href="?lang=en" scroll={false} replace className={`px-3 py-1.5 lg:py-1 rounded-full text-[11px] lg:text-xs font-bold transition-all ${isEng ? 'bg-white text-slate-800 shadow-sm pointer-events-none' : 'text-slate-600 hover:text-slate-800'}`}>
                    ENG
                  </Link>
                </div>
              </div>
            </div>

            {/* Mobile/Tablet space maker for Image */}
            <div className="w-full h-[15vh] md:h-[20vh] lg:hidden shrink-0" />

            {/* Login Form Container */}
            <div className="flex-1 flex flex-col justify-start pt-4 w-full md:max-w-xl mx-auto lg:mx-0 relative z-20">
              <LoginForm lang={lang} />
            </div>

            {/* Mobile Footer text natively in flow */}
            <div className="mt-10 md:mt-12 lg:hidden flex justify-center relative z-20 text-center">
              <p className="text-[10px] sm:text-xs md:text-sm font-bold text-slate-400 tracking-widest uppercase">
                Clevio <span className="font-medium text-slate-400/80 capitalize tracking-normal ml-1">Learning Management System</span>
              </p>
            </div>
          </div>

          {/* Right Side Empty Area to show image on desktop */}
          <div className="hidden lg:block flex-[0.8] relative pointer-events-none">
          </div>

        </div>

        {/* Desktop Footer positioned absolutely in the bottom right */}
        <div className="hidden lg:block absolute bottom-8 right-10 z-30 pointer-events-none">
          <div className="px-5 py-2.5 rounded-full bg-[#22367b] shadow-[0_8px_16px_rgba(34,54,123,0.2)] text-right">
            <p className="text-xs xl:text-sm font-black text-[#a1cc3a] tracking-widest uppercase">
              Clevio <span className="font-medium text-white/90 capitalize tracking-normal ml-1">Learning Management System</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
