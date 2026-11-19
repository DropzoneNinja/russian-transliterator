import { MAPPING } from '../transliteration/mapping'

/**
 * Non-interactive reference strip (PROJECT.md §4.4), rendered straight
 * from the engine's own mapping table so the UI and the engine can never
 * drift out of sync.
 */
export function TransliterationReference() {
  return (
    <div
      role="note"
      aria-label="Transliteration reference"
      className="border-b border-(--color-border) bg-(--color-surface-muted) px-3 py-2 sm:px-4"
    >
      <ul className="flex w-max max-w-full gap-1.5 overflow-x-auto">
        {MAPPING.map((entry) => (
          <li
            key={entry.cyrillic}
            className="flex min-w-11 flex-col items-center rounded-md border border-(--color-border) bg-(--color-key-bg) px-2 py-1 text-(--color-key-text)"
          >
            <span className="text-[11px] leading-tight whitespace-nowrap">{entry.inputs.join(', ')}</span>
            <span className="text-sm leading-tight font-medium">{entry.cyrillic}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] leading-tight text-(--color-text-muted)">
        Shift or caps lock for uppercase · type <span className="font-medium">+</span> between letters to keep
        a sequence from combining
      </p>
    </div>
  )
}
