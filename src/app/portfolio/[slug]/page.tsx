import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowDown, BadgeCheck, MapPin, Sparkles } from 'lucide-react';

import PublicPortfolioGallery, { type PublicProject } from '@/components/portfolio/PublicPortfolioGallery';
import type { PublishedPortfolioSnapshot } from '@/lib/coderPortfolio';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type Params = { params: Promise<{ slug: string }> };

async function getPublicPortfolio(slug: string) {
  const supabase = getSupabaseAdmin() as any;
  const { data: profile, error } = await supabase.from('coder_portfolio_profiles').select('coder_id, school_visible').eq('public_slug', slug).maybeSingle();
  if (error || !profile) return null;
  const [{ data: user }, { data: enrollments }, { data: portfolios }] = await Promise.all([
    supabase.from('users').select('full_name, school_name, school_grade').eq('id', profile.coder_id).maybeSingle(),
    supabase.from('enrollments').select('enrolled_at, classes(type, levels(name))').eq('coder_id', profile.coder_id).order('enrolled_at', { ascending: false }),
    supabase.from('coder_portfolios').select('id, published_snapshot, published_at, program_type').eq('coder_id', profile.coder_id).not('published_snapshot', 'is', null).order('published_at', { ascending: false }),
  ]);
  if (!user) return null;
  const programTypes = [...new Set([
    ...(enrollments ?? []).flatMap((item: any) => {
      const selectedClass = Array.isArray(item.classes) ? item.classes[0] : item.classes;
      return selectedClass?.type ? [selectedClass.type] : [];
    }),
    ...(portfolios ?? []).map((item: any) => item.program_type),
  ])].filter((item) => ['WEEKLY', 'EKSKUL'].includes(String(item))) as Array<'WEEKLY' | 'EKSKUL'>;
  const latestClass = enrollments?.[0]?.classes;
  const latestLevel = Array.isArray(latestClass) ? latestClass[0]?.levels : latestClass?.levels;
  const levelName = Array.isArray(latestLevel) ? latestLevel[0]?.name : latestLevel?.name;
  return {
    profile,
    user,
    programTypes,
    levelName: levelName || null,
    projects: (portfolios ?? []).map((item: any) => ({ id: item.id, snapshot: item.published_snapshot as PublishedPortfolioSnapshot, publishedAt: item.published_at })) as PublicProject[],
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicPortfolio(slug);
  return data ? { title: `${data.user.full_name} — Clevio Portfolio`, description: `Kumpulan karya coding ${data.user.full_name} di Clevio.` } : { title: 'Portfolio tidak ditemukan' };
}

export default async function PublicPortfolioPage({ params }: Params) {
  const { slug } = await params;
  const data = await getPublicPortfolio(slug);
  if (!data) notFound();
  const firstName = data.user.full_name?.split(' ')[0] || 'Coder';

  return (
    <main className="min-h-screen overflow-hidden bg-[#07101f] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(circle_at_20%_20%,rgba(0,176,215,0.22),transparent_38%),radial-gradient(circle_at_80%_15%,rgba(157,200,59,0.16),transparent_30%)]" />
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Image src="/images/clevio-logo.png.png" alt="Clevio Innovator Camp" width={150} height={52} className="h-auto w-28 sm:w-36" priority />
        <a href="#projects" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 backdrop-blur hover:bg-white/10">Lihat Karya <ArrowDown size={16} /></a>
      </nav>
      <section className="relative z-[1] mx-auto grid min-h-[650px] max-w-6xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-lime-300"><Sparkles size={16} /> Clevio Coder Portfolio</div>
          <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.04em] sm:text-7xl">Hai, aku <span className="text-transparent [-webkit-text-stroke:1.5px_#9dc83b]">{firstName}</span>.<br />Aku membuat ide jadi nyata.</h1>
          <p className="mt-7 max-w-2xl text-base font-semibold leading-relaxed text-slate-300 sm:text-lg">Di sini kamu bisa mencoba project yang kubuat, melihat prosesnya, dan mengetahui hal-hal baru yang kupelajari.</p>
          <div className="mt-8 flex flex-wrap gap-2">
            {data.levelName && <span className="inline-flex items-center gap-2 rounded-full bg-blue-300 px-4 py-2 text-sm font-black text-blue-950"><BadgeCheck size={17} /> Level {data.levelName}</span>}
            {data.programTypes.map((type) => <span key={type} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-black">Coder {type === 'WEEKLY' ? 'Weekly' : 'Ekskul'}</span>)}
            {data.profile.school_visible && data.user.school_name && <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-black"><MapPin size={17} className="text-lime-300" /> {data.user.school_name}</span>}
          </div>
        </div>
        <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center">
          <div className="absolute inset-3 rounded-full border border-dashed border-blue-300/35 animate-[spin_30s_linear_infinite]" />
          <div className="absolute inset-12 rounded-full border border-lime-300/25" />
          <div className="relative flex size-44 rotate-3 items-center justify-center rounded-[3rem] bg-gradient-to-br from-blue-300 to-clevio-green text-7xl font-black text-clevio-navy shadow-[0_0_80px_rgba(107,179,255,0.3)]">{firstName.charAt(0).toUpperCase()}</div>
          <span className="absolute left-3 top-20 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black backdrop-blur">build()</span>
          <span className="absolute bottom-16 right-0 rounded-2xl bg-lime-300 px-4 py-3 text-sm font-black text-slate-950">play ▶</span>
        </div>
      </section>
      <PublicPortfolioGallery projects={data.projects} />
      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm font-semibold text-slate-500">Dibuat dengan rasa ingin tahu bersama Clevio Innovator Camp.</footer>
    </main>
  );
}
