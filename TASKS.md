# Russian Transliterator — TASKS.md

Tracks the build against [PROJECT.md](./PROJECT.md). Section references like
`§5.4` point back to PROJECT.md. Work phases top-to-bottom — Phase 2 (engine)
must be solid and fully tested before Phase 3 wires it into the editor, per
PROJECT.md §14.

Decisions settled with the user before this plan was written:

- **Icon/branding:** no assets were supplied, so Claude designs a simple
  placeholder icon (single SVG source, generic glyph) and generates all
  required PWA sizes. Swappable later.
- **Testing depth:** Vitest + React Testing Library only. PWA/offline/
  responsive checks (§10.3) are a manual QA checklist, not automated
  browser tests — no Playwright/E2E dependency added.
- **Deployment network:** standalone container, `APP_PORT` published
  directly to the host. No reverse-proxy labels/integration.

---

## 1. System design

### 1.1 Shape of the system

Pure client-side SPA. One Nginx container serves the built static assets;
there is no application server, API, or database. All state lives in the
browser (`localStorage`) and never leaves it except via explicit Copy/
Download actions.

```
Browser
 ├─ React UI shell (App.tsx + components)
 ├─ transliteration/   pure, framework-agnostic engine (no DOM)
 ├─ editor/            input pipeline hook — owns the textarea, wires
 │                     engine + history + persistence to real browser events
 ├─ history/           custom undo/redo stack
 ├─ persistence/       localStorage read/write, debounced, versioned
 └─ pwa/               manifest + service worker (vite-plugin-pwa)

Nginx container
 └─ serves dist/, SPA fallback, /health, cache headers
```

No global state library (Redux/Zustand/Context) is needed — this is a
single-screen app. `App.tsx` composes a handful of focused hooks
(`useTransliterationEditor`, `useHistory`, `useLocalPersistence`) and passes
derived state down as props to sibling presentational components
(Header, ModeToggle, ReferenceStrip, Toolbar, Editor, StatusBar).

### 1.2 Styling

Tailwind CSS utility classes, with the actual colour/spacing values defined
as CSS custom properties on `:root` (light) and overridden under
`prefers-color-scheme: dark`. Tailwind's `darkMode: 'media'` + `theme.extend`
reads from those variables, so there's a single source of truth for tokens
(§8.1) while still getting Tailwind's authoring speed. No manual theme
switcher — the OS setting is the only input.

### 1.3 Transliteration engine — resolved algorithm (§5.4, §5.5)

This is the highest-risk part of the system, so the algorithm is fixed here
rather than left to be improvised during implementation.

**Invariant:** every mapping key's single-character prefix is itself a
complete mapping (verified by hand against the full table in §5.2 — e.g.
`shh` → `s` is complete (с), `sh` is complete (ш); `tvz` → `t` is complete
(т); `mjz` → `m` is complete (м)). This guarantees the flush rule below
always has something valid to commit.

**Streaming matcher (maximal munch with one buffered span):**

1. Keep `pending.raw`: the Latin substring immediately before the caret
   that is still a valid prefix of ≥1 mapping key. It is materialized as
   literal, unconverted Latin text in the textarea while ambiguous — this
   directly implements §5.4's "keep a pending Latin input sequence" and
   "do not leave text visually missing."
2. On each new character `c` adjacent to `pending.raw`:
   - If `pending.raw + c` is a prefix of some key, extend the buffer
     (still just literal Latin on screen).
   - If `pending.raw + c` exactly matches a key **and no longer key
     extends it**, commit immediately: replace the literal span with the
     mapped Cyrillic (case-adjusted), clear `pending`.
   - If `pending.raw + c` matches no key and is not a valid prefix of
     any key (the extension broke), **flush**: commit the longest prefix
     of `pending.raw` that matches a complete key, then reprocess the
     remainder (including `c`) as fresh input, recursively.
3. **Flush triggers** (commit `pending` using the same longest-complete-
   prefix rule, then clear it): whitespace/punctuation/digit/newline,
   emoji or other non-Latin character, existing Cyrillic encountered,
   the `+` separator, caret/selection moving away from the pending
   position, blur, mode toggle, undo/redo, and end of any paste
   insertion.
4. **`+` separator** (§5.5): on `+`, flush `pending` per the rule above,
   then drop the `+` itself (never inserted), then continue processing
   subsequent input as a fresh buffer with no carry-over. Verified by
   hand against both PROJECT.md examples: `raj+on` → `район` matches
   exactly. (`s+hodit` → PROJECT.md's own example text "сходить" has one
   more letter — a soft sign — than the literal input characters
   support; treated as a minor documentation nuance, not a spec
   requirement — see §4 note below.)
5. **Case handling (§5.3):** case is tracked per matched span, not per
   character of the *input* alphabet — an initial capital on a multi-char
   sequence (`Zh`) yields one capital Cyrillic letter; all-caps input
   (`SHH`) yields capital output; this is applied at commit time, after
   the longest match is known, so it never needs to re-case already
   committed text.
6. **Undo/redo and `pending`:** history snapshots are plain
   `{text, selectionStart, selectionEnd}` values and know nothing about
   `pending`. After any undo/redo, the engine's `pending` ref is always
   reset to `null` — the user resumes typing fresh at the restored caret.
   This is the one coherent rule required by §6.2.

### 1.4 Editor input pipeline (§5.7)

- Textarea is **uncontrolled** (DOM owns `.value`/selection moment to
  moment); engine state lives in a ref, not React state, so applying a
  conversion never triggers a React re-render that could fight the
  caret. React state is only updated afterwards, for derived UI
  (counts, button-disabled state, save status).
- Primary path: `beforeinput` handler intercepts `insertText`,
  `insertFromPaste`, `insertFromDrop`, and the `delete*` input types,
  calls `preventDefault()`, computes the result via the engine, and
  applies `.value` + `setSelectionRange` synchronously in one go — no
  flicker, no caret jump.
- IME composition (`insertCompositionText`) is **not** intercepted;
  conversion runs on `compositionend` by diffing against the
  pre-composition snapshot, per §5.7's explicit IME requirement.
- A secondary `input`-event diff path exists as a fallback for the rare
  case `beforeinput` isn't available/reliable.
- Paste is additionally handled via the native `paste` event (reading
  `clipboardData.getData('text/plain')` directly, more reliable than
  relying on `beforeinput`'s `data` for large pastes), routed through
  the same insertion primitive so it's one undo entry.
- Browser-native textarea undo is bypassed entirely (setting `.value`
  programmatically already breaks most browsers' native undo stack);
  Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z / Ctrl+Y are intercepted at `keydown`
  and routed to the custom history manager instead, so there is exactly
  one undo system in play (§6.2).

### 1.5 Persistence (§6.1)

`localStorage` key holding `{ v: 1, text, mode, savedAt }`. Writes are
debounced ~400–600ms after the last change. Reads/writes are wrapped in
try/catch to handle quota errors or storage being disabled/blocked,
falling back to in-memory-only operation with a "Local saving unavailable"
status instead of crashing.

### 1.6 PWA update strategy (§7)

`vite-plugin-pwa` with `registerType: 'prompt'` (not silent `autoUpdate`):
a new service worker is detected and precached in the background, and a
small non-intrusive banner/button ("Update available") lets the user
apply it on their own terms — consistent with the rest of the app's
"brief, non-disruptive feedback" style (§4.5, §8.2) and avoids yanking the
page out from under someone mid-sentence.

---

## 2. Phases and tasks

### Phase 0 — Scaffolding & tooling

- [x] **P0-1** Initialize git repo; `.gitignore` (node_modules, dist, .env, local editor files).
- [x] **P0-2** Scaffold Vite + React + TypeScript project; enable `strict` plus `noUncheckedIndexedAccess`.
- [x] **P0-3** Configure ESLint (`typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`) + Prettier.
- [x] **P0-4** Configure Vitest + `@testing-library/react` + jsdom environment.
- [x] **P0-5** Create directory skeleton per PROJECT.md §9.2 (adjusted for `editor/`, `history/`, `persistence/`, `pwa/` modules from §1 above).
- [x] **P0-6** npm scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`.
- [x] **P0-7** README stub with title and placeholder section headers to be filled in during later phases.

### Phase 1 — Layout, theming & deployment skeleton

- [x] **P1-1** Define design tokens as CSS custom properties (light + `prefers-color-scheme: dark`); wire into Tailwind config (§8.1, §1.2 above).
- [x] **P1-2** Build static `AppShell` layout matching the screenshot structure: header, reference-strip placeholder, toolbar placeholder, editor placeholder, status-bar placeholder (§4.1).
- [x] **P1-3** Responsive breakpoint behaviour for mobile/tablet/desktop stacking (§4.1).
- [x] **P1-4** Bundle a locally-hosted, Cyrillic-covering readable font — no remote font CDN (§7).
- [x] **P1-5** Multi-stage `Dockerfile` (Node build stage → small Nginx runtime stage).
- [x] **P1-6** `nginx/default.conf`: SPA fallback to `index.html`, aggressive caching on fingerprinted assets, short/no-cache on `index.html` and the service worker/manifest, `/health` → 200, no directory listing, gzip/brotli if available (§9.3).
- [x] **P1-7** `docker-compose.yml`: named service, `APP_PORT` env var published directly to host (no reverse-proxy integration — confirmed), restart policy, healthcheck, no privileged mode, no volumes (§9.4).
- [x] **P1-8** `.dockerignore` excluding `node_modules`, build output, local dev artefacts.
- [x] **P1-9** Verify the walking skeleton: `docker compose up --build` serves the placeholder shell and `/health` returns 200.

### Phase 2 — Transliteration engine core (pure, no DOM)

- [x] **P2-1** Mapping/alias data per §5.2, structured for efficient longest-match lookup (prefix map/trie).
- [x] **P2-2** Case handling per §5.3 and §1.3 point 5 above.
- [x] **P2-3** Streaming longest-match engine implementing the algorithm in §1.3 (points 1–3).
- [x] **P2-4** Flush triggers per §1.3 point 3.
- [x] **P2-5** `+` separator handling per §1.3 point 4, including leading/trailing/repeated separators and separators adjacent to punctuation.
- [x] **P2-6** Transliteration-OFF passthrough (pure identity function, same module shape as the ON path).
- [x] **P2-7** Pure `transliterateString(s)` helper for whole-string input (used by paste handling in Phase 6), preserving existing Cyrillic runs.
- [x] **P2-8** Exhaustive unit tests (§10.1): every base mapping, every alias, lower/upper/mixed case, longest-match, partial sequences mid-typing, flush at every boundary type, separator incl. repeats/edges, digits/punctuation, tabs/newlines, emoji/unsupported Unicode passthrough, existing-Cyrillic passthrough, OFF mode, the `сх`-vs-`ш` and `йо`-vs-`ё` ambiguous cases.
- [x] **P2-9** Short module-level doc comment capturing the finalized algorithm (point back to this file rather than re-explaining it at length).

### Phase 3 — Editor input pipeline & mode toggle

- [x] **P3-1** `useTransliterationEditor` hook: uncontrolled textarea ref + engine state held in a ref (§1.4).
- [x] **P3-2** `beforeinput` handler for `insertText`/`insertFromPaste`/`insertFromDrop`/`delete*`, with synchronous value+selection apply.
- [x] **P3-3** Composition handling: ignore `beforeinput` during composition; convert on `compositionend` via diff.
- [x] **P3-4** `input`-event diffing fallback path.
- [x] **P3-5** Selection-replace insertion and deletion (backspace/delete/word-delete) without resurrecting removed text.
- [x] **P3-6** Mode toggle (ON/OFF): flush pending on toggle; OFF is pure passthrough; toggling never touches existing text (§4.3).
- [x] **P3-7** Escape shortcut to toggle mode, guarded against active IME composition and focused dialogs/controls that need Escape (§4.3).
- [x] **P3-8** `ReferenceStrip` component, rendering from the same mapping data as the engine (no second hand-copied table), responsive wrap/scroll, shift/uppercase hint, non-interactive (§4.4).
- [x] **P3-9** Integration tests (§10.2 subset): typing at start/middle/end, replacing a selection, backspace/delete, caret position after conversion, mode switch leaving existing text untouched.

### Phase 4 — Toolbar, counts & status

- [x] **P4-1** `Toolbar`: Copy/Clear/Undo/Redo/Download, accessible labels + tooltips, compact icon-only mobile variant with adequate touch targets (§4.5, §8.2).
- [x] **P4-2** Copy via Clipboard API with secure-context fallback/error messaging; brief non-modal "Copied" feedback (§4.5).
- [x] **P4-3** Clear with confirmation only when non-empty; Clear is undoable (§4.5, §6.2).
- [x] **P4-4** Download: client-side UTF-8 `.txt` Blob, filename `russian-text.txt`, preserves line breaks/Cyrillic, no network call (§4.5).
- [x] **P4-5** Character count (Unicode code points) and word count (Cyrillic+Latin+punctuation aware; empty/whitespace-only → 0) as pure, unit-tested utils (§4.5, §6.3).
- [x] **P4-6** `StatusBar`: live counts + save status, entirely derived — no redundant stored state (§6.3).

### Phase 5 — Persistence & undo/redo history

- [x] **P5-1** `localStorage` wrapper per §1.5: versioned schema, debounced writes, try/catch around quota/blocked storage.
- [x] **P5-2** Restore text + mode on load; treat corrupt/missing/old-version data as empty state rather than failing.
- [x] **P5-3** Custom undo/redo stack: `{text, selectionStart, selectionEnd}` snapshots with a documented coalescing policy (time gap, contiguous position, operation-type changes each start a new entry; paste/clear always their own entry).
- [x] **P5-4** Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y intercepted at `keydown`; native textarea undo never invoked (§6.2, §1.4).
- [x] **P5-5** Wire Toolbar Undo/Redo buttons to the same history manager; disabled state derived from stack emptiness.
- [x] **P5-6** On undo/redo, reset engine `pending` to `null` (§1.3 point 6).
- [x] **P5-7** Tests: refresh/restore round-trip, clear+undo, undo/redo across mixed typing/paste/clear, mode toggle creating no history entry (§10.2).

### Phase 6 — Paste handling & cross-cutting edge cases

- [ ] **P6-1** Native `paste` event handler reading `clipboardData`, routed through the shared insertion primitive as one undo entry (§6.4, §1.4).
- [ ] **P6-2** Paste policy: OFF preserves pasted text exactly; ON transliterates Latin runs while preserving existing Cyrillic runs; mixed content handled per run (§6.4).
- [ ] **P6-3** Preserve pasted line breaks/punctuation/tabs; verify with multi-paragraph paste.
- [ ] **P6-4** Tests: paste while ON/OFF, mixed Latin+Cyrillic paste, paste containing separators, paste landing inside an in-flight ambiguous sequence (§10.1, §10.2).

### Phase 7 — PWA: manifest, icons, service worker, offline

- [ ] **P7-1** Design the placeholder app icon (single SVG source, per the agreed approach) and export 192×192/512×512 PNG, a maskable variant with safe-area padding, and `favicon.svg`.
- [ ] **P7-2** Web app manifest: name/short_name, icons, theme/background colour, `standalone` display, `start_url`, orientation (§7).
- [ ] **P7-3** Integrate `vite-plugin-pwa` with `registerType: 'prompt'`; precache the app shell and static assets (§1.6).
- [ ] **P7-4** Lightweight "Update available" UI that applies the waiting service worker on user action (§1.6).
- [ ] **P7-5** iOS Add-to-Home-Screen support: `apple-touch-icon`, `apple-mobile-web-app-*` tags, small inline hint text — no fake install prompt (§7).
- [ ] **P7-6** Manually verify offline reload after first successful load.
- [ ] **P7-7** Confirm zero runtime CDN/remote-font/remote-script dependencies anywhere in the shipped build (§7).

### Phase 8 — Accessibility, responsive & cross-browser polish

- [ ] **P8-1** Semantic landmarks, labelled controls, visible focus states on every interactive element (§8.2).
- [ ] **P8-2** Icon-only buttons get `aria-label`s + tooltips; mode indicator conveys state via text/icon, never colour alone (§4.3, §8.2).
- [ ] **P8-3** Respect `prefers-reduced-motion` for any transition (update banner, "Copied" feedback, etc.).
- [ ] **P8-4** Touch-target sizing audit on mobile layout.
- [ ] **P8-5** Manual responsive QA pass at ~360px / large-mobile / tablet / desktop (§10.3): no horizontal overflow, editor usable with on-screen keyboard open, reference strip legible, toolbar reachable. Record results in the README QA notes.
- [ ] **P8-6** Manual light/dark QA across all components; contrast check in both palettes (§8.1).
- [ ] **P8-7** Cross-browser smoke pass: latest desktop Chrome/Firefox/Safari, one Android Chrome session, one iOS Safari session.

### Phase 9 — Deployment finalization & documentation

- [ ] **P9-1** Finalize `docker-compose.yml`/Nginx config against the §9.3/§9.4 checklist.
- [ ] **P9-2** README: description, privacy statement (§11), local dev instructions, `git pull && docker compose up --build -d` workflow, how to change `APP_PORT`, how to view logs, troubleshooting.
- [ ] **P9-3** Confirm no exposed source maps by default and no directory listing in production.
- [ ] **P9-4** Final `.gitignore`/`.dockerignore` review.

### Phase 10 — Final QA & acceptance sign-off

- [ ] **P10-1** Run the full §10.4 quality gate: strict `tsc`, lint, unit+component tests, production build, Docker image build, `docker compose up` clean start, no console errors, no external network calls in normal use.
- [ ] **P10-2** Walk through all 16 acceptance criteria in §13 individually and record pass/fail.
- [ ] **P10-3** Final end-to-end run-through of the documented deploy workflow on a clean checkout.

---

## 3. Known spec nuance (documented per §5.5's "choose a consistent, user-friendly behaviour")

PROJECT.md §5.5's worked example `s+hodit` → `сходить` has one more Cyrillic
letter (a trailing soft sign) than the literal input characters map to under
the base table in §5.2. The engine will implement the literal, deterministic
character-for-character rule described in §1.3 consistently (so `s+hodit` →
`сходит`, and `s+hodit'` → `сходить`). This is called out explicitly so it
isn't mistaken for a bug during Phase 2 testing; the other worked example
(`raj+on` → `район`) matches the algorithm exactly.
