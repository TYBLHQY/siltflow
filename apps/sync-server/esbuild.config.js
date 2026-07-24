/**
 * esbuild config — bundles the Hono sync-server + workspace packages
 * into a single CJS file. better-sqlite3 stays external (native addon).
 *
 * Usage: node esbuild.config.js
 * Output: dist/server.cjs
 */
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/server.cjs",
  external: ["better-sqlite3"],
  sourcemap: true,
  // import.meta.url only exists in the dead ESM branch; CJS always
  // takes the __dirname branch. Substituting empty string silences
  // esbuild's "import.meta is not available with cjs" warning.
  define: { "import.meta.url": '""' },
  logLevel: "info",
});
