import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:https";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { chromium, expect as baseExpect } from "@playwright/test";
import { StepInventory, identifyPng } from "@anicolao/e2e";
import { writeViewer } from "@anicolao/e2e/viewer";
const expect = baseExpect.configure({ timeout: 30000 });
const root = process.cwd(),
  gameroom = resolve(process.env.GAMEROOM_PATH ?? "../gameroom");
const firestore = "127.0.0.1:8797",
  auth = "127.0.0.1:9797",
  gameBase = "/supermega/prtest/",
  game = "https://localhost:6127" + gameBase,
  roomOrigin = "http://127.0.0.1:6129";
if (
  process.env.FIRESTORE_EMULATOR_HOST !== firestore ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== auth
)
  throw Error("These tests require their dedicated local demo emulators.");
const children = [];
let server, browser;
const output = resolve(".firebase/gameroom-review");
await mkdir(output, { recursive: true });
await mkdir(join(output, "walkthroughs"), { recursive: true });
await writeViewer(output, { title: "Super Mega · Game Room launch review" });
await writeFile(join(output, "walkthroughs/index.json"), "[]\n");
const inventory = new StepInventory([
  "guest-before-host",
  "reopen",
  "shelf",
  "group-launch",
  "continued-chat",
  "recurring-launch",
]);
const evidence = [];
const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: "inherit", ...options });
const start = (command, args, options = {}) => {
  const child = spawn(command, args, { stdio: "pipe", ...options });
  children.push(child);
  child.stdout.on("data", () => {});
  child.stderr.on("data", (data) => {
    if (String(data).includes("Error")) process.stderr.write(data);
  });
  return child;
};
async function wait(url, child) {
  for (let n = 0; n < 160; n++) {
    if (child?.exitCode !== null && child?.exitCode !== undefined)
      throw Error(`Server exited before becoming ready: ${url}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(`Server not ready: ${url}`);
}
async function rules(project, content) {
  const response = await fetch(
    `http://${firestore}/emulator/v1/projects/${project}:securityRules`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: { files: [{ name: "firestore.rules", content }] },
      }),
    },
  );
  if (!response.ok) throw Error(`Rules setup failed: ${await response.text()}`);
}
async function capture(step, pages) {
  inventory.record(step);
  for (const [actor, page] of pages) {
    await page.evaluate(() => document.fonts.ready);
    const bytes = await page.screenshot();
    const filename = `${step}-${actor}.png`;
    await writeFile(join(output, filename), bytes);
    evidence.push({ step, actor, filename, image: identifyPng(bytes) });
  }
}
const gameEnv = {
  ...process.env,
  VITE_USE_FIREBASE_EMULATORS: "true",
  VITE_EMULATOR_HOST: "127.0.0.1",
  VITE_FIREBASE_AUTH_EMULATOR_PORT: "9797",
  VITE_FIRESTORE_EMULATOR_PORT: "8797",
  VITE_PREVIEW_ID: "gameroom-test",
  PUBLIC_BASE_PATH: gameBase,
};
const roomEnv = {
  ...process.env,
  VITE_FIREBASE_PROJECT_ID: "demo-supermega-room",
  VITE_FIREBASE_API_KEY: "fake-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "demo-supermega-room.firebaseapp.com",
  VITE_FIREBASE_APP_ID: "demo-room-app",
  VITE_USE_FIREBASE_EMULATORS: "true",
  VITE_EMULATOR_HOST: "127.0.0.1",
  VITE_FIREBASE_AUTH_EMULATOR_PORT: "9797",
  VITE_FIRESTORE_EMULATOR_PORT: "8797",
  VITE_CATALOGUE_FIREBASE_PROJECT_ID: "demo-supermega-catalog",
  VITE_CATALOGUE_FIREBASE_API_KEY: "fake-api-key",
  VITE_CATALOGUE_FIREBASE_AUTH_DOMAIN: "demo-supermega-catalog.firebaseapp.com",
  VITE_CATALOGUE_FIREBASE_APP_ID: "demo-catalog-app",
  VITE_CATALOGUE_USE_FIREBASE_EMULATORS: "true",
  VITE_CATALOGUE_ASSET_ORIGIN: roomOrigin + "/",
  PUBLIC_BASE_PATH: "/",
};
async function inGame(context, roomPage) {
  await expect(roomPage.getByTestId("game-tab-status")).toBeVisible();
  const page = context.pages().find((p) => p !== roomPage);
  if (page) {
    await page.waitForURL(/localhost:6127/);
    return page;
  }
  await expect(
    roomPage.getByRole("button", {
      name: "Open Super Mega Lucky Box",
      exact: true,
    }),
  ).toBeVisible();
  const popup = context.waitForEvent("page");
  await roomPage
    .getByRole("button", { name: "Open Super Mega Lucky Box", exact: true })
    .click();
  return await popup;
}
try {
  await rules("demo-supermega", await readFile("firestore.rules", "utf8"));
  await rules(
    "demo-supermega-room",
    await readFile(join(gameroom, "firestore.rules"), "utf8"),
  );
  await rules(
    "demo-supermega-catalog",
    "rules_version = '2'; service cloud.firestore {match /databases/{database}/documents {match /Applications/{id} {allow read: if request.auth != null;allow write: if false;}}}",
  );
  const catalog = await fetch(
    `http://${firestore}/v1/projects/demo-supermega-catalog/databases/(default)/documents/Applications/supermega`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          Title: { stringValue: "Super Mega Lucky Box" },
          WebURL: { stringValue: game },
          Icon: { stringValue: game + "assets/gameroom/cover.webp" },
          GameroomEnabled: { stringValue: "integrated" },
          Hidden: { booleanValue: true },
        },
      }),
    },
  );
  assert.equal(catalog.ok, true);
  run(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "build",
      "--outDir",
      ".firebase/gameroom-build",
    ],
    { env: gameEnv },
  );
  const tls = resolve(".firebase/gameroom-tls");
  await mkdir(tls, { recursive: true });
  const certificate = join(tls, "certificate.pem"),
    key = join(tls, "key.pem");
  run("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    key,
    "-out",
    certificate,
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost",
  ]);
  const distribution = resolve(".firebase/gameroom-build");
  const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webp": "image/webp",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
  };
  server = createServer(
    { key: await readFile(key), cert: await readFile(certificate) },
    async (req, res) => {
      try {
        const pathname = decodeURIComponent(
          new URL(req.url, "https://localhost").pathname,
        );
        if (!pathname.startsWith(gameBase)) { res.writeHead(404); res.end(); return; }
        const requested = "/" + pathname.slice(gameBase.length);
        let path = resolve(distribution, "." + requested);
        if (!path.startsWith(distribution + "/") && path !== distribution)
          throw Error("Invalid path");
        let data;
        try {
          if (requested.endsWith("/")) path = join(path, "index.html");
          data = await readFile(path);
        } catch {
          path = join(distribution, "index.html");
          data = await readFile(path);
        }
        res.writeHead(200, {
          "Content-Type": mime[extname(path)] ?? "application/octet-stream",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end();
      }
    },
  );
  await new Promise((r) => server.listen(6127, "localhost", r));
  const roomServer = start(
    "bun",
    ["x", "vite", "--host", "127.0.0.1", "--port", "6129", "--strictPort"],
    { cwd: gameroom, env: roomEnv },
  );
  await wait(roomOrigin, roomServer);
  browser = await chromium.launch({
    ignoreDefaultArgs: ["--disable-popup-blocking"],
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader-webgl",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
    ],
  });
  const host = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1180, height: 820 },
      deviceScaleFactor: 1,
    }),
    guest = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1180, height: 820 },
      deviceScaleFactor: 1,
    });
  const hg = await host.newPage(),
    gg = await guest.newPage();
  const table = "0A10B203";
  await gg.goto(`${game}?launch=join&table=${table}&name=Alex`);
  await expect(
    gg.getByRole("heading", { name: "Waiting for your friends…" }),
  ).toBeVisible();
  const empty = await fetch(
    `http://${firestore}/v1/projects/demo-supermega/databases/(default)/documents/previews/gameroom-test/rooms/${table}`,
    { headers: { Authorization: "Bearer owner" } },
  );
  assert.equal(empty.status, 404);
  await hg.goto(`${game}?launch=create&table=${table}&name=Alex`);
  await expect(hg.locator(".lobby-seat")).toHaveCount(2);
  await expect(gg.locator(".lobby-seat")).toHaveCount(2);
  await expect(hg.getByText("Your seat", { exact: true })).toHaveCount(1);
  await expect(gg.getByText("Your seat", { exact: true })).toHaveCount(1);
  await capture("guest-before-host", [
    ["host", hg],
    ["guest", gg],
  ]);
  const before = await hg
    .locator("[data-revision]")
    .getAttribute("data-revision");
  await hg.goto(`${game}?launch=create&table=${table}&name=Changed`);
  await gg.reload();
  await expect(hg.locator("[data-revision]")).toHaveAttribute(
    "data-revision",
    before,
  );
  await expect(hg.locator(".lobby-seat b")).toHaveText(["Alex", "Alex"]);
  await expect(gg.locator(".lobby-seat")).toHaveCount(2);
  await capture("reopen", [
    ["host", hg],
    ["guest", gg],
  ]);
  await hg.close();
  await gg.close();
  const hr = await host.newPage(),
    gr = await guest.newPage();
  await hr.goto(roomOrigin);
  await hr.getByLabel("Your name", { exact: true }).fill("Alex");
  await hr.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(hr.getByTestId("friend")).toHaveCount(1);
  await gr.goto(hr.url());
  await gr.getByLabel("Your name", { exact: true }).fill("Alex");
  await gr.getByRole("button", { name: "Join room", exact: true }).click();
  await expect(hr.getByTestId("friend")).toHaveCount(2);
  await expect(gr.getByTestId("friend")).toHaveCount(2);
  await expect(
    hr.getByRole("button", {
      name: "Select Super Mega Lucky Box",
      exact: true,
    }),
  ).toBeVisible();
  await expect(hr.getByTestId("cabinet")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 120000 },
  );
  const cabinet = hr.getByTestId("cabinet");
  const targets = JSON.parse(await cabinet.getAttribute("data-targets"));
  const bounds = await cabinet.locator("canvas").boundingBox();
  await hr.mouse.click(
    bounds.x + targets.supermega.x,
    bounds.y + targets.supermega.y,
  );
  await expect(
    hr.getByRole("heading", { name: "Super Mega Lucky Box", exact: true }),
  ).toBeVisible();
  const cover = await hr.request.get(game + "assets/gameroom/cover.webp");
  assert.equal(cover.headers()["access-control-allow-origin"], "*");
  await capture("shelf", [
    ["host", hr],
    ["guest", gr],
  ]);
  const popup = host.waitForEvent("page");
  await hr
    .getByRole("button", { name: "Play Super Mega Lucky Box", exact: true })
    .click();
  const hostGame = await popup;
  await hostGame.waitForURL(/localhost:6127/);
  const guestGame = await inGame(guest, gr);
  await expect(hostGame.locator(".lobby-seat")).toHaveCount(2);
  await expect(guestGame.locator(".lobby-seat")).toHaveCount(2);
  assert.equal(await hostGame.evaluate(() => window.opener), null);
  assert.equal(await guestGame.evaluate(() => window.opener), null);
  await expect(hostGame.getByText("Your seat", { exact: true })).toHaveCount(1);
  await expect(guestGame.getByText("Your seat", { exact: true })).toHaveCount(
    1,
  );
  assert.equal(host.pages().length, 2);
  assert.equal(guest.pages().length, 2);
  const firstCode = await hostGame
    .locator("[data-room]")
    .getAttribute("data-room");
  assert.equal(
    await guestGame.locator("[data-room]").getAttribute("data-room"),
    firstCode,
  );
  await capture("group-launch", [
    ["host", hostGame],
    ["guest", guestGame],
    ["room", hr],
  ]);
  await hr
    .getByRole("button", { name: "Room conversation", exact: true })
    .click();
  await hr
    .getByRole("textbox", { name: /message/i })
    .fill("Our room stays open.");
  await hr.getByRole("button", { name: "Send message", exact: true }).click();
  await gr
    .getByRole("button", { name: "Room conversation", exact: true })
    .click();
  await expect(
    gr.getByText("Our room stays open.", { exact: true }),
  ).toBeVisible();
  await capture("continued-chat", [
    ["host", hr],
    ["guest", gr],
  ]);
  await hostGame.close();
  await guestGame.close();
  await hr.reload();
  await expect(
    hr.getByRole("button", { name: "Open Super Mega Lucky Box", exact: true }),
  ).toBeVisible();
  assert.equal(host.pages().length, 1);
  await hr.getByRole("button", { name: "Close table", exact: true }).click();
  await expect(
    hr.getByRole("button", { name: "Play Super Mega Lucky Box", exact: true }),
  ).toBeVisible();
  await expect(
    gr.getByRole("button", { name: "Play Super Mega Lucky Box", exact: true }),
  ).toBeVisible();
  const nextPopup = host.waitForEvent("page");
  await hr
    .getByRole("button", { name: "Play Super Mega Lucky Box", exact: true })
    .click();
  const nextHost = await nextPopup,
    nextGuest = await inGame(guest, gr);
  await expect(nextHost.locator(".lobby-seat")).toHaveCount(2);
  await expect(nextGuest.locator(".lobby-seat")).toHaveCount(2);
  const nextCode = await nextHost
    .locator("[data-room]")
    .getAttribute("data-room");
  assert.notEqual(nextCode, firstCode);
  assert.equal(
    await nextGuest.locator("[data-room]").getAttribute("data-room"),
    nextCode,
  );
  await capture("recurring-launch", [
    ["host", nextHost],
    ["guest", nextGuest],
  ]);
  inventory.finish();
  await writeFile(
    join(output, "evidence.json"),
    JSON.stringify(evidence, null, 2),
  );
  await writeFile(
    join(output, "walkthroughs/launch.json"),
    JSON.stringify(
      {
        id: "gameroom-launch",
        title: "Shelf, friends, and recurring launches",
        platform: "Desktop · independent profiles",
        steps: [...new Set(evidence.map((item) => item.step))].map(
          (step, index) => ({
            number: index + 1,
            description: step.replaceAll("-", " "),
            status: "captured",
            assertions: [
              "Functional assertions passed; screenshots await visual review.",
            ],
            views: evidence
              .filter((item) => item.step === step)
              .map((item) => ({
                name: item.actor,
                image: item.filename,
              })),
          }),
        ),
      },
      null,
      2,
    ),
  );
  await writeFile(
    join(output, "walkthroughs/index.json"),
    JSON.stringify([
      {
        title: "Game Room launch integration",
        manifest: "walkthroughs/launch.json",
        platform: "Desktop",
      },
    ]),
  );
  console.log(
    `Verified Game Room shelf and launches. ${evidence.length} captures identified by @anicolao/e2e; no baselines created.`,
  );
} finally {
  await browser?.close();
  for (const child of children) child.kill("SIGTERM");
  if (server) await new Promise((r) => server.close(r));
}
