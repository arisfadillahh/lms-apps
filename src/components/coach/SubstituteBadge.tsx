import { ArrowLeftRight, UserRound } from 'lucide-react';

export default function SubstituteBadge({ coachName }: { coachName?: string }) {
  const name = coachName?.replace(/^coach\s+/i, '').trim() || 'Belum ditentukan';
  return (
    <div className="my-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
        <ArrowLeftRight size={14} aria-hidden="true" /> Pengganti
      </span>
      <span className="h-4 w-px bg-slate-300" aria-hidden="true" />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">
        <UserRound size={14} aria-hidden="true" /> {name}
      </span>
    </div>
  );
}
