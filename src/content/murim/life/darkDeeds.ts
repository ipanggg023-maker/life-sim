// ด้านมืด: วางยา/ลอบสังหาร "ใครก็ได้" — รวมคนในครอบครัว คนรู้จัก ขุนนาง จนถึงฮ่องเต้ (ROADMAP: คำตัดสินของผู้เล่น)
// โอกาสสำเร็จลดตามการคุ้มกันของเป้าหมาย (ฮ่องเต้แทบเป็นไปไม่ได้) · พลาด/ถูกจับกับคนชั้นสูง = ประหาร + กวาดล้างครอบครัว
// ลูกบางคนหนีรอดได้ และกลายเป็นเรื่องแก้แค้นของรุ่นถัดไป · ฆ่าคนในครอบครัวสำเร็จ = คนที่เหลือสงสัย ความทรงจำหนัก
import type { Ctx, GameEvent, Outcome } from "../../../engine/events";
import { kill } from "../../../engine/game";
import { remember } from "../../../engine/npc";
import { chance } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { addMoney, clamp, log, relationLabel, shortName } from "../../../engine/util";
import { fightOdds } from "../../hunter/power";
import { shiftAlign } from "../m17core";
import { TAEL } from "../story/kit";
import { courtOf, palaceAccess } from "../world/court";
import { castOf, princesOf } from "../world/palace";
import { gift } from "./gifts";
import { plantSeed } from "./seedStore";

const FAMILY = ["father", "mother", "sibling", "spouse", "child"];
const MAX_PEOPLE = 12;

export interface Target { id: string; name: string; label: string; prot: number; high: boolean }

/** การคุ้มกันของคนในชีวิตคุณ (0 = ไม่ระวังเลย · 1 = แตะไม่ได้) */
function personProt(p: Person): number {
  if (FAMILY.includes(p.relation)) return 0.05;
  if (/ขุนนาง|นายอำเภอ|เจ้าเมือง|ข้าหลวง|เสนาบดี|แม่ทัพ|ผู้อาวุโสสำนัก|เจ้าสำนัก/.test(p.job ?? "")) return 0.4;
  if (p.relation === "rival") return 0.25;
  return 0.15;
}

/** เป้าหมายทั้งหมดที่เลือกได้ (คนในชีวิต + คนในราชสำนักที่มีชื่อเสียง) */
export function darkTargets(l: Life): Target[] {
  const out: Target[] = [];
  const ppl = l.people.filter((p) => p.alive && !p.tags?.some((t) => t.startsWith("away:"))).sort((a, b) => Number(FAMILY.includes(b.relation)) - Number(FAMILY.includes(a.relation)));
  for (const p of ppl.slice(0, MAX_PEOPLE)) {
    const prot = personProt(p);
    out.push({ id: p.id, name: shortName(p), label: `${p.name} (${relationLabel(p, l)}${p.gender === "f" ? " ♀" : " ♂"})`, prot, high: prot >= 0.35 });
  }
  if (l.mw && l.mw.era !== "war") {
    const c = courtOf(l);
    const inside = palaceAccess(l) ? 0.1 : 0;
    if (!l.flags.emperorSelf) out.push({ id: "court:emperor", name: c.emperor.name, label: `${c.emperor.name} (โอรสสวรรค์)`, prot: 0.92 - inside, high: true });
    const heir = princesOf(l).find((x) => x.named);
    if (heir) out.push({ id: `court:prince:${heir.id}`, name: heir.name, label: `${heir.name} (รัชทายาท)`, prot: 0.75 - inside, high: true });
    const top = castOf(l).filter((n) => n.role === "minister" || n.role === "eunuch").sort((a, b) => b.inf - a.inf)[0];
    if (top) out.push({ id: `court:npc:${top.id}`, name: top.name, label: `${top.name} (${top.title})`, prot: 0.6 - inside, high: true });
  }
  return out;
}
const targetOf = (l: Life, c: Ctx) => darkTargets(l).find((t) => t.id === c.tid);
export const PROT_LABEL = (p: number) => (p >= 0.85 ? "แทบเป็นไปไม่ได้" : p >= 0.55 ? "คุ้มกันแน่นหนา" : p >= 0.3 ? "มีคนคุ้มกัน" : p >= 0.12 ? "ระวังตัวบ้าง" : "ไม่ระวังคุณเลย");

/** โอกาสของแต่ละวิธี (แสดงตรงกับที่ใช้จริง) */
const isPoisoner = (l: Life) => l.job?.careerId === "poisoner" || !!l.flags.medicKnow;
export const poisonOdds = (l: Life, t: Target) => clamp(0.8 - t.prot + (l.stats.smarts - 50) / 200 + (isPoisoner(l) ? 0.15 : 0) + gift(l, "medicine"), 0.02, 0.9);
export const bladeOdds = (l: Life, t: Target) => clamp(fightOdds(l, Math.round(t.prot * 8)) - t.prot * 0.4, 0.02, 0.92);
export const hireOdds = (l: Life, t: Target) => clamp(0.65 - t.prot * 0.7 + (l.stats.luck - 50) / 300, 0.02, 0.85);
export const hireCost = (t: Target) => Math.round(20 + t.prot * 300);
/** โอกาสถูกสืบถึงตัว */
const traceRisk = (method: "poison" | "blade" | "hire", t: Target, ok: boolean) =>
  clamp((ok ? { poison: 0.12, blade: 0.25, hire: 0.1 }[method] : { poison: 0.5, blade: 0.6, hire: 0.45 }[method]) + t.prot * 0.5, 0.05, 0.98);

/** เป้าหมายตายจริง */
function slay(l: Life, t: Target) {
  if (t.id === "court:emperor") {
    courtOf(l).emperor.health = 0; // ราชสำนักจะผลัดแผ่นดินในปีนี้
    log(l, `🏯 ${t.name}สวรรคตอย่างกะทันหัน — หมอหลวงบอกว่าพระหทัยวาย`, "bad");
  } else if (t.id.startsWith("court:prince:")) {
    const pr = princesOf(l).find((x) => x.id === t.id.slice(13));
    if (pr) pr.alive = false;
  } else if (t.id.startsWith("court:npc:")) {
    const n = castOf(l).find((x) => x.id === t.id.slice(10));
    if (n) n.alive = false;
  } else {
    const p = l.people.find((x) => x.id === t.id);
    if (!p) return;
    p.alive = false;
    if (FAMILY.includes(p.relation)) {
      l.flags.kinslayer = Number(l.flags.kinslayer ?? 0) + 1;
      l.stats.happiness = clamp(l.stats.happiness - (gift(l, "dark") > 0 ? 5 : 20), 0, 100);
      // คนในครอบครัวที่เหลือเริ่มสงสัย
      for (const o of l.people.filter((x) => x.alive && FAMILY.includes(x.relation) && x.age >= 12))
        if (chance(l, 0.35)) remember(l, o, "suspects_kinslaying", `สงสัยว่าคุณเป็นคนฆ่า${shortName(p)}`, 3, { grudge: 40, trust: -40, fear: 30 }, false);
    }
  }
  l.flags.mwKills = Number(l.flags.mwKills ?? 0) + 1;
  l.flags.mwKillAge = l.age;
  plantSeed(l, "killed", t.name);
}

/** ถูกจับ: คนชั้นสูง = ประหาร + กวาดล้างครอบครัว (ลูกบางคนหนีรอด) · คนธรรมดา = ถูกจับขึ้นศาล */
function caught(l: Life, t: Target): string {
  if (t.high) {
    const fam = l.people.filter((p) => p.alive && FAMILY.includes(p.relation));
    let escaped = 0;
    for (const p of fam) {
      if (p.relation === "child" && chance(l, 0.4)) { p.tags = [...(p.tags ?? []), "escaped_purge"]; escaped++; }
      else p.alive = false;
    }
    l.flags.familyPurged = t.name;
    kill(l, `ถูกประหารเจ็ดชั่วโคตรข้อหาลอบสังหาร${t.name}`);
    return ` ทหารหลวงล้อมบ้านกลางดึก — ทั้งตระกูลถูกลากไปลานประหาร${escaped ? ` · ลูก ${escaped} คนหนีรอดไปได้ในความวุ่นวาย` : " ไม่มีใครรอด"}`;
  }
  l.flags.heat = Math.min(100, Number(l.flags.heat ?? 0) + 55);
  l.flags.wanted = true;
  l.flags.lastCrime = `ฆาตกรรม${t.name}`;
  l.queue.splice(1, 0, { eventId: "cr.trial", ctx: {} });
  return " — มีพยานเห็นคุณ มือปราบมาถึงก่อนรุ่งสาง";
}

function finish(l: Life, c: Ctx, method: "poison" | "blade" | "hire", ok: boolean): Outcome {
  const t = targetOf(l, c);
  if (!t) return { text: "เป้าหมายไม่อยู่ในที่ที่คิดแล้ว" };
  if (method === "hire") addMoney(l, -hireCost(t) * TAEL);
  if (method === "poison") addMoney(l, -10 * TAEL);
  shiftAlign(l, FAMILY.includes(l.people.find((p) => p.id === t.id)?.relation ?? "") ? -15 : t.high ? -8 : -10);
  const traced = chance(l, traceRisk(method, t, ok));
  if (ok) slay(l, t);
  const how = { poison: ok ? `${t.name}ล้มลงหลังดื่มชาถ้วยนั้น — หมอบอกว่าหัวใจวาย` : `${t.name}เทชาทิ้งเพราะกลิ่นแปลก`, blade: ok ? `ดาบของคุณเร็วกว่าเสียงร้องของ${t.name}` : `${t.name}ร้องเรียกคนได้ก่อนดาบจะถึงตัว — คุณหนีออกมาพร้อมแผลที่แขน`, hire: ok ? `มือสังหารที่คุณจ้างส่งหยกประจำตัวของ${t.name}กลับมาเป็นหลักฐาน` : `มือสังหารที่คุณจ้างถูกจับได้คาตำหนัก` }[method];
  if (!ok && method === "blade") l.stats.health = clamp(l.stats.health - 15, 0, 100);
  if (!traced) return { text: `${how}${ok ? " — ไม่มีใครสงสัยคุณ" : " — โชคดีที่ไม่มีใครสาวถึงตัวคุณ"}`, kind: ok ? "milestone" : "bad" };
  return { text: how + caught(l, t), kind: "bad" };
}

export const DARK_EVENTS: GameEvent[] = [
  {
    id: "dk.menu",
    minAge: 14,
    maxAge: 110,
    manual: true,
    maxTimes: 0,
    title: "แผนในเงามืด",
    text: () => "คุณนั่งอยู่ในห้องที่ปิดหน้าต่างทุกบาน — ชื่อหนึ่งชื่อวนอยู่ในหัวมาหลายคืนแล้ว ใครคือคนที่ต้องหายไป",
    choices: [
      ...Array.from({ length: MAX_PEOPLE + 3 }, (_, i) => ({
        label: (l: Life) => { const t = darkTargets(l)[i]; return t ? `${t.label} · ${PROT_LABEL(t.prot)}` : "-"; },
        tone: "danger" as const,
        show: (l: Life) => !!darkTargets(l)[i],
        run: (l: Life, c: Ctx): Outcome => { const t = darkTargets(l)[i]; c.tid = t.id; return { text: `คุณเลือกแล้ว — ${t.name}`, next: "method" }; },
      })),
      { label: "ไม่ — ยังไม่ถึงขั้นนั้น", run: () => ({ text: "คุณเปิดหน้าต่างให้ลมเข้า ชื่อนั้นค่อยๆ จางไปจากหัว" }) },
    ],
    scenes: {
      method: {
        title: "วิธีการ",
        text: (l, c) => { const t = targetOf(l, c); return t ? `เป้าหมาย: ${t.label} — ${PROT_LABEL(t.prot)}. จะลงมืออย่างไร` : "เป้าหมายหายไปแล้ว"; },
        choices: [
          { label: "วางยาในอาหาร/ชา (10 ตำลึง)", skill: ["stealth"], tone: "danger", req: (l) => (l.money < 10 * TAEL ? "ต้องมีเงิน 10 ตำลึง" : undefined), show: (l, c) => !!targetOf(l, c), odds: (l, c) => poisonOdds(l, targetOf(l, c)!), run: (l, c, ok) => finish(l, c, "poison", ok) },
          { label: "ลงมือด้วยมือตัวเอง", skill: ["combat", "stealth"], tone: "danger", show: (l, c) => !!targetOf(l, c) && !!l.power, odds: (l, c) => bladeOdds(l, targetOf(l, c)!), survival: (l, c) => clamp(0.95 - targetOf(l, c)!.prot * 0.3, 0.5, 0.97), run: (l, c, ok) => finish(l, c, "blade", ok) },
          { label: (l, c) => `จ้างมือสังหาร (${hireCost(targetOf(l, c) ?? { prot: 0 } as Target)} ตำลึง)`, tone: "danger", req: (l, c) => { const t = targetOf(l, c); return t && l.money < hireCost(t) * TAEL ? `ต้องมีเงิน ${hireCost(t)} ตำลึง` : undefined; }, show: (l, c) => !!targetOf(l, c), odds: (l, c) => hireOdds(l, targetOf(l, c)!), run: (l, c, ok) => finish(l, c, "hire", ok) },
          { label: "ถอนตัว", run: () => ({ text: "มือคุณสั่น — คุณวางทุกอย่างลงแล้วกลับไปนอน" }) },
        ],
      },
    },
  },
  // รุ่นถัดไป: ลูกที่หนีรอดจากการกวาดล้าง
  {
    id: "dk.purge_heir",
    minAge: 14,
    maxAge: 60,
    maxTimes: 1,
    weight: 40,
    title: "ลูกของตระกูลที่ถูกกวาดล้าง",
    when: (l) => !!l.flags.plPurgedFor,
    text: (l) => `คุณยังจำคืนนั้นได้ — คืนที่ทั้งตระกูลถูกลากไปลานประหาร เพราะ${String(l.flags.plName ?? "พ่อแม่")}ลอบสังหาร${String(l.flags.plPurgedFor)} คุณรอดมาได้ด้วยชื่อปลอม`,
    choices: [
      { label: "สาบานล้างแค้นให้ตระกูล", run: (l) => { l.flags.purgeVow = true; return { text: "คุณสาบานต่อหน้าป้ายวิญญาณที่ทำขึ้นเองในป่า — วันหนึ่งคนสั่งประหารจะรู้ว่ายังมีคนรอดอยู่", kind: "milestone" }; } },
      { label: "ใช้ชีวิตใหม่ด้วยชื่อปลอมเงียบๆ", run: (l) => { l.flags.hiddenIdentity = true; return { text: "คุณฝังอดีตไว้ใต้ชื่อใหม่ — ไม่มีใครรู้ว่าคุณเป็นลูกใคร" }; } },
      { label: "ตามหาหลักฐานว่าใครสั่งประหารจริงๆ", run: (l) => { l.flags.knowsAncestor = true; return { text: "คุณเริ่มสืบจากบันทึกในหอจดหมายเหตุ — บางทีความจริงอาจซับซ้อนกว่าที่คนเล่ากัน" }; } },
    ],
  },
];
