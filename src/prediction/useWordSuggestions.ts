import { useCallback, useEffect, useRef, useState } from 'react'
import { suggestCompletions } from './suggest'
import type { EditSnapshot } from '../editor/useTransliterationEditor'

const MIN_PREFIX_LENGTH = 2
const MAX_SUGGESTIONS = 5

/** Cyrillic letters only — a Latin pending/literal span never counts as a completable word. */
const CYRILLIC_LETTER = /[а-яёА-ЯЁ]/

interface WordRange {
  readonly start: number
  readonly end: number
}

export interface UseWordSuggestionsOptions {
  readonly textareaRef: React.RefObject<HTMLTextAreaElement | null>
  readonly enabled: boolean
  /**
   * The editor's current text. Not read directly — only used as a
   * recompute trigger. The editor applies every mutation (typing,
   * deleting, undo/redo, programmatic changes) straight to the DOM
   * without necessarily firing a native `input`/`selectionchange` event
   * (it intercepts and replaces the native input pipeline), so reacting
   * to this value changing is the one reliable signal that the DOM may
   * have moved. The actual caret position is still read fresh from the
   * textarea at recompute time.
   */
  readonly text: string
  /** Called with the snapshot to apply when a suggestion is accepted (via click or Tab). */
  readonly onAccept: (snapshot: EditSnapshot) => void
}

export interface WordSuggestionsHandle {
  readonly suggestions: readonly string[]
  /**
   * The remainder of the top suggestion past what's already typed, for
   * rendering as inline ghost text — only ever non-empty when the caret
   * is at the very end of the text (showing it mid-document would visually
   * collide with real characters already sitting right after the caret).
   */
  readonly ghostSuffix: string
  readonly accept: (word: string) => void
}

/**
 * Tracks the Cyrillic word immediately before the caret and surfaces up
 * to a handful of completion suggestions for it. Reads the textarea
 * directly off the shared ref (independent of useTransliterationEditor)
 * and only ever proposes a *replacement snapshot* via `onAccept` — it
 * never mutates the DOM itself, so accepting a suggestion goes through
 * the same history/persistence pipeline as every other edit.
 */
export function useWordSuggestions(options: UseWordSuggestionsOptions): WordSuggestionsHandle {
  const { textareaRef } = options
  const enabledRef = useRef(options.enabled)
  const onAcceptRef = useRef(options.onAccept)
  const rangeRef = useRef<WordRange | null>(null)
  const suggestionsRef = useRef<readonly string[]>([])
  const [suggestions, setSuggestions] = useState<readonly string[]>([])
  const [ghostSuffix, setGhostSuffix] = useState('')

  useEffect(() => {
    enabledRef.current = options.enabled
    onAcceptRef.current = options.onAccept
  }, [options.enabled, options.onAccept])

  const applyResult = useCallback((next: readonly string[], range: WordRange | null, ghost: string) => {
    rangeRef.current = range
    suggestionsRef.current = next
    setSuggestions(next)
    setGhostSuffix(ghost)
  }, [])

  const recompute = useCallback((): void => {
    const ta = textareaRef.current
    if (ta === null || !enabledRef.current || ta.selectionStart !== ta.selectionEnd) {
      applyResult([], null, '')
      return
    }

    const caret = ta.selectionStart
    const value = ta.value
    let start = caret
    while (start > 0 && CYRILLIC_LETTER.test(value.charAt(start - 1))) start -= 1
    const prefix = value.slice(start, caret)

    if (prefix.length < MIN_PREFIX_LENGTH) {
      applyResult([], null, '')
      return
    }

    const matches = suggestCompletions(prefix, MAX_SUGGESTIONS)
    const top = matches[0]
    const ghost = top !== undefined && caret === value.length ? top.slice(prefix.length) : ''
    applyResult(matches, matches.length > 0 ? { start, end: caret } : null, ghost)
  }, [applyResult, textareaRef])

  const accept = useCallback(
    (word: string): void => {
      const ta = textareaRef.current
      const range = rangeRef.current
      if (ta === null || range === null) return

      const before = ta.value.slice(0, range.start)
      const after = ta.value.slice(range.end)
      const insertion = `${word} `
      const newText = before + insertion + after
      const newCaret = before.length + insertion.length

      applyResult([], null, '')
      onAcceptRef.current({ text: newText, selectionStart: newCaret, selectionEnd: newCaret })
    },
    [applyResult, textareaRef],
  )

  // Primary recompute trigger: the editor's text changed (covers typing,
  // deleting, paste, undo/redo, clear, flush, and accepting a suggestion
  // itself), or the feature was toggled on/off. Reads the fresh caret
  // position off the DOM at that moment.
  useEffect(() => {
    recompute()
  }, [options.enabled, options.text, recompute])

  // Secondary trigger, for browsers that fire it: a pure caret move with
  // no accompanying text change (arrow keys, click) still updates suggestions.
  useEffect(() => {
    const ta = textareaRef.current
    if (ta === null) return

    function handleSelectionChange(): void {
      if (document.activeElement !== ta) return
      recompute()
    }

    function handleKeyDown(event: KeyboardEvent): void {
      const top = suggestionsRef.current[0]
      if (top === undefined) return

      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault()
        accept(top)
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    ta.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      ta.removeEventListener('keydown', handleKeyDown)
    }
  }, [accept, recompute, textareaRef])

  return { suggestions, ghostSuffix, accept }
}
