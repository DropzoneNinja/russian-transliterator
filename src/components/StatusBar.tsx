import { countCharacters, countWords } from '../utils/counts'
import type { SaveStatus } from '../persistence/useLocalPersistence'

interface StatusBarProps {
  text: string
  saveStatus: SaveStatus
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'Saved locally',
  pending: 'Saving…',
  unavailable: 'Local saving unavailable',
}

/** Live counts and save status (PROJECT.md §4.5/§6.1), entirely derived — no redundant stored state (§6.3). */
export function StatusBar({ text, saveStatus }: StatusBarProps) {
  const characters = countCharacters(text)
  const words = countWords(text)

  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-xs text-(--color-text-muted) sm:px-4">
      <span>
        {characters} {characters === 1 ? 'character' : 'characters'} · {words} {words === 1 ? 'word' : 'words'}
      </span>
      <span>{STATUS_LABEL[saveStatus]}</span>
    </footer>
  )
}
