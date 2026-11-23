import { describe, expect, it } from 'vitest';
import { buildCoderEkskulProgress } from '@/lib/services/coderEkskulProgress';

const lessons = [1, 2, 3].map(n => ({ id: `l${n}`, title: `Materi ${n}`, order_index: n,
  estimated_meetings: 1, summary: `Ringkasan ${n}`, slide_url: `https://example.com/${n}` }));
const session = (n: number, status = 'COMPLETED') => ({ id: `s${n}`, date_time: `2026-11-${String(n).padStart(2, '0')}T03:00:00Z`, status });
const now = new Date('2026-11-03T00:00:00Z');

describe('Coder Ekskul dashboard history', () => {
  it('returns completed materials and next meeting, with real progress', () => {
    const result = buildCoderEkskulProgress(lessons, [session(1), session(2), session(3, 'SCHEDULED')], now);
    expect(result.percent).toBe(67);
    expect(result.lessons.map(l => l.status)).toEqual(['COMPLETED', 'COMPLETED', 'NEXT']);
    expect(result.lessons[1]).toMatchObject({ summary: 'Ringkasan 2', slideUrl: 'https://example.com/2' });
  });
  it('keeps history and reaches 100% when no next session remains', () => {
    const result = buildCoderEkskulProgress(lessons, [session(3), session(1), session(2)], now);
    expect(result.percent).toBe(100);
    expect(result.lessons.at(-1)?.status).toBe('COMPLETED');
  });
  it('does not count a cancellation as a lesson or shift the next material', () => {
    const result = buildCoderEkskulProgress(lessons, [session(1), session(2, 'CANCELLED'), session(3, 'SCHEDULED')], now);
    expect(result.percent).toBe(33);
    expect(result.lessons[1]).toMatchObject({ id: 'l2', status: 'NEXT' });
  });
  it('does not complete multi-meeting material after only its first meeting', () => {
    const result = buildCoderEkskulProgress([{ ...lessons[0], estimated_meetings: 2 }, lessons[1]], [session(1), session(3, 'SCHEDULED')], now);
    expect(result.journey[0].status).toBe('CURRENT');
    expect(result.lessons[1].title).toBe('Materi 1 (Part 2)');
    expect(result.percent).toBe(33);
  });
  it('never treats elapsed dates alone as completed and handles an empty plan', () => {
    expect(buildCoderEkskulProgress(lessons, [session(1, 'SCHEDULED')], now).percent).toBe(0);
    expect(buildCoderEkskulProgress([], [], now).percent).toBe(0);
  });
  it('keeps the session in progress selected instead of showing next week\'s slide', () => {
    const result = buildCoderEkskulProgress(lessons, [session(1), session(3, 'SCHEDULED'), { ...session(4, 'SCHEDULED'), date_time: '2026-11-10T03:00:00Z' }], new Date('2026-11-03T03:45:00Z'));
    expect(result.lessons.find(l => l.status === 'NEXT')).toMatchObject({ id: 'l2', slideUrl: 'https://example.com/2' });
  });
});
