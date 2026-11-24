import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Result = { data: Row[]; error: null };
interface Query extends PromiseLike<Result> {
  select: () => Query;
  eq: (key: string, value: unknown) => Query;
  in: (key: string, values: unknown[]) => Query;
  order: () => Query;
  limit: (n: number) => Query;
  maybeSingle: () => Promise<{ data: Row | null; error: null }>;
}
const state = vi.hoisted(() => ({ rows: {} as Record<string, Row[]>, role: 'CODER' }));
vi.mock('@/lib/auth', () => ({ getSessionOrThrow: async () => ({ user: { id: 'coder-qa', role: state.role } }) }));
vi.mock('@/lib/services/aiReports', () => ({ generateDraftReportsForClasses: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: () => ({ from: (table: string) => {
  let rows = [...(state.rows[table] ?? [])];
  const query: Query = {
    select: () => query,
    eq: (key, value) => { rows = rows.filter(row => row[key] === value); return query; },
    in: (key, values) => { rows = rows.filter(row => values.includes(row[key])); return query; },
    order: () => query,
    limit: n => { rows = rows.slice(0, n); return query; },
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    then: (resolve, reject) => Promise.resolve<Result>({ data: rows, error: null }).then(resolve, reject),
  };
  return query;
} }) }));

import { GET } from '@/app/api/coder/block-evaluations/route';
const get = (params: string) => GET(new Request(`http://localhost/api/coder/block-evaluations?${params}`));

describe('Coder catch-up evaluation access', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-24T10:00:00Z'));
    state.role = 'CODER';
    state.rows = {
      enrollments: [{ id: 'enrollment-qa', coder_id: 'coder-qa', class_id: 'class-qa', status: 'ACTIVE' }],
      block_evaluation_sessions: [{ id: 'eval-qa', class_id: 'class-qa', block_id: 'block-qa', session_id: 'session-qa', status: 'in_progress', current_question_index: -1, created_at: '2026-10-10T03:20:47Z' }],
      sessions: [{ id: 'session-qa', class_id: 'class-qa', date_time: '2026-10-10T02:00:00Z', status: 'COMPLETED' }],
      block_evaluation_answers: [{ eval_session_id: 'eval-qa', coder_id: 'coder-qa', question_index: 0, answer: 'Jawaban tersimpan' }],
    };
  });
  afterEach(() => vi.useRealTimers());
  it('marks the old unstarted presenter for personal catch-up without advancing or closing it', async () => {
    const response = await get('mode=active&classId=class-qa');
    expect(response.status).toBe(200);
    expect((await response.json()).activeSession).toMatchObject({ selfPaced: true, current_question_index: -1, status: 'in_progress' });
    expect(state.rows.block_evaluation_sessions[0].current_question_index).toBe(-1);
  });
  it('preserves saved answers when the Coder resumes catch-up', async () => {
    const response = await get('evalSessionId=eval-qa');
    const payload = await response.json();
    expect(payload.evalSession.selfPaced).toBe(true);
    expect(payload.pastAnswers).toHaveLength(1);
    expect(payload.pastAnswers[0].answer).toBe('Jawaban tersimpan');
  });
  it('keeps a fresh presenter coach-controlled even when class attendance is completed', async () => {
    state.rows.block_evaluation_sessions[0].created_at = new Date().toISOString();
    expect((await (await get('mode=active&classId=class-qa')).json()).activeSession.selfPaced).toBe(false);
  });
  it('does not give an inactive or other-class Coder access to catch-up', async () => {
    expect((await get('mode=active&classId=other-class')).status).toBe(403);
    state.rows.enrollments[0].status = 'INACTIVE';
    expect((await get('evalSessionId=eval-qa')).status).toBe(403);
  });
  it('does not provide this Coder endpoint to another role', async () => {
    state.role = 'ADMIN';
    expect((await get('evalSessionId=eval-qa')).status).toBe(403);
  });
});
