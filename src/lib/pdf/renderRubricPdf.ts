export type RubricPdfPayload = {
  className: string;
  classType: 'WEEKLY' | 'EKSKUL';
  coderName: string;
  coachName: string;
  submittedAt: string;
  blockName?: string | null;
  semesterTag?: string | null;
  grades: Record<string, string>;
  competencies: Record<
    string,
    {
      label: string;
      descriptions: Record<'A' | 'B' | 'C', string>;
    }
  >;
  positiveCharacters: string[];
  narrative: string;
};

export function renderRubricHtml(payload: RubricPdfPayload): string {
  const competencyRows = Object.entries(payload.grades)
    .map(([competencyId, grade]) => {
      const competency = payload.competencies[competencyId];
      if (!competency) {
        return '';
      }
      const description = competency.descriptions[grade as 'A' | 'B' | 'C'] ?? '';
      return `<tr>
        <td>${escapeHtml(competency.label)}</td>
        <td>${escapeHtml(grade)}</td>
        <td>${escapeHtml(description)}</td>
      </tr>`;
    })
    .join('');

  const positiveCharacters =
    payload.positiveCharacters.length === 0
      ? '—'
      : payload.positiveCharacters
          .map((character) => `<span class="pill">${escapeHtml(character)}</span>`)
          .join('');

  const blockSection = payload.blockName
    ? `<div class="meta-item"><span>Block</span>${escapeHtml(payload.blockName)}</div>`
    : '';

  const semesterSection = payload.semesterTag
    ? `<div class="meta-item"><span>Semester</span>${escapeHtml(payload.semesterTag)}</div>`
    : '';

  const submittedAt = new Date(payload.submittedAt).toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <title>${escapeHtml(payload.className)} - Pitching Day Report</title>
    <style>
      body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px; background: #f8fafc; color: #0f172a; }
      h1 { font-size: 28px; margin-bottom: 0; }
      h2 { font-size: 20px; margin-top: 32px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 14px; }
      th { background: #f1f5f9; font-weight: 600; }
      .section { background: #ffffff; border-radius: 16px; padding: 24px; margin-top: 32px; box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08); }
      .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 16px; }
      .meta-item { font-size: 14px; color: #334155; }
      .meta-item span { display: block; font-weight: 600; color: #0f172a; }
      .pill { display: inline-block; border-radius: 999px; background: #2563eb; color: #fff; padding: 4px 12px; font-size: 12px; margin-right: 8px; margin-bottom: 8px; }
      .narrative { white-space: pre-wrap; background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="section">
      <h1>${escapeHtml(payload.className)} Report</h1>
      <div class="meta">
        <div class="meta-item"><span>Coder</span>${escapeHtml(payload.coderName)}</div>
        <div class="meta-item"><span>Coach</span>${escapeHtml(payload.coachName)}</div>
        <div class="meta-item"><span>Class Type</span>${escapeHtml(payload.classType)}</div>
        ${blockSection}
        ${semesterSection}
        <div class="meta-item"><span>Submitted At</span>${escapeHtml(submittedAt)}</div>
      </div>
    </div>

    <div class="section">
      <h2>Competency Grades</h2>
      <table>
        <thead>
          <tr>
            <th>Competency</th>
            <th>Grade</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${competencyRows}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Positive Characters</h2>
      <div>${positiveCharacters}</div>
    </div>

    <div class="section">
      <h2>Coach Narrative</h2>
      <div class="narrative">${escapeHtml(payload.narrative)}</div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
