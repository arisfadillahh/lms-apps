import { beforeEach, describe, expect, it, vi } from 'vitest';

const dao = vi.hoisted(() => ({
  classesDao: { getClassById: vi.fn(), getClassBlocks: vi.fn(), createClassBlock: vi.fn() },
  sessionsDao: { listSessionsByClass: vi.fn() },
  blocksDao: { listBlocksByLevel: vi.fn() },
  lessonTemplatesDao: { listLessonsByBlock: vi.fn() },
  classLessonsDao: {}, coderProgressDao: {},
}));
vi.mock('@/lib/dao', () => dao);
vi.mock('@/lib/dao/classLessonsDao', () => ({ buildClassLessonOrderIndex: vi.fn(), buildClassLessonTitle: vi.fn() }));
import { autoAssignLessonsForClass } from '@/lib/services/lessonAutoAssign';

describe('auto assignment with an empty curriculum block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dao.classesDao.getClassById.mockResolvedValue({ id: 'class', type: 'WEEKLY', level_id: 'level', start_date: '2026-11-04' });
    dao.classesDao.getClassBlocks.mockResolvedValue([]);
    dao.sessionsDao.listSessionsByClass.mockResolvedValue([{ id: 'session', date_time: '2026-11-04T09:00:00Z', status: 'SCHEDULED' }]);
    dao.blocksDao.listBlocksByLevel.mockResolvedValue([{ id: 'block', name: 'Blok kosong', order_index: 1 }]);
    dao.lessonTemplatesDao.listLessonsByBlock.mockResolvedValue([]);
  });

  it('stops before creating empty runtime blocks instead of endlessly generating them', async () => {
    await expect(autoAssignLessonsForClass('class')).rejects.toThrow('belum memiliki lesson template');
    expect(dao.classesDao.createClassBlock).not.toHaveBeenCalled();
    expect(dao.lessonTemplatesDao.listLessonsByBlock).toHaveBeenCalledTimes(1);
  });
});
