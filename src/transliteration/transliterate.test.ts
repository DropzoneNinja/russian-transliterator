import { describe, expect, it } from 'vitest'
import { MAPPING } from './mapping'
import { transliterateString } from './transliterate'

function capitalize(input: string): string {
  return input.length === 0 ? input : input.charAt(0).toUpperCase() + input.slice(1)
}

// '#' and "'" each commit to their single Cyrillic result immediately,
// since their only longer extension ('##'/"''") maps to that same result
// (ISSUE.md: "single quote does not work" — it was buffering forever
// waiting to see if a second quote followed, even though the outcome
// can't change). That means typing the doubled alias is now two
// independent commits of the same character, not one.
const DOUBLE_ALIAS_OVERRIDES: Record<string, string> = {
  '##': 'ъъ',
  "''": 'ьь',
}

describe('transliterateString: every base mapping and alias (PROJECT.md §5.2)', () => {
  for (const entry of MAPPING) {
    for (const input of entry.inputs) {
      const expected = DOUBLE_ALIAS_OVERRIDES[input] ?? entry.cyrillic
      it(`"${input}" -> "${expected}" (lowercase)`, () => {
        expect(transliterateString(input)).toBe(expected)
      })

      // Symbol-only aliases (#, ##, ', '') have no case of their own —
      // capitalizing/upper-casing them is a no-op, so they stay lowercase
      // output. Only test the upper-case variants for letter-based aliases.
      const isCaseBearing = input.toLowerCase() !== input.toUpperCase()
      if (isCaseBearing) {
        it(`"${capitalize(input)}" -> "${entry.cyrillic.toUpperCase()}" (capitalized)`, () => {
          expect(transliterateString(capitalize(input))).toBe(entry.cyrillic.toUpperCase())
        })

        it(`"${input.toUpperCase()}" -> "${entry.cyrillic.toUpperCase()}" (all uppercase)`, () => {
          expect(transliterateString(input.toUpperCase())).toBe(entry.cyrillic.toUpperCase())
        })
      }
    }
  }
})

describe('transliterateString: case handling (PROJECT.md §5.3)', () => {
  it('title-cases a multi-character sequence to one uppercase letter: "Zh" -> "Ж"', () => {
    expect(transliterateString('Zh')).toBe('Ж')
  })

  it('all-uppercase multi-character sequence: "SHH" -> "Щ"', () => {
    expect(transliterateString('SHH')).toBe('Щ')
  })

  it('is deterministic for case patterns that are neither all-upper nor title-case: "sHh" -> lowercase "щ"', () => {
    // Resolved rule (TASKS.md §1.3 point 5): output case follows the case
    // of the matched sequence's first character only.
    expect(transliterateString('sHh')).toBe('щ')
  })

  it('is deterministic for "ShH" -> uppercase "Щ" (first character is upper)', () => {
    expect(transliterateString('ShH')).toBe('Щ')
  })

  it('preserves case per word in mixed-case prose', () => {
    expect(transliterateString('Privet')).toBe('Привет')
  })
})

describe('transliterateString: longest-match parsing (PROJECT.md §5.4)', () => {
  it.each([
    ['shh', 'щ'],
    ['sh', 'ш'],
    ['ch', 'ч'],
    ['zh', 'ж'],
    ['jo', 'ё'],
    ['yo', 'ё'],
  ])('"%s" -> "%s"', (input, expected) => {
    expect(transliterateString(input)).toBe(expected)
  })

  it('"sha" resolves "sh" maximally before continuing with "a"', () => {
    expect(transliterateString('sha')).toBe('ша')
  })

  it('a trailing partial sequence is still committed, not lost ("tvz" -> "ъ" needs the full "t","v","z")', () => {
    expect(transliterateString('tvz')).toBe('ъ')
  })
})

describe('transliterateString: separator (PROJECT.md §5.5)', () => {
  it('"s+hodit" forces a flush before "h", avoiding "sh" -> "ш"', () => {
    expect(transliterateString('s+hodit')).toBe('сходит')
  })

  it('"raj+on" avoids "jo" -> "ё"', () => {
    expect(transliterateString('raj+on')).toBe('район')
  })

  it('a leading separator is a harmless no-op', () => {
    expect(transliterateString('+privet')).toBe('привет')
  })

  it('a trailing separator is a harmless no-op', () => {
    expect(transliterateString('privet+')).toBe('привет')
  })

  it('repeated separators are each a no-op', () => {
    expect(transliterateString('ra++on')).toBe('раон')
  })

  it('a separator next to punctuation still flushes and is dropped', () => {
    expect(transliterateString('s+.')).toBe('с.')
  })
})

describe('transliterateString: punctuation, whitespace and unsupported characters (PROJECT.md §5.6)', () => {
  it('preserves punctuation without transliterating it', () => {
    expect(transliterateString('privet, kak dela?')).toBe('привет, как дела?')
  })

  it('preserves digits', () => {
    expect(transliterateString('dom5')).toBe('дом5')
  })

  it('preserves tabs', () => {
    expect(transliterateString('s\th')).toBe('с\tх')
  })

  it('preserves line breaks', () => {
    expect(transliterateString('a\nb')).toBe('а\nб')
  })

  it('a boundary character flushes a pending buffer instead of discarding it', () => {
    expect(transliterateString('s ')).toBe('с ')
  })

  it('preserves emoji unchanged and still flushes the pending buffer around it', () => {
    expect(transliterateString('s😀h')).toBe('с😀х')
  })

  it('preserves existing Cyrillic input unchanged', () => {
    expect(transliterateString('привет')).toBe('привет')
  })

  it('preserves existing Cyrillic adjacent to Latin that still converts', () => {
    expect(transliterateString('sпривет')).toBe('спривет')
  })
})

describe('transliterateString: ambiguous combinations (PROJECT.md §10.1)', () => {
  it('"sh" defaults to "ш" ("shodit" without a separator does not produce "сходит")', () => {
    expect(transliterateString('shodit')).toBe('шодит')
  })

  it('the separator is what makes "сходит" from the same letters', () => {
    expect(transliterateString('s+hodit')).toBe('сходит')
  })

  it('"jo" defaults to "ё" ("rajon" without a separator does not produce "район")', () => {
    expect(transliterateString('rajon')).toBe('раён')
  })

  it('the separator is what makes "район" from the same letters', () => {
    expect(transliterateString('raj+on')).toBe('район')
  })
})

describe('transliterateString: OFF mode (PROJECT.md §5.6)', () => {
  it('leaves Latin text completely untouched', () => {
    expect(transliterateString('privet', 'off')).toBe('privet')
  })

  it('does not apply separator semantics either', () => {
    expect(transliterateString('s+h', 'off')).toBe('s+h')
  })

  it('leaves existing Cyrillic untouched too', () => {
    expect(transliterateString('привет', 'off')).toBe('привет')
  })
})

describe('transliterateString: paste-style whole-string conversion (PROJECT.md §6.4)', () => {
  it('converts a full sentence as one call', () => {
    expect(transliterateString('Shhuka i zhaba zhili v luzhe.')).toBe('Щука и жаба жили в луже.')
  })

  it('converts multi-paragraph text, preserving blank lines', () => {
    expect(transliterateString('privet\n\nkak dela')).toBe('привет\n\nкак дела')
  })
})
