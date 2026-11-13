import { writeViewer } from "@anicolao/e2e/viewer";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const directory = process.argv[2] || "public/review";
await writeViewer(directory, {
  title: "Super Mega Lucky Box · Walkthroughs",
  emptyMessage:
    "The initial game is awaiting its first playtest. End-to-end stories, screenshot baselines, and validation will be added after that review.",
});
await mkdir(join(directory, "walkthroughs"), { recursive: true });
await writeFile(join(directory, "walkthroughs/index.json"), "[]\n");
