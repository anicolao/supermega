import { cardById, deck } from "./catalog.ts";
import type { RewardState, ScoreData } from "../components/types.ts";
export const VERSION = 1;
export const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
];
export type Box = {
  id: string;
  template: number;
  marks: number[];
  applied: number[];
};
export type Player = {
  id: string;
  controller: string;
  name: string;
  seat: number;
  cards: Box[];
  offers: Box[];
  bolts: number;
  moons: number;
  stars: number[];
  completed: number[];
  usedDraw: boolean;
  ready: boolean;
};
export type Command =
  | {
      type: "create";
      mode: "web" | "tabletop";
      capacity: number;
      seed: string;
      name: string;
    }
  | { type: "join"; name: string }
  | { type: "start" }
  | { type: "reveal" }
  | { type: "next-round" }
  | { type: "rematch"; seed: string }
  | { type: "choose"; playerId: string; cards: string[] }
  | {
      type: "mark";
      playerId: string;
      cardId: string;
      cell: number;
      delta: number;
    }
  | {
      type: "bonus";
      playerId: string;
      cardId: string;
      bonus: number;
      targetCard?: string;
      cell?: number;
    }
  | { type: "finish"; playerId: string }
  | { type: "undo"; playerId: string };
export type GameEvent = {
  version: number;
  id: string;
  actor: string;
  sequence: number;
  command: Command;
};
export type State = {
  version: number;
  revision: number;
  owner: string;
  phase: "empty" | "lobby" | "draft" | "playing" | "finished";
  mode: "web" | "tabletop";
  capacity: number;
  seed: string;
  round: number;
  turn: number;
  numberDeck: number[];
  players: Player[];
  pile: number[];
  discard: number[];
  drawSerial: number;
  reshuffles: number;
  undo: Record<string, Player[]>;
  winners: string[];
};
export function initial(): State {
  return {
    version: VERSION,
    revision: 0,
    owner: "",
    phase: "empty",
    mode: "web",
    capacity: 6,
    seed: "",
    round: 1,
    turn: 0,
    numberDeck: [],
    players: [],
    pile: [],
    discard: [],
    drawSerial: 0,
    reshuffles: 0,
    undo: {},
    winners: [],
  };
}
const requireThat = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
export function shuffle<T>(input: readonly T[], seed: string): T[] {
  let state = 2166136261;
  for (const char of seed)
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const next = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const result = [...input];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function nameOf(name: string) {
  requireThat(
    typeof name === "string" &&
      name.trim().length > 0 &&
      name.trim().length <= 24,
    "Use a name between 1 and 24 characters.",
  );
  return name.trim();
}
function addPlayer(s: State, actor: string, name: string) {
  requireThat(s.players.length < s.capacity, "The table is full.");
  requireThat(
    !s.players.some((p) => p.controller === actor) ||
      (s.mode === "tabletop" && actor === s.owner),
    "You already have a seat.",
  );
  const number = s.players.filter((p) => p.controller === actor).length + 1;
  s.players.push({
    id: `${actor}:${number}`,
    controller: actor,
    name: nameOf(name),
    seat: s.players.length,
    cards: [],
    offers: [],
    bolts: 4,
    moons: 0,
    stars: [0, 0, 0, 0],
    completed: [0, 0, 0, 0],
    usedDraw: false,
    ready: false,
  });
}
function draw(s: State, count: number): Box[] {
  const result: Box[] = [];
  for (let i = 0; i < count; i++) {
    if (!s.pile.length) {
      requireThat(s.discard.length > 0, "No cards remain to draw.");
      s.pile = shuffle(s.discard, `${s.seed}:recycle:${s.reshuffles++}`);
      s.discard = [];
    }
    result.push({
      id: `box-${++s.drawSerial}`,
      template: s.pile.shift()!,
      marks: [],
      applied: [],
    });
  }
  return result;
}
function prepareNumbers(s: State) {
  s.numberDeck = shuffle(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    `${s.seed}:numbers:${s.round}`,
  ).slice(0, 9);
}
export function bonusStates(box: Box): RewardState[] {
  const card = cardById(box.template);
  return lines.map((line, i) =>
    card.rewards[i] !== null && line.every((cell) => box.marks.includes(cell))
      ? box.applied.includes(i)
        ? "applied"
        : "pending"
      : "unearned",
  );
}
export function pendingBonuses(player: Player) {
  return player.cards.flatMap((card) =>
    bonusStates(card).flatMap((state, bonus) =>
      state === "pending"
        ? [
            {
              cardId: card.id,
              bonus,
              reward: cardById(card.template).rewards[bonus],
            },
          ]
        : [],
    ),
  );
}
export function targets(player: Player, value: number | "wild") {
  return player.cards.flatMap((card) =>
    cardById(card.template).numbers.flatMap((n, cell) =>
      !card.marks.includes(cell) && (value === "wild" || n === value)
        ? [{ cardId: card.id, cell }]
        : [],
    ),
  );
}
/** Smallest signed adjustment on the circular 1–9 number track. */
export function lightningDelta(drawn: number, target: number) {
  const forward = (target - drawn + 9) % 9;
  return forward <= 4 ? forward : forward - 9;
}
export const currentNumber = (s: State) => s.numberDeck[s.turn - 1];
export function canFinish(s: State, p: Player) {
  return (
    s.phase === "playing" &&
    !p.ready &&
    !pendingBonuses(p).length &&
    (p.usedDraw || !targets(p, currentNumber(s)).length)
  );
}
export function canAdvance(s: State) {
  return (
    s.players.length > 0 &&
    (s.phase === "draft"
      ? s.players.every((p) => !p.offers.length)
      : s.phase === "playing" && s.players.every((p) => p.ready))
  );
}
function seat(s: State, actor: string, id: string) {
  const p = s.players.find((p) => p.id === id);
  requireThat(p && p.controller === actor, "That is not your seat.");
  return p!;
}
function box(p: Player, id: string) {
  const card = p.cards.find((c) => c.id === id);
  requireThat(card, "That card is not in your area.");
  return card!;
}
function remember(s: State, p: Player) {
  (s.undo[p.id] ??= []).push(structuredClone(p));
}
function openSquare(card: Box, cell: number) {
  requireThat(
    Number.isInteger(cell) && cell >= 0 && cell < 9,
    "Choose a square on the card.",
  );
  requireThat(!card.marks.includes(cell), "That square is already marked.");
}
export function score(s: State, p: Player): ScoreData {
  let moons = 0;
  if (s.phase === "finished") {
    if (s.players.length === 1)
      moons = [-6, -2, 0, 1, 3, 6, 10][Math.min(6, p.moons)];
    else {
      const counts = s.players.map((p) => p.moons);
      moons =
        (p.moons === Math.max(...counts) ? 6 : 0) -
        (s.players.length > 2 && p.moons === Math.min(...counts) ? 6 : 0);
    }
  }
  return {
    id: p.id,
    name: p.name,
    color: cardById(p.seat + 1).color,
    completed: p.completed,
    stars: p.stars,
    incomplete:
      s.phase === "finished"
        ? Math.floor(
            p.cards
              .filter((c) => c.marks.length < 9)
              .reduce((sum, c) => sum + c.marks.length, 0) / 2,
          )
        : 0,
    moons,
  };
}
export function total(s: State, p: Player) {
  const points = score(s, p);
  return (
    points.completed.reduce((sum, n, i) => sum + n * [15, 12, 10, 8][i], 0) +
    points.stars.reduce((sum, n) => sum + n * n, 0) +
    points.incomplete +
    points.moons
  );
}
export function applyEvent(previous: State, event: GameEvent): State {
  requireThat(
    event.version === VERSION,
    "This table uses a different game version. Reload the latest client.",
  );
  requireThat(
    event.sequence === previous.revision + 1,
    "Event sequence is incomplete.",
  );
  requireThat(
    typeof event.actor === "string" &&
      event.actor.length > 0 &&
      typeof event.id === "string",
    "Invalid event identity.",
  );
  const s = structuredClone(previous),
    c = event.command;
  if (c.type === "create") {
    requireThat(s.phase === "empty", "This room already exists.");
    requireThat(
      ["web", "tabletop"].includes(c.mode) &&
        Number.isInteger(c.capacity) &&
        c.capacity >= 1 &&
        c.capacity <= 6 &&
        typeof c.seed === "string" &&
        c.seed.length >= 8,
      "Invalid table setup.",
    );
    s.owner = event.actor;
    s.mode = c.mode;
    s.capacity = c.capacity;
    s.seed = c.seed;
    s.phase = "lobby";
    addPlayer(s, event.actor, c.name);
  } else if (c.type === "join") {
    requireThat(s.phase === "lobby", "The game has already started.");
    addPlayer(s, event.actor, c.name);
  } else if (["start", "reveal", "next-round", "rematch"].includes(c.type)) {
    requireThat(event.actor === s.owner, "Only the table creator can do that.");
    if (c.type === "start") {
      requireThat(
        s.phase === "lobby" && s.players.length > 0,
        "The table is not ready to start.",
      );
      s.pile = shuffle(
        deck.map((_, i) => i + 1),
        `${s.seed}:boxes`,
      );
      s.discard = [];
      s.drawSerial = 0;
      s.reshuffles = 0;
      s.round = 1;
      s.turn = 0;
      s.undo = {};
      s.winners = [];
      for (const p of s.players) {
        p.cards = [];
        p.offers = draw(s, 5);
        p.bolts = 4;
        p.moons = 0;
        p.stars = [0, 0, 0, 0];
        p.completed = [0, 0, 0, 0];
        p.ready = false;
        p.usedDraw = false;
      }
      prepareNumbers(s);
      s.phase = "draft";
    }
    if (c.type === "reveal") {
      requireThat(
        canAdvance(s),
        "Wait until everyone has finished their choices.",
      );
      requireThat(
        s.phase === "draft" || s.turn < 9,
        "The round is ready to score.",
      );
      s.phase = "playing";
      s.turn++;
      s.undo = {};
      for (const p of s.players) {
        p.usedDraw = false;
        p.ready = false;
      }
    }
    if (c.type === "next-round") {
      requireThat(
        s.phase === "playing" && s.turn === 9 && canAdvance(s),
        "Finish all nine numbers before scoring.",
      );
      for (const p of s.players)
        p.completed[s.round - 1] = p.cards.filter(
          (card) => card.marks.length === 9,
        ).length;
      s.undo = {};
      if (s.round === 4) {
        s.phase = "finished";
        const best = Math.max(...s.players.map((p) => total(s, p)));
        const contenders = s.players.filter((p) => total(s, p) === best);
        const moons = Math.max(...contenders.map((p) => p.moons));
        s.winners = contenders
          .filter((p) => p.moons === moons)
          .map((p) => p.id);
      } else {
        s.round++;
        s.turn = 0;
        for (const p of s.players) {
          s.discard.push(
            ...p.cards
              .filter((card) => card.marks.length === 9)
              .map((card) => card.template),
          );
          p.cards = p.cards.filter((card) => card.marks.length < 9);
        }
        for (const p of s.players) {
          p.offers = draw(s, 3);
          p.ready = false;
          p.usedDraw = false;
        }
        prepareNumbers(s);
        s.phase = "draft";
      }
    }
    if (c.type === "rematch") {
      requireThat(
        s.phase === "finished" && c.seed.length >= 8,
        "Finish this game before a rematch.",
      );
      s.seed = c.seed;
      s.phase = "lobby";
      s.undo = {};
      s.winners = [];
      for (const p of s.players) {
        p.cards = [];
        p.offers = [];
        p.stars = [0, 0, 0, 0];
        p.completed = [0, 0, 0, 0];
        p.moons = 0;
        p.bolts = 4;
        p.ready = false;
        p.usedDraw = false;
      }
    }
  } else if ("playerId" in c) {
    const p = seat(s, event.actor, c.playerId);
    if (c.type === "undo") {
      const before = s.undo[p.id]?.pop();
      requireThat(before, "Nothing can be undone before this reveal.");
      if (before!.offers.length && !p.offers.length) {
        const returned = new Set(
          before!.offers
            .filter((offer) => !p.cards.some((card) => card.id === offer.id))
            .map((offer) => offer.template),
        );
        s.discard = s.discard.filter((id) => !returned.has(id));
      }
      s.players[s.players.indexOf(p)] = before!;
    } else if (c.type === "choose") {
      requireThat(
        s.phase === "draft" && p.offers.length > 0,
        "There are no cards to choose.",
      );
      requireThat(
        Array.isArray(c.cards) &&
          c.cards.length === (s.round === 1 ? 3 : 1) &&
          new Set(c.cards).size === c.cards.length &&
          c.cards.every((id) => p.offers.some((card) => card.id === id)),
        "Choose the required cards from your offer.",
      );
      remember(s, p);
      p.cards.push(...p.offers.filter((card) => c.cards.includes(card.id)));
      s.discard.push(
        ...p.offers
          .filter((card) => !c.cards.includes(card.id))
          .map((card) => card.template),
      );
      p.offers = [];
    } else {
      requireThat(
        s.phase === "playing" && !p.ready,
        "Wait for the next number, or undo your ready choice.",
      );
      if (c.type === "mark") {
        requireThat(!p.usedDraw, "You have already used this number.");
        requireThat(
          Number.isInteger(c.delta) &&
            Math.abs(c.delta) <= 8 &&
            Math.abs(c.delta) <= p.bolts,
          "Not enough lightning for that adjustment.",
        );
        const card = box(p, c.cardId);
        openSquare(card, c.cell);
        requireThat(
          cardById(card.template).numbers[c.cell] ===
            ((currentNumber(s) - 1 + c.delta + 18) % 9) + 1,
          "That square does not match the drawn number.",
        );
        remember(s, p);
        p.bolts -= Math.abs(c.delta);
        p.usedDraw = true;
        card.marks.push(c.cell);
      } else if (c.type === "bonus") {
        const source = box(p, c.cardId);
        requireThat(
          Number.isInteger(c.bonus) &&
            bonusStates(source)[c.bonus] === "pending",
          "That bonus is not pending.",
        );
        const reward = cardById(source.template).rewards[c.bonus];
        if (typeof reward === "number" || reward === "wild") {
          if (targets(p, reward).length) {
            requireThat(
              c.targetCard !== undefined && c.cell !== undefined,
              "Choose a square for this bonus.",
            );
            const destination = box(p, c.targetCard!);
            openSquare(destination, c.cell!);
            requireThat(
              reward === "wild" ||
                cardById(destination.template).numbers[c.cell!] === reward,
              "The bonus must match its printed number.",
            );
            remember(s, p);
            source.applied.push(c.bonus);
            destination.marks.push(c.cell!);
          } else {
            remember(s, p);
            source.applied.push(c.bonus);
          }
        } else {
          remember(s, p);
          source.applied.push(c.bonus);
          if (reward === "bolt") p.bolts++;
          if (reward === "double-bolt") p.bolts += 2;
          if (reward === "moon") p.moons++;
          if (reward === "star")
            p.stars[s.round - 1] = Math.min(3, p.stars[s.round - 1] + 1);
        }
      } else if (c.type === "finish") {
        requireThat(
          canFinish(s, p),
          "Use the drawn number and resolve all pending bonuses first.",
        );
        remember(s, p);
        p.ready = true;
      } else throw Error("Unknown player choice.");
    }
  } else throw Error("Unknown game choice.");
  s.revision = event.sequence;
  return s;
}
export function replay(events: readonly GameEvent[]): State {
  const ids = new Set<string>();
  return events.reduce((s, event) => {
    requireThat(!ids.has(event.id), "Duplicate event identity.");
    ids.add(event.id);
    return applyEvent(s, event);
  }, initial());
}
