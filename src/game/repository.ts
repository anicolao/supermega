import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
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
  replay,
  VERSION,
  type State,
  type Command,
  type GameEvent,
} from "./engine.ts";
const scope = import.meta.env.VITE_PREVIEW_ID || "main";
let connection: Promise<{ db: Firestore; uid: string }> | undefined;
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
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
    const db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
    if (emulator) {
      const host = import.meta.env.VITE_EMULATOR_HOST || location.hostname;
      connectAuthEmulator(auth, `http://${host}:9297`, {
        disableWarnings: true,
      });
      connectFirestoreEmulator(db, host, 8197);
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
  onEvents: (events: GameEvent[], state: State) => void,
  onError: (error: Error) => void,
) {
  let events: GameEvent[] = [],
    closed = false;
  const root = doc(db, "previews", scope, "rooms", room),
    key = `supermega:pending:${scope}:${room}:${uid}`;
  const update = (history: GameEvent[]) => {
    const state = replay(history);
    if (!closed && history.length >= events.length) {
      events = history;
      onEvents(history, state);
    }
  };
  const stop = onSnapshot(
    query(collection(root, "events"), orderBy("sequence")),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache)
        return;
      try {
        update(snapshot.docs.map((d) => d.data() as GameEvent));
      } catch (error) {
        onError(error as Error);
      }
    },
    onError,
  );
  type Pending = {
    id: string;
    command: Command;
    epoch: string;
    player: string | null;
  };
  const epoch = (state: State) => `${state.phase}:${state.round}:${state.turn}`;
  async function send(pending: Pending) {
    let committed: GameEvent[] | null = null;
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
            return null;
          }
          const head = await transaction.get(root),
            revision = head.data()?.revision ?? 0;
          attemptedRevision = revision;
          const eventIds: string[] = head.data()?.eventIds ?? [];
          if (eventIds.length !== revision)
            throw Error(
              "This table uses an earlier storage format. Create a new table for this build.",
            );
          const prefix = events.length <= revision ? [...events] : [];
          const missing = await Promise.all(
            eventIds
              .slice(prefix.length)
              .map((id) => transaction.get(doc(root, "events", id))),
          );
          const history = [
              ...prefix,
              ...missing.map((d) => d.data() as GameEvent),
            ],
            state = replay(history);
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
          const next = replay([...history, event]);
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
    localStorage.removeItem(key);
    if (committed) update(committed);
  }
  return {
    close() {
      closed = true;
      stop();
    },
    hasPending() {
      return !!localStorage.getItem(key);
    },
    async append(command: Command) {
      if (localStorage.getItem(key))
        throw Error("Retry the pending action before choosing another.");
      const state = replay(events),
        pending: Pending = {
          id: crypto.randomUUID(),
          command,
          epoch: epoch(state),
          player:
            "playerId" in command
              ? canonical(state.players.find((p) => p.id === command.playerId))
              : null,
        };
      replay([
        ...events,
        {
          version: VERSION,
          id: pending.id,
          actor: uid,
          sequence: events.length + 1,
          command,
        },
      ]);
      localStorage.setItem(key, JSON.stringify(pending));
      try {
        await send(pending);
      } catch (error) {
        if (
          !(error as { code?: string }).code ||
          ["permission-denied", "unauthenticated", "invalid-argument"].includes(
            (error as { code: string }).code,
          )
        )
          localStorage.removeItem(key);
        throw error;
      }
    },
    async retry() {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          await send(JSON.parse(saved));
        } catch (error) {
          if (
            !(error as { code?: string }).code ||
            [
              "permission-denied",
              "unauthenticated",
              "invalid-argument",
            ].includes((error as { code: string }).code)
          )
            localStorage.removeItem(key);
          throw error;
        }
      }
    },
  };
}
