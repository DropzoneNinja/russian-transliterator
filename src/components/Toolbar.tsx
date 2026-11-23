import { useCallback, useEffect, useRef, useState } from 'react'
import { ModeToggle } from './ModeToggle'
import { PredictionToggle } from './PredictionToggle'
import type { TransliterationMode } from '../transliteration/transliterate'

interface ToolbarProps {
  mode: TransliterationMode
  onToggleMode: () => void
  predictionEnabled: boolean
  onTogglePrediction: () => void
  onCopy: () => Promise<boolean>
  onClear: () => void
  onUndo: () => void
  onRedo: () => void
  onDownload: () => void
  canUndo: boolean
  canRedo: boolean
  hasText: boolean
  onTranslitSelection: () => void
  canTranslitSelection: boolean
  suggestions: readonly string[]
  onSelectSuggestion: (word: string) => void
}

const BUTTON_CLASS =
  'min-h-9 min-w-9 rounded-md border border-(--color-border) px-3 py-1.5 text-sm font-medium text-(--color-text) hover:bg-(--color-surface-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring) disabled:cursor-not-allowed disabled:opacity-40'

const FEEDBACK_MS = 2000

/**
 * Toolbar actions (PROJECT.md §4.5). Copy/Clear/Undo/Redo/Download are
 * wired by App to the editor/history modules; this component owns only
 * the transient, non-modal "Copied"/"Copy failed" feedback.
 */
export function Toolbar({
  mode,
  onToggleMode,
  predictionEnabled,
  onTogglePrediction,
  onCopy,
  onClear,
  onUndo,
  onRedo,
  onDownload,
  canUndo,
  canRedo,
  hasText,
  onTranslitSelection,
  canTranslitSelection,
  suggestions,
  onSelectSuggestion,
}: ToolbarProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  const handleCopy = useCallback(() => {
    void onCopy().then((ok) => {
      setFeedback(ok ? 'Copied' : 'Copy failed')
      if (feedbackTimerRef.current !== null) clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), FEEDBACK_MS)
    })
  }, [onCopy])

  return (
    <div
      role="toolbar"
      aria-label="Editor actions"
      className="flex flex-wrap items-center gap-2 border-b border-(--color-border) bg-(--color-surface) px-3 py-2 sm:px-4"
    >
      <button type="button" title="Copy" aria-label="Copy" onClick={handleCopy} className={BUTTON_CLASS}>
        Copy
      </button>
      <button
        type="button"
        title="Clear"
        aria-label="Clear"
        onClick={onClear}
        disabled={!hasText}
        className={BUTTON_CLASS}
      >
        Clear
      </button>
      <button
        type="button"
        title="Undo"
        aria-label="Undo"
        onClick={onUndo}
        disabled={!canUndo}
        className={BUTTON_CLASS}
      >
        Undo
      </button>
      <button
        type="button"
        title="Redo"
        aria-label="Redo"
        onClick={onRedo}
        disabled={!canRedo}
        className={BUTTON_CLASS}
      >
        Redo
      </button>
      <button
        type="button"
        title="Translit Selection"
        aria-label="Translit Selection"
        onClick={onTranslitSelection}
        disabled={!canTranslitSelection}
        className={BUTTON_CLASS}
      >
        Translit
      </button>
      <ModeToggle mode={mode} onToggle={onToggleMode} />
      <PredictionToggle enabled={predictionEnabled} onToggle={onTogglePrediction} />
      <button type="button" title="Download" aria-label="Download" onClick={onDownload} className={BUTTON_CLASS}>
        Download
      </button>
      <span role="status" aria-live="polite" className="text-xs text-(--color-text-muted)">
        {feedback}
      </span>
      {suggestions.length > 0 && (
        <>
          <div aria-hidden="true" className="min-w-2 flex-1" />
          <div aria-label="Word suggestions" className="flex flex-wrap items-center gap-1.5">
            {suggestions.map((word) => (
              <button
                key={word}
                type="button"
                aria-label={`Insert "${word}"`}
                onClick={() => onSelectSuggestion(word)}
                className="shrink-0 rounded-full border border-(--color-border) bg-(--color-key-bg) px-3 py-1 text-sm text-(--color-key-text) hover:bg-(--color-surface-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
              >
                {word}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
