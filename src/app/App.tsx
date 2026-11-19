import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeader } from '../components/AppHeader'
import { TransliterationReference } from '../components/TransliterationReference'
import { Toolbar } from '../components/Toolbar'
import { Editor } from '../components/Editor'
import { StatusBar } from '../components/StatusBar'
import { useTransliterationEditor, type EditSnapshot, type HistoryGroup } from '../editor/useTransliterationEditor'
import { useEditorHistory } from '../history/useEditorHistory'
import { useLocalPersistence } from '../persistence/useLocalPersistence'
import { useWordSuggestions } from '../prediction/useWordSuggestions'
import { copyToClipboard } from '../utils/clipboard'
import { downloadTextFile } from '../utils/download'
import type { TransliterationMode } from '../transliteration/transliterate'

export function App() {
  const persistence = useLocalPersistence()
  const [mode, setMode] = useState<TransliterationMode>(persistence.initial.mode)
  const [predictionEnabled, setPredictionEnabled] = useState<boolean>(persistence.initial.predictionEnabled)
  const [text, setText] = useState<string>(persistence.initial.text)

  const initialSnapshot = useMemo<EditSnapshot>(() => {
    const length = persistence.initial.text.length
    return { text: persistence.initial.text, selectionStart: length, selectionEnd: length }
    // Only ever relevant for the very first mount (restored text).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const history = useEditorHistory(initialSnapshot)

  const onMutate = useCallback(
    (snapshot: EditSnapshot, group: HistoryGroup) => history.push(snapshot, group),
    [history],
  )
  const onTextChange = useCallback((value: string) => setText(value), [])

  const editor = useTransliterationEditor({ mode, initial: initialSnapshot, onMutate, onTextChange })

  useEffect(() => {
    persistence.save({ text, mode, predictionEnabled })
  }, [text, mode, predictionEnabled, persistence])

  const handleToggleMode = useCallback(() => {
    editor.flushPending()
    setMode((current) => (current === 'on' ? 'off' : 'on'))
    editor.textareaRef.current?.focus() // clicking the toolbar button would otherwise steal focus (ISSUES.md)
  }, [editor])

  const handleTogglePrediction = useCallback(() => {
    setPredictionEnabled((current) => !current)
  }, [])

  const handleAcceptSuggestion = useCallback(
    (snapshot: EditSnapshot) => {
      history.push(snapshot, 'other')
      editor.applyExternalChange(snapshot)
    },
    [editor, history],
  )

  const suggestions = useWordSuggestions({
    textareaRef: editor.textareaRef,
    enabled: predictionEnabled && mode === 'on',
    text,
    onAccept: handleAcceptSuggestion,
  })

  const handleUndo = useCallback(() => {
    const snapshot = history.undo()
    if (snapshot !== null) editor.applyExternalChange(snapshot)
  }, [editor, history])

  const handleRedo = useCallback(() => {
    const snapshot = history.redo()
    if (snapshot !== null) editor.applyExternalChange(snapshot)
  }, [editor, history])

  const handleClear = useCallback(() => {
    if (text === '') return
    if (!window.confirm('Clear all text?')) return
    editor.flushPending() // so Undo restores fully-resolved text, not a stale pending remnant
    const snapshot: EditSnapshot = { text: '', selectionStart: 0, selectionEnd: 0 }
    history.push(snapshot, 'other')
    editor.applyExternalChange(snapshot)
  }, [editor, history, text])

  const handleCopy = useCallback(() => copyToClipboard(text), [text])
  const handleDownload = useCallback(() => downloadTextFile(text), [text])

  const handleInsertReferenceChar = useCallback(
    (char: string) => {
      editor.flushPending() // existing Cyrillic is itself a flush trigger (TASKS.md §1.3 point 3)
      const ta = editor.textareaRef.current
      if (ta === null) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newText = ta.value.slice(0, start) + char + ta.value.slice(end)
      const newCaret = start + char.length
      const snapshot: EditSnapshot = { text: newText, selectionStart: newCaret, selectionEnd: newCaret }
      history.push(snapshot, 'other')
      editor.applyExternalChange(snapshot)
    },
    [editor, history],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.isComposing) return

      if (event.key === 'Escape') {
        event.preventDefault()
        handleToggleMode()
        return
      }

      const isModifier = event.ctrlKey || event.metaKey
      if (!isModifier) return

      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        handleUndo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleToggleMode, handleUndo, handleRedo])

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-(--color-bg)">
      <AppHeader />
      <TransliterationReference onSelect={handleInsertReferenceChar} />
      <Toolbar
        mode={mode}
        onToggleMode={handleToggleMode}
        predictionEnabled={predictionEnabled}
        onTogglePrediction={handleTogglePrediction}
        onCopy={handleCopy}
        onClear={handleClear}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDownload={handleDownload}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        hasText={text !== ''}
        suggestions={suggestions.suggestions}
        onSelectSuggestion={suggestions.accept}
      />
      <main className="flex min-h-0 flex-1 flex-col">
        <Editor textareaRef={editor.textareaRef} text={text} ghostSuffix={suggestions.ghostSuffix} />
      </main>
      <StatusBar text={text} saveStatus={persistence.status} />
    </div>
  )
}
