# Game Room integration

Game Room's existing generic catalog adapter can already paint an external `Icon` onto its 3D box and launch an `integrated` game. No Game Room source change, identity sharing, or room-protocol change is required.

The game accepts:

```text
https://supermega-anicolao.web.app/?launch=create&table=0A10B203&name=Alex
https://supermega-anicolao.web.app/?launch=join&table=0A10B203&name=Robin
```

Eight-character alphanumeric codes include Game Room's hexadecimal `0` and `1`. The host creates a normal six-seat friends lobby and chooses Start once friends arrive. Guests arriving first subscribe and wait; they never create the game. Names are preferences, while Firebase UIDs remain local to this game. Reopening either URL is idempotent; existing seats keep their recorded names. A new identity cannot take over another host's table. Successful invitations become ordinary `/table/CODE` URLs, so refresh does not repeat a launch. Legacy `returnTo` links remain optional, HTTP(S)-only, and available under More.

`/gameroom-launch.json` advertises protocol `gameroom-url`, version 1, game `supermega`. The game's independent event protocol remains version 2.

## Shelf artwork

`public/assets/gameroom/cover.webp` is a 768×1024 composition of the approved imagegen number-card reverse and the shared card-back typography. The PNG master is beside it; `art/gameroom-cover.json` records provenance. Run `npm run art:cover` to reproduce it. Public CORS headers allow Game Room's Three.js renderer to load the cover across origins.

## Activate after merge

From a clean checkout of the reviewed `origin/main`, using the existing Firebase CLI account:

```sh
npm ci
npm run release:gameroom
```

The release command refuses an unmerged or dirty checkout. It builds the canonical main scope, deploys only Super Mega's Firebase Hosting site, verifies the deployed source SHA, then registers the single shelf entry. Firebase accounts must already have access to the `supermega-anicolao` hosting site and the `launcherui` catalog. No credentials are bundled in the game.

The registration is dry-run by default:

```sh
npm run catalog:gameroom
```

It finds an existing Super Mega document by ID, title, or canonical WebURL before planning one write. Existing document IDs, `URL`, `Hidden`, and unrelated fields remain untouched. New entries are Game Room-only (`Hidden: true` applies to tabletop, not Game Room). An update-time or nonexistence precondition prevents overwriting concurrent edits. Applying requires the deployed launch manifest and a working public-CORS cover, and writes a private backup of only the target record. No bulk seeding or catalog migration occurs.

The proposed record is `Applications/supermega`, with title Super Mega Lucky Box, `GameroomEnabled: integrated`, canonical WebURL `https://supermega-anicolao.web.app/`, and the cover URL above. The production catalog remains unchanged until the reviewed release command is run.

## Isolated integration checks

```sh
npm test
GAMEROOM_PATH=../gameroom npm run test:gameroom
```

The browser story uses the real Game Room checkout, real independent Chromium profiles with native popup blocking, and real Firebase Auth/Firestore emulators. Game Room is pinned in CI. Bun 1.3.10, Node 24, Java 21, OpenSSL, and Playwright Chromium are required. Install Game Room's dependencies with its frozen Bun lockfile. Game Room and Super Mega keep separate demo Firebase projects and identities.

Dedicated emulator ports are Auth 9797, Firestore 8797, hub 4497, logging 4597, and Firestore WebSocket 8897. The temporary local HTTPS game uses 6127 and Game Room uses 6129. Tests never use production catalog data or clear development data. They close only servers they start.

Checks include the rendered shelf cover, direct create/join, guest-before-host, codes containing 0/1, identical names, independent seats, idempotent reopen, severed popup openers, continued room chat, no automatic duplicate tabs after reload, and recurring launches. `@anicolao/e2e` tracks required steps and identifies review PNGs; `.firebase/gameroom-review` contains the evidence. These are functional launch checks and review captures, not approved screenshot baselines.
