import { useCallback, useRef, useState } from 'react'
import {
  canRedo as canRedoOf,
  canUndo as canUndoOf,
  createHistory,
  pushSnapshot,
  redo as redoOf,
  undo as undoOf,
  type EditSnapshot,
  type HistoryGroup,
  type HistoryState,
} from './editorHistory'

/**
 * React wrapper around the pure history stack. The stack itself lives in a
 * ref (not state) so that pushes during fast typing never force a
 * component re-render on their own; `canUndo`/`canRedo` are mirrored into
 * state only when they might actually have changed, purely so the Toolbar
 * can derive its disabled attributes.
 */
export function useEditorHistory(initial: EditSnapshot) {
  const historyRef = useRef<HistoryState>(createHistory(initial))
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const sync = useCallback(() => {
    setCanUndo(canUndoOf(historyRef.current))
    setCanRedo(canRedoOf(historyRef.current))
  }, [])

  const push = useCallback(
    (snapshot: EditSnapshot, group: HistoryGroup) => {
      historyRef.current = pushSnapshot(historyRef.current, snapshot, group)
      sync()
    },
    [sync],
  )

  const undo = useCallback((): EditSnapshot | null => {
    const result = undoOf(historyRef.current)
    if (result === null) return null
    historyRef.current = result.state
    sync()
    return result.snapshot
  }, [sync])

  const redo = useCallback((): EditSnapshot | null => {
    const result = redoOf(historyRef.current)
    if (result === null) return null
    historyRef.current = result.state
    sync()
    return result.snapshot
  }, [sync])

  return { push, undo, redo, canUndo, canRedo }
}
