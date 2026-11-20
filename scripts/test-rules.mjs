import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  [
    "node_modules/firebase-tools/lib/bin/firebase.js",
    "emulators:exec",
    "--project",
    "demo-supermega-rules",
    "--config",
    "firebase.rules-test.json",
    "--only",
    "firestore",
    "node --test tests/rules/*.test.mjs",
  ],
  { stdio: "inherit" },
);
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => (process.exitCode = code ?? 1));
