import { FileText, ArrowRight, Calendar, CheckCircle } from 'lucide-react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { StaggerContainer, StaggerItem } from '../StaggerWrapper';
import PortfolioTabs from '@/components/portfolio/PortfolioTabs';

export default async function CoderReportsPage() {
  const session = await getSessionOrThrow();
  const supabase = getSupabaseAdmin();

  // Fetch only PUBLISHED reports for this coder
  const { data: reports } = await supabase
    .from('block_reports')
    .select(`
      id,
      average_score,
      grade,
      updated_at,
      class:classes(name),
      block:blocks(name)
    `)
    .eq('coder_id', session.user.id)
    .eq('status', 'PUBLISHED')
    .order('updated_at', { ascending: false });

  const publishedReports = reports || [];

  return (
    <StaggerContainer className="flex-1 p-8 overflow-y-auto space-y-8 max-w-4xl">
      {/* Header */}
      <StaggerItem>
        <header>
          <h1 className="text-3xl font-black text-clevio-navy tracking-tight mb-1 flex items-center gap-3">
            <FileText className="text-clevio-green" size={28} /> Rapor & Portofolio
          </h1>
          <p className="text-sm font-bold text-slate-400">
            Lihat perkembangan dan hasil belajar kamu di setiap Block.
          </p>
        </header>
      </StaggerItem>

      <StaggerItem>
        <PortfolioTabs active="reports" />
      </StaggerItem>

      {/* Reports Section */}
      <StaggerItem>
        <section className="bg-white rounded-[3rem] border-2 border-slate-50 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-8 pb-4 border-b-2 border-dashed border-pastel-blue/30">
            <span className="w-1.5 h-8 bg-sky rounded-full"></span>
            <h2 className="text-xl font-black text-clevio-navy">Daftar Rapor</h2>
          </div>

          <div className="space-y-4">
            {publishedReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-pastel-blue/10 rounded-[2rem] border-4 border-dashed border-pastel-blue/30 text-center">
                <FileText size={40} className="text-sky/40 mb-4" />
                <p className="font-black text-slate-600">Belum ada rapor yang tersedia.</p>
                <p className="text-sm font-bold text-slate-400 mt-1">Rapor akan muncul di sini setelah Coach selesai menilainya.</p>
              </div>
            ) : (
              publishedReports.map((report: any, idx) => {
                const themes = [
                  { icon: 'bg-pastel-blue text-sky', btn: 'bg-sky hover:bg-clevio-navy' },
                  { icon: 'bg-pastel-green text-clevio-green', btn: 'bg-clevio-green hover:bg-clevio-navy' },
                  { icon: 'bg-pastel-pink text-coral', btn: 'bg-coral hover:bg-clevio-navy' },
                  { icon: 'bg-pastel-yellow text-amber-600', btn: 'bg-amber-500 hover:bg-clevio-navy' },
                ];
                const theme = themes[idx % 4];

                return (
                  <div key={report.id} className="flex items-center justify-between bg-white rounded-2xl border-2 border-slate-50 p-5 hover:border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex gap-4 items-center">
                      <div className={`size-12 rounded-2xl ${theme.icon} flex items-center justify-center`}>
                        <FileText size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-clevio-navy">
                          {(report.class as any)?.name} <span className="text-slate-400 font-semibold mx-1">|</span> {(report.block as any)?.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1.5 text-sm font-bold text-slate-400">
                            <Calendar size={14} />
                            {new Date(report.updated_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1.5 text-sm font-bold text-clevio-green bg-pastel-green px-2 py-0.5 rounded-lg">
                            <CheckCircle size={14} /> Resmi
                          </span>
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/report/${report.id}`}
                      className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl ${theme.btn} text-white font-black text-sm shadow-md hover:scale-105 transition-all no-underline`}
                    >
                      Buka Rapor <ArrowRight size={18} />
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </StaggerItem>
    </StaggerContainer>
  );
}
