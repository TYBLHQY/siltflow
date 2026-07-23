import React from "react";
import ReactDOM from "react-dom/client";
import { GlobalWorkerOptions } from "pdfjs-dist";
import App from "./App.tsx";
import "./index.css";

// Import PDF.js worker from local node_modules (bundled by Vite via ?url)
// instead of fetching from CDN — avoids a network roundtrip at startup
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
