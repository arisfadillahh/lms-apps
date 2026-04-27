type ExistingAiReport = {
  status: string | null;
  is_ai_generated: boolean | null;
};

export function getAiReportGenerationSkipReason(existingReport: ExistingAiReport | null): string | null {
  if (!existingReport) return null;

  if (existingReport.is_ai_generated) {
    return `AI report already generated with status ${existingReport.status}.`;
  }

  return `Report already exists with status ${existingReport.status}.`;
}
