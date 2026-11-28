import { test } from "node:test";
import assert from "node:assert/strict";
import { fitCards } from "../../src/game/card-layout.ts";
function fits(
  width: number,
  height: number,
  count: number,
  layout: ReturnType<typeof fitCards>,
  actionSpace = 0,
) {
  const rows = Math.ceil(Math.min(count, layout.capacity) / layout.columns);
  assert.ok(layout.columns * layout.size + (layout.columns - 1) * 8 <= width);
  assert.ok(rows * (layout.size + actionSpace) + (rows - 1) * 8 <= height);
}
test("all five offers fit without paging in either iPad orientation, including short Safari viewports", () => {
  for (const [width, height, columns] of [
    [980, 450, 3],
    [1320, 700, 3],
    [730, 720, 2],
    [790, 590, 2],
  ]) {
    const layout = fitCards({
      width,
      height,
      count: 5,
      all: true,
      preferredColumns: columns,
    });
    assert.equal(layout.capacity, 5);
    assert.equal(layout.columns, columns);
    fits(width, height, 5, layout);
  }
});
test("existing hand and three new offers each fit their measured comparison region", () => {
  for (const [width, height, count, maximum] of [
    [230, 450, 6, 150],
    [730, 140, 6, 150],
    [730, 430, 3, 320],
    [720, 450, 3, 320],
  ]) {
    const layout = fitCards({ width, height, count, all: true, maximum });
    assert.equal(layout.capacity, count);
    fits(width, height, count, layout);
  }
});
test("marking trays reserve contextual actions and paginate before shrinking iPad number targets", () => {
  for (const [width, height] of [
    [980, 450],
    [730, 720],
  ]) {
    const layout = fitCards({ width, height, count: 6, actionSpace: 44 });
    assert.ok(layout.size >= 260);
    assert.ok(layout.size <= 320);
    fits(width, height, 6, layout, 44);
    const last = fitCards({
      width,
      height,
      count: 6,
      actionSpace: 44,
      page: 99,
    });
    assert.ok(last.size <= 320);
  }
});

test("phone overviews fit the entire tray with whole-card zoom targets", () => {
  for (const [width, height] of [[370, 590], [300, 320], [640, 220], [370, 150]]) {
    for (const count of [3, 4, 5, 6]) {
      const layout = fitCards({ width, height, count, all: true });
      assert.equal(layout.capacity, count);
      assert.ok(layout.size >= 44);
      fits(width, height, count, layout);
    }
  }
});
