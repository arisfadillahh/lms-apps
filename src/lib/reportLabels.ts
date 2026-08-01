export function formatReportBlockName(
  classType: string | null | undefined,
  blockName: string | null | undefined,
) {
  const normalizedBlockName = blockName?.trim() ?? '';
  if (classType === 'EKSKUL' || normalizedBlockName.toLowerCase().startsWith('ekskul -')) {
    return 'Ekskul';
  }

  return normalizedBlockName || 'Block';
}

export function formatReportClassBlockLabel(
  className: string | null | undefined,
  classType: string | null | undefined,
  blockName: string | null | undefined,
) {
  const normalizedClassName = className?.trim() || 'Kelas';
  return `${normalizedClassName} - ${formatReportBlockName(classType, blockName)}`;
}
