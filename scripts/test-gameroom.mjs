import { spawn } from "node:child_process";
const env = { ...process.env };
const child = spawn(
  process.execPath,
  [
    "node_modules/firebase-tools/lib/bin/firebase.js",
    "emulators:exec",
    "--project",
    "demo-supermega",
    "--config",
    "firebase.gameroom-test.json",
    "--only",
    "auth,firestore",
    "node tests/integration/gameroom.mjs",
  ],
  { env, stdio: "inherit" },
);
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => (process.exitCode = code ?? 1));
