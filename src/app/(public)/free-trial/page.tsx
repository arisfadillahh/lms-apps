import type { Metadata } from 'next';
import Image from 'next/image';

import FreeTrialForm from './FreeTrialForm';

export const metadata: Metadata = {
  title: 'Free Trial Class | Clevio LMS',
  description: 'Daftar free trial coding class Clevio untuk anak.',
};

export default function FreeTrialPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#dbeafe] via-[#f3e8ff] to-[#cffafe] p-3 font-display sm:p-5 lg:p-7">
      <section className="relative mx-auto min-h-[calc(100vh-1.5rem)] w-full max-w-[1400px] overflow-hidden rounded-[24px] bg-[#F7F9FE] shadow-2xl sm:min-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-3.5rem)] lg:rounded-[32px]">
        <div className="pointer-events-none absolute right-0 top-0 h-[240px] w-full opacity-90 lg:h-full lg:w-[58%] lg:opacity-100">
          <Image
            src="/images/lms_coding_gaming_3d_lightblue.png"
            alt="Ilustrasi coding dan gaming Clevio"
            fill
            priority
            className="object-cover object-[center_18%] lg:object-[right_90%]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F7F9FE]/35 to-[#F7F9FE] lg:bg-[linear-gradient(90deg,#F7F9FE_0%,rgba(247,249,254,0.94)_18%,rgba(247,249,254,0.45)_48%,transparent_78%)]" />
        </div>

        <div className="relative z-10 flex min-h-[inherit] w-full flex-col p-5 sm:p-8 lg:w-[62%] lg:p-10 xl:p-12">
          <header className="flex items-center justify-between">
            <Image
              src="/logo/innovator-camp-logo-dark.png"
              alt="Clevio Innovator Camp"
              width={160}
              height={44}
              className="h-auto w-[128px] object-contain sm:w-[150px]"
            />
            <a
              href="https://clev.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-bold text-slate-500 transition-colors hover:text-slate-800"
            >
              clev.io
            </a>
          </header>

          <div className="h-28 shrink-0 lg:h-8" />
          <div className="flex flex-1 items-center">
            <FreeTrialForm />
          </div>

          <p className="mt-7 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 lg:text-left">
            Clevio Learning Management System
          </p>
        </div>
      </section>
    </main>
  );
}
