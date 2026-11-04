// แท็บบันทึก: เรื่องราวชีวิตที่ร้อยจากทุกสิ่งที่คุณเลือก · คุณเปลี่ยนไปอย่างไร · ใครสำคัญที่สุด · คำจารึกบนหลุมศพ
import { yearHooks } from "../../engine/game";
import { relOf } from "../../engine/npc";
import type { Life, Person } from "../../engine/types";
import { seedsOf } from "./conseq";
import { traitWords, verdict } from "./persona";
import { fl, kingdomsOf } from "./state";
import { marksOf } from "./worldmark";
import { topMemories } from "./people2";

export interface Beat { age: number; text: string; kind: "seed" | "echo" | "deed" | "mark" | "vow" | "self" }
/** เหตุการณ์สำคัญของชีวิตนี้ เรียงตามอายุ */
export function timelineOf(l: Life): Beat[] {
  const f = fl(l);
  const out: Beat[] = [];
  for (const s of seedsOf(l)) {
    out.push({ age: s.age, text: `คุณ${s.note}`, kind: "seed" });
    if (s.done !== undefined) out.push({ age: s.done, text: `เรื่องนั้นกลับมา${s.back ? `: ${s.back}` : ""}`, kind: "echo" });
  }
  for (const d of f.deedLog ?? []) out.push({ age: d.age, text: d.text, kind: "deed" });
  for (const m of marksOf(l)) out.push({ age: m.age, text: `${m.text} (${kingdomsOf(l).find((k) => k.id === m.k)?.name ?? ""})`, kind: "mark" });
  for (const v of f.vowLog ?? []) out.push({ age: v.age, text: v.text, kind: "vow" });
  let prev = "";
  for (const p of f.personaLog ?? []) { const w = p.words.join(" · "); if (w && w !== prev) out.push({ age: p.age, text: `คนรอบตัวเห็นว่าคุณเป็นคน${w}`, kind: "self" }); prev = w; }
  return out.sort((a, b) => a.age - b.age);
}

/** คนที่รักคุณที่สุดและคนที่แค้นคุณที่สุด พร้อมเรื่องที่เขาจำ */
export function closest(l: Life, n = 3): Person[] {
  return l.people.filter((p) => p.alive).sort((a, b) => { const x = relOf(a), y = relOf(b); return y.love + y.loyalty + y.debt - (x.love + x.loyalty + x.debt); }).slice(0, n);
}
export function enemies(l: Life, n = 3): Person[] {
  return l.people.filter((p) => relOf(p).grudge >= 30).sort((a, b) => relOf(b).grudge - relOf(a).grudge).slice(0, n);
}
export const memoryLine = (p: Person) => topMemories(p, 1)[0]?.text;

/** คำจารึก: คนแบบไหน ทำอะไรไว้ และใครจะคิดถึง */
export function epitaph(l: Life): string[] {
  const f = fl(l);
  const lines = [verdict(l)];
  const big = (f.deedLog ?? []).at(-1)?.text ?? f.deeds.at(-1);
  if (big) lines.push(`เป็นที่จดจำในฐานะผู้${big.replace(/^ผู้/, "")}`);
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
