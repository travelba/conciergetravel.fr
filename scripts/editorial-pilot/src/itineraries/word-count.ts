export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/u).length;
}

export function padToMinWords(
  base: string,
  fillerSentences: readonly string[],
  minWords: number,
): string {
  let out = base.trim();
  let i = 0;
  while (countWords(out) < minWords && i < fillerSentences.length) {
    const sentence = fillerSentences[i];
    if (sentence !== undefined) {
      out = `${out} ${sentence}`.trim();
    }
    i += 1;
  }
  return out;
}
