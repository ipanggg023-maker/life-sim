// ข้อมูลสรุปของแต่ละแถบ (หลัง R25 ถูกยกเลิก): ไม่เปลี่ยนหน้าตา แค่บอกสิ่งที่ควรทำและได้อะไร โดยใช้การ์ดเดิมของเกม
import { ACTIVITIES, activitiesFor, activityLocked, type Activity } from "../../engine/activities";
import { relOf } from "../../engine/npc";
import type { Life, Person } from "../../engine/types";
import { shortName } from "../../engine/util";
import { ANCIENTS, NEED_LEADS } from "./ancients";
import { nextYearGold } from "./economy";
import { suggestionsOf } from "./ease";
import { huntOf, huntRelics } from "./hunts";
import { GOLD } from "./kit";
import { canCast, needXp } from "./power";
import { fl } from "./state";

const gold = (l: Life) => Math.floor(l.money / GOLD);
const open = (l: Life, id: string): Activity | undefined => {
  const a = ACTIVITIES.find((x) => x.id === id);
  return a && activitiesFor(l).includes(a) && !activityLocked(l, a) ? a : undefined;
};

/** ได้อะไรจากกิจกรรมนี้ อ่านจากคำอธิบาย ค่าใช้จ่าย และโอกาส · สั้นๆ ไม่เกินสามอย่าง */
export function effectsOf(l: Life, a: Activity): string[] {
  const d = `${a.name} ${a.desc}`;
  const out: string[] = [];
  const add = (t: string) => { if (!out.includes(t)) out.push(t); };
  if (/สุขภาพ/.test(d) && !/ต้องมีสุขภาพ/.test(d)) add("+สุขภาพ");
  if (/ความสุข/.test(d)) add("+ความสุข");
  if (/พลังกาย/.test(d)) add("+พลังกาย");
  if (/พลังเวท|เวทใหญ่/.test(d)) add("+พลังเวท");
  if (/ชื่อเสียง[^·]*(ลด|ลง)/.test(d)) add("−ชื่อเสียง");
  else if (/ชื่อเสียง/.test(d)) add("+ชื่อเสียง");
  if (/เงิน|ขาย|รายได้|งานเสริม|รับจ้าง|ค่าจ้าง/.test(d) && !/เสียเงิน|ค่าเดินทาง/.test(d)) add("+เงิน");
  if (/เพื่อน|คนใหม่|คบหา|ผูกพัน/.test(d)) add("+ผู้คน");
  if (/อันตราย|บอส|ดวล|ถึงตาย|ดันเจี้ยน|ภารกิจ/.test(d) || ["ผจญภัย", "ทางมืด"].includes(a.group ?? "")) add("เสี่ยง");
  const odds = a.odds?.(l);
  if (odds !== undefined) add(`สำเร็จ ${Math.round(odds * 100)}%`);
  if (a.cost && l.age >= 18) add(`−${Math.round(a.cost / GOLD)} เหรียญทอง`);
  return out.slice(0, 3);
}

/** สามอย่างที่ควรทำปีนี้: เรื่องด่วนก่อน แล้วเติมด้วยสิ่งที่ทำได้ตามชีวิตตอนนี้ */
export interface Pick { id: string; name: string; why: string; gets: string[] }
const FILL: [string, string][] = [
  ["ft_gig", "หาเงินเพิ่มอีกทาง"], ["ft_train", "ฝึกต่อเพื่อเข้าใกล้ขั้นต่อไป"], ["ft_study", "เวทของคุณยังไปได้อีก"],
  ["ft_rest", "พักให้ร่างกายกับใจได้หายใจ"], ["ft_tavern", "ออกไปเจอผู้คนบ้าง"], ["ft_festival", "เทศกาลมีปีละครั้ง"],
];
export function topPicks(l: Life): Pick[] {
  if (l.worldId !== "fantasy" || !l.ft || l.age < 6) return [];
  const out: Pick[] = [];
  const push = (id: string, why: string) => { const a = open(l, id); if (a && !out.some((x) => x.id === id)) out.push({ id, name: a.name, why, gets: effectsOf(l, a) }); };
  for (const s of suggestionsOf(l)) push(s.id, s.why);
  if (l.debt > 0 || gold(l) < 10) for (const id of ["ft_gig", "ft_oddjob"]) if (!out.some((x) => x.id === "ft_gig" || x.id === "ft_oddjob")) push(id, l.debt > 0 ? `หนี้ ${Math.ceil(l.debt / GOLD)} เหรียญทองยังค้าง` : "เงินเหลือน้อย");
  for (const [id, why] of FILL) { if (out.length >= 3) break; push(id, why); }
  return out.slice(0, 3);
}

/** สรุปปีนี้บรรทัดเดียว */
export function yearLine(l: Life, health = true): string {
  const hp = l.stats.health, g = gold(l), next = nextYearGold(l), debt = Math.ceil(l.debt / GOLD);
  const parts = [...(health ? [`สุขภาพ ${hp}${hp < 40 ? " (ต่ำ)" : ""}`] : []), `${g} เหรียญทอง`];
  if (next !== undefined) parts.push(`ปีหน้าน่าจะ ${next - g >= 0 ? "+" : "−"}${Math.abs(next - g)}`);
  if (debt > 0) parts.push(`หนี้ ${debt}`);
  return parts.join(" · ");
}

/** คนที่ควรใส่ใจ: ครอบครัวหรือเพื่อนที่กำลังห่าง คู่ชีวิตที่เหินห่าง และศัตรูที่ยังแค้น */
export interface Care { p: Person; why: string }
const KIN = ["spouse", "partner", "child", "father", "mother", "sibling"];
export function peopleToCare(l: Life): Care[] {
  if (l.worldId !== "fantasy" || !l.ft) return [];
  const alive = l.people.filter((p) => p.alive && !p.tags?.some((t) => t.startsWith("away:")));
  const out: Care[] = [];
  const mate = alive.find((p) => (p.relation === "spouse" || p.relation === "partner") && p.bond < 55);
  if (mate) out.push({ p: mate, why: "คู่ชีวิตเริ่มห่างเหิน" });
  for (const p of alive.filter((x) => KIN.includes(x.relation) && x.bond < 35 && x !== mate).sort((a, b) => a.bond - b.bond)) out.push({ p, why: "ห่างเหินกันมาก ความผูกพันลดทุกปี" });
  const foe = alive.filter((p) => relOf(p).grudge >= 50).sort((a, b) => relOf(b).grudge - relOf(a).grudge)[0];
  if (foe) out.push({ p: foe, why: "ยังแค้นคุณอยู่ อาจกลับมาหา" });
  for (const p of alive.filter((x) => x.relation === "friend" && x.bond >= 45 && x.bond < 55).slice(0, 1)) out.push({ p, why: "เพื่อนที่เริ่มห่าง คุยอีกนิดจะกลับมาสนิท" });
  return out.slice(0, 3);
}
export const careLabel = (c: Care) => `${shortName(c.p)} · ${c.why}`;

/** ก้าวต่อไป: ชื่อ เหตุผล ป้าย และกิจกรรมที่กดทำได้ (ถ้ามี) */
export interface Step { key: string; name: string; why: string; tags: string[]; act?: string }
const xpLeft = (xp: number, rank: number) => Math.max(0, needXp(rank) - xp);
/** แถบพลัง: ฝึกกาย ฝึกเวท คทา */
export function powerSteps(l: Life): Step[] {
  if (l.worldId !== "fantasy" || !l.ft || l.age < 6) return [];
  const f = fl(l), out: Step[] = [];
  const bl = xpLeft(f.body, f.bodyRank);
  out.push(bl ? { key: "body", name: "ฝึกกายให้ถึงขั้นต่อไป", why: `อีก ${bl} แต้มถึงบททดสอบทะลวงขั้น`, tags: ["+พลังกาย"], act: open(l, "ft_train") && "ft_train" } : { key: "body", name: "พร้อมทะลวงขั้นกายแล้ว", why: "บททดสอบจะมาตอนขึ้นปีใหม่", tags: ["ทะลวงขั้น"] });
  if (!canCast(l)) {
    if (open(l, "ft_wand")) out.push({ key: "wand", name: "ไปร้านคทา", why: "ยังร่ายเวทไม่ได้ คทาที่เหมาะกับคุณรออยู่", tags: ["เปิดทางเวท"], act: "ft_wand" });
  } else {
    const ml = xpLeft(f.magic, f.magicRank);
    out.push(ml ? { key: "magic", name: "ฝึกเวทให้ถึงขั้นต่อไป", why: `อีก ${ml} แต้มถึงบททดสอบทะลวงขั้น`, tags: ["+พลังเวท"], act: open(l, "ft_study") && "ft_study" } : { key: "magic", name: "พร้อมทะลวงขั้นเวทแล้ว", why: "บททดสอบจะมาตอนขึ้นปีใหม่", tags: ["ทะลวงขั้น"] });
    if (open(l, "ft_wand")) out.push({ key: "wand", name: "หาคทาที่ดีกว่า", why: "คทาของคุณยังไปได้อีกขั้น ถ้ามันยอมรับคุณ", tags: ["+พลังเวท"], act: "ft_wand" });
  }
  return out.slice(0, 3);
}
/** แถบโลก: อาวุธตำนาน มังกรโบราณ ลางแห่งยุค */
export function worldSteps(l: Life): Step[] {
  if (l.worldId !== "fantasy" || !l.ft) return [];
  const f = fl(l), out: Step[] = [];
  const h = huntOf(l);
  if (h) out.push({ key: "hunt", name: `ตามล่า${huntRelics(l).find((r) => r.id === h.id)?.name ?? "อาวุธตำนาน"}`, why: `บทที่ ${h.ch + 1} จาก 4${h.next > l.age ? ` · บทต่อไปอายุ ${h.next}` : " · บทต่อไปปีนี้"}`, tags: ["อาวุธตำนาน", "เสี่ยง"] });
  else if (l.age >= 16) out.push({ key: "hunt", name: "เลือกอาวุธตำนานที่จะตามล่า", why: "สิบหกเล่ม เล่มละสี่บท ดูได้ในกระดานตำนานด้านล่าง", tags: ["อาวุธตำนาน"] });
  const lead = ANCIENTS.map((a) => ({ a, n: f.ancientLeads?.[a.id] ?? 0 })).filter((x) => x.n > 0 && !(f.ancientDone ?? []).includes(x.a.id)).sort((x, y) => y.n - x.n)[0];
  if (lead) out.push({ key: "ancient", name: `มังกรโบราณ${lead.a.name}`, why: lead.n >= NEED_LEADS ? "รู้ทางไปที่หลับแล้ว" : `ได้ข่าวแล้ว ${lead.n}/${NEED_LEADS}`, tags: ["ตำนาน", ...(lead.n >= NEED_LEADS ? ["เสี่ยงตาย"] : [])], act: lead.n >= NEED_LEADS && open(l, "ft_ancient") ? "ft_ancient" : undefined });
  if (open(l, "ft_legend")) out.push({ key: "legend", name: "สืบหาเบาะแสตำนาน", why: "หอสมุดและซากเมืองยังมีเรื่องที่ไม่มีใครอ่าน", tags: ["ตำนาน"], act: "ft_legend" });
  return out.slice(0, 3);
}

/** สามอย่างของแถบอาชีพ */
export function careerPicks(l: Life): Pick[] {
  if (l.worldId !== "fantasy" || !l.ft || l.age < 14) return [];
  const out: Pick[] = [];
  const push = (id: string, why: string) => { const a = open(l, id); if (a && !out.some((x) => x.id === id)) out.push({ id, name: a.name, why, gets: effectsOf(l, a) }); };
  if (l.job && l.job.performance >= 60) push("ft_raise", "ผลงานดีพอจะขอขึ้นค่าจ้าง");
  if (l.debt > 0) for (const id of ["ft_gig", "ft_oddjob"]) if (!out.some((x) => x.id === "ft_gig" || x.id === "ft_oddjob")) push(id, `หนี้ ${Math.ceil(l.debt / GOLD)} เหรียญทองยังค้าง`);
  if (gold(l) >= 200) push("ft_invest", "เงินเก็บพอจะให้มันงอกเงย");
  if (!l.job) push("ft_oddjob", "ยังไม่มีงานประจำ");
  push("ft_gig", "รายได้เสริมปีละครั้ง");
  push("ft_tguild", "สมาคมช่วยหางานและปกป้องคุณ");
  return out.slice(0, 3);
}
