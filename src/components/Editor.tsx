import type { RefObject } from 'react'

interface EditorProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

/**
 * Uncontrolled textarea: the DOM owns `.value`/selection. All editing
 * behaviour (transliteration, caret handling, IME, paste) is wired by
 * useTransliterationEditor directly onto the DOM node via `textareaRef`,
 * not through React props, so applying a conversion never races a render.
 */
export function Editor({ textareaRef }: EditorProps) {
  return (
    <textarea
      ref={textareaRef}
      aria-label="Editor"
      placeholder="Start typing…"
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      className="min-h-48 w-full flex-1 resize-none bg-(--color-surface) px-3 py-3 text-base leading-relaxed text-(--color-text) outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-(--color-focus-ring) sm:px-4 sm:text-lg"
    />
  )
}
