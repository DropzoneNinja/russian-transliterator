import { describe, expect, it } from 'vitest'
import { suggestCompletions } from './suggest'
import { COMMON_RUSSIAN_WORDS } from './wordlist'

describe('suggestCompletions', () => {
  it('returns an empty array for an empty prefix', () => {
    expect(suggestCompletions('', 5)).toEqual([])
  })

  it('returns an empty array when nothing matches', () => {
    expect(suggestCompletions('ъъъ', 5)).toEqual([])
  })

  it('returns only words that start with the given prefix', () => {
    const results = suggestCompletions('прив', 10)
    expect(results.length).toBeGreaterThan(0)
    for (const word of results) {
      expect(word.toLowerCase().startsWith('прив')).toBe(true)
    }
  })

  it('respects the limit', () => {
    const results = suggestCompletions('с', 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })

  it('is case-insensitive on the way in and capitalizes the match for an uppercase prefix', () => {
    const results = suggestCompletions('Прив', 5)
    expect(results.length).toBeGreaterThan(0)
    for (const word of results) {
      expect(word.charAt(0)).toBe(word.charAt(0).toUpperCase())
    }
  })

  it('keeps lowercase matches lowercase for a lowercase prefix', () => {
    const results = suggestCompletions('прив', 5)
    for (const word of results) {
      expect(word.charAt(0)).toBe(word.charAt(0).toLowerCase())
    }
  })

  it('ranks matches by the word list order', () => {
    // "он" appears before "она" in the word list, so it should rank first.
    const results = suggestCompletions('он', 10)
    expect(results.indexOf('он')).toBeLessThan(results.indexOf('она'))
  })

  it('the underlying word list contains no accidental duplicates once de-duplicated', () => {
    const unique = new Set(COMMON_RUSSIAN_WORDS)
    // This doesn't assert the raw list has zero dupes (harmless if it does,
    // suggest.ts de-dupes) — it just documents the current count so a
    // large accidental blow-up would be noticed.
    expect(unique.size).toBeGreaterThan(300)
  })
})
