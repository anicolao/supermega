import { execFileSync } from "node:child_process";
const run = (command, args, env = process.env) =>
  execFileSync(command, args, { stdio: "inherit", env });
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
run("git", ["fetch", "origin", "main"]);
const sha = git("rev-parse", "HEAD");
if (sha !== git("rev-parse", "origin/main") || git("status", "--porcelain"))
  throw Error(
    "Release only a clean, reviewed origin/main checkout after the integration PR merges.",
  );
run("npm", ["run", "build"], {
  ...process.env,
  GITHUB_SHA: sha,
  VITE_PREVIEW_ID: "main",
});
run(process.execPath, [
  "node_modules/firebase-tools/lib/bin/firebase.js",
  "deploy",
  "--only",
  "hosting",
  "--project",
  "supermega-anicolao",
  "--non-interactive",
]);
const build = await fetch(
  `https://supermega-anicolao.web.app/build.json?release=${sha}`,
).then((r) => r.json());
if (build.sha !== sha)
  throw Error(
    "The canonical site did not serve the reviewed release. Catalog unchanged.",
  );
run(process.execPath, ["scripts/register-gameroom.cjs", "--apply"]);
