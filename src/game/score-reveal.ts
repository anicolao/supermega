import { scorecard } from "../components/pieces.ts";
import { score, total, type State } from "./engine.ts";
import { playSound } from "./sound.ts";
export class ScoreReveal {
  private dialog = document.createElement("dialog");
  private generation = 0;
  private paused = false;
  private refresh?: () => void;
  constructor() {
    this.dialog.className = "round-score-dialog";
    this.dialog.setAttribute("aria-labelledby", "round-score-title");
    document.body.append(this.dialog);
    this.dialog.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "[data-score-control]",
      );
      if (button?.dataset.scoreControl === "pause") {
        this.paused = !this.paused;
        button.textContent = this.paused ? "Resume ▶" : "Pause Ⅱ";
      }
      if (button?.dataset.scoreControl === "skip") this.cancel();
    });
    this.dialog.addEventListener("cancel", () => this.cancel());
    window.addEventListener("resize", () => {
      if (this.active) this.refresh?.();
    });
  }
  get active() {
    return this.dialog.open;
  }
  cancel() {
    this.generation++;
    this.refresh = undefined;
    this.dialog.close();
  }
  private async wait(ms: number, generation: number) {
    let remaining = ms,
      last = performance.now();
    while (remaining > 0 && generation === this.generation) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      const now = performance.now();
      if (!this.paused && !document.hidden) remaining -= now - last;
      last = now;
    }
  }
  async show(before: State, after: State, uid: string) {
    this.cancel();
    const generation = this.generation;
    this.paused = false;
    const owned = after.players.filter((p) => p.controller === uid),
      players = owned.length ? owned : after.players.slice(0, 1);
    this.dialog.showModal();
    for (const player of players) {
      if (generation !== this.generation) return;
      const final = structuredClone(score(after, player)),
        data = structuredClone(final),
        round = before.round;
      data.completed[round - 1] = 0;
      data.stars[round - 1] = 0;
      data.incomplete = 0;
      data.moons = 0;
      let stage = "empty",
        caption = `${player.name} · Round ${round}`,
        displayedTotal: number | undefined;
      const render = (label: string, nextStage = stage) => {
        stage = nextStage;
        caption = label;
        const compact = innerHeight < 750,
          part =
            stage === "total" || stage === "extras" ? 2 : round <= 2 ? 0 : 1;
        this.dialog.classList.toggle("final-score", after.phase === "finished");
        if (!this.dialog.querySelector(".round-score-body"))
          this.dialog.innerHTML = `<div class="round-score-heading"><h2 id="round-score-title"></h2><span></span></div><div class="round-score-body"><div class="round-score-card"></div><p class="round-score-caption" role="status" aria-live="polite"></p></div><div class="round-score-controls"><button data-score-control="pause">Pause Ⅱ</button><button data-score-control="skip">Skip animation →</button></div>`;
        this.dialog.querySelector("#round-score-title")!.textContent =
          `Round ${round} results`;
        this.dialog.querySelector(".round-score-heading span")!.textContent =
          players.length > 1
            ? `${players.indexOf(player) + 1} / ${players.length}`
            : "";
        const surface =
          this.dialog.querySelector<HTMLElement>(".round-score-card")!;
        surface.className = `round-score-card utility-score ${compact ? `score-part score-part-${part}` : ""}`;
        surface.dataset.fill = stage;
        surface.innerHTML = scorecard(data);
        const narrative = this.dialog.querySelector(".round-score-caption")!;
        if (narrative.textContent !== caption) narrative.textContent = caption;
        this.dialog.querySelector("[data-score-control=pause]")!.textContent =
          this.paused ? "Resume ▶" : "Pause Ⅱ";
        const row = this.dialog.querySelector(`[data-score-round="${round}"]`)!;
        row.classList.add("filling-round");
        const totalNode =
          this.dialog.querySelector<HTMLElement>(".mega-total strong")!;
        displayedTotal ??= Number(totalNode.textContent);
        totalNode.textContent = String(displayedTotal);
      };
      this.refresh = () => render(caption);
      render(caption);
      await this.wait(300, generation);
      const boxes = final.completed[round - 1],
        stars = final.stars[round - 1],
        value = [15, 12, 10, 8][round - 1];
      for (let n = 0; n <= boxes; n++) {
        if (generation !== this.generation) return;
        data.completed[round - 1] = n;
        render(
          `${n} completed ${n === 1 ? "box" : "boxes"} × ${value} = ${n * value} points`,
          "boxes",
        );
        if (n) playSound("award");
        await this.wait(n ? 380 : boxes ? 100 : 400, generation);
      }
      for (let n = 0; n <= stars; n++) {
        if (generation !== this.generation) return;
        data.stars[round - 1] = n;
        render(`${n} ${n === 1 ? "star" : "stars"} = ${n * n} points`, "stars");
        if (n) playSound("award");
        await this.wait(n ? 380 : stars ? 100 : 400, generation);
      }
      if (generation !== this.generation) return;
      render(
        `Round ${round}: ${boxes * value + stars * stars} points`,
        "points",
      );
      playSound("score");
      await this.wait(650, generation);
      if (after.phase === "finished") {
        data.incomplete = final.incomplete;
        render(`Unfinished boxes: +${final.incomplete} points`, "extras");
        await this.wait(600, generation);
        if (generation !== this.generation) return;
        data.moons = final.moons;
        render(
          `Moons: ${final.moons >= 0 ? "+" : ""}${final.moons} points`,
          "extras",
        );
        await this.wait(600, generation);
      }
      if (generation !== this.generation) return;
      const start = displayedTotal!,
        end = total(after, player);
      for (let step = 1; step <= 12; step++) {
        if (generation !== this.generation) return;
        displayedTotal = Math.round(start + ((end - start) * step) / 12);
        render(`Mega total: ${end} points`, "total");
        await this.wait(45, generation);
      }
      await this.wait(1000, generation);
    }
    if (generation === this.generation) this.dialog.close();
  }
}
