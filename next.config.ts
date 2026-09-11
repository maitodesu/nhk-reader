import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dictionary + article archive (data/app.db, ~250MB) is fetched once at
  // build time (see the "prebuild" script / scripts/fetch-db.mjs) and needs to
  // ship as a static file inside every server route's function bundle — it's
  // never `require()`d or `import()`ed, so Next's automatic file tracing can't
  // discover it on its own. This is a one-time, per-deploy cost instead of a
  // per-cold-start download from Vercel Blob.
  outputFileTracingIncludes: {
    "/*": ["./data/app.db"],
  },
};

export default nextConfig;
