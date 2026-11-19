/**
 * Character count: Unicode code points, not UTF-16 code units (PROJECT.md
 * §4.5) — iterating a string with `for...of`/spread walks by code point.
 */
export function countCharacters(text: string): number {
  return [...text].length
}

/**
 * Word count: runs of non-whitespace separated by whitespace. Punctuation
 * attached to a word (e.g. "привет,") counts as part of that word, which
 * matches how most word counters behave. Empty/whitespace-only text is 0
 * words (PROJECT.md §4.5).
 */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  return trimmed.split(/\s+/u).length
}
