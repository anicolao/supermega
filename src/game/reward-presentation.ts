import { bonusStates, type State, type Player, type Box } from "./engine.ts";
import { cardById } from "./catalog.ts";
import { playSound } from "./sound.ts";
type Kind = "bolt" | "moon" | "star";
type Award = {
  playerId: string;
  cardId: string;
  bonus: number;
  serial: string;
  kind: Kind;
  round: number;
};
type Counts = { bolts: number; moons: number; stars: number[] };
/** Model rewards settle atomically; this queue reveals their arrivals one at a time. */
export class RewardPresentation {
  private queue: Award[] = [];
  private current?: Award;
  private counts = new Map<string, Counts>();
  private pending = new Set<string>();
  private generation = 0;
  private stopFlight?: () => void;
  constructor(
    private changed: () => void,
    private surface: () => HTMLElement,
  ) {}
  get active() {
    return !!this.current || this.queue.length > 0;
  }
  hasPlayer(id: string) {
    return (
      this.current?.playerId === id || this.queue.some((a) => a.playerId === id)
    );
  }
  displayed(p: Player): Player {
    return { ...p, ...this.counts.get(p.id) };
  }
  bonuses(p: Player, box: Box) {
    return bonusStates(box).map((state, i) =>
      this.pending.has(`${p.id}:${box.id}:${i}`) ? ("pending" as const) : state,
    );
  }
  message(id: string) {
    return this.current?.playerId === id
      ? `Collecting ${this.current.kind === "bolt" ? "lightning" : this.current.kind} · Box ${this.current.serial}`
      : "";
  }
  capture(before: State, after: State) {
    for (const p of after.players) {
      const old = before.players.find((x) => x.id === p.id);
      if (!old || !document.querySelector(`[data-player-zone="${p.id}"]`))
        continue;
      const added: Award[] = [];
      for (const box of p.cards) {
        const prior = old.cards.find((c) => c.id === box.id);
        if (!prior) continue;
        for (const bonus of box.applied.filter(
          (i) => !prior.applied.includes(i),
        )) {
          const reward = cardById(box.template).rewards[bonus];
          if (!["bolt", "double-bolt", "moon", "star"].includes(String(reward)))
            continue;
          this.pending.add(`${p.id}:${box.id}:${bonus}`);
          for (let i = 0; i < (reward === "double-bolt" ? 2 : 1); i++)
            added.push({
              playerId: p.id,
              cardId: box.id,
              bonus,
              serial: cardById(box.template).serial,
              kind: reward === "double-bolt" ? "bolt" : (reward as Kind),
              round: before.round,
            });
        }
      }
      if (added.length) {
        if (!this.counts.has(p.id))
          this.counts.set(p.id, {
            bolts: p.bolts - added.filter((a) => a.kind === "bolt").length,
            moons: p.moons - added.filter((a) => a.kind === "moon").length,
            stars: [...old.stars],
          });
        this.queue.push(...added);
      }
    }
    if (!this.current && this.queue.length) void this.run(this.generation);
  }
  cancel() {
    this.generation++;
    this.stopFlight?.();
    this.stopFlight = undefined;
    this.queue = [];
    this.current = undefined;
    this.counts.clear();
    this.pending.clear();
  }
  private async run(generation: number) {
    while (this.queue.length && generation === this.generation) {
      const award = this.queue.shift()!;
      this.current = award;
      this.changed();
      const root = this.surface();
      const source =
        root.querySelector<HTMLElement>(
          `[data-card="${award.cardId}"][data-bonus="${award.bonus}"]`,
        ) ??
        document.querySelector<HTMLElement>(
          `[data-player-zone="${award.playerId}"] .card-surface`,
        );
      const selector =
        award.kind === "star"
          ? `.seat-resources>.symbol-star`
          : `.seat-resources .token-${award.kind}`;
      const target = document.querySelector<HTMLElement>(
        `[data-player-zone="${award.playerId}"] ${selector}`,
      );
      playSound("award");
      await this.fly(
        award,
        source?.getBoundingClientRect(),
        target?.getBoundingClientRect(),
        root,
      );
      if (generation !== this.generation) return;
      const counts = this.counts.get(award.playerId)!;
      if (award.kind === "star")
        counts.stars[award.round - 1] = Math.min(
          3,
          counts.stars[award.round - 1] + 1,
        );
      else if (award.kind === "moon") counts.moons++;
      else counts.bolts++;
      const key = `${award.playerId}:${award.cardId}:${award.bonus}`;
      if (
        !this.queue.some((a) => `${a.playerId}:${a.cardId}:${a.bonus}` === key)
      )
        this.pending.delete(key);
      if (!this.queue.some((a) => a.playerId === award.playerId))
        this.counts.delete(award.playerId);
      this.current = undefined;
      this.changed();
    }
  }
  private async fly(
    award: Award,
    source: DOMRect | undefined,
    target: DOMRect | undefined,
    root: HTMLElement,
  ) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!source || !target || reduced) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, reduced ? 180 : 80);
        this.stopFlight = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      return;
    }
    const token = document.createElement("div");
    token.className = "collected-reward";
    token.setAttribute("aria-hidden", "true");
    token.innerHTML = `<img src="/assets/generated/${award.kind}.webp" alt="">`;
    root.append(token);
    const position = (r: DOMRect, scale: number) =>
      `translate(${r.left + r.width / 2 - 23}px,${r.top + r.height / 2 - 23}px) scale(${scale})`;
    const animation = token.animate(
      [
        { transform: position(source, 0.6), opacity: 0 },
        { transform: position(source, 1.25), opacity: 1, offset: 0.18 },
        { transform: position(target, 1), opacity: 1, offset: 0.78 },
        { transform: position(target, 1.35), opacity: 1, offset: 0.9 },
        { transform: position(target, 0.8), opacity: 0 },
      ],
      { duration: 680, easing: "ease-in-out", fill: "both" },
    );
    this.stopFlight = () => animation.cancel();
    await animation.finished.catch(() => {});
    token.remove();
    this.stopFlight = undefined;
  }
}
