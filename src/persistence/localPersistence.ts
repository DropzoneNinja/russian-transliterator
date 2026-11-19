import type { TransliterationMode } from '../transliteration'

export const STORAGE_KEY = 'russian-transliterator:v1'

export interface PersistedData {
  readonly text: string
  readonly mode: TransliterationMode
}

interface StoredSchemaV1 {
  readonly v: 1
  readonly text: string
  readonly mode: TransliterationMode
  readonly savedAt: number
}

export const DEFAULT_PERSISTED: PersistedData = { text: '', mode: 'on' }

function isStoredSchemaV1(value: unknown): value is StoredSchemaV1 {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.v === 1 &&
    typeof candidate.text === 'string' &&
    (candidate.mode === 'on' || candidate.mode === 'off')
  )
}

/**
 * Read persisted state (PROJECT.md §6.1). Corrupt, missing, or
 * old/unrecognized-version data is treated as the empty default rather
 * than thrown (TASKS.md §P5-2) — a blocked/disabled storage backend
 * throwing on `getItem` is handled the same way.
 */
export function loadPersisted(storage: Storage): PersistedData {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_PERSISTED
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredSchemaV1(parsed)) return DEFAULT_PERSISTED
    return { text: parsed.text, mode: parsed.mode }
  } catch {
    return DEFAULT_PERSISTED
  }
}

/** Write persisted state. Returns false (rather than throwing) on quota errors or blocked storage. */
export function savePersisted(data: PersistedData, storage: Storage): boolean {
  try {
    const payload: StoredSchemaV1 = { v: 1, text: data.text, mode: data.mode, savedAt: Date.now() }
    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}
