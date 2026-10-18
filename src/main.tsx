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

// ขนาดตัวอักษร: ปุ่ม "ก" ขอบซ้ายกลางจอ กดวน 100% → 112% → 125% → 90%
const SIZES = [1, 1.12, 1.25, 0.9];
let sizeIdx = 0;
try { sizeIdx = Math.max(0, SIZES.indexOf(Number(localStorage.getItem("ls.zoom") ?? 1))); } catch { /* ไม่มี storage */ }
const applySize = () => {
  (document.getElementById("root")!.style as CSSStyleDeclaration & { zoom: string }).zoom = String(SIZES[sizeIdx]);
  try { localStorage.setItem("ls.zoom", String(SIZES[sizeIdx])); } catch { /* ไม่มี storage */ }
};
applySize();
const sizeBtn = document.createElement("button");
sizeBtn.className = "size-btn";
sizeBtn.textContent = "ก";
sizeBtn.title = "ขนาดตัวอักษร";
sizeBtn.onclick = () => { sizeIdx = (sizeIdx + 1) % SIZES.length; applySize(); };
document.body.appendChild(sizeBtn);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
