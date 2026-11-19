import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PERSISTED, loadPersisted, savePersisted, STORAGE_KEY } from './localPersistence'

function makeMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
    key: (index) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size
    },
  }
}

describe('loadPersisted', () => {
  it('returns the default when nothing is stored', () => {
    expect(loadPersisted(makeMemoryStorage())).toEqual(DEFAULT_PERSISTED)
  })

  it('round-trips text and mode through save then load', () => {
    const storage = makeMemoryStorage()
    savePersisted({ text: 'привет', mode: 'off' }, storage)
    expect(loadPersisted(storage)).toEqual({ text: 'привет', mode: 'off' })
  })

  it('treats corrupt JSON as the default rather than throwing', () => {
    const storage = makeMemoryStorage()
    storage.setItem(STORAGE_KEY, '{not json')
    expect(loadPersisted(storage)).toEqual(DEFAULT_PERSISTED)
  })

  it('treats an unrecognized schema version as the default', () => {
    const storage = makeMemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, text: 'x', mode: 'on' }))
    expect(loadPersisted(storage)).toEqual(DEFAULT_PERSISTED)
  })

  it('treats a missing/invalid mode as the default', () => {
    const storage = makeMemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, text: 'x', mode: 'sideways' }))
    expect(loadPersisted(storage)).toEqual(DEFAULT_PERSISTED)
  })

  it('does not throw when the storage backend itself throws', () => {
    const storage = makeMemoryStorage()
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadPersisted(storage)).toEqual(DEFAULT_PERSISTED)
  })
})

describe('savePersisted', () => {
  let storage: Storage

  beforeEach(() => {
    storage = makeMemoryStorage()
  })

  it('returns true on a successful write', () => {
    expect(savePersisted({ text: 'a', mode: 'on' }, storage)).toBe(true)
  })

  it('returns false instead of throwing when the backend rejects the write (e.g. quota)', () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(savePersisted({ text: 'a', mode: 'on' }, storage)).toBe(false)
  })
})
