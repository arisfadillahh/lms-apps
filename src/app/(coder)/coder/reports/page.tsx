import { FileText, Download, Calendar, CheckCircle, Clock, BarChart3 } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { reportsDao } from '@/lib/dao';
import { StaggerContainer, StaggerItem } from '../StaggerWrapper';

export default async function CoderReportsPage() {
  const session = await getSessionOrThrow();
  const reports = await reportsDao.listReportsByCoder(session.user.id);

  return (
    <StaggerContainer className="flex-1 p-8 overflow-y-auto space-y-8 max-w-4xl">
      {/* Header */}
      <StaggerItem>
        <header>
          <h1 className="text-3xl font-black text-clevio-navy tracking-tight mb-1 flex items-center gap-3">
            <BarChart3 className="text-clevio-green" size={28} /> Laporan Belajar
          </h1>
          <p className="text-sm font-bold text-slate-400">
            Unduh laporan Rapor (Progress Report) kamu setiap akhir term.
          </p>
        </header>
      </StaggerItem>

      {/* Reports Section */}
      <StaggerItem>
        <section className="bg-white rounded-[3rem] border-2 border-slate-50 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-8 pb-4 border-b-2 border-dashed border-pastel-blue/30">
            <span className="w-1.5 h-8 bg-sky rounded-full"></span>
            <h2 className="text-xl font-black text-clevio-navy">Arsip Laporan</h2>
          </div>

          <div className="space-y-4">
            {reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-pastel-blue/10 rounded-[2rem] border-4 border-dashed border-pastel-blue/30 text-center">
                <FileText size={40} className="text-sky/40 mb-4" />
                <p className="font-black text-slate-600">Belum ada laporan yang tersedia.</p>
                <p className="text-sm font-bold text-slate-400 mt-1">Rapor akan muncul di sini setelah term berakhir.</p>
              </div>
            ) : (
              reports.map((report, idx) => {
                const isSent = report.sent_via_whatsapp;
                const themes = [
                  { icon: 'bg-pastel-blue text-sky', btn: 'bg-sky hover:bg-clevio-navy' },
                  { icon: 'bg-pastel-green text-clevio-green', btn: 'bg-clevio-green hover:bg-clevio-navy' },
                  { icon: 'bg-pastel-pink text-coral', btn: 'bg-coral hover:bg-clevio-navy' },
                  { icon: 'bg-pastel-yellow text-amber-600', btn: 'bg-amber-500 hover:bg-clevio-navy' },
                ];
                const theme = themes[idx % 4];

                return (
                  <div key={report.id} className="flex items-center justify-between bg-white rounded-2xl border-2 border-slate-50 p-5 hover:shadow-md transition-shadow">
                    <div className="flex gap-4 items-center">
                      <div className={`size-12 rounded-2xl ${theme.icon} flex items-center justify-center`}>
                        <FileText size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-clevio-navy">Progress Report</h3>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1.5 text-sm font-bold text-slate-400">
                            <Calendar size={14} />
                            {new Date(report.generated_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${isSent ? 'bg-pastel-green text-clevio-green' : 'bg-slate-100 text-slate-400'
                            }`}>
                            {isSent ? <CheckCircle size={12} /> : <Clock size={12} />}
                            {isSent ? 'Terkirim' : 'Diproses'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={report.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl ${theme.btn} text-white font-black text-sm shadow-md hover:scale-105 transition-all no-underline`}
                    >
                      <Download size={18} /> Unduh PDF
                    </a>
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
