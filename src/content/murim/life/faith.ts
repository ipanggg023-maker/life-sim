// ศีลของนักบวช (วัดวัชระ) และเส้นทางนักพรตเต๋าสองสาย (MURIM_PLAN §8 อาชีพ · EXPANSION §13 เส้นทางที่ไม่ใช่นักสู้)
// ศีลมีผลจริง: รักษาได้ = ใจสงบ ลมปราณนิ่ง อายุยืน · ผิดศีล = ต้องเลือกว่าจะปลงอาบัติ ปิดบัง หรือสึก
// ตรวจการผิดศีลจากสิ่งที่ทำจริง (ฆ่าคน มีคู่ครอง ดื่มสุรา/เล่นพนัน ลักขโมย) ไม่ใช่สุ่ม
import type { Ctx, GameEvent } from "../../../engine/events";
import { lifespanHooks, yearHooks } from "../../../engine/game";
import type { Life } from "../../../engine/types";
import { clamp, log } from "../../../engine/util";
import { addQi } from "../martial/arts";
import { B, BIG, C, E, G, K, N, type Res } from "../story/kit";

export type Vow = "buddhist" | "quanzhen" | "zhengyi";
export type Precept = "kill" | "celibacy" | "drink" | "steal";
export const VOWS: Record<Vow, { name: string; keeps: Precept[]; desc: string }> = {
  buddhist: { name: "ศีลภิกษุวัดวัชระ", keeps: ["kill", "celibacy", "drink", "steal"], desc: "ไม่ฆ่า ไม่ลัก ถือพรหมจรรย์ ไม่ดื่มสุราไม่เล่นพนัน" },
  quanzhen: { name: "ศีลนักพรตสายฉวนเจิน", keeps: ["kill", "celibacy", "drink"], desc: "ไม่ฆ่า ถือพรหมจรรย์ ไม่ดื่มสุรา — ฝึกกายใจเพื่อความเป็นอมตะ" },
  zhengyi: { name: "ศีลนักพรตสายเจิ้งอี", keeps: ["kill", "steal"], desc: "ไม่ฆ่า ไม่ลัก — มีครอบครัวได้ อยู่กับชาวบ้าน เขียนยันต์ประกอบพิธี" },
};
export const PRECEPT_NAME: Record<Precept, string> = { kill: "ฆ่าชีวิต", celibacy: "ผิดพรหมจรรย์", drink: "ดื่มสุรา/เล่นพนัน", steal: "ลักขโมย" };

export const vowOf = (l: Life): Vow | undefined => (l.flags.vow as Vow | undefined) || undefined;
const ORDER_JOBS = ["monk", "taoist"];

/** ตัวนับสิ่งที่ทำจริง (ใช้เทียบว่าปีนี้ผิดศีลข้อไหน) */
function counts(l: Life): Record<Precept, number> {
  const n = (k: string) => Number(l.flags[k] ?? 0);
  return {
    kill: n("mwKills"),
    celibacy: l.people.filter((p) => p.alive && (p.relation === "spouse" || p.relation === "partner")).length,
    drink: n("act_mw_tavern") + n("act_mw_gamble"),
    steal: n("act_mw_steal") + n("act_mw_rob") + n("act_mw_steal_manual"),
  };
}
const snap = (l: Life) => (l.flags.vowSnap = JSON.stringify(counts(l)));
function lastSnap(l: Life): Record<Precept, number> {
  try { return JSON.parse(String(l.flags.vowSnap)); } catch { return counts(l); }
}

/** รับศีล (ตอนบวช) */
export function takeVow(l: Life, v: Vow) {
  l.flags.vow = v;
  l.flags.vowSince = l.age;
  l.flags.vowKept = 0;
  delete l.flags.vowBreak;
  snap(l);
}
/** สึก/ลาสิกขา */
export function leaveOrder(l: Life, why: string) {
  delete l.flags.vow;
  delete l.flags.vowBreak;
  delete l.flags.vowSnap;
  l.flags.disrobed = true;
  log(l, `🍂 ${why}`);
}

/** ทุกปี: ผิดศีลข้อไหนบ้าง · รักษาได้ครบ = ได้ผลของศีล · ออกจากวัด/อารามแล้ว = ศีลสิ้นสุด */
function tickVows(l: Life) {
  if (l.worldId !== "murim" || !l.alive) return;
  const v = vowOf(l);
  if (!v) return;
  if (!ORDER_JOBS.includes(l.job?.careerId ?? "")) {
    leaveOrder(l, "คุณไม่ได้อยู่ในวัด/อารามแล้ว — ศีลที่เคยรับสิ้นสุดลงพร้อมผ้าครองที่พับเก็บไว้");
    return;
  }
  const before = lastSnap(l), now = counts(l);
  const broke = VOWS[v].keeps.filter((p) => now[p] > before[p]);
  snap(l);
  if (broke.length) {
    l.flags.vowBreak = broke.join(",");
    l.flags.vowKept = 0;
    return;
  }
  if (l.flags.vowBreak) return; // ยังไม่ได้จัดการเรื่องที่ผิดศีล
  l.flags.vowKept = Number(l.flags.vowKept ?? 0) + 1;
  // ผลของศีลที่รักษาได้: ใจนิ่ง ลมปราณสะสมง่าย ธรรมะเพิ่ม
  l.stats.happiness = clamp(l.stats.happiness + 1, 0, 100);
  if (l.power) addQi(l, v === "quanzhen" ? 0.7 : 0.5);
  l.flags.m17Align = clamp(Number(l.flags.m17Align ?? 0) + (v === "buddhist" ? 1 : 0.5), -100, 100);
}
yearHooks.push(tickVows);
// ศีลที่รักษามานาน + การปลีกวิเวกของนักพรต = อายุยืนขึ้น (ไม่เกิน 8 ปี)
lifespanHooks.push((l) => (l.worldId !== "murim" ? 0 : Math.min(8, Math.floor(Number(l.flags.vowKept ?? 0) / 10) + Number(l.flags.taoLongevity ?? 0) * 0.5)));

const broken = (l: Life) => String(l.flags.vowBreak ?? "").split(",").filter(Boolean) as Precept[];
const brokenText = (l: Life) => broken(l).map((p) => PRECEPT_NAME[p]).join(" และ ");
const inOrder = (job: string) => (l: Life) => l.job?.careerId === job && !vowOf(l);

/** ผลลัพธ์ที่รับศีลไปด้วย */
const vow = (v: Vow, r: Res): Res => Object.assign((l: Life, c: Ctx) => { takeVow(l, v); return r(l, c); }, { fx: r.fx });

export const FAITH_EVENTS: GameEvent[] = [
  E("vw.ordain_monk", [12, 90], "พิธีอุปสมบทที่วัดวัชระ — เจ้าอาวาสอ่านศีลทีละข้อ: ไม่ฆ่า ไม่ลัก ถือพรหมจรรย์ ไม่ดื่มสุราไม่เล่นพนัน \"รับได้หรือไม่\"", [
    C("รับศีลทั้งหมด", vow("buddhist", BIG("ผมร่วงลงพื้น คุณได้ฉายาทางธรรม — ศีลจะเป็นทั้งเกราะและโซ่ของคุณจากวันนี้", { joy: 3, align: 2 })), { pros: "ใจสงบ ลมปราณนิ่ง อายุยืน", cons: "ผิดศีลเมื่อไรต้องรับผล" }),
    C("ขอคิดอีกสักปี (ทำงานในวังวัดแบบฆราวาส)", N("เจ้าอาวาสพยักหน้า \"ศีลที่รับโดยไม่พร้อมคือศีลที่ขาดก่อนพรรษาแรก\"")),
  ], { when: inOrder("monk"), weight: 40, maxTimes: 3, title: "อุปสมบท" }),
  E("vw.ordain_tao", [12, 90], "เจ้าอารามจุดธูปสามดอก \"เส้นทางเต๋ามีสองสาย — ฉวนเจินถือพรหมจรรย์ ฝึกกายใจบนภูเขาเพื่อความเป็นอมตะ · เจิ้งอีอยู่กับชาวบ้าน มีครอบครัวได้ เขียนยันต์ประกอบพิธี\"", [
    C("สายฉวนเจิน — ละทางโลก", vow("quanzhen", BIG("คุณเกล้ามวยผมแบบนักพรต สวมชุดสีคราม — ภูเขาคือบ้านหลังใหม่", { joy: 2, align: 1 })), { pros: "ลมปราณสะสมเร็วกว่า อายุยืน", cons: "ห้ามมีคู่ครอง ห้ามดื่มสุรา" }),
    C("สายเจิ้งอี — อยู่กับผู้คน", vow("zhengyi", BIG("คุณได้รับป้ายยันต์และพู่กันประจำตัว — งานของคุณอยู่ในหมู่บ้าน ไม่ใช่บนยอดเขา", { joy: 3 })), { pros: "มีครอบครัวได้ ศีลน้อยข้อ", cons: "ลมปราณสะสมช้ากว่า" }),
    C("ขอทำงานในอารามไปก่อน", N("เจ้าอารามยิ้ม \"เต๋าไม่เร่งใคร\"")),
  ], { when: inOrder("taoist"), weight: 40, maxTimes: 3, title: "รับศีลนักพรต" }),

  E("vw.broken", [12, 100], (l) => `คืนนั้นคุณนั่งอยู่หน้าพระพุทธรูป/รูปเทพเจ้าโดยไม่ได้สวดอะไร — ปีนี้คุณ${brokenText(l)} ศีลข้อนั้นไม่มีอีกแล้ว และคุณรู้ดีกว่าใคร`, [
    C("สารภาพต่อหน้าคณะ ปลงอาบัติ", (l) => { const lv = l.job?.level ?? 1; if (l.job) l.job.level = Math.max(1, lv - 1); delete l.flags.vowBreak; return G("คณะสงฆ์/คณะนักพรตให้คุณกลับไปเริ่มเป็นผู้น้อย และอยู่ปฏิบัติหนึ่งพรรษาเต็ม — ศีลกลับมาบริสุทธิ์ แต่ทุกคนจำเรื่องนี้ได้", { joy: -2, align: 2, fame: -2 })(l, {}); }, { pros: "ศีลกลับมาบริสุทธิ์", cons: "ลดตำแหน่ง ชื่อเสียงลด" }),
    K("ปิดเป็นความลับ ทำเหมือนไม่มีอะไรเกิดขึ้น", "smarts", 55, (l, c) => { delete l.flags.vowBreak; l.flags.vowHidden = Number(l.flags.vowHidden ?? 0) + 1; return N("ไม่มีใครรู้ — แต่ทุกครั้งที่สวดบทนั้น เสียงของคุณสั่น", { joy: -4 })(l, c); }, (l, c) => { delete l.flags.vowBreak; if (l.job) l.job.level = 1; return B("ศิษย์รุ่นน้องเห็นทุกอย่าง — เรื่องรู้ไปถึงเจ้าอาวาสก่อนรุ่งเช้า คุณถูกลงโทษหนักกว่าสารภาพเอง", { fame: -6, joy: -6 })(l, c); }),
    C("สึกออกมาใช้ชีวิตทางโลก", (l, c) => { l.job = undefined; leaveOrder(l, "คุณถอดผ้าครองพับวางไว้หน้าแท่นบูชา แล้วเดินลงจากภูเขา"); return N("ทางโลกกว้างกว่าที่คิด — และหนักกว่าที่คิด", { joy: 1 })(l, c); }),
  ], { forced: true, when: (l) => !!vowOf(l) && !!l.flags.vowBreak, weight: 60, maxTimes: 0, title: "ศีลที่ขาด" }),

  E("vw.test_bandit", [16, 85], "โจรภูเขาสองคนดักปล้นขบวนผู้แสวงบุญที่คุณนำทาง — คนหนึ่งเงื้อดาบใส่หญิงชรา คุณมีไม้เท้าในมือ และศีลข้อแรกในใจ", [
    K("ปัดดาบ ทำให้หมดทางสู้โดยไม่ฆ่า", "health", 55, G("ไม้เท้ากระแทกข้อมือ ดาบหลุด — โจรวิ่งหนีไปพร้อมแขนเคล็ด ไม่มีใครตาย", { fame: 3, align: 2 }), B("คุณยั้งมือ — แต่โจรไม่ยั้ง แผลยาวพาดไหล่คุณ ผู้แสวงบุญหนีรอด", { hp: -12, wound: ["armL", "cut", 1] })),
    K("พูดให้โจรวางดาบ", "looks", 50, G("คุณเล่าเรื่องโจรที่กลายเป็นพระเอก — คนหนึ่งร้องไห้ อีกคนวางดาบแล้วขอข้าวหนึ่งห่อ", { align: 3, fame: 2 }), B("คำพูดไม่ได้ผล — พวกมันกวาดของมีค่าไปหมด", { tael: -10, joy: -3 })),
    C("ปลิดชีพมันเพื่อปกป้องคน", (l, c) => { l.flags.mwKills = Number(l.flags.mwKills ?? 0) + 1; return N("โจรล้มลง หญิงชรารอด — คุณช่วยคนได้ และผิดศีลไปพร้อมกัน", { align: -1, fame: 2 })(l, c); }, { tone: "danger" }),
  ], { when: (l) => !!vowOf(l) && VOWS[vowOf(l)!].keeps.includes("kill"), weight: 6, maxTimes: 2, title: "ศีลข้อแรก" }),
  E("vw.test_love", [16, 60], "คนที่มาไหว้ทุกเช้าวางจดหมายไว้ใต้กระถางธูป \"ถ้าท่านสึก ข้าจะรอ\" ลายมือสั่นเหมือนคนเขียนกลั้นใจ", [
    C("เผาจดหมาย แล้วสวดให้เขาพบคนที่ดี", G("ควันจางไป ใจคุณสงบกว่าที่คิด — ศีลยังครบ", { align: 1, joy: -1 })),
    C("ตอบรับ แต่ยังไม่สึก", (l, c) => N("คุณพบเขาลับๆ ที่ศาลาท้ายวัด — ใจหนึ่งร้อน ใจหนึ่งรู้ว่ากำลังเดินบนเส้นด้าย", { joy: 4, meet: { rel: "partner", age: l.age, bond: 65 } })(l, c)),
    C("สึกไปแต่งงาน", (l, c) => { l.job = undefined; leaveOrder(l, "คุณกราบลาคณะ แล้วเดินออกจากประตูวัดไปหาคนที่รอ"); return BIG("งานแต่งเล็กๆ ไม่มีแขกมาก แต่ทุกคนยิ้ม", { joy: 8, meet: { rel: "partner", bond: 75 } })(l, c); }),
  ], { when: (l) => !!vowOf(l) && VOWS[vowOf(l)!].keeps.includes("celibacy") && l.age >= 16, weight: 4, maxTimes: 1, title: "จดหมายใต้กระถางธูป" }),
  E("vw.keep_reward", [25, 100], (l) => `ครบ ${Number(l.flags.vowKept ?? 0)} ปีที่ศีลไม่ขาด — คืนหนึ่งระหว่างนั่งสมาธิ ลมหายใจของคุณช้าลงจนเหมือนหยุด แล้วทุกอย่างก็ใสขึ้น`, [
    C("นั่งต่อจนรุ่งเช้า", BIG("เช้านั้นศิษย์รุ่นน้องเห็นคุณนั่งนิ่งท่ามกลางน้ำค้าง ใบหน้าสงบเหมือนรูปปั้น — ข่าวลือเรื่องพระ/นักพรตผู้บรรลุแพร่ไปทั่ว", { fame: 6, exp: 800, joy: 5 })),
  ], { when: (l) => !!vowOf(l) && Number(l.flags.vowKept ?? 0) >= 10 && !l.flags.vowBreak, weight: 8, maxTimes: 2, title: "ศีลที่ไม่ขาด" }),
];
