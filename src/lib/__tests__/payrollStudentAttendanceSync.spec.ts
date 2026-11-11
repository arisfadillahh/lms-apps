import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createPeriod,PayrollError} from '@/lib/payroll/model';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({config:vi.fn(),ensure:vi.fn(),get:vi.fn(),calc:vi.fn(),notify:vi.fn()}));
vi.mock('@/lib/dao/payrollDao',()=>({getPayrollConfig:m.config,ensurePayrollPeriod:m.ensure,getPayrollPeriod:m.get}));
vi.mock('@/lib/services/payroll',()=>({calculatePayroll:m.calc}));
vi.mock('@/lib/services/payrollNotifications',()=>({createAttendanceAdminNotifications:m.notify}));
import {syncStudentAttendancePayroll} from '@/lib/services/payrollStudentAttendanceSync';
describe('student attendance payroll completion hook',()=>{
 beforeEach(()=>{vi.clearAllMocks();m.config.mockResolvedValue({settings:{active_from:'2026-10-26',automation_enabled:false}});m.ensure.mockResolvedValue({id:'2026-11',revision:2,document:createPeriod(2026,11)});m.calc.mockResolvedValue({});m.notify.mockResolvedValue(undefined);});
 it('leaves pre-cutover history unchanged',async()=>{await syncStudentAttendancePayroll('s','2026-11-11T10:00:00+07:00');expect(m.config).not.toHaveBeenCalled();expect(m.calc).not.toHaveBeenCalled();});
 it('recalculates even when scheduled WhatsApp is paused',async()=>{await syncStudentAttendancePayroll('s','2026-11-12T10:00:00+07:00');expect(m.calc).toHaveBeenCalledOnce();expect(m.notify).not.toHaveBeenCalled();});
 it('does not rewrite a finalized document and alerts operational admins',async()=>{m.ensure.mockResolvedValue({id:'2026-11',revision:2,document:{...createPeriod(2026,11),status:'FINAL'}});await syncStudentAttendancePayroll('s','2026-11-12T10:00:00+07:00');expect(m.calc).not.toHaveBeenCalled();expect(m.notify).toHaveBeenCalledWith(expect.objectContaining({dedupeKey:'payroll-student-attendance:2026-11:s',push:false}),undefined);});
 it('retries one stale revision from the latest draft',async()=>{const latest={id:'2026-11',revision:3,document:createPeriod(2026,11)};m.calc.mockRejectedValueOnce(new PayrollError('Conflict',409));m.get.mockResolvedValue(latest);await syncStudentAttendancePayroll('s','2026-11-12T10:00:00+07:00');expect(m.calc).toHaveBeenLastCalledWith(latest,expect.any(Date));expect(m.calc).toHaveBeenCalledTimes(2);});
 it('preserves underlying calculation failures for the best-effort caller and cron retry',async()=>{m.calc.mockRejectedValueOnce(new Error('Unavailable'));await expect(syncStudentAttendancePayroll('s','2026-11-12T10:00:00+07:00')).rejects.toThrow('Unavailable');expect(m.calc).toHaveBeenCalledOnce();});
 it('respects the configured payroll start date',async()=>{m.config.mockResolvedValue({settings:{active_from:'2026-12-01'}});await syncStudentAttendancePayroll('s','2026-11-12T10:00:00+07:00');expect(m.ensure).not.toHaveBeenCalled();});
});
