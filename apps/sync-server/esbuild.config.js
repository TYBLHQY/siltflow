/**
 * Esbuild build script — bundles the Hono sync-server into a single
 * ESM file so the Docker production image does NOT need pnpm,
 * tsx, or node_modules (except better-sqlite3's native .node binary).
 */
import * as esbuild from "esbuild";

const out = await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  // ws + some deps use dynamic require("events") etc.
  // CJS keeps native require() so these resolve correctly.
  // esbuild auto-converts import.meta.dirname → __dirname for CJS.
  outfile: "dist/server.cjs",
  external: [
    // Native C++ addon + its loader — cannot be bundled
    "better-sqlite3",
    "bindings",
  ],
  sourcemap: true,
  minify: false,
});

if (out.errors.length > 0) {
  console.error("esbuild errors:", out.errors);
  process.exit(1);
}
if (out.warnings.length > 0) {
  console.warn("esbuild warnings:", out.warnings);
}

console.log("[esbuild] server bundle written to dist/server.cjs");
