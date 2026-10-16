import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loadHunterWorld } from "./content/hunter";
import { loadMurimWorld } from "./content/murim";
import { loadCourtWorld } from "./content/court";
import { loadSharedEvents } from "./content/shared";
import { App } from "./ui/App";
import "./ui/styles.css";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadSharedEvents();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
