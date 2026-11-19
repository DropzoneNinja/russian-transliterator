# Russian Transliterator

A lightweight, self-hosted Russian transliteration tool. Type with an
ordinary Latin keyboard and see it converted live into Cyrillic, in the
style of [translit.ru](https://translit.ru/). See [PROJECT.md](./PROJECT.md)
for the full specification and [TASKS.md](./TASKS.md) for the build plan.

> Status: in progress. This README is filled in incrementally as each phase
> in TASKS.md completes.

## Privacy

All text processing happens locally in your browser. Your text is saved
only to this browser's `localStorage` and is never sent to the server or
any third party. Text only leaves the browser if you explicitly use the
Copy or Download actions.

## Development

```bash
npm install
npm run dev        # start the dev server
npm run lint        # lint
npm run typecheck   # strict TypeScript check
npm test            # run the test suite
npm run build        # production build
```

## Deployment

<!-- Filled in during Phase 9 (deployment finalization). -->

## Troubleshooting

<!-- Filled in during Phase 9. -->
