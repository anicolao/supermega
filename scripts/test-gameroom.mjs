import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
const env = { ...process.env };
if (!env.JAVA_HOME && process.platform === "darwin" && existsSync("/nix/store"))
  for (const name of readdirSync("/nix/store").filter((n) =>
    n.includes("jdk-21"),
  )) {
    const candidate = "/nix/store/" + name;
    if (existsSync(candidate + "/bin/java")) {
      env.JAVA_HOME = candidate;
      break;
    }
  }
if (env.JAVA_HOME) env.PATH = `${env.JAVA_HOME}/bin:${env.PATH}`;
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
child.on("exit", (code) => (process.exitCode = code ?? 1));
