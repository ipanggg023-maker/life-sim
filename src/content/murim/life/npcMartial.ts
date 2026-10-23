// เฟส C — NPC ฝึกวิชาเอง และคู่ปรับตลอดชีวิต (ROADMAP: "โลกยุทธ์ยังไม่มีชีวิต")
// NPC ที่ฝึกวิชาจะเก่งขึ้นตามเวลา ทะลวงขั้นได้/พลาดได้ หายากพอๆ กับผู้เล่น · คนใกล้ชิดได้ข่าวเมื่อเขาก้าวหน้า
// คู่ปรับ: คนรุ่นเดียวกันที่โตมาพร้อมคุณ ท้าดวลเป็นระยะ จดสถิติแพ้ชนะ กลายเป็นความนับถือหรือความหมกมุ่น
// และจบด้วยการดวลครั้งสุดท้าย การคืนดี หรือความตาย · ลูก/ศิษย์ส่งต่อขั้นฝีมือของตัวเองไปชีวิตถัดไป
import type { Ctx, GameEvent } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { feel, relOf, remember } from "../../../engine/npc";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { clamp, createPerson, log, shortName } from "../../../engine/util";
import { rankLabel } from "../../hunter/power";
import { B, BIG, C, E, FIGHT, G, N, type Res } from "../story/kit";
import { DUEL_END } from "./duel";
import { QI_NEED } from "../martial/arts";
import { awaken } from "../../hunter/power";

const STYLES = ["กระบี่", "ฝ่ามือ", "ทวน", "อาวุธลับ", "ตัวเบา", "หมัด", "ดาบ"];
const SECTS = ["สำนักกระบี่เมฆา", "วัดวัชระ", "พรรคกระยาจก", "ตระกูลถัง", "สำนักคุ้มภัยมังกรเหิน", "ไม่มีสำนัก"];
const MARTIAL_JOB = /ศิษย์|มือปราบ|คุมคาราวาน|คุ้มภัย|ทหาร|แม่ทัพ|องครักษ์|ผู้อาวุโสสำนัก|นักเลง|โจร/;
/** เพดานขั้นของ NPC ตามโชค (หายากพอๆ กับผู้เล่น: ส่วนใหญ่ค้างที่ชั้นสาม–ชั้นสอง) */
const CEILING = [1, 2, 2, 2, 3, 3, 3, 3, 4, 5];

export const martialOf = (p: Person) => p.martial;
export const martialLabel = (l: Life, p: Person) => (p.martial ? `${rankLabel(l, p.martial.rank)} · ${p.martial.style}${p.martial.sect && p.martial.sect !== "ไม่มีสำนัก" ? ` · ${p.martial.sect}` : ""}` : "");
/** เริ่มฝึกวิชา */
export function startMartial(l: Life, p: Person, rank = 0) {
  if (p.martial) return;
  p.martial = { rank, style: pick(l, STYLES), sect: pick(l, SECTS), xp: randInt(l, 0, 40) };
}
export const rivalOf = (l: Life) => l.people.find((p) => p.alive && p.tags?.includes("life_rival"));
const ceilingOf = (p: Person) => { let h = 0; for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CEILING[h % CEILING.length] + (p.tags?.includes("obsessed") ? 1 : 0); };
const close = (p: Person) => p.bond >= 40 || p.tags?.includes("life_rival") || p.tags?.includes("disciple");

/** ทุกปี: ใครเริ่มฝึก ใครเก่งขึ้น ใครทะลวงพลาด */
function tickMartial(l: Life) {
  if (l.worldId !== "murim" || !l.alive) return;
  let told = 0;
  for (const p of l.people) {
    if (!p.alive || p.age < 10) continue;
    if (!p.martial) {
      const keen = MARTIAL_JOB.test(p.job ?? "") || p.tags?.includes("disciple") || p.tags?.includes("life_rival") || p.tags?.includes("master");
      if (keen || (p.age <= 16 && chance(l, ["friend", "rival", "sibling", "child"].includes(p.relation) ? 0.06 : 0.02))) startMartial(l, p, p.tags?.includes("master") ? 3 : 0);
      continue;
    }
    const m = p.martial;
    if (p.age > 60) continue; // แก่แล้วไม่ก้าวหน้า
    const cap = ceilingOf(p);
    // ศิษย์ของผู้เล่นเรียนเร็วขึ้นตามฝีมืออาจารย์ · คู่ปรับที่หมกมุ่นฝึกหนักกว่าคนทั่วไป
    const teach = p.tags?.includes("disciple") ? (l.power?.rank ?? 0) * 3 : 0;
    m.xp += randInt(l, 10, 20) + teach + (p.tags?.includes("obsessed") ? 6 : 0) - m.rank * 2;
    if (m.xp < 100 || m.rank >= cap) { m.xp = Math.min(m.xp, 100); continue; }
    m.xp = 0;
    if (chance(l, clamp(0.75 - m.rank * 0.08, 0.2, 0.75))) {
      m.rank++;
      if (close(p) && told++ < 2) log(l, `⚔️ ${shortName(p)}ทะลวงสู่ขั้น${rankLabel(l, m.rank)}แล้ว${p.tags?.includes("life_rival") ? " — คู่ปรับของคุณไม่เคยหยุดไล่ตาม" : ""}`, p.tags?.includes("life_rival") ? "bad" : "good");
    } else if (chance(l, 0.25)) {
      // ธาตุไฟเข้าแทรก: บางครั้งถึงตาย
      if (chance(l, 0.15)) { p.alive = false; if (close(p)) log(l, `💔 ${shortName(p)}ธาตุไฟเข้าแทรกระหว่างทะลวงขั้น — ไม่ฟื้นอีกเลย`, "bad"); }
      else if (close(p) && told++ < 2) log(l, `🤕 ${shortName(p)}ทะลวงขั้นพลาด กระอักเลือดนอนซมไปหลายเดือน`);
    }
  }
}
yearHooks.push(tickMartial);

const R = (l: Life) => rivalOf(l)!;
const rname = (l: Life) => (rivalOf(l) ? shortName(R(l)) : "คู่ปรับ");
const record = (l: Life) => `ชนะ ${Number(l.flags.rivalW ?? 0)} แพ้ ${Number(l.flags.rivalL ?? 0)}`;
const rivalRank = (l: Life) => rivalOf(l)?.martial?.rank ?? 0;
const act = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign((l: Life, c: Ctx) => { f(l, c); return r(l, c); }, { fx: r.fx });

/** ผลดวลกับคู่ปรับ (เรียกจาก duel on: "rival") */
export function rivalDuelEnd(l: Life, won: boolean): string {
  const p = rivalOf(l);
  if (!p) return "";
  l.flags.lastRivalDuel = l.age;
  if (won) {
    l.flags.rivalW = Number(l.flags.rivalW ?? 0) + 1;
    // แพ้ซ้ำ: บางคนหมกมุ่น บางคนเริ่มนับถือ
    if (Number(l.flags.rivalW) >= 2 && !p.tags?.includes("obsessed") && !p.tags?.includes("rival_respect")) p.tags = [...(p.tags ?? []), relOf(p).grudge >= 30 || chance(l, 0.5) ? "obsessed" : "rival_respect"];
    feel(p, p.tags?.includes("obsessed") ? { grudge: 10, respect: 5 } : { respect: 12 });
    return ` (สถิติกับคู่ปรับ: ${record(l)})`;
  }
  l.flags.rivalL = Number(l.flags.rivalL ?? 0) + 1;
  feel(p, { respect: 3 });
  return ` (สถิติกับคู่ปรับ: ${record(l)})`;
}

export const RIVAL_EVENTS: GameEvent[] = [
  E("rv.meet", [10, 18], (l, c) => `ที่ลานฝึก มีเด็กรุ่นเดียวกันคนหนึ่งชื่อ${l.people.find((p) => p.id === c.pid)?.name ?? ""} ทำทุกท่าได้ก่อนคุณหนึ่งก้าวเสมอ — วันนี้${l.people.find((p) => p.id === c.pid)?.gender === "f" ? "นาง" : "เขา"}เดินมาหยุดตรงหน้า "เจ้าเป็นคนเดียวที่ข้าอยากชนะ"`, [
    C("\"งั้นก็มาแข่งกันทั้งชีวิต\"", act(G("คุณสองคนจับมือกันแน่นจนนิ้วขาว — ตั้งแต่วันนั้นคุณมีคนที่ทำให้ตื่นมาฝึกทุกเช้า", { joy: 4, exp: 200 }), (l, c) => { l.flags.rivalEver = true; const p = l.people.find((x) => x.id === c.pid) ?? createPerson(l, "friend", { age: l.age, bond: 40 }); p.relation = "rival"; p.tags = [...(p.tags ?? []), "life_rival"]; startMartial(l, p, 0); })),
    C("ไม่สนใจ", act(N((l, c) => `${l.people.find((p) => p.id === c.pid)?.gender === "f" ? "นาง" : "เขา"}หัวเราะเยาะ แล้วไปตั้งใจฝึกหนักกว่าเดิมเพื่อพิสูจน์ว่าคุณคิดผิด`, {}), (l, c) => { l.flags.rivalEver = true; const p = l.people.find((x) => x.id === c.pid) ?? createPerson(l, "friend", { age: l.age, bond: 40 }); p.relation = "rival"; p.tags = [...(p.tags ?? []), "life_rival", "obsessed"]; startMartial(l, p, 0); feel(p, { grudge: 15 }); })),
  ], { prepare: (l) => { const p = createPerson(l, "friend", { age: l.age + randInt(l, -1, 1), bond: 40 }); return { pid: p.id }; }, when: (l) => !!l.power && !rivalOf(l) && !l.flags.rivalEver, weight: 18, maxTimes: 1, title: "คู่ปรับ" }),

  E("rv.challenge", [14, 75], (l) => `${rname(l)} (${rivalOf(l)?.martial ? rankLabel(l, rivalRank(l)) : "?"}) ยืนรออยู่ที่ลานหน้าศาลเจ้าเดิม — ที่ที่พวกคุณดวลกันครั้งแรก "${R(l).tags?.includes("obsessed") ? "ครั้งนี้ข้าจะไม่แพ้อีก" : R(l).tags?.includes("rival_respect") ? "มาดูกันว่าใครก้าวไปไกลกว่า" : "ข้ารอวันนี้มาหลายปีแล้ว"}" · ${record(l)}`, [
    FIGHT("รับคำท้า", (l) => `${rname(l)} คู่ปรับตลอดชีวิต`, (l) => rivalRank(l), { on: "rival", intro: "คนทั้งตลาดมามุงดู — ทุกคนรู้ว่าสองคนนี้แข่งกันมาตั้งแต่เด็ก" }),
    C("ปฏิเสธ — ไม่ใช่ปีนี้", act(N("เขา/เธอมองคุณนาน \"กลัวหรือ\" แล้วเดินจากไป — ข่าวว่าคุณปฏิเสธแพร่ไปทั้งเมือง", { fame: -2 }), (l) => { l.flags.lastRivalDuel = l.age; const p = rivalOf(l); if (p) feel(p, { respect: -5 }); })),
  ], { when: (l) => !!rivalOf(l)?.martial && !!l.power && l.age - Number(l.flags.lastRivalDuel ?? 0) >= 5, weight: 30, maxTimes: 0, title: "คู่ปรับท้าดวล" }),

  E("rv.rival_needs_help", [20, 75], (l) => `${rname(l)}คู่ปรับของคุณถูกศัตรูสามคนรุมล้อมอยู่ในหุบเขา บาดเจ็บหนัก — ถ้าคุณไม่ไป ไม่มีใครไปแน่`, [
    FIGHT("ไปช่วยคู่ปรับ", "ศัตรูที่รุมล้อมคู่ปรับของคุณ", (l) => Math.max(1, rivalRank(l)), { intro: "คุณยืนหันหลังชนกับคนที่แข่งกับคุณมาทั้งชีวิต" }),
    C("ปล่อยไป — คู่แข่งหายไปหนึ่งคน", act(B("ไม่กี่วันต่อมามีข่าวว่าพบศพในหุบเขา — คุณชนะโดยไม่ต้องสู้ และรู้สึกว่าแพ้ที่สุดในชีวิต", { joy: -10, align: -4 }), (l) => { const p = rivalOf(l); if (p) p.alive = false; })),
  ], { when: (l) => !!rivalOf(l)?.martial && l.age >= 20 && Number(l.flags.rivalW ?? 0) + Number(l.flags.rivalL ?? 0) >= 2, weight: 3, maxTimes: 1, title: "คู่ปรับในอันตราย" }),

  E("rv.final", [50, 95], (l) => `${rname(l)}ผมขาวโพลนเหมือนคุณแล้ว ส่งจดหมายมาว่า "เรายังไม่รู้เลยว่าใครเก่งกว่ากันจริงๆ — มาดวลครั้งสุดท้ายก่อนเราจะตายกันเถอะ" · ${record(l)}`, [
    FIGHT("ดวลครั้งสุดท้าย", (l) => `${rname(l)} คู่ปรับตลอดชีวิต`, (l) => rivalRank(l), { on: "rival", intro: "ไม่มีคนมามุงดูแล้ว — มีแต่คุณสองคน ลานหน้าศาลเจ้าเดิม และใบไม้ร่วง" }),
    C("ไปหาพร้อมไหเหล้า แทนที่จะพกดาบ", act(BIG("พวกคุณนั่งดื่มกันจนเช้า เล่าทุกการดวลตั้งแต่เด็ก — ไม่มีใครชนะ และทั้งคู่รู้ว่านั่นแหละคือคำตอบ", { joy: 12, align: 2 }), (l) => { const p = rivalOf(l); if (p) { p.tags = [...(p.tags ?? []).filter((t) => t !== "obsessed"), "rival_respect"]; p.relation = "friend"; p.bond = 85; feel(p, { love: 20, respect: 30, grudge: -50 }); remember(l, p, "rival_peace", "ดื่มด้วยกันในบั้นปลายชีวิต", 3, {}, true); } })),
  ], { when: (l) => !!rivalOf(l)?.martial && l.age >= 50, weight: 6, maxTimes: 1, title: "การดวลครั้งสุดท้าย" }),
];

/** คู่ปรับตาย (ด้วยเหตุใดก็ตาม) — ความว่างเปล่า (kinDeathHooks ไม่ครอบคลุมคู่ปรับ จึงเช็กทุกปี) */
yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive) return;
  const dead = l.people.find((p) => !p.alive && p.tags?.includes("life_rival") && !p.tags?.includes("mourned"));
  if (!dead) return;
  dead.tags = [...(dead.tags ?? []), "mourned"];
  l.flags.rivalEver = true;
  log(l, `🕯️ ${shortName(dead)}คู่ปรับของคุณจากไปแล้ว · ${record(l)} — คุณพบว่าไม่มีใครให้ไล่ตามอีกต่อไป`, "bad");
  l.stats.happiness = clamp(l.stats.happiness - 8, 0, 100);
});

/** ชีวิตถัดไป: ลูก/ศิษย์ที่ฝึกวิชามาแล้วเริ่มด้วยขั้นของตัวเอง */
export const inheritedRank = (p?: Person) => (p?.martial ? p.martial.rank : undefined);
const STYLE_CLASS: Record<string, "m_sword" | "m_palm" | "m_spear" | "m_hidden" | "m_light"> = { กระบี่: "m_sword", ดาบ: "m_sword", ฝ่ามือ: "m_palm", หมัด: "m_palm", ทวน: "m_spear", อาวุธลับ: "m_hidden", ตัวเบา: "m_light" };
/** ลูก/ศิษย์ที่ฝึกมาแล้ว: ชีวิตถัดไปเริ่มที่ขั้นและสายวิชาของเขาเอง (ไม่ต้องรอศิลาวัดกระดูก) */
export function carryMartial(next: Life, p?: Person) {
  const m = p?.martial;
  if (!m || next.power) return;
  awaken(next, Math.max(1, m.rank), STYLE_CLASS[m.style] ?? "m_sword");
  next.power!.rank = m.rank;
  next.flags.mwRoot = Math.max(Number(next.flags.mwRoot ?? 0), m.rank);
  next.flags.mwQi = Math.max(Number(next.flags.mwQi ?? 0), QI_NEED[Math.min(8, m.rank)]);
}
DUEL_END.rival = (l, r) => rivalDuelEnd(l, r === "win");
