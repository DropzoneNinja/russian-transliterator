import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { savePersisted } from '../persistence/localPersistence'

function getEditor(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Editor' }) as HTMLTextAreaElement
}

beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App shell', () => {
  it('renders the app shell', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Russian Transliterator' })).toBeInTheDocument()
    expect(getEditor()).toBeInTheDocument()
  })
})

describe('App: live typing', () => {
  it('transliterates Latin input live', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('mir')
    expect(getEditor().value).toBe('мир')
  })

  it('keeps an ambiguous sequence literal until it resolves (longest match)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('s')
    expect(getEditor().value).toBe('s')
    await user.keyboard('h')
    expect(getEditor().value).toBe('sh')
    await user.keyboard('h')
    expect(getEditor().value).toBe('щ')
  })

  it('applies the + separator and drops it from the output', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('raj+on')
    expect(getEditor().value).toBe('район')
  })
})

describe('App: caret and selection', () => {
  it('typing at the start/middle of existing text inserts at the caret, not at the end', async () => {
    const user = userEvent.setup()
    render(<App />)
    const editor = getEditor()
    await user.click(editor)
    await user.keyboard('privet mir')
    expect(editor.value).toBe('привет мир')

    editor.setSelectionRange(0, 0)
    await user.keyboard('! ') // punctuation passes through unchanged, marking the insertion point
    expect(editor.value).toBe('! привет мир')

    const middle = editor.value.indexOf(' ', editor.value.indexOf('привет'))
    editor.setSelectionRange(middle, middle)
    await user.keyboard(' ochen')
    expect(editor.value).toBe('! привет очен мир')
  })

  it('replacing a selection converts the replacement in place', async () => {
    const user = userEvent.setup()
    render(<App />)
    const editor = getEditor()
    await user.click(editor)
    await user.keyboard('privet mir')
    expect(editor.value).toBe('привет мир')

    const start = editor.value.indexOf('мир')
    editor.setSelectionRange(start, start + 'мир'.length)
    await user.keyboard('dub')
    expect(editor.value).toBe('привет дуб')
  })
})

describe('App: backspace', () => {
  it('un-types the last pending character before it commits', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('sh')
    expect(getEditor().value).toBe('sh')
    await user.keyboard('{Backspace}')
    expect(getEditor().value).toBe('s')
    await user.keyboard('{Backspace}')
    expect(getEditor().value).toBe('')
  })

  it('deletes a committed Cyrillic character without resurrecting anything', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('privet ') // trailing space flushes the pending "t" to "т"
    expect(getEditor().value).toBe('привет ')
    await user.keyboard('{Backspace}') // removes the space
    expect(getEditor().value).toBe('привет')
    await user.keyboard('{Backspace}') // removes the committed "т"
    expect(getEditor().value).toBe('приве')
  })
})

describe('App: mode toggle', () => {
  it('OFF mode inserts Latin literally and leaves existing text untouched', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('privet')
    expect(getEditor().value).toBe('привеt') // "t" is still pending (could extend to "tvz")

    await user.click(screen.getByRole('switch'))
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    expect(getEditor().value).toBe('привет') // the toggle flushed the pending "t" first

    const editor = getEditor()
    editor.focus()
    editor.setSelectionRange(editor.value.length, editor.value.length)
    await user.keyboard(' test')
    expect(getEditor().value).toBe('привет test')
  })

  it('Escape toggles the mode', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })
})

describe('App: toolbar', () => {
  it('Clear empties the editor after confirmation, and Undo restores the text', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('privet')
    expect(getEditor().value).toBe('привеt')

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(window.confirm).toHaveBeenCalled()
    expect(getEditor().value).toBe('')

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(getEditor().value).toBe('привет') // Clear flushed the pending "t" before clearing
  })

  it('does not ask for confirmation when the editor is already empty', async () => {
    vi.spyOn(window, 'confirm')
    render(<App />)
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
    expect(window.confirm).not.toHaveBeenCalled()
  })

  it('Redo re-applies an undone edit', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('privet')

    await user.keyboard('{Control>}z{/Control}')
    expect(getEditor().value).toBe('')

    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(getEditor().value).toBe('привеt')
  })

  it('Copy writes the editor contents to the clipboard and shows feedback', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Defined after userEvent.setup(), which installs its own clipboard
    // stub on navigator.clipboard that would otherwise clobber this mock.
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    await user.click(getEditor())
    await user.keyboard('privet')

    // Clicking the Copy button blurs the editor first, flushing the pending "t".
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('привет')
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })

  it('Download builds a text Blob from the current contents', async () => {
    let capturedBlob: Blob | null = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      capturedBlob = blob as Blob
      return 'blob:mock'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('privet')

    await user.click(screen.getByRole('button', { name: 'Download' }))
    expect(capturedBlob).not.toBeNull()
    await expect(capturedBlob!.text()).resolves.toBe('привет')
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
  })
})

describe('App: persistence restore', () => {
  it('restores previously saved text and mode on mount', () => {
    savePersisted({ text: 'привет', mode: 'off' }, window.localStorage)
    render(<App />)
    expect(getEditor().value).toBe('привет')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('starts empty and ON when nothing was previously saved', () => {
    render(<App />)
    expect(getEditor().value).toBe('')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })
})
