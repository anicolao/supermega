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
  lightningDelta,
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
import { animateDraw } from "./draw-animation.ts";
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
const selections = new Map<string, string[]>(),
  cardPages = new Map<string, number>(),
  cardLayouts = new Map<
    string,
    { capacity: number; columns: number; size: number }
  >();
let frontTab = "create",
  panelPage = 0,
  panel = "";
let autoPaused = false,
  autoDeadline = 0,
  autoRevision = -1,
  autoFailed = false;
let layoutObserver: ResizeObserver | undefined;
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
    canUndo: false,
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
function header() {
  return `<header class="site-header game-header">${brand}<div class="game-header-actions">${room ? `<a href="${location.pathname.startsWith("/tabletop/") ? "/table" : "/tabletop"}/${room}" class="table-link">${location.pathname.startsWith("/tabletop/") ? "Personal view" : "Tabletop view"}</a>` : ""}<button class="text-button" data-game="sound" aria-pressed="${soundEnabled()}" aria-label="${soundEnabled() ? "Mute" : "Enable"} sound">${soundEnabled() ? "♫" : "♫ Off"}</button><button class="text-button" data-game="panel" data-panel="menu">More</button></div></header>`;
}
function front() {
  const previous = localStorage.getItem("supermega:last-room");
  return `${header()}<main class="game-front"><section><p class="eyebrow">A LITTLE LUCK. A LOVELY CHAIN REACTION.</p><h1>Let’s make<br>some <em>MEGA</em> luck.</h1><nav class="front-tabs"><button data-game="front-tab" data-tab="create" aria-pressed="${frontTab === "create"}">New table</button><button data-game="front-tab" data-tab="join" aria-pressed="${frontTab === "join"}">Join friends</button></nav><form id="${frontTab === "create" ? "create-game" : "join-game"}"><label>Your name<input name="name" maxlength="24" value="${escape(entry.name)}" required autocomplete="nickname"></label>${frontTab === "create" ? `<div class="front-options"><label>Play style<select name="mode"><option value="solo" ${entry.mode === "solo" ? "selected" : ""}>Just me</option><option value="web" ${entry.mode === "web" ? "selected" : ""}>Friends on their own screens</option><option value="tabletop" ${entry.mode === "tabletop" ? "selected" : ""}>Around one tabletop</option></select></label><label>Seats<select name="capacity" ${entry.mode === "solo" ? "disabled" : ""}>${[1, 2, 3, 4, 5, 6].map((n) => `<option ${n === (entry.mode === "solo" ? 1 : entry.capacity) ? "selected" : ""}>${n}</option>`).join("")}</select></label></div><button class="primary-link" ${busy ? "disabled" : ""}>${busy ? "Connecting…" : "Create a table ↗"}</button>` : `<label class="code-label">Table code<input name="code" placeholder="Eight-character code" value="${escape(entry.code)}" maxlength="8" autocapitalize="characters" required></label><button class="primary-link" ${busy ? "disabled" : ""}>Join table ↗</button>`}</form>${previous ? `<a class="text-link return-table" href="/table/${previous}">Return to your last table ↗</a>` : ""}<button class="text-button front-help" data-game="panel" data-panel="help">How to play</button></section><aside class="front-pieces" aria-label="Lucky Box game pieces"><div class="front-back">${cardBack("lucky")}</div><div class="front-card">${luckyCard({ ...cardById(1), id: "welcome-box" }, { marked: [0, 1, 3, 6] })}</div><div class="front-number">${numberCard(7)}</div><div class="front-token">${token("bolt")}</div></aside></main>`;
}
function lobby() {
  const host = state!.owner === uid,
    owned = state!.players.some((p) => p.controller === uid);
  return `<section class="game-lobby"><div><p class="eyebrow">YOUR GATHERING</p><h1>Table <span>${room}</span></h1><p>One shared draw. Everybody plays.</p><div class="invite"><input readonly aria-label="Invitation link" value="${location.origin}/table/${room}"><button class="outlined-button" data-game="copy">Copy link</button></div>${qr ? `<img class="invite-qr" src="${qr}" alt="Scan to join table ${room}">` : ""}<p class="quiet-copy">Scan or share this link to join on a phone, tablet, or laptop.</p></div><div class="lobby-seats"><h2>${state!.players.length} / ${state!.capacity} seats</h2>${state!.players.map((p) => `<div class="lobby-seat"><i style="background:${cardById(p.seat + 1).color}"></i><b>${escape(p.name)}</b><span>${p.controller === uid ? "Your seat" : "Connected"}</span></div>`).join("")}${!owned && state!.players.length < state!.capacity ? `<form id="join-seat"><label>Your name<input name="name" value="${escape(entry.name)}" maxlength="24" required></label><button class="primary-link" ${busy ? "disabled" : ""}>Take a seat</button></form>` : ""}${host ? `<button class="primary-link start-game" data-game="start" ${busy || creating ? "disabled" : ""}>Start game →</button>` : '<p class="quiet-copy">The table creator will start when everyone is here.</p>'}</div></section>`;
}
function controls(p: Player) {
  const active = activeBonus?.playerId === p.id ? activeBonus : undefined;
  return `<div class="player-controls"><div class="choice-guidance">${active ? `${rewardLabel(cardById(findBox(active.cardId).box.template).rewards[active.bonus])}: tap a square. <button class="text-button" data-game="cancel-bonus">Cancel</button>` : p.ready ? "Ready! You can still undo before the draw." : pendingBonuses(p).length ? "Tap your glowing bonuses." : p.usedDraw ? "Number marked. Commit when you’re ready." : "Tap a number. Lightning spends automatically."}</div></div>`;
}
function trayActions(p: Player) {
  if (p.controller !== uid) return "";
  return `<div class="ready-controls" aria-label="${escape(p.name)}’s tray actions"><button class="outlined-button" data-game="undo" data-player="${p.id}" ${!state!.undo[p.id]?.length || busy ? "disabled" : ""}>Undo ↶</button>${state!.phase === "playing" ? `<button class="outlined-button ready-button" data-game="finish" data-player="${p.id}" ${!canFinish(state!, p) || busy ? "disabled" : ""}>${p.ready ? "Ready ✓" : "Ready →"}</button>` : ""}</div>`;
}
function boxes(p: Player, offered: boolean) {
  const cards = offered ? p.offers : p.cards;
  const layout = cardLayouts.get(p.id) ?? {
    capacity: 1,
    columns: 1,
    size: 260,
  };
  const pages = Math.max(1, Math.ceil(cards.length / layout.capacity));
  const page = Math.min(cardPages.get(p.id) ?? 0, pages - 1);
  cardPages.set(p.id, page);
  const selected = selections.get(p.id) ?? [];
  return `<div class="card-surface" data-layout-player="${p.id}" data-card-count="${cards.length}"><div class="game-boxes ${offered ? "offers" : ""}" style="--card-size:${layout.size}px;--card-columns:${layout.columns}">${cards
    .slice(page * layout.capacity, (page + 1) * layout.capacity)
    .map((box) =>
      offered
        ? `<button class="offer-piece ${selected.includes(box.id) ? "chosen" : ""}" data-game="choose-card" data-player="${p.id}" data-card="${box.id}" aria-label="${selected.includes(box.id) ? "Deselect" : "Select"} Lucky Box ${art(box).serial}" aria-pressed="${selected.includes(box.id)}" ${busy ? "disabled" : ""}>${luckyCard(art(box))}${selected.includes(box.id) ? '<span class="offer-check">✓</span>' : ""}</button>`
        : luckyCard(art(box), cardView(box, p)),
    )
    .join("")}</div></div>${
    offered
      ? `<nav class="card-pages" aria-label="${escape(p.name)}’s cards">${Array.from(
          { length: pages },
          (_, i) =>
            `<button data-game="card-page" data-player="${p.id}" data-page="${i}" aria-pressed="${page === i}" aria-label="Card page ${i + 1}">${cards
              .slice(i * layout.capacity, (i + 1) * layout.capacity)
              .map(
                (box) =>
                  `${art(box).serial}${selected.includes(box.id) ? " ✓" : pendingBonuses(p).some((b) => b.cardId === box.id) ? " •" : ""}`,
              )
              .join(" · ")}</button>`,
        ).join("")}</nav>`
      : `<div class="tray-dock"><nav class="card-pages tray-pages" aria-label="${escape(p.name)}’s cards">${pages > 1 ? `<button data-game="card-page" data-player="${p.id}" data-page="${page - 1}" aria-label="Previous cards" ${page === 0 ? "disabled" : ""}>‹</button><span>${page + 1} / ${pages}</span><button data-game="card-page" data-player="${p.id}" data-page="${page + 1}" aria-label="Next cards" ${page === pages - 1 ? "disabled" : ""}>›</button>` : `<span>BOX ${cards.map((box) => art(box).serial).join(" · ")}</span>`}</nav>${trayActions(p)}</div>`
  }`;
}
function playerArea(p: Player) {
  const own = p.controller === uid,
    offered = state!.phase === "draft" && !!p.offers.length;
  const selected = selections.get(p.id) ?? [];
  return `<section class="player-zone ${rotations.has(p.id) ? "rotated-seat" : ""}" style="--seat-color:${cardById(p.seat + 1).color}" data-seat="${p.seat}" data-player-zone="${p.id}" data-piece-region><div class="seat-heading"><h2><i></i>${escape(p.name)}</h2>${location.pathname.startsWith("/tabletop/") ? `<button class="rotate-seat text-button" data-game="rotate" data-player="${p.id}" aria-label="Rotate ${escape(p.name)}’s seat">↻</button>` : ""}<div class="seat-resources">${token("bolt")}<b aria-label="${p.bolts} lightning">${p.bolts}</b>${token("moon")}<b>${p.moons}</b>${symbol("star")}<b>${p.stars[state!.round - 1]}</b></div></div>${offered ? `<div class="seat-instruction">${own ? (state!.round === 1 ? `Choose 3 · ${selected.length} selected` : "Choose one new card") : "Choosing their cards…"}</div>${own ? boxes(p, true) : `<div class="private-offer">${cardBack("lucky")}</div>`}` : `${state!.phase === "playing" && own ? controls(p) : `<div class="draft-ready">${state!.phase === "draft" ? `Cards kept. The next draw is on its way.` : "Watching this seat"}</div>`}${boxes(p, false)}`}</section>`;
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
function playing() {
  const table =
    location.pathname.startsWith("/tabletop/") &&
    innerWidth >= 1400 &&
    innerHeight >= 800;
  const owned = state!.players.filter((p) => p.controller === uid);
  if (!state!.players.some((p) => p.id === selectedPlayer))
    selectedPlayer = owned[0]?.id ?? state!.players[0]?.id;
  const focused = state!.players.find((p) => p.id === selectedPlayer)!;
  const number = state!.turn ? currentNumber(state!) : undefined;
  return `<div class="play-screen"><section class="game-status"><div class="draw-heading"><p class="eyebrow">ROUND ${state!.round} / 4 · ${state!.turn} / 9</p><h1>${state!.phase === "draft" ? "Pick your luck." : state!.phase === "finished" ? "Mega finish!" : `Lucky ${number}`}</h1></div><div class="common-draw"><div class="live-deck">${cardBack("number")}</div>${number ? `<div class="live-number">${numberCard(number)}</div>` : ""}<div class="countdown-burst" data-countdown hidden aria-hidden="true"><img class="countdown-well" src="/assets/generated/well.webp" alt=""><span class="countdown-cheer">HERE COMES LUCK!</span><strong data-countdown-value>3</strong><span class="countdown-caption" data-countdown-caption>Next draw</span><i class="countdown-star first">${symbol("star")}</i><i class="countdown-star second">${symbol("star")}</i></div></div><div class="draw-control">${
    state!.phase !== "finished"
      ? `<span data-auto-status></span>${state!.owner === uid ? `<button class="text-button" data-game="auto-pause" aria-pressed="${autoPaused}">${autoPaused || autoFailed ? "Resume draws ▶" : "Pause draws Ⅱ"}</button>` : ""}`
      : `<p>${state!.players
          .filter((p) => state!.winners.includes(p.id))
          .map((p) => escape(p.name))
          .join(
            " & ",
          )} wins!</p>${state!.owner === uid ? '<button class="primary-link" data-game="rematch">Play again →</button>' : ""}`
  }</div></section><div class="play-workspace">${!table && state!.players.length > 1 && innerWidth >= 650 && innerHeight >= 700 ? `<nav class="seat-tabs" aria-label="Player areas">${state!.players.map((p) => `<button data-game="seat" data-player="${p.id}" aria-pressed="${p.id === selectedPlayer}">${escape(p.name)}${p.ready ? " ✓" : ""}</button>`).join("")}</nav>` : ""}${
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
          )}</ol><button class="outlined-button" data-game="panel" data-panel="scores">See scorecards</button></div>`
      : `<div class="player-table ${table ? "tabletop-game" : ""}" data-seat-count="${state!.players.length}">${(table ? state!.players : [focused]).map(playerArea).join("")}</div>`
  }</div></div>`;
}
const utility = document.createElement("dialog");
utility.id = "game-utility";
utility.setAttribute("aria-labelledby", "utility-title");
document.body.append(utility);
function renderPanel() {
  const scoreParts = innerHeight < 750 ? 3 : 1;
  const pages =
    panel === "help"
      ? 4
      : panel === "log"
        ? Math.max(1, Math.ceil(events.length / 5))
        : panel === "scores"
          ? (state?.players.length ?? 1) * scoreParts
          : 1;
  panelPage = Math.max(0, Math.min(panelPage, pages - 1));
  const helpPages = [
    [
      "Your Lucky Boxes",
      "Keep 3 of your first 5 cards. Everyone plays the same drawn number. Tap any open square: the cheapest lightning adjustment is spent automatically, wrapping 9 ↔ 1. Each lightning changes the number by one. Undo restores the mark and its cost.",
    ],
    [
      "Chain reactions",
      "Complete a row or column, then tap its glowing bonus. Collect lightning, moons, or stars directly. A printed number marks another matching square; ? marks any open square. Bonus numbers never spend lightning. Resolve every pending bonus, then choose Ready.",
    ],
    [
      "Your pace",
      "After everyone keeps their cards or chooses Ready, the next draw happens automatically after a 3-second countdown. The table creator can pause draws to review or undo. Revealing a new number closes the previous undo window. After 9 draws, the round scores automatically; keep one new card between rounds.",
    ],
    [
      "Scoring",
      "Completed cards score 15 / 12 / 10 / 8 by round. Each round’s 1 / 2 / 3 stars score 1 / 4 / 9. Every 2 marks on unfinished cards score 1 point. Most moons: +6, fewest: −6 (no penalty for 2 players). Solo moons: −6 / −2 / 0 / 1 / 3 / 6 / 10 for 0 / 1 / 2 / 3 / 4 / 5 / 6+. Moons break tied scores.",
    ],
  ];
  const content =
    panel === "help"
      ? `<h3>${helpPages[panelPage][0]}</h3><p>${helpPages[panelPage][1]}</p>`
      : panel === "scores"
        ? scorecard(
            score(state!, state!.players[Math.floor(panelPage / scoreParts)]),
          )
        : panel === "seats"
          ? `<div class="utility-menu">${state!.players.map((p) => `<button data-game="seat" data-player="${p.id}" aria-pressed="${p.id === selectedPlayer}">${escape(p.name)}${p.controller === uid ? " · your seat" : ""}${p.ready ? " ✓" : ""}</button>`).join("")}</div>`
          : panel === "log"
            ? `<ol class="event-log" start="${panelPage * 5 + 1}">${events
                .slice(panelPage * 5, panelPage * 5 + 5)
                .map((e) => `<li>${escape(describe(e))}</li>`)
                .join("")}</ol>`
            : `<div class="utility-menu"><button data-game="panel" data-panel="help">How to play</button>${state && state.phase !== "empty" ? '<button data-game="panel" data-panel="seats">Player areas</button><button data-game="panel" data-panel="scores">Scorecards</button><button data-game="panel" data-panel="log">Choices at this table</button><button data-game="copy">Copy invitation link</button>' : ""}<a href="/gallery/">Component gallery ↗</a><a href="/review/">Walkthroughs ↗</a></div>`;
  utility.innerHTML = `<div class="utility-heading"><h2 id="utility-title">${panel === "help" ? "How to play" : panel === "scores" ? "Scorecards" : panel === "log" ? "Choices at this table" : panel === "seats" ? "Player areas" : "At the table"}</h2><button class="outlined-button" data-game="close-panel">Close ×</button></div><div class="utility-content ${panel === "scores" ? `utility-score ${scoreParts > 1 ? `score-part score-part-${panelPage % scoreParts}` : ""}` : ""}">${content}</div>${pages > 1 ? `<nav class="utility-pages"><button data-game="panel-page" data-delta="-1" ${panelPage === 0 ? "disabled" : ""}>← Previous</button><span>${panelPage + 1} / ${pages}</span><button data-game="panel-page" data-delta="1" ${panelPage === pages - 1 ? "disabled" : ""}>Next →</button></nav>` : ""}`;
}
function observeCards() {
  layoutObserver?.disconnect();
  layoutObserver = new ResizeObserver((entries) => {
    let changed = false;
    for (const entry of entries) {
      const element = entry.target as HTMLElement,
        count = Number(element.dataset.cardCount),
        { width, height } = entry.contentRect;
      const maxColumns = Math.max(1, Math.floor((width + 8) / 268)),
        maxRows = Math.max(1, Math.floor((height + 8) / 268));
      const capacity = Math.max(1, Math.min(count, maxColumns * maxRows));
      const page = Math.min(
        cardPages.get(element.dataset.layoutPlayer!) ?? 0,
        Math.ceil(count / capacity) - 1,
      );
      const visible = Math.max(1, Math.min(capacity, count - page * capacity));
      let best = { capacity, columns: 1, size: 0 };
      for (
        let columns = 1;
        columns <= Math.min(maxColumns, visible);
        columns++
      ) {
        const rows = Math.ceil(visible / columns),
          size = Math.floor(
            Math.min(
              (width - 8 * (columns - 1)) / columns,
              (height - 8 * (rows - 1)) / rows,
              420,
            ),
          );
        if (size > best.size) best = { capacity, columns, size };
      }
      const id = element.dataset.layoutPlayer!,
        previous = cardLayouts.get(id);
      if (
        !previous ||
        previous.capacity !== best.capacity ||
        previous.columns !== best.columns ||
        Math.abs(previous.size - best.size) > 1
      ) {
        cardLayouts.set(id, best);
        changed = true;
      }
    }
    if (changed) render();
  });
  app
    .querySelectorAll(".card-surface")
    .forEach((element) => layoutObserver!.observe(element));
}
function updateAuto() {
  const eligible = !!state && canAdvance(state) && !autoFailed;
  if (
    !eligible ||
    autoPaused ||
    busy ||
    utility.open ||
    inspector.isOpen ||
    document.hidden
  )
    autoDeadline = 0;
  else if (!autoDeadline || autoRevision !== state!.revision) {
    autoRevision = state!.revision;
    autoDeadline = Date.now() + 3000;
  }
  const label = app.querySelector<HTMLElement>("[data-auto-status]");
  if (label)
    label.textContent = autoFailed
      ? "Draw paused. Resume to retry."
      : autoPaused || utility.open || inspector.isOpen
        ? "Draw paused for review"
        : eligible && state!.owner !== uid
          ? "Waiting for the table creator"
          : eligible
            ? `${state!.phase === "playing" && state!.turn === 9 ? "Scoring" : "Next draw"} in ${Math.max(1, Math.ceil((autoDeadline - Date.now()) / 1000))}…`
            : "Waiting for everyone to be ready";
  const burst = app.querySelector<HTMLElement>("[data-countdown]");
  const counting = eligible && !!autoDeadline && state!.owner === uid;
  if (burst) {
    burst.hidden = !counting;
    if (counting) {
      const value = burst.querySelector<HTMLElement>("[data-countdown-value]")!;
      const tick = String(
        Math.max(1, Math.ceil((autoDeadline - Date.now()) / 1000)),
      );
      if (value.dataset.tick !== tick) {
        value.dataset.tick = tick;
        value.textContent = tick;
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
          value.animate(
            [
              { transform: "scale(1.35) rotate(-8deg)" },
              { transform: "scale(.94) rotate(3deg)", offset: 0.75 },
              { transform: "scale(1) rotate(0deg)" },
            ],
            { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" },
          );
      }
      burst.querySelector("[data-countdown-caption]")!.textContent =
        state!.phase === "playing" && state!.turn === 9
          ? "Score time!"
          : "Next draw!";
    }
  }
  if (
    eligible &&
    autoDeadline &&
    Date.now() >= autoDeadline &&
    state!.owner === uid &&
    !busy
  ) {
    autoDeadline = 0;
    void send({
      type:
        state!.phase === "playing" && state!.turn === 9
          ? "next-round"
          : "reveal",
    }).then((ok) => {
      if (!ok) {
        autoFailed = true;
        render();
      }
    });
  }
}
setInterval(updateAuto, 100);
function render() {
  const old = document.activeElement as HTMLElement | null;
  const identity = old
    ? {
        card: old.dataset.card,
        cell: old.dataset.cell,
        bonus: old.dataset.bonus,
        game: old.dataset.game,
        page: old.dataset.page,
        panel: old.dataset.panel,
        tab: old.dataset.tab,
        delta: old.dataset.delta,
        player: old.dataset.player,
        action: old.dataset.action,
        form: old.closest("form")?.id,
        name: old.getAttribute("name"),
      }
    : undefined;
  app.innerHTML = room
    ? `${header()}<main class="game-page ${location.pathname.startsWith("/tabletop/") ? "wide-tabletop" : ""}" data-room="${room}" data-revision="${state?.revision ?? 0}">${!state || state.phase === "empty" ? `<div class="connection-state"><h1>${message.startsWith("No table") ? "Table not found" : "Finding your table…"}</h1><p>The latest choices are being loaded from Firebase.</p></div>` : state.phase === "lobby" ? lobby() : playing()}<div class="game-notice ${message ? "has-message" : ""}" role="status" aria-live="polite">${escape(message)}${repo?.hasPending() ? '<button data-game="retry" class="outlined-button">Retry pending choice</button>' : ""}</div></main>`
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
  observeCards();
  updateAuto();
  if (utility.open) renderPanel();
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
    if (identity.game)
      for (const attribute of ["page", "panel", "tab", "delta"] as const) {
        if (identity[attribute] !== undefined)
          selector += `[data-${attribute}="${identity[attribute]}"]`;
      }
    const root = utility.open ? utility : dialog.open ? dialog : app;
    if (selector)
      root.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  }
}
async function attach(code: string) {
  room = code.toUpperCase();
  autoPaused = localStorage.getItem(`supermega:paused:${room}`) === "true";
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
        const drawChanged =
          state &&
          state.phase !== "empty" &&
          s.phase === "playing" &&
          (state.round !== s.round || state.turn !== s.turn);
        if (state?.phase !== s.phase || state?.round !== s.round)
          cardPages.clear();
        events = next;
        state = s;
        busy = false;
        autoFailed = false;
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
        if (drawChanged)
          requestAnimationFrame(() => {
            const deck = app.querySelector<HTMLElement>(".live-deck"),
              target = app.querySelector<HTMLElement>(".live-number");
            if (deck && target) animateDraw(deck, target, currentNumber(s));
          });
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
    autoDeadline = 0;
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
    if (game === "front-tab") {
      frontTab = button.dataset.tab!;
      render();
      return;
    }
    if (game === "panel") {
      panel = button.dataset.panel!;
      panelPage =
        panel === "log" ? Math.max(0, Math.ceil(events.length / 5) - 1) : 0;
      renderPanel();
      if (!utility.open) utility.showModal();
      updateAuto();
      return;
    }
    if (game === "close-panel") {
      utility.close();
      autoDeadline = 0;
      return;
    }
    if (game === "panel-page") {
      panelPage += Number(button.dataset.delta);
      renderPanel();
      return;
    }
    if (game === "auto-pause") {
      autoPaused = autoFailed ? false : !autoPaused;
      localStorage.setItem(`supermega:paused:${room}`, String(autoPaused));
      autoFailed = false;
      autoDeadline = 0;
      render();
      return;
    }
    if (game === "card-page") {
      cardPages.set(button.dataset.player!, Number(button.dataset.page));
      render();
      return;
    }
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
      if (utility.open) utility.close();
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
      selections.delete(playerId);
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
          delta: lightningDelta(
            currentNumber(state!),
            cardById(box.template).numbers[cell],
          ),
        })
      ) {
        message = `Marked ${cardById(box.template).numbers[cell]}${Math.abs(lightningDelta(currentNumber(state!), cardById(box.template).numbers[cell])) ? ` · spent ${Math.abs(lightningDelta(currentNumber(state!), cardById(box.template).numbers[cell]))} lightning` : ""}.`;
      }
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

window.addEventListener("resize", () => {
  if (utility.open) renderPanel();
  render();
});
