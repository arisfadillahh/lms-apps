import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CoachLeaveRequestWithRelations } from '@/lib/dao/coachLeaveDao';
import { cn } from '@/lib/utils';
import { Clock, User, MessageSquare, CalendarCheck } from 'lucide-react';

type LeaveRequestTableProps = {
  requests: CoachLeaveRequestWithRelations[];
};

export default function LeaveRequestTable({ requests }: LeaveRequestTableProps) {
  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 border-dashed p-10 text-center">
        <div className="mx-auto h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
          <CalendarCheck className="h-6 w-6 text-slate-300" />
        </div>
        <h3 className="text-sm font-medium text-slate-900">Belum ada riwayat</h3>
        <p className="text-slate-500 text-xs mt-1">Riwayat pengajuan izin akan muncul di sini.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-[180px] pl-6 font-semibold text-slate-700">Tanggal</TableHead>
              <TableHead className="font-semibold text-slate-700">Kelas</TableHead>
              <TableHead className="w-[140px] font-semibold text-slate-700">Status</TableHead>
              <TableHead className="hidden md:table-cell font-semibold text-slate-700">Pengganti</TableHead>
              <TableHead className="hidden lg:table-cell font-semibold text-slate-700">Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                <TableCell className="pl-6 py-4 align-top">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 text-sm">
                      {request.session ? new Date(request.session.date_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                    <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                      <Clock className="w-3 h-3" />
                      {request.session ? new Date(request.session.date_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-4 align-top">
                  <div className="font-medium text-slate-800 text-sm">{request.class?.name ?? '—'}</div>
                </TableCell>
                <TableCell className="py-4 align-top">
                  <StatusBadge status={request.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell py-4 align-top">
                  {request.substitute ? (
                    <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded-md w-fit">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[100px]">{request.substitute.full_name}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs italic">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell py-4 align-top">
                  {request.note ? (
                    <div className="flex gap-2 items-start max-w-[200px]">
                      <MessageSquare className="w-3 h-3 text-slate-300 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-500 line-clamp-2" title={request.note}>{request.note}</p>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let className = "";
  let label = status;

  switch (status) {
    case 'APPROVED':
      className = "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100";
      label = "Disetujui";
      break;
    case 'REJECTED':
      className = "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100";
      label = "Ditolak";
      break;
    case 'PENDING':
      className = "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100";
      label = "Menunggu";
      break;
    default:
      className = "bg-slate-100 text-slate-600 border-slate-200";
      break;
  }

  return (
    <Badge variant="outline" className={cn("font-medium border shadow-sm", className)}>
      {label}
    </Badge>
  );
}
