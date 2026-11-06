// การตั้งค่าของเครื่องนี้ (ไม่ผูกกับเซฟ): ความเร็วข้อความ คำแนะนำ ตัวหนังสือใหญ่ · อ่านเขียนผ่าน localStorage แบบกันพัง
const read = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ไม่มี storage */ } };

export type TextSpeed = "normal" | "fast" | "instant";
export const textSpeed = (): TextSpeed => (read("ls.instantText") ? "instant" : read("ls.fastText") ? "fast" : "normal");
export function setTextSpeed(s: TextSpeed) { write("ls.instantText", s === "instant" ? "1" : ""); write("ls.fastText", s === "fast" ? "1" : ""); }
/** มิลลิวินาทีต่อสองตัวอักษร */
export const typeDelay = () => (textSpeed() === "fast" ? 6 : 18);

export const hintsOn = () => read("ls.hintsOff") !== "1";
export const setHints = (on: boolean) => write("ls.hintsOff", on ? "" : "1");
const seenHints = (): string[] => { try { return JSON.parse(read("ls.hintsSeen") || "[]"); } catch { return []; } };
export const hintSeen = (k: string) => seenHints().includes(k);
export const markHint = (k: string) => write("ls.hintsSeen", JSON.stringify([...new Set([...seenHints(), k])]));

export const largeText = () => read("ls.largeText") === "1";
export function setLargeText(on: boolean) { write("ls.largeText", on ? "1" : ""); applyLargeText(); }
export function applyLargeText() { try { document.documentElement.classList.toggle("large-text", largeText()); } catch { /* ไม่มี document */ } }

/** ดาวน์โหลดข้อความเป็นไฟล์ .txt */
export function downloadText(name: string, text: string) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* เบราว์เซอร์ไม่รองรับ */ }
}
