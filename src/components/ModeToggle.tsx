import type { TransliterationMode } from '../transliteration/transliterate'

interface ModeToggleProps {
  mode: TransliterationMode
  onToggle: () => void
}

/**
 * Cyrillic/Roman output toggle (PROJECT.md §4.3 — "Translit ON/OFF" under
 * the hood). State is lifted to App so it can drive the editor engine, be
 * saved locally, and be toggled from the Escape shortcut too. The active
 * side is conveyed through weight/colour together, never colour alone
 * (§8.2). Labelled with the actual Russian names for the two scripts
 * (ISSUES.md) rather than their English names.
 */
export function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  const isCyrillic = mode === 'on'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isCyrillic}
      aria-label="Toggle output script"
      title="Toggle transliteration (Esc)"
      onClick={onToggle}
      className="min-h-9 min-w-9 rounded-md border border-(--color-border) px-3 py-1.5 text-sm font-medium hover:bg-(--color-surface-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
    >
      <span className={isCyrillic ? 'font-semibold text-(--color-text)' : 'font-normal text-(--color-text-muted)'}>
        Кириллица
      </span>
      <span aria-hidden="true" className="px-1 text-(--color-text-muted)">
        |
      </span>
      <span className={isCyrillic ? 'font-normal text-(--color-text-muted)' : 'font-semibold text-(--color-text)'}>
        Латиница
      </span>
    </button>
  )
}
