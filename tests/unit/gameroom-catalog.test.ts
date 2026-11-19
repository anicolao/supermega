import { test } from "node:test";
import assert from "node:assert/strict";
import {
  catalogWrite,
  GAME_ROOM_ENTRY,
} from "../../scripts/gameroom-catalog.mjs";
const name =
  "projects/launcherui/databases/(default)/documents/Applications/existing-id";
test("new shelf registration is one integrated application, hidden only from tabletop", () => {
  const write = catalogWrite([
    { name: "other", fields: { Title: { stringValue: "Other game" } } },
  ])!;
  assert.equal(write.update.name.split("/").at(-1), "supermega");
  assert.deepEqual(write.currentDocument, { exists: false });
  assert.equal(write.update.fields.GameroomEnabled.stringValue, "integrated");
  assert.equal(write.update.fields.Hidden.booleanValue, true);
  assert.equal(Object.hasOwn(write.update.fields, "URL"), false);
});
test("existing catalog IDs, tabletop URL, Hidden and unrelated fields are preserved", () => {
  const old = {
    name,
    updateTime: "2026-11-19T00:00:00Z",
    fields: {
      Title: { stringValue: "Super Mega Lucky Box" },
      URL: { stringValue: "https://tabletop.example/" },
      Hidden: { booleanValue: false },
      Other: { stringValue: "preserve" },
    },
  };
  const before = structuredClone(old),
    write = catalogWrite([old])!;
  assert.equal(write.update.name, name);
  assert.deepEqual(write.currentDocument, { updateTime: old.updateTime });
  assert.deepEqual(write.updateMask.fieldPaths, [
    "Title",
    "WebURL",
    "Icon",
    "GameroomEnabled",
  ]);
  assert.deepEqual(old, before);
});
test("registration is idempotent and rejects ambiguous or conflicting catalog records", () => {
  const current = {
    name,
    fields: Object.fromEntries(
      Object.entries(GAME_ROOM_ENTRY).map(([k, v]) => [k, { stringValue: v }]),
    ),
  };
  assert.equal(catalogWrite([current]), null);
  assert.throws(
    () => catalogWrite([current, { ...current, name: "duplicate" }]),
    /Multiple/,
  );
  assert.throws(
    () =>
      catalogWrite([
        {
          name: name.replace("existing-id", "supermega"),
          fields: { Title: { stringValue: "Unrelated" } },
        },
      ]),
    /another application/,
  );
});
