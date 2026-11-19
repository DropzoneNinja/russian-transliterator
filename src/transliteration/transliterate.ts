import { INITIAL_STATE, feed, flush } from './engine'

export type TransliterationMode = 'on' | 'off'

/**
 * Transliterate a whole string in one call (used for paste handling in
 * Phase 6). When `mode` is `'off'`, every character is inserted literally
 * (PROJECT.md §5.6) — no engine logic runs at all.
 */
export function transliterateString(input: string, mode: TransliterationMode = 'on'): string {
  if (mode === 'off') {
    return input
  }

  const fed = feed(INITIAL_STATE, input)
  const flushed = flush(fed.state)
  return fed.committed + flushed.committed
}
