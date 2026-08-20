import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowRight, Clock, FileCheck2, Send, Users } from 'lucide-react';
import Link from 'next/link';

import PageHead from '@/components/admin/PageHead';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listTrialAssessmentsForAdmin } from '@/lib/dao/trialAssessmentsDao';
import type { TrialAssessmentRecord } from '@/lib/dao/trialAssessmentsDao';
import { isTrialAssessmentSubmitted } from '@/lib/services/trialLifecycle';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<TrialAssessmentRecord['status'], string> = {
  DRAFT: 'Draft coach',
  PENDING_ADMIN_REVIEW: 'Perlu review',
  APPROVED: 'Disetujui',
  PUBLISHED: 'Report terkirim',
  REGISTRATION_STARTED: 'Daftar dimulai',
  INVOICE_CREATED: 'Invoice dibuat',
  PAYMENT_PENDING: 'Menunggu bayar',
  PAID: 'Lunas',
  CONVERTED: 'Converted',
};

const STATUS_STYLES: Record<TrialAssessmentRecord['status'], string> = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-700',
  PENDING_ADMIN_REVIEW: 'border-amber-200 bg-amber-50 text-amber-800',
  APPROVED: 'border-sky-200 bg-sky-50 text-sky-800',
  PUBLISHED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  REGISTRATION_STARTED: 'border-blue-200 bg-blue-50 text-blue-800',
  INVOICE_CREATED: 'border-violet-200 bg-violet-50 text-violet-800',
  PAYMENT_PENDING: 'border-orange-200 bg-orange-50 text-orange-800',
  PAID: 'border-green-200 bg-green-50 text-green-800',
  CONVERTED: 'border-lime-200 bg-lime-50 text-lime-800',
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return format(new Date(value), 'd MMM yyyy, HH.mm', { locale: localeId });
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export default async function AdminTrialAssessmentsPage() {
  const assessments = await listTrialAssessmentsForAdmin();
  const submittedAssessments = assessments.filter((item) => isTrialAssessmentSubmitted(item.status));
  const reviewQueue = submittedAssessments.filter((item) => item.status === 'PENDING_ADMIN_REVIEW');
  const pending = reviewQueue.length;
  const published = submittedAssessments.filter((item) => item.status === 'PUBLISHED' || item.status === 'INVOICE_CREATED').length;
  const converted = submittedAssessments.filter((item) => item.invoice?.status === 'PAID').length;

  return (
    <div className="admin-page-stack">
      <PageHead
        title="Review Trial"
        desc="Review assessment coach, publish parent trial report, dan lanjutkan conversion ke Weekly Class."
      />

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat label="Total assessment" value={submittedAssessments.length} icon={<Users size={16} />} />
        <Stat label="Perlu review" value={pending} icon={<Clock size={16} />} />
        <Stat label="Report terkirim" value={published} icon={<Send size={16} />} />
        <Stat label="Sudah bayar / daftar" value={converted} icon={<FileCheck2 size={16} />} />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Trial assessment queue</CardTitle>
          <CardDescription>{reviewQueue.length} assessment coach yang sudah dinilai siap direview.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Peserta</TableHead>
                <TableHead>Coach</TableHead>
                <TableHead>Trial</TableHead>
                <TableHead>Rekomendasi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="pr-6 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewQueue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Belum ada assessment trial yang sudah dinilai coach.
                  </TableCell>
                </TableRow>
              ) : reviewQueue.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-6">
                    <div className="min-w-48">
                      <strong className="font-semibold text-foreground">{item.trial?.student_name ?? '-'}</strong>
                      <p className="text-xs text-muted-foreground">{item.trial?.parent_name ?? '-'} · {item.trial?.phone ?? '-'}</p>
                    </div>
                  </TableCell>
                  <TableCell>{item.coach?.full_name ?? '-'}</TableCell>
                  <TableCell>
                    <div className="min-w-40 text-sm">
                      <strong>{formatDateTime(item.trial?.scheduled_at ?? null)} WIB</strong>
                      <p className="text-xs text-muted-foreground">{item.trial?.trial_mode ?? '-'} · {item.trial?.student_grade ?? '-'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-44 text-sm">
                      <strong>{item.recommended_class?.name ?? '-'}</strong>
                      <p className="text-xs text-muted-foreground">{item.recommended_level?.name ?? '-'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_STYLES[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {item.invoice ? (
                      <div className="text-sm">
                        <strong>{item.invoice.invoice_number}</strong>
                        <p className="text-xs text-muted-foreground">{item.invoice.status}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button asChild size="sm" variant={item.status === 'PENDING_ADMIN_REVIEW' ? 'default' : 'outline'}>
                      <Link href={`/admin/trial-assessments/${item.id}`}>
                        Review <ArrowRight />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
