#!/usr/bin/env -S npx tsx
// Uploads the built data/app.db (dictionary + article archive) to Vercel Blob
// so the deployed app (read-only filesystem) can download it once per cold
// start — see src/instrumentation.ts. Re-run this any time `npm run scrape`/
// `backfill`/`build:dict` produce fresh data; the fixed pathname + overwrite
// means the URL (and therefore DB_BLOB_URL) never changes.
import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  // .env.local not present — fine if BLOB_READ_WRITE_TOKEN is already in the environment.
}

const DB_PATH = path.join(process.cwd(), "data", "app.db");

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Run `vercel env pull .env.local --environment production` first."
    );
  }
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`${DB_PATH} does not exist — run \`npm run setup\` first.`);
  }

  const size = fs.statSync(DB_PATH).size;
  console.log(`uploading ${DB_PATH} (${(size / 1024 / 1024).toFixed(1)} MB)...`);

  const blob = await put("app.db", fs.createReadStream(DB_PATH), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/x-sqlite3",
  });

  console.log(`done: ${blob.url}`);
  console.log(`\nIf this is the first upload, set it as an env var:\n  vercel env add DB_BLOB_URL production`);
  console.log(`  vercel env add DB_BLOB_URL preview`);
  console.log(`(paste the URL above when prompted). Existing deployments pick it up on next redeploy.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
