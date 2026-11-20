export const GAME_ROOM_ENTRY = Object.freeze({
  Title: "Super Mega Lucky Box",
  WebURL: "https://anicolao.github.io/supermega/",
  Icon: "https://anicolao.github.io/supermega/assets/gameroom/cover.webp",
  GameroomEnabled: "integrated",
});
const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
/** Plan exactly one named application; preserve existing IDs and tabletop fields. */
export function catalogWrite(documents) {
  const matches = documents.filter(
    (d) =>
      d.name.endsWith("/supermega") ||
      normalize(d.fields.Title?.stringValue) === "supermegaluckybox" ||
      d.fields.WebURL?.stringValue === GAME_ROOM_ENTRY.WebURL,
  );
  if (matches.length > 1)
    throw Error(
      "Multiple Super Mega entries exist. Review the catalog before editing.",
    );
  const old = matches[0];
  if (
    old?.name.endsWith("/supermega") &&
    normalize(old.fields.Title?.stringValue) !== "supermegaluckybox"
  )
    throw Error("The supermega document ID belongs to another application.");
  const fields = Object.fromEntries(
    Object.entries(GAME_ROOM_ENTRY).map(([key, value]) => [
      key,
      { stringValue: value },
    ]),
  );
  if (
    old &&
    Object.entries(fields).every(
      ([key, value]) => old.fields[key]?.stringValue === value.stringValue,
    )
  )
    return null;
  return old
    ? {
        update: { name: old.name, fields },
        updateMask: { fieldPaths: Object.keys(fields) },
        currentDocument: { updateTime: old.updateTime },
      }
    : {
        update: {
          name: "projects/launcherui/databases/(default)/documents/Applications/supermega",
          fields: { ...fields, Hidden: { booleanValue: true } },
        },
        currentDocument: { exists: false },
      };
}
