import Link from 'next/link';
import { BookOpenCheck, PanelsTopLeft } from 'lucide-react';

export default function PortfolioTabs({ active }: { active: 'reports' | 'portfolio' }) {
  return (
    <nav aria-label="Rapor dan portofolio" className="flex w-full max-w-md gap-2 rounded-2xl bg-slate-100 p-1.5">
      <Link
        href="/coder/reports"
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${active === 'reports' ? 'bg-white text-clevio-navy shadow-sm' : 'text-slate-500 hover:text-clevio-navy'}`}
      >
        <BookOpenCheck size={18} /> Rapor
      </Link>
      <Link
        href="/coder/reports/portfolio"
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${active === 'portfolio' ? 'bg-white text-clevio-navy shadow-sm' : 'text-slate-500 hover:text-clevio-navy'}`}
      >
        <PanelsTopLeft size={18} /> Portofolio
      </Link>
    </nav>
  );
}
