import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..", "node_modules", "world-atlas", "countries-110m.json");
const dst = resolve(here, "..", "public", "geo", "countries-110m.json");

if (!existsSync(src)) {
  console.warn(`[copy-geo] source missing: ${src} — skipping.`);
  process.exit(0);
}
mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log(`[copy-geo] ${src} → ${dst}`);
