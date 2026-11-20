import { mkdir, copyFile, writeFile } from "node:fs/promises";
await writeFile("dist/.nojekyll", "");
await copyFile("dist/index.html", "dist/404.html");
for (const route of ["gallery", "gallery/tabletop", "tabletop"]) {
  await mkdir(`dist/${route}`, { recursive: true });
  await copyFile("dist/index.html", `dist/${route}/index.html`);
}
await writeFile(
  "dist/build.json",
  JSON.stringify({
    protocol: 2,
    sha: process.env.VITE_BUILD_SHA || process.env.GITHUB_SHA || "local",
    base: process.env.PUBLIC_BASE_PATH || "/",
    scope: process.env.VITE_PREVIEW_ID || "main",
  }),
);
