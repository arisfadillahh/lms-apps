type ExistingAiReport = {
  status: string | null;
  is_ai_generated: boolean | null;
};

type ExistingAiReportForCoder = ExistingAiReport & {
  coder_id: string | null;
};

export function getAiReportGenerationSkipReason(existingReport: ExistingAiReport | null): string | null {
  if (!existingReport) return null;

  if (existingReport.is_ai_generated) {
    return `AI report already generated with status ${existingReport.status}.`;
  }

  return `Report already exists with status ${existingReport.status}.`;
}

export function canRefreshAiDraftReport(existingReport: ExistingAiReport | null): boolean {
  return existingReport?.status === 'DRAFT' && existingReport.is_ai_generated === true;
}

export function hasVisibleOrGeneratableDraft(
  existingReports: ExistingAiReportForCoder[],
  coderIds: string[],
): boolean {
  const existingReportByCoderId = new Map(
    existingReports
      .filter((report): report is ExistingAiReportForCoder & { coder_id: string } => Boolean(report.coder_id))
      .map((report) => [report.coder_id, report]),
  );

  return coderIds.some((coderId) => {
    const existingReport = existingReportByCoderId.get(coderId) ?? null;
    return !existingReport || existingReport.status === 'DRAFT' || canRefreshAiDraftReport(existingReport);
  });
}
