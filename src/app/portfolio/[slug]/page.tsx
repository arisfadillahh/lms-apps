import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import PublicPortfolioExperience from '@/components/portfolio/PublicPortfolioExperience';
import type { PublicProject } from '@/components/portfolio/PublicPortfolioGallery';
import type { PublishedPortfolioSnapshot } from '@/lib/coderPortfolio';
import { buildPortfolioExperienceModel } from '@/lib/publicPortfolioExperience';
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
  const model = buildPortfolioExperienceModel({
    fullName: data.user.full_name,
    schoolName: data.user.school_name,
    schoolVisible: data.profile.school_visible,
    levelName: data.levelName,
    programTypes: data.programTypes,
    projects: data.projects,
  });

  return <PublicPortfolioExperience model={model} />;
}
