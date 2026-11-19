# Russian Transliterator --- PROJECT.md

## 1. Project overview

Build a lightweight, self-hosted Russian transliteration web application
inspired by the typing experience on
[translit.ru](https://translit.ru/).

The application lets a user type using an ordinary Latin/English
keyboard and see the text converted live into Russian Cyrillic. It is a
focused writing tool, not a general translation service.

The interface should take its main visual cues from the supplied
translit.ru screenshot:

-   A compact transliteration reference strip above the editor.
-   One large, prominent text-editing area.
-   A simple mode switch that temporarily disables transliteration so
    Latin text can be entered.
-   No language selectors, search shortcuts, translation features,
    advertising, account features, or other unrelated controls.

The application must be responsive and installable as a Progressive Web
App (PWA) on desktop and mobile devices. It should continue to work
offline after the app has been loaded/installed.

**Working name:** Russian Transliterator\
**Primary language:** English UI, Russian output\
**Deployment:** Docker Compose on the user's home-lab infrastructure\
**Primary audience:** A single household/user; no login or multi-user
system is required.

## 2. Confirmed product decisions

These decisions are requirements, not suggestions:

  -----------------------------------------------------------------------
  Area                                Decision
  ----------------------------------- -----------------------------------
  Transliteration                     Reproduce the Russian
                                      transliteration mapping and typing
                                      behaviour of translit.ru as closely
                                      as practical

  Conversion                          Live conversion while typing

  Keyboard reference                  Show a non-interactive reference
                                      keyboard above the editor

  Text persistence                    Automatically save the current text
                                      locally in the browser

  Controls                            Copy, clear, undo/redo, download
                                      text, character and word count

  Appearance                          Follow the operating system/device
                                      light or dark appearance

  Platforms                           Responsive desktop, tablet and
                                      mobile; installable PWA

  Runtime                             Client-side transliteration; no
                                      application server/API required

  Database                            No PostgreSQL in the initial
                                      version
  -----------------------------------------------------------------------

## 3. Scope

### 3.1 In scope

-   Live Latin-to-Russian transliteration.
-   Transliteration rules and aliases described in section 5.
-   Correct handling of multi-character sequences such as `zh`, `sh`,
    `shh`, `jo`, `yu` and `ya`.
-   A clear ON/OFF transliteration mode.
-   Preserve existing text when switching modes.
-   Large, editable text area.
-   Compact visual reference showing the transliteration combinations.
-   Copy all text to clipboard.
-   Clear editor, with a confirmation step if the editor is non-empty.
-   Undo and redo.
-   Download editor contents as a UTF-8 `.txt` file.
-   Live character and word counts.
-   Browser-local text persistence.
-   System light/dark theme.
-   PWA manifest, service worker and offline app shell.
-   Docker Compose deployment behind Nginx.
-   Health endpoint suitable for container health checks.

### 3.2 Explicitly out of scope

Do not implement these unless requested in a later project revision:

-   Translation between languages.
-   Transliteration from Cyrillic back to Latin.
-   Other Cyrillic languages or other alphabets.
-   User accounts, authentication or multi-user support.
-   PostgreSQL or any other database.
-   Cloud synchronisation or server-side storage.
-   Remote APIs or third-party services.
-   Search-engine, YouTube or other external shortcuts.
-   Printing tools.
-   An interactive/clickable virtual keyboard.
-   User-customisable transliteration tables.
-   Ads, analytics, telemetry or tracking.
-   Rich-text formatting; the editor is plain text.

## 4. User experience and interface

### 4.1 Overall layout

The app should be deliberately simple and visually close to the supplied
reference screenshot.

Desktop layout:

1.  Header containing the app name and a compact transliteration mode
    control.
2.  Transliteration reference strip, centred above the editor.
3.  A small toolbar containing the requested actions.
4.  A large text editor occupying nearly all remaining available space.
5.  A subtle status/footer row showing character and word counts and
    save status.

The editor is the main focus. Avoid large headers, decorative cards,
unnecessary whitespace, sidebars or dashboard-style panels.

Mobile layout:

1.  Compact header and mode control.
2.  Transliteration reference strip that wraps or horizontally scrolls
    without making the page excessively tall.
3.  Toolbar that wraps or uses compact icon buttons with accessible
    labels.
4.  Large editor sized to the available viewport.
5.  Counts/status displayed compactly below the editor.

Tablet layout should naturally adapt between desktop and mobile.

### 4.2 Editor

-   Use a native `<textarea>` or an equivalently accessible plain-text
    editing control.
-   It must support normal browser editing behaviour: selection, cursor
    movement, cut, copy, paste, backspace, delete, Home/End, keyboard
    shortcuts and touch editing.
-   Use a readable font with good Cyrillic coverage.
-   Use a comfortable font size and line height.
-   The editor should stretch to use available screen space.
-   On desktop, aim for a minimum height that makes the editor feel like
    the dominant part of the page.
-   On mobile, account for browser chrome and the on-screen keyboard; do
    not force a fixed height that makes the input unusable.
-   Preserve scroll position and selection/caret position when practical
    during conversion and mode changes.
-   Do not unexpectedly move the caret to the end of the text after
    every keystroke.
-   Plain text only. Preserve line breaks and whitespace.

### 4.3 Transliteration mode control

Provide one prominent but compact toggle:

-   **Translit ON:** Latin input is converted to Cyrillic.
-   **Translit OFF:** Latin characters are inserted literally.
-   Switching OFF must not convert or otherwise modify existing text.
-   Switching ON again affects subsequent typing only; it must not
    re-transliterate existing text.
-   The current mode must be visually obvious.
-   Also support `Escape` as a keyboard shortcut to toggle the mode,
    provided the key is not being used by an active browser/OS
    composition interaction.
-   Do not intercept Escape when a dialog or another focused control
    needs it.
-   The mode is a UI preference and may be saved locally. The initial
    default is ON.

### 4.4 Transliteration reference

Display a compact, non-interactive reference above the editor, inspired
by the screenshot.

-   Show each key/sequence and its resulting Cyrillic character.
-   Include the aliases where multiple input sequences are supported.
-   Clearly distinguish multi-character sequences.
-   Show uppercase behaviour, for example through a Shift hint or a
    concise note.
-   On narrow screens, allow wrapping or horizontal scrolling; do not
    shrink the keys until they become unreadable.
-   The reference is informational only; clicking it does not type into
    the editor.

### 4.5 Toolbar and status

Provide the following actions:

  Action     Behaviour
  ---------- ------------------------------------------------------------
  Copy       Copy the complete editor contents to the system clipboard
  Clear      Clear the editor; ask for confirmation if it contains text
  Undo       Undo the last text edit
  Redo       Redo an undone text edit
  Download   Download the current contents as a UTF-8 `.txt` file
  Count      Show live character and word counts

Use accessible labels and tooltips. On mobile, icon-only controls must
have accessible names and sufficiently large touch targets.

Clipboard behaviour:

-   Use the Clipboard API when available in a secure context.
-   Provide a graceful fallback or a clear error message if clipboard
    access is unavailable.
-   Show brief feedback such as "Copied" without using intrusive modal
    dialogs.

Download behaviour:

-   Use a sensible filename such as `russian-text.txt`.
-   Preserve line breaks and Unicode Cyrillic characters.
-   Do not upload the text anywhere.

Count behaviour:

-   Character count should count Unicode code points, not UTF-16 code
    units.
-   Word count should handle Russian Cyrillic and Latin words,
    punctuation and whitespace sensibly.
-   Empty or whitespace-only text should report zero words.
-   Define and test the chosen counting behaviour in the implementation.

## 5. Transliteration engine

### 5.1 Reference and compatibility target

Use the Russian transliteration mode shown in the supplied screenshot
and the default Russian mapping presented by translit.ru as the
compatibility target.

This is a practical typing convention, not a formal linguistic
transliteration standard. The aim is to reproduce the familiar
translit.ru input experience, including aliases and multi-character
sequences.

Reference material: - https://translit.ru/ - The supplied screenshot in
the project brief.

The mapping below is based on the visible reference and translit.ru's
published Russian mapping. Where the screenshot and current site
presentation differ slightly in how aliases are displayed, implement the
aliases listed below and document them in tests.

### 5.2 Base mapping

Implement case-insensitive Latin input, with case-preserving Cyrillic
output.

  Cyrillic   Input sequence(s)
  ---------- -------------------
  а          `a`
  б          `b`
  в          `v`
  г          `g`
  д          `d`
  е          `e`
  ё          `jo`, `yo`, `ö`
  ж          `zh`
  з          `z`
  и          `i`
  й          `j`
  к          `k`
  л          `l`
  м          `m`
  н          `n`
  о          `o`
  п          `p`
  р          `r`
  с          `s`
  т          `t`
  у          `u`
  ф          `f`
  х          `h`, `x`
  ц          `c`
  ч          `ch`
  ш          `sh`
  щ          `shh`, `w`
  ъ          `##`, `#`, `tvz`
  ы          `y`
  ь          `''`, `'`, `mjz`
  э          `je`, `ä`
  ю          `ju`, `yu`, `ü`
  я          `ja`, `ya`, `q`

**Important:** The screenshot visibly presents the special signs and
aliases in a compact form. The current translit.ru reference page also
documents aliases such as `ö`, `ä`, `ü`, `q`, `tvz` and `mjz`. Support
the complete alias list above rather than only the most common
English-letter combinations.

### 5.3 Case handling

-   Lowercase input produces lowercase Cyrillic.
-   Uppercase input produces uppercase Cyrillic.
-   An uppercase first character in a multi-character sequence should
    produce one uppercase Cyrillic character, e.g. `Zh` → `Ж`.
-   All-uppercase sequences should produce uppercase output, e.g. `SHH`
    → `Щ`.
-   Mixed-case handling should be deterministic and covered by tests.
-   Do not accidentally turn the remaining letters of a word into
    uppercase after converting an initial capital.

### 5.4 Longest-match parsing

The transliteration engine must use longest-match parsing.

Examples: - `shh` → `щ`, not `ш` followed by `х` or another character. -
`sh` → `ш`. - `ch` → `ч`. - `zh` → `ж`. - `jo` and `yo` → `ё`.

A multi-character sequence may be incomplete while the user is typing.
For example, after typing `s` the engine must not commit a result if the
next character could complete `sh` or `shh`.

Implement a streaming/input-buffer strategy:

1.  Keep a pending Latin input sequence while it may be the beginning of
    a longer valid mapping.
2.  Commit a Cyrillic character when the longest valid sequence is
    unambiguous.
3.  If the pending sequence is no longer a valid prefix, emit the
    appropriate shorter mapping and process the remaining input.
4.  On a boundary such as whitespace or punctuation, flush any pending
    sequence.
5.  At the end of an editing operation, do not leave text visually
    missing; show or commit the pending content using a predictable
    rule.
6.  Ensure the user can continue typing naturally without needing to
    pause between letters.

The engine must be deterministic and must not require a network
connection.

### 5.5 Disambiguation

Some combinations can be ambiguous in ordinary text. Provide a separator
convention consistent with translit.ru:

-   A `+` typed between letters acts as a transliteration separator and
    is not included in the resulting text.
-   It forces the preceding pending sequence to be committed before the
    following sequence begins.
-   Example: `s+hodit` should produce `сходить`, rather than
    interpreting `sh` as `ш`.
-   Example: `raj+on` should produce `район`, rather than interpreting
    `jo`/`yo` as `ё`.
-   The separator should not be displayed in the final Cyrillic text.
-   Add tests for separator use at the beginning/end of input, repeated
    separators and separators around punctuation.

If the exact behaviour of an unusual edge case is not clear from the
reference, choose a consistent, user-friendly behaviour and document it.

### 5.6 Punctuation, whitespace and unsupported characters

-   Preserve spaces, tabs, line breaks, punctuation, digits and symbols.
-   Do not transliterate punctuation.
-   Do not silently discard unsupported characters.
-   Preserve emoji and non-Latin characters unchanged.
-   When transliteration is OFF, all typed characters must be inserted
    literally.
-   Pasted content must be handled predictably. See section 6.4.

### 5.7 Editing existing text

This is a critical requirement.

A naïve implementation that converts the entire textarea value on every
keystroke will break cursor positioning, selection replacement, undo and
editing in the middle of a sentence.

Implement input processing around the user's edit operation:

-   Track the prior editor value and selection range.
-   Identify the inserted/replaced input range.
-   Transliterate the newly typed Latin input while considering adjacent
    pending Latin characters where necessary.
-   Update the value and selection/caret position correctly.
-   Support insertion at the beginning, middle and end of text.
-   Support replacing a selected range.
-   Support deletion/backspace without resurrecting deleted text.
-   Support multi-character composition and mobile input methods.
-   Avoid interfering with IME composition events; defer transliteration
    until composition is complete where appropriate.
-   Test edits around multi-character sequences and punctuation.

If reliable incremental transformation proves too complex for a
particular browser editing path, prefer a robust, predictable
implementation over clever but fragile cursor manipulation.

## 6. State, persistence and history

### 6.1 Local persistence

Save the current editor text locally in the browser, using
`localStorage` or IndexedDB.

For this small app, `localStorage` is sufficient unless implementation
testing demonstrates a practical limitation.

Requirements:

-   Restore the previous text when the app is reopened or refreshed.
-   Save changes automatically, with a small debounce to avoid excessive
    writes.
-   Save the transliteration ON/OFF preference.
-   Do not save text to the server.
-   Do not use cookies for application state.
-   Provide a clear operation that also updates the stored value.
-   Handle storage being unavailable, full or blocked without crashing.
-   Display a subtle save status such as "Saved locally" or "Local
    saving unavailable".
-   Do not store undo history indefinitely across browser sessions
    unless specifically needed; normal undo/redo within the current
    session is sufficient.

### 6.2 Undo and redo

-   Support standard keyboard shortcuts: Ctrl+Z / Cmd+Z for undo and
    Ctrl+Shift+Z / Cmd+Shift+Z for redo. Support Ctrl+Y where
    appropriate.
-   Toolbar buttons must invoke the same history system.
-   Undo/redo must operate on the visible editor text, not on raw
    intermediate Latin input.
-   Group normal typing into sensible undo units rather than creating an
    unusable history entry for every individual character.
-   Clear should be undoable.
-   Switching transliteration mode should not create a text-history
    entry.
-   Ensure the implementation does not conflict with the browser's
    native textarea undo behaviour. Choose one coherent history strategy
    and test it.

### 6.3 Derived state

Character count, word count, save status and button enabled/disabled
states should derive from the current application state. Avoid redundant
state that can become inconsistent.

### 6.4 Paste behaviour

Define and implement a predictable paste policy:

-   Pasting Cyrillic text must preserve it.
-   Pasting text while transliteration is OFF must preserve the pasted
    text exactly.
-   Pasting Latin text while transliteration is ON should transliterate
    it using the same mapping and separator rules.
-   Mixed Latin/Cyrillic pasted text should preserve existing Cyrillic
    and convert supported Latin sequences.
-   Preserve pasted line breaks and punctuation.
-   Ensure a paste is one sensible undo operation.
-   If the browser cannot distinguish the source or composition path
    reliably, favour preserving the user's content rather than
    destructive conversion.

## 7. PWA requirements

The application must be installable as a PWA.

Implement:

-   A valid web app manifest.
-   Application name and short name.
-   App icons in the required sizes, including 192×192 and 512×512.
-   Maskable icon support where practical.
-   A service worker.
-   Offline caching of the application shell and static assets.
-   A sensible update strategy so users can receive new versions without
    being trapped on stale assets.
-   Appropriate theme/background colours.
-   Standalone display mode.
-   Responsive viewport configuration.
-   Install guidance only when the browser supports installation; do not
    show a permanently visible install button when unavailable.

Platform notes:

-   Chromium-based desktop browsers should support normal PWA
    installation.
-   Android browsers should support installation where available.
-   iOS/iPadOS users should be able to use the browser's "Add to Home
    Screen" flow. Provide a small help hint if useful, but do not
    attempt to imitate unsupported native installation prompts.
-   Test standalone mode and safe-area handling on mobile.

The app must be usable offline after the first successful load. No
runtime CDN dependencies or remote fonts are permitted.

## 8. Appearance and accessibility

### 8.1 Theme

-   Follow `prefers-color-scheme` by default.
-   Support both light and dark palettes.
-   Use CSS variables/design tokens so colours remain consistent.
-   Avoid hard-coded colours throughout components.
-   The editor, reference strip, toolbar, borders and status text must
    all remain legible in both themes.
-   No manual theme selector is required in the initial version.

### 8.2 Accessibility

-   Use semantic HTML.
-   All controls must be keyboard accessible.
-   Provide visible focus states.
-   Provide accessible names for icon buttons.
-   Ensure adequate colour contrast in light and dark themes.
-   Do not rely on colour alone to indicate whether transliteration is
    ON or OFF.
-   Respect reduced-motion preferences.
-   Use appropriate touch target sizes on mobile.
-   Keep screen-reader announcements for transient feedback brief and
    non-disruptive.

## 9. Technical architecture

### 9.1 Technology choices

Use the following stack:

  Layer         Technology
  ------------- ------------------------------------------------------
  UI            React
  Language      TypeScript, strict mode
  Build tool    Vite
  Styling       Tailwind CSS or a similarly lightweight CSS approach
  PWA           Vite PWA plugin / Workbox
  Web server    Nginx
  Containers    Docker and Docker Compose
  Runtime API   None
  Database      None

Do not add PostgreSQL simply because it is part of other home-lab
projects. This app has no server-side data requirement.

### 9.2 Suggested project structure

Use a clean, maintainable structure similar to:

``` text
russian-transliterator/
├── PROJECT.md
├── README.md
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── nginx/
│   └── default.conf
├── public/
│   ├── icons/
│   └── favicon.svg
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── app.css
│   ├── components/
│   │   ├── AppHeader.tsx
│   │   ├── ModeToggle.tsx
│   │   ├── TransliterationReference.tsx
│   │   ├── Editor.tsx
│   │   ├── Toolbar.tsx
│   │   └── StatusBar.tsx
│   ├── hooks/
│   │   ├── useLocalPersistence.ts
│   │   └── useEditorHistory.ts
│   ├── transliteration/
│   │   ├── mapping.ts
│   │   ├── transliterate.ts
│   │   └── transliterate.test.ts
│   ├── utils/
│   │   ├── counts.ts
│   │   └── download.ts
│   ├── types/
│   └── main.tsx
├── index.html
├── vite.config.ts
└── tsconfig.json
```

The exact structure may be adjusted as implementation requires, but keep
the transliteration engine independent of React so it can be tested in
isolation.

### 9.3 Nginx

-   Serve the built static application.
-   Configure SPA fallback to `index.html`.
-   Serve static assets with appropriate caching headers.
-   Do not cache `index.html` indefinitely; it must allow users to
    discover new app versions.
-   Cache fingerprinted build assets aggressively.
-   Serve the service worker and web manifest with headers that permit
    timely updates.
-   Enable gzip or Brotli if readily available in the chosen Nginx
    image.
-   Add a simple health endpoint, e.g. `/health`, returning HTTP 200.
-   Do not expose directory listings.
-   Do not expose source maps in production unless explicitly enabled
    for debugging.

### 9.4 Docker

Provide:

-   A multi-stage Dockerfile: Node build stage and small Nginx runtime
    stage.
-   A Docker Compose service with a clear service/container name.
-   Configurable host port through an environment variable.
-   A restart policy suitable for home-lab use.
-   Health check.
-   No privileged mode.
-   No unnecessary volumes or persistent server-side data.
-   No database container.
-   A `.dockerignore` that excludes `node_modules`, build output and
    local development artefacts as appropriate.

The app should be deployable using the familiar workflow:

``` bash
git pull
docker compose up --build -d
```

Document how to change the published port and how to inspect container
logs.

### 9.5 Configuration

Keep configuration minimal. At minimum:

-   `APP_PORT` or equivalent for the host-published port.
-   Optional app title if useful.

Do not introduce secrets or environment variables for services that do
not exist.

## 10. Testing and quality requirements

Use a test framework compatible with Vite/TypeScript, such as Vitest.

### 10.1 Transliteration unit tests

At minimum, test:

-   Every single-character mapping.
-   Every supported alias.
-   Lowercase and uppercase.
-   Mixed-case input.
-   Longest-match behaviour.
-   Partial sequences while typing.
-   Sequence flush at whitespace and punctuation.
-   `+` separator behaviour.
-   Repeated separators.
-   Digits and punctuation.
-   Tabs and line breaks.
-   Emoji and unsupported Unicode.
-   Existing Cyrillic input.
-   Transliteration OFF.
-   Paste conversion.
-   Common ambiguous combinations, including `sh` in words where the
    user intends `сх`, and `j` adjacent to `o` where the user intends
    `йо`.

### 10.2 Editor interaction tests

Test:

-   Typing at the end.
-   Typing at the beginning and middle.
-   Replacing a selection.
-   Backspace and delete.
-   Undo and redo.
-   Clear followed by undo.
-   Mode switching without changing existing text.
-   Caret position after a conversion.
-   Paste while ON and OFF.
-   Browser refresh and text restoration.
-   Character and word counts.

### 10.3 Responsive and PWA tests

Test at representative viewport widths:

-   Small mobile (approximately 360 px wide).
-   Large mobile.
-   Tablet.
-   Desktop.

Verify:

-   No horizontal page overflow.
-   The editor remains usable with the mobile keyboard open.
-   Reference keys remain legible.
-   Toolbar controls remain reachable.
-   Light and dark themes work.
-   PWA manifest is valid.
-   Service worker caches the app shell.
-   The app can be reopened offline after initial installation/load.
-   Nginx health endpoint returns HTTP 200.

### 10.4 Quality gates

Before considering the project complete:

-   TypeScript strict checks pass.
-   Linting passes.
-   Unit and component tests pass.
-   Production build succeeds.
-   Docker image builds successfully.
-   Docker Compose starts cleanly.
-   No browser console errors in normal use.
-   No external network request is required for normal app
    functionality.

## 11. Privacy and security

-   All text processing happens in the user's browser.
-   Text is stored only in the browser's local storage.
-   No text is transmitted to the Docker host or any third party.
-   No analytics, telemetry, tracking pixels or advertising.
-   No authentication is required.
-   Do not log editor contents.
-   Do not add unnecessary permissions to the PWA.
-   Clipboard access should only occur after the user explicitly
    activates Copy.
-   Download should be generated locally in the browser.

Include a short privacy statement in the README explaining that the text
remains in the local browser unless the user copies or downloads it.

## 12. Implementation plan

Implement in the following order:

### Phase 1 --- Foundation

-   Create Vite + React + TypeScript project.
-   Enable TypeScript strict mode.
-   Set up linting and testing.
-   Create base responsive layout and theme tokens.
-   Add Nginx and Docker build/deployment.

### Phase 2 --- Transliteration engine

-   Implement mapping table and aliases.
-   Implement longest-match parser and pending-sequence handling.
-   Implement separator behaviour.
-   Implement case handling.
-   Add comprehensive unit tests before integrating with the editor.

### Phase 3 --- Editor experience

-   Integrate transliteration with textarea editing.
-   Handle cursor, selection and deletion correctly.
-   Add ON/OFF mode toggle and Escape shortcut.
-   Add reference strip.
-   Add toolbar actions, counts and status.

### Phase 4 --- Persistence and history

-   Add browser-local persistence.
-   Add undo/redo.
-   Add paste handling.
-   Test refresh and recovery behaviour.

### Phase 5 --- PWA and polish

-   Add manifest, icons and service worker.
-   Verify offline behaviour.
-   Complete responsive layouts.
-   Verify system light/dark appearance.
-   Complete accessibility and cross-browser checks.

### Phase 6 --- Deployment documentation

-   Finalise Docker Compose and Nginx configuration.
-   Document build, deployment, update, logs and troubleshooting.
-   Verify the documented `git pull` and `docker compose up --build -d`
    workflow.

## 13. Acceptance criteria

The project is complete when all of the following are true:

1.  A user can open the app and immediately type Russian using a
    standard Latin keyboard.
2.  Supported transliteration sequences convert live and correctly.
3.  The transliteration reference is visible above the editor and is
    responsive.
4.  The user can turn transliteration OFF, enter literal Latin text, and
    turn it ON again without existing text changing.
5.  Multi-character mappings are handled correctly without breaking the
    user's typing flow.
6.  Cursor positioning, selection, deletion, paste, undo and redo work
    reliably.
7.  Text is restored after refreshing or reopening the app in the same
    browser.
8.  Copy, clear, download, undo and redo controls work.
9.  Character and word counts update live.
10. The app follows the operating system's light/dark appearance.
11. The app is usable on desktop, tablet and mobile.
12. The app can be installed as a PWA on supported platforms.
13. The app works offline after its first successful load.
14. The app runs entirely in Docker behind Nginx.
15. No database, external API or third-party service is required.
16. No user text leaves the browser.

## 14. Important implementation guidance for Claude

-   Prioritise correctness of the transliteration engine and editor
    interaction over visual embellishment.
-   Do not transliterate the entire textarea blindly on every React
    render or keystroke.
-   Keep the transliteration logic pure, independently testable and
    separate from UI components.
-   Be particularly careful with multi-character sequences, cursor
    positions, selection replacement, undo/redo and mobile input
    composition.
-   Do not silently alter or lose user text.
-   Keep the interface minimal and faithful to the supplied screenshot,
    while improving usability on modern mobile devices.
-   Do not add PostgreSQL, an API server, authentication or other
    infrastructure without a clear requirement.
-   Build the application as a complete, runnable repository rather than
    a mock-up.
-   Include all Docker, Nginx, PWA, test and README files required for a
    working deployment.
