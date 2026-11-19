import { describe, expect, it } from 'vitest'
import {
  diffReplacement,
  findLineEnd,
  findLineStart,
  findWordBoundaryBackward,
  findWordBoundaryForward,
  stepBackOneCodePoint,
  stepForwardOneCodePoint,
} from './textOps'

describe('stepBackOneCodePoint / stepForwardOneCodePoint', () => {
  it('steps back one plain character', () => {
    expect(stepBackOneCodePoint('abc', 2)).toBe(1)
  })

  it('steps back over a whole surrogate pair', () => {
    const text = 'a😀b'
    expect(text.length).toBe(4) // 'a' + 2 surrogate units + 'b'
    expect(stepBackOneCodePoint(text, 3)).toBe(1)
  })

  it('does not step before the start of the string', () => {
    expect(stepBackOneCodePoint('abc', 0)).toBe(0)
  })

  it('steps forward one plain character', () => {
    expect(stepForwardOneCodePoint('abc', 1)).toBe(2)
  })

  it('steps forward over a whole surrogate pair', () => {
    const text = 'a😀b'
    expect(stepForwardOneCodePoint(text, 1)).toBe(3)
  })

  it('does not step past the end of the string', () => {
    expect(stepForwardOneCodePoint('abc', 3)).toBe(3)
  })
})

describe('findWordBoundaryBackward / findWordBoundaryForward', () => {
  it('finds the start of the word immediately before the caret', () => {
    expect(findWordBoundaryBackward('hello world', 11)).toBe(6)
  })

  it('skips trailing separators before finding the word', () => {
    expect(findWordBoundaryBackward('hello   ', 8)).toBe(0)
  })

  it('finds the end of the word immediately after the caret', () => {
    expect(findWordBoundaryForward('hello world', 0)).toBe(5)
  })

  it('handles Cyrillic word characters', () => {
    expect(findWordBoundaryBackward('привет мир', 10)).toBe(7)
  })
})

describe('findLineStart / findLineEnd', () => {
  it('finds the start of the current line', () => {
    expect(findLineStart('a\nbcd\ne', 4)).toBe(2)
  })

  it('finds the start of the first line as 0', () => {
    expect(findLineStart('abc', 2)).toBe(0)
  })

  it('finds the end of the current line', () => {
    expect(findLineEnd('a\nbcd\ne', 4)).toBe(5)
  })

  it('finds the end of the last line as the text length', () => {
    expect(findLineEnd('abc', 1)).toBe(3)
  })
})

describe('diffReplacement', () => {
  it('finds a pure insertion in the middle', () => {
    expect(diffReplacement('ac', 'abc')).toEqual({ start: 1, deletedLength: 0, inserted: 'b' })
  })

  it('finds a pure deletion', () => {
    expect(diffReplacement('abc', 'ac')).toEqual({ start: 1, deletedLength: 1, inserted: '' })
  })

  it('finds a replacement in the middle', () => {
    expect(diffReplacement('aXc', 'aYZc')).toEqual({ start: 1, deletedLength: 1, inserted: 'YZ' })
  })

  it('reports no change for identical text', () => {
    expect(diffReplacement('abc', 'abc')).toEqual({ start: 3, deletedLength: 0, inserted: '' })
  })

  it('handles a full replacement with no shared prefix/suffix', () => {
    expect(diffReplacement('abc', 'xyz')).toEqual({ start: 0, deletedLength: 3, inserted: 'xyz' })
  })
})
