/**
 * Base transliteration table (PROJECT.md §5.2). `inputs` are the lowercase
 * Latin sequences that produce `cyrillic`; case is applied separately by
 * the engine based on how the user actually typed the sequence.
 */
export interface MappingEntry {
  readonly cyrillic: string
  readonly inputs: readonly string[]
}

export const MAPPING: readonly MappingEntry[] = [
  { cyrillic: 'а', inputs: ['a'] },
  { cyrillic: 'б', inputs: ['b'] },
  { cyrillic: 'в', inputs: ['v'] },
  { cyrillic: 'г', inputs: ['g'] },
  { cyrillic: 'д', inputs: ['d'] },
  { cyrillic: 'е', inputs: ['e'] },
  { cyrillic: 'ё', inputs: ['jo', 'yo', 'ö'] },
  { cyrillic: 'ж', inputs: ['zh'] },
  { cyrillic: 'з', inputs: ['z'] },
  { cyrillic: 'и', inputs: ['i'] },
  { cyrillic: 'й', inputs: ['j'] },
  { cyrillic: 'к', inputs: ['k'] },
  { cyrillic: 'л', inputs: ['l'] },
  { cyrillic: 'м', inputs: ['m'] },
  { cyrillic: 'н', inputs: ['n'] },
  { cyrillic: 'о', inputs: ['o'] },
  { cyrillic: 'п', inputs: ['p'] },
  { cyrillic: 'р', inputs: ['r'] },
  { cyrillic: 'с', inputs: ['s'] },
  { cyrillic: 'т', inputs: ['t'] },
  { cyrillic: 'у', inputs: ['u'] },
  { cyrillic: 'ф', inputs: ['f'] },
  { cyrillic: 'х', inputs: ['h', 'x'] },
  { cyrillic: 'ц', inputs: ['c'] },
  { cyrillic: 'ч', inputs: ['ch'] },
  { cyrillic: 'ш', inputs: ['sh'] },
  { cyrillic: 'щ', inputs: ['shh', 'w'] },
  { cyrillic: 'ъ', inputs: ['##', '#', 'tvz'] },
  { cyrillic: 'ы', inputs: ['y'] },
  { cyrillic: 'ь', inputs: ["''", "'", 'mjz'] },
  { cyrillic: 'э', inputs: ['je', 'ä'] },
  { cyrillic: 'ю', inputs: ['ju', 'yu', 'ü'] },
  { cyrillic: 'я', inputs: ['ja', 'ya', 'q'] },
]

/** The `+` sequence separator (PROJECT.md §5.5) is not part of the mapping table. */
export const SEPARATOR = '+'
