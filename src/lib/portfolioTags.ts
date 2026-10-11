/** Normalize spelling only; never merge different skills or rewrite published data. */
export function portfolioTagKey(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

export function uniquePortfolioTags(values: string[]): string[] {
  const tags = new Map<string, string>();
  for (const value of values) {
    const label = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
    const key = portfolioTagKey(label);
    if (key && !tags.has(key)) tags.set(key, label);
  }
  return [...tags.values()];
}
