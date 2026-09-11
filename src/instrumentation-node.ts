// Node-only half of the instrumentation hook — kept in its own module so
// instrumentation.ts can gate importing it behind a NEXT_RUNTIME check,
// letting the edge-runtime bundle tree-shake this (and its node:fs / db.ts
// dependency) out instead of failing to bundle Node built-ins.
//
// DB_BLOB_URL points at a GitHub Release asset (not Vercel Blob, despite the
// name — Blob's free data-transfer allowance doesn't survive repeated
// ~250MB-per-cold-start downloads at this size, and GitHub's release CDN has
// no comparable metering for our traffic). Re-upload with `npm run upload:db`
// whenever `scrape`/`backfill`/`build:dict` produce fresh data.
export async function downloadDbFromBlob() {
  const fs = await import("node:fs");
  const { IS_SERVERLESS, TMP_DB_PATH } = await import("./lib/db");
  if (!IS_SERVERLESS) return; // local dev already has data/app.db on disk

  if (fs.existsSync(TMP_DB_PATH)) return; // already downloaded by this instance (warm reuse)

  const url = process.env.DB_BLOB_URL;
  if (!url) {
    console.error("DB_BLOB_URL is not set — run `npm run upload:db` and set it in the Vercel project.");
    return;
  }

  console.log(`downloading database...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`failed to download database: HTTP ${res.status}`);
    return;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(TMP_DB_PATH, buf);
  console.log(`database ready at ${TMP_DB_PATH} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}
