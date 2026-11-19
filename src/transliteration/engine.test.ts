import { describe, expect, it } from 'vitest'
import { INITIAL_STATE, feed, flush } from './engine'

function feedAll(chars: string[]) {
  let state = INITIAL_STATE
  const steps: { committed: string; pendingRaw: string }[] = []
  for (const char of chars) {
    const result = feed(state, char)
    state = result.state
    steps.push({ committed: result.committed, pendingRaw: state.pendingRaw })
  }
  return { state, steps }
}

describe('engine: partial sequences while typing (PROJECT.md §5.4)', () => {
  it('does not commit "s" while it could still become "sh" or "shh"', () => {
    const { steps } = feedAll(['s'])
    expect(steps[0]).toEqual({ committed: '', pendingRaw: 's' })
  })

  it('does not commit "sh" while it could still become "shh"', () => {
    const { steps } = feedAll(['s', 'h'])
    expect(steps[1]).toEqual({ committed: '', pendingRaw: 'sh' })
  })

  it('commits "щ" as soon as "shh" is unambiguous (maximal match)', () => {
    const { steps } = feedAll(['s', 'h', 'h'])
    expect(steps[2]).toEqual({ committed: 'щ', pendingRaw: '' })
  })

  it('commits immediately when a character has no possible extension', () => {
    // "k" is not a prefix of any longer key.
    const { steps } = feedAll(['k'])
    expect(steps[0]).toEqual({ committed: 'к', pendingRaw: '' })
  })

  it('resolves a mismatch by flushing the old buffer and reprocessing fresh ("tvo" -> "тво")', () => {
    const { steps } = feedAll(['t', 'v', 'o'])
    expect(steps[0]).toEqual({ committed: '', pendingRaw: 't' })
    expect(steps[1]).toEqual({ committed: '', pendingRaw: 'tv' })
    // 'o' cannot extend "tv", so "t" flushes to "т", "v" resolves on its own
    // to "в", and "o" resolves fresh to "о": "тво".
    expect(steps[2]).toEqual({ committed: 'тво', pendingRaw: '' })
  })

  it('flush() resolves a trailing pending buffer at end of input', () => {
    const fed = feed(INITIAL_STATE, 'sh')
    expect(fed.committed).toBe('')
    expect(fed.state.pendingRaw).toBe('sh')

    const flushed = flush(fed.state)
    expect(flushed.committed).toBe('ш')
    expect(flushed.state).toEqual(INITIAL_STATE)
  })

  it('flush() on an empty state is a no-op', () => {
    const flushed = flush(INITIAL_STATE)
    expect(flushed).toEqual({ state: INITIAL_STATE, committed: '' })
  })

  it('feed() accepts multi-character chunks, not just single characters', () => {
    const result = feed(INITIAL_STATE, 'shh')
    expect(result.committed).toBe('щ')
    expect(result.state.pendingRaw).toBe('')
  })
})

describe('engine: single-key aliases whose only extension matches (ISSUES.md)', () => {
  it('commits "\'" to "ь" immediately, without buffering for a possible second "\'"', () => {
    const { steps } = feedAll(["'"])
    expect(steps[0]).toEqual({ committed: 'ь', pendingRaw: '' })
  })

  it('commits "#" to "ъ" immediately, without buffering for a possible second "#"', () => {
    const { steps } = feedAll(['#'])
    expect(steps[0]).toEqual({ committed: 'ъ', pendingRaw: '' })
  })

  it('still buffers "t" and "m", whose longer extensions ("tvz"/"mjz") map to a different result', () => {
    expect(feedAll(['t']).steps[0]).toEqual({ committed: '', pendingRaw: 't' })
    expect(feedAll(['m']).steps[0]).toEqual({ committed: '', pendingRaw: 'm' })
  })
})

describe('engine: separator (PROJECT.md §5.5)', () => {
  it('"raj+on" avoids "jo" -> "ё" and produces "район"', () => {
    const result = feed(INITIAL_STATE, 'raj+on')
    const flushed = flush(result.state)
    expect(result.committed + flushed.committed).toBe('район')
  })

  it('without the separator, "rajon" greedily matches "jo" -> "ё" instead', () => {
    const result = feed(INITIAL_STATE, 'rajon')
    const flushed = flush(result.state)
    expect(result.committed + flushed.committed).toBe('раён')
  })

  it('the separator character itself never appears in the output', () => {
    const result = feed(INITIAL_STATE, 'a+b+c+')
    const flushed = flush(result.state)
    expect(result.committed + flushed.committed).not.toContain('+')
  })
})
