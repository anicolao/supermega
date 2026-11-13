import { cardBack, numberCard } from "../components/pieces.ts";

let cancelFlight: (() => void) | undefined;

/** Move and flip the same layered card assembly from its deck to its draw well. */
export function animateDraw(
  deck: HTMLElement,
  target: HTMLElement,
  value: number,
) {
  cancelFlight?.();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const from = deck.getBoundingClientRect(),
    to = target.getBoundingClientRect();
  const card = document.createElement("div");
  card.className = "flying-number";
  card.setAttribute("aria-hidden", "true");
  card.style.cssText = `left:${to.left}px;top:${to.top}px;width:${to.width}px;height:${to.height}px`;
  card.innerHTML = `<div class="flight-face flight-front">${numberCard(value)}</div><div class="flight-face flight-back">${cardBack("number")}</div>`;
  document.body.append(card);
  document.body.classList.add("is-drawing");
  const flight = card.animate(
    [
      {
        transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${from.width / to.width}) rotateY(-180deg) rotateZ(-9deg)`,
      },
      {
        transform: `translate(${(from.left - to.left) * 0.35}px,${Math.min(-25, (from.top - to.top) * 0.4)}px) scale(1.1) rotateY(-85deg) rotateZ(-3deg)`,
        offset: 0.46,
      },
      {
        transform: "translate(0,0) scale(1.04) rotateY(0deg) rotateZ(7deg)",
        offset: 0.84,
      },
      { transform: "translate(0,0) scale(1) rotateY(0deg) rotateZ(5deg)" },
    ],
    { duration: 680, easing: "cubic-bezier(.22,.7,.2,1)", fill: "forwards" },
  );
  const clear = () => {
    card.remove();
    document.body.classList.remove("is-drawing");
  };
  const cancel = () => {
    flight.cancel();
    clear();
  };
  cancelFlight = cancel;
  void flight.finished
    .catch(() => {})
    .finally(() => {
      if (cancelFlight === cancel) {
        clear();
        cancelFlight = undefined;
      }
    });
}
