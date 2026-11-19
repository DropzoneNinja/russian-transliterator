import type { TransliterationMode } from '../transliteration/transliterate'

interface ModeToggleProps {
  mode: TransliterationMode
  onToggle: () => void
}

/**
 * ON/OFF transliteration control (PROJECT.md §4.3). State is lifted to
 * App so it can drive the editor engine, be saved locally, and be
 * toggled from the Escape shortcut too. Mode is conveyed through text as
 * well as colour, never colour alone (§8.2).
 */
export function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  const isOn = mode === 'on'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      title="Toggle transliteration (Esc)"
      onClick={onToggle}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-(--color-border-strong) bg-(--color-surface-muted) py-1.5 pr-3 pl-1.5 text-xs font-medium text-(--color-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring) sm:text-sm"
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
          isOn ? 'bg-(--color-accent)' : 'bg-(--color-border-strong)'
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-(--color-surface) transition-transform ${
            isOn ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
      Translit {isOn ? 'ON' : 'OFF'}
    </button>
  )
}
