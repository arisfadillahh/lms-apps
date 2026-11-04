export const REPORT_PRINT_SINGLE_PAGE_MAX_MATERIALS = 20;

export type ReportPrintLayout = 'single-page' | 'two-page';

export function getReportPrintLayout(materialCount: number): ReportPrintLayout {
  return materialCount > REPORT_PRINT_SINGLE_PAGE_MAX_MATERIALS ? 'two-page' : 'single-page';
}
