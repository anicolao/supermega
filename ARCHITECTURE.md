# PR1 architecture

## Deterministic game authority

`src/game/engine.ts` defines versioned commands and immutable event envelopes. `applyEvent` validates actor ownership, phase, choices, matching numbers, resource costs, bonus targets, Ready, and reveal barriers. `replay` reconstructs a table from its complete ordered history and rejects missing/duplicate events and unsupported versions.

Deals use a deterministic seeded shuffle. Each dealt card has an instance ID separate from its printed template number, preserving identity when discarded templates recycle. The renderer receives the real instance ID, marks, and bonus states. Game logic does not live in the graphical components.

Each player's undo stack contains that player's prior state for the current draw/draft. Undo itself is a new event. It restores the entire player choice while preserving other players' simultaneous actions. Draft undo also withdraws that player's rejected offers from the discard pile. Reveals, scoring, and new offers clear the stacks.

## Firestore event stream

Rooms use `previews/{scope}/rooms/{code}`. A head document stores the owner, controller list, phase, revision, and append-only ordered event IDs. Children hold immutable `events/{id}` and `commands/{id}` acknowledgement receipts; each event also records its sequence. UUID document IDs avoid collisions between simultaneous choices.

A choice is assigned a UUID and persisted locally before transmission. One Firestore transaction reads the receipt, head, and missing history, replays the fresh prefix, validates the command, then writes the next event, head, and receipt atomically. Retrying a committed UUID checks the original actor and canonical command rather than appending it again. If append-only rules reject a stale competing transaction, a bounded retry requires a fresh server read proving the head advanced; the same epoch and seat checks run again.

A pending choice includes its phase/round/draw epoch and its player's previous state. Independent player choices can rebase over one another while those inputs remain unchanged. A changed epoch or same-seat choice from another window rejects the stale choice. The subscription uses acknowledged server snapshots; locally pending/cached snapshots do not become game authority. Reconnect replays the stream, and a visible retry action handles retained uncertain submissions.

Firebase Auth persists anonymous browser identities. A personal table assigns one seat per identity. A tabletop creator can control several local seats. Seat IDs contain their controller UID; security rules bind player commands to that UID, reserve reveals/start/scoring for the creator, require matching event/head/receipt writes, and disallow changing existing events.

As in the sibling client-driven Firebase games, the deterministic reducer validates game legality in clients and transactions; Firestore rules enforce write shape, identity, and append-only structure rather than reimplementing the full rules engine. This is a casual-play trust model, not a server-side anti-cheat service. The shared event log and seed are readable to authenticated clients holding the room code, so future deals are not cryptographically secret. The UI conceals other players' offers and unrevealed numbers.

## Presentation and audio

The production game consumes the approved `luckyCard`, `numberCard`, `token`, `scorecard`, and `CardInspector` implementations. State overlays remain separate from generated bodies/wells. Pending bonuses shimmer; reduced motion retains their static dashed ring. Wells are open or marked. Numeric/wild bonuses select a source, then a destination using the same cards; they do not create a confirmation gate.

Personal screens have readable cards, contextual enlargement, and player tabs or a Player areas menu. Card capacity is measured against available viewport space; extra cards use explicit pages. Help, scorecards, and history are paged dialogs, so setup and play do not require scrolling. Tabletop mode exposes all player areas, local-seat ownership, and view rotation on large displays; narrow layouts reflow. Scores and event history remain reviewable. A direct well tap computes the cheapest signed lightning adjustment on the circular 1–9 track, then submits the existing validated mark command. Once all seats keep cards or choose Ready, the creator’s active browser schedules reveal/scoring after a visible three-second countdown. A local, persisted pause preference and open review surfaces suspend that creator’s timer; undoing Ready removes eligibility. Automatic transitions remain ordinary host-owned events. A large illustrated countdown pulses once per tick. Fresh reveal events animate the shared number-card assembly lifting and flipping from the deck; replays/reloads do not animate past draws, and reduced motion skips the flight and bounce. Ready and Undo share a dock at the foot of each tray, with high-contrast backing behind mat text. Sound is synthesized from brief low-gain sine plucks, unlocked by a user gesture and controlled by a persisted mute preference. Only acknowledged local choices play their cue.

## Review workflow

The shared e2e library owns the reusable screenshot/DOM viewer. Supermega's build supplies its title and an empty index. PR1 adds engine unit checks and ordinary browser smoke review, while game e2e stories, capture environments, baselines, and independent screenshot verification follow the user's first playtest. No empty suite is reported as passing.
