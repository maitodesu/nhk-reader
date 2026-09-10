// Runs once per server instance, before it accepts any requests (Next.js
// instrumentation hook — stable since Next 14, no config flag needed).
//
// On Vercel the deployment filesystem is read-only and /tmp is wiped between
// cold starts, so the ~260MB SQLite database (dictionary + full NHK Easy
// archive) can't just live in the repo/build output. It's uploaded once to
// Vercel Blob (npm run upload:db) instead, and this downloads that single
// file to /tmp for this instance to read from — see src/lib/db.ts.
export async function register() {
  if (!process.env.VERCEL) return; // local dev already has data/app.db on disk

  const fs = await import("node:fs");
  const { TMP_DB_PATH } = await import("./lib/db");

  if (fs.existsSync(TMP_DB_PATH)) return; // already downloaded by this instance (warm reuse)

  const url = process.env.DB_BLOB_URL;
  if (!url) {
    console.error("DB_BLOB_URL is not set — run `npm run upload:db` and set it in the Vercel project.");
    return;
  }

  console.log(`downloading database from Blob...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`failed to download database from Blob: HTTP ${res.status}`);
    return;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(TMP_DB_PATH, buf);
  console.log(`database ready at ${TMP_DB_PATH} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}
