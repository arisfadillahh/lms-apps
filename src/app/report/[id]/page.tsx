import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import { Sparkles, User, Calendar, ClipboardList, MessageSquare } from 'lucide-react';
import DownloadPdfButton from './DownloadPdfButton';

const getGrade = (score: number) => {
  if (score >= 8.5) return 'A';
  if (score >= 7.0) return 'B';
  if (score >= 5.5) return 'C';
  return 'D';
};

const getGradeColor = (score: number) => {
  if (score >= 8.5) return '#16a34a';
  if (score >= 7.0) return '#2563eb';
  if (score >= 5.5) return '#d97706';
  return '#dc2626';
};

const getBarColor = (score: number) => {
  if (score >= 8) return '#10b981';
  if (score >= 6) return '#f59e0b';
  return '#ef4444';
};

export default async function PublicReportView({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const supabase = getSupabaseAdmin();

  const { data: report, error } = await supabase
    .from('block_reports')
    .select(`
      *,
      class:classes(id, name, type, level:levels(name), coach:users!classes_coach_id_fkey(full_name)),
      block:blocks(name),
      coder:users!block_reports_coder_id_fkey(full_name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('[PublicReportView] Supabase Error:', error);
    return notFound();
  }

  const isPublished = report.status === 'PUBLISHED';
  if (!isPublished) {
    const { getSessionOrThrow } = await import('@/lib/auth');
    try {
      const session = await getSessionOrThrow();
      const role = session.user.role;
      if (role !== 'ADMIN' && role !== 'COACH') return notFound();
    } catch {
      return notFound();
    }
  }

  const klass = Array.isArray(report.class) ? report.class[0] : report.class;
  const block = Array.isArray(report.block) ? report.block[0] : report.block;
  const coder = Array.isArray(report.coder) ? report.coder[0] : report.coder;
  const coach = klass?.coach ? (Array.isArray(klass.coach) ? klass.coach[0] : klass.coach) : null;

  const [{ data: evalCriteria }, { data: lessonTemplates }] = await Promise.all([
    supabase.from('evaluation_criteria').select('*').order('order_index'),
    supabase.from('lesson_templates').select('title, order_index').eq('block_id', report.block_id).order('order_index'),
  ]);

  // Fetch block evaluation (reflection) submitted by the coder for this block
  let blockEvaluation: { answers: Record<string, string> } | null = null;
  let evalQuestions: { id: string; question: string }[] = [];
  try {
    const { data: evalData } = await (supabase as any)
      .from('block_evaluations')
      .select('answers')
      .eq('coder_id', report.coder_id)
      .eq('block_id', report.block_id)
      .maybeSingle();
    if (evalData) blockEvaluation = evalData as any;

    // Try to fetch the evaluation template for this block to get actual questions
    const { data: evalSession } = await (supabase as any)
      .from('block_evaluation_sessions')
      .select('template_id')
      .eq('block_id', report.block_id)
      .limit(1)
      .maybeSingle();

    if (evalSession?.template_id) {
      const { data: tmpl } = await (supabase as any)
        .from('block_evaluation_templates')
        .select('questions')
        .eq('id', evalSession.template_id)
        .single();
      if (tmpl?.questions) {
        const qs = typeof tmpl.questions === 'string' ? JSON.parse(tmpl.questions) : tmpl.questions;
        evalQuestions = qs.map((q: any) => ({ id: q.id, question: q.question }));
      }
    }

    // Fallback to hardcoded if no template found
    if (evalQuestions.length === 0) {
      evalQuestions = [
        { id: 'q1', question: 'Apa hal baru yang paling kamu sukai dari block ini?' },
        { id: 'q2', question: 'Di bagian mana kamu merasa paling kesulitan?' },
        { id: 'q3', question: 'Apa yang sudah berhasil kamu buat atau selesaikan di block ini?' },
        { id: 'q4', question: 'Apa yang ingin kamu coba pelajari lebih lanjut?' },
        { id: 'q5', question: 'Pesan untuk dirimu sendiri di block berikutnya:' },
      ];
    }
  } catch {
    // Table may not exist yet — gracefully ignore
  }


  const descriptionsData = await import('@/lib/dao/reportsDao').then(r => r.getBlockReportDescriptions(report.id));

  const breakdownData = evalCriteria?.map(c => {
    const desc = descriptionsData.find(d => d.criteria_id === c.id);
    return {
      name: c.name,
      average: Number((desc?.score || 0).toFixed(1)),
      description: desc?.description || '',
    };
  }) || [];

  const lessonTitles = (lessonTemplates || []).map(l => l.title);

  const pubDate = new Date(report.updated_at || report.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const avgScore = Number((report.average_score || 0).toFixed(1));
  const grade = report.grade || getGrade(avgScore);
  const gradeColor = getGradeColor(avgScore);
  const gradeMessage = avgScore >= 8.5 ? 'Excellent!' : avgScore >= 7.0 ? 'Good Job!' : avgScore >= 5.5 ? 'Keep Going!' : 'Keep Trying!';

  return (
    <div className="bg-slate-50 font-sans text-clevio-navy min-h-screen antialiased pb-20">
      <style>{`
        .glass-card {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .progress-glow {
            box-shadow: 0 0 15px rgba(94, 220, 139, 0.4);
        }
        .progress-glow-sky {
            box-shadow: 0 0 15px rgba(77, 166, 255, 0.4);
        }
        .progress-glow-coral {
            box-shadow: 0 0 15px rgba(255, 107, 132, 0.4);
        }
        .speech-bubble-left {
            position: relative;
            background: #FFFFFF;
            border-radius: 1.5rem;
        }
        .speech-bubble-left:after {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            width: 0;
            height: 0;
            border: 15px solid transparent;
            border-right-color: #FFFFFF;
            border-left: 0;
            margin-top: -15px;
            margin-left: -15px;
        }
        .speech-bubble-right {
            position: relative;
            background: #1E3A5F;
            color: white;
            border-radius: 1.5rem;
        }
        .speech-bubble-right:after {
            content: '';
            position: absolute;
            right: 0;
            top: 50%;
            width: 0;
            height: 0;
            border: 15px solid transparent;
            border-left-color: #1E3A5F;
            border-right: 0;
            margin-top: -15px;
            margin-right: -15px;
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .lesson-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.75rem;
        }

        @media print {
            body { 
                background: white !important; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
            }
            .glass-card, [data-purpose="grade-summary"] > div, [data-purpose="lesson-list"] > div, [data-purpose="reflection-qa"] > div {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
                box-shadow: none !important;
                border: 1px solid #e2e8f0 !important;
            }
            [data-purpose="student-hero"] {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
                box-shadow: none !important;
                border: 1px solid #e2e8f0 !important;
                margin-top: 0 !important;
                margin-bottom: 2rem !important;
            }
            .progress-glow, .progress-glow-sky, .progress-glow-coral {
                box-shadow: none !important;
            }
            circle.drop-shadow-\\[0_0_8px_rgba\\(94\\,220\\,139\\,0\\.5\\)\\] {
                filter: none !important;
            }
            .print\\:hidden { display: none !important; }
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            [data-purpose="grade-summary"] {
                margin-bottom: 2rem !important;
            }
            [data-purpose="lesson-list"], [data-purpose="reflection-qa"] {
                margin-top: 2rem !important;
            }
            /* Ensure text inside color blocks remains visible */
            [data-purpose="student-hero"] h1, 
            [data-purpose="student-hero"] p,
            [data-purpose="student-hero"] span {
                 /* Force text colors in header to stay as defined */
            }
        }
      `}</style>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 print:p-0 print:m-0 print:max-w-none">
        <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky to-blue-600 p-8 sm:p-12 shadow-2xl shadow-sky/30 mb-8 print:p-6 print:rounded-2xl print:shadow-none print:mb-4" data-purpose="student-hero">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-48 h-48 bg-sunshine/20 rounded-full blur-2xl"></div>
          
          <div className="relative flex flex-col md:flex-row items-center gap-8 print:gap-6">
            <div className="relative">
              <div className="w-32 h-32 sm:w-40 sm:h-40 print:w-24 print:h-24 rounded-3xl overflow-hidden border-4 border-white/40 shadow-xl bg-white flex items-center justify-center text-5xl print:text-4xl font-black text-slate-300">
                {coder?.full_name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="absolute -bottom-3 -right-3 bg-sunshine p-2 rounded-2xl shadow-lg print:hidden">
                <Sparkles className="text-clevio-navy" size={20} />
              </div>
            </div>
            
            <div className="text-center md:text-left text-white flex-1">
              <div className="inline-block px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-sm font-semibold mb-3 print:mb-2 tracking-wide uppercase">
                Block Performance Report
              </div>
              <h1 className="text-3xl sm:text-4xl print:text-2xl font-extrabold mb-2 print:mb-1">{coder?.full_name}</h1>
              <p className="text-xl print:text-lg opacity-90 font-medium mb-6 print:mb-3">{klass?.name} - {block?.name}</p>
              
              <div className="grid grid-cols-2 gap-4 text-sm sm:text-base max-w-md mx-auto md:mx-0">
                <div className="flex items-center gap-3 bg-black/10 rounded-2xl p-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <User size={16} className="text-white" />
                  </div>
                  <span>Coach: <span className="font-bold">{coach?.full_name ?? 'Clevio Coach'}</span></span>
                </div>
                <div className="flex items-center gap-3 bg-black/10 rounded-2xl p-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Calendar size={16} className="text-white" />
                  </div>
                  <span>{pubDate}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex flex-col gap-10 print:gap-4">

          {/* HORIZONTAL OVERALL GRADE CARD */}
          <section data-purpose="grade-summary" className="w-full mt-4 print:mt-0">
            <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-xl shadow-slate-200/60 border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12 print:flex-row print:justify-between print:items-center print:border-none print:shadow-none print:p-4 print:rounded-2xl print:bg-transparent">
              <div className="text-center md:text-left flex-1 print:text-left print:flex-1">
                <div className="inline-flex items-center gap-3 mb-4 print:mb-1">
                  <div className="bg-clevio-navy/10 p-2.5 rounded-xl text-clevio-navy print:hidden">
                    <Sparkles size={20} />
                  </div>
                  <h3 className="text-clevio-navy font-bold text-2xl tracking-tight print:text-lg">Overall Grade</h3>
                </div>
                <p className="text-slate-500 mb-6 max-w-sm mx-auto md:mx-0 leading-relaxed print:max-w-none print:text-xs print:mb-2">
                  Ringkasan nilai rata-rata dari seluruh kompetensi yang sudah diobservasi pada Blok kurikulum ini.
                </p>
                <div className="bg-slate-50 rounded-2xl px-6 py-4 font-extrabold inline-flex items-center justify-center md:justify-start gap-2 border border-slate-200/60 w-full md:w-auto shadow-sm print:shadow-none print:p-0 print:border-none print:bg-transparent print:text-sm" style={{ color: gradeColor }}>
                  {gradeMessage}
                </div>
              </div>

              <div className="relative w-48 h-48 shrink-0 print:w-20 print:h-20">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-slate-100 print:text-slate-200" cx="50" cy="50" fill="transparent" r="45" stroke="currentColor" strokeWidth="8"></circle>
                  <circle 
                    className="drop-shadow-[0_0_8px_rgba(94,220,139,0.5)] transition-all duration-1000 ease-out print:filter-none" 
                    style={{ stroke: gradeColor }}
                    cx="50" cy="50" fill="transparent" r="45" stroke="currentColor" 
                    strokeDasharray="282.7" 
                    strokeDashoffset={282.7 - (282.7 * (avgScore / 10))} 
                    strokeLinecap="round" strokeWidth="8">
                  </circle>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black text-clevio-navy drop-shadow-sm print:text-2xl print:drop-shadow-none">{Math.round(avgScore * 10)}</span>
                  <span className="font-bold text-xl mt-1 tracking-wide print:text-[10px] print:mt-0 print:tracking-normal" style={{ color: gradeColor }}>GRADE {grade}</span>
                </div>
              </div>
            </div>
          </section>
          <section data-purpose="competency-feedback">
            <div className="flex items-center gap-4 mb-8 print:mb-4">
              <div className="bg-sky/20 p-3 rounded-2xl text-sky print:hidden">
                <Sparkles size={22} />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-clevio-navy print:text-lg print:border-b print:border-slate-200 print:pb-1 print:inline-block">Kompetensi & Observasi</h3>
                <p className="text-slate-500 font-medium text-sm print:text-xs">Catatan perkembangan dari Coach</p>
              </div>
            </div>

            <div className="flex flex-col gap-6 print:gap-3">
            {breakdownData.map((item, idx) => {
               const pct = Math.round((item.average / 10) * 100);
               const themes = [
                 { bg: 'bg-sky', textContext: 'text-sky', glow: 'progress-glow-sky' },
                 { bg: 'bg-coral', textContext: 'text-coral', glow: 'progress-glow-coral' },
                 { bg: 'bg-clevio-green', textContext: 'text-clevio-green', glow: 'progress-glow' },
                 { bg: 'bg-amber-400', textContext: 'text-amber-500', glow: 'progress-glow' },
               ];
               const theme = themes[idx % themes.length];

               return (
                 <div key={idx} className="glass-card rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-200 bg-white print:p-4 print:rounded-2xl print:shadow-none print:break-inside-avoid">
                   <div className="flex justify-between items-end mb-4 print:mb-2">
                     <div>
                       <span className={`${theme.textContext} font-bold uppercase text-xs tracking-widest print:text-[10px]`}>Skill Area</span>
                       <h4 className="text-xl font-bold text-clevio-navy mt-1 pr-4 print:text-sm print:mt-0">{item.name}</h4>
                     </div>
                     <span className="text-clevio-navy font-black text-2xl print:text-xl">{pct}%</span>
                   </div>
                   <div className="w-full bg-slate-100 rounded-full h-3 mb-5 overflow-hidden print:h-2 print:mb-3">
                     <div className={`${theme.bg} h-full rounded-full ${theme.glow} print:shadow-none print:box-shadow-none`} style={{ width: `${pct}%` }}></div>
                   </div>
                   <p className="text-slate-600 text-sm leading-relaxed italic border-l-2 border-slate-200 pl-4 mt-2 print:text-xs print:pl-3 print:mt-1">
                     "{item.description || 'Tidak ada catatan khusus dari coach untuk poin ini.'}"
                   </p>
                 </div>
               );
            })}
            </div>
          </section>

          {lessonTitles.length > 0 && (
            <section className="lg:col-span-12 mt-4" data-purpose="lesson-list">
              <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-xl shadow-slate-200/60 border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-3 rounded-2xl text-slate-400">
                      <ClipboardList size={22} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-extrabold text-clevio-navy">Learning Journey</h3>
                      <p className="text-slate-500 font-medium text-sm">Completed {block?.name} Curriculum</p>
                    </div>
                  </div>
                </div>
                <div className="lesson-grid">
                  {lessonTitles.map((title, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-xs font-bold text-slate-400">{(idx + 1).toString().padStart(2, '0')}</span>
                      <span className="text-sm font-semibold text-clevio-navy line-clamp-2" title={title}>{title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {blockEvaluation && (() => {
            const answers = blockEvaluation!.answers as Record<string, string>;
            const allReflections = evalQuestions
              .filter(q => answers[q.id] && answers[q.id].trim())
              .map(q => ({ question: q.question, answer: answers[q.id] }));

            // Also capture any extra keys not in questions (just in case)
            const knownIds = new Set(evalQuestions.map(q => q.id));
            const extras = Object.entries(answers)
              .filter(([k, v]) => !knownIds.has(k) && v && v.trim())
              .map(([, v]) => ({ question: 'Refleksi Tambahan', answer: v }));

            const finalReflections = [...allReflections, ...extras];

            if (finalReflections.length === 0) return null;

            return (
              <section className="lg:col-span-12" data-purpose="reflection-qa">
                <div className="bg-sunshine/10 rounded-[2.5rem] p-8 sm:p-10 border-2 border-dashed border-sunshine/30">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="bg-sunshine p-3 rounded-2xl shadow-sm">
                      <MessageSquare size={22} className="text-clevio-navy" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-extrabold text-clevio-navy">Refleksi Coder</h3>
                      <p className="text-sm text-slate-500 font-medium">{coder?.full_name?.split(' ')[0]}&apos;s thoughts on this block</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {finalReflections.map((ref, idx) => (
                      <div key={idx} className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 w-8 h-8 rounded-xl bg-clevio-navy text-white flex items-center justify-center text-xs font-black">{idx + 1}</div>
                          <p className="text-slate-600 font-semibold text-sm pt-1.5">{ref.question}</p>
                        </div>
                        <div className="ml-11 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                          <p className="text-clevio-navy font-medium leading-relaxed">{ref.answer}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })()}
        </main>
        
        <footer className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center print:hidden" data-purpose="report-actions">
          <DownloadPdfButton />
        </footer>
      </div>
    </div>
  );
}
