import Link from 'next/link';
import { ArrowLeft, Home, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background-light px-6 py-6 font-display text-slate-800">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center gap-4">
          <div className="flex size-12 rotate-3 items-center justify-center rounded-2xl bg-clevio-navy text-2xl font-black text-clevio-green shadow-lg">
            C
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black leading-none tracking-tight text-clevio-navy">LMS Clevio</span>
            <span className="mt-1 text-xs font-bold uppercase tracking-widest text-clevio-green">Learning Management System</span>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center py-4 sm:py-6">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border-4 border-dashed border-pastel-pink/70 bg-white p-8 text-center shadow-[0_20px_60px_rgba(34,54,123,0.10)] sm:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-pastel-blue/80" />
            <div className="pointer-events-none absolute -bottom-20 -left-12 size-44 rounded-full bg-pastel-green/70" />

            <div className="relative mx-auto flex size-20 items-center justify-center rounded-3xl bg-pastel-blue text-sky shadow-inner">
              <SearchX size={38} strokeWidth={2.4} />
            </div>
            <p className="relative mt-8 text-7xl font-black leading-none tracking-tight text-clevio-navy sm:text-8xl">404</p>
            <h1 className="relative mt-5 text-2xl font-black tracking-tight text-clevio-navy sm:text-3xl">
              Halaman tidak ditemukan
            </h1>
            <p className="relative mx-auto mt-4 max-w-md text-base font-semibold leading-7 text-slate-500">
              Link yang kamu buka mungkin sudah dipindahkan, dihapus, atau belum tersedia di LMS Clevio.
            </p>

            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-clevio-navy px-6 py-3.5 text-sm font-black text-white shadow-[0_5px_0_0_#162653] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
              >
                <Home size={18} strokeWidth={2.5} />
                Ke beranda LMS
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-pastel-blue bg-white px-6 py-3.5 text-sm font-black text-clevio-navy transition-colors hover:bg-pastel-blue/40"
              >
                <ArrowLeft size={18} strokeWidth={2.5} />
                Kembali ke login
              </Link>
            </div>
          </div>
        </section>

        <footer className="py-4 text-center text-sm font-bold text-slate-400">
          Copyright {new Date().getFullYear()} Clevio LMS
        </footer>
      </div>
    </main>
  );
}
