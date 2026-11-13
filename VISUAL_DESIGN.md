# Visual design standard

Artwork and iconography must remain clear at their actual size in the game. Judge the rendered component in a full game scene, not an enlarged source image or an isolated concept sheet. These standards complement UX_DESIGN_PRINCIPLES.md.

## Required artwork construction

Physical game components are graphics first. Use the imagegen tool to create the artwork for card and board bodies, inlaid wells, token silhouettes, deck reverses, materials, and illustrated details. Assemble these assets as layers in the shared production renderer. The finished pieces should have a rich, coherent graphical appearance, rather than the appearance of web cards or form controls.

HTML and CSS position these graphical layers and provide accessible interaction. They must not substitute for generated component art by drawing the entire piece from borders, gradients, generic panels, or code-authored SVG illustrations. Simple live indicators may use code when that keeps state precise and readable. A web font may supply a changing number or label inside a generated well; the surrounding well and object still come from artwork.

Generate empty, quiet areas for live information. Separate the body, wells, symbols, marks, and state overlays wherever they need to vary independently. Preserve transparency, record prompts and source assets, and keep project-used art in the repository. Scale, crop, and compress for delivery without flattening dynamic information into the image. Reuse the same layers and coordinates in the gallery, enlarged inspection, and production game.

## Start with the smallest intended use

Before drawing or generating an asset, record its role, smallest intended display size in CSS pixels, and the information a player must recognize. Include phone, desktop, and tabletop uses where applicable. A high-resolution source does not make small rendered details readable.

Design the smallest usable version first. Enlarge it for larger layouts; add optional decorative detail only when it does not change recognition. If a component becomes too small to carry its information, change the layout or use a deliberately simplified variant of the same shared component. Do not shrink the entire interface until everything fits.

## Physical presentation and camera framing

Readability outranks physical realism. Adjust perspective, camera distance, framing, object orientation, or layout whenever realistic presentation makes essential information small, foreshortened, obscured, or awkward to read. A physically accurate table is not sufficient if players cannot understand it.

Use available screen space deliberately. Recompose for each device and viewing orientation instead of preserving empty scenery while shrinking the playable area. Keep decision-relevant objects readable at their actual projected screen size, including far-side pieces and crowded groups. Offer contextual enlargement through the shared component where helpful; retain enough readable overview information to compare options.

## Visual hierarchy and detail budget

- Give each piece one dominant identifying silhouette or emblem. It should be recognizable before the player reads a label.
- Establish three levels: identity first; gameplay values and modifiers second; material, texture, and ornament third.
- Reserve readable space for ownership, values, action symbols, and other required gameplay information before allocating space to illustration. Fit the illustration into the remaining area; never squeeze essential marks into leftover corners or shrink them to preserve a larger picture.
- Use a few large shapes and clear regions of empty space. Remove details that merge into noise at minimum size.
- Keep ornament away from scoring marks, numerals, interaction highlights, and other information-bearing regions. Avoid nested frames, repeated tiny badges, and labels competing with the main illustration.
- Separate decoration from interactive objects. Background flowers, scenery, and ornaments must not resemble collectible tokens, placed pieces, or legal targets. Use a consistent combination of silhouette, depth, contrast, and placement to distinguish gameplay objects; color alone is insufficient. Quiet the playable area when decoration competes with decisions.
- Keep texture low contrast and subordinate to the silhouette. Mosaic patterns, grain, cracks, and highlights must not break up essential shapes.
- Make the whole piece feel physical through restrained material, edge, depth, and shadow treatment. More decoration is not a substitute for a coherent object.

## Iconography

- Use a consistent family of silhouettes, stroke weights, optical sizes, and perspective. Use the same symbol for the same meaning everywhere.
- Prefer a simple recognizable shape to a miniature detailed illustration. Distinguish symbols by silhouette and internal structure as well as color.
- Allocate enough space for the actual symbol, not just its surrounding badge. An icon inside a large container can still be too small.
- Do not encode an essential distinction in a hairline, tiny corner mark, subtle hue change, or small decorative feature.
- Use generated graphical artwork for the game’s reward symbols and physical pieces, with enough source resolution for the largest use. Inspect actual downsampled appearances. Reserve simple vector/DOM overlays for live interaction indicators, marks, focus, and ordinary supporting controls.

### Starting size targets

These are project review defaults, measured at 100% browser zoom in CSS pixels. They are not guarantees of readability; increase them when the artwork, audience, or viewing distance requires it.

| Element | Starting target at smallest supported layout |
| --- | --- |
| Primary gameplay symbol | At least 24 px on its shorter dimension; prefer 32 px for unfamiliar symbols |
| Essential secondary symbol | At least 18 px on its shorter dimension; simplify or enlarge if recognition is uncertain |
| Essential gameplay number | At least 16 px font size, with clear counters and sufficient surrounding space |
| Required supporting text | Aim for at least 14 px; reflow or move supplementary explanation out of a small piece |
| Essential vector stroke or gap | Aim for at least 2 px after scaling; inspect diagonal strokes and internal gaps |
| Interactive hit area | At least 44 × 44 px, without overlapping neighboring targets |

Do not count transparent margins as symbol size. Do not satisfy a target by enlarging a border around a tiny glyph. Tabletop pieces may need substantially larger symbols because players view them from farther away and different orientations. A large hit area does not compensate for an unreadable symbol.

## Artwork generation brief

Every image-generation or illustration brief should state:

- The physical component and exact intended display size, including its smallest use.
- The single dominant subject, silhouette, and limited palette.
- Which regions must remain quiet or empty for separately rendered symbols and values.
- Broad forms, clear negative space, restrained texture, and minimal fine detail.
- Any required background transparency and how the artwork will be cropped or masked.

Generate artwork separately from dynamic text, numbers, scoring symbols, selection rings, and state badges. Compose those layers in the shared production component. Avoid requesting a complete miniature UI as one generated image. Keep editable source layers where possible.

Example brief: “Building illustration for a game tile displayed at 64 × 64 CSS pixels. One bold temple silhouette, large readable columns, a few broad stone shapes, restrained mineral colors, and a quiet background. Reserve the lower quarter for a separately rendered scoring symbol. Minimal ornament; no tiny mosaic tesserae, lettering, numbers, borders, or baked-in UI.”

## Readability and interaction states

- Keep required symbols and values clearly separated from artwork using a quiet backing or controlled contrast.
- Use selection, legal-target, pending, or error treatments only when a real game interaction needs them, and distinguish them without color alone. Do not invent these states for every piece. Ordinary Lucky Box wells need open/marked rendering and visible keyboard focus; invalid-action feedback belongs beside the card. Treatments must not obscure identity or score.
- Give keyboard focus an unmistakable treatment on the rendered object, including 3D or canvas components. Accessible DOM controls must visibly identify their corresponding object when focused. Subtle hover lighting alone is insufficient; use a clear outline, marker, or similarly distinct treatment that remains legible against materials and can be distinguished from selection and legal-target states.
- Avoid stacking multiple decorative and interaction outlines. Define a deliberate priority when states overlap. In enlarged views, avoid redundant outer frames around already framed pieces; reserve the added space for readable content and usable controls.
- Keep enough information readable in the overview to identify pieces and compare available options. Never require hover or inspection to recover essential overview information. An enlarged action surface may reveal additional detail needed to complete the chosen action. See [Enlarge the same component in context](UX_DESIGN_PRINCIPLES.md#design-and-implementation-checklist) in the UX principles; both overview and enlarged views need their own readability checks.
- Permit tap/click inspection as an enhancement, not a repair for illegible normal rendering.

## Required review before approval

1. Render the actual shared component at its smallest supported size, at 100% browser zoom. Review a normal screenshot without enlarging it.
2. Place it in a representative crowded game scene next to other pieces, labels, and state highlights. Review both light and dark surroundings where supported.
3. Check that the identity, required value, and current interaction state can be recognized separately. Compare similar symbols side by side and check a grayscale rendering for color-only distinctions.
4. Check the smallest phone layout and intended tabletop viewing distance on real hardware when available. Record hardware checks still outstanding.
5. Inspect source art after downsampling. If fine details disappear, merge, shimmer, or resemble extra symbols, simplify the art rather than sharpening the noise.
6. Capture evidence at actual display size, including a crowded scene and selected/unavailable states. Enlarged gallery art alone is insufficient.
7. Evaluate usability separately from screenshot consistency. Pixel matching and route parity prove that renderings agree; they do not prove that players can recognize symbols, read values, distinguish decoration from game objects, or select targets. Check rendered symbol sizes and non-overlapping hit areas, and perform a human recognition and interaction review at normal scale. Record any human or hardware checks still outstanding rather than treating passing screenshot tests as approval.

Reject an asset or layout when it looks attractive enlarged but requires zooming, reading a tiny label, or opening a dialog to understand an ordinary game decision. Simplify the artwork, increase the information-bearing area, or change the layout before approval.
