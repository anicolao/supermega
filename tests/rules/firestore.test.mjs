import { randomUUID } from "node:crypto";
import { test, before, after } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8397")
  throw Error("Rules tests require the dedicated local Firestore emulator.");
let env;
const scope = `rules-${randomUUID()}`;
const path = () => `previews/${scope}/rooms/${randomUUID()}`;
const db = (uid = "host") => env.authenticatedContext(uid).firestore();
const first = {
  owner: "host",
  controllers: ["host"],
  revision: 1,
  phase: "lobby",
  lastEvent: "c1",
  eventIds: ["c1"],
};
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-supermega-rules",
    firestore: {
      host: "127.0.0.1",
      port: 8397,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
after(async () => env?.cleanup());
function append(database, room, actor, command, old = null, alter = () => {}) {
  const id = old ? randomUUID() : "c1",
    sequence = (old?.revision ?? 0) + 1;
  const data = {
    head: old
      ? {
          ...old,
          revision: sequence,
          lastEvent: id,
          eventIds: [...old.eventIds, id],
        }
      : structuredClone(first),
    event: { version: 2, id, actor, sequence, command },
    receipt: { actor, sequence },
  };
  alter(data);
  const batch = writeBatch(database);
  batch.set(doc(database, room), data.head);
  if (data.event) batch.set(doc(database, room, "events", id), data.event);
  if (data.receipt)
    batch.set(doc(database, room, "commands", id), data.receipt);
  return batch.commit();
}
async function seed(room, head = first) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), room), head);
    await setDoc(doc(context.firestore(), room, "events/c1"), {
      version: 2,
      id: "c1",
      actor: "host",
      sequence: 1,
      command: { type: "create" },
    });
    await setDoc(doc(context.firestore(), room, "commands/c1"), {
      actor: "host",
      sequence: 1,
    });
  });
}
for (const version of [1, 2])
  test(`protocol ${version}: atomic create and permanent event/receipt immutability`, async () => {
    const room = path(),
      database = db();
    await assertSucceeds(
      append(
        database,
        room,
        "host",
        { type: "create" },
        null,
        (d) => (d.event.version = version),
      ),
    );
    await assertSucceeds(getDoc(doc(database, room)));
    for (const suffix of ["", "/events/c1", "/commands/c1"]) {
      await assertFails(deleteDoc(doc(database, room + suffix)));
      if (suffix)
        await assertFails(
          updateDoc(doc(database, room + suffix), { actor: "other" }),
        );
    }
    await assertFails(getDocs(collection(database, `previews/${scope}/rooms`)));
  });
test("rejects unauthenticated access and writes", async () => {
  const room = path(),
    database = env.unauthenticatedContext().firestore();
  await seed(room);
  for (const suffix of ["", "/events/c1", "/commands/c1"])
    await assertFails(getDoc(doc(database, room + suffix)));
  await assertFails(append(database, path(), "host", { type: "create" }));
});
for (const [name, alter] of [
  ["missing event", (d) => (d.event = null)],
  ["missing receipt", (d) => (d.receipt = null)],
  ["forged event actor", (d) => (d.event.actor = "other")],
  ["forged receipt actor", (d) => (d.receipt.actor = "other")],
  ["mismatched receipt sequence", (d) => (d.receipt.sequence = 2)],
  ["mismatched event ID", (d) => (d.event.id = "another")],
  ["unsupported protocol", (d) => (d.event.version = 99)],
  ["extra event fields", (d) => (d.event.untrusted = true)],
  ["extra metadata fields", (d) => (d.head.untrusted = true)],
  ["forged owner", (d) => (d.head.owner = "other")],
])
  test(`atomic creation rejects ${name}`, async () => {
    await assertFails(
      append(db(), path(), "host", { type: "create" }, null, alter),
    );
  });
test("head, event, and receipt cannot be written independently", async () => {
  const room = path(),
    database = db();
  await assertFails(setDoc(doc(database, room), first));
  await assertFails(
    setDoc(doc(database, room, "events/c1"), {
      version: 2,
      id: "c1",
      actor: "host",
      sequence: 1,
      command: { type: "create" },
    }),
  );
  await assertFails(
    setDoc(doc(database, room, "commands/c1"), { actor: "host", sequence: 1 }),
  );
});
test("lobby joins work; only host controls progression and players control their own seats", async () => {
  const room = path();
  await seed(room);
  const guestHead = { ...first, controllers: ["host", "guest"] };
  await assertSucceeds(
    append(
      db("guest"),
      room,
      "guest",
      { type: "join", name: "Guest" },
      first,
      (d) => (d.head.controllers = guestHead.controllers),
    ),
  );
  const afterJoin = (await getDoc(doc(db(), room))).data();
  await assertFails(
    append(db("guest"), room, "guest", { type: "start" }, afterJoin),
  );
  await assertFails(
    append(db("guest"), room, "host", { type: "start" }, afterJoin),
  );
  await assertSucceeds(
    append(
      db(),
      room,
      "host",
      { type: "start" },
      afterJoin,
      (d) => (d.head.phase = "playing"),
    ),
  );
  const playing = (await getDoc(doc(db(), room))).data();
  await assertFails(
    append(
      db("guest"),
      room,
      "guest",
      { type: "mark", playerId: "host:1" },
      playing,
    ),
  );
  await assertFails(
    append(
      db("outsider"),
      room,
      "outsider",
      { type: "mark", playerId: "outsider:1" },
      playing,
    ),
  );
  await assertFails(
    append(db("outsider"), room, "outsider", { type: "join" }, playing),
  );
  await assertSucceeds(
    append(
      db("guest"),
      room,
      "guest",
      { type: "mark", playerId: "guest:2" },
      playing,
    ),
  );
});
for (const [name, alter] of [
  ["owner takeover", (d) => (d.head.owner = "guest")],
  [
    "revision gap",
    (d) => {
      d.head.revision++;
      d.event.sequence++;
      d.receipt.sequence++;
    },
  ],
  [
    "rewritten ordered history",
    (d) => (d.head.eventIds = ["replacement", d.head.lastEvent]),
  ],
  ["removed controller", (d) => (d.head.controllers = ["guest"])],
  [
    "too many controllers",
    (d) => (d.head.controllers = ["host", "a", "b", "c", "d", "e", "f"]),
  ],
])
  test(`updates reject ${name}`, async () => {
    const room = path();
    await seed(room);
    await assertFails(
      append(db(), room, "host", { type: "start" }, first, alter),
    );
  });
