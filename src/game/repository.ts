import {
  ChoiceOutbox,
  canonical,
  type Pending,
  type Publication,
} from "./outbox.ts";
import { initializeGameFirestore } from "./firestore.ts";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, connectAuthEmulator } from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  runTransaction,
  type Firestore,
} from "firebase/firestore";
import config from "../firebase-config.json";
import {
  applyEvent,
  VERSION,
  type State,
  type Command,
  type GameEvent,
} from "./engine.ts";
const scope = import.meta.env.VITE_PREVIEW_ID || "main";
let connection: Promise<{ db: Firestore; uid: string }> | undefined;
export function connect() {
  return (connection ??= (async () => {
    const emulator = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
    const app = initializeApp(
      emulator
        ? {
            apiKey: "demo-supermega-key",
            projectId: "demo-supermega",
            authDomain: "demo-supermega.firebaseapp.com",
            appId: "1:123:web:supermega",
          }
        : config,
    );
    const auth = getAuth(app);
    const db = initializeGameFirestore(app);
    if (emulator) {
      const host = import.meta.env.VITE_EMULATOR_HOST || location.hostname;
      connectAuthEmulator(
        auth,
        `http://${host}:${import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || 9297}`,
        {
          disableWarnings: true,
        },
      );
      connectFirestoreEmulator(
        db,
        host,
        Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8197),
      );
    }
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    return { db, uid: auth.currentUser!.uid };
  })().catch((error) => {
    connection = undefined;
    throw error;
  }));
}
export function repository(
  db: Firestore,
  uid: string,
  room: string,
  onEvents: (events: GameEvent[], state: State, meta: Publication) => void,
  onError: (error: Error) => void,
) {
  let closed = false;
  const root = doc(db, "previews", scope, "rooms", room),
    key = `supermega:pending:${scope}:${room}:${uid}`;
  const outbox = new ChoiceOutbox(
    uid,
    {
      read: () => localStorage.getItem(key),
      write: (value) =>
        value === null
          ? localStorage.removeItem(key)
          : localStorage.setItem(key, value),
    },
    send,
    onEvents,
  );
  const stop = onSnapshot(
    query(collection(root, "events"), orderBy("sequence")),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (closed) return;
      if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache)
        return;
      try {
        outbox.accept(snapshot.docs.map((d) => d.data() as GameEvent));
      } catch (error) {
        onError(error as Error);
      }
    },
    onError,
  );
  const epoch = (state: State) => `${state.phase}:${state.round}:${state.turn}`;
  async function send(pending: Pending) {
    let committed: GameEvent[] = [];
    for (let attempt = 0; ; attempt++) {
      let attemptedRevision = -1;
      try {
        committed = await runTransaction(db, async (transaction) => {
          const receipt = await transaction.get(
            doc(root, "commands", pending.id),
          );
          if (receipt.exists()) {
            const saved = (
              await transaction.get(doc(root, "events", pending.id))
            ).data() as GameEvent;
            if (
              saved.actor !== uid ||
              canonical(saved.command) !== canonical(pending.command)
            )
              throw Error("This action ID is already in use.");
          }
          const head = await transaction.get(root),
            revision = head.data()?.revision ?? 0;
          attemptedRevision = revision;
          const eventIds: string[] = head.data()?.eventIds ?? [];
          if (eventIds.length !== revision)
            throw Error(
              "This table uses an earlier storage format. Create a new table for this build.",
            );
          const prefix =
            outbox.history.length <= revision ? [...outbox.history] : [];
          const missing = await Promise.all(
            eventIds
              .slice(prefix.length)
              .map((id) => transaction.get(doc(root, "events", id))),
          );
          const history = [
              ...prefix,
              ...missing.map((d) => d.data() as GameEvent),
            ],
            state = outbox.rebuild(history);
          if (receipt.exists()) return history;
          if (epoch(state) !== pending.epoch)
            throw Error(
              "The table advanced. Choose again from the latest number.",
            );
          const command = pending.command;
          if (
            "playerId" in command &&
            canonical(state.players.find((p) => p.id === command.playerId)) !==
              pending.player
          )
            throw Error("Your seat changed in another window. Choose again.");
          const event: GameEvent = {
            version: VERSION,
            id: pending.id,
            actor: uid,
            sequence: revision + 1,
            command: pending.command,
          };
          const next = applyEvent(state, event);
          // Unique event IDs avoid collisions between independent players. The
          // head's append-only ID list gives every event a stable ordered position.
          const destination = doc(root, "events", event.id);
          if ((await transaction.get(destination)).exists())
            throw Error("The event head is inconsistent. Reload this table.");
          transaction.set(root, {
            owner: next.owner,
            controllers: [
              ...new Set([
                next.owner,
                ...next.players.map((p) => p.controller),
              ]),
            ],
            revision: event.sequence,
            phase: next.phase,
            lastEvent: event.id,
            eventIds: [...eventIds, event.id],
          });
          transaction.set(destination, event);
          transaction.set(doc(root, "commands", pending.id), {
            actor: uid,
            sequence: event.sequence,
          });
          return [...history, event];
        });
        break;
      } catch (error) {
        // Firestore can reject a stale atomic write against append-only rules
        // before returning an aborted transaction. Retry only when a fresh
        // server read proves another action advanced the head. Seat and epoch
        // guards still validate the unchanged intent on every attempt.
        if (
          (error as { code?: string }).code !== "permission-denied" ||
          attempt >= 4 ||
          attemptedRevision < 0
        )
          throw error;
        const fresh = await getDoc(root);
        if ((fresh.data()?.revision ?? 0) <= attemptedRevision) throw error;
      }
    }
    return committed;
  }
  return {
    close() {
      closed = true;
      stop();
      outbox.close();
    },
    hasPending: () => outbox.hasPending(),
    needsRetry: () => outbox.needsRetry(),
    append: (command: Command) => outbox.append(command),
    retry: () => outbox.retry(),
  };
}
