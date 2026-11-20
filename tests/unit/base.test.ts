import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBase,
  withinBase,
  withoutBase,
  tableLocation,
} from "../../src/base.ts";
test("root, Pages and retained preview directories preserve asset and route identity", () => {
  for (const base of ["/", "/supermega/", "/supermega/pr3/"]) {
    const asset = withinBase("/assets/generated/bolt.webp", base);
    assert.equal(asset, base + "assets/generated/bolt.webp");
    assert.equal(
      withoutBase(withinBase("gallery/tabletop/", base), base),
      "/gallery/tabletop/",
    );
    const url = new URL(
      tableLocation("0A10B203", false, base),
      "https://example.org",
    );
    assert.equal(url.pathname, base);
    assert.equal(url.searchParams.get("table"), "0A10B203");
    const tabletop = new URL(tableLocation("0A10B203", true, base), url.origin);
    assert.equal(withoutBase(tabletop.pathname, base), "/tabletop/");
  }
});
test("deployment paths normalize directory slashes and reject URLs and traversal", () => {
  assert.equal(normalizeBase("/supermega/pr3"), "/supermega/pr3/");
  for (const value of [
    "https://example.org/",
    "//example.org/",
    "/supermega/../",
    "/supermega/?x=1",
    "relative",
  ])
    assert.throws(() => normalizeBase(value));
  assert.equal(withoutBase("/supermegax/", "/supermega/"), "/supermegax/");
});

test("legacy table links retain preview, view, query and origin through the Pages 404 redirect", async () => {
  const { legacyTableUrl } = await import("../../scripts/legacy-table-url.mjs");
  for (const base of ["/", "/supermega/", "/supermega/pr3/"]) {
    for (const view of ["table", "tabletop"]) {
      const destination = new URL(legacyTableUrl(`https://example.org${base}${view}/0a10b203?returnTo=https%3A%2F%2Froom.example%2F#seat`)!);
      assert.equal(destination.origin, "https://example.org");
      assert.equal(destination.pathname, base + (view === "tabletop" ? "tabletop/" : ""));
      assert.equal(destination.searchParams.get("table"), "0A10B203");
      assert.equal(destination.searchParams.get("returnTo"), "https://room.example/");
      assert.equal(destination.hash, "#seat");
    }
  }
  assert.equal(legacyTableUrl("https://example.org/supermega/not-a-table/"), null);
  assert.equal(new URL(legacyTableUrl("https://example.org//other.example/table/0A10B203")!).origin, "https://example.org");
});
