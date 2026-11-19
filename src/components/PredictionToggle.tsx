interface PredictionToggleProps {
  enabled: boolean
  onToggle: () => void
}

/**
 * Word completion/prediction on/off toggle. State is conveyed through
 * the button's own text ("Suggestions: On"/"Off") as well as weight, not
 * colour alone (PROJECT.md §8.2).
 */
export function PredictionToggle({ enabled, onToggle }: PredictionToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      title="Toggle word suggestions"
      onClick={onToggle}
      className="min-h-9 min-w-9 rounded-md border border-(--color-border) px-3 py-1.5 text-sm font-medium hover:bg-(--color-surface-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
    >
      <span className={enabled ? 'font-semibold text-(--color-text)' : 'text-(--color-text-muted)'}>
        Suggestions: {enabled ? 'On' : 'Off'}
      </span>
    </button>
  )
}
