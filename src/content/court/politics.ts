// ระบบการเมืองของราชสำนัก (M18): สามขั้วอำนาจ · ความนิยมในสังคม · ข่าวลือ · แผนการ
// เก็บทั้งหมดใน life.flags เพื่อไม่ต้องแตะ types.ts
//   fac_royal / fac_temple / fac_noble  = ท่าทีของแต่ละขั้วต่อผู้เล่น (−100…+100)
//   pow_royal / pow_temple / pow_noble  = ดุลอำนาจในราชสำนัก (รวมกัน 100)
//   soc = ความนิยมในสังคม (0…100) · rumors = JSON ของข่าวลือที่ยังลอยอยู่
import { runEvent, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { clamp, log } from "../../engine/util";

export type Faction = "royal" | "temple" | "noble";
export const FACTIONS: Faction[] = ["royal", "temple", "noble"];
export const FACTION_INFO: Record<Faction, { name: string; emoji: string; head: string }> = {
  royal: { name: "ราชวงศ์", emoji: "👑", head: "จักรพรรดิและพระราชวงศ์" },
  temple: { name: "วิหาร", emoji: "⛪", head: "สังฆราชแห่งวิหารใหญ่" },
  noble: { name: "ขุนนาง", emoji: "🎩", head: "สภาขุนนางของแกรนด์ดยุก" },
};

export const fac = (l: Life, f: Faction) => Number(l.flags[`fac_${f}`] ?? 0);
export function addFac(l: Life, f: Faction, d: number) {
  l.flags[`fac_${f}`] = clamp(Math.round(fac(l, f) + d), -100, 100);
}
export const pow = (l: Life, f: Faction) => Number(l.flags[`pow_${f}`] ?? 33);

/** เลื่อนดุลอำนาจ: ขั้ว f ได้ d แต้ม อีกสองขั้วเสียเท่าๆ กัน */
export function shiftPow(l: Life, f: Faction, d: number) {
  const others = FACTIONS.filter((x) => x !== f);
  const take = clamp(d, -pow(l, f) + 5, 100);
  l.flags[`pow_${f}`] = pow(l, f) + take;
  const a = Math.round(take / 2);
  l.flags[`pow_${others[0]}`] = pow(l, others[0]) - a;
  l.flags[`pow_${others[1]}`] = pow(l, others[1]) - (take - a);
  // ไม่มีขั้วไหนหายไปจากกระดาน
  for (const x of FACTIONS) {
    if (pow(l, x) < 5) {
      const need = 5 - pow(l, x);
      l.flags[`pow_${x}`] = 5;
      const rich = FACTIONS.filter((y) => y !== x).sort((p, q) => pow(l, q) - pow(l, p))[0];
      l.flags[`pow_${rich}`] = pow(l, rich) - need;
    }
  }
}

export const dominant = (l: Life): Faction => [...FACTIONS].sort((a, b) => pow(l, b) - pow(l, a))[0];
/** ขั้วที่ผู้เล่นสนิทที่สุด (ถ้ามีใจให้ ≥ 20) */
export const ally = (l: Life): Faction | undefined => {
  const best = [...FACTIONS].sort((a, b) => fac(l, b) - fac(l, a))[0];
  return fac(l, best) >= 20 ? best : undefined;
};
export const facLabel = (n: number) => (n >= 60 ? "ไว้วางใจ" : n >= 20 ? "เป็นมิตร" : n > -20 ? "เฉยๆ" : n > -60 ? "ระแวง" : "เป็นศัตรู");

// ───────── ความนิยมในสังคม ─────────

export const soc = (l: Life) => Number(l.flags.soc ?? 40);
export function addSoc(l: Life, d: number) {
  l.flags.soc = clamp(Math.round(soc(l) + d), 0, 100);
}
export const socLabel = (n: number) => (n >= 80 ? "ดาวเด่นของสังคม" : n >= 60 ? "เป็นที่จับตามอง" : n >= 35 ? "ธรรมดา" : n >= 15 ? "ถูกนินทา" : "ถูกสังคมรังเกียจ");

// ───────── ข่าวลือ ─────────

export interface Rumor {
  key: string;
  text: string;
  /** true = ข่าวลือเกี่ยวกับตัวผู้เล่น */
  you: boolean;
  /** ข่าวดี/ข่าวร้ายต่อเป้าหมาย */
  good: boolean;
  /** ความร้อนแรง 1–5: ลดปีละ 1 ถึง 0 แล้วหายไป */
  heat: number;
}

export function rumors(l: Life): Rumor[] {
  try {
    return JSON.parse(String(l.flags.rumors ?? "[]")) as Rumor[];
  } catch {
    return [];
  }
}
const saveRumors = (l: Life, list: Rumor[]) => {
  l.flags.rumors = JSON.stringify(list.slice(-6));
};
export function addRumor(l: Life, key: string, text: string, you: boolean, good: boolean, heat = 3) {
  const list = rumors(l).filter((r) => r.key !== key);
  list.push({ key, text, you, good, heat: clamp(heat, 1, 5) });
  saveRumors(l, list);
  l.flags.rumorsMade = Number(l.flags.rumorsMade ?? 0) + 1;
}
export function dropRumor(l: Life, key: string) {
  saveRumors(l, rumors(l).filter((r) => r.key !== key));
}
export function heatRumor(l: Life, key: string, d: number) {
  const list = rumors(l).map((r) => (r.key === key ? { ...r, heat: clamp(r.heat + d, 0, 5) } : r)).filter((r) => r.heat > 0);
  saveRumors(l, list);
}
export const hasRumor = (l: Life, key: string) => rumors(l).some((r) => r.key === key);
/** ข่าวร้ายเกี่ยวกับตัวผู้เล่นที่ยังลอยอยู่ */
export const badRumors = (l: Life) => rumors(l).filter((r) => r.you && !r.good);

// ───────── แผนการ ─────────

export const SCHEMES = [
  { id: "c18.s.poison", emoji: "🍷", name: "ข่าวลือยาพิษ", desc: "ปล่อยข่าวว่าคู่แข่งแอบซื้อยาพิษ — แรงแต่ย้อนเข้าตัวได้" },
  { id: "c18.s.match", emoji: "💌", name: "แม่สื่อ", desc: "จับคู่ขุนนางสองตระกูลเพื่อสร้างหนี้บุญคุณ" },
  { id: "c18.s.expose", emoji: "🕯️", name: "เปิดโปงคู่แข่ง", desc: "หาหลักฐานความผิดของศัตรูแล้วนำเสนอในที่ที่เจ็บที่สุด" },
  { id: "c18.s.alliance", emoji: "🤝", name: "สร้างพันธมิตร", desc: "ผูกมิตรกับขั้วอำนาจหนึ่งด้วยงานเลี้ยง ของขวัญ และคำสัญญา" },
  { id: "c18.s.salon", emoji: "🎻", name: "เปิดซาลอน", desc: "จัดซาลอนประจำฤดูกาล คุมว่าใครจะเป็นที่พูดถึง" },
] as const;

export const SCHEME_MIN_AGE = 15;
export const schemeReady = (l: Life) =>
  l.alive && l.worldId === "court" && l.age >= SCHEME_MIN_AGE && !l.queue.length && !l.doneThisYear.includes("scheme");
export const schemesDone = (l: Life) => Number(l.flags.schemes ?? 0);

/** ผู้เล่นเริ่มแผนการเอง (ปีละครั้ง) */
export function startScheme(l: Life, id: string) {
  if (!schemeReady(l)) return;
  l.doneThisYear.push("scheme");
  l.flags.schemes = schemesDone(l) + 1;
  runEvent(l, id, {});
}

// ───────── ทุกปี ─────────

const DRIFT_NEWS: Record<Faction, string[]> = {
  royal: ["จักรพรรดิยึดเหมืองมานาของสภาขุนนางเข้าคลังหลวง", "องค์รัชทายาทชนะศึกชายแดน ประชาชนแห่ออกมาโห่ร้อง", "พระราชกฤษฎีกาใหม่ให้ราชวงศ์แต่งตั้งบาทหลวงเองได้"],
  temple: ["ปาฏิหาริย์ที่วิหารใหญ่ทำให้ผู้ศรัทธาล้นจัตุรัส", "สังฆราชประกาศว่าภัยแล้งคือโทสะของเทพธิดาต่อราชวงศ์", "อัศวินศักดิ์สิทธิ์กวาดล้างลัทธิมืดได้ทั้งเครือข่าย"],
  noble: ["สภาขุนนางคว่ำงบประมาณของราชสำนักได้สำเร็จ", "แกรนด์ดยุกแต่งงานลูกสาวเข้ากับตระกูลพ่อค้าที่รวยที่สุด", "ขุนนางทางใต้รวมตัวกันไม่ส่งภาษีให้วังหลวง"],
};

export function initPolitics(l: Life) {
  if (l.flags.pol) return;
  l.flags.pol = true;
  const base = { poor: [-5, 10, -10], middle: [0, 5, 0], rich: [5, 0, 10], elite: [15, 0, 15] }[l.wealth];
  FACTIONS.forEach((f, i) => (l.flags[`fac_${f}`] = base[i] + randInt(l, -5, 5)));
  const r = randInt(l, 28, 40), t = randInt(l, 25, 38);
  l.flags.pow_royal = r;
  l.flags.pow_temple = t;
  l.flags.pow_noble = 100 - r - t;
  l.flags.soc = { poor: 20, middle: 32, rich: 42, elite: 50 }[l.wealth];
}

yearHooks.push((l) => {
  if (l.worldId !== "court" || !l.alive || l.age < 6) return;
  initPolitics(l);
  if (l.age < 12) return;
  // ดุลอำนาจขยับทุกปี: ขั้วที่ผู้เล่นหนุนได้แรงส่งเล็กน้อย
  const before = dominant(l);
  const mover = pick(l, FACTIONS);
  const a = ally(l);
  shiftPow(l, mover, randInt(l, -4, 6) + (a === mover ? 2 : 0));
  const after = dominant(l);
  if (after !== before && l.age >= 14) log(l, `⚖️ ดุลอำนาจเปลี่ยน — ${FACTION_INFO[after].emoji}${FACTION_INFO[after].name}ขึ้นมาเป็นใหญ่ในราชสำนัก: ${pick(l, DRIFT_NEWS[after])}`, "system");
  // ท่าทีของแต่ละขั้วค่อยๆ เย็นลงถ้าไม่ได้รักษาความสัมพันธ์
  for (const f of FACTIONS) if (Math.abs(fac(l, f)) > 30 && chance(l, 0.5)) addFac(l, f, fac(l, f) > 0 ? -2 : 2);
  // ข่าวลือ: มีผลกับความนิยม แล้วค่อยๆ จางหาย
  const list = rumors(l);
  for (const r of list) if (r.you) addSoc(l, r.good ? 1 + Math.floor(r.heat / 2) : -(1 + Math.floor(r.heat / 2)));
  const left = list.map((r) => ({ ...r, heat: r.heat - 1 })).filter((r) => r.heat > 0);
  if (left.length < list.length && l.age >= 14) {
    const gone = list.filter((r) => !left.some((x) => x.key === r.key));
    if (gone.some((r) => r.you)) log(l, "ข่าวลือเก่าเกี่ยวกับคุณเงียบหายไปจากวงน้ำชาแล้ว", "normal");
  }
  saveRumors(l, left);
  // ความนิยมถอยกลับหาค่ากลางช้าๆ
  if (soc(l) > 60 && chance(l, 0.4)) addSoc(l, -1);
  if (soc(l) < 25 && chance(l, 0.4)) addSoc(l, 1);
});
