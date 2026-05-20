'use client';

import { useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE';

interface Attendee {
  coderId: string;
  fullName: string;
  attendance: {
    status: AttendanceStatus;
    reason: string | null;
  } | null;
}

interface AttendanceListProps {
  sessionId: string;
  attendees: Attendee[];
}

export type AttendanceListHandle = {
  save: () => Promise<void>;
  isSaving: boolean;
};

type RecordState = {
  coderId: string;
  fullName: string;
  status: AttendanceStatus | null;
  reason: string;
  dirty: boolean;
};

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-600',
  'bg-emerald-100 text-emerald-600',
  'bg-amber-100 text-amber-600',
  'bg-rose-100 text-rose-600',
  'bg-cyan-100 text-cyan-600',
  'bg-fuchsia-100 text-fuchsia-600',
  'bg-violet-100 text-violet-600',
  'bg-orange-100 text-orange-600',
];

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

// Helper to determine the UI state from db status + reason
function getUiState(status: AttendanceStatus | null, reason: string | null) {
  if (status === 'PRESENT') return 'HADIR';
  // ABSENT with specific reasons (Izin / Sakit saved as ABSENT since DB only has 2 enums)
  if (status === 'ABSENT' && reason === 'Izin') return 'IZIN';
  if (status === 'ABSENT' && reason === 'Sakit') return 'SAKIT';
  if (status === 'ABSENT') return 'ALPHA'; // fallback: no reason or reason='Alpha'
  // Legacy EXCUSED support (in case old records exist)
  if (status === 'EXCUSED' && reason === 'Izin') return 'IZIN';
  if (status === 'EXCUSED' && reason === 'Sakit') return 'SAKIT';
  if (status === 'EXCUSED') return 'IZIN';
  return null;
}

// Get status badge coloring for each option
const STATUS_STYLES: Record<string, { active: string; inactive: string }> = {
  HADIR: {
    active: 'bg-emerald-500 text-white',
    inactive: 'text-slate-500 hover:bg-white',
  },
  IZIN: {
    active: 'bg-blue-500 text-white',
    inactive: 'text-slate-500 hover:bg-white',
  },
  SAKIT: {
    active: 'bg-orange-500 text-white',
    inactive: 'text-slate-500 hover:bg-white',
  },
  ALPHA: {
    active: 'bg-red-500 text-white',
    inactive: 'text-slate-500 hover:bg-white',
  },
};

const AttendanceList = forwardRef<AttendanceListHandle, AttendanceListProps>(
  function AttendanceList({ sessionId, attendees }, ref) {
    const router = useRouter();
    const [records, setRecords] = useState<RecordState[]>(() =>
      attendees.map((a) => ({
        coderId: a.coderId,
        fullName: a.fullName,
        status: a.attendance?.status ?? null,
        reason: a.attendance?.reason ?? '',
        dirty: false,
      }))
    );
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const mark = useCallback((coderId: string, status: AttendanceStatus, reason = '') => {
      setRecords((prev) =>
        prev.map((r) => (r.coderId === coderId ? { ...r, status, reason, dirty: true } : r))
      );
      setSaveSuccess(false);
    }, []);

    const save = useCallback(async () => {
      const missing = records.filter((r) => r.status === null);
      if (missing.length > 0) {
        const message = `Lengkapi presensi ${missing.length} coder dulu.`;
        setErrorMessage(message);
        throw new Error(message);
      }

      const dirty = records.filter((r) => r.dirty && r.status !== null);
      if (dirty.length === 0) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        return;
      }
      setErrorMessage(null);

      setIsSaving(true);
      try {
        await Promise.all(
          dirty.map((r) =>
            fetch('/api/coach/attendance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                coderId: r.coderId,
                status: r.status,
                reason: r.reason.trim(),
              }),
            }).then((res) => {
              if (!res.ok) throw new Error(`Failed for ${r.fullName}`);
              return res;
            })
          )
        );

        setRecords((prev) => prev.map((r) => ({ ...r, dirty: false })));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal menyimpan presensi.';
        setErrorMessage(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    }, [records, sessionId, router]);

    // Expose save fn to parent via ref
    useImperativeHandle(ref, () => ({ save, isSaving }), [save, isSaving]);

    const dirtyCount = records.filter((r) => r.dirty).length;

    return (
      <div className="space-y-3">
        {/* Toast notifications */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium text-center">
            {errorMessage}
          </div>
        )}
        {saveSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium text-center flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-base">task_alt</span>
            Presensi berhasil disimpan!
          </div>
        )}
        {dirtyCount > 0 && !saveSuccess && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-medium text-center">
            {dirtyCount} perubahan belum disimpan. Klik &ldquo;Simpan Presensi&rdquo; di bawah.
          </div>
        )}

        {/* Student rows */}
        {records.map((record, idx) => {
          const uiState = getUiState(record.status, record.reason);
          const needsMakeUp = uiState !== null && uiState !== 'HADIR';

          let wrapperClass =
            'rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 sm:gap-6 border transition-all ';
          if (uiState !== null) {
            // All marked students get a light teal/emerald background
            wrapperClass += 'border-emerald-100 bg-emerald-50/60';
          } else {
            wrapperClass += 'bg-white border-slate-200 hover:border-slate-300 shadow-sm';
          }

          return (
            <div key={record.coderId} className={wrapperClass}>
              {/* Avatar + Name */}
              <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-bold text-base sm:text-lg shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}
                >
                  {getInitials(record.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{record.fullName}</p>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider mt-0.5">
                    Coder ID: {record.coderId.split('-')[0].toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Segmented Controls */}
              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                {(['HADIR', 'IZIN', 'SAKIT', 'ALPHA'] as const).map((option) => {
                  const isActive = uiState === option;
                  return (
                    <button
                      key={option}
                      onClick={() => {
                        const statusMap: Record<string, { status: AttendanceStatus; reason: string }> = {
                          HADIR: { status: 'PRESENT', reason: '' },
                          IZIN: { status: 'ABSENT', reason: 'Izin' },
                          SAKIT: { status: 'ABSENT', reason: 'Sakit' },
                          ALPHA: { status: 'ABSENT', reason: 'Alpha' },
                        };
                        const { status, reason } = statusMap[option];
                        mark(record.coderId, status, reason);
                      }}
                      className={`px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all whitespace-nowrap ${isActive ? STATUS_STYLES[option].active : STATUS_STYLES[option].inactive}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {/* Make-Up badge — visible only for absent/excused, no toggle */}
              <div
                className={`hidden sm:flex items-center gap-2 min-w-[130px] justify-end ${!needsMakeUp ? 'opacity-30 pointer-events-none' : ''}`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${needsMakeUp ? 'text-emerald-600' : 'text-slate-400'}`}>
                  Make-Up Task
                </span>
                {needsMakeUp ? (
                  <div className="w-10 h-5 bg-emerald-500 rounded-full relative shrink-0">
                    <div className="absolute right-0.5 top-[2px] w-4 h-4 bg-white rounded-full" />
                  </div>
                ) : (
                  <div className="w-10 h-5 bg-slate-200 rounded-full relative shrink-0">
                    <div className="absolute left-0.5 top-[2px] w-4 h-4 bg-white rounded-full" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);

export default AttendanceList;
