import { appPath } from "../paths.ts";
const flights = new Set<() => void>();

export function cancelLightning() {
  for (const cancel of [...flights]) cancel();
}

/** Animate acknowledged spending, using the same generated lightning as the tray. */
export function animateLightning(
  source: DOMRect,
  target: HTMLElement,
  amount: number,
  root: HTMLElement,
) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const destination = target.getBoundingClientRect();
  const from = {
    x: source.left + source.width / 2,
    y: source.top + source.height / 2,
  };
  const to = {
    x: destination.left + destination.width / 2,
    y: destination.top + destination.height / 2,
  };
  const layer = document.createElement("div");
  layer.className = "lightning-flight-layer";
  layer.setAttribute("aria-hidden", "true");
  root.append(layer);
  const animations: Animation[] = [];
  const clean = () => {
    layer.remove();
    flights.delete(cancel);
  };
  const cancel = () => {
    animations.forEach((animation) => animation.cancel());
    clean();
  };
  flights.add(cancel);
  for (let i = 0; i < amount; i++) {
    const bolt = document.createElement("img");
    bolt.src = appPath("/assets/generated/bolt.webp");
    bolt.alt = "";
    bolt.className = "spent-lightning";
    layer.append(bolt);
    const position = (x: number, y: number, scale: number, rotation: number) =>
      `translate(${x - 20}px,${y - 24}px) scale(${scale}) rotate(${rotation}deg)`;
    animations.push(
      bolt.animate(
        [
          { transform: position(from.x, from.y, 0.7, -12), opacity: 0 },
          {
            transform: position(from.x, from.y - 10, 1, -8),
            opacity: 1,
            offset: 0.08,
          },
          {
            transform: position(to.x, to.y, 1.05, 8),
            opacity: 1,
            offset: 0.55,
          },
          {
            transform: position(to.x, to.y - 12, 1.55, -7),
            opacity: 1,
            filter: "brightness(1.3)",
            offset: 0.68,
          },
          {
            transform: position(to.x, to.y, 1.1, 0),
            opacity: 1,
            filter: "brightness(1)",
            offset: 0.82,
          },
          { transform: position(to.x, to.y, 0.35, 0), opacity: 0 },
        ],
        {
          duration: 1100,
          delay: i * 75,
          easing: "linear",
          fill: "both",
        },
      ),
    );
  }
  void Promise.allSettled(
    animations.map((animation) => animation.finished),
  ).then(clean);
}
