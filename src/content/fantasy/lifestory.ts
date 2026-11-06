// แท็บบันทึก: เรื่องราวชีวิตที่ร้อยจากทุกสิ่งที่คุณเลือก · คุณเปลี่ยนไปอย่างไร · ใครสำคัญที่สุด · คำจารึกบนหลุมศพ
import { yearHooks } from "../../engine/game";
import { relOf } from "../../engine/npc";
import type { Life, Person } from "../../engine/types";
import { seedsOf } from "./conseq";
import { traitWords, verdict } from "./persona";
import { fl, kingdomsOf } from "./state";
import { RACE_YOUNGER } from "./folk";
import { HIDDEN_SEED } from "./childhood";
import { marksOf } from "./worldmark";
import { topMemories } from "./people2";

export interface Beat { age: number; text: string; kind: "seed" | "echo" | "deed" | "mark" | "vow" | "self" | "turn" }
/** เหตุการณ์สำคัญของชีวิตนี้ เรียงตามอายุ */
export function timelineOf(l: Life): Beat[] {
  const f = fl(l);
  const out: Beat[] = [];
  for (const s of seedsOf(l)) {
    // เมล็ดของวัยเด็กซ่อนไว้จนกว่าจะกลับมา
    if (HIDDEN_SEED.test(s.id) && s.done === undefined) continue;
    out.push({ age: s.age, text: `คุณ${s.note}`, kind: "seed" });
    if (s.done !== undefined) out.push({ age: s.done, text: `เรื่องนั้นกลับมา${s.back ? `: ${s.back}` : ""}`, kind: "echo" });
  }
  for (const d of f.deedLog ?? []) out.push({ age: d.age, text: d.text, kind: "deed" });
  for (const m of marksOf(l)) out.push({ age: m.age, text: `${m.text} (${kingdomsOf(l).find((k) => k.id === m.k)?.name ?? ""})`, kind: "mark" });
  for (const v of f.vowLog ?? []) out.push({ age: v.age, text: v.text, kind: "vow" });
  let prev = "";
  for (const p of f.personaLog ?? []) { const w = p.words.join(" · "); if (w && w !== prev) out.push({ age: p.age, text: `คนรอบตัวเห็นว่าคุณเป็นคน${w}`, kind: "self" }); prev = w; }
  // จุดหักเหของชีวิต: เรื่องใหญ่ที่บันทึกไว้ (แต่งงาน ลูกเกิด เลื่อนขั้น สูญเสีย) ที่ยังไม่อยู่ในรายการ
  const have = new Set(out.map((b) => b.text));
  for (const e of l.log) if (e.kind === "milestone" && e.age > 0 && !have.has(e.text) && e.text.length < 140) out.push({ age: e.age, text: e.text, kind: "turn" });
  return out.sort((a, b) => a.age - b.age);
}

/** ช่วงชีวิตเป็นเล่ม: วัยเด็ก วัยเรียน วัยหนุ่มสาว วัยกลางคน วัยชรา · เผ่าอายุยืนยืดตามช่วงชีวิต */
export const VOLUMES = ["วัยเด็ก", "วัยเรียน", "วัยหนุ่มสาว", "วัยกลางคน", "วัยชรา"];
const STAGE_AT = [13, 20, 35, 60];
export function volumeOf(l: Life, age: number) {
  const y = Math.max(0, RACE_YOUNGER[fl(l).race] ?? 0);
  const st = age < 20 ? age : 20 + ((age - 20) * 80) / (80 + y);
  const i = STAGE_AT.findIndex((a) => st < a);
  return i < 0 ? STAGE_AT.length : i;
}
export interface Volume { name: string; from: number; to: number; beats: Beat[]; turns: number }
export function volumesOf(l: Life): Volume[] {
  const out: Volume[] = [];
  for (const b of timelineOf(l)) {
    const i = volumeOf(l, b.age);
    let v = out.find((x) => x.name === VOLUMES[i]);
    if (!v) { v = { name: VOLUMES[i], from: b.age, to: b.age, beats: [], turns: 0 }; out.push(v); }
    v.beats.push(b); v.to = b.age;
    if (isTurn(b)) v.turns++;
  }
  return out;
}
/** จุดหักเห: ผลงาน เรื่องที่กลับมา และเรื่องใหญ่ของชีวิต */
export const isTurn = (b: Beat) => b.kind === "deed" || b.kind === "echo" || b.kind === "turn";

/** คนที่รักคุณที่สุดและคนที่แค้นคุณที่สุด พร้อมเรื่องที่เขาจำ */
export function closest(l: Life, n = 3): Person[] {
  return l.people.filter((p) => p.alive).sort((a, b) => { const x = relOf(a), y = relOf(b); return y.love + y.loyalty + y.debt - (x.love + x.loyalty + x.debt); }).slice(0, n);
}
export function enemies(l: Life, n = 3): Person[] {
  return l.people.filter((p) => relOf(p).grudge >= 30).sort((a, b) => relOf(b).grudge - relOf(a).grudge).slice(0, n);
}
export const memoryLine = (p: Person) => topMemories(p, 1)[0]?.text;

/** คำจารึก: คนแบบไหน ทำอะไรไว้ และใครจะคิดถึง */
const TITLE_START = /^(เจ้า|นัก|ราชา|ยอด|ปรมาจารย์|คน|ช่าง|มหา|จอม|อัศวิน|นาย|ขุน|ราชาเงา|กรรมการ|สมาชิก|ลูกมือ|ที่ปรึกษา|ขุนนาง|วีร|เทพ|จักรพรรดิ)/;
export function epitaph(l: Life): string[] {
  const f = fl(l);
  const lines = [verdict(l)];
  const big = (f.deedLog ?? []).at(-1)?.text ?? f.deeds.at(-1);
  // ตำแหน่งที่เป็นคำนามอยู่แล้ว (เจ้าถิ่น นักรบ ยอดฝีมือ) ไม่ต้องเติม "ผู้" ข้างหน้า
  if (big) lines.push(`เป็นที่จดจำในฐานะ${TITLE_START.test(big) ? big : `ผู้${big.replace(/^ผู้/, "")}`}`);
  const back = seedsOf(l).filter((s) => s.done !== undefined).length;
  if (back) lines.push(`ทางเลือก ${back} อย่างในชีวิตกลับมาหาตัวเองก่อนตาย`);
  const c = closest(l, 1)[0];
  if (c && relOf(c).love >= 50) lines.push(`${c.name}จะคิดถึงที่สุด`);
  const e = enemies(l, 1)[0];
  if (e) lines.push(`${e.name}ยังไม่ให้อภัย`);
  if (f.vow) lines.push("รักษาปณิธานจนลมหายใจสุดท้าย");
  return lines;
}

export function loadLifestory() {
  yearHooks.push((l) => {
    if (l.worldId !== "fantasy" || !l.ft || !l.alive || l.age % 10 !== 0 || l.age < 10) return;
    const f = fl(l);
    const log = (f.personaLog ??= []);
    if (!log.some((x) => x.age === l.age)) log.push({ age: l.age, words: traitWords(l, 2) });
    if (log.length > 20) log.splice(0, log.length - 20);
  });
}
