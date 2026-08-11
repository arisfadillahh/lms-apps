export type TypoReplacement = {
  from: string;
  to: string;
};

export type AppliedTypoReplacements = {
  text: string;
  applied: TypoReplacement[];
  rejected: TypoReplacement[];
};

function isTypoSizedChange(from: string, to: string) {
  const fromParts = from.split(/(\s+)/);
  const toParts = to.split(/(\s+)/);
  if (fromParts.length !== toParts.length) return false;

  const changedWords: Array<[string, string]> = [];
  for (let index = 0; index < fromParts.length; index += 1) {
    const fromPart = fromParts[index];
    const toPart = toParts[index];
    if (/\s+/.test(fromPart) || /\s+/.test(toPart)) {
      if (fromPart !== toPart) return false;
      continue;
    }
    if (fromPart !== toPart) changedWords.push([fromPart, toPart]);
  }
  if (changedWords.length !== 1) return false;

  const [fromWord, toWord] = changedWords[0];
  if (Math.abs(fromWord.length - toWord.length) > 3) return false;

  const previous = Array.from({ length: toWord.length + 1 }, (_, index) => index);
  for (let row = 1; row <= fromWord.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= toWord.length; column += 1) {
      const above = previous[column];
      previous[column] = fromWord[row - 1] === toWord[column - 1]
        ? diagonal
        : Math.min(diagonal, previous[column - 1], above) + 1;
      diagonal = above;
    }
  }

  return previous[toWord.length] <= 3;
}

/**
 * Applies only exact, unambiguous replacements. This keeps the AI feature
 * limited to typo correction instead of allowing it to rewrite the insight.
 */
export function applyTypoReplacements(
  original: string,
  replacements: TypoReplacement[],
): AppliedTypoReplacements {
  let text = original;
  const applied: TypoReplacement[] = [];
  const rejected: TypoReplacement[] = [];

  if (replacements.length > 12) {
    return { text: original, applied, rejected: replacements };
  }

  for (const replacement of replacements) {
    if (
      !replacement ||
      typeof replacement.from !== 'string' ||
      typeof replacement.to !== 'string' ||
      !replacement.from ||
      replacement.from === replacement.to ||
      replacement.from.length > 160 ||
      replacement.to.length > 160 ||
      !isTypoSizedChange(replacement.from, replacement.to)
    ) {
      rejected.push(replacement);
      continue;
    }

    const firstIndex = text.indexOf(replacement.from);
    const lastIndex = text.lastIndexOf(replacement.from);
    if (firstIndex < 0 || firstIndex !== lastIndex) {
      rejected.push(replacement);
      continue;
    }

    text = `${text.slice(0, firstIndex)}${replacement.to}${text.slice(firstIndex + replacement.from.length)}`;
    applied.push(replacement);
  }

  return { text, applied, rejected };
}
