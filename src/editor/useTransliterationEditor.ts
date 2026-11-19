import { useCallback, useEffect, useRef } from 'react'
import { INITIAL_STATE, feed, flush, type EngineState } from '../transliteration/engine'
import type { TransliterationMode } from '../transliteration/transliterate'
import type { EditSnapshot, HistoryGroup } from '../history/editorHistory'
import {
  diffReplacement,
  findLineEnd,
  findLineStart,
  findWordBoundaryBackward,
  findWordBoundaryForward,
  stepBackOneCodePoint,
  stepForwardOneCodePoint,
} from './textOps'

export type { EditSnapshot, HistoryGroup }

/**
 * A genuinely ambiguous pending sequence (e.g. "y", which could still
 * extend to "ya"/"yo"/"yu") legitimately has to wait for more input to
 * know what it resolves to. But if nothing else arrives — the user typed
 * it as the last character and stopped — it must not hang forever
 * (ISSUES.md: "Y does not work"). Auto-flush it after a short idle pause.
 */
const AUTO_FLUSH_IDLE_MS = 500

/**
 * "y" alone is genuinely ambiguous with "ya"/"yo"/"yu" (я/ё/ю), but
 * waiting for a possible follow-up character made it feel laggy
 * (ISSUES.md follow-up). Instead, "y" commits to "ы" the instant it's
 * typed; if "u"/"o"/"a" follows within this window at the same spot, it
 * retroactively turns the "ы" into "ю"/"ё"/"я". A pause of 2s or more
 * before the follow-up character means it's treated as unrelated.
 */
const Y_MERGE_WINDOW_MS = 2000
const Y_MERGE_TARGETS: Record<string, string> = { u: 'ю', o: 'ё', a: 'я' }

interface YShortcut {
  readonly anchor: number
  readonly committedAt: number
  readonly isUpper: boolean
}

export interface UseTransliterationEditorOptions {
  readonly mode: TransliterationMode
  readonly initial: EditSnapshot
  /** Called for every edit that should become (or extend) a history entry. */
  readonly onMutate: (snapshot: EditSnapshot, group: HistoryGroup) => void
  /** Called after every text change, committed or externally applied, for derived UI state (counts, persistence). */
  readonly onTextChange: (text: string) => void
}

export interface TransliterationEditorHandle {
  readonly textareaRef: React.RefObject<HTMLTextAreaElement | null>
  /** Set text+selection directly (undo/redo/clear), bypassing history and resetting any pending sequence. */
  readonly applyExternalChange: (snapshot: EditSnapshot) => void
  /** Resolve any in-flight pending sequence into the DOM now (flush trigger — e.g. before a mode switch). */
  readonly flushPending: () => void
}

/**
 * Owns the uncontrolled editor textarea and the live transliteration input
 * pipeline (PROJECT.md §5.7, TASKS.md §1.4). The textarea's `.value` and
 * selection are driven imperatively; engine state lives in refs so that
 * applying a conversion never triggers a React re-render that could race
 * the caret. React only learns about the result afterwards, via
 * `onMutate`/`onTextChange`, for history and derived display state.
 */
export function useTransliterationEditor(
  options: UseTransliterationEditorOptions,
): TransliterationEditorHandle {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const modeRef = useRef(options.mode)
  const onMutateRef = useRef(options.onMutate)
  const onTextChangeRef = useRef(options.onTextChange)
  const initialRef = useRef(options.initial)

  // Refs may not be written during render (react-hooks/refs) — sync them
  // in an effect instead; handlers below only ever read `.current`.
  useEffect(() => {
    modeRef.current = options.mode
    onMutateRef.current = options.onMutate
    onTextChangeRef.current = options.onTextChange
  }, [options.mode, options.onMutate, options.onTextChange])

  /** The Latin substring immediately before the caret that is still a valid prefix of a longer mapping (TASKS.md §1.3). */
  const engineRef = useRef<EngineState>(INITIAL_STATE)
  /** Caret offset immediately after the pending span (0 when nothing is pending). */
  const pendingAnchorRef = useRef(0)
  /** The textarea value as of the last mutation we know about, for the input-event fallback diff. */
  const lastKnownValueRef = useRef(options.initial.text)
  const isComposingRef = useRef(false)
  const compositionSnapshotRef = useRef<EditSnapshot | null>(null)
  const autoFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** A just-committed "y" -> "ы" eligible for retroactive merging into "ю"/"ё"/"я". */
  const yShortcutRef = useRef<YShortcut | null>(null)

  const commitMutation = useCallback((snapshot: EditSnapshot, group: HistoryGroup) => {
    lastKnownValueRef.current = snapshot.text
    onMutateRef.current(snapshot, group)
    onTextChangeRef.current(snapshot.text)
  }, [])

  const clearAutoFlushTimer = useCallback((): void => {
    if (autoFlushTimerRef.current !== null) {
      clearTimeout(autoFlushTimerRef.current)
      autoFlushTimerRef.current = null
    }
  }, [])

  /** Resolve the pending buffer into the DOM, adjusting any out-of-region selection for the length change. */
  const flushPendingIntoDom = useCallback((): void => {
    clearAutoFlushTimer()
    yShortcutRef.current = null
    const ta = textareaRef.current
    const pendingRaw = engineRef.current.pendingRaw
    if (ta === null || pendingRaw === '') return

    const anchor = pendingAnchorRef.current
    const { committed } = flush(engineRef.current)
    engineRef.current = INITIAL_STATE

    const spanStart = anchor - pendingRaw.length
    const before = ta.value.slice(0, spanStart)
    const after = ta.value.slice(anchor)
    const newValue = before + committed + after
    const delta = committed.length - pendingRaw.length

    const adjust = (pos: number) => (pos >= anchor ? pos + delta : pos)
    const newSelStart = adjust(ta.selectionStart)
    const newSelEnd = adjust(ta.selectionEnd)

    ta.value = newValue
    ta.setSelectionRange(newSelStart, newSelEnd)
    pendingAnchorRef.current = newSelEnd

    commitMutation({ text: newValue, selectionStart: newSelStart, selectionEnd: newSelEnd }, 'insert')
  }, [clearAutoFlushTimer, commitMutation])

  /** Schedule (or cancel) an idle auto-flush of whatever is currently pending. */
  const scheduleAutoFlush = useCallback((): void => {
    clearAutoFlushTimer()
    if (engineRef.current.pendingRaw === '') return
    autoFlushTimerRef.current = setTimeout(() => {
      autoFlushTimerRef.current = null
      flushPendingIntoDom()
    }, AUTO_FLUSH_IDLE_MS)
  }, [clearAutoFlushTimer, flushPendingIntoDom])

  /** Flush if the caret/selection is no longer exactly where the pending span ends (a flush trigger). */
  const ensurePendingConsistency = useCallback(
    (start: number, end: number): void => {
      const anchor = pendingAnchorRef.current
      if (engineRef.current.pendingRaw === '') {
        pendingAnchorRef.current = start
        return
      }
      if (start === anchor && end === anchor) return
      flushPendingIntoDom()
    },
    [flushPendingIntoDom],
  )

  const performInsert = useCallback(
    (start: number, end: number, raw: string, group: HistoryGroup, flushAfter: boolean): void => {
      const ta = textareaRef.current
      if (ta === null || raw === '') return

      // Retroactive y-merge: a lone "y" just committed to "ы" right here;
      // "u"/"o"/"a" arriving now, at the same spot, within the window
      // means the user meant "yu"/"yo"/"ya" all along.
      const yShortcut = yShortcutRef.current
      yShortcutRef.current = null
      if (yShortcut !== null && start === end && start === yShortcut.anchor && raw.length === 1) {
        const merge = Y_MERGE_TARGETS[raw.toLowerCase()]
        if (merge !== undefined && Date.now() - yShortcut.committedAt < Y_MERGE_WINDOW_MS) {
          const replacement = yShortcut.isUpper ? merge.toUpperCase() : merge
          const before = ta.value.slice(0, start - 1)
          const after = ta.value.slice(end)
          const newValue = before + replacement + after
          const newCaret = before.length + replacement.length
          ta.value = newValue
          ta.setSelectionRange(newCaret, newCaret)
          pendingAnchorRef.current = newCaret
          commitMutation({ text: newValue, selectionStart: newCaret, selectionEnd: newCaret }, 'insert')
          return
        }
      }

      ensurePendingConsistency(start, end)

      const curStart = ta.selectionStart
      const curEnd = ta.selectionEnd
      const oldPendingLen = engineRef.current.pendingRaw.length
      const spanStart = curStart - oldPendingLen

      let committedText: string
      let state: EngineState
      if (modeRef.current === 'off') {
        committedText = raw
        state = INITIAL_STATE
      } else {
        const result = feed(engineRef.current, raw)
        committedText = result.committed
        state = result.state
        if (flushAfter && state.pendingRaw !== '') {
          committedText += flush(state).committed
          state = INITIAL_STATE
        }
      }

      // Instant "y" shortcut: rather than leaving a lone "y" pending
      // (ambiguous with ya/yo/yu), resolve it to "ы" immediately and
      // remember the moment for a possible retroactive merge above.
      let yShortcutIsUpper: boolean | null = null
      if (modeRef.current === 'on' && (state.pendingRaw === 'y' || state.pendingRaw === 'Y')) {
        yShortcutIsUpper = state.pendingRaw === 'Y'
        committedText += flush(state).committed
        state = INITIAL_STATE
      }

      const before = ta.value.slice(0, spanStart)
      const after = ta.value.slice(curEnd)
      const inserted = committedText + state.pendingRaw
      const newValue = before + inserted + after
      const newCaret = before.length + inserted.length

      ta.value = newValue
      ta.setSelectionRange(newCaret, newCaret)
      engineRef.current = state
      pendingAnchorRef.current = newCaret

      if (yShortcutIsUpper !== null) {
        yShortcutRef.current = { anchor: newCaret, committedAt: Date.now(), isUpper: yShortcutIsUpper }
      }

      commitMutation({ text: newValue, selectionStart: newCaret, selectionEnd: newCaret }, group)
      scheduleAutoFlush()
    },
    [commitMutation, ensurePendingConsistency, scheduleAutoFlush],
  )

  const performDelete = useCallback(
    (inputType: string, start: number, end: number): void => {
      const ta = textareaRef.current
      if (ta === null) return

      yShortcutRef.current = null
      const pendingRaw = engineRef.current.pendingRaw
      const anchor = pendingAnchorRef.current

      // Fast path: plain backspace right after an in-flight ambiguous
      // sequence just un-types the last raw character, rather than
      // committing-then-deleting (keeps "sh" -> backspace -> "s" instead
      // of "sh" -> "ш" -> deleted entirely).
      if (pendingRaw !== '' && inputType === 'deleteContentBackward' && start === end && start === anchor) {
        const newPendingRaw = pendingRaw.slice(0, -1)
        const spanStart = anchor - pendingRaw.length
        const newValue = ta.value.slice(0, spanStart) + newPendingRaw + ta.value.slice(anchor)
        const newCaret = anchor - 1
        ta.value = newValue
        ta.setSelectionRange(newCaret, newCaret)
        engineRef.current = { pendingRaw: newPendingRaw }
        pendingAnchorRef.current = newCaret
        commitMutation({ text: newValue, selectionStart: newCaret, selectionEnd: newCaret }, 'delete')
        scheduleAutoFlush()
        return
      }

      // General case: deletes always operate on fully-resolved text —
      // flush first (a delete is itself "the caret moving away from the
      // pending position", TASKS.md §1.3 point 3).
      flushPendingIntoDom()

      const curStart = ta.selectionStart
      const curEnd = ta.selectionEnd
      const value = ta.value

      let delStart: number
      let delEnd: number
      if (curStart !== curEnd) {
        delStart = curStart
        delEnd = curEnd
      } else {
        switch (inputType) {
          case 'deleteContentForward':
            delStart = curStart
            delEnd = stepForwardOneCodePoint(value, curStart)
            break
          case 'deleteWordBackward':
            delStart = findWordBoundaryBackward(value, curStart)
            delEnd = curStart
            break
          case 'deleteWordForward':
            delStart = curStart
            delEnd = findWordBoundaryForward(value, curStart)
            break
          case 'deleteSoftLineBackward':
          case 'deleteHardLineBackward':
            delStart = findLineStart(value, curStart)
            delEnd = curStart
            break
          case 'deleteSoftLineForward':
          case 'deleteHardLineForward':
            delStart = curStart
            delEnd = findLineEnd(value, curStart)
            break
          case 'deleteEntireSoftLine':
            delStart = findLineStart(value, curStart)
            delEnd = findLineEnd(value, curStart)
            break
          case 'deleteContentBackward':
          default:
            delStart = stepBackOneCodePoint(value, curStart)
            delEnd = curStart
        }
      }

      const newValue = value.slice(0, delStart) + value.slice(delEnd)
      ta.value = newValue
      ta.setSelectionRange(delStart, delStart)
      pendingAnchorRef.current = delStart

      commitMutation({ text: newValue, selectionStart: delStart, selectionEnd: delStart }, 'delete')
    },
    [commitMutation, flushPendingIntoDom, scheduleAutoFlush],
  )

  const applyExternalChange = useCallback(
    (snapshot: EditSnapshot): void => {
      const ta = textareaRef.current
      if (ta === null) return
      clearAutoFlushTimer()
      yShortcutRef.current = null
      ta.value = snapshot.text
      ta.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd)
      ta.focus()
      engineRef.current = INITIAL_STATE
      pendingAnchorRef.current = snapshot.selectionEnd
      lastKnownValueRef.current = snapshot.text
      onTextChangeRef.current(snapshot.text)
    },
    [clearAutoFlushTimer],
  )

  const flushPending = useCallback((): void => {
    flushPendingIntoDom()
  }, [flushPendingIntoDom])

  // Mount-only: wire native listeners directly to the textarea/document so
  // `beforeinput` can be reliably prevented, and so none of this needs to
  // re-subscribe on every render (everything it reads is a ref).
  useEffect(() => {
    const ta = textareaRef.current
    if (ta === null) return

    ta.value = initialRef.current.text
    const initialCaret = initialRef.current.text.length
    ta.setSelectionRange(initialCaret, initialCaret)
    pendingAnchorRef.current = initialCaret
    lastKnownValueRef.current = initialRef.current.text

    function handleBeforeInput(event: InputEvent): void {
      if (event.inputType === 'insertCompositionText') return // let the IME run; compositionend converts

      event.preventDefault()
      const start = ta!.selectionStart
      const end = ta!.selectionEnd

      if (event.inputType.startsWith('delete')) {
        performDelete(event.inputType, start, end)
        return
      }

      if (event.inputType === 'insertText') {
        performInsert(start, end, event.data ?? '', 'insert', false)
        return
      }

      if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
        // Enter in a <textarea> fires insertLineBreak with `data: null` —
        // the newline itself is implicit, not carried in `event.data`
        // (ISSUES.md: "allow return/enter").
        performInsert(start, end, '\n', 'insert', true)
        return
      }

      if (event.inputType === 'insertFromDrop') {
        performInsert(start, end, event.data ?? '', 'other', true)
        return
      }

      if (event.inputType === 'insertFromPaste') {
        // Primary handling is the native `paste` listener below; this is a
        // defensive fallback in case that listener didn't already consume it.
        const data = event.data
        if (data !== null && data !== '') performInsert(start, end, data, 'other', true)
      }
    }

    function handleCompositionStart(): void {
      flushPendingIntoDom()
      compositionSnapshotRef.current = {
        text: ta!.value,
        selectionStart: ta!.selectionStart,
        selectionEnd: ta!.selectionEnd,
      }
      isComposingRef.current = true
    }

    function handleCompositionEnd(): void {
      const snapshot = compositionSnapshotRef.current
      compositionSnapshotRef.current = null
      isComposingRef.current = false
      if (snapshot === null) return

      const diff = diffReplacement(snapshot.text, ta!.value)
      const before = ta!.value.slice(0, diff.start)
      const after = ta!.value.slice(diff.start + diff.inserted.length)

      let committedText: string
      if (modeRef.current === 'off') {
        committedText = diff.inserted
      } else {
        const fed = feed(INITIAL_STATE, diff.inserted)
        committedText = fed.committed + flush(fed.state).committed
      }

      const newValue = before + committedText + after
      const newCaret = before.length + committedText.length
      ta!.value = newValue
      ta!.setSelectionRange(newCaret, newCaret)
      engineRef.current = INITIAL_STATE
      pendingAnchorRef.current = newCaret
      clearAutoFlushTimer()
      yShortcutRef.current = null

      commitMutation({ text: newValue, selectionStart: newCaret, selectionEnd: newCaret }, 'other')
    }

    function handleInput(): void {
      if (isComposingRef.current) return
      if (ta!.value === lastKnownValueRef.current) return // already handled via beforeinput

      // beforeinput wasn't intercepted (unsupported browser path):
      // resynchronize via diff against the last known value.
      const diff = diffReplacement(lastKnownValueRef.current, ta!.value)
      const before = ta!.value.slice(0, diff.start)
      const after = ta!.value.slice(diff.start + diff.inserted.length)

      let committedText: string
      if (modeRef.current === 'off') {
        committedText = diff.inserted
      } else {
        const fed = feed(INITIAL_STATE, diff.inserted)
        committedText = fed.committed + flush(fed.state).committed
      }

      const newValue = before + committedText + after
      const newCaret = before.length + committedText.length
      ta!.value = newValue
      ta!.setSelectionRange(newCaret, newCaret)
      engineRef.current = INITIAL_STATE
      pendingAnchorRef.current = newCaret
      clearAutoFlushTimer()
      yShortcutRef.current = null

      commitMutation({ text: newValue, selectionStart: newCaret, selectionEnd: newCaret }, 'other')
    }

    function handlePaste(event: ClipboardEvent): void {
      const text = event.clipboardData?.getData('text/plain') ?? ''
      event.preventDefault()
      if (text === '') return
      performInsert(ta!.selectionStart, ta!.selectionEnd, text, 'other', true)
    }

    function handleBlur(): void {
      flushPendingIntoDom()
    }

    function handleSelectionChange(): void {
      if (document.activeElement !== ta) return
      ensurePendingConsistency(ta!.selectionStart, ta!.selectionEnd)
    }

    ta.addEventListener('beforeinput', handleBeforeInput)
    ta.addEventListener('compositionstart', handleCompositionStart)
    ta.addEventListener('compositionend', handleCompositionEnd)
    ta.addEventListener('input', handleInput)
    ta.addEventListener('paste', handlePaste)
    ta.addEventListener('blur', handleBlur)
    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      ta.removeEventListener('beforeinput', handleBeforeInput)
      ta.removeEventListener('compositionstart', handleCompositionStart)
      ta.removeEventListener('compositionend', handleCompositionEnd)
      ta.removeEventListener('input', handleInput)
      ta.removeEventListener('paste', handlePaste)
      ta.removeEventListener('blur', handleBlur)
      document.removeEventListener('selectionchange', handleSelectionChange)
      clearAutoFlushTimer()
    }
  }, [
    clearAutoFlushTimer,
    commitMutation,
    ensurePendingConsistency,
    flushPendingIntoDom,
    performDelete,
    performInsert,
  ])

  return { textareaRef, applyExternalChange, flushPending }
}
