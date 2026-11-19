import { describe, expect, it } from 'vitest'
import { countCharacters, countWords } from './counts'

describe('countCharacters', () => {
  it('counts plain Cyrillic text', () => {
    expect(countCharacters('привет')).toBe(6)
  })

  it('counts a code point outside the BMP as one character, not two UTF-16 units', () => {
    expect('😀'.length).toBe(2) // sanity check: surrogate pair
    expect(countCharacters('😀')).toBe(1)
  })

  it('counts an empty string as zero', () => {
    expect(countCharacters('')).toBe(0)
  })
})

describe('countWords', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('privet kak dela')).toBe(3)
  })

  it('counts punctuation attached to a word as part of that word', () => {
    expect(countWords('привет, мир!')).toBe(2)
  })

  it('reports zero for an empty string', () => {
    expect(countWords('')).toBe(0)
  })

  it('reports zero for whitespace-only text', () => {
    expect(countWords('   \n\t  ')).toBe(0)
  })

  it('collapses multiple whitespace runs between words', () => {
    expect(countWords('a   b\n\nc')).toBe(3)
  })
})
