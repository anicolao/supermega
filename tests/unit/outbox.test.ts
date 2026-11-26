import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ChoiceOutbox,
  type Pending,
  type Publication,
} from "../../src/game/outbox.ts";
import {
  initial,
  applyEvent,
  currentNumber,
  targets,
  type State,
  type Command,
  type GameEvent,
} from "../../src/game/engine.ts";
const uid = "local-player";
function setup() {
  const history: GameEvent[] = [];
  let state = initial();
  const add = (command: Command) => {
    const event = {
      version: 2,
      id: "setup-" + history.length,
      actor: uid,
      sequence: history.length + 1,
      command,
    };
    state = applyEvent(state, event);
    history.push(event);
  };
  add({
    type: "create",
    mode: "web",
    capacity: 1,
    name: "Alex",
    seed: "immediate-choice",
  });
  add({ type: "start" });
  add({
    type: "choose",
    playerId: state.players[0].id,
    cards: state.players[0].offers.slice(0, 3).map((c) => c.id),
  });
  add({ type: "reveal" });
  const target = targets(state.players[0], currentNumber(state))[0];
  assert.ok(target);
  return {
    history,
    state,
    mark: {
      type: "mark",
      playerId: state.players[0].id,
      cardId: target.cardId,
      cell: target.cell,
      delta: 0,
    } as Command,
  };
}
function harness() {
  const fixture = setup();
  let stored: string | null = null;
  let canonical = fixture.history;
  const waits: {
    item: Pending;
    resolve: (events: GameEvent[]) => void;
    reject: (error: unknown) => void;
  }[] = [];
  const displays: { state: State; meta: Publication }[] = [];
  const storage = {
    read: () => stored,
    write: (s: string | null) => {
      stored = s;
    },
  };
  const commit = (item: Pending) =>
    new Promise<GameEvent[]>((resolve, reject) =>
      waits.push({ item, resolve, reject }),
    );
  const publish = (_events: GameEvent[], state: State, meta: Publication) =>
    displays.push({ state, meta });
  const outbox = new ChoiceOutbox(uid, storage, commit, publish);
  outbox.accept(canonical);
  const acknowledge = () => {
    const w = waits.shift()!;
    canonical = [
      ...canonical,
      {
        version: 2,
        id: w.item.id,
        actor: uid,
        sequence: canonical.length + 1,
        command: w.item.command,
      },
    ];
    w.resolve(canonical);
  };
  return {
    fixture,
    outbox,
    storage,
    waits,
    displays,
    commit,
    publish,
    acknowledge,
    get stored() {
      return stored;
    },
  };
}
const tick = () => new Promise((r) => setImmediate(r));
test("marks and dependent Undo display immediately, persist before sending, and commit once in tap order", async () => {
  const h = harness();
  const mark = h.outbox.append(h.fixture.mark, "tap-mark");
  assert.equal(h.waits.length, 1);
  assert.equal(h.displays.at(-1)!.meta.localChoice?.type, "mark");
  assert.equal(h.displays.at(-1)!.state.players[0].usedDraw, true);
  const undo = h.outbox.append(
    { type: "undo", playerId: h.fixture.state.players[0].id },
    "tap-undo",
  );
  assert.equal(h.displays.at(-1)!.state.players[0].usedDraw, false);
  assert.deepEqual(
    JSON.parse(h.stored!).map((p: Pending) => p.id),
    ["tap-mark", "tap-undo"],
  );
  assert.equal(h.waits.length, 1, "one authoritative writer at a time");
  h.acknowledge();
  await tick();
  assert.equal(h.waits[0].item.id, "tap-undo");
  assert.equal(
    h.displays.at(-1)!.state.players[0].usedDraw,
    false,
    "acknowledging the mark must not flash it back",
  );
  h.acknowledge();
  await Promise.all([mark, undo]);
  assert.equal(h.outbox.hasPending(), false);
  assert.equal(h.stored, null);
});
test("a definitive rejection rolls back the prediction and rejects dependent choices", async () => {
  const h = harness();
  const mark = h.outbox.append(h.fixture.mark);
  const undo = h.outbox.append({
    type: "undo",
    playerId: h.fixture.state.players[0].id,
  });
  const rejected = Promise.allSettled([mark, undo]);
  h.waits[0].reject(
    Object.assign(Error("Denied"), { code: "permission-denied" }),
  );
  await rejected;
  assert.equal(h.displays.at(-1)!.meta.rollback, true);
  assert.equal(h.displays.at(-1)!.state.players[0].usedDraw, false);
  assert.equal(h.outbox.hasPending(), false);
  assert.equal(h.stored, null);
});
test("uncertain writes retain the entire queue for explicit retry with the same decision IDs", async () => {
  const h = harness();
  const mark = h.outbox.append(h.fixture.mark, "stable-id");
  const rejected = mark.catch((e) => e);
  h.waits
    .shift()!
    .reject(Object.assign(Error("Offline"), { code: "unavailable" }));
  await rejected;
  assert.equal(h.outbox.needsRetry(), true);
  assert.equal(JSON.parse(h.stored!)[0].id, "stable-id");
  const retry = h.outbox.retry();
  assert.equal(h.waits[0].item.id, "stable-id");
  h.acknowledge();
  await retry;
  assert.equal(h.outbox.hasPending(), false);
});
test("restored choices wait for explicit retry; an already committed receipt is not duplicated", async () => {
  const h = harness();
  const first = h.outbox.append(h.fixture.mark, "stable-id");
  void first.catch(() => {});
  const restored = new ChoiceOutbox(uid, h.storage, h.commit, h.publish);
  restored.accept(h.fixture.history);
  assert.equal(restored.needsRetry(), true);
  assert.equal(h.waits.length, 1, "reload must not automatically resend");
  const committed = [
    ...h.fixture.history,
    {
      version: 2,
      id: "stable-id",
      actor: uid,
      sequence: h.fixture.history.length + 1,
      command: h.fixture.mark,
    },
  ];
  restored.accept(committed);
  assert.equal(restored.hasPending(), false);
  assert.equal(h.stored, null);
  h.outbox.close();
});
test("a conflicting same-seat update rolls back queued decisions instead of replaying a stale tap", async () => {
  const h = harness();
  const promise = h.outbox.append(h.fixture.mark);
  const result = promise.catch((e) => e);
  const target = targets(
    h.fixture.state.players[0],
    currentNumber(h.fixture.state),
  )[1];
  assert.ok(target);
  const other = {
    ...h.fixture.mark,
    cardId: target.cardId,
    cell: target.cell,
  } as Command;
  h.outbox.accept([
    ...h.fixture.history,
    {
      version: 2,
      id: "another-window",
      actor: uid,
      sequence: h.fixture.history.length + 1,
      command: other,
    },
  ]);
  assert.match((await result).message, /table changed/);
  assert.equal(h.displays.at(-1)!.meta.rollback, true);
  assert.equal(h.outbox.hasPending(), false);
  h.waits
    .shift()!
    .reject(Object.assign(Error("Conflict"), { code: "permission-denied" }));
  await tick();
});

test("server acknowledgments identify choices already presented, without replaying their effects", async () => {
  const h = harness();
  const mark = h.outbox.append(h.fixture.mark, "painted-mark");
  h.acknowledge();
  await mark;
  assert.deepEqual(h.displays.at(-1)!.meta.acknowledged, ["painted-mark"]);
});
test("an acknowledgment received before an uncertain RPC result wins and the next tap still commits", async () => {
  const h = harness();
  const mark = h.outbox.append(h.fixture.mark, "known-committed");
  const undo = h.outbox.append(
    { type: "undo", playerId: h.fixture.state.players[0].id },
    "next-tap",
  );
  const pending = h.waits.shift()!;
  const committed = [
    ...h.fixture.history,
    {
      version: 2,
      id: pending.item.id,
      actor: uid,
      sequence: h.fixture.history.length + 1,
      command: pending.item.command,
    },
  ];
  h.outbox.accept(committed);
  await mark;
  pending.reject(Object.assign(Error("Late timeout"), { code: "unavailable" }));
  await tick();
  assert.equal(h.outbox.needsRetry(), false);
  assert.equal(h.waits[0].item.id, "next-tap");
  const next = h.waits.shift()!;
  next.resolve([
    ...committed,
    {
      version: 2,
      id: next.item.id,
      actor: uid,
      sequence: committed.length + 1,
      command: next.item.command,
    },
  ]);
  await undo;
  assert.equal(h.outbox.hasPending(), false);
});

test("local predictions do not mutate or rebuild the confirmed state prefix", async () => {
  const h = harness();
  const confirmed = h.outbox.rebuild(h.fixture.history);
  const mark = h.outbox.append(h.fixture.mark, "cached-choice");
  assert.equal(h.outbox.rebuild(h.fixture.history), confirmed);
  assert.equal(confirmed.players[0].usedDraw, false);
  assert.equal(h.displays.at(-1)!.state.players[0].usedDraw, true);
  h.acknowledge();
  await mark;
  assert.equal(h.outbox.rebuild(h.outbox.history).players[0].usedDraw, true);
});
test("a reused decision ID with different contents cannot acknowledge a pending tap", async () => {
  const h = harness();
  const mark = h.outbox.append(h.fixture.mark, "collision");
  const result = mark.catch((e) => e);
  const target = targets(
    h.fixture.state.players[0],
    currentNumber(h.fixture.state),
  )[1];
  assert.ok(target);
  const other = {
    ...h.fixture.mark,
    cardId: target.cardId,
    cell: target.cell,
  } as Command;
  h.outbox.accept([
    ...h.fixture.history,
    {
      version: 2,
      id: "collision",
      actor: uid,
      sequence: h.fixture.history.length + 1,
      command: other,
    },
  ]);
  assert.match((await result).message, /already in use/);
  assert.equal(h.outbox.hasPending(), false);
  h.waits
    .shift()!
    .reject(Object.assign(Error("Collision"), { code: "permission-denied" }));
  await tick();
});
test("a storage failure never presents or transmits a decision that was not persisted", async () => {
  const fixture = setup();
  let blocked = false,
    writes = 0,
    displayed = 0;
  const outbox = new ChoiceOutbox(
    uid,
    {
      read: () => null,
      write: () => {
        if (blocked) throw Error("Storage full");
      },
    },
    async () => {
      writes++;
      return [];
    },
    () => {
      displayed++;
    },
  );
  outbox.accept(fixture.history);
  blocked = true;
  const before = displayed;
  await assert.rejects(outbox.append(fixture.mark), /Storage full/);
  assert.equal(displayed, before);
  assert.equal(writes, 0);
  assert.equal(outbox.hasPending(), false);
});
