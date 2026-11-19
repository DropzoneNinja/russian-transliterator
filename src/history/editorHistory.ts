/**
 * Pure undo/redo stack over `{text, selectionStart, selectionEnd}`
 * snapshots (PROJECT.md §6.2, TASKS.md §1.3 point 6 / §P5-3). Knows
 * nothing about the DOM or the transliteration engine.
 *
 * Coalescing policy: consecutive pushes in the same group ('insert' or
 * 'delete') within COALESCE_WINDOW_MS of each other, at a contiguous
 * caret position, replace the top entry instead of creating a new one —
 * this is what groups ordinary typing/backspacing into sensible undo
 * units instead of one entry per keystroke. A push in group 'other'
 * (paste, clear) always starts a fresh entry, so it is never merged into
 * surrounding typing and is always its own undo step.
 */

export interface EditSnapshot {
  readonly text: string
  readonly selectionStart: number
  readonly selectionEnd: number
}

export type HistoryGroup = 'insert' | 'delete' | 'other'

export interface HistoryState {
  readonly entries: readonly EditSnapshot[]
  readonly index: number
  readonly lastGroup: HistoryGroup | null
  readonly lastGroupAt: number
  readonly lastCaret: number | null
}

const COALESCE_WINDOW_MS = 700
const COALESCE_CARET_SLOP = 1

export function createHistory(initial: EditSnapshot): HistoryState {
  return { entries: [initial], index: 0, lastGroup: null, lastGroupAt: 0, lastCaret: null }
}

export function pushSnapshot(
  state: HistoryState,
  snapshot: EditSnapshot,
  group: HistoryGroup,
  now: number = Date.now(),
): HistoryState {
  const caret = snapshot.selectionEnd
  const canCoalesce =
    group !== 'other' &&
    group === state.lastGroup &&
    now - state.lastGroupAt <= COALESCE_WINDOW_MS &&
    state.lastCaret !== null &&
    Math.abs(caret - state.lastCaret) <= COALESCE_CARET_SLOP

  const entries = canCoalesce
    ? state.entries.slice(0, state.index).concat(snapshot)
    : state.entries.slice(0, state.index + 1).concat(snapshot)

  return { entries, index: entries.length - 1, lastGroup: group, lastGroupAt: now, lastCaret: caret }
}

function navigate(state: HistoryState, index: number): { state: HistoryState; snapshot: EditSnapshot } {
  const snapshot = state.entries[index]
  if (snapshot === undefined) {
    throw new Error('unreachable: history index out of bounds')
  }
  return { state: { ...state, index, lastGroup: null, lastGroupAt: 0, lastCaret: null }, snapshot }
}

export function undo(state: HistoryState): { state: HistoryState; snapshot: EditSnapshot } | null {
  if (state.index <= 0) return null
  return navigate(state, state.index - 1)
}

export function redo(state: HistoryState): { state: HistoryState; snapshot: EditSnapshot } | null {
  if (state.index >= state.entries.length - 1) return null
  return navigate(state, state.index + 1)
}

export function canUndo(state: HistoryState): boolean {
  return state.index > 0
}

export function canRedo(state: HistoryState): boolean {
  return state.index < state.entries.length - 1
}
