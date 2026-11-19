import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { savePersisted } from '../persistence/localPersistence'

function getEditor(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Editor' }) as HTMLTextAreaElement
}

function getGhostSuffix(): string {
  return screen.getByTestId('ghost-suffix').textContent ?? ''
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

  it('instantly commits a one-hop-ambiguous sequence, chaining through to the longest match', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('s')
    expect(getEditor().value).toBe('с')
    await user.keyboard('h')
    expect(getEditor().value).toBe('ш')
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
    await user.keyboard('tv') // "t" alone can't instant-commit (ambiguous only with the 3-char "tvz"), so both stay literally pending
    expect(getEditor().value).toBe('tv')
    await user.keyboard('{Backspace}')
    expect(getEditor().value).toBe('t')
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
    savePersisted({ text: 'привет', mode: 'off', predictionEnabled: true }, window.localStorage)
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

describe('App: word suggestions', () => {
  it('suggests a completion once enough of a word is typed, and clicking it accepts the completion', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('priv')
    expect(getEditor().value).toBe('прив')

    const suggestion = await screen.findByRole('button', { name: 'Insert "привет"' })
    await user.click(suggestion)
    expect(getEditor().value).toBe('привет ')
  })

  it('Tab accepts the top suggestion', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('priv')
    await screen.findByRole('button', { name: 'Insert "привет"' })

    await user.keyboard('{Tab}')
    expect(getEditor().value).toBe('привет ')
  })

  it('does not show a suggestion until the minimum prefix length is reached', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('p')
    expect(getEditor().value).toBe('п')
    expect(screen.queryByRole('button', { name: /^Insert "/ })).not.toBeInTheDocument()
  })

  it('turning the Suggestions toggle off hides suggestions immediately', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('priv')
    await screen.findByRole('button', { name: 'Insert "привет"' })

    await user.click(screen.getByRole('button', { name: 'Suggestions: On' }))
    expect(screen.queryByRole('button', { name: 'Insert "привет"' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suggestions: Off' })).toBeInTheDocument()
  })

  it('switching to Roman mode hides suggestions', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('priv')
    await screen.findByRole('button', { name: 'Insert "привет"' })

    await user.click(screen.getByRole('switch'))
    expect(screen.queryByRole('button', { name: 'Insert "привет"' })).not.toBeInTheDocument()
  })

  it('restores a previously saved predictionEnabled=false preference', async () => {
    savePersisted({ text: '', mode: 'on', predictionEnabled: false }, window.localStorage)
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('button', { name: 'Suggestions: Off' })).toBeInTheDocument()

    await user.click(getEditor())
    await user.keyboard('priv')
    expect(screen.queryByRole('button', { name: /^Insert "/ })).not.toBeInTheDocument()
  })

  it('renders suggestion chips inside the toolbar, after Download', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('priv')
    const chip = await screen.findByRole('button', { name: 'Insert "привет"' })
    expect(screen.getByRole('toolbar')).toContainElement(chip)
  })

  it('shows the top suggestion as inline ghost text when the caret is at the end', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('priv')
    expect(getGhostSuffix()).toBe('ет')
  })

  it('updates the ghost text as more letters are typed', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('priv')
    expect(getGhostSuffix()).toBe('ет')
    await user.keyboard('e')
    expect(getEditor().value).toBe('приве')
    expect(getGhostSuffix()).toBe('т')
  })

  it('does not show ghost text when the caret is not at the end of the document', async () => {
    const user = userEvent.setup()
    render(<App />)
    const editor = getEditor()
    await user.click(editor)
    await user.keyboard('privet mir')
    expect(editor.value).toBe('привет мир')

    editor.setSelectionRange(4, 4)
    fireEvent(document, new Event('selectionchange'))
    await screen.findByRole('button', { name: 'Insert "привет"' }) // chips still work mid-document
    expect(getGhostSuffix()).toBe('')
  })

  it('pressing Space accepts the ghost completion', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('priv')
    expect(getGhostSuffix()).toBe('ет')
    await user.keyboard(' ')
    expect(getEditor().value).toBe('привет ')
  })

  it('Space is a normal space when no ghost text is showing', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('mir ')
    expect(getEditor().value).toBe('мир ')
  })
})

describe('App: ISSUES.md fixes', () => {
  it('a lone apostrophe resolves to "ь" immediately, with nothing further typed', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard("'")
    expect(getEditor().value).toBe('ь')
  })

  it('a lone "#" resolves to "ъ" immediately', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('#')
    expect(getEditor().value).toBe('ъ')
  })

  it('a lone "y" resolves to "ы" instantly, with nothing further typed', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('y')
    expect(getEditor().value).toBe('ы')
  })

  it('"u"/"o"/"a" right after a "y" shortcut retroactively merges into "ю"/"ё"/"я"', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('y')
    expect(getEditor().value).toBe('ы')
    await user.keyboard('a')
    expect(getEditor().value).toBe('я')
  })

  it('"u"/"o"/"a" arriving 2+ seconds after a "y" shortcut is treated as a separate character', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('y')
    expect(getEditor().value).toBe('ы')

    await new Promise((resolve) => setTimeout(resolve, 2100))
    await user.keyboard('a')
    expect(getEditor().value).toBe('ыа')
  })

  it('typing "ty" resolves the pending "t" and still gets the instant "y" shortcut', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('ty')
    expect(getEditor().value).toBe('ты')
    await user.keyboard('a')
    expect(getEditor().value).toBe('тя')
  })

  it('a lone "z"/"j"/"c" resolves to its own letter instantly, with nothing further typed', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('z')
    expect(getEditor().value).toBe('з')
    await user.keyboard(' j')
    expect(getEditor().value).toBe('з й')
    await user.keyboard(' c')
    expect(getEditor().value).toBe('з й ц')
  })

  it('"h" right after a "z"/"c" shortcut retroactively merges into "ж"/"ч"', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('z')
    expect(getEditor().value).toBe('з')
    await user.keyboard('h')
    expect(getEditor().value).toBe('ж')

    await user.keyboard(' c')
    expect(getEditor().value).toBe('ж ц')
    await user.keyboard('h')
    expect(getEditor().value).toBe('ж ч')
  })

  it('"a"/"o"/"u" right after a "j" shortcut retroactively merges into "я"/"ё"/"ю"', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('j')
    expect(getEditor().value).toBe('й')
    await user.keyboard('o')
    expect(getEditor().value).toBe('ё')
  })

  it('"h" right after an "s" shortcut merges to "ш", chaining again into "щ" on a second "h"', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('s')
    expect(getEditor().value).toBe('с')
    await user.keyboard('h')
    expect(getEditor().value).toBe('ш')
    await user.keyboard('h')
    expect(getEditor().value).toBe('щ')
  })

  it('an unrelated character right after a "z" shortcut is treated as a separate character', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('z')
    expect(getEditor().value).toBe('з')
    await user.keyboard('k')
    expect(getEditor().value).toBe('зк')
  })

  it('"h" arriving 2+ seconds after a "z" shortcut is treated as a separate character', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('z')
    expect(getEditor().value).toBe('з')

    await new Promise((resolve) => setTimeout(resolve, 2100))
    await user.keyboard('h')
    expect(getEditor().value).toBe('зх')
  })

  it('toggling Cyrillic|Roman keeps keyboard focus on the editor', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.click(screen.getByRole('switch'))
    expect(getEditor()).toHaveFocus()
  })

  it('Enter inserts a newline (multiline support)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('privet{Enter}mir')
    expect(getEditor().value).toBe('привет\nмир')
  })

  it('clicking a reference letter inserts it at the caret', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(getEditor())
    await user.keyboard('мир')

    const middle = getEditor().value.indexOf('и')
    getEditor().setSelectionRange(middle, middle)
    await user.click(screen.getByRole('button', { name: 'Insert Cyrillic letter "ж"' }))
    expect(getEditor().value).toBe('мжир')
    expect(getEditor()).toHaveFocus()
  })

  it('labels the toggle with the Russian name for Cyrillic, keeping Roman in English', () => {
    render(<App />)
    expect(screen.getByText('Кириллица')).toBeInTheDocument()
    expect(screen.getByText('Roman')).toBeInTheDocument()
  })
})
