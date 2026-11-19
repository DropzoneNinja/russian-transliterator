import { COMMON_RUSSIAN_WORDS } from './wordlist'

/** De-duplicated, in the word list's own (most-to-least common) order. */
const WORDS: readonly string[] = Array.from(new Set(COMMON_RUSSIAN_WORDS))

function capitalize(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
}

/**
 * Suggest up to `limit` dictionary words starting with `prefix`, ranked by
 * the word list's order (a proxy for commonality). Case-insensitive on
 * the way in; if `prefix` starts with an uppercase letter, suggestions
 * are capitalized to match it, mirroring the transliteration engine's
 * own case rule (TASKS.md §1.3 point 5).
 */
export function suggestCompletions(prefix: string, limit: number): string[] {
  if (prefix === '') return []

  const lowerPrefix = prefix.toLowerCase()
  const shouldCapitalize = prefix.charAt(0) !== lowerPrefix.charAt(0)

  const matches: string[] = []
  for (const word of WORDS) {
    if (word.startsWith(lowerPrefix)) {
      matches.push(shouldCapitalize ? capitalize(word) : word)
      if (matches.length >= limit) break
    }
  }
  return matches
}
