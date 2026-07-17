import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = ["apps/desktop/out/renderer", "apps/desktop/out/preload"];
const forbidden = [
  "api.github.com/repos/",
  "child_process",
  "crash_reports",
  "createCipheriv",
  "jupiter-api-key",
  "node:fs",
  "node:sqlite",
  "safeStorage",
  "signTransactionMessageWithSigners",
  "x-api-key",
];

const violations = [];
for (const root of roots) {
  for (const path of await walk(root)) {
    if (![".cjs", ".html", ".js", ".mjs"].includes(extname(path))) continue;
    const source = await readFile(path, "utf8");
    for (const marker of forbidden) {
      if (source.includes(marker)) violations.push(`${path}: forbidden marker ${marker}`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Desktop privilege bundle audit failed:\n${violations.join("\n")}`);
}
console.log("Desktop renderer/preload privilege audit passed.");

async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else paths.push(path);
  }
  return paths;
}
