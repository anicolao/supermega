import type { Command, State } from "./engine.ts";

export type GameRoomLaunch = {
  mode: "create" | "join";
  table: string;
  name: string;
};
export const validTableCode = (code: string) => /^[A-Z0-9]{8}$/.test(code);

/** Launch fields are preferences. Only this game's Firebase UID owns a seat. */
export function readLaunch(search: string): GameRoomLaunch | null {
  const params = new URLSearchParams(search),
    mode = params.get("launch");
  if (mode === null) return null;
  if (mode !== "create" && mode !== "join")
    throw Error("This invitation needs a create or join instruction.");
  const table = (params.get("table") ?? "").toUpperCase(),
    name = (params.get("name") ?? "").trim();
  if (!validTableCode(table) || !name || name.length > 24)
    throw Error(
      "This invitation needs an eight-character table code and a name of up to 24 characters.",
    );
  return { mode, table, name };
}

export function readReturnTo(search: string): string | null {
  const value = new URLSearchParams(search).get("returnTo");
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function launchCommand(
  launch: GameRoomLaunch,
  state: State,
  uid: string,
  seed: string,
): Command | null {
  const seated = state.players.some((p) => p.controller === uid);
  if (launch.mode === "create") {
    if (state.revision) {
      if (state.owner !== uid)
        throw Error(
          "This table already exists. Start a fresh table in Game Room.",
        );
      if (seated) return null;
      throw Error(
        "Your original seat could not be found. Reopen the game in your original browser profile.",
      );
    }
    return {
      type: "create",
      mode: "web",
      capacity: 6,
      name: launch.name,
      seed,
    };
  }
  // Guests subscribe and wait; arriving first must never make a guest the host.
  if (!state.revision || seated) return null;
  if (state.phase !== "lobby")
    throw Error(
      "This game has already started. Ask your friends to launch another table.",
    );
  if (state.players.length >= state.capacity)
    throw Error("This table is full.");
  return { type: "join", name: launch.name };
}
