#!/usr/bin/env node
// Prebuild step (wired as npm's "prebuild" script, so it runs automatically
// before `npm run build`/`next build`). Ensures data/app.db exists before the
// build starts so next.config.ts's outputFileTracingIncludes can bundle it
// into the deployed function as a static, read-only asset.
//
// This replaces downloading it at *runtime* on every cold start (the
// previous design), which burns through Vercel Blob's free data-transfer
// allowance fast — a build happens once per deploy, a cold start can happen
// many times an hour.
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

async function main() {
  if (fs.existsSync(DB_PATH)) {
    console.log(`${DB_PATH} already present, skipping fetch.`);
    return;
  }

  const url = process.env.DB_BLOB_URL;
  if (!url) {
    console.log("DB_BLOB_URL not set and data/app.db is missing — nothing to fetch (fine for a fresh local clone; run `npm run setup` instead).");
    return;
  }

  console.log("fetching database from Blob for build...");
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to fetch database from Blob: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(DB_PATH, buf);
  console.log(`saved ${DB_PATH} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
