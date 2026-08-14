'use client';

import {
  Ban,
  CalendarPlus,
  Check,
  CircleX,
  Copy,
  MessageCircle,
  Search,
  Trash2,
  Video,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { OFFLINE_TRIAL_ADDRESS, OFFLINE_TRIAL_SCHEDULE } from '@/lib/validation/trialClass';
import type { Database } from '@/types/supabase';

type TrialClassSubmission = Database['public']['Tables']['trial_class_submissions']['Row'] & {
  coach: { id: string; full_name: string; username: string } | null;
};
type CoachOption = { id: string; name: string };
type TerminalStatus = 'CANCELLED' | 'FAILED';

const STATUS_LABELS: Record<TrialClassSubmission['status'], string> = {
  PENDING: 'Menunggu',
  SCHEDULED: 'Terjadwal',
  CANCELLED: 'Dibatalkan',
  FAILED: 'Gagal',
};

const STATUS_STYLES: Record<TrialClassSubmission['status'], string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-800',
  SCHEDULED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  CANCELLED: 'border-slate-200 bg-slate-100 text-slate-700',
  FAILED: 'border-red-200 bg-red-50 text-red-700',
};

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function displayPhone(value: string) {
  return value.startsWith('62') ? `+${value}` : value;
}

function toDateTimeLocal(value?: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  if (!value) {
    date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  }
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function minDateTimeLocal() {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

export default function TrialClassTable({
  submissions,
  coaches,
  googleCalendarConfigured,
}: {
  submissions: TrialClassSubmission[];
  coaches: CoachOption[];
  googleCalendarConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [assignTarget, setAssignTarget] = useState<TrialClassSubmission | null>(null);
  const [terminalTarget, setTerminalTarget] = useState<TrialClassSubmission | null>(null);
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatus>('CANCELLED');
  const [scheduledAt, setScheduledAt] = useState('');
  const [coachId, setCoachId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return submissions;
    return submissions.filter((item) =>
      [
        item.student_name,
        item.student_grade,
        item.school_name,
        item.parent_name,
        item.phone,
        item.email,
        item.trial_mode,
        item.notes ?? '',
        item.coach?.full_name ?? '',
        STATUS_LABELS[item.status],
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery, submissions]);

  function openAssign(item: TrialClassSubmission) {
    setAssignTarget(item);
    setScheduledAt(toDateTimeLocal(item.scheduled_at));
    setCoachId(item.coach_id ?? '');
    setDurationMinutes(String(item.duration_minutes || 60));
    setError(null);
  }

  function openTerminal(item: TrialClassSubmission, status: TerminalStatus) {
    setTerminalTarget(item);
    setTerminalStatus(status);
    setReason('');
    setError(null);
  }

  function submitAssign() {
    if (!assignTarget || !scheduledAt || !coachId) {
      setError('Tanggal, jam, dan coach wajib dipilih.');
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch(`/api/admin/free-trials/${assignTarget.id}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coachId,
            scheduledAt: new Date(scheduledAt).toISOString(),
            durationMinutes: Number(durationMinutes),
          }),
        });
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) {
          setError(payload?.error || 'Gagal menjadwalkan trial.');
          return;
        }
        setAssignTarget(null);
        router.refresh();
      } catch {
        setError('Koneksi terputus. Silakan coba lagi.');
      }
    });
  }

  function submitTerminalStatus() {
    if (!terminalTarget || reason.trim().length < 5) {
      setError('Alasan wajib diisi minimal 5 karakter.');
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch(`/api/admin/free-trials/${terminalTarget.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: terminalStatus, reason: reason.trim() }),
        });
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) {
          setError(payload?.error || 'Gagal memperbarui status trial.');
          return;
        }
        setTerminalTarget(null);
        router.refresh();
      } catch {
        setError('Koneksi terputus. Silakan coba lagi.');
      }
    });
  }

  function deleteTrial(item: TrialClassSubmission) {
    if (!window.confirm(`Hapus data trial ${item.student_name}? Tindakan ini tidak dapat dibatalkan.`)) return;

    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch(`/api/admin/free-trials/${item.id}`, { method: 'DELETE' });
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) {
          setError(payload?.error || 'Gagal menghapus trial.');
          return;
        }
        router.refresh();
      } catch {
        setError('Koneksi terputus. Silakan coba lagi.');
      }
    });
  }

  async function copyMeetLink(item: TrialClassSubmission) {
    if (!item.google_meet_url) return;
    await navigator.clipboard.writeText(item.google_meet_url);
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>Trial management</CardTitle>
              <CardDescription>{filtered.length} dari {submissions.length} pendaftar ditampilkan.</CardDescription>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="trial-search" className="sr-only">Cari data free trial</label>
              <Input
                id="trial-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari peserta, coach, status, atau kontak"
                className="pl-9"
              />
            </div>
          </div>
          {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Masuk</TableHead>
                <TableHead>Anak</TableHead>
                <TableHead>Orang tua</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-64">Jadwal & coach</TableHead>
                <TableHead className="min-w-56">Catatan</TableHead>
                <TableHead className="pr-6 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    {submissions.length === 0 ? 'Belum ada pendaftar free trial.' : 'Data yang dicari tidak ditemukan.'}
                  </TableCell>
                </TableRow>
              ) : filtered.map((item) => {
                const isTerminal = item.status === 'CANCELLED' || item.status === 'FAILED';
                return (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap pl-6 text-xs text-muted-foreground">
                      {formatSubmittedAt(item.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-40 flex-col gap-1.5">
                        <strong className="font-semibold text-foreground">{item.student_name}</strong>
                        <span className="text-xs text-muted-foreground">{item.school_name}</span>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{item.student_grade}</Badge>
                          <Badge variant={item.trial_mode === 'OFFLINE' ? 'default' : 'secondary'}>
                            {item.trial_mode === 'OFFLINE' ? 'Offline' : 'Online'}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-48 flex-col gap-1 text-sm">
                        <strong className="font-medium">{item.parent_name}</strong>
                        <a className="text-muted-foreground hover:text-foreground hover:underline" href={`tel:+${item.phone}`}>
                          {displayPhone(item.phone)}
                        </a>
                        <span className="text-xs text-muted-foreground">{item.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm">
                      {item.status === 'SCHEDULED' && item.scheduled_at ? (
                        <div className="flex min-w-56 flex-col gap-1.5">
                          <strong>{formatSubmittedAt(item.scheduled_at)} WIB</strong>
                          <span className="text-muted-foreground">{item.coach?.full_name || 'Coach belum tersedia'} · {item.duration_minutes} menit</span>
                          {item.google_meet_url ? (
                            <div className="flex items-center gap-1">
                              <Button asChild size="sm" variant="outline">
                                <a href={item.google_meet_url} target="_blank" rel="noopener noreferrer"><Video /> Buka Meet</a>
                              </Button>
                              <Button size="icon" variant="ghost" title="Salin link Google Meet" onClick={() => copyMeetLink(item)}>
                                {copiedId === item.id ? <Check /> : <Copy />}
                              </Button>
                            </div>
                          ) : item.trial_mode === 'OFFLINE' ? (
                            <span className="text-xs text-muted-foreground">Trial offline, tanpa Google Meet.</span>
                          ) : null}
                        </div>
                      ) : isTerminal ? (
                        <div className="max-w-64 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Alasan:</span> {item.status_reason || '-'}
                        </div>
                      ) : (
                        <span className="text-sm text-amber-700">Belum dijadwalkan</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        <span>{item.trial_mode === 'OFFLINE' ? OFFLINE_TRIAL_SCHEDULE : item.notes || '-'}</span>
                        {item.trial_mode === 'OFFLINE' ? <span className="text-xs leading-5">{OFFLINE_TRIAL_ADDRESS}</span> : null}
                        {item.trial_mode === 'OFFLINE' && item.notes ? <span className="text-xs leading-5">Catatan: {item.notes}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex min-w-40 justify-end gap-1">
                        <Button asChild size="icon" variant="ghost" title="Hubungi via WhatsApp">
                          <a href={`https://wa.me/${item.phone}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${item.parent_name}`}>
                            <MessageCircle />
                          </a>
                        </Button>
                        {!isTerminal ? (
                          <Button size="icon" variant="ghost" title={item.status === 'SCHEDULED' ? 'Ubah coach atau jadwal' : 'Assign coach dan jadwal'} onClick={() => openAssign(item)}>
                            <CalendarPlus />
                          </Button>
                        ) : null}
                        {item.status === 'SCHEDULED' ? (
                          <>
                            <Button size="icon" variant="ghost" title="Batalkan trial" onClick={() => openTerminal(item, 'CANCELLED')}>
                              <Ban />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-red-600 hover:text-red-700" title="Tandai gagal" onClick={() => openTerminal(item, 'FAILED')}>
                              <CircleX />
                            </Button>
                          </>
                        ) : null}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          title="Hapus trial"
                          aria-label={`Hapus trial ${item.student_name}`}
                          onClick={() => deleteTrial(item)}
                          disabled={isPending}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(assignTarget)} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{assignTarget?.status === 'SCHEDULED' ? 'Ubah jadwal trial' : 'Assign trial ke coach'}</DialogTitle>
            <DialogDescription>
              Tentukan jadwal terlebih dahulu, lalu pilih coach untuk {assignTarget?.student_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-2">
              <Label htmlFor="trial-scheduled-at">Tanggal & jam (WIB)</Label>
              <Input
                id="trial-scheduled-at"
                type="datetime-local"
                min={minDateTimeLocal()}
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Coach</Label>
              <Select value={coachId} onValueChange={setCoachId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pilih coach aktif" /></SelectTrigger>
                <SelectContent>
                  {coaches.map((coach) => <SelectItem key={coach.id} value={coach.id}>{coach.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="trial-duration">Durasi (menit)</Label>
              <Input
                id="trial-duration"
                type="number"
                min={30}
                max={180}
                step={15}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              />
            </div>
            {assignTarget?.trial_mode === 'ONLINE' && !googleCalendarConfigured ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Google Calendar belum dikonfigurasi di server. Assign online dinonaktifkan agar tidak tersimpan tanpa link Meet.
              </p>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)} disabled={isPending}>Tutup</Button>
            <Button
              onClick={submitAssign}
              disabled={isPending || !scheduledAt || !coachId || (assignTarget?.trial_mode === 'ONLINE' && !googleCalendarConfigured)}
            >
              <CalendarPlus /> {isPending ? 'Memproses...' : assignTarget?.trial_mode === 'ONLINE' ? 'Simpan & buat Meet' : 'Simpan jadwal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(terminalTarget)} onOpenChange={(open) => !open && setTerminalTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{terminalStatus === 'CANCELLED' ? 'Batalkan trial' : 'Tandai trial gagal'}</DialogTitle>
            <DialogDescription>
              Status ini menandakan trial {terminalTarget?.student_name} tidak dapat dilanjutkan. Alasan wajib dicatat.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-1">
            <Label htmlFor="trial-terminal-reason">Alasan</Label>
            <Textarea
              id="trial-terminal-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={terminalStatus === 'CANCELLED' ? 'Contoh: Orang tua membatalkan jadwal trial.' : 'Contoh: Peserta tidak dapat dihubungi setelah konfirmasi.'}
              maxLength={1000}
              rows={4}
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminalTarget(null)} disabled={isPending}>Tutup</Button>
            <Button variant="destructive" onClick={submitTerminalStatus} disabled={isPending || reason.trim().length < 5}>
              {terminalStatus === 'CANCELLED' ? <Ban /> : <CircleX />}
              {isPending ? 'Memproses...' : terminalStatus === 'CANCELLED' ? 'Batalkan trial' : 'Tandai gagal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
