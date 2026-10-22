// Phase 3 — ร่างกายแยกส่วน · บาดแผลเจ็บจริง หายช้าเป็นปี · อวัยวะที่ขาดไม่งอกคืน (MURIM_PLAN §15, §18.7)
// ทุกบาดแผลถาวรมีทางเล่นต่อ: ฝึกมืออีกข้าง · ฟังเสียงลมแทนตา · เปลี่ยนไปสายวิชาภายนอก/แพทย์ · อวัยวะเทียม
import { chance, pick, randInt } from "./rng";
import type { Life } from "./types";
import { clamp, log } from "./util";
import { gift } from "../content/murim/life/gifts";

export type Part =
  | "eyeL" | "eyeR" | "ears" | "tongue" | "face"
  | "armL" | "armR" | "handL" | "handR" | "legL" | "legR"
  | "organs" | "ribs" | "dantian" | "meridians" | "blood";

export type InjuryKind = "cut" | "broken" | "severed" | "blind" | "deaf" | "mute" | "scar" | "burn" | "internal" | "poison" | "shattered" | "tendon" | "fingers";

export interface Injury {
  id: string;
  part: Part;
  kind: InjuryKind;
  /** 1 = เบา · 2 = สาหัส · 3 = ถาวร */
  sev: 1 | 2 | 3;
  /** ปีที่เหลือกว่าจะหาย (แผลถาวร = 0) */
  heal: number;
  since: number;
  /** ใส่อวัยวะเทียม/ผ้าปิดตาแล้ว */
  aid?: boolean;
  cause?: string;
}

export interface Body {
  injuries: Injury[];
  /** ฝึกมืออีกข้างจนใช้กระบี่ได้แล้ว */
  offHand?: boolean;
  offHandFrom?: number;
  /** ฝึกฟังเสียงลมแทนตา */
  listening?: boolean;
  listenFrom?: number;
  /** ตันเถียนแตกแล้วเปลี่ยนไปสายวิชาภายนอก */
  external?: boolean;
}

export const PART_NAME: Record<Part, string> = {
  eyeL: "ตาซ้าย", eyeR: "ตาขวา", ears: "หู", tongue: "ลิ้น", face: "ใบหน้า",
  armL: "แขนซ้าย", armR: "แขนขวา", handL: "มือซ้าย", handR: "มือขวา", legL: "ขาซ้าย", legR: "ขาขวา",
  organs: "อวัยวะภายใน", ribs: "ซี่โครง", dantian: "ตันเถียน", meridians: "เส้นลมปราณ", blood: "เลือด",
};

const KIND_NAME: Record<InjuryKind, string> = {
  cut: "แผลฟัน", broken: "หัก", severed: "ขาด", blind: "บอด", deaf: "หูหนวก", mute: "ถูกตัดลิ้น", scar: "แผลเป็น", burn: "แผลไฟไหม้",
  internal: "บาดเจ็บภายใน", poison: "พิษเรื้อรัง", shattered: "แตกสลาย", tendon: "เอ็นขาด", fingers: "นิ้วขาด",
};

const SEV_NAME = ["", "เบา", "สาหัส", "ถาวร"];

export const bodyOn = (l: Life) => l.worldId === "murim";
export function bodyOf(l: Life): Body {
  l.body ??= { injuries: [] };
  return l.body;
}
const has = (l: Life, part: Part, kinds: InjuryKind[], sev = 1) => !!l.body?.injuries.some((i) => i.part === part && kinds.includes(i.kind) && i.sev >= sev);

/** ชื่อบาดแผลแบบอ่านง่าย เช่น "แขนขวาขาด" "บาดเจ็บภายใน (สาหัส · อีก 2 ปี)" */
export function injuryLabel(i: Injury): string {
  const base = ["internal", "poison", "scar", "burn", "cut"].includes(i.kind) ? `${KIND_NAME[i.kind]}ที่${PART_NAME[i.part]}` : `${PART_NAME[i.part]}${KIND_NAME[i.kind]}`;
  const t = i.sev === 3 ? "ถาวร" : `${SEV_NAME[i.sev]} · อีก ${i.heal} ปี`;
  return `${base} (${t}${i.aid ? " · มีอวัยวะเทียม" : ""})`;
}

/** ความพิการถาวรที่ควรแสดงข้างชื่อ */
export function disabilities(l: Life): string[] {
  if (!l.body) return [];
  const out: string[] = [];
  const b = l.body;
  const blindL = has(l, "eyeL", ["blind"], 3), blindR = has(l, "eyeR", ["blind"], 3);
  if (blindL && blindR) out.push(b.listening ? "👁️ ตาบอดทั้งสองข้าง (ฟังเสียงลม)" : "👁️ ตาบอดทั้งสองข้าง");
  else if (blindL || blindR) out.push(`👁️ ตา${blindL ? "ซ้าย" : "ขวา"}บอด`);
  for (const side of ["R", "L"] as const) {
    if (has(l, `arm${side}`, ["severed"], 3)) out.push(`🦾 แขน${side === "R" ? "ขวา" : "ซ้าย"}ขาด${side === "R" && b.offHand ? " (ฝึกมือซ้ายแล้ว)" : ""}`);
    else if (has(l, `hand${side}`, ["fingers", "tendon"], 3)) out.push(`✋ มือ${side === "R" ? "ขวา" : "ซ้าย"}พิการ`);
    if (has(l, `leg${side}`, ["severed"], 3)) out.push(`🦿 ขา${side === "R" ? "ขวา" : "ซ้าย"}ขาด${b.injuries.some((i) => i.part === `leg${side}` && i.aid) ? " (ขาไม้)" : ""}`);
  }
  if (has(l, "dantian", ["shattered"], 3)) out.push(b.external ? "💔 ตันเถียนแตก (สายวิชาภายนอก)" : "💔 ตันเถียนแตก");
  if (has(l, "tongue", ["mute"], 3)) out.push("🤐 ถูกตัดลิ้น");
  if (has(l, "ears", ["deaf"], 3)) out.push("🦻 หูหนวก");
  if (has(l, "face", ["scar", "burn"], 3)) out.push("🩹 ใบหน้ามีแผลเป็น");
  if (has(l, "blood", ["poison"], 2)) out.push("☠️ พิษเรื้อรัง");
  return out;
}

/** ผลของบาดแผลต่อพลังต่อสู้ (คูณกับพลังต่อสู้) */
export function combatFactor(l: Life): number {
  if (!l.body?.injuries.length) return 1;
  const b = l.body;
  let f = 1;
  const blindL = has(l, "eyeL", ["blind"], 3), blindR = has(l, "eyeR", ["blind"], 3);
  if (blindL && blindR) f *= b.listening ? 0.8 : 0.4;
  else if (blindL || blindR) f *= 0.88;
  if (has(l, "armR", ["severed"], 3) || has(l, "handR", ["fingers", "tendon"], 3)) f *= b.offHand ? 0.85 : 0.5;
  if (has(l, "armL", ["severed"], 3) || has(l, "handL", ["fingers", "tendon"], 3)) f *= 0.85;
  for (const s of ["legL", "legR"] as const) if (has(l, s, ["severed"], 3)) f *= b.injuries.some((i) => i.part === s && i.aid) ? 0.82 : 0.65;
  if (has(l, "dantian", ["shattered"], 3)) f *= b.external ? 0.45 : 0.15;
  else if (has(l, "dantian", ["internal", "shattered"], 2)) f *= 0.6;
  // แผลที่ยังไม่หาย
  for (const i of b.injuries) {
    if (i.sev === 3 || i.heal <= 0) continue;
    if (["internal", "broken", "tendon"].includes(i.kind)) f *= i.sev === 2 ? 0.75 : 0.92;
    else if (i.kind === "poison") f *= 0.85;
    else if (i.kind === "cut") f *= i.sev === 2 ? 0.88 : 0.97;
  }
  return Math.round(clamp(f, 0.05, 1) * 100) / 100;
}

let seq = 0;
/** เพิ่มบาดแผล (ใช้ได้ทุกที่ในยุทธภพ) — คืนข้อความต่อท้ายผลลัพธ์ */
export function injure(l: Life, part: Part, kind: InjuryKind, sev: 1 | 2 | 3, cause?: string): string {
  if (!bodyOn(l)) return "";
  const b = bodyOf(l);
  // ส่วนที่เสียไปแล้วเสียซ้ำไม่ได้
  if (sev === 3 && b.injuries.some((i) => i.part === part && i.sev === 3 && i.kind === kind)) return "";
  // พรสวรรค์ต้านพิษ
  if (kind === "poison" && chance(l, Math.min(1, gift(l, "poison")))) { log(l, "🛡️ พิษเข้าร่างแล้วถูกขับออกเอง — ร่างกายคุณไม่รับพิษ", "good"); return " [ต้านพิษได้]"; }
  const heal = sev === 3 ? 0 : sev === 2 ? randInt(l, 2, 4) : 1;
  const inj: Injury = { id: `i${l.age}_${seq++}_${part}`, part, kind, sev, heal, since: l.age, cause };
  b.injuries.push(inj);
  if (kind === "scar") l.stats.looks = clamp(l.stats.looks - (sev === 3 ? 6 : 2), 0, 100);
  if (kind === "burn") l.stats.looks = clamp(l.stats.looks - (sev === 3 ? 14 : 5), 0, 100);
  if (kind === "severed" && part.startsWith("arm")) b.injuries = b.injuries.filter((i) => !(i.part === `hand${part.slice(3)}` && i.sev < 3));
  const label = injuryLabel(inj);
  log(l, `${sev === 3 ? "🩸" : "🤕"} ${label}${cause ? ` — ${cause}` : ""}`, "bad");
  return ` [${label}]`;
}

/** บาดแผลตามความรุนแรงของการปะทะ (dmg = สุขภาพที่เสียไป) */
export function woundFrom(l: Life, dmg: number, cause?: string): string {
  if (!bodyOn(l) || !l.alive || dmg < 10) return "";
  if (!chance(l, clamp((dmg - 8) / 40, 0, 0.6))) return "";
  if (dmg >= 26 && chance(l, 0.12)) {
    const [part, kind] = pick(l, [["armR", "severed"], ["armL", "severed"], ["eyeL", "blind"], ["eyeR", "blind"], ["legL", "severed"], ["handR", "fingers"], ["face", "scar"], ["face", "scar"]] as [Part, InjuryKind][]);
    return injure(l, part, kind, 3, cause);
  }
  if (dmg >= 18) {
    const [part, kind] = pick(l, [["organs", "internal"], ["organs", "internal"], ["ribs", "broken"], ["armL", "broken"], ["armR", "broken"], ["legR", "broken"], ["handR", "tendon"], ["face", "scar"]] as [Part, InjuryKind][]);
    return injure(l, part, kind, 2, cause);
  }
  const [part, kind] = pick(l, [["armL", "cut"], ["armR", "cut"], ["legL", "cut"], ["ribs", "broken"], ["organs", "internal"], ["face", "cut"]] as [Part, InjuryKind][]);
  return injure(l, part, kind, 1, cause);
}

/** ทุกปี: แผลค่อยๆ หาย (คนแก่หายช้า) · แผลภายในที่ไม่รักษาอาจกลายเป็นถาวร · พิษกัดกินร่างกาย */
export function tickBody(l: Life) {
  if (!bodyOn(l) || !l.body?.injuries.length || !l.alive) return;
  const b = l.body;
  for (const i of [...b.injuries]) {
    if (i.kind === "poison" && i.heal > 0) l.stats.health = clamp(l.stats.health - randInt(l, 2, 5), 0, 100);
    if (i.kind === "internal" && i.heal > 0) l.stats.health = clamp(l.stats.health - (i.sev === 2 ? randInt(l, 2, 4) : 1), 0, 100);
    if (i.sev === 3 || i.heal <= 0) continue;
    // แผลสาหัสที่ไม่ได้รักษา: บางครั้งแย่ลงจนพิการถาวร
    if (i.sev === 2 && !l.flags[`treated_${i.id}`] && chance(l, i.kind === "internal" ? 0.12 : i.kind === "tendon" ? 0.15 : 0.05)) {
      i.sev = 3;
      i.heal = 0;
      if (i.kind === "internal") { i.part = "meridians"; }
      log(l, `🩸 ${PART_NAME[i.part]}ไม่ได้รับการรักษาที่ดีพอ — กลายเป็น${injuryLabel(i)}`, "bad");
      continue;
    }
    if (l.age > 50 && chance(l, 0.4)) continue; // คนแก่แผลหายช้า
    i.heal--;
    if (i.heal > 0 && chance(l, Math.min(0.9, gift(l, "heal")))) i.heal--; // พรสวรรค์: แผลหายไว
    if (i.heal <= 0) {
      b.injuries = b.injuries.filter((x) => x !== i);
      log(l, `🩹 ${injuryLabel({ ...i, heal: 0, sev: i.sev }).replace(/ \(.*\)$/, "")}หายดีแล้ว`, "good");
    }
  }
  // ฝึกทางเลือกใหม่จนสำเร็จ
  if (b.offHandFrom !== undefined && !b.offHand && l.age - b.offHandFrom >= 3) {
    b.offHand = true;
    log(l, "✋ สามปีที่ฝึกด้วยมือซ้ายจนเลือดซิบ — วันนี้กระบี่ในมือซ้ายของคุณไม่สั่นอีกแล้ว", "milestone");
  }
  if (b.listenFrom !== undefined && !b.listening && l.age - b.listenFrom >= 4) {
    b.listening = true;
    log(l, "👂 คุณได้ยินเสียงใบไม้ไหวในระยะร้อยก้าว ได้ยินแม้กระทั่งเสียงลมหายใจของคนที่ซ่อนตัว — ความมืดไม่ใช่ศัตรูอีกต่อไป", "milestone");
  }
}

/** ระดับหมอ: หมอบ้าน · หมอมีชื่อ · หมอเทวดา */
export const HEALERS = [
  { id: 0, name: "หมอบ้าน", cost: 3_000, odds: 0.55, desc: "ถูก แต่รักษาได้แค่แผลเบา–ปานกลาง" },
  { id: 1, name: "หมอมีชื่อในเมือง", cost: 40_000, odds: 0.8, desc: "รักษาแผลสาหัสได้ดี ลดเวลาฟื้นตัว" },
  { id: 2, name: "หมอเทวดาแห่งหุบเขายา", cost: 600_000, odds: 0.45, desc: "หายากและแพงมาก — อาจรักษาตันเถียนหรือดวงตาที่บอดได้" },
] as const;

/** รักษาบาดแผล — คืนข้อความผล */
export function treat(l: Life, tier: 0 | 1 | 2): { text: string; ok: boolean } {
  const b = bodyOf(l);
  const h = HEALERS[tier];
  const open = b.injuries.filter((i) => i.sev < 3 && i.heal > 0);
  const perm = b.injuries.filter((i) => i.sev === 3 && ["blind", "shattered", "tendon", "deaf", "poison"].includes(i.kind));
  if (!chance(l, h.odds)) return { text: `${h.name}ส่ายหน้า ยาที่ให้มาไม่ได้ช่วยอะไรมากนัก`, ok: false };
  if (tier === 2 && perm.length) {
    const i = pick(l, perm);
    b.injuries = b.injuries.filter((x) => x !== i);
    if (i.part === "dantian") b.external = false;
    if (i.kind === "poison") return { text: "หมอเทวดากรีดปลายนิ้วทั้งสิบ เลือดดำไหลออกมาสามวันสามคืนจนกลายเป็นสีแดง — พิษที่ฝังในร่างมาหลายปีถูกขับออกจนหมด", ok: true };
    return { text: `เข็มทองสามสิบหกเล่มกับยาที่ต้มเจ็ดวันเจ็ดคืน — ${PART_NAME[i.part]}ของคุณกลับมาใช้ได้อีกครั้ง ปาฏิหาริย์มีจริง`, ok: true };
  }
  if (!open.length) return { text: `${h.name}ตรวจแล้วบอกว่าไม่มีแผลที่ยังรักษาได้`, ok: false };
  for (const i of open) {
    if (tier === 0 && i.sev === 2 && chance(l, 0.5)) continue;
    l.flags[`treated_${i.id}`] = true;
    i.heal = Math.max(0, i.heal - (tier === 0 ? 1 : 2));
    if (i.heal === 0) b.injuries = b.injuries.filter((x) => x !== i);
  }
  return { text: `${h.name}จัดกระดูก เย็บแผล และให้ยาต้มกลับไปกิน — บาดแผลดีขึ้นมาก`, ok: true };
}

export const openInjuries = (l: Life) => (l.body?.injuries ?? []).filter((i) => i.sev < 3 && i.heal > 0);
export const permanentInjuries = (l: Life) => (l.body?.injuries ?? []).filter((i) => i.sev === 3);
export const hasInjury = has;
