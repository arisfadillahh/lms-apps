import 'server-only';
import { getPayrollConfig, ensurePayrollPeriod, getPayrollPeriod } from '@/lib/dao/payrollDao';
import { currentPeriod, wibDate, PayrollError } from '@/lib/payroll/model';
import { STUDENT_ATTENDANCE_FROM } from '@/lib/payroll/attendancePolicy';
import { calculatePayroll } from './payroll';
import { createAttendanceAdminNotifications } from './payrollNotifications';

const pending=new Map<string,Promise<void>>();
/** Completion hook; cron remains the retry path if an operational save wins a race. */
export async function syncStudentAttendancePayroll(sessionId:string,sessionAt:string,now=new Date()):Promise<void>{
  const p=currentPeriod(new Date(sessionAt));
  if(Date.parse(sessionAt)<Date.parse(STUDENT_ATTENDANCE_FROM)){
    const record=await getPayrollPeriod(p.id);
    const cutoff=record?.document.class_attendance_from;
    if(!cutoff || Date.parse(sessionAt)<Date.parse(cutoff))return;
  }
  const config=await getPayrollConfig();
  if(!config.settings.active_from || wibDate(sessionAt)<config.settings.active_from)return;
  const previous=pending.get(p.id);if(previous){await previous;return syncStudentAttendancePayroll(sessionId,sessionAt,now);}
  const work=(async()=>{
    let record=await ensurePayrollPeriod(p.year,p.month);
    if(record.document.status==='FINAL'){
      await createAttendanceAdminNotifications({title:'Absensi siswa berubah setelah payroll final',message:`Periksa sesi dan revisi absensi coach periode ${p.id}. Versi final tidak diubah otomatis.`,actionUrl:`/admin/coach-attendance?period=${p.id}`,dedupeKey:`payroll-student-attendance:${p.id}:${sessionId}`,push:false},record.document.pic_id);return;
    }
    try{await calculatePayroll(record,now);}catch(e){
      if(!(e instanceof PayrollError)||e.status!==409)throw e;
      const latest=await getPayrollPeriod(p.id);if(!latest||latest.document.status!=='DRAFT')return;
      record=latest;await calculatePayroll(record,now);
    }
  })();
  pending.set(p.id,work);try{await work;}finally{if(pending.get(p.id)===work)pending.delete(p.id);}
}
