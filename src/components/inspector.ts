import "./inspector.css";
import { luckyCard } from "./pieces";
import type { CardView, LuckyCardData } from "./types";
/** Enlarge the production assembly from its actual tray position, then reveal its sheet. */
export class CardInspector {
  private cardId?: string;
  private trigger?: HTMLElement;
  private source?: HTMLElement;
  private regionId?: string;
  private layoutPlayer?: string;
  private animation?: Animation;
  private closing?: Promise<void>;
  private generation = 0;
  constructor(
    private dialog: HTMLDialogElement,
    private card: (id: string) => LuckyCardData,
    private view: (id: string) => CardView,
  ) {
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      void this.close();
    });
    dialog.addEventListener("close", () => this.cleanup());
    dialog.addEventListener("click", (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        void this.close();
    });
  }
  get isOpen() {
    return this.dialog.open;
  }
  private reduced() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  private origin() {
    if (!this.cardId) return undefined;
    const direct =
      this.trigger?.closest<HTMLElement>(".lucky-card") ??
      this.trigger?.querySelector<HTMLElement>(".lucky-card");
    if (
      direct?.isConnected &&
      direct.dataset.cardId === this.cardId &&
      !this.dialog.contains(direct)
    )
      return direct;
    if (this.source?.isConnected) return this.source;
    const region = this.regionId
      ? document.getElementById(this.regionId)
      : this.layoutPlayer
        ? [
            ...document.querySelectorAll<HTMLElement>("[data-layout-player]"),
          ].find((e) => e.dataset.layoutPlayer === this.layoutPlayer)
        : document;
    return [
      ...(region?.querySelectorAll<HTMLElement>("[data-card-id]") ?? []),
    ].find((e) => e.dataset.cardId === this.cardId && !this.dialog.contains(e));
  }
  private hideOrigin() {
    const source = this.origin();
    if (this.source !== source)
      this.source?.classList.remove("card-zoom-origin");
    this.source = source;
    source?.classList.add("card-zoom-origin");
  }
  private transform(rect: DOMRect) {
    const surface = this.dialog.querySelector<HTMLElement>("#inspection-art")!;
    const large = surface
      .querySelector<HTMLElement>(".lucky-card")!
      .getBoundingClientRect();
    const parent = surface.getBoundingClientRect();
    surface.style.transformOrigin = `${large.left - parent.left}px ${large.top - parent.top}px`;
    return `translate(${rect.left - large.left}px,${rect.top - large.top}px) scale(${rect.width / large.width},${rect.height / large.height})`;
  }
  show(id: string, trigger: HTMLElement, feedback: string) {
    if (this.dialog.open) return;
    const generation = ++this.generation;
    this.trigger = trigger;
    this.regionId =
      trigger.closest<HTMLElement>("[data-piece-region]")?.id || undefined;
    this.layoutPlayer = trigger.closest<HTMLElement>("[data-layout-player]")
      ?.dataset.layoutPlayer;
    this.cardId = id;
    const from = this.origin()?.getBoundingClientRect();
    this.dialog.dataset.zoom = "opening";
    this.dialog.dataset.zoomCard = id;
    this.render(feedback);
    this.dialog.showModal();
    this.hideOrigin();
    const reveal = () => {
      if (generation !== this.generation || !this.dialog.open || this.closing)
        return;
      this.animation = undefined;
      this.dialog.dataset.zoom = "open";
      this.dialog
        .querySelector<HTMLButtonElement>('[data-action="close"]')
        ?.focus({ preventScroll: true });
    };
    if (!from || this.reduced()) {
      reveal();
      return;
    }
    const surface = this.dialog.querySelector<HTMLElement>("#inspection-art")!;
    this.animation = surface.animate(
      [{ transform: this.transform(from) }, { transform: "none" }],
      {
        duration: 280,
        easing: "cubic-bezier(.2,.75,.25,1)",
        fill: "none",
      },
    );
    void this.animation.finished.then(reveal, () => {});
  }
  render(feedback: string) {
    if (!this.cardId) return;
    const card = this.card(this.cardId);
    if (this.dialog.dataset.zoom !== "closing")
      this.dialog.querySelector("#inspection-title")!.textContent = `Lucky Box ${card.serial}`;
    this.dialog.querySelector("#inspection-art")!.innerHTML = luckyCard(
      card,
      this.view(card.id),
    );
    this.dialog
      .querySelector('#inspection-art [data-action="inspect"]')
      ?.remove();
    if (this.dialog.dataset.zoom !== "closing")
      this.dialog.querySelector("#inspection-feedback")!.innerHTML = feedback;
    if (this.dialog.open) this.hideOrigin();
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    if (!this.dialog.open) return Promise.resolve();
    const closing = this.shrink();
    this.closing = closing;
    void closing.finally(() => {
      if (this.closing === closing) this.closing = undefined;
    });
    return closing;
  }
  private async shrink() {
    const wasOpening = this.dialog.dataset.zoom === "opening";
    const current = this.dialog
      .querySelector<HTMLElement>("#inspection-art .lucky-card")
      ?.getBoundingClientRect();
    this.animation?.cancel();
    this.animation = undefined;
    this.dialog.dataset.zoom = "closing";
    if (!wasOpening && !this.reduced())
      await new Promise((r) => setTimeout(r, 120));
    if (!this.dialog.open) return;
    const to = this.origin()?.getBoundingClientRect();
    if (to && !this.reduced()) {
      const surface =
        this.dialog.querySelector<HTMLElement>("#inspection-art")!;
      this.animation = surface.animate(
        [
          {
            transform: wasOpening && current ? this.transform(current) : "none",
          },
          { transform: this.transform(to) },
        ],
        {
          duration: 240,
          easing: "cubic-bezier(.45,0,.65,1)",
          fill: "forwards",
        },
      );
      await this.animation.finished.catch(() => {});
    }
    if (this.dialog.open) {
      this.source?.classList.remove("card-zoom-origin");
      this.origin()?.classList.remove("card-zoom-origin");
      this.dialog.close();
    }
  }
  private cleanup() {
    ++this.generation;
    this.animation?.cancel();
    this.animation = undefined;
    const source = this.origin();
    this.source?.classList.remove("card-zoom-origin");
    source?.classList.remove("card-zoom-origin");
    const target = this.trigger?.isConnected
      ? this.trigger
      : (source?.querySelector<HTMLElement>('[data-action="inspect"]') ??
        source?.closest<HTMLElement>("button"));
    this.cardId = undefined;
    this.source = undefined;
    this.trigger = undefined;
    this.regionId = undefined;
    this.layoutPlayer = undefined;
    target?.focus({ preventScroll: true });
  }
}
