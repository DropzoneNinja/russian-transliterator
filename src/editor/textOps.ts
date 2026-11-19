/**
 * Pure, DOM-free text/caret helpers used by the editor input pipeline
 * (useTransliterationEditor) for delete-range resolution and for diffing a
 * before/after snapshot around IME composition and the input-event
 * fallback path. See TASKS.md §1.4.
 */

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

/** Index one Unicode code point back from `index`, never splitting a surrogate pair. */
export function stepBackOneCodePoint(text: string, index: number): number {
  if (index <= 0) return 0
  if (index >= 2 && isLowSurrogate(text.charCodeAt(index - 1)) && isHighSurrogate(text.charCodeAt(index - 2))) {
    return index - 2
  }
  return index - 1
}

/** Index one Unicode code point forward from `index`, never splitting a surrogate pair. */
export function stepForwardOneCodePoint(text: string, index: number): number {
  if (index >= text.length) return text.length
  if (
    index + 1 < text.length &&
    isHighSurrogate(text.charCodeAt(index)) &&
    isLowSurrogate(text.charCodeAt(index + 1))
  ) {
    return index + 2
  }
  return index + 1
}

const WORD_CHAR = /[\p{L}\p{N}]/u

/** Start of the "word" (or run of separators) immediately before `index`, for Ctrl/Option+Backspace. */
export function findWordBoundaryBackward(text: string, index: number): number {
  let i = index
  while (i > 0 && !WORD_CHAR.test(text.charAt(i - 1))) i -= 1
  while (i > 0 && WORD_CHAR.test(text.charAt(i - 1))) i -= 1
  return i
}

/** End of the "word" (or run of separators) immediately after `index`, for Ctrl/Option+Delete. */
export function findWordBoundaryForward(text: string, index: number): number {
  const len = text.length
  let i = index
  while (i < len && !WORD_CHAR.test(text.charAt(i))) i += 1
  while (i < len && WORD_CHAR.test(text.charAt(i))) i += 1
  return i
}

/** Start of the line containing `index` (after the previous "\n", or 0). */
export function findLineStart(text: string, index: number): number {
  const lastBreak = text.lastIndexOf('\n', Math.max(0, index - 1))
  return lastBreak === -1 ? 0 : lastBreak + 1
}

/** End of the line containing `index` (before the next "\n", or end of text). */
export function findLineEnd(text: string, index: number): number {
  const nextBreak = text.indexOf('\n', index)
  return nextBreak === -1 ? text.length : nextBreak
}

export interface TextDiff {
  readonly start: number
  readonly deletedLength: number
  readonly inserted: string
}

/**
 * Minimal common-prefix/common-suffix diff between two full-text snapshots.
 * Used where the browser has already mutated the DOM natively (IME
 * composition, or the no-beforeinput fallback) and the inserted span must
 * be recovered after the fact rather than known up front.
 */
export function diffReplacement(oldText: string, newText: string): TextDiff {
  const maxPrefix = Math.min(oldText.length, newText.length)
  let prefix = 0
  while (prefix < maxPrefix && oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)) {
    prefix += 1
  }

  let oldEnd = oldText.length
  let newEnd = newText.length
  while (
    oldEnd > prefix &&
    newEnd > prefix &&
    oldText.charCodeAt(oldEnd - 1) === newText.charCodeAt(newEnd - 1)
  ) {
    oldEnd -= 1
    newEnd -= 1
  }

  return { start: prefix, deletedLength: oldEnd - prefix, inserted: newText.slice(prefix, newEnd) }
}
