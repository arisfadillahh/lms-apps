import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, rubricsDao, usersDao } from '@/lib/dao';

import EkskulRubricForm from './EkskulRubricForm';

type PageProps = {
  params: { slug: string };
};

export default async function EkskulRubricPage({ params }: PageProps) {
  const session = await getSessionOrThrow();
  const [encodedClassId, encodedSemester] = params.slug.split('__');
  const classId = encodedClassId ? decodeURIComponent(encodedClassId) : '';
  const semesterTag = encodedSemester ? decodeURIComponent(encodedSemester) : '';

  if (!classId || !semesterTag) {
    return (
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Rute tidak valid</h1>
        <p style={{ color: '#64748b' }}>Periksa kembali link rubrik ekskul yang dibuka.</p>
      </div>
    );
  }

  const classRecord = await classesDao.getClassById(classId);
  if (!classRecord || classRecord.coach_id !== session.user.id) {
    return (
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Tidak diizinkan</h1>
        <p style={{ color: '#64748b' }}>Anda tidak terdaftar sebagai coach untuk kelas ini.</p>
      </div>
    );
  }

  const template = await rubricsDao.findRubricTemplate('EKSKUL', classRecord.level_id ?? null);
  if (!template) {
    return (
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Template rubrik belum tersedia</h1>
        <p style={{ color: '#64748b' }}>Hubungi Admin agar template rubrik ekskul dikonfigurasi.</p>
      </div>
    );
  }

  const enrollments = await classesDao.listEnrollmentsByClass(classId);
  const coders = await usersDao.getUsersByIds(enrollments.map((enrollment) => enrollment.coder_id));
  const competencies =
    (template.competencies as Record<string, { label: string; descriptions: Record<'A' | 'B' | 'C', string> }>) ?? {};
  const positiveCharacters = (template.positive_characters as string[]) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600 }}>Ekskul Rubric</h1>
        <p style={{ color: '#64748b' }}>
          {classRecord.name} • Semester {semesterTag}
        </p>
      </header>
      <EkskulRubricForm
        classId={classId}
        semesterTag={semesterTag}
        coders={coders.map((coder) => ({ id: coder.id, fullName: coder.full_name }))}
        competencies={competencies}
        positiveCharacters={positiveCharacters}
      />
    </div>
  );
}
