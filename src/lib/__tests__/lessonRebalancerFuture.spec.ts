import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lessons: vi.fn(), clear: vi.fn(), autoAssign: vi.fn(),
}));
vi.mock('@/lib/supabaseServer', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: mocks.lessons }), update: mocks.clear }),
  }),
}));
vi.mock('@/lib/services/lessonAutoAssign', () => ({ autoAssignLessonsForClass: mocks.autoAssign }));

import { reassignLessonsToSessions } from '@/lib/services/lessonRebalancer';

describe('rebalancing a class with lesson history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lessons.mockResolvedValue({
      data: [
        { id: 'past-lesson', session_id: 'completed-session' },
        { id: 'future-lesson', session_id: 'scheduled-session' },
      ],
      error: null,
    });
  });

  it('delegates to the future-only rebuild without clearing past links', async () => {
    await reassignLessonsToSessions('class-258910c1');
    expect(mocks.autoAssign).toHaveBeenCalledWith('class-258910c1', { mode: 'rebuild_future' });
    expect(mocks.clear).not.toHaveBeenCalled();
  });
});
