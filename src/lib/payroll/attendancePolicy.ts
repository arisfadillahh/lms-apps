import type { PeriodDocument } from './model';
import { latestLegacySnapshot } from './legacyImport.ts';

/** Prospective cutover; pre-existing payroll and final archives stay intact. */
export const STUDENT_ATTENDANCE_FROM = '2026-11-12T00:00:00+07:00';

export function applyAttendancePolicy(period: PeriodDocument, now = new Date()): PeriodDocument {
  const next=structuredClone(period);
  if(next.status!=='DRAFT' || Date.parse(next.ends_at)<=Date.parse(STUDENT_ATTENDANCE_FROM))return next;
  if(!next.class_attendance_from)next.class_attendance_from=STUDENT_ATTENDANCE_FROM;
  const cutoff=Date.parse(next.class_attendance_from);
  const beforeCutoff=now.getTime()<cutoff;
  if(next.legacy_imports?.length && (beforeCutoff || !next.legacy_class_baseline)){
    const snapshot=latestLegacySnapshot(next.legacy_imports);
    if(!snapshot)throw new Error('Baseline kelas belum tersedia.');
    if(Date.parse(snapshot.capturedAt)>=cutoff || !beforeCutoff)throw new Error('Baseline sebelum perubahan absensi belum tersimpan. Hubungi admin sebelum menghitung ulang.');
    if(!next.legacy_class_baseline || Date.parse(snapshot.capturedAt)>Date.parse(next.legacy_class_baseline.capturedAt)){
      next.legacy_class_baseline=structuredClone(snapshot);
    }
  }
  return next;
}
