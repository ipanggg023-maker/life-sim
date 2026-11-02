import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loadMurimWorld } from "./content/murim";
import { loadSharedEvents } from "./content/shared";
import { App } from "./ui/App";
import "./ui/styles.css";
import { mountInkDefs } from "./ui/inkDefs";

loadMurimWorld();
loadSharedEvents();
mountInkDefs();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
