# UX design principles

Design the experience around handling game pieces. Players should feel they are arranging tiles, choosing cards, moving tokens, and interacting with boards.

## Graphics-first game components

Cards, boards, mats, trays, tokens, decks, and other physical game pieces must be built primarily from artwork generated with the imagegen tool, assembled as reusable graphical layers. Their material, silhouette, painted illustration, edges, recesses, highlights, and surface detail should come from the art. Do not construct their visible appearance primarily from HTML panels, CSS borders/gradients, or hand-coded SVG shapes. A rounded web panel with icons is not a finished game piece.

Use markup for semantic controls, accessible hit areas, layout, and composition. Live text and numerals may be rendered with web fonts into illustrated wells or nameplates. Keep changing information, ownership, marks, legal-target indicators, focus, and other state overlays separate from the generated art. These layers must stay aligned at every supported size and share the same implementation in the gallery, inspector, and game.

This requirement concerns the physical game objects, not the ordinary navigation and review controls around them. Review the assembled objects in a crowded game scene at actual sizes; isolated generated source art alone is not sufficient for approval.

## Design and implementation checklist

- **Build the components that will ship.** Use one shared implementation for the game, component gallery, and interaction review. Approved artwork, styling, and interaction behavior must carry into production without reimplementation. Do not create duplicate demo components or substitute renderers.

- **Give complete objects a graphical treatment.** Compose imagegen-created artwork, material, edges, symbols, highlights, and shadows into coherent pieces. Extend that care to boards, mats, decks, and trays. Rounded panels with illustrations inside are insufficient.

- **Make pieces the primary controls.** Select a card by touching the card; choose a reward by touching the reward. Show available destinations on the board. Preview placement, rotation, stacking, and movement in context. Support click/tap interaction; dragging can complement it.

- **Prefer direct actions with undo.** Apply ordinary reversible actions immediately and provide a visible, persistent Undo near the affected piece. Undo must restore the whole action, including its dependent rewards and resource changes. Do not add a confirmation step to routine marking, selection, or placement. Reserve confirmation for consequential irreversible actions, such as revealing hidden information or ending a game. Preview is useful when it helps a spatial decision, but should not become a mandatory extra click.

- **Keep supporting controls contextual.** Put undo, rotate, and any genuinely necessary confirm/cancel controls near the selected piece or destination. Reserve dialogs for tasks that require a separate decision space. Avoid making ordinary turns depend on a detached action toolbar.

- **Enlarge the same component in context.** When a location, card, or piece needs more room for precise interaction, expand it into a readable action surface while preserving its identity, current state, selection, and connection to its original position. Use the same shared renderer and interaction contracts at both sizes. Provide an obvious return that restores the player's place and keyboard focus. Motion should explain the spatial connection and respect reduced motion. The overview must still support comparing options before expansion; enlargement provides additional detail and room to act. Avoid wrapping an already framed component in another decorative frame that consumes the space enlargement was meant to provide. Keep supporting controls clear and subordinate to the object.

- **Support comparison as well as browsing.** Fans, stacks, and coverflows can communicate physicality, but must not force players to repeatedly uncover options to compare them. Provide a readable side-by-side or flat comparison view when the decision requires it. Preserve selection and state when switching views, and reuse the same shared components.

- **Make essential interactions discoverable.** Inspection and other important secondary actions need a visible alternative or clear guidance. Long press, right-click, and keyboard shortcuts may accelerate access, but must not be the only discoverable path. Ensure the visible alternative works with touch and keyboard.

- **Preserve object identity through transitions.** Track the specific piece or card instance as it moves, expands, rotates, changes state, or returns. Motion should explain its source and destination using the same graphical assembly; do not substitute a generic icon or confuse identical-looking copies. Preserve this continuity when reduced motion makes transitions immediate, and keep private information concealed throughout.

- **Model only meaningful game states.** Add a visual state only when an actual game rule or player decision calls for it; do not treat a generic interaction-state checklist as a requirement to invent states. Lucky Box number wells are open or marked. Bonus slots, separately, distinguish an earned-but-pending reward from an applied reward; these are meaningful game states, not extra well states. Keyboard focus and hover are input affordances, not extra game states. Report invalid actions in context without permanently restyling the well. Use feedback and motion to explain real changes while preserving readable symbols and labels.

- **Keep feedback near its cause and outcomes explainable.** Show awards, costs, and state changes beside the relevant pieces or destinations, then update cumulative totals. Let players review the contributing cards, combinations, or actions behind a calculated result. A total and an animation alone are not an explanation. Preserve access to that explanation after transient feedback disappears.

- **Let players control the pace.** Automatic progression should provide clear pause, manual, and review options so movement, counting, and scoring do not outrun understanding. Keep these controls discoverable during play. Present a visible countdown when an action will happen automatically, allow immediate activation when appropriate, and preserve the current decision or review position when pausing. Reduced motion and slower decision pacing are separate preferences.

- **Keep review tools thin and honest.** They supply fixtures and playback controls to shared production components. Direct interaction must preserve the specific piece and destination selected. Canned animation studies must be clearly separate from interactive review. Reusable inspectors and interaction helpers belong in the shared presentation layer.

- **Separate presentation from game authority.** Shared components emit typed choices and render supplied state. Before a rules engine exists, use a deterministic fixture adapter through the intended production interface. Simulated outcomes must not require a second UI implementation. Components must support authoritative availability and rejection without embedding game legality.

- **Keep play within the viewport.** Gameplay, setup, and supporting review surfaces must not require document scrolling. Recompose the table for the available width and height. Use explicit card pages and separate paged help, score, or history views when everything cannot fit at a readable size. Keep the deck and active draw prominent. Never satisfy this by clipping controls or shrinking touch targets below their usable size.

- **Preserve usability across inputs and screens.** Provide keyboard access, visible focus, adequate touch targets, reduced motion, and readable scaling. Semantic HTML buttons are welcome when they visually and behaviorally represent the game objects.

## Definition of done

Before calling a component or interaction done:

- Demonstrate a complete interaction using the shared components, including undo and rejection for reversible actions, and cancellation where a preview or separate decision is appropriate.
- Confirm that the specific selected object and destination survive the full interaction.
- Inspect the result at actual phone and desktop sizes, and in tabletop mode where supported.
- Verify that gallery and review routes use the same component implementations and interaction primitives intended for production.
- Show that production can supply authoritative state without replacing the reviewed UI.
- Clearly document simulated outcomes and remaining integration work.
