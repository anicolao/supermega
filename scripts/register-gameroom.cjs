// Dry-run by default. Only the named Super Mega application can be written.
const { writeFileSync, mkdirSync } = require("node:fs");
const auth = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");
(async () => {
  const { catalogWrite, GAME_ROOM_ENTRY } =
    await import("./gameroom-catalog.mjs");
  const account = auth.getGlobalDefaultAccount();
  await requireAuth({ project: "launcherui", ...account });
  const { access_token } = await auth.getAccessToken(
    account.tokens.refresh_token,
    [],
  );
  const headers = {
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "application/json",
  };
  const base =
    "https://firestore.googleapis.com/v1/projects/launcherui/databases/(default)/documents";
  const documents = [];
  let token = "";
  do {
    const response = await fetch(
      `${base}/Applications?pageSize=1000${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`,
      { headers },
    );
    if (!response.ok) throw Error(`Catalog read failed: ${response.status}`);
    const page = await response.json();
    documents.push(...(page.documents ?? []));
    token = page.nextPageToken ?? "";
  } while (token);
  const write = catalogWrite(documents);
  if (!write) {
    console.log("Super Mega is already integrated. No catalog changes.");
    return;
  }
  console.log(JSON.stringify(write, null, 2));
  if (!process.argv.includes("--apply")) {
    console.log(
      "Dry run: one targeted application change. No production data was modified.",
    );
    return;
  }
  const manifest = await fetch(
    new URL("gameroom-launch.json", GAME_ROOM_ENTRY.WebURL),
  );
  const contract = await manifest.json();
  if (
    !manifest.ok ||
    contract.game !== "supermega" ||
    contract.protocol !== "gameroom-url" ||
    contract.version !== 1
  )
    throw Error(
      "Deploy the reviewed create/join adapter before enabling the shelf entry.",
    );
  const cover = await fetch(GAME_ROOM_ENTRY.Icon);
  if (
    !cover.ok ||
    !cover.headers.get("content-type")?.startsWith("image/") ||
    cover.headers.get("access-control-allow-origin") !== "*"
  )
    throw Error("The production shelf cover must load with public image CORS.");
  const old = documents.find((d) => d.name === write.update.name) ?? null;
  mkdirSync(".firebase", { recursive: true });
  const backup = `.firebase/supermega-catalog-before-${Date.now()}.json`;
  writeFileSync(backup, JSON.stringify(old, null, 2), { mode: 0o600 });
  const response = await fetch(`${base}:commit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ writes: [write] }),
  });
  if (!response.ok)
    throw Error(
      `Catalog write failed (${response.status}): ${await response.text()}`,
    );
  console.log(
    `Integrated Super Mega Lucky Box. Previous target record: ${backup}`,
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
