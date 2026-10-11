import type { LessonEvaluationRecord } from '@/lib/dao/reportsDao';

export type EvaluationScoreMap = Record<string, Record<string, string>>;

type StudentRef = { id: string };
type CriteriaRef = { id: string };

export function buildEvaluationScoreMap(
  students: StudentRef[],
  criteriaList: CriteriaRef[],
  evaluations: Pick<LessonEvaluationRecord, 'coder_id' | 'criteria_id' | 'score'>[] = [],
): EvaluationScoreMap {
  const savedScores = new Map(
    evaluations.map((evaluation) => [
      `${evaluation.coder_id}:${evaluation.criteria_id}`,
      String(evaluation.score),
    ]),
  );

  return Object.fromEntries(
    students.map((student) => [
      student.id,
      Object.fromEntries(
        criteriaList.map((criteria) => [
          criteria.id,
          savedScores.get(`${student.id}:${criteria.id}`) ?? '',
        ]),
      ),
    ]),
  );
}
