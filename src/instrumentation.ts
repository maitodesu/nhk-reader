// Runs once per server instance, before it accepts any requests (Next.js
// instrumentation hook — stable since Next 14, no config flag needed).
//
// On Vercel the deployment filesystem is read-only and /tmp is wiped between
// cold starts, so the ~260MB SQLite database (dictionary + full NHK Easy
// archive) can't just live in the repo/build output. It's uploaded once to
// Vercel Blob (npm run upload:db) instead, and this downloads that single
// file to /tmp for this instance to read from — see src/lib/db.ts.
//
// The actual work lives in ./instrumentation-node, imported only under this
// NEXT_RUNTIME check: instrumentation.ts is bundled for both the Node.js and
// Edge runtimes by default, and Edge can't bundle node:fs/better-sqlite3 at
// all. This is the standard pattern (same one Sentry's Next.js SDK uses) for
// keeping Node-only setup code out of the edge bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { downloadDbFromBlob } = await import("./instrumentation-node");
    await downloadDbFromBlob();
  }
}
