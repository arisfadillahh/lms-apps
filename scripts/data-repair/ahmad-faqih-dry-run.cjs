/* eslint-disable @typescript-eslint/no-require-imports */
// SELECT-only preflight. Run on VPS with `node -` and this file on stdin.
require('dotenv').config({ path: '/root/lms/current/.env', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const coderId = 'afe24d5c-509d-43c1-951e-0a3f7d80ac39';
const classId = 'f300247f-4a3d-4bde-8d13-57251b99f2ea';
const expectedEnrollmentId = 'aa15cd14-e9d3-4ec9-9b93-5af2be1bad32';
const interactiveId = '78b67a1b-fe88-4a4a-a2b6-5ad0b1e9bff2';
(async () => {
  const queries = [
    ['enrollment', db.from('enrollments').select('id,status,exit_reason,ended_at,updated_at').eq('coder_id', coderId).eq('class_id', classId)],
    ['progress', db.from('coder_block_progress').select('id,block_id,journey_order,status,completed_at').eq('coder_id', coderId).order('journey_order')],
    ['progression', db.from('coder_level_progressions').select('id,status,target_class_id,target_enrollment_id,source_enrollment_id').eq('coder_id', coderId)],
    ['class', db.from('classes').select('id,lifecycle_status,end_date').eq('id', classId)],
    ['class_blocks', db.from('class_blocks').select('id,block_id,status,end_date').eq('class_id', classId)],
  ];
  const result = {};
  for (const [name, query] of queries) {
    const { data, error } = await query;
    if (error) throw new Error(`${name}: ${error.message}`);
    result[name] = data;
  }
  const enrollment = result.enrollment.find(row => row.id === expectedEnrollmentId);
  const interactive = result.progress.find(row => row.block_id === interactiveId);
  const enrollmentReady = enrollment?.status === 'ACTIVE'
    && enrollment.exit_reason === null && enrollment.ended_at === null;
  const snapshotMatches = enrollmentReady
    && result.progression.length === 1 && result.progression[0].status === 'WAITING_PLACEMENT'
    && result.progression[0].source_enrollment_id === expectedEnrollmentId
    && result.progression[0].target_class_id === null && result.progression[0].target_enrollment_id === null
    && result.progress.length === 5 && result.progress.every(row => row.status === 'COMPLETED')
    && result.class_blocks.some(row => row.block_id === interactiveId && row.status === 'CURRENT');
  const alreadyCorrected = enrollmentReady
    && result.progression.length === 1 && result.progression[0].status === 'WAITING_PLACEMENT'
    && interactive?.status === 'IN_PROGRESS'
    && result.progress.every(row => row.journey_order <= 1 || row.status === 'PENDING');
  console.log(JSON.stringify({mode: 'SELECT_ONLY_DRY_RUN', snapshotMatches, requiresAcademicDecision: true, alreadyCorrected,
    enrollment: result.enrollment, progression: result.progression, progress: result.progress,
    class: result.class, currentInteractive: result.class_blocks.filter(row => row.block_id === interactiveId && row.status === 'CURRENT'),
    proposed: 'OPTION ONLY after Aris decides Game Development: keep enrollment ACTIVE and progression WAITING_PLACEMENT unchanged; set Interactive IN_PROGRESS and later blocks PENDING.'}, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
