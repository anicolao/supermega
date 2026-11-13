# Art direction 02 — Painted, carved & full of luck

Physical game pieces use imagegen artwork as their visible foundation. Painted enamel card bodies, antique-gold inlay, ivory number recesses, lacquered wooden tokens, and a felt/leather mat replace the original markup-drawn appearance. Cream paper and large dark typography keep information legible inside that graphical treatment.

The built-in imagegen tool produced all 16 artwork assets. No API/CLI fallback was used. Fontsource’s locally bundled Lilita One and DM Sans supply live lettering and numerals; generated images contain no changing game data. This is original artwork, not the publisher’s illustrations.

## Assets and prompts

- `art/source/`: original generated PNGs, including transparency where present.
- `public/assets/generated/`: compressed WebP layers actually used by the gallery and player scene.
- `art/generation-manifest.json`: complete exact prompt for every asset, tool provenance, original output path, and references for the edited colorways/reverse.
- `art/assets.json`: source dimensions, alpha metadata, runtime paths.
- `scripts/prepare-art.mjs`: repeatable size/format optimization from the retained PNGs. No drawing, synthesis, retouching, or creative image edits are performed by this script.

| Asset IDs | Graphical role | Smallest intended use |
| --- | --- | --- |
| card, lilac, sage, honey, sky, rose | Six matching illustrated card bodies; quiet inner face and empty nameplate | Approximately 264 px wide on the smallest phone scene |
| well | Generated ivory recess and gold rim, repeated beneath live numerals | At least 44 px high in interactive grids |
| bolt, moon | Carved, lacquered token cutouts, also used as graphical rewards | 80–118 px standalone, about 32 px redundant count ornament |
| star | Printed reward and scoring artwork, not an additional physical token | 22 px secondary score-row icon; larger on cards |
| number | Illustrated portrait number card with quiet blank medallion | 65 px wide in compact draw; larger in collection |
| back, numberback | Separately composed square and portrait reverse artwork, empty central cartouche | Same dimensions as corresponding front |
| score | Illustrated portrait scorecard stock with quiet interior | About 250 px wide on the smallest phone |
| marker | Painted ivory/forest-green marker cutout | About 240 px wide |
| mat | Illustrated sage felt and leather game surface | Phone player area through 4K tabletop |

Every generation brief specified intended use, smallest size, material, silhouette, palette, quiet information regions, transparency, and excluded text/numbers. Five colorway edits referenced the coral body and preserved its geometry and ivory/gold regions. The number-card reverse referenced the square reverse and was recomposed for portrait rather than stretched.

## Layer assembly

1. The generated body establishes the object’s material, edges, lighting, and ornament.
2. Generated wells sit inside the body’s quiet central face, using shared coordinates at every size.
3. Live numerals are written into those wells. Reward artwork is placed at each row/column end.
4. Crosses, pending/applied reward indicators, keyboard focus, and contextual Undo remain separate live overlays. Wells have only open and marked states.

The shared functions in `src/components/pieces.ts` compose these layers. `symbols.ts` uses generated images for bolt, moon, and star; double lightning composes two bolt layers. Wild rewards and bonus numbers are live printed characters. Code-authored SVG is restricted to ink marks and supporting navigation/reference controls.

The production-layer inspector and tabletop use the same renderers. The generated mat is assembled with nine-slice borders to keep its illustrated edges from stretching into huge bands in a tall phone scene. Shadows and state treatments support the artwork; they do not construct the component’s material.

## Component coverage

All physical families from the [Gamewright rules](https://gamewright.com/images/original/SMLB-Rules-English-1625075889.pdf) are represented: Lucky Box cards, number cards, lightning, moons, scorecards, and markers. All bonus families are present. The gallery includes fronts/reverses and six illustrative Lucky Box layouts, not the final 60-card deck transcription. The central mat is a digital staging surface; the physical game has no separate shared board.

## Review evidence and limits

`npm test` checks real Chromium rendering at small-phone, phone, tablet portrait/landscape, laptop, and 4K tabletop sizes. It verifies that generated images load, layouts do not overflow, and interactive cells/inspection actions remain at least 44×44 px. It exercises immediate marking, multi-step undo, invalid-action feedback, keyboard marking, inspection state/identity, focus restoration, reset, filters, reverses, player variants, and token selection.

`docs/review/` contains screenshots of assembled components at actual CSS sizes, crowded scenes, contextual invalid-action feedback, dark and grayscale tables, contextual inspection, tokens, scorecards, and tabletop composition. `checks.json` records dimensions and hit areas. A layer breakdown in the gallery exposes the actual generated bodies, wells, live numerals, and token artwork.

Manually inspected the assembled phone and laptop scenes, scorecard, token collection, and tabletop composition. Required values remain separate from material and ornament. Routine marks apply immediately with visible Undo on the affected card and in the persistent feedback area. Invalid actions receive a contextual message without changing the well’s appearance. Artificial preview, unavailable, and rejected specimens have been removed. Reduced-motion styling removes transitions; the fixture advances only through user actions.

Art approval and real-device recognition/viewing-distance checks remain outstanding. Passing browser checks is not art approval. Exact deck data, rules/bonus-chain authority, multiplayer, persistence, and a production shared-table controller remain future work.

## Interaction and registration refinement

The UX standard explicitly prefers immediate reversible actions with persistent Undo. The fixture authority retains each accepted action’s previous card state; rejected choices do not add undo entries. Undo from the inspector and table updates the same instance, its marks, and pending/applied bonus state. No confirmation gate is present for marking.

Both deck reverses have dedicated labeled specimens visible by default and are also present in draw/deck context. The four-seat tabletop center contains the current draw and labeled decks, with no decorative loose reward pieces. Stars remain card/scorecard rewards; moons belong in player collections or the token study.

Live headings are centered against measured nameplate regions: the Lucky Box heading uses the center of the body’s top cartouche, the scorecard title uses its own portrait nameplate coordinates, and reverse lettering is upright within each central cartouche. These registration rules apply to the shared renderer at gallery, inspection, and tabletop sizes.

Scorecard star positions show their cumulative point values (1, 4, 9) below the generated stars, including unclaimed positions. The total uses separate padded columns for its label and value. Scorecard stock is assembled with nine-sliced generated borders so taller readable rows preserve the illustrated nameplate and corners. On phones, the decorative marker sits below the card, clear of values.

Row and column bonus slots use one shared square graphical assembly, sized from the card width rather than their rectangular grid cells. Applied circles therefore remain circular and identical in diameter in both directions. Completing a line makes its bonus pending; pending rewards use a dashed gold ring and a gentle sheen, while applied rewards retain a solid ink ring. Reduced motion removes the moving sheen and preserves the static pending ring. Wells remain open/marked.

The review adapter accepts a direct tap on a pending reward as an apply-bonus choice, records that exact card/bonus, and supports Undo back to pending. Applying a bonus in this gallery demonstrates presentation state only; it does not grant its gameplay effect. Marks and applied-bonus records are snapshotted together for consistent multi-step undo.
