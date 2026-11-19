import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, createHistory, pushSnapshot, redo, undo, type EditSnapshot } from './editorHistory'

function snap(text: string, caret = text.length): EditSnapshot {
  return { text, selectionStart: caret, selectionEnd: caret }
}

describe('editorHistory: coalescing', () => {
  it('coalesces consecutive same-group pushes that are close in time and caret position', () => {
    let state = createHistory(snap(''))
    state = pushSnapshot(state, snap('a'), 'insert', 1000)
    state = pushSnapshot(state, snap('ab'), 'insert', 1100)
    state = pushSnapshot(state, snap('abc'), 'insert', 1200)

    expect(state.entries).toHaveLength(2) // initial empty + one coalesced "abc"
    expect(state.entries[1]).toEqual(snap('abc'))
  })

  it('does not coalesce across a large time gap', () => {
    let state = createHistory(snap(''))
    state = pushSnapshot(state, snap('a'), 'insert', 1000)
    state = pushSnapshot(state, snap('ab'), 'insert', 5000)

    expect(state.entries).toHaveLength(3)
  })

  it('does not coalesce across a non-contiguous caret jump', () => {
    let state = createHistory(snap(''))
    state = pushSnapshot(state, snap('hello'), 'insert', 1000)
    // typing resumes somewhere else entirely, same group, same instant
    state = pushSnapshot(state, { text: 'hello world', selectionStart: 0, selectionEnd: 0 }, 'insert', 1010)

    expect(state.entries).toHaveLength(3)
  })

  it('never coalesces group "other" (paste, clear)', () => {
    let state = createHistory(snap(''))
    state = pushSnapshot(state, snap('pasted'), 'other', 1000)
    state = pushSnapshot(state, snap('pasted again'), 'other', 1010)

    expect(state.entries).toHaveLength(3)
  })

  it('does not coalesce across a group change (insert then delete)', () => {
    let state = createHistory(snap(''))
    state = pushSnapshot(state, snap('abc'), 'insert', 1000)
    state = pushSnapshot(state, snap('ab'), 'delete', 1010)

    expect(state.entries).toHaveLength(3)
  })
})

describe('editorHistory: undo/redo', () => {
  it('returns null when there is nothing to undo', () => {
    const state = createHistory(snap(''))
    expect(undo(state)).toBeNull()
  })

  it('returns null when there is nothing to redo', () => {
    const state = createHistory(snap(''))
    expect(redo(state)).toBeNull()
  })

  it('undo then redo round-trips back to the same snapshot', () => {
    let state = createHistory(snap(''))
    state = pushSnapshot(state, snap('a'), 'insert', 1000)

    const undone = undo(state)
    expect(undone).not.toBeNull()
    expect(undone!.snapshot).toEqual(snap(''))

    const redone = redo(undone!.state)
    expect(redone).not.toBeNull()
    expect(redone!.snapshot).toEqual(snap('a'))
  })

  it('a new push after undo truncates the redo branch', () => {
    let state = createHistory(snap(''))
    state = pushSnapshot(state, snap('a'), 'insert', 1000)
    state = pushSnapshot(state, snap('ab'), 'insert', 5000) // new entry, time gap forces no coalesce

    const undone = undo(state)!
    state = pushSnapshot(undone.state, snap('ax'), 'insert', 9000)

    expect(canRedo(state)).toBe(false)
    expect(state.entries.map((e) => e.text)).toEqual(['', 'a', 'ax'])
  })

  it('clear followed by undo restores the pre-clear text', () => {
    let state = createHistory(snap(''))
    state = pushSnapshot(state, snap('hello'), 'insert', 1000)
    state = pushSnapshot(state, snap(''), 'other', 2000) // clear

    expect(canUndo(state)).toBe(true)
    const undone = undo(state)!
    expect(undone.snapshot).toEqual(snap('hello'))
  })

  it('mixed typing, paste, and clear each resolve through undo/redo correctly', () => {
    let state = createHistory(snap(''))
    state = pushSnapshot(state, snap('hi'), 'insert', 1000) // typing
    state = pushSnapshot(state, snap('hi pasted'), 'other', 1010) // paste, own entry
    state = pushSnapshot(state, snap(''), 'other', 1020) // clear, own entry

    expect(state.entries.map((e) => e.text)).toEqual(['', 'hi', 'hi pasted', ''])

    let step = undo(state)!
    expect(step.snapshot.text).toBe('hi pasted')
    step = undo(step.state)!
    expect(step.snapshot.text).toBe('hi')
    step = undo(step.state)!
    expect(step.snapshot.text).toBe('')
    expect(canUndo(step.state)).toBe(false)
  })
})

describe('editorHistory: mode toggle creates no history entry', () => {
  it('a mode toggle with no accompanying push leaves history untouched', () => {
    const state = createHistory(snap('hello'))
    // Simulates App's handleToggleMode: it never calls history.push.
    expect(state.entries).toHaveLength(1)
    expect(canUndo(state)).toBe(false)
  })
})
