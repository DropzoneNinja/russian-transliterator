import { MAPPING } from '../transliteration/mapping'

interface TransliterationReferenceProps {
  onSelect: (cyrillic: string) => void
}

/**
 * Reference strip (PROJECT.md §4.4), rendered straight from the engine's
 * own mapping table so the UI and the engine can never drift out of
 * sync. Clicking a letter inserts it directly at the caret (ISSUES.md:
 * "make the letters on the top bar clickable" — this revisits
 * PROJECT.md §3.2's "no interactive virtual keyboard" per that section's
 * own "unless requested in a later revision" carve-out).
 */
export function TransliterationReference({ onSelect }: TransliterationReferenceProps) {
  return (
    <div
      aria-label="Transliteration reference — click a letter to insert it"
      className="border-b border-(--color-border) bg-(--color-surface-muted) px-3 py-2 sm:px-4"
    >
      <ul className="flex w-max max-w-full gap-1.5 overflow-x-auto">
        {MAPPING.map((entry) => (
          <li key={entry.cyrillic}>
            <button
              type="button"
              aria-label={`Insert Cyrillic letter "${entry.cyrillic}"`}
              onClick={() => onSelect(entry.cyrillic)}
              className="flex min-w-11 flex-col items-center rounded-md border border-(--color-border) bg-(--color-key-bg) px-2 py-1 text-(--color-key-text) hover:bg-(--color-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
            >
              <span className="text-[11px] leading-tight whitespace-nowrap">{entry.inputs.join(', ')}</span>
              <span className="text-sm leading-tight font-medium">{entry.cyrillic}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] leading-tight text-(--color-text-muted)">
        Shift or caps lock for uppercase · type <span className="font-medium">+</span> between letters to keep
        a sequence from combining · click a letter to insert it
      </p>
    </div>
  )
}
