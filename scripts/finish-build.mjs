import { mkdir, copyFile, writeFile } from "node:fs/promises";
for (const route of ["gallery", "gallery/tabletop", "tabletop"]) {
  await mkdir(`dist/${route}`, { recursive: true });
  await copyFile("dist/index.html", `dist/${route}/index.html`);
}
await writeFile(
  "dist/build.json",
  JSON.stringify({
    protocol: 1,
    sha: process.env.GITHUB_SHA || "local",
    status: "PR1-playtest",
  }),
);
