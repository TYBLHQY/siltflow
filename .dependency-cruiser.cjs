/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular-pdf-viewer-type-only",
      severity: "warn",
      comment:
        "PdfViewer ↔ SiltflowHighlightContainer: the reverse edge is type-only (import type), erased at runtime. Warn only so it doesn't block CI.",
      from: { path: "^src/components/document/SiltflowHighlightContainer" },
      to: { path: "^src/components/document/PdfViewer", circular: true },
    },
    {
      name: "no-circular",
      severity: "error",
      comment:
        "All other circular dependencies are forbidden. PdfViewer↔SiltflowHighlightContainer is handled by no-circular-pdf-viewer-type-only above.",
      from: {
        pathNot:
          "^src/components/document/(PdfViewer|SiltflowHighlightContainer)",
      },
      to: {
        circular: true,
      },
    },
    {
      name: "main-cannot-depend-on-renderer",
      severity: "error",
      comment:
        "The Electron main process (electron/) must not import from the renderer process (src/). Preload script is exempt for type-only API type annotations.",
      from: {
        path: "^electron/",
        pathNot: "^electron/preload\\.ts$",
      },
      to: { path: "^src/", pathNot: "\\.d\\.ts$" },
    },
    {
      name: "renderer-cannot-import-electron",
      severity: "error",
      comment:
        "The renderer process (src/) must not import from 'electron' directly. Use the preload bridge (window.siltflow API) instead for security.",
      from: { path: "^src/" },
      to: {
        path: "electron",
        dependencyTypes: ["core"],
      },
    },
    {
      name: "renderer-cannot-use-node-builtins",
      severity: "error",
      comment:
        "The renderer process (src/) must not use Node.js built-in modules. All system access must go through the preload bridge (IPC).",
      from: { path: "^src/" },
      to: {
        dependencyTypes: ["core"],
        path: "^(fs|path|child_process|os|net|http|https|crypto|stream|util|buffer|events|tls|dgram|dns|url|querystring|readline|repl|vm|zlib|perf_hooks|worker_threads)$",
      },
    },
    {
      name: "no-inter-folder-circular",
      severity: "warn",
      comment:
        "Avoid circular dependencies between high-level folder groups. This keeps the architecture layered.",
      from: {
        path: "^(src/components|src/stores|src/lib)",
      },
      to: {
        path: "^(src/components|src/stores|src/lib)",
        circular: true,
      },
    },
    {
      name: "electron-ipc-isolation",
      severity: "warn",
      comment:
        "IPC handlers (electron/ipc/) should only be imported by the main process entry (electron/main.ts), not by other main process modules.",
      from: {
        path: "^electron/",
        pathNot: "^electron/main\\.ts$|^electron/ipc/",
      },
      to: {
        path: "^electron/ipc/",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ["node_modules", "dist", "dist-electron", "release"],
      dependencyTypes: [
        "npm",
        "npm-dev",
        "npm-optional",
        "npm-peer",
        "npm-bundled",
        "npm-no-pkg",
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/(?:[^/]+/)",
        theme: {
          graph: {
            rankdir: "TD",
          },
        },
      },
      archi: {
        collapsePattern: "node_modules/(?:[^/]+/)",
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};
