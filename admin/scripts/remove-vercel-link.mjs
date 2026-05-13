#!/usr/bin/env node
/**
 * Drops local `admin/.vercel` so next `vercel link` prompts for Team + project.
 * `.vercel` is gitignored; this only affects your machine clone.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", ".vercel");

if (fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("Removed admin/.vercel");
} else {
  console.log("No admin/.vercel folder (nothing to remove)");
}

console.log("Next (from admin/):\n  npx vercel@latest link\n  npx vercel@latest deploy --prod --yes");
