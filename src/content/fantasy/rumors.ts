// ข่าวลือ: เริ่มที่เมืองของคุณ ลามทั้งแผ่นดินในปีสองปี เรื่องใหญ่ข้ามไปแผ่นดินอื่น และจางลงในราวสิบปี
// ข่าวดีทำให้คนต้อนรับ ข่าวร้ายทำให้ยามจ้องหน้า · ทุกแผ่นดินและเมืองเล่าเรื่องคุณต่างกัน
import type { GameEvent } from "../../engine/events";
import { displayName, log } from "../../engine/util";
import type { Life } from "../../engine/types";
import { B, C, E, G, K, N, PAY } from "./kit";
import { addStanding, dataOf, deedHooks, fl, homeKingdom, kingdomsOf, standingOf, worldOfLife } from "./state";
import { cityOf } from "./cities";

export interface Rumor { text: string; tone: 1 | -1; heat: number; kingdom: string; city?: string; reach: 0 | 1 | 2; year: number; who: string; lifeId: string }
export const rumorsOf = (l: Life) => ((dataOf(l) as { rumors?: Rumor[] }).rumors ??= []);
const mine = (l: Life) => rumorsOf(l).filter((r) => r.lifeId === l.id);
const MAX = 40;

/** เล่าเรื่องคุณ · เรื่องเดิมซ้ำ = ข่าวร้อนขึ้น */
export function spread(l: Life, text: string, tone: 1 | -1, heat = 40) {
  if (!l.ft) return;
  const f = fl(l), w = worldOfLife(l);
  const old = mine(l).find((r) => r.text === text);
  if (old) old.heat = Math.min(100, old.heat + heat / 2);
  else rumorsOf(l).push({ text, tone, heat, kingdom: f.kingdom, ...(f.city ? { city: f.city } : {}), reach: 0, year: w.year, who: displayName(l), lifeId: l.id });
  addStanding(l, Math.round((tone * heat) / 12));
  const all = rumorsOf(l);
  if (all.length > MAX) { all.sort((a, b) => b.heat - a.heat); all.length = MAX; }
}

/** ทุกปี: ลามออกไปและจางลง · ข่าวที่ถึงแผ่นดินอื่นขยับชื่อเสียงที่นั่นด้วย */
export function rumorYear(l: Life) {
  const all = rumorsOf(l), f = fl(l);
  for (const r of all) {
    r.heat -= 8;
    if (r.lifeId !== l.id) continue;
    if (r.reach === 0 && r.heat >= 25) {
      r.reach = 1;
    } else if (r.reach === 1 && r.heat >= 55) {
      r.reach = 2;
      for (const k of kingdomsOf(l)) if (k.id !== r.kingdom) f.standing = { ...f.standing, [k.id]: Math.max(-100, Math.min(100, standingOf(l, k.id) + Math.round(r.tone * r.heat / 20))) };
      log(l, `ข่าวที่ว่าคุณ${r.text} ข้ามพรมแดนไปถึงแผ่นดินอื่นแล้ว`);
    }
  }
  (dataOf(l) as { rumors?: Rumor[] }).rumors = all.filter((r) => r.heat > 0);
}

/** เรื่องที่แผ่นดินนี้เล่าถึงคุณ (เรื่องในเมืองอื่นยังไม่ถึงจนกว่าจะลาม) */
export function talkIn(l: Life, kingdom: string, city?: string): Rumor[] {
  return mine(l).filter((r) => r.reach === 2 || (r.kingdom === kingdom && (r.reach === 1 || !city || r.city === city))).sort((a, b) => b.heat - a.heat);
}
export const talkHere = (l: Life) => talkIn(l, fl(l).kingdom, fl(l).city);
const heatHere = (l: Life, tone: 1 | -1) => talkHere(l).filter((r) => r.tone === tone).reduce((s, r) => s + r.heat, 0);
/** ข่าวของคนรุ่นก่อนที่ยังเล่ากันอยู่ */
export const oldTales = (l: Life) => rumorsOf(l).filter((r) => r.lifeId !== l.id && r.heat >= 20);
export const heatWord = (h: number) => (h >= 70 ? "ทั้งแผ่นดินพูดถึง" : h >= 40 ? "คนพูดกันมาก" : h >= 20 ? "ยังมีคนพูดถึง" : "เริ่มเลือน");

const top = (l: Life, tone: 1 | -1) => talkHere(l).find((r) => r.tone === tone)?.text ?? "";
export const RUMOR_EVENTS: GameEvent[] = [
  E("ft.ru.welcome", [16, 400], (l) => `เจ้าของโรงเตี๊ยมจำคุณได้ "ได้ยินว่าท่าน${top(l, 1)} จริงไหม" ทั้งร้านหันมามอง`, [
    C("ยอมรับอย่างถ่อมตัว", G("มื้อนี้ไม่ต้องจ่าย และมีคนส่งเหล้ามาให้อีกสามแก้ว", { joy: 5, gold: 2 })),
    C("บอกว่าเขาจำคนผิด", N("เขายิ้มแบบรู้ทัน แล้วแอบใส่ขนมเพิ่มให้", { joy: 2 })),
  ], { when: (l) => heatHere(l, 1) >= 40, weight: 10, maxTimes: 3, title: "คนจำได้" }),
  E("ft.ru.guard", [16, 400], (l) => `ยามประตูเมืองจ้องหน้าคุณนาน "ได้ยินว่าเจ้า${top(l, -1)}" เขาขวางทางไว้`, [
    PAY("ยัดเงินใส่มือเขา", 6, N("เขาหลีกทางให้ แต่จดชื่อคุณไว้")),
    K("พูดให้เขาเชื่อว่าเป็นข่าวลือ", "looks", 55, G("เขาหัวเราะแล้วโบกมือให้ผ่าน", { joy: 1 }), B("เขายิ่งไม่เชื่อ คุณต้องค้างนอกเมืองหนึ่งคืน", { hp: -2, joy: -3 })),
    C("ไปเข้าเมืองทางอื่น", N("ทางอ้อมไกลกว่าครึ่งวัน", { joy: -2 })),
  ], { when: (l) => heatHere(l, -1) >= 40, weight: 10, maxTimes: 3, title: "ข่าวร้ายมาก่อนตัว" }),
  E("ft.ru.bard", [18, 400], (l) => `นักกวีในตลาด${cityOf(l).name}ร้องเพลงว่า ${displayName(l)}${talkHere(l)[0]?.text ?? ""} เขาไม่รู้ว่าคนในเพลงยืนฟังอยู่`, [
    C("โยนเหรียญให้แล้วยิ้ม", G("เพลงนั้นจะดังต่อไปอีกหลายปี", { gold: -1, fame: 2 }, (l) => { const r = talkHere(l)[0]; if (r) r.heat = Math.min(100, r.heat + 15); })),
    C("ขอให้เขาเลิกร้อง", N("เขาเปลี่ยนเพลง ข่าวเรื่องนั้นเงียบลงเร็วขึ้น", {}, (l) => { const r = talkHere(l)[0]; if (r) r.heat -= 20; })),
  ], { when: (l) => talkHere(l).some((r) => r.heat >= 50), weight: 8, maxTimes: 2, title: "เพลงเรื่องคุณ" }),
  E("ft.ru.old", [10, 400], (_l, c) => `คนในเมืองยังเล่ากันว่า ${c.who} คนรุ่นก่อน${c.text}`, [
    C("ถามรายละเอียด", G("เรื่องยิ่งเล่ายิ่งยาว และคุณรู้สึกเหมือนรู้จักเขา", { iq: 1, joy: 2 })),
  ], { when: (l) => oldTales(l).length > 0, weight: 6, maxTimes: 2, title: "เรื่องเล่าของคนเก่า", prepare: (l) => { const r = oldTales(l).sort((a, b) => b.heat - a.heat)[0]; return { who: r.who, text: r.text }; } }),
];

export function loadRumors() {
  // ผลงานใหญ่ทุกชิ้นกลายเป็นข่าวดี
  deedHooks.push((l, text) => spread(l, `คือผู้${text.replace(/^ผู้/, "")}`, 1, 50));
}
export const kingdomName = (l: Life, id: string) => kingdomsOf(l).find((k) => k.id === id)?.name ?? homeKingdom(l).name;
