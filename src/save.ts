import { del, get, keys, set } from "idb-keyval";
import { newSoul } from "./engine/soul";
import type { Life, PastLife, Soul } from "./engine/types";

const CURRENT = "lifesim/current";
const GRAVEYARD = "lifesim/graveyard";
const SOUL = "lifesim/soul";
const SNAP = "lifesim/snap/";

export async function loadCurrent(): Promise<Life | undefined> {
  try {
    const life = await get<Life>(CURRENT);
    return life?.version === 1 ? life : undefined;
  } catch {
    return undefined;
  }
}

export async function saveCurrent(life: Life) {
  pending = undefined;
  if (timer) window.clearTimeout(timer);
  timer = undefined;
  try {
    await set(CURRENT, life);
  } catch (e) {
    console.warn("บันทึกไม่สำเร็จ", e);
  }
}

// บันทึกแบบรวบ: กดถี่ๆ ไม่ต้องเขียนลงเครื่องทุกครั้ง (เขียนจริงทุก 0.5 วินาที และทันทีที่ออกจากแอป)
let pending: Life | undefined;
let timer: number | undefined;
export function saveCurrentSoon(life: Life) {
  pending = life;
  if (timer) return;
  timer = window.setTimeout(() => {
    timer = undefined;
    if (pending) void saveCurrent(pending);
  }, 500);
}
export function flushSave() {
  if (pending) void saveCurrent(pending);
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });
}

export async function clearCurrent() {
  try {
    await del(CURRENT);
  } catch {
    /* ignore */
  }
}

export async function loadGraveyard(): Promise<PastLife[]> {
  try {
    return (await get<PastLife[]>(GRAVEYARD)) ?? [];
  } catch {
    return [];
  }
}

async function saveGraveyard(list: PastLife[]) {
  try {
    await set(GRAVEYARD, list.slice(0, 200));
  } catch {
    /* ignore */
  }
}

export async function addToGraveyard(p: PastLife) {
  const list = await loadGraveyard();
  if (list.some((x) => x.id === p.id)) return list;
  const next = [p, ...list].slice(0, 200);
  await saveGraveyard(next);
  return next;
}

export async function updateGraveyardPoints(id: string, points: number) {
  const list = await loadGraveyard();
  const p = list.find((x) => x.id === id);
  if (p) {
    p.points = points;
    await saveGraveyard(list);
  }
  return list;
}

export async function loadSoul(): Promise<Soul> {
  try {
    const s = await get<Soul>(SOUL);
    return s?.version === 1 ? s : newSoul();
  } catch {
    return newSoul();
  }
}

export async function saveSoul(soul: Soul) {
  try {
    await set(SOUL, soul);
  } catch {
    /* ignore */
  }
}

// ───────────────────────── snapshot สำหรับย้อนเวลา ─────────────────────────

/** เก็บสถานะชีวิต (ไม่รวมบันทึก) ตอนสิ้นปีของแต่ละอายุ */
export async function saveSnapshot(life: Life) {
  try {
    // clone ทันที เพราะ life จะถูกแก้ต่อก่อนที่ IndexedDB จะเขียนเสร็จ
    await set(`${SNAP}${life.id}/${life.age}`, structuredClone({ ...life, log: [], queue: [] }));
  } catch {
    /* ignore */
  }
}

/** snapshot ที่อายุ ≤ target ที่ใกล้ที่สุด */
export async function loadSnapshot(lifeId: string, target: number): Promise<Life | undefined> {
  try {
    for (let a = target; a >= 0; a--) {
      const s = await get<Life>(`${SNAP}${lifeId}/${a}`);
      if (s) return s;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** ลบ snapshot ของทุกชีวิต ยกเว้น keepId */
export async function pruneSnapshots(keepId?: string) {
  try {
    const all = await keys();
    await Promise.all(
      all
        .filter((k) => typeof k === "string" && k.startsWith(SNAP) && (!keepId || !k.startsWith(`${SNAP}${keepId}/`)))
        .map((k) => del(k)),
    );
  } catch {
    /* ignore */
  }
}

/** ขอให้เบราว์เซอร์ (โดยเฉพาะ iOS) ไม่ล้างเซฟทิ้ง */
export async function requestPersistence() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
}

// ───────────────────────── Export / Import ─────────────────────────

export interface Bundle {
  v: 1;
  soul: Soul;
  life?: Life;
  graveyard: PastLife[];
}

function toB64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** ย่อบันทึกชีวิตให้เล็กพอใส่ QR: เก็บเหตุการณ์สำคัญ + 15 บรรทัดล่าสุด */
function trimLog(life: Life, compact: boolean): Life {
  if (!compact) return life;
  const tail = life.log.slice(-8);
  const key = life.log.filter((e) => e.kind === "milestone").slice(-10);
  const merged = [...new Set([...key, ...tail])].sort((a, b) => life.log.indexOf(a) - life.log.indexOf(b));
  return { ...life, log: merged };
}

export async function exportCode(bundle: Bundle, compact = false): Promise<string> {
  const data: Bundle = {
    ...bundle,
    life: bundle.life && trimLog(bundle.life, compact),
    graveyard: bundle.graveyard.slice(0, compact ? 5 : 200),
    soul: compact ? { ...bundle.soul, awarded: bundle.soul.awarded.slice(-20) } : bundle.soul,
  };
  const json = new TextEncoder().encode(JSON.stringify(data));
  return toB64url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function importCode(code: string): Promise<Bundle> {
  const raw = await pipe(fromB64url(code.trim()), new DecompressionStream("deflate-raw"));
  const b = JSON.parse(new TextDecoder().decode(raw)) as Bundle;
  if (b?.v !== 1 || !b.soul) throw new Error("รหัสเซฟไม่ถูกต้อง");
  return b;
}

export async function applyBundle(b: Bundle) {
  await saveSoul(b.soul);
  await saveGraveyard(b.graveyard ?? []);
  await pruneSnapshots();
  if (b.life) await saveCurrent(b.life);
  else await clearCurrent();
}
