import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loadHunterWorld } from "./content/hunter";
import { App } from "./ui/App";
import "./ui/styles.css";

loadHunterWorld();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
