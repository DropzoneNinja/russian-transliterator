import { useCallback, useEffect, useRef, useState } from 'react'
import { loadPersisted, savePersisted, type PersistedData } from './localPersistence'

export type SaveStatus = 'saved' | 'pending' | 'unavailable'

const DEBOUNCE_MS = 500

/**
 * Loads persisted text/mode once on mount, and exposes a debounced `save`
 * for writing it back (PROJECT.md §6.1 — "a small debounce to avoid
 * excessive writes"). `status` reflects whether the last write actually
 * succeeded, so the UI can show "Local saving unavailable" instead of a
 * false "Saved locally".
 */
export function useLocalPersistence() {
  const [initial] = useState<PersistedData>(() => {
    try {
      return loadPersisted(window.localStorage)
    } catch {
      return { text: '', mode: 'on' }
    }
  })
  const [status, setStatus] = useState<SaveStatus>('saved')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  const save = useCallback((data: PersistedData) => {
    setStatus('pending')
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      let ok: boolean
      try {
        ok = savePersisted(data, window.localStorage)
      } catch {
        ok = false
      }
      setStatus(ok ? 'saved' : 'unavailable')
    }, DEBOUNCE_MS)
  }, [])

  return { initial, status, save }
}
