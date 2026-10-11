import { Clock, Calendar, CheckCircle2, AlertCircle, Upload, ClipboardList, MessageSquare, PartyPopper } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { makeUpTasksDao, sessionsDao, classesDao } from '@/lib/dao';

import MakeUpUploadForm from './MakeUpUploadForm';
import UploadTutorialModal from './UploadTutorialModal';
import { StaggerContainer, StaggerItem } from '../StaggerWrapper';

export default async function CoderMakeUpPage() {
  const session = await getSessionOrThrow();
  const tasks = await makeUpTasksDao.listMakeUpTasksByCoder(session.user.id);

  const enriched = await Promise.all(
    tasks.map(async (task) => {
      const sessionRecord = await sessionsDao.getSessionById(task.session_id);
      const classRecord = sessionRecord ? await classesDao.getClassById(sessionRecord.class_id) : null;
      return {
        task,
        session: sessionRecord,
        className: classRecord?.name ?? 'Class',
      };
    }),
  );

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PENDING_UPLOAD':
        return { label: 'Belum Dikumpulkan', colorClass: 'bg-pastel-yellow text-amber-600 border-amber-300', icon: <Upload size={14} /> };
      case 'SUBMITTED':
        return { label: 'Menunggu Review', colorClass: 'bg-pastel-blue text-sky border-sky/20', icon: <AlertCircle size={14} /> };
      case 'REVIEWED':
        return { label: 'Selesai Direview', colorClass: 'bg-pastel-green text-clevio-green border-clevio-green/20', icon: <CheckCircle2 size={14} /> };
      default:
        return { label: status, colorClass: 'bg-slate-100 text-slate-500 border-slate-200', icon: null };
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

    return (
      <StaggerContainer className="coder-makeup-page flex-1 p-8 overflow-y-auto space-y-8">
      {/* Header */}
      <StaggerItem>
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-clevio-navy tracking-tight mb-1 flex items-center gap-3">
              <ClipboardList className="text-amber-600" size={28} /> Tugas Susulan
            </h1>
            <p className="text-sm font-bold text-slate-400">
              Kumpulkan karya susulan untuk sesi yang terlewat sebelum batas waktu yang ditentukan.
            </p>
          </div>
          <UploadTutorialModal />
        </header>
      </StaggerItem>

      {/* Tasks */}
      <div className="space-y-4">
        {enriched.length === 0 ? (
          <StaggerItem>
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-[3rem] border-4 border-dashed border-pastel-green/30 text-center">
              <CheckCircle2 size={48} className="text-clevio-green mb-4" />
              <p className="font-black text-slate-600 text-lg">Tidak ada tugas susulan saat ini</p>
              <p className="text-sm font-bold text-slate-400 mt-1">Semua tugas sudah selesai!</p>
            </div>
          </StaggerItem>
        ) : (
          enriched
            .sort((a, b) => new Date(a.task.due_date).getTime() - new Date(b.task.due_date).getTime())
            .map(({ task, className, session }, idx) => {
              const statusInfo = getStatusInfo(task.status);
              const themes = [
                { accent: 'border-l-sky', bg: 'bg-white' },
                { accent: 'border-l-sunshine', bg: 'bg-white' },
                { accent: 'border-l-coral', bg: 'bg-white' },
                { accent: 'border-l-clevio-green', bg: 'bg-white' },
              ];
              const theme = themes[idx % 4];

              return (
                <StaggerItem key={task.id}>
                  <div className={`${theme.bg} rounded-3xl border-2 border-slate-50 shadow-sm overflow-hidden border-l-4 ${theme.accent}`}>
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 p-6">
                      {/* Left: Info */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-xl font-black text-clevio-navy">{className}</h2>
                          <div className={`coder-makeup-status coder-makeup-status-${task.status.toLowerCase()} inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border ${statusInfo.colorClass}`}>
                            {statusInfo.icon}
                            {statusInfo.label}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm font-bold text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={14} className="text-sky" />
                            Sesi: {session ? formatDate(session.date_time) : '—'}
                          </span>
                          <span className="text-pastel-blue">•</span>
                          <span className="flex items-center gap-1.5 text-coral font-black">
                            <Clock size={14} />
                            Deadline: {formatDate(task.due_date)}
                          </span>
                        </div>

                        {task.instructions && (
                          <div className="coder-makeup-instruction p-4 bg-pastel-yellow rounded-2xl border border-sunshine/20 text-sm font-bold text-amber-700 leading-relaxed flex gap-2">
                            <ClipboardList size={16} className="flex-shrink-0 mt-0.5" /> <span><strong>Instruksi:</strong> {task.instructions}</span>
                          </div>
                        )}

                        {task.feedback && (
                          <div className="coder-makeup-feedback p-4 bg-pastel-green rounded-2xl border border-clevio-green/20 text-sm font-bold text-green-700 leading-relaxed flex gap-2">
                            <MessageSquare size={16} className="flex-shrink-0 mt-0.5" /> <span><strong>Feedback Coach:</strong> {task.feedback}</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Upload */}
                      <div className="w-full lg:w-[300px]">
                        <MakeUpUploadForm
                          taskId={task.id}
                          submittedFiles={task.submission_files ? JSON.parse(JSON.stringify(task.submission_files)) : null}
                          status={task.status}
                        />
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })
        )}
      </div>
    </StaggerContainer >
  );
}
