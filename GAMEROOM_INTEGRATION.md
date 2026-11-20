# Game Room integration

Game Room's existing generic catalog adapter can already paint an external `Icon` onto its 3D box and launch an `integrated` game. No Game Room source change, identity sharing, or room-protocol change is required.

The game accepts:

```text
https://anicolao.github.io/supermega/?launch=create&table=0A10B203&name=Alex
https://anicolao.github.io/supermega/?launch=join&table=0A10B203&name=Robin
```

Eight-character alphanumeric codes include Game Room's hexadecimal `0` and `1`. The host creates a normal six-seat friends lobby and chooses Start once friends arrive. Guests arriving first subscribe and wait; they never create the game. Names are preferences, while Firebase UIDs remain local to this game. Reopening either URL is idempotent; existing seats keep their recorded names. A new identity cannot take over another host's table. Successful invitations become ordinary `?table=CODE` URLs in the same deployment directory, so refresh does not repeat a launch. Legacy `returnTo` links remain optional, HTTP(S)-only, and available under More.

`/gameroom-launch.json` advertises protocol `gameroom-url`, version 1, game `supermega`. The game's independent event protocol remains version 2.

## Shelf artwork

`public/assets/gameroom/cover.webp` is a 768×1024 composition of the approved imagegen number-card reverse and the shared card-back typography. The PNG master is beside it; `art/gameroom-cover.json` records provenance. Run `npm run art:cover` to reproduce it. Public CORS headers allow Game Room's Three.js renderer to load the cover across origins.

## Activate after merge

GitHub Actions publishes main to `https://anicolao.github.io/supermega/` and PR N to `/supermega/prN/`, after source, unit and rules checks pass. Publishing uses GitHub's repository token, with no Firebase admin credential. It retains other preview directories and only publishes same-repository PRs.

After merge, verify the canonical Pages build is live, then use the existing Firebase CLI account to switch the single catalog record:

```sh
npm ci
npm run catalog:gameroom -- --apply
```

Applying checks the launch manifest, main-scope build metadata, full source SHA, and public-CORS cover. No hosting deployment occurs in this command. The old Firebase-hosted game stays available for existing sessions; browser identities do not transfer between origins. No game history is migrated or deleted.

The registration is dry-run by default:

```sh
npm run catalog:gameroom
```

It finds an existing Super Mega document by ID, title, or canonical WebURL before planning one write. Existing document IDs, `URL`, `Hidden`, and unrelated fields remain untouched. New entries are Game Room-only (`Hidden: true` applies to tabletop, not Game Room). An update-time or nonexistence precondition prevents overwriting concurrent edits. Applying requires the deployed launch manifest and a working public-CORS cover, and writes a private backup of only the target record. No bulk seeding or catalog migration occurs.

The proposed record is `Applications/supermega`, with title Super Mega Lucky Box, `GameroomEnabled: integrated`, canonical WebURL `https://anicolao.github.io/supermega/`, and the cover URL above. For PR #2 review, this single entry is active with WebURL and Icon pointing to `https://supermega-anicolao--pr2-ihl3wxr4.web.app/` (preview expiry: December 19, 2026). After merge and a successful Pages deployment, `npm run catalog:gameroom -- --apply` updates the same document to the canonical Pages URLs above. No other catalog entries were changed.

## Isolated integration checks

```sh
npm test
GAMEROOM_PATH=../gameroom npm run test:gameroom
```

The browser story uses the real Game Room checkout, real independent Chromium profiles with native popup blocking, and real Firebase Auth/Firestore emulators. Game Room is pinned in CI. Use `nix develop` for Node 24, Java 21, Bun, and OpenSSL; install Playwright Chromium with `npx playwright install chromium`. CI separately pins its runner tooling. Install Game Room's dependencies with its frozen Bun lockfile. Game Room and Super Mega keep separate demo Firebase projects and identities.

Dedicated emulator ports are Auth 9797, Firestore 8797, hub 4497, logging 4597, and Firestore WebSocket 8897. The temporary local HTTPS game at `/supermega/prtest/` uses 6127 and Game Room uses 6129. Tests never use production catalog data or clear development data. They close only servers they start.

Checks include the rendered shelf cover, direct create/join, guest-before-host, codes containing 0/1, identical names, independent seats, idempotent reopen, severed popup openers, continued room chat, no automatic duplicate tabs after reload, and recurring launches. `@anicolao/e2e` tracks required steps and identifies review PNGs; `.firebase/gameroom-review` contains the evidence. These are functional launch checks and review captures, not approved screenshot baselines.
