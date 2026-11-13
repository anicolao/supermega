# Post-playtest browser validation

PR1 deliberately introduces no game e2e tests, screenshot baselines, or passing visual-validation claims. The reviewed component gallery and its existing diagnostic script predate the playable game.

The initial game consumes `@anicolao/e2e` at the pinned Git commit in package-lock.json. `scripts/prepare-review.mjs` uses the shared package's `writeViewer` export to publish `/review/`, initially with an empty story index. The viewer implementation lives in the shared library, not this application.

After the first playtest, add production-UI stories for setup, initial selection, all 36 draws and four rounds, overlapping row/column cascades, lightning wrapping and refunds, each bonus, simultaneous player choices, score explanations and ties, refresh/reconnect, duplicate-command retry, and reveal boundaries. Cover phone portrait/landscape, tablet, laptop, and tabletop seats. Capture both actor and observer views.

Use shared image identification, step inventory, candidate review, baseline storage, and suite validation. Bind candidates to the exact source, environment, and reviewed image hashes. Capture records feed the shared viewer; verification status comes from actual checks, never a default label. New screenshots are reviewed before baselines are accepted. Generation and independent verification remain separate steps.
