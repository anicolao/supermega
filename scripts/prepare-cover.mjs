import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
const port = Number(process.env.SUPERMEGA_COVER_PORT ?? 5597),
  origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: "ignore", env: { ...process.env, PUBLIC_BASE_PATH: "/" } },
);
let browser;
try {
  for (let n = 0; ; n++) {
    if (server.exitCode !== null) throw Error("Cover renderer exited before becoming ready.");
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    if (n >= 100) throw Error("Cover renderer could not start.");
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 1,
  });
  await page.goto(origin + "/gallery/");
  await page.locator(".card-back").first().waitFor();
  await page.evaluate(async () => {
    const { cardBack } = await import("/src/components/pieces.ts");
    document.querySelector("#app").innerHTML = cardBack(
      "number",
      "gameroom-cover",
    );
    const style = document.createElement("style");
    style.textContent =
      "html,body,#app{width:768px;height:1024px;margin:0;padding:0;overflow:hidden;background:#163e32}#app{display:block}.card-back{width:768px!important;height:1024px!important;aspect-ratio:auto!important;filter:none!important}.card-back>.piece-body{width:100%;height:100%;object-fit:fill}.number-back .back-logo{font-size:122px!important;top:29%;bottom:25%}";
    document.head.append(style);
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) => image.decode().catch(() => {})),
    );
  });
  const png = await page.screenshot();
  await mkdir("public/assets/gameroom", { recursive: true });
  await writeFile("public/assets/gameroom/cover.png", png);
  await sharp(png)
    .webp({ quality: 92 })
    .toFile("public/assets/gameroom/cover.webp");
  console.log(
    "Prepared Game Room cover from the approved number-card back and shared live typography.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
