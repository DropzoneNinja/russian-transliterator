- [x] Single quote ' does not work. ' should be ь
  - Fixed: the engine was buffering `'` indefinitely, waiting to see if a
    second `'` followed (the `''` alias), even though both resolve to the
    exact same character. `'` and `#` now commit immediately; only
    genuinely ambiguous sequences (where the longer form maps to a
    *different* letter, e.g. `t`→т vs `tvz`→ъ) still buffer.
- [x] Y does not work. Single y should be ы
  - Fixed: `y` is genuinely ambiguous with `ya`/`yo`/`yu`, so it still has
    to wait briefly — but it was waiting *forever* if nothing else was
    typed. Added a ~500ms idle auto-flush so any dangling pending sequence
    resolves on its own shortly after you stop typing.
- [x] When toggling cyrrilic|roman, keep keyboard focus on the text box
  - Fixed: toggling now refocuses the editor textarea afterward.
- [x] Make this multiline. I.e. allow return/enter
  - Fixed: Enter in a `<textarea>` fires a `beforeinput` of type
    `insertLineBreak`, which wasn't handled at all (so it was prevented
    and silently dropped). Now routed through the same insertion pipeline
    as any other character.
- [x] Make the letters on the top bar clickable
  - Fixed: each reference-strip letter is now a button; clicking one
    inserts that Cyrillic character directly at the caret (flushing any
    pending sequence first, same as encountering existing Cyrillic while
    typing).
- [x] Make the Cyrillic word in the toggle actually the russian name for cyrillic
  - Fixed: the toggle now reads "Кириллица | Латиница". I translated
    "Roman" to "Латиница" too, for symmetry — let me know if you'd rather
    keep "Roman" in English.
