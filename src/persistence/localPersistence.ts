import type { TransliterationMode } from '../transliteration'

export const STORAGE_KEY = 'russian-transliterator:v1'

export interface PersistedData {
  readonly text: string
  readonly mode: TransliterationMode
  readonly predictionEnabled: boolean
}

interface StoredSchemaV1 {
  readonly v: 1
  readonly text: string
  readonly mode: TransliterationMode
  readonly savedAt: number
}

interface StoredSchemaV2 {
  readonly v: 2
  readonly text: string
  readonly mode: TransliterationMode
  readonly predictionEnabled: boolean
  readonly savedAt: number
}

export const DEFAULT_PERSISTED: PersistedData = { text: '', mode: 'on', predictionEnabled: true }

function isStoredSchemaV1(value: Record<string, unknown>): value is Record<string, unknown> & StoredSchemaV1 {
  return (
    value.v === 1 &&
    typeof value.text === 'string' &&
    (value.mode === 'on' || value.mode === 'off')
  )
}

function isStoredSchemaV2(value: Record<string, unknown>): value is Record<string, unknown> & StoredSchemaV2 {
  return (
    value.v === 2 &&
    typeof value.text === 'string' &&
    (value.mode === 'on' || value.mode === 'off') &&
    typeof value.predictionEnabled === 'boolean'
  )
}

/**
 * Read persisted state (PROJECT.md §6.1). Corrupt, missing, or
 * old/unrecognized-version data is treated as the empty default rather
 * than thrown (TASKS.md §P5-2) — a blocked/disabled storage backend
 * throwing on `getItem` is handled the same way. Data saved by the
 * earlier v1 schema (no `predictionEnabled`) is migrated by defaulting
 * that field to on.
 */
export function loadPersisted(storage: Storage): PersistedData {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_PERSISTED
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PERSISTED
    const candidate = parsed as Record<string, unknown>

    if (isStoredSchemaV2(candidate)) {
      return { text: candidate.text, mode: candidate.mode, predictionEnabled: candidate.predictionEnabled }
    }
    if (isStoredSchemaV1(candidate)) {
      return { text: candidate.text, mode: candidate.mode, predictionEnabled: true }
    }
    return DEFAULT_PERSISTED
  } catch {
    return DEFAULT_PERSISTED
  }
}

/** Write persisted state. Returns false (rather than throwing) on quota errors or blocked storage. */
export function savePersisted(data: PersistedData, storage: Storage): boolean {
  try {
    const payload: StoredSchemaV2 = {
      v: 2,
      text: data.text,
      mode: data.mode,
      predictionEnabled: data.predictionEnabled,
      savedAt: Date.now(),
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}
