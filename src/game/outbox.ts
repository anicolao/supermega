import {
  applyEvent,
  initial,
  replay,
  VERSION,
  type Command,
  type GameEvent,
  type State,
} from "./engine.ts";
export type Pending = {
  id: string;
  command: Command;
  epoch: string;
  player: string | null;
};
export type Publication = {
  pending: boolean;
  localChoice?: Command;
  rollback?: boolean;
  acknowledged?: string[];
};
export const immediateChoice = (command: Command) =>
  ["mark", "bonus", "undo", "finish", "choose"].includes(command.type);
const epoch = (s: State) => `${s.phase}:${s.round}:${s.turn}`;
export const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
const fingerprint = (s: State, c: Command) =>
  "playerId" in c
    ? canonical(s.players.find((p) => p.id === c.playerId))
    : null;
const uncertain = (error: unknown) => {
  const code = (error as { code?: string }).code;
  return (
    !!code &&
    !["permission-denied", "unauthenticated", "invalid-argument"].includes(code)
  );
};
/** Durable decisions, immediate presentation, and one ordered authoritative writer. */
export class ChoiceOutbox {
  history: GameEvent[] = [];
  private confirmed: State = initial();
  private queue: Pending[];
  private stalled: boolean;
  private running = false;
  private closed = false;
  private presented = new Set<string>();
  private handlers = new Map<
    string,
    { resolve: () => void; reject: (error: unknown) => void }[]
  >();
  private uid: string;
  private storage: { read(): string | null; write(value: string | null): void };
  private commit: (pending: Pending) => Promise<GameEvent[]>;
  private publish: (
    events: GameEvent[],
    shown: State,
    meta: Publication,
  ) => void;
  constructor(
    uid: string,
    storage: { read(): string | null; write(value: string | null): void },
    commit: (pending: Pending) => Promise<GameEvent[]>,
    publish: (events: GameEvent[], shown: State, meta: Publication) => void,
  ) {
    this.uid = uid;
    this.storage = storage;
    this.commit = commit;
    this.publish = publish;
    const saved = storage.read();
    const parsed = saved ? JSON.parse(saved) : [];
    this.queue = Array.isArray(parsed) ? parsed : [parsed];
    this.stalled = this.queue.length > 0;
  }
  private save() {
    this.storage.write(this.queue.length ? JSON.stringify(this.queue) : null);
  }
  hasPending() {
    return this.queue.length > 0;
  }
  needsRetry() {
    return this.stalled && this.hasPending();
  }
  /** Reuse the validated immutable prefix; never replay a whole game on a tap. */
  rebuild(history: GameEvent[]): State {
    if (new Set(history.map((e) => e.id)).size !== history.length)
      throw Error("Duplicate event identity.");
    const extendsPrefix =
      history.length >= this.history.length &&
      this.history.every(
        (e, i) => e === history[i] || canonical(e) === canonical(history[i]),
      );
    return extendsPrefix
      ? history.slice(this.history.length).reduce(applyEvent, this.confirmed)
      : replay(history);
  }
  private projection() {
    let s = this.confirmed;
    if (this.stalled) return s;
    for (const p of this.queue) {
      if (epoch(s) !== p.epoch || fingerprint(s, p.command) !== p.player)
        throw Error(
          "The table changed. Your unconfirmed choices were restored; choose again.",
        );
      const next = applyEvent(s, {
        version: VERSION,
        id: p.id,
        actor: this.uid,
        sequence: s.revision + 1,
        command: p.command,
      });
      if (immediateChoice(p.command)) s = next;
    }
    return s;
  }
  private display(
    localChoice?: Command,
    rollback = false,
    acknowledged: string[] = [],
  ) {
    const shown = rollback ? this.confirmed : this.projection();
    if (!rollback && !this.stalled)
      for (const p of this.queue)
        if (immediateChoice(p.command)) this.presented.add(p.id);
    if (!this.closed)
      this.publish(this.history, shown, {
        pending: this.hasPending(),
        localChoice,
        rollback,
        acknowledged,
      });
  }
  accept(history: GameEvent[]) {
    if (this.closed || history.length < this.history.length) return;
    const confirmed = this.rebuild(history);
    this.history = history;
    this.confirmed = confirmed;
    const ids = new Set(history.map((e) => e.id));
    const collision = this.queue.find((p) =>
      history.some(
        (e) =>
          e.id === p.id &&
          (e.actor !== this.uid ||
            canonical(e.command) !== canonical(p.command)),
      ),
    );
    if (collision) {
      this.fail(Error("This action ID is already in use."), false);
      return;
    }
    const acknowledged = this.queue.filter((p) => ids.has(p.id));
    this.queue = this.queue.filter((p) => !ids.has(p.id));
    if (!this.queue.length) this.stalled = false;
    this.save();
    const presented = acknowledged
      .filter((p) => this.presented.has(p.id))
      .map((p) => p.id);
    for (const p of acknowledged) this.presented.delete(p.id);
    for (const p of acknowledged) {
      for (const handler of this.handlers.get(p.id) ?? []) handler.resolve();
      this.handlers.delete(p.id);
    }
    try {
      this.display(undefined, false, presented);
    } catch (error) {
      this.fail(error, false);
    }
  }
  append(command: Command, id = crypto.randomUUID()): Promise<void> {
    if (this.closed) return Promise.reject(Error("This table is closed."));
    if (this.stalled)
      return Promise.reject(
        Error("Retry the pending choices before choosing another."),
      );
    const previousLength = this.queue.length;
    command = structuredClone(command);
    try {
      if (this.history.some((e) => e.id === id))
        throw Error("This action ID is already in use.");
      const s = this.projection();
      applyEvent(s, {
        version: VERSION,
        id,
        actor: this.uid,
        sequence: s.revision + 1,
        command,
      });
      const pending = {
        id,
        command,
        epoch: epoch(s),
        player: fingerprint(s, command),
      };
      this.queue.push(pending);
      this.save();
      const done = this.wait(id);
      this.display(immediateChoice(command) ? command : undefined);
      void this.drain();
      return done;
    } catch (error) {
      this.queue.splice(previousLength);
      return Promise.reject(error);
    }
  }
  private wait(id: string) {
    return new Promise<void>((resolve, reject) => {
      const handlers = this.handlers.get(id) ?? [];
      handlers.push({ resolve, reject });
      this.handlers.set(id, handlers);
    });
  }
  private fail(error: unknown, keep: boolean) {
    for (const handlers of this.handlers.values())
      for (const h of handlers) h.reject(error);
    this.handlers.clear();
    this.presented.clear();
    if (!keep) this.queue = [];
    this.stalled = keep;
    this.save();
    this.display(undefined, true);
  }
  private async drain() {
    if (this.running || this.closed || this.stalled) return;
    this.running = true;
    try {
      while (this.queue.length && !this.stalled && !this.closed) {
        const item = this.queue[0];
        try {
          const history = await this.commit(item);
          this.accept(history);
          if (!this.closed && this.queue.some((p) => p.id === item.id))
            throw Error("The server did not acknowledge this choice.");
        } catch (error) {
          if (
            this.history.some(
              (e) =>
                e.id === item.id &&
                e.actor === this.uid &&
                canonical(e.command) === canonical(item.command),
            )
          )
            continue;
          this.fail(error, uncertain(error));
          break;
        }
      }
    } finally {
      this.running = false;
    }
  }
  retry(): Promise<void> {
    if (!this.queue.length) return Promise.resolve();
    this.stalled = false;
    try {
      this.display();
    } catch (error) {
      this.fail(error, false);
      return Promise.reject(error);
    }
    const done = this.wait(this.queue.at(-1)!.id);
    void this.drain();
    return done;
  }
  close() {
    this.closed = true;
    for (const handlers of this.handlers.values())
      for (const h of handlers) h.reject(Error("This table is closed."));
    this.handlers.clear();
  }
}
