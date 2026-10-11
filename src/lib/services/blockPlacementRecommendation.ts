export type PlacementCandidate = {
  placement_id: string;
  class_id: string;
  class_name: string;
  class_position: number;
  active_coder_count: number;
  schedule_day: string;
  schedule_time: string;
};

export function rankPlacementCandidates<T extends PlacementCandidate>(
  candidates: T[], entryLessonPosition: number,
): T[] {
  return [...candidates].sort((a, b) => {
    const distance = Math.abs(a.class_position - entryLessonPosition)
      - Math.abs(b.class_position - entryLessonPosition);
    if (distance !== 0) return distance;
    const aBehind = Number(a.class_position < entryLessonPosition);
    const bBehind = Number(b.class_position < entryLessonPosition);
    return aBehind - bBehind
      || a.active_coder_count - b.active_coder_count
      || a.schedule_day.localeCompare(b.schedule_day)
      || a.schedule_time.localeCompare(b.schedule_time)
      || a.class_id.localeCompare(b.class_id);
  });
}

export function placementAction(blockName: string, candidates: PlacementCandidate[], entryLessonPosition: number): string {
  const first = rankPlacementCandidates(candidates, entryLessonPosition)[0];
  return first ? `Pindahkan ke kelas ${first.class_name}` : `Buka kelas baru untuk blok ${blockName}`;
}
