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
