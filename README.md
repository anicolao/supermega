# Super Mega Lucky Box

Responsive component gallery and interaction review for a future digital implementation of Phil Walker-Harding’s game, published by Gamewright.

## Run locally

```sh
npm install
npm run dev
```

- Gallery: http://localhost:5197/
- Interaction study: http://localhost:5197/#review
- Tabletop composition: http://localhost:5197/tabletop/#tabletop

The development server listens on all interfaces so another device on the same network can open `http://<this-computer-address>:5197/`. The terminal prints available addresses.

```sh
npm run check
npm run build
npm test
```

`npm test` requires the dev server to be running and a Playwright Chromium installation. If Chromium is missing, run `npx playwright install chromium`. Tests use port 5197 by default; `REVIEW_URL` overrides it. Screenshots and measured results are in `docs/review/`.

## Graphics-first artwork

The components use 16 assets generated with the built-in imagegen tool: six card bodies, a number well, three reward/token artworks, number face and reverse, Lucky Box reverse, scorecard, marker, and mat. Original transparent PNGs are saved in `art/source/`; compressed runtime WebP assets are in `public/assets/generated/`. Exact prompts, reference relationships, and provenance are in `art/generation-manifest.json`.

`node scripts/prepare-art.mjs` rebuilds the runtime assets from the retained source art. It performs only resizing and format conversion; the material and object artwork comes from imagegen. Digits, score text, names, crosses, and interaction state remain separate live layers. The gallery includes a layer breakdown beside the assembled components.

## What is implemented

- Lucky Box card renderer: 3×3 grid, six row/column rewards, card ID, persistent crosses, pending/applied bonuses with uniform circular marks, visible enlargement action, and shared reverse.
- Six card palette/layout specimens; number faces 1–9 and their shared reverse.
- Shaped lightning and moon tokens; selectable token studies.
- All reward families: number, wild number, single/double lightning, moon, and star. Stars and other bonuses are printed symbols, not invented physical tokens.
- Scorecard fronts for six players, scoring-reference reverse, dry erase marker.
- Shared player scene with a number draw, resource counts, three Lucky Box cards, and light/dark table treatments.
- Open/marked wells with immediate marking, persistent multi-step undo, and contextual invalid-action feedback, keyboard activation, inspection with exact card/cell state, and focus return.
- Four-seat tabletop composition with larger pieces on large displays and oriented player areas. Narrow displays recompose the seats into readable rows.

## Shared presentation

`src/components/pieces.ts` contains the actual piece renderers; `symbols.ts` composes the generated reward artwork. `src/generated-art.css` aligns artwork layers, live information, and interaction overlays. Gallery, player scene, state specimens, inspector, and tabletop use those functions directly. `CardInspector` in `src/components/inspector.ts` is the reusable presentation-layer enlargement/focus helper.

`src/components/types.ts` defines supplied card/view state, typed mark/apply-bonus choices, and the `MarkAuthority` interface. The gallery harness in `src/main.ts` supplies the fixture adapter and updates shared renderers. The components do not decide which numbers can be marked. `src/fixtures/authority.ts` deliberately accepts any open square and reports attempts to mark an already marked square. It must be replaced by game authority when gameplay is built.

The gallery filters the existing instances, rather than replacing their state. An inspection and the player scene observe the same card and marks. A tap commits a mark immediately. Undo restores the previous card state, including pending/applied bonuses; rejection leaves marks and undo history unchanged. State is intentionally reset on page reload.

## Scope and review

This is an art-direction gallery, not a playable game. The six Lucky Box layouts are explicitly illustrative, not a transcription of the published 60-card deck. There is no game engine, actual bonus effect/chain resolution, multiplayer, deck randomization, persistence, or automated play. In the review fixture, tapping a pending bonus records it as applied without granting tokens, stars, or extra marks. The tabletop composition is a fixture, not a functioning shared-room controller.

See [ART_DIRECTION.md](ART_DIRECTION.md) for artwork sizes, component inventory, and review limits. Existing [UX_DESIGN_PRINCIPLES.md](UX_DESIGN_PRINCIPLES.md) and [VISUAL_DESIGN.md](VISUAL_DESIGN.md) govern this implementation.
