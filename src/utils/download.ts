/**
 * Trigger a client-side download of `text` as a UTF-8 .txt file. Never
 * makes a network request (PROJECT.md §4.5/§11).
 */
export function downloadTextFile(text: string, filename = 'russian-text.txt'): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Defer revocation: Safari can abort the download if the object URL is
  // revoked synchronously right after click().
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
