import rows from "./deck-data.json" with { type: "json" };
import type { LuckyCardData, Reward } from "../components/types.ts";
const finishes = [
  "#e76b4f",
  "#9982b8",
  "#81a99a",
  "#d8ac52",
  "#7499b4",
  "#c17c92",
];
const bonus = (n: number): Reward =>
  n === 0
    ? null
    : n < 10
      ? n
      : (
          {
            10: "double-bolt",
            11: "star",
            12: "moon",
            13: "wild",
            14: "bolt",
          } as Record<number, Reward>
        )[n];
export const deck: LuckyCardData[] = rows.map((row, i) => ({
  id: String(i + 1),
  serial: String(i + 1).padStart(2, "0"),
  color: finishes[i % 6],
  numbers: row.slice(0, 9),
  rewards: row.slice(9).map(bonus),
}));
export function cardById(id: number) {
  const card = deck[id - 1];
  if (!card) throw Error("Unknown Lucky Box");
  return card;
}
export const colorway = (id: number) => (id - 1) % 6;
