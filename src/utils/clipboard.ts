/**
 * Copy `text` to the system clipboard. Prefers the async Clipboard API
 * (secure contexts only); falls back to the legacy hidden-textarea +
 * execCommand('copy') technique so Copy still works on a plain-HTTP
 * home-lab deployment where `navigator.clipboard` is unavailable
 * (PROJECT.md §4.5 requires a graceful fallback, not just an error).
 * Resolves false only if both approaches fail.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the legacy fallback below.
    }
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
