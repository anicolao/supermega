import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initial,
  applyEvent,
  replay,
  bonusStates,
  pendingBonuses,
  targets,
  currentNumber,
  canFinish,
  total,
  score,
  type State,
  type Command,
  type GameEvent,
  type Player,
} from "../../src/game/engine.ts";
import { deck, cardById } from "../../src/game/catalog.ts";
function event(s: State, command: Command, actor = "alice"): GameEvent {
  return {
    version: 1,
    id: `event-${s.revision + 1}`,
    actor,
    sequence: s.revision + 1,
    command,
  };
}
function step(s: State, command: Command, actor = "alice") {
  return applyEvent(s, event(s, command, actor));
}
function setup(capacity = 1) {
  let s = step(initial(), {
    type: "create",
    mode: "web",
    capacity,
    seed: "unit-seed",
    name: "Alice",
  });
  for (let i = 1; i < capacity; i++)
    s = step(s, { type: "join", name: `Player ${i + 1}` }, `actor${i}`);
  s = step(s, { type: "start" });
  for (const p of [...s.players])
    s = step(
      s,
      {
        type: "choose",
        playerId: p.id,
        cards: p.offers.slice(0, 3).map((c) => c.id),
      },
      p.controller,
    );
  return step(s, { type: "reveal" });
}
function resolve(s: State, p: Player) {
  for (let guard = 0; guard < 80; guard++) {
    p = s.players.find((x) => x.id === p.id)!;
    const pending = pendingBonuses(p)[0];
    if (!pending) return s;
    const value = pending.reward;
    const destination =
      typeof value === "number" || value === "wild"
        ? targets(p, value)[0]
        : undefined;
    s = step(
      s,
      {
        type: "bonus",
        playerId: p.id,
        cardId: pending.cardId,
        bonus: pending.bonus,
        ...(destination
          ? { targetCard: destination.cardId, cell: destination.cell }
          : {}),
      },
      p.controller,
    );
  }
  throw Error("Bonus loop");
}
function turn(s: State) {
  for (const original of [...s.players]) {
    let p = s.players.find((x) => x.id === original.id)!;
    if (!p.usedDraw) {
      const target = targets(p, currentNumber(s))[0];
      if (target)
        s = step(
          s,
          {
            type: "mark",
            playerId: p.id,
            cardId: target.cardId,
            cell: target.cell,
            delta: 0,
          },
          p.controller,
        );
    }
    s = resolve(s, p);
    p = s.players.find((x) => x.id === p.id)!;
    if (!p.ready) s = step(s, { type: "finish", playerId: p.id }, p.controller);
  }
  return s;
}
test("all 60 physical layouts contain nine values and six validated reward positions", () => {
  assert.equal(deck.length, 60);
  assert.equal(new Set(deck.map((c) => c.serial)).size, 60);
  for (const c of deck) {
    assert.equal(c.numbers.length, 9);
    assert.ok(c.numbers.every((n) => n >= 1 && n <= 9));
    assert.equal(c.rewards.length, 6);
    assert.ok(
      c.rewards.every(
        (r) =>
          r === null ||
          typeof r === "number" ||
          ["bolt", "double-bolt", "moon", "star", "wild"].includes(r),
      ),
    );
  }
});
test("replay is deterministic and rejects missing sequences, duplicates, and unsupported protocols", () => {
  const s = initial(),
    e = event(s, {
      type: "create",
      mode: "web",
      capacity: 1,
      seed: "stable-seed",
      name: "Alice",
    });
  assert.deepEqual(replay([e]), replay([e]));
  assert.throws(() => replay([{ ...e, sequence: 2 }]), /sequence/);
  assert.throws(() => replay([e, { ...e, sequence: 2 }]), /Duplicate/);
  assert.throws(() => replay([{ ...e, version: 99 }]), /version/);
  assert.equal(s.phase, "empty");
});
test("seat ownership, capacity, and host decisions are enforced", () => {
  let s = setup(2);
  assert.throws(
    () => step(s, { type: "finish", playerId: s.players[1].id }),
    /not your seat/,
  );
  assert.throws(() => step(s, { type: "reveal" }, "actor1"), /creator/);
  assert.throws(() => step(s, { type: "reveal" }), /everyone/);
  assert.throws(
    () => step(s, { type: "join", name: "Late" }, "late"),
    /started/,
  );
});
test("draft undo returns discarded offers without duplicating the deck", () => {
  let s = step(initial(), {
    type: "create",
    mode: "tabletop",
    capacity: 2,
    seed: "draft-seed",
    name: "Alice",
  });
  s = step(s, { type: "join", name: "Bob" });
  s = step(s, { type: "start" });
  const p = s.players[0],
    choices = p.offers.slice(0, 3).map((c) => c.id);
  s = step(s, { type: "choose", playerId: p.id, cards: choices });
  s = step(s, {
    type: "choose",
    playerId: s.players[1].id,
    cards: s.players[1].offers.slice(0, 3).map((c) => c.id),
  });
  const otherDiscards = [...s.discard].slice(2);
  s = step(s, { type: "undo", playerId: p.id });
  assert.equal(s.players[0].offers.length, 5);
  assert.deepEqual(s.discard, otherDiscards);
  s = step(s, { type: "choose", playerId: p.id, cards: choices });
  assert.equal(s.discard.length, 4);
});
test("lightning wraps between one and nine, costs exactly its adjustment, and undo refunds it", () => {
  let s = setup();
  s.numberDeck[0] = 9;
  const p = s.players[0];
  p.cards = [{ id: "one", template: 1, marks: [], applied: [] }];
  s = step(s, {
    type: "mark",
    playerId: p.id,
    cardId: "one",
    cell: 0,
    delta: 1,
  });
  assert.equal(s.players[0].bolts, 3);
  assert.equal(s.players[0].usedDraw, true);
  s = step(s, { type: "undo", playerId: p.id });
  assert.equal(s.players[0].bolts, 4);
  assert.equal(s.players[0].cards[0].marks.length, 0);
  assert.equal(s.players[0].usedDraw, false);
  assert.throws(
    () =>
      step(s, {
        type: "mark",
        playerId: p.id,
        cardId: "one",
        cell: 0,
        delta: 5,
      }),
    /lightning/,
  );
});
test("row and column bonuses stay pending until resolved, and undo restores a resolved bonus", () => {
  let s = setup();
  const p = s.players[0];
  p.cards = [{ id: "bonus", template: 1, marks: [0, 1, 3, 6], applied: [] }];
  assert.equal(pendingBonuses(p).length, 1);
  assert.equal(bonusStates(p.cards[0])[3], "pending");
  assert.equal(canFinish(s, p), false);
  const before = p.bolts;
  s = step(s, { type: "bonus", playerId: p.id, cardId: "bonus", bonus: 3 });
  assert.equal(s.players[0].bolts, before + 2);
  assert.equal(bonusStates(s.players[0].cards[0])[3], "applied");
  s = step(s, { type: "undo", playerId: p.id });
  assert.equal(s.players[0].bolts, before);
  assert.equal(bonusStates(s.players[0].cards[0])[3], "pending");
});
test("fixed-number and wild bonuses mark a target without spending lightning or the base draw", () => {
  for (const reward of [7, "wild"] as const) {
    let s = setup();
    const template = deck.find((c) => c.rewards.slice(0, 3).includes(reward))!;
    const bonus = template.rewards.indexOf(reward);
    const p = s.players[0];
    p.cards = [
      {
        id: "source",
        template: Number(template.id),
        marks: [
          ...[
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
          ][bonus],
        ],
        applied: [],
      },
      { id: "target", template: 1, marks: [], applied: [] },
    ];
    const target = targets(p, reward)[0];
    if (!target) continue;
    const bolts = p.bolts;
    s = step(s, {
      type: "bonus",
      playerId: p.id,
      cardId: "source",
      bonus,
      targetCard: target.cardId,
      cell: target.cell,
    });
    assert.equal(s.players[0].bolts, bolts);
    assert.equal(s.players[0].usedDraw, false);
    assert.ok(
      s.players[0].cards
        .find((c) => c.id === target.cardId)!
        .marks.includes(target.cell),
    );
  }
});
test("full games for one through six players reach real four-round scoring without losing deck identities", () => {
  for (const capacity of [1, 2, 3, 4, 5, 6]) {
    let s = setup(capacity);
    for (let round = 1; round <= 4; round++) {
      for (let draw = 1; draw <= 9; draw++) {
        s = turn(s);
        if (draw < 9) s = step(s, { type: "reveal" });
      }
      s = step(s, { type: "next-round" });
      if (round < 4) {
        for (const p of [...s.players])
          s = step(
            s,
            { type: "choose", playerId: p.id, cards: [p.offers[0].id] },
            p.controller,
          );
        s = step(s, { type: "reveal" });
      }
    }
    assert.equal(s.phase, "finished");
    assert.ok(s.winners.length > 0);
    assert.ok(s.players.every((p) => Number.isFinite(total(s, p))));
    const inUse = s.players.flatMap((p) => p.cards.map((c) => c.template));
    assert.equal(new Set(inUse).size, inUse.length);
  }
});
test("moon scoring covers solo, two-player ties, and multi-player penalties", () => {
  let s = setup(3);
  s.phase = "finished";
  s.players[0].moons = 4;
  s.players[1].moons = 4;
  s.players[2].moons = 0;
  assert.equal(score(s, s.players[0]).moons, 6);
  assert.equal(score(s, s.players[2]).moons, -6);
  s.players = s.players.slice(0, 2);
  assert.equal(score(s, s.players[0]).moons, 6);
  s.players = s.players.slice(0, 1);
  s.players[0].moons = 6;
  assert.equal(score(s, s.players[0]).moons, 10);
});
