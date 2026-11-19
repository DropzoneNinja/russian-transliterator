import { useEffect, useRef, type RefObject } from 'react'

interface EditorProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  text: string
  /** Remainder of the top word suggestion, shown as inline ghost text right after the caret. */
  ghostSuffix: string
}

const METRICS_CLASS = 'px-3 py-3 text-base leading-relaxed sm:px-4 sm:text-lg'

/**
 * Uncontrolled textarea: the DOM owns `.value`/selection. All editing
 * behaviour (transliteration, caret handling, IME, paste) is wired by
 * useTransliterationEditor directly onto the DOM node via `textareaRef`,
 * not through React props, so applying a conversion never races a render.
 *
 * `text`/`ghostSuffix` feed only the decorative backdrop behind the
 * (transparent-background) textarea — a classic "ghost text" overlay: an
 * invisible copy of the real text keeps the grey suggestion suffix
 * pixel-aligned with the real caret, without the textarea itself ever
 * being a controlled input.
 */
export function Editor({ textareaRef, text, ghostSuffix }: EditorProps) {
  const backdropRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const ta = textareaRef.current
    const backdrop = backdropRef.current
    if (ta === null || backdrop === null) return

    function syncScroll(): void {
      if (backdrop === null) return
      backdrop.scrollTop = ta!.scrollTop
      backdrop.scrollLeft = ta!.scrollLeft
    }

    ta.addEventListener('scroll', syncScroll)
    return () => ta.removeEventListener('scroll', syncScroll)
  }, [textareaRef])

  return (
    <div className="relative min-h-48 w-full flex-1">
      <div
        ref={backdropRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden text-(--color-text) break-words whitespace-pre-wrap ${METRICS_CLASS}`}
      >
        <span className="invisible">{text}</span>
        <span data-testid="ghost-suffix" className="text-(--color-text-muted)">
          {ghostSuffix}
        </span>
      </div>
      <textarea
        ref={textareaRef}
        aria-label="Editor"
        placeholder="Start typing…"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className={`absolute inset-0 resize-none bg-transparent text-(--color-text) outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-(--color-focus-ring) ${METRICS_CLASS}`}
      />
    </div>
  )
}
