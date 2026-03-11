import type { CoachLeaveRequestWithRelations } from '@/lib/dao/coachLeaveDao';

type Props = {
  requests: CoachLeaveRequestWithRelations[];
};

function getStatusConfig(status: string) {
  switch (status) {
    case 'APPROVED':
      return {
        icon: 'check',
        borderColor: 'border-emerald-500',
        iconColor: 'text-emerald-500',
        badge: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        label: 'DISETUJUI',
      };
    case 'REJECTED':
      return {
        icon: 'close',
        borderColor: 'border-red-500',
        iconColor: 'text-red-500',
        badge: 'bg-red-50 text-red-600 border-red-100',
        label: 'DITOLAK',
      };
    default: // PENDING
      return {
        icon: 'hourglass_empty',
        borderColor: 'border-amber-500',
        iconColor: 'text-amber-500',
        badge: 'bg-amber-50 text-amber-600 border-amber-100',
        label: 'MENUNGGU',
      };
  }
}

export default function LeaveRequestTable({ requests }: Props) {
  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center shadow-sm">
        <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">event_busy</span>
        <h3 className="text-sm font-medium text-slate-900">Belum ada riwayat</h3>
        <p className="text-slate-400 text-xs mt-1">Riwayat pengajuan izin akan muncul di sini.</p>
      </div>
    );
  }

  // group by month+year
  const grouped = new Map<string, CoachLeaveRequestWithRelations[]>();
  for (const req of requests) {
    const date = req.session?.date_time ? new Date(req.session.date_time) : new Date(req.created_at);
    const key = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(req);
  }

  return (
    <div className="space-y-10">
      {Array.from(grouped.entries()).map(([month, items]) => (
        <div key={month}>
          <h3 className="text-slate-900 font-bold flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-slate-400">calendar_month</span>
            {month}
          </h3>

          {/* Timeline */}
          <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:w-0.5 before:h-full before:bg-slate-200">
            {items.map((request) => {
              const cfg = getStatusConfig(request.status);
              const sessionDate = request.session?.date_time
                ? new Date(request.session.date_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';
              const createdAt = new Date(request.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
              const className = request.class?.name ?? '—';

              return (
                <div key={request.id} className="relative pl-12 pb-8 group">
                  {/* Timeline Dot */}
                  <div className={`absolute left-0 mt-1 w-10 h-10 flex items-center justify-center bg-white rounded-full border-4 ${cfg.borderColor} z-10 shadow-sm transition-transform group-hover:scale-110`}>
                    <span className={`material-symbols-outlined ${cfg.iconColor} text-xl font-bold`}>{cfg.icon}</span>
                  </div>

                  {/* Card */}
                  <div className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow ${request.status === 'REJECTED' ? '' : 'flex items-center justify-between'}`}>
                    {request.status === 'REJECTED' ? (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="text-slate-900 font-bold text-lg leading-none">{className}</h4>
                              <span className="text-xs font-medium text-slate-400">• Diajukan {createdAt}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-4 items-center">
                              <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                                <span className="material-symbols-outlined text-base">event</span>
                                <span className="text-sm font-semibold">{sessionDate}</span>
                              </div>
                              {request.note && (
                                <p className="text-slate-500 text-sm italic truncate max-w-md">"{request.note}"</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${cfg.badge}`}>
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                        {/* Rejection reason */}
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 mt-2">
                          <span className="material-symbols-outlined text-red-500 text-xl mt-0.5">info</span>
                          <div>
                            <p className="text-xs font-bold text-red-700 uppercase mb-1">Alasan Penolakan:</p>
                            <p className="text-sm text-red-600 leading-relaxed">
                              {(request as any).rejection_reason ?? 'Pengajuan tidak dapat dikabulkan. Silakan hubungi admin untuk keterangan lebih lanjut.'}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="text-slate-900 font-bold text-lg leading-none">{className}</h4>
                            <span className="text-xs font-medium text-slate-400">• Diajukan {createdAt}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                              <span className="material-symbols-outlined text-base">event</span>
                              <span className="text-sm font-semibold">{sessionDate}</span>
                            </div>
                            {request.note && (
                              <p className="text-slate-500 text-sm italic truncate max-w-md">"{request.note}"</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                          {request.substitute && (
                            <p className="text-[10px] text-slate-400 mt-1">Pengganti: {request.substitute.full_name}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
