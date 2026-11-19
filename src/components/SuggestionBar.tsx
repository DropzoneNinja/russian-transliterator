interface SuggestionBarProps {
  suggestions: readonly string[]
  onSelect: (word: string) => void
}

/**
 * Word completion chips for the current word at the caret. Renders
 * nothing when there are no suggestions, so it never reserves layout
 * space while idle. Clicking a chip (or Tab, handled by
 * useWordSuggestions) accepts the top suggestion.
 */
export function SuggestionBar({ suggestions, onSelect }: SuggestionBarProps) {
  if (suggestions.length === 0) return null

  return (
    <div
      aria-label="Word suggestions"
      className="flex gap-1.5 overflow-x-auto border-b border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5 sm:px-4"
    >
      {suggestions.map((word) => (
        <button
          key={word}
          type="button"
          aria-label={`Insert "${word}"`}
          onClick={() => onSelect(word)}
          className="shrink-0 rounded-full border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm text-(--color-text) hover:bg-(--color-key-bg) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
        >
          {word}
        </button>
      ))}
    </div>
  )
}
