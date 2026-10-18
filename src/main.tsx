import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loadHunterWorld } from "./content/hunter";
import { loadMurimWorld } from "./content/murim";
import { loadCourtWorld } from "./content/court";
import { loadTowerWorld } from "./content/tower";
import { loadApocalypseWorld } from "./content/apocalypse";
import { loadOrdinaryWorld } from "./content/ordinary";
import { loadSharedEvents } from "./content/shared";
import { App } from "./ui/App";
import "./ui/styles.css";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
