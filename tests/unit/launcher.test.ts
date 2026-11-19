import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readLaunch,
  readReturnTo,
  launchCommand,
  validTableCode,
} from "../../src/game/launcher.ts";
import {
  initial,
  applyEvent,
  VERSION,
  type State,
  type Command,
} from "../../src/game/engine.ts";
const code = "0A10B203";
const host = { mode: "create" as const, table: code, name: "Alex" };
const guest = { mode: "join" as const, table: code, name: "Alex" };
function apply(state: State, command: Command, actor: string) {
  return applyEvent(state, {
    version: VERSION,
    id: `event-${state.revision + 1}`,
    sequence: state.revision + 1,
    actor,
    command,
  });
}
function opened() {
  return apply(
    initial(),
    launchCommand(host, initial(), "game-host", "game-seed")!,
    "game-host",
  );
}
test("Game Room launch preferences accept eight-digit hex codes including zero and one", () => {
  assert.deepEqual(
    readLaunch(
      "?launch=join&table=0a10b203&name=%20Alex%20&uid=not-an-identity",
    ),
    guest,
  );
  assert.equal(validTableCode(code), true);
  assert.equal(readLaunch("?table=0A10B203"), null);
  for (const search of [
    "?launch=delete&table=0A10B203&name=Alex",
    "?launch=join&table=../secret&name=Alex",
    "?launch=join&table=0A10B203&name=",
    `?launch=create&table=0A10B203&name=${"x".repeat(25)}`,
  ])
    assert.throws(() => readLaunch(search));
});
test("guests wait for the creator and automatically join with game-local identity", () => {
  assert.equal(launchCommand(guest, initial(), "game-guest", "seed"), null);
  const state = opened(),
    command = launchCommand(guest, state, "game-guest", "unused")!;
  assert.deepEqual(command, { type: "join", name: "Alex" });
  const joined = apply(state, command, "game-guest");
  assert.equal(joined.owner, "game-host");
  assert.equal(joined.players.length, 2);
  assert.notEqual(joined.players[0].id, joined.players[1].id);
  assert.equal(joined.players[0].name, joined.players[1].name);
});
test("reopening host and guest invitations does not recreate tables, seats, or names", () => {
  let state = opened();
  assert.equal(
    launchCommand({ ...host, name: "Renamed" }, state, "game-host", "unused"),
    null,
  );
  state = apply(
    state,
    launchCommand(guest, state, "game-guest", "unused")!,
    "game-guest",
  );
  assert.equal(
    launchCommand({ ...guest, name: "Renamed" }, state, "game-guest", "unused"),
    null,
  );
  state = apply(state, { type: "start" }, "game-host");
  assert.equal(launchCommand(host, state, "game-host", "unused"), null);
  assert.equal(launchCommand(guest, state, "game-guest", "unused"), null);
  assert.throws(
    () => launchCommand(guest, state, "new-browser", "unused"),
    /already started/,
  );
});
test("a matching display name never claims another identity's host table or a full table", () => {
  let state = opened();
  assert.throws(
    () => launchCommand(host, state, "different-browser", "unused"),
    /already exists/,
  );
  for (let n = 1; n < 6; n++)
    state = apply(state, { type: "join", name: "Alex" }, `guest-${n}`);
  assert.throws(
    () => launchCommand(guest, state, "another-guest", "unused"),
    /full/,
  );
});
test("legacy return links remain optional and never accept executable URLs or credentials", () => {
  assert.equal(readReturnTo(""), null);
  assert.equal(readReturnTo("?returnTo=javascript:alert(1)"), null);
  assert.equal(
    readReturnTo("?returnTo=https://user:password@example.com/"),
    null,
  );
  assert.equal(
    readReturnTo(
      "?returnTo=https%3A%2F%2Fgameroom.boardgamescafe.org%2Fpr2%2F%3Froom%3D12345678",
    ),
    "https://gameroom.boardgamescafe.org/pr2/?room=12345678",
  );
});
