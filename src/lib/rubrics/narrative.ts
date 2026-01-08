type CompetencyMap = Record<
  string,
  {
    label: string;
    descriptions?: Record<'A' | 'B' | 'C', string>;
  }
>;

export function generateNarrative(params: {
  coderName: string;
  className: string;
  competencies: CompetencyMap;
  grades: Record<string, string>;
  positiveCharacters: string[];
}): string {
  const gradeLines = Object.entries(params.grades)
    .map(([id, grade]) => {
      const competency = params.competencies[id];
      const label = competency?.label ?? id;
      const descriptor = competency?.descriptions?.[grade as 'A' | 'B' | 'C'];
      return `${label}: ${grade}${descriptor ? ` — ${descriptor}` : ''}`;
    })
    .join('; ');

  const positives =
    params.positiveCharacters.length > 0
      ? `Strengths observed: ${params.positiveCharacters.join(', ')}.`
      : 'Strengths observed: coach to follow up on key areas.';

  return `${params.coderName} completed activities in ${params.className}. ${positives} Key assessment notes: ${gradeLines}.`;
}
