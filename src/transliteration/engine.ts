import { MAPPING, SEPARATOR } from './mapping'

/**
 * Streaming longest-match transliteration engine. See TASKS.md §1.3 for
 * the full resolved algorithm this implements; this file is the
 * reference implementation of that algorithm.
 *
 * `pendingRaw` holds the Latin substring immediately before the caret
 * that is still a valid prefix of a longer mapping and so cannot be
 * committed yet. It is always empty or a prefix of some key, and (given
 * the mapping table's structure) never grows beyond 2 characters before
 * a 3rd character either completes a mapping or forces a flush.
 */
export interface EngineState {
  readonly pendingRaw: string
}

export const INITIAL_STATE: EngineState = { pendingRaw: '' }

export interface EngineResult {
  readonly state: EngineState
  readonly committed: string
}

const EXACT_MATCH = new Map<string, string>()
const ALL_KEYS: string[] = []

for (const entry of MAPPING) {
  for (const input of entry.inputs) {
    const key = input.toLowerCase()
    EXACT_MATCH.set(key, entry.cyrillic)
    ALL_KEYS.push(key)
  }
}

function hasLongerExtension(candidateLower: string): boolean {
  return ALL_KEYS.some(
    (key) => key.length > candidateLower.length && key.startsWith(candidateLower),
  )
}

/**
 * Case rule (PROJECT.md §5.3, resolved in TASKS.md §1.3 point 5): the
 * output is uppercase exactly when the first character of the matched
 * input sequence is uppercase. A single rule covers both "Zh" -> "Ж"
 * (title case) and "SHH" -> "Щ" (all caps) because the Cyrillic output is
 * always exactly one character, so there is no intermediate case to
 * represent.
 */
function applyCase(inputSeq: string, cyrillicLower: string): string {
  const firstChar = inputSeq.charAt(0)
  const isUpper = firstChar !== '' && firstChar !== firstChar.toLowerCase()
  return isUpper ? cyrillicLower.toUpperCase() : cyrillicLower
}

type StepOutcome =
  | { readonly kind: 'buffer'; readonly pendingRaw: string }
  | { readonly kind: 'commit'; readonly committed: string }
  | { readonly kind: 'mismatch' }

function step(pendingRaw: string, char: string): StepOutcome {
  const candidate = pendingRaw + char
  const candidateLower = candidate.toLowerCase()

  if (hasLongerExtension(candidateLower)) {
    return { kind: 'buffer', pendingRaw: candidate }
  }

  const exact = EXACT_MATCH.get(candidateLower)
  if (exact !== undefined) {
    return { kind: 'commit', committed: applyCase(candidate, exact) }
  }

  return { kind: 'mismatch' }
}

/**
 * Force-resolve a pending buffer with no further input arriving (a flush
 * trigger). Finds the longest prefix of `pendingRaw` that is itself a
 * complete mapping, commits it, and recurses on whatever is left — which,
 * given the mapping table's invariant that every reachable prefix has a
 * matching head, fully consumes `pendingRaw`.
 */
function flushPending(pendingRaw: string): string {
  if (pendingRaw === '') {
    return ''
  }

  for (let len = pendingRaw.length; len >= 1; len -= 1) {
    const prefix = pendingRaw.slice(0, len)
    const exact = EXACT_MATCH.get(prefix.toLowerCase())
    if (exact !== undefined) {
      return applyCase(prefix, exact) + flushPending(pendingRaw.slice(len))
    }
  }

  // Defensive: should be unreachable given the mapping table's invariant,
  // but keep this total rather than throwing on an unexpected state.
  return pendingRaw.charAt(0) + flushPending(pendingRaw.slice(1))
}

function feedOne(pendingRaw: string, char: string): { pendingRaw: string; committed: string } {
  if (char === SEPARATOR) {
    return { pendingRaw: '', committed: flushPending(pendingRaw) }
  }

  const outcome = step(pendingRaw, char)
  if (outcome.kind === 'buffer') {
    return { pendingRaw: outcome.pendingRaw, committed: '' }
  }
  if (outcome.kind === 'commit') {
    return { pendingRaw: '', committed: outcome.committed }
  }

  // Mismatch: the old buffer cannot extend with this character, so it is a
  // flush trigger. Flush it, then evaluate `char` fresh on its own — this
  // is also how whitespace, punctuation, digits, emoji, and existing
  // Cyrillic are handled: none of them extend or match anything, so they
  // fall through to the literal-passthrough case below.
  const flushedCommitted = flushPending(pendingRaw)
  const freshOutcome = step('', char)

  if (freshOutcome.kind === 'buffer') {
    return { pendingRaw: freshOutcome.pendingRaw, committed: flushedCommitted }
  }
  if (freshOutcome.kind === 'commit') {
    return { pendingRaw: '', committed: flushedCommitted + freshOutcome.committed }
  }
  return { pendingRaw: '', committed: flushedCommitted + char }
}

/**
 * Feed a chunk of newly-typed or pasted Latin/other text through the
 * engine. Does not resolve a trailing pending buffer — call `flush` for
 * that once no more adjacent input is coming.
 */
export function feed(state: EngineState, chunk: string): EngineResult {
  let pendingRaw = state.pendingRaw
  let committed = ''

  for (const char of chunk) {
    const result = feedOne(pendingRaw, char)
    pendingRaw = result.pendingRaw
    committed += result.committed
  }

  return { state: { pendingRaw }, committed }
}

/** Resolve any pending buffer now (PROJECT.md §5.4 point 4's flush triggers). */
export function flush(state: EngineState): EngineResult {
  return { state: INITIAL_STATE, committed: flushPending(state.pendingRaw) }
}
