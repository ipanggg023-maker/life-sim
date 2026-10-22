// Phase 6b — ราชสำนักและวังหลัง (MURIM_EXPANSION §8.4–8.5 · MURIM_PLAN §8.7 ฮ่องเต้)
// ฮ่องเต้ถูกจำกัดด้วยความชอบธรรม สุขภาพ กองทัพ ท้องพระคลัง · ฮองเฮามีตระกูลและเป้าหมายของนาง · ขันทีมีอำนาจจากการเข้าถึงข้อมูล
// การสืบราชบัลลังก์เกิดจากแรงกดดันสะสม ไม่ใช่สุ่มดราม่า · ผู้เล่นไม่ต้องยุ่งการเมืองก็ได้ แต่ผลกระทบจะมาถึงอยู่ดี
import type { GameEvent } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { clamp, log } from "../../../engine/util";
import { calYear, worldOfLife } from "../life/world";
import { ab, B, BIG, C, E, G, K, N, P } from "../story/kit";

export type Temper = "wise" | "tyrant" | "puppet" | "paranoid";
export const TEMPER: Record<Temper, string> = { wise: "ทรงพระปรีชา", tyrant: "ทรราช", puppet: "หุ่นเชิดของขุนนาง", paranoid: "หวาดระแวงทุกคน" };

export interface Court {
  dynasty: string;
  emperor: { name: string; age: number; temper: Temper; health: number; since: number };
  empress: { name: string; clan: string; goal: string };
  /** รัชทายาท: ความชอบธรรม 0–100 · ผู้หนุนหลัง */
  heir?: { name: string; age: number; legit: number; backer: "empress" | "consort" | "ministers" };
  eunuch: { name: string; loyal: "emperor" | "empress" | "self"; power: number };
  /** อำนาจของขุนนาง / ทหาร / ฝ่ายใน 0–100 */
  ministers: number;
  military: number;
  inner: number;
  edict?: "ban_sects" | "heavy_tax" | "draft" | "amnesty";
  regent?: string;
  /** ประวัติการเปลี่ยนรัชกาล (ใช้ในบันทึกยุทธภพ) */
  reigns: { name: string; from: number; to: number; how: string }[];
}

const DYN = ["ราชวงศ์จิ้น", "ราชวงศ์หยวนเหลียง", "ราชวงศ์ฉู่ใต้", "ราชวงศ์หมิงเฉวียน", "ราชวงศ์ซ่งเหนือ"];
const EMP = ["เจาเหวิน", "เสียนอู่", "หลิงจิ้ง", "จิ่งไท่", "ซวนเต๋อ", "หย่งอัน", "เทียนฉี", "กวงหลง"];
const CLANS = ["ตระกูลหวัง", "ตระกูลเซี่ย", "ตระกูลหยาง", "ตระกูลตู้กู", "ตระกูลเหลียง"];
const EUN = ["ขันทีหลี่", "ขันทีเว่ย", "ขันทีเกา", "ขันทีจ้าว"];
const GOALS = ["ปกป้องโอรสของพระนาง", "รักษาเสถียรภาพในวัง", "ลดอิทธิพลของสนมคนโปรด", "ยกตระกูลเดิมให้ยิ่งใหญ่"];

export function courtOf(l: Life): Court {
  const w = worldOfLife(l);
  if (!w.court) {
    const yr = calYear(l);
    w.court = {
      dynasty: pick(l, DYN),
      emperor: { name: `ฮ่องเต้${pick(l, EMP)}`, age: randInt(l, 25, 60), temper: pick(l, ["wise", "wise", "tyrant", "puppet", "paranoid"] as Temper[]), health: randInt(l, 50, 90), since: yr - randInt(l, 0, 20) },
      empress: { name: `ฮองเฮา${pick(l, ["ชิงหลัน", "เหม่ยอิง", "อวี้ซู", "หลิงหลาน"])}`, clan: pick(l, CLANS), goal: pick(l, GOALS) },
      heir: chance(l, 0.7) ? { name: `องค์ชาย${pick(l, ["เฉิงอวี้", "หมิงเจ๋อ", "จิ้งหาน", "หยวนเจิ้ง"])}`, age: randInt(l, 5, 25), legit: randInt(l, 40, 85), backer: pick(l, ["empress", "consort", "ministers"] as const) } : undefined,
      eunuch: { name: pick(l, EUN), loyal: pick(l, ["emperor", "empress", "self"] as const), power: randInt(l, 30, 70) },
      ministers: randInt(l, 40, 70),
      military: randInt(l, 40, 70),
      inner: randInt(l, 30, 60),
      reigns: [],
    };
  }
  return w.court;
}

/** ข้อความสถานการณ์ราชสำนักสั้นๆ */
export function courtSummary(l: Life): string {
  const c = courtOf(l);
  return `${c.dynasty} · ${c.emperor.name} (${TEMPER[c.emperor.temper]}, ${c.emperor.age} พรรษา)${c.regent ? ` · ผู้สำเร็จราชการ: ${c.regent}` : ""}${c.heir ? ` · รัชทายาท ${c.heir.name}` : " · ยังไม่มีรัชทายาท"}`;
}

const EDICT_TEXT: Record<NonNullable<Court["edict"]>, string> = {
  ban_sects: "ราชโองการ: ห้ามสำนักยุทธ์รับศิษย์ใหม่ ผู้พกอาวุธในเมืองต้องขึ้นทะเบียน — ผู้ฝ่าฝืนมีโทษถึงตาย",
  heavy_tax: "ราชโองการ: เพิ่มภาษีที่นาอีกสามส่วนเพื่อสร้างพระราชวังฤดูร้อน",
  draft: "ราชโองการ: เกณฑ์ผู้มีวิชายุทธ์เข้ากองทัพชายแดน — ผู้หลบหนีถือเป็นกบฏ",
  amnesty: "ราชโองการ: นิรโทษกรรมทั่วแผ่นดินฉลองรัชกาลใหม่ นักโทษคดีเล็กได้รับอิสรภาพ",
};

/** ทุกปี: ฮ่องเต้แก่ลง ป่วย สวรรคต · การสืบราชบัลลังก์ตามแรงหนุน · ราชโองการตามนิสัยฮ่องเต้ */
function tickCourt(l: Life) {
  if (l.worldId !== "murim" || !l.alive || !l.mw) return;
  const c = courtOf(l);
  const w = l.mw;
  const yr = calYear(l);
  c.emperor.age++;
  if (c.heir) c.heir.age++;
  c.emperor.health = clamp(c.emperor.health - (c.emperor.age > 55 ? randInt(l, 2, 6) : randInt(l, -2, 3)), 0, 100);
  // ความชอบธรรมของราชวงศ์ตามนิสัยฮ่องเต้
  w.legitimacy = clamp(w.legitimacy + (c.emperor.temper === "wise" ? 1 : c.emperor.temper === "tyrant" ? -2 : -1), 0, 100);
  // ราชโองการ (ปีละไม่เกินหนึ่ง)
  if (!c.edict && chance(l, 0.08)) {
    c.edict = c.emperor.temper === "paranoid" || (c.emperor.temper === "tyrant" && w.cult > 60) ? "ban_sects" : c.emperor.temper === "tyrant" ? "heavy_tax" : w.era === "chaos" ? "draft" : chance(l, 0.3) ? "amnesty" : undefined;
    if (c.edict) {
      log(l, `📯 ${EDICT_TEXT[c.edict]}`, c.edict === "amnesty" ? "good" : "bad");
      if (c.edict === "heavy_tax") { w.unrest = clamp(w.unrest + 8, 0, 100); w.food = clamp(w.food - 5, 0, 100); }
      if (c.edict === "ban_sects") w.unrest = clamp(w.unrest + 4, 0, 100);
    }
  } else if (c.edict && chance(l, 0.25)) c.edict = undefined;
  // สวรรคต
  const dies = c.emperor.health <= 0 || chance(l, Math.max(0, c.emperor.age - 60) / 80);
  if (!dies) return;
  const old = c.emperor;
  const backers = c.heir ? (c.heir.backer === "empress" ? c.inner : c.heir.backer === "ministers" ? c.ministers : (c.inner + c.military) / 2) : 0;
  let how = "";
  if (c.heir && c.heir.legit >= 60 && backers >= 45) {
    how = "สืบราชสมบัติอย่างราบรื่น";
    if (c.heir.age < 16) { c.regent = chance(l, 0.5) ? c.empress.name : c.eunuch.name; how = `${how} (${c.regent} สำเร็จราชการแทน)`; }
    c.emperor = { name: `ฮ่องเต้${c.heir.name.replace("องค์ชาย", "")}`, age: c.heir.age, temper: pick(l, ["wise", "tyrant", "puppet", "paranoid"] as Temper[]), health: 85, since: yr };
    c.edict = "amnesty";
  } else if (c.heir || chance(l, 0.6)) {
    how = "สงครามแย่งชิงราชบัลลังก์";
    w.unrest = clamp(w.unrest + 30, 0, 100);
    w.legitimacy = clamp(w.legitimacy - 25, 0, 100);
    c.emperor = { name: `ฮ่องเต้${pick(l, EMP)}`, age: randInt(l, 20, 45), temper: pick(l, ["tyrant", "paranoid", "wise"] as Temper[]), health: 80, since: yr };
    c.regent = undefined;
  } else {
    how = "ราชวงศ์สิ้นทายาท — เชื้อพระวงศ์สายรองขึ้นครองราชย์โดยขุนนางเลือก";
    w.legitimacy = clamp(w.legitimacy - 10, 0, 100);
    c.emperor = { name: `ฮ่องเต้${pick(l, EMP)}`, age: randInt(l, 30, 55), temper: "puppet", health: 75, since: yr };
  }
  c.reigns.push({ name: old.name, from: old.since, to: yr, how });
  c.heir = chance(l, 0.6) ? { name: `องค์ชาย${pick(l, ["เฉิงอวี้", "หมิงเจ๋อ", "จิ้งหาน", "หยวนเจิ้ง", "ไท่เหอ"])}`, age: randInt(l, 1, 12), legit: randInt(l, 40, 85), backer: pick(l, ["empress", "consort", "ministers"] as const) } : undefined;
  log(l, `🏯 ${old.name}สวรรคตในพรรษา ${old.age} — ${how} · ${c.emperor.name}ขึ้นครองราชย์`, how.includes("สงคราม") ? "bad" : "milestone");
}

/** มีช่องทางเข้าวัง: ขุนนาง หมอที่มีชื่อ ยอดฝีมือที่ถูกเรียกตัว หรือเคยรับใช้ราชสำนัก */
export const palaceAccess = (l: Life) => !!l.flags.palaceAccess || (l.job?.careerId === "official" && l.job.level >= 2) || (l.job?.careerId === "herbalist" && l.job.level >= 4);

const court = (l: Life) => courtOf(l);

export const COURT_EVENTS: GameEvent[] = [
  E("ct.summon", [20, 70], (l) => `ราชรถหยุดหน้าบ้านคุณ ขันทีถือราชโองการอ่านเสียงดัง: ${court(l).emperor.name}ได้ยินชื่อเสียงของคุณ และเรียกตัวเข้าวังเพื่อ${pick(l, ["เป็นองครักษ์ฝ่ายใน", "สืบคดีลอบวางยาในวัง", "สอนวิชาป้องกันตัวให้องค์ชาย"])}`, [
    C("รับราชโองการ", BIG("ประตูวังชั้นในเปิดให้คุณเป็นครั้งแรก — ทุกย่างก้าวมีสายตาจับจ้อง", { flag: "palaceAccess", fame: 5, tael: 20 }), { pros: "อำนาจ ชื่อเสียง เงินเดือนหลวง", cons: "ต้องเชื่อฟังคำสั่ง ทุกฝ่ายในวังจะพยายามดึงคุณเป็นพวก" }),
    K("ทูลปฏิเสธอย่างนุ่มนวล", "smarts", 55, N("ขันทียิ้มเย็น แต่รับคำทูลกลับไป — คุณรอดจากการเมืองในวังได้อีกปี"), B("ราชสำนักถือว่าคุณดูหมิ่นพระราชโองการ — ชื่อคุณถูกจดไว้", { fame: -3, flag: "courtGrudge" })),
  ], { when: (l) => !l.flags.palaceAccess && ((l.power?.rank ?? 0) >= 4 || l.fame >= 40), weight: 4, title: "ราชโองการ" }),
  E("ct.lost_edict", [20, 80], (l) => `ราชโองการแต่งตั้งแม่ทัพชายแดนหายไประหว่างทาง — ${court(l).eunuch.name}ผู้รับผิดชอบเอกสารบอกว่าส่งไปแล้ว แต่แม่ทัพบอกว่าไม่เคยได้รับ`, [
    K("สืบจากบันทึกการเข้าออกประตูวัง", "smarts", 60, BIG("บันทึกเผยว่ามีคนเปลี่ยนเวรยามในคืนนั้น — ลายมือเป็นของคนสนิทฝ่ายฮองเฮา", { flag: "edictTruth", fame: 3 }), N("บันทึกถูกฉีกไปหน้าหนึ่ง — คุณรู้ว่ามีคนลบร่องรอยก่อนคุณ")),
    C("รายงานว่าขันทีทำหาย (ไม่มีหลักฐาน)", B("ขันทีถูกปลด แต่หลังจากนั้นทุกคนในวังเลิกไว้ใจคุณ — การกล่าวหาโดยไม่มีหลักฐานมีราคาแพง", { fame: -2, flag: "courtDistrust" })),
    C("ปิดเรื่องเงียบ ทำราชโองการใหม่", N("วิกฤตผ่านไป แต่คนที่ขโมยราชโองการยังลอยนวลอยู่ในวัง")),
  ], { when: palaceAccess, weight: 5, title: "ราชโองการที่หายไป" }),
  E("ct.suspected_prince", [20, 80], (l) => `ข่าวลือแพร่ทั่ววัง: ${court(l).heir?.name ?? "รัชทายาท"}ติดต่อลับกับแม่ทัพชายแดนเพื่อชิงบัลลังก์ — แหล่งข่าวคือนางกำนัลของสนมคนโปรด`, [
    K("ตรวจสอบหลักฐานก่อน", "smarts", 60, G("จดหมายทั้งหมดเป็นของปลอม ลายมือเลียนแบบได้ไม่สนิท — รัชทายาทพ้นมลทิน และจะจำคุณไปตลอด", { fame: 4, flag: "princeFavor" }), N("หลักฐานคลุมเครือ — คุณบอกได้แค่ว่ายังไม่แน่ชัด")),
    P("ปกป้องรัชทายาทต่อหน้าพระพักตร์", ab(0.5, "looks"), G("ฮ่องเต้ทรงเชื่อคุณ รัชทายาทรอด", { flag: "princeFavor", fame: 3 }), B("ฮ่องเต้กริ้วที่คุณเข้าข้างลูกชายที่อาจทรยศ — คุณถูกลดตำแหน่ง", { fame: -5, flag: "courtDistrust" })),
    C("ใช้สถานการณ์ต่อรองกับฝ่ายสนม", N("ฝ่ายสนมสัญญาตำแหน่งให้คุณ — คุณเพิ่งเลือกข้างในเกมที่แพ้แล้วไม่มีใครรอด", { tael: 50, align: -4, flag: "consortFaction" })),
  ], { when: (l) => palaceAccess(l) && !!court(l).heir, weight: 4, title: "รัชทายาทถูกกล่าวหา" }),
  E("ct.eunuch_secret", [20, 80], (l) => `${court(l).eunuch.name}เชิญคุณดื่มชาในห้องลับ "ข้ารู้ว่าใครวางยาฮ่องเต้องค์ก่อน — แลกกับการคุ้มครองชีวิตข้า"`, [
    C("ตกลงรับข้อเสนอ", (l, cx) => { const c = court(l); const truth = c.eunuch.loyal === "self" ? "เขาโกหกครึ่งหนึ่งเพื่อกำจัดศัตรูของตัวเอง" : "ข้อมูลเป็นความจริง — คนลงมือคือเสนาบดีกรมพระคลัง"; return BIG(`ข้อมูลที่ได้มา… ${truth}`, { flag: "eunuchDeal" })(l, cx); }, { pros: "รู้ความลับระดับราชวงศ์", cons: "ขันทีอาจหลอกใช้คุณ" }),
    C("ปฏิเสธ แล้วรายงานฮองเฮา", G("ฮองเฮาจดชื่อคุณไว้ในฐานะคนที่ไว้ใจได้ — ส่วนขันทีจะจดชื่อคุณไว้ในอีกบัญชี", { flag: "empressFavor" })),
    C("ทำเป็นไม่ได้ยิน", N("คุณดื่มชาจนหมด แล้วลุกกลับอย่างสุภาพ — ความลับบางเรื่องรู้แล้วอายุสั้น")),
  ], { when: palaceAccess, weight: 3, title: "ขันทีผู้รู้ความลับ" }),
  E("ct.grain_crisis", [20, 80], "ยุ้งฉางหลวงที่ควรมีข้าวสามปี เหลือไม่ถึงครึ่งปี — ราชสำนักสั่งให้หาตัวคนผิดภายในหนึ่งเดือน", [
    K("ไล่ตามเส้นทางเงิน", "smarts", 65, BIG("เงินค่าข้าวไหลเข้ากระเป๋าขุนนางสามคนกับพ่อค้าข้าวหนึ่งตระกูล — คุณเปิดโปงทั้งหมด ข้าวถูกยึดคืนแจกชาวบ้าน", { fame: 8, align: 4 }), B("เส้นทางเงินพาไปถึงคนที่ใหญ่เกินกว่าคุณจะแตะได้ — คุณได้รับคำเตือนให้หยุด", { joy: -5, flag: "courtThreat" })),
    C("โยนความผิดให้ภัยแล้ง", N("รายงานผ่านไปได้ — แต่ชาวบ้านยังหิว และคนโกงยังลอยนวล", { align: -3 })),
  ], { when: palaceAccess, weight: 3, title: "ยุ้งฉางหลวง" }),
  E("ct.regency", [20, 85], (l) => `${court(l).regent ?? "ผู้สำเร็จราชการ"}ปกครองแทนฮ่องเต้ที่ยังทรงพระเยาว์ — ขุนนางฝ่ายหนึ่งชวนคุณร่วมลงชื่อถวายฎีกาให้คืนพระราชอำนาจ`, [
    P("ลงชื่อ", ab(0.45, "smarts"), BIG("ฎีกาสำเร็จ ฮ่องเต้หนุ่มได้พระราชอำนาจคืน และจำชื่อทุกคนที่ลงชื่อ", { fame: 6, flag: "emperorFavor" }), B("ผู้สำเร็จราชการกวาดล้างทุกคนที่ลงชื่อ — คุณหนีออกจากเมืองหลวงได้ทันเพียงตัว", { fame: -4, flag: "fugitive", tael: -50 }), { tone: "danger", pros: "ถ้าสำเร็จ ได้ใจฮ่องเต้", cons: "ถ้าล้มเหลว ถูกกวาดล้าง" }),
    C("ปฏิเสธ อยู่เฉย", N("คุณไม่ลงชื่อ — ไม่ว่าฝ่ายไหนชนะ คุณก็ยังอยู่")),
  ], { when: (l) => palaceAccess(l) && !!court(l).regent, weight: 4, title: "ผู้สำเร็จราชการ" }),
  E("ct.clear_name", [25, 90], "ในหอจดหมายเหตุหลวง คุณพบบันทึกคดีเก่า — บรรพบุรุษของคุณถูกประหารในข้อหากบฏ แต่คำให้การของพยานสามคนขัดกันเอง", [
    K("รวบรวมหลักฐานยื่นขอล้างมลทิน", "smarts", 60, BIG("ราชสำนักประกาศคืนเกียรติให้บรรพบุรุษของคุณ — ป้ายวิญญาณที่ถูกซ่อนมาหลายสิบปีกลับขึ้นหิ้งหอบรรพชน", { fame: 6, joy: 12 }), B("ขุนนางที่สืบเชื้อสายจากผู้กล่าวหาเดิมขัดขวาง — คดีถูกปิดอีกครั้ง", { joy: -6 })),
    C("เก็บความลับไว้", N("บางความจริงก็ควรปล่อยให้หลับต่อไป — หรือรอให้คนรุ่นหลังมาเปิด", { flag: "ancestorSecret" })),
  ], { when: (l) => palaceAccess(l) && !!l.flags.knowsAncestor, weight: 5, title: "ล้างมลทินข้ามรุ่น" }),
  E("ct.ban_sects", [14, 90], "ราชโองการห้ามสำนักยุทธ์มาถึงภูเขาของคุณ ทหารหลวงมาตั้งด่านตรวจตีนเขา ศิษย์ที่ลงไปซื้อเสบียงถูกจับไปสองคน", [
    K("เจรจากับนายด่าน", "looks", 55, G("นายด่านยอมปล่อยศิษย์แลกกับคำสัญญาว่าสำนักจะไม่ลงเขาเป็นกลุ่ม", { fame: 2 }), B("นายด่านจับคุณขังรวมไปด้วย", { hp: -8, joy: -6 })),
    C("บุกชิงตัวศิษย์คืน", BIG("ศิษย์ทั้งสองถูกพากลับขึ้นเขา — และตอนนี้สำนักของคุณคือกบฏในสายตาราชสำนัก", { fame: 4, flag: ["courtGrudge", "rebelSect"], align: 2 })),
    C("ยอมตามราชโองการ", N("สำนักปิดประตูภูเขา ศิษย์ใหม่ไม่มีใครกล้าขึ้นมา — สำนักเงียบลงทุกปี", { joy: -4 })),
  ], { when: (l) => courtOf(l).edict === "ban_sects" && !!l.power?.guild, weight: 8, maxTimes: 2, title: "ห้ามสำนักยุทธ์" }),
  E("ct.found_dynasty", [30, 80], (l) => `แผ่นดินลุกเป็นไฟ ${court(l).emperor.name}เสียพระทัยจนไม่ออกว่าราชการ — ขุนศึก ชาวนา และจอมยุทธ์นับหมื่นมารวมตัวใต้ธงของคุณ ทุกคนรอคำเดียว`, [
    P("ยกทัพเข้าเมืองหลวง ตั้งราชวงศ์ใหม่", (l) => clamp(0.3 + l.fame / 300 + (l.power?.rank ?? 0) * 0.05, 0.2, 0.8), BIG("ประตูเมืองหลวงเปิดรับคุณ — วันนี้คุณคือฮ่องเต้ผู้ก่อตั้งราชวงศ์ใหม่", { flag: "foundedDynasty", fame: 40, goal: ["official", "ปกครองแผ่นดินที่เพิ่งได้มา"] }), B("ทัพหลวงซุ่มรอที่ช่องเขา — ทัพของคุณแตกพ่าย คุณหนีรอดพร้อมทหารไม่กี่ร้อยคน", { hp: -20, fame: -10, flag: "fugitive" }), { tone: "danger", pros: "บัลลังก์มังกร — ตอนจบที่ยิ่งใหญ่ที่สุดของคนธรรมดา", cons: "แพ้คือหนีหัวซุกหัวซุนไปตลอดชีวิต" }),
    C("ถวายความภักดีต่อราชวงศ์เดิม", G("ฮ่องเต้ทรงซาบซึ้ง พระราชทานยศอ๋องให้ — แผ่นดินสงบลงด้วยมือคุณ", { fame: 20, align: 6, flag: "loyalPrince" })),
    C("สลายกองทัพ กลับไปใช้ชีวิตธรรมดา", N("ผู้คนผิดหวัง แต่หลายสิบปีต่อมา นักประวัติศาสตร์เขียนว่าคุณคือคนเดียวที่มีอำนาจแล้ววางลงได้", { align: 8 })),
  ], { when: (l) => l.mw?.era === "chaos" && l.fame >= 50 && ((l.power?.rank ?? 0) >= 4 || !!l.flags.mwRebel || !!l.flags.veteran) && !l.flags.foundedDynasty, weight: 10, title: "บัลลังก์มังกร" }),
];

yearHooks.push(tickCourt);
