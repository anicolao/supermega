import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/lilita-one/400.css";
import "../style.css";
import "../generated-art.css";
import "./game.css";
import {
  luckyCard,
  numberCard,
  cardBack,
  token,
  scorecard,
  escape,
} from "../components/pieces.ts";
import { symbol, rewardLabel } from "../components/symbols.ts";
import { CardInspector } from "../components/inspector.ts";
import { cardById } from "./catalog.ts";
import {
  bonusStates,
  pendingBonuses,
  targets,
  currentNumber,
  canFinish,
  canAdvance,
  score,
  total,
  type Box,
  type Player,
  type State,
  type Command,
  type GameEvent,
} from "./engine.ts";
import type { repository as repositoryType } from "./repository.ts";
import {
  unlockSound,
  playSound,
  toggleSound,
  soundEnabled,
  type SoundKind,
} from "./sound.ts";
import QRCode from "qrcode";
const app = document.querySelector<HTMLDivElement>("#app")!;
let state: State | undefined,
  events: GameEvent[] = [],
  uid = "",
  room = "",
  repo: ReturnType<typeof repositoryType> | undefined,
  busy = false,
  creating = false,
  message = "",
  qr = "",
  selectedPlayer = "",
  inspectedPlayer = "";
const rotations = new Set<string>();
const deltas = new Map<string, number>(),
  selections = new Map<string, string[]>(),
  panels = new Set<string>();
let activeBonus:
  { playerId: string; cardId: string; bonus: number } | undefined;
const entry = {
  name: localStorage.getItem("supermega:name") || "Alex",
  mode: location.pathname.startsWith("/tabletop") ? "tabletop" : "solo",
  capacity: 4,
  code: "",
};
const dialog = document.createElement("dialog");
dialog.id = "inspector";
dialog.setAttribute("aria-labelledby", "inspection-title");
dialog.innerHTML =
  '<div class="inspector-top"><div><p class="eyebrow">YOUR BOX, UP CLOSE</p><h2 id="inspection-title"></h2></div><button class="outlined-button" data-game="close-inspector" data-action="close">Return to table ×</button></div><div id="inspection-art"></div><div id="inspection-feedback" class="inspection-feedback" role="status" aria-live="polite"></div><p class="inspection-note">Marks and bonuses stay connected to your table.</p>';
document.body.append(dialog);
function findBox(id: string) {
  for (const p of state?.players ?? []) {
    const box = [...p.cards, ...p.offers].find((c) => c.id === id);
    if (box) return { p, box };
  }
  throw Error("This card is no longer on the table.");
}
const art = (box: Box) => ({ ...cardById(box.template), id: box.id });
function cardView(box: Box, p: Player) {
  return {
    marked: box.marks,
    bonuses: bonusStates(box),
    interactive: p.controller === uid && state?.phase === "playing" && !p.ready,
    inspectable: true,
    canUndo: p.controller === uid && !!state?.undo[p.id]?.length,
  };
}
const inspector = new CardInspector(
  dialog,
  (id) => art(findBox(id).box),
  (id) => {
    const { p, box } = findBox(id);
    return cardView(box, p);
  },
);
function feedback() {
  const p = state?.players.find((p) => p.id === inspectedPlayer);
  return `<span>${escape(message || "Tap a number or a pending bonus.")}</span>${p && state?.undo[p.id]?.length ? `<button class="outlined-button" data-game="undo" data-player="${p.id}">Undo last choice ↶</button>` : ""}`;
}
const brand = `<a class="wordmark" href="/"><span class="brand-box">${symbol("box")}</span><span>SUPER MEGA<br><b>LUCKY BOX</b></span></a>`;
function help() {
  return `<details class="game-help" data-panel="help" ${panels.has("help") ? "open" : ""}><summary>How to play</summary><div><p>Choose 3 of your first 5 Lucky Boxes. Every round, everyone uses the same 9 drawn numbers. Mark one matching square across your cards per draw. Lightning changes your number by ±1 per token, looping between 9 and 1.</p><p>Complete a row or column to unlock its bonus. Tap an active bonus to collect a bolt, moon, or star—or choose a matching square for a printed number. A question mark can mark any open square. Bonuses can chain, and bonus numbers cannot use lightning.</p><p>Finish all bonuses, then choose Ready. The host reveals the next number when everyone is ready. Completed cards score 15 / 12 / 10 / 8 points in rounds 1–4; each round’s 1 / 2 / 3 stars score 1 / 4 / 9. After rounds 1–3, choose one of 3 new cards. At the end, every 2 marks on unfinished cards score 1 point.</p><p>Most moons: +6 points. Fewest: −6 (no penalty with two players). Ties receive the full amounts; points ties are broken by moons. Solo moons score −6 / −2 / 0 / 1 / 3 / 6 / 10 for 0 / 1 / 2 / 3 / 4 / 5 / 6+ moons. Undo reverses your own choices until the next number or new cards are revealed.</p></div></details>`;
}
function header() {
  return `<header class="site-header game-header">${brand}<div class="game-header-actions">${room ? `<a href="${state?.mode === "tabletop" ? "/table" : "/tabletop"}/${room}" class="table-link">${state?.mode === "tabletop" ? "Personal view" : "Tabletop view"}</a>` : ""}<button class="text-button" data-game="sound" aria-pressed="${soundEnabled()}" aria-label="${soundEnabled() ? "Mute" : "Enable"} sound">${soundEnabled() ? "♫ Sound on" : "Sound off"}</button><a class="text-link gallery-link" href="/gallery/">Gallery</a></div></header>`;
}
function front() {
  const previous = localStorage.getItem("supermega:last-room");
  return `${header()}<main class="game-front"><section><p class="eyebrow">A LITTLE LUCK. A LOVELY CHAIN REACTION.</p><h1>Let’s make<br>some <em>MEGA</em> luck.</h1><p class="front-intro">Play solo, gather your friends, or take a seat around the same table.</p><form id="create-game"><label>Your name<input name="name" maxlength="24" value="${escape(entry.name)}" required autocomplete="nickname"></label><div class="front-options"><label>Play style<select name="mode"><option value="solo" ${entry.mode === "solo" ? "selected" : ""}>Just me</option><option value="web" ${entry.mode === "web" ? "selected" : ""}>Friends on their own screens</option><option value="tabletop" ${entry.mode === "tabletop" ? "selected" : ""}>Around one tabletop</option></select></label><label>Seats<select name="capacity" ${entry.mode === "solo" ? "disabled" : ""}>${[1, 2, 3, 4, 5, 6].map((n) => `<option ${n === (entry.mode === "solo" ? 1 : entry.capacity) ? "selected" : ""}>${n}</option>`).join("")}</select></label></div><button class="primary-link" ${busy ? "disabled" : ""}>${busy ? "Connecting…" : "Create a table"} <span>↗</span></button></form>${previous ? `<a class="text-link" href="/table/${previous}">Return to your last table ↗</a>` : ""}<form id="join-game" class="join-form"><label>Have a table code?<input name="code" placeholder="Table code" value="${escape(entry.code)}" maxlength="8" autocapitalize="characters" required></label><button class="outlined-button" ${busy ? "disabled" : ""}>Join</button></form>${help()}<p class="front-links"><a href="/review/">Browser walkthroughs ↗</a><a href="https://github.com/anicolao/supermega" target="_blank" rel="noreferrer">GPL v3 · Source ↗</a></p></section><aside class="front-pieces" aria-label="Lucky Box game pieces"><div class="front-back">${cardBack("lucky")}</div><div class="front-card">${luckyCard({ ...cardById(1), id: "welcome-box" }, { marked: [0, 1, 3, 6] })}</div><div class="front-number">${numberCard(7)}</div><div class="front-token">${token("bolt")}</div></aside></main>`;
}
function lobby() {
  const host = state!.owner === uid,
    owned = state!.players.some((p) => p.controller === uid);
  return `<section class="game-lobby"><div><p class="eyebrow">YOUR GATHERING</p><h1>Table <span>${room}</span></h1><p>One shared draw. Everybody plays.</p><div class="invite"><input readonly aria-label="Invitation link" value="${location.origin}/table/${room}"><button class="outlined-button" data-game="copy">Copy link</button></div>${qr ? `<img class="invite-qr" src="${qr}" alt="Scan to join table ${room}">` : ""}<p class="quiet-copy">Scan or share this link to join on a phone, tablet, or laptop.</p></div><div class="lobby-seats"><h2>${state!.players.length} / ${state!.capacity} seats</h2>${state!.players.map((p) => `<div class="lobby-seat"><i style="background:${cardById(p.seat + 1).color}"></i><b>${escape(p.name)}</b><span>${p.controller === uid ? "Your seat" : "Connected"}</span></div>`).join("")}${!owned && state!.players.length < state!.capacity ? `<form id="join-seat"><label>Your name<input name="name" value="${escape(entry.name)}" maxlength="24" required></label><button class="primary-link" ${busy ? "disabled" : ""}>Take a seat</button></form>` : ""}${host ? `<button class="primary-link start-game" data-game="start" ${busy || creating ? "disabled" : ""}>Start game →</button>` : '<p class="quiet-copy">The table creator will start when everyone is here.</p>'}</div></section>`;
}
function playerArea(p: Player) {
  const own = p.controller === uid,
    delta = deltas.get(p.id) ?? 0,
    selected = selections.get(p.id) ?? [],
    pending = pendingBonuses(p),
    active = activeBonus?.playerId === p.id ? activeBonus : undefined;
  return `<section class="player-zone ${rotations.has(p.id) ? "rotated-seat" : ""}" style="--seat-color:${cardById(p.seat + 1).color}" data-seat="${p.seat}" data-player-zone="${p.id}" data-piece-region><div class="seat-heading"><h2><i></i>${escape(p.name)}</h2><span>ROUND ${state!.round} · ${state!.phase === "draft" ? "CHOOSE CARDS" : `DRAW ${state!.turn} / 9`}</span>${location.pathname.startsWith("/tabletop/") ? `<button class="rotate-seat text-button" data-game="rotate" data-player="${p.id}">Rotate seat ↻</button>` : ""}<div class="seat-resources">${token("bolt")}<b>${p.bolts}</b>${token("moon")}<b>${p.moons}</b>${symbol("star")}<b>${p.stars[state!.round - 1]}</b></div></div>${state!.phase === "draft" && p.offers.length ? `${own ? `<p class="seat-instruction">${state!.round === 1 ? `Choose 3 cards · ${selected.length} / 3 selected. The third tap keeps your set.` : "Choose one new card to keep."}</p><div class="game-boxes offers">${p.offers.map((box) => `<button class="offer-piece ${selected.includes(box.id) ? "chosen" : ""}" data-game="choose-card" data-player="${p.id}" data-card="${box.id}" aria-label="${selected.includes(box.id) ? "Deselect" : "Select"} Lucky Box ${art(box).serial}" aria-pressed="${selected.includes(box.id)}" ${busy ? "disabled" : ""}>${luckyCard(art(box))}${selected.includes(box.id) ? '<span class="offer-check" aria-hidden="true">✓</span>' : ""}</button>`).join("")}</div>` : `<p class="seat-instruction">Choosing their cards…</p><div class="private-offer">${cardBack("lucky")}</div>`}` : `${state!.phase === "playing" && own ? `<div class="player-controls">${active ? `<span class="bonus-instruction">${rewardLabel(cardById(findBox(active.cardId).box.template).rewards[active.bonus])}: choose a square on your cards.</span><button class="text-button" data-game="cancel-bonus">Return to drawn number</button>` : !p.usedDraw && !p.ready ? `<div class="lightning-adjust"><button data-game="adjust" data-player="${p.id}" data-delta="-1" aria-label="Decrease your number" ${Math.abs(delta - 1) > p.bolts || delta <= -8 || busy ? "disabled" : ""}>−</button><span>Your number <b>${((currentNumber(state!) - 1 + delta + 18) % 9) + 1}</b><small>${delta ? `Spend ${Math.abs(delta)} lightning` : "No lightning"}</small></span><button data-game="adjust" data-player="${p.id}" data-delta="1" aria-label="Increase your number" ${Math.abs(delta + 1) > p.bolts || delta >= 8 || busy ? "disabled" : ""}>+</button></div>` : `<span>${p.ready ? "Ready for the next draw ✓" : pending.length ? `${pending.length} ${pending.length === 1 ? "bonus" : "bonuses"} to resolve` : "Number marked ✓"}</span>`}<div class="ready-controls"><button class="outlined-button" data-game="undo" data-player="${p.id}" ${!state!.undo[p.id]?.length || busy ? "disabled" : ""}>Undo ↶</button><button class="ready-button" data-game="finish" data-player="${p.id}" ${!canFinish(state!, p) || busy ? "disabled" : ""}>${p.ready ? "Ready ✓" : "Ready →"}</button></div></div>` : ""}<div class="game-boxes">${p.cards.map((box) => luckyCard(art(box), cardView(box, p))).join("")}</div>${state!.phase === "draft" && own ? `<div class="draft-ready"><span>Cards kept. Wait for the first number.</span><button class="outlined-button" data-game="undo" data-player="${p.id}" ${busy ? "disabled" : ""}>Undo selection ↶</button></div>` : ""}`}</section>`;
}
function describe(e: GameEvent) {
  const c = e.command,
    p =
      "playerId" in c
        ? state!.players.find((p) => p.id === c.playerId)
        : state!.players.find((p) => p.controller === e.actor),
    name = p?.name || "Table";
  if (c.type === "create") return "Table created";
  if (c.type === "join") return `${c.name} joined`;
  if (c.type === "choose") return `${name} kept ${c.cards.length} cards`;
  if (c.type === "mark")
    return `${name} marked a number${c.delta ? ` using ${Math.abs(c.delta)} lightning` : ""}`;
  if (c.type === "bonus") return `${name} applied a bonus`;
  if (c.type === "undo") return `${name} undid a choice`;
  if (c.type === "finish") return `${name} is ready`;
  return (
    (
      {
        start: "Starting cards dealt",
        reveal: "A new number was revealed",
        "next-round": "Round scored",
        rematch: "A new gathering",
      } as Record<string, string>
    )[c.type] || c.type
  );
}
function scoresPanel() {
  return `<details class="scores-panel" data-panel="scores" ${panels.has("scores") ? "open" : ""}><summary>Scorecards & standings</summary><div class="live-scorecards">${state!.players.map((p) => scorecard(score(state!, p))).join("")}</div></details>`;
}
function playing() {
  const table = location.pathname.startsWith("/tabletop/"),
    owned = state!.players.filter((p) => p.controller === uid);
  if (!state!.players.some((p) => p.id === selectedPlayer))
    selectedPlayer = owned[0]?.id ?? state!.players[0]?.id;
  const focused = state!.players.find((p) => p.id === selectedPlayer);
  const advance = state!.owner === uid,
    done = canAdvance(state!),
    number = state!.turn ? currentNumber(state!) : undefined;
  return `<section class="game-status"><div><p class="eyebrow">TABLE ${room} · ROUND ${state!.round} / 4</p><h1>${state!.phase === "draft" ? "Find your lucky boxes." : state!.phase === "finished" ? "A mega finish!" : `Lucky number ${number}.`}</h1><p>${
    state!.phase === "draft"
      ? "Choose your cards, then the creator reveals the first number."
      : state!.phase === "finished"
        ? state!.players
            .filter((p) => state!.winners.includes(p.id))
            .map((p) => escape(p.name))
            .join(" & ") + (state!.winners.length > 1 ? " win!" : " wins!")
        : "Everyone plays at once. Resolve your bonuses, then choose Ready."
  }</p></div><div class="common-draw"><div class="live-deck">${cardBack("number")}</div>${number ? `<div class="live-number">${numberCard(number)}</div>` : ""}<div class="draw-control"><span>${state!.turn} / 9 drawn</span>${advance && state!.phase !== "finished" ? `<button class="primary-link" data-game="${state!.phase === "playing" && state!.turn === 9 ? "next-round" : "reveal"}" ${!done || busy ? "disabled" : ""}>${state!.phase === "playing" && state!.turn === 9 ? (state!.round === 4 ? "Final score →" : "Score round →") : "Reveal next →"}</button><small>${done ? "Ready when you are." : "Waiting for everyone."}</small>` : ""}</div></div></section>${
    state!.phase === "finished"
      ? `<div class="results"><ol>${[...state!.players]
          .sort(
            (a, b) => total(state!, b) - total(state!, a) || b.moons - a.moons,
          )
          .map(
            (p) =>
              `<li><strong>${escape(p.name)}</strong><b>${total(state!, p)}</b><span>${p.moons} moons</span></li>`,
          )
          .join(
            "",
          )}</ol>${advance ? '<button class="primary-link" data-game="rematch">Play again →</button>' : ""}</div>${scoresPanel()}`
      : `${!table ? `<nav class="seat-tabs" aria-label="Player areas">${state!.players.map((p) => `<button data-game="seat" data-player="${p.id}" aria-pressed="${p.id === selectedPlayer}">${escape(p.name)}${p.controller === uid ? " · you" : ""}${p.ready ? " ✓" : ""}</button>`).join("")}</nav>` : ""}<div class="player-table ${table ? "tabletop-game" : ""}" data-seat-count="${state!.players.length}">${(table ? state!.players : focused ? [focused] : []).map(playerArea).join("")}</div>${scoresPanel()}`
  }`;
}
function render() {
  const old = document.activeElement as HTMLElement | null;
  const identity = old
    ? {
        card: old.dataset.card,
        cell: old.dataset.cell,
        bonus: old.dataset.bonus,
        game: old.dataset.game,
        player: old.dataset.player,
        action: old.dataset.action,
        form: old.closest("form")?.id,
        name: old.getAttribute("name"),
      }
    : undefined;
  app.innerHTML = room
    ? `${header()}<main class="game-page ${location.pathname.startsWith("/tabletop/") ? "wide-tabletop" : ""}" data-room="${room}" data-revision="${state?.revision ?? 0}">${!state || state.phase === "empty" ? `<div class="connection-state"><h1>${message.startsWith("No table") ? "Table not found" : "Finding your table…"}</h1><p>The latest choices are being loaded from Firebase.</p></div>` : state.phase === "lobby" ? lobby() : playing()}<div class="game-notice ${message ? "has-message" : ""}" role="status" aria-live="polite">${escape(message)}${repo?.hasPending() ? '<button data-game="retry" class="outlined-button">Retry pending choice</button>' : ""}</div>${state && state.phase !== "empty" ? `<div class="game-notes">${help()}<details data-panel="log" ${panels.has("log") ? "open" : ""}><summary>Choices at this table</summary><ol class="event-log">${events.map((e) => `<li>${escape(describe(e))}</li>`).join("")}</ol></details><a href="${location.origin}/table/${room}" class="text-link">Invite link · ${room}</a></div>` : ""}</main>`
    : `${front()}${message ? `<div class="game-notice has-message" role="status">${escape(message)}</div>` : ""}`;
  document.body.classList.toggle(
    "is-tabletop",
    location.pathname.startsWith("/tabletop/"),
  );
  if (inspector.isOpen) {
    try {
      inspector.render(feedback());
    } catch {
      inspector.close();
    }
  }
  if (identity) {
    let selector = "";
    if (identity.card && identity.cell !== undefined)
      selector = `[data-card="${identity.card}"][data-cell="${identity.cell}"]`;
    else if (identity.card && identity.bonus !== undefined)
      selector = `[data-card="${identity.card}"][data-bonus="${identity.bonus}"]`;
    else if (identity.game)
      selector = `[data-game="${identity.game}"]${identity.player ? `[data-player="${identity.player}"]` : ""}${identity.card ? `[data-card="${identity.card}"]` : ""}`;
    else if (identity.form && identity.name)
      selector = `#${identity.form} [name="${identity.name}"]`;
    const root = dialog.open ? dialog : app;
    if (selector)
      root.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  }
}
async function attach(code: string) {
  room = code.toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(room))
    throw Error("Use the eight-character table code.");
  const { connect, repository } = await import("./repository.ts");
  const connection = await connect();
  uid = connection.uid;
  repo?.close();
  return new Promise<State>((resolve, reject) => {
    repo = repository(
      connection.db,
      uid,
      room,
      (next, s) => {
        events = next;
        state = s;
        busy = false;
        localStorage.setItem("supermega:last-room", room);
        if (activeBonus) {
          const p = s.players.find((p) => p.id === activeBonus!.playerId);
          if (
            !p ||
            !pendingBonuses(p).some(
              (b) =>
                b.cardId === activeBonus!.cardId &&
                b.bonus === activeBonus!.bonus,
            )
          )
            activeBonus = undefined;
        }
        render();
        resolve(s);
      },
      (error) => {
        message = error.message;
        busy = false;
        render();
        reject(error);
      },
    );
  });
}
const sounds: Record<string, SoundKind> = {
  mark: "mark",
  bonus: "bonus",
  finish: "ready",
  undo: "undo",
  reveal: "reveal",
  "next-round": "score",
  start: "reveal",
  choose: "select",
  join: "select",
  create: "select",
  rematch: "score",
};
async function send(command: Command) {
  if (busy) return false;
  busy = true;
  message = "";
  render();
  try {
    await repo!.append(command);
    playSound(sounds[command.type] ?? "select");
    return true;
  } catch (error) {
    message = (error as Error).message;
    playSound("error");
    return false;
  } finally {
    busy = false;
    render();
  }
}
function notice(error: unknown) {
  message = error instanceof Error ? error.message : String(error);
  busy = false;
  render();
}
app.addEventListener("input", (e) => {
  const input = e.target as HTMLInputElement;
  if (input.name === "name") entry.name = input.value;
  if (input.name === "code") entry.code = input.value.toUpperCase();
});
app.addEventListener("change", (e) => {
  const input = e.target as HTMLSelectElement;
  if (input.name === "mode") {
    entry.mode = input.value;
    render();
  }
  if (input.name === "capacity") entry.capacity = Number(input.value);
});
document.addEventListener(
  "toggle",
  (e) => {
    const el = e.target as HTMLElement;
    if (el instanceof HTMLDetailsElement && el.dataset.panel) {
      if (el.open) panels.add(el.dataset.panel);
      else panels.delete(el.dataset.panel);
    }
  },
  true,
);
document.addEventListener("pointerdown", unlockSound, { once: true });
document.addEventListener("keydown", unlockSound, { once: true });
app.addEventListener("submit", async (e) => {
  e.preventDefault();
  unlockSound();
  try {
    const form = e.target as HTMLFormElement;
    if (form.id === "create-game") {
      creating = true;
      busy = true;
      render();
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join(
        "",
      );
      await attach(code);
      if (
        !(await send({
          type: "create",
          name: entry.name,
          mode: entry.mode === "tabletop" ? "tabletop" : "web",
          capacity: entry.mode === "solo" ? 1 : entry.capacity,
          seed: crypto.randomUUID(),
        }))
      )
        throw Error(message || "Could not create the table.");
      if (entry.mode === "tabletop")
        for (let i = 1; i < entry.capacity; i++)
          if (
            !(await send({
              type: "join",
              name: ["Alex", "Robin", "Sam", "Jamie", "Jules", "Morgan"][i],
            }))
          )
            throw Error(message || "Could not seat this player.");
      history.pushState(
        null,
        "",
        `/${entry.mode === "tabletop" ? "tabletop" : "table"}/${code}`,
      );
      localStorage.setItem("supermega:name", entry.name);
      qr = await QRCode.toDataURL(`${location.origin}/table/${room}`, {
        width: 180,
        margin: 1,
      });
      render();
    }
    if (form.id === "join-game") {
      const code = entry.code.trim().toUpperCase();
      await attach(code);
      history.pushState(null, "", `/table/${room}`);
      if (
        state!.phase === "lobby" &&
        !state!.players.some((p) => p.controller === uid)
      )
        await send({ type: "join", name: entry.name });
      render();
    }
    if (form.id === "join-seat") {
      await send({ type: "join", name: entry.name });
      localStorage.setItem("supermega:name", entry.name);
    }
  } catch (error) {
    notice(error);
  } finally {
    creating = false;
    render();
  }
});
document.addEventListener("click", async (e) => {
  const button = (e.target as Element).closest<HTMLButtonElement>("button");
  if (!button) return;
  const game = button.dataset.game,
    action = button.dataset.action;
  try {
    if (game === "close-inspector") {
      inspector.close();
      return;
    }
    if (game === "sound") {
      toggleSound();
      render();
      return;
    }
    if (game === "copy") {
      if (!navigator.clipboard) {
        message = "Select the invitation link to copy it.";
        render();
        const input = app.querySelector<HTMLInputElement>(".invite input");
        input?.focus();
        input?.select();
        return;
      }
      await navigator.clipboard.writeText(`${location.origin}/table/${room}`);
      message = "Invitation link copied.";
      playSound("select");
      render();
      return;
    }
    if (game === "retry") {
      busy = true;
      render();
      await repo!.retry();
      busy = false;
      render();
      return;
    }
    if (game === "seat") {
      selectedPlayer = button.dataset.player!;
      activeBonus = undefined;
      playSound("select");
      render();
      return;
    }
    if (game === "rotate") {
      const id = button.dataset.player!;
      if (rotations.has(id)) rotations.delete(id);
      else rotations.add(id);
      playSound("select");
      render();
      return;
    }
    if (game === "adjust") {
      const id = button.dataset.player!;
      deltas.set(id, (deltas.get(id) ?? 0) + Number(button.dataset.delta));
      playSound("select");
      render();
      return;
    }
    if (game === "cancel-bonus") {
      activeBonus = undefined;
      playSound("select");
      render();
      return;
    }
    if (game === "choose-card") {
      const id = button.dataset.player!,
        p = state!.players.find((p) => p.id === id)!,
        list = [...(selections.get(id) ?? [])],
        index = list.indexOf(button.dataset.card!);
      if (index >= 0) list.splice(index, 1);
      else list.push(button.dataset.card!);
      selections.set(id, list);
      playSound("select");
      if (list.length === (state!.round === 1 ? 3 : 1)) {
        if (await send({ type: "choose", playerId: id, cards: list }))
          selections.delete(id);
      }
      render();
      return;
    }
    if (game === "undo" || action === "undo") {
      const playerId =
        button.dataset.player ??
        findBox(button.closest<HTMLElement>("[data-card-id]")!.dataset.cardId!)
          .p.id;
      activeBonus = undefined;
      deltas.delete(playerId);
      await send({ type: "undo", playerId });
      return;
    }
    if (game === "finish") {
      await send({ type: "finish", playerId: button.dataset.player! });
      return;
    }
    if (game === "start" || game === "reveal" || game === "next-round") {
      if (creating) return;
      activeBonus = undefined;
      await send({ type: game });
      return;
    }
    if (game === "rematch") {
      await send({ type: "rematch", seed: crypto.randomUUID() });
      return;
    }
    if (action === "inspect") {
      const found = findBox(button.dataset.card!);
      inspectedPlayer = found.p.id;
      inspector.show(found.box.id, button, feedback());
      playSound("select");
      return;
    }
    if (action === "apply-bonus") {
      const { p, box } = findBox(button.dataset.card!),
        bonus = Number(button.dataset.bonus),
        value = cardById(box.template).rewards[bonus];
      if (
        (typeof value === "number" || value === "wild") &&
        targets(p, value).length
      ) {
        activeBonus = { playerId: p.id, cardId: box.id, bonus };
        message = `${p.name}: choose ${typeof value === "number" ? `a ${value}` : "any open square"} on your cards.`;
        playSound("select");
        render();
      } else
        await send({ type: "bonus", playerId: p.id, cardId: box.id, bonus });
      return;
    }
    if (action === "mark") {
      const { p, box } = findBox(button.dataset.card!),
        cell = Number(button.dataset.cell);
      if (activeBonus && activeBonus.playerId === p.id) {
        if (
          await send({
            type: "bonus",
            playerId: p.id,
            cardId: activeBonus.cardId,
            bonus: activeBonus.bonus,
            targetCard: box.id,
            cell,
          })
        )
          activeBonus = undefined;
      } else if (
        await send({
          type: "mark",
          playerId: p.id,
          cardId: box.id,
          cell,
          delta: deltas.get(p.id) ?? 0,
        })
      )
        deltas.delete(p.id);
      render();
      return;
    }
  } catch (error) {
    notice(error);
  }
});
window.addEventListener("online", () => {
  message = "Connection restored. Firebase is catching up.";
  render();
});
window.addEventListener("offline", () => {
  message =
    "You are offline. Your last acknowledged table is shown; reconnect before making more choices.";
  render();
});
render();
const route = location.pathname.match(
  /^\/(?:table|tabletop)\/([A-Z2-9]{8})\/?$/i,
);
if (route) {
  void attach(route[1])
    .then(async () => {
      if (state?.phase === "empty") {
        message =
          "No table with that code. Check the link or create a new table.";
        render();
        return;
      }
      if (state?.phase === "lobby")
        qr = await QRCode.toDataURL(`${location.origin}/table/${room}`, {
          width: 180,
          margin: 1,
        });
      render();
    })
    .catch(notice);
}
