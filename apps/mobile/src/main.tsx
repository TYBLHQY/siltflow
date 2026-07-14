import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";    /* CSS variable utilities — no @layer/@property */
import "./tailwind.css"; /* Tailwind v4 utilities */
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
