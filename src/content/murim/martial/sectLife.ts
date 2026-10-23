// ชีวิตในสำนัก (design/MURIM_V2.md ระยะ 2 · แบบมังฮวามูริม)
// ภารกิจสำนัก → ความดีความชอบ → สอบเลื่อนขั้นบนลานประลอง → หอคัมภีร์ → ชิงตำแหน่งเจ้าสำนัก
// สำนักที่เสื่อมถอย (เช่น สำนักเขาบุปผา) ฟื้นฟูได้ด้วยมือศิษย์คนเดียว
import { ACTIVITIES, type Activity } from "../../../engine/activities";
import type { Ctx, GameEvent } from "../../../engine/events";
import { runEvent } from "../../../engine/game";
import type { Life } from "../../../engine/types";
import { addFame, clamp, displayName, log } from "../../../engine/util";
import { guildById } from "../../hunter/power";
import { DUEL_END } from "../life/duel";
import { B, BIG, C, E, FIGHT, G, K, N, P, PAY, ab, near, type Res } from "../story/kit";
import { factionById, mySectFaction, shiftRep } from "../world/factions";
import { ARTS, knows, learn } from "./arts";

const M = (a: Omit<Activity, "world"> & { group: string }): Activity => ({ ...a, world: "murim" });
const sectOf = (l: Life) => l.power?.guild;
const sectName = (l: Life) => guildById(sectOf(l))?.name ?? "สำนัก";
const inSect = (l: Life) => !!sectOf(l) && l.job?.careerId === "disciple";
const lv = (l: Life) => (l.job?.careerId === "disciple" ? l.job.level : 0);
const merit = (l: Life) => Number(l.flags.sectMerit ?? 0);
/** ความดีความชอบที่ต้องมีก่อนสอบเลื่อนขั้นถัดไป */
const need = (l: Life) => 3 + lv(l) * 2;
const earn = (l: Life, n: number) => {
  l.flags.sectMerit = Math.max(0, merit(l) + n);
  if (l.job?.careerId === "disciple") l.job.performance = clamp(l.job.performance + n * 5, 0, 100);
  const f = mySectFaction(l);
  if (f && n > 0) shiftRep(l, f.id, n);
};
const fx = (r: Res, f: (l: Life, c: Ctx) => void): Res => ((l: Life, c: Ctx) => { f(l, c); return r(l, c); }) as Res;
const TITLES = ["", "ศิษย์นอก", "ศิษย์ใน", "ศิษย์สายตรง", "ผู้อาวุโส", "เจ้าสำนัก"];

export const SECT_LIFE_EVENTS: GameEvent[] = [
  // ───── ภารกิจสำนัก ─────
  E("sx.mission", [12, 90], (l) => `ป้ายภารกิจหน้าหอสำนักของ${sectName(l)} — ความดีความชอบตอนนี้ ${merit(l)}/${need(l)} (ครบแล้วได้ขึ้นลานสอบเลื่อนขั้นเป็น${TITLES[Math.min(5, lv(l) + 1)]})`, [
    P("ส่งจดหมายของเจ้าสำนักลงเขาไปเมืองใกล้", ab(0.65, "luck"), fx(G("จดหมายถึงมือผู้รับก่อนพระอาทิตย์ตก — ผู้อาวุโสพยักหน้าให้คุณครั้งแรก", { tael: 2 }), (l) => earn(l, 1)), B("ฝนตกกลางทาง จดหมายเปียกจนอ่านไม่ออก — ต้องเดินกลับไปขอฉบับใหม่ด้วยหน้าแดง", {})),
    K("คุ้มกันผู้อาวุโสไปงานเลี้ยงของสำนักพันธมิตร", "smarts", 45, fx(G("คุณรู้ว่าเมื่อไรควรพูด เมื่อไรควรเงียบ — ผู้อาวุโสชมคุณต่อหน้าเจ้าสำนักพันธมิตร", { fame: 1 }), (l) => earn(l, 2)), N("คุณเผลอพูดเรื่องภายในสำนักกลางงานเลี้ยง — ผู้อาวุโสมองคุณตาขวาง", {})),
    FIGHT("ปราบโจรที่ปล้นหมู่บ้านใต้เขา", "หัวหน้าโจรใต้เขา", near(0), { on: "sxMission", show: (l) => lv(l) >= 2 }),
    K("สืบข่าวลัทธิมารที่แฝงตัวในเมือง", "smarts", 55, fx(G("คุณตามสายลับของลัทธิมารไปถึงร้านขายผ้า — สำนักจับได้ทั้งเครือข่าย", { fame: 3 }), (l) => earn(l, 4)), fx(B("สายลับรู้ตัวก่อน — คุณถูกล้อมในตรอกและหนีกลับมาพร้อมแผลที่หลัง", { hp: -10 }), (l) => earn(l, 1)), { show: (l) => lv(l) >= 3 }),
    FIGHT("ชิงคัมภีร์ที่ถูกขโมยกลับคืน", "หัวขโมยคัมภีร์จากสำนักคู่แข่ง", near(1), { on: "sxScroll", show: (l) => lv(l) >= 3 }),
    C("ไม่รับภารกิจปีนี้", N("คุณกลับไปฝึกตามปกติ", {})),
  ], { when: inSect, weight: 0, maxTimes: 0, title: "ป้ายภารกิจสำนัก" }),

  // ───── สอบเลื่อนขั้น ─────
  E("sx.exam", [12, 90], (l) => `ลานประลองของ${sectName(l)}เต็มไปด้วยศิษย์ทั้งสำนัก — วันนี้คุณจะสอบเลื่อนเป็น${TITLES[Math.min(5, lv(l) + 1)]} คู่สอบคือศิษย์พี่ที่ไม่เคยแพ้ใครในรุ่น`, [
    FIGHT("ขึ้นลานประลอง", "ศิษย์พี่ผู้คุมสอบ", near(0), { on: "sxExam", spar: true }),
    C("ขอเลื่อนสอบไปปีหน้า", fx(N("ผู้อาวุโสพยักหน้า แต่ศิษย์รุ่นน้องเริ่มกระซิบกัน", {}), (l) => { l.flags.sectMerit = Math.max(0, merit(l) - 1); })),
  ], { when: (l) => inSect(l) && lv(l) < 4 && merit(l) >= need(l), forced: true, maxTimes: 0, title: "สอบเลื่อนขั้น" }),

  // ───── ชิงตำแหน่งเจ้าสำนัก ─────
  E("sx.succession", [30, 95], (l) => { const f = mySectFaction(l); return `${f?.leader ?? "เจ้าสำนัก"}แก่ชราและป่วยหนัก ผู้อาวุโสทั้งสำนักต้องเลือกผู้สืบทอด — ชื่อของคุณอยู่ในรายชื่อ ข้างๆ ชื่อของผู้อาวุโสอีกคนที่มีพวกมากกว่า`; }, [
    FIGHT("ประลองตัดสินต่อหน้าศิษย์ทั้งสำนัก", "ผู้อาวุโสคู่ชิงตำแหน่ง", near(0), { on: "sxSuccession", spar: true }),
    K("รวบรวมเสียงผู้อาวุโสทีละคน", "smarts", 60, fx(BIG("ผู้อาวุโสเจ็ดในเก้าคนยกมือให้คุณ — เจ้าสำนักคนเก่าส่งแหวนประจำตำแหน่งให้ด้วยมือที่สั่น", { fame: 10 }), (l) => becomeHead(l)), N("อีกฝ่ายมีพวกมากกว่า — คุณแพ้โหวตไปสองเสียง และต้องคุกเข่ารับเจ้าสำนักคนใหม่", { joy: -6 })),
    C("ถอนตัว — ไม่อยากแบกสำนักทั้งสำนัก", N("คุณยังเป็นผู้อาวุโสที่ทุกคนเคารพ และนอนหลับสบายกว่าเจ้าสำนักคนใหม่", { joy: 3 })),
  ], { when: (l) => inSect(l) && lv(l) === 4 && !!mySectFaction(l) && mySectFaction(l)!.leaderAge >= 68 && l.flags.sectHead !== sectOf(l), forced: true, maxTimes: 2, title: "ผู้สืบทอดตำแหน่ง" }),

  // ───── เรื่องในสำนัก ─────
  E("sx.bully", [12, 25], "ศิษย์พี่สามคนดักรอคุณหลังโรงครัว — \"ไอ้ลูกชาวนาคนนี้ได้กินข้าวสำนักฟรีมาสามปีแล้ว ถึงเวลาจ่ายค่าข้าวบ้าง\"", [
    FIGHT("สู้กลับ ทั้งที่รู้ว่าสู้สามคนไม่ได้", "ศิษย์พี่ขี้รังแก", near(0), { on: "sxBully", spar: true }),
    K("พาพวกเขาไปยืนตรงหน้าต่างห้องผู้อาวุโสพอดี", "smarts", 50, G("ผู้อาวุโสเปิดหน้าต่างออกมาพอดีตอนศิษย์พี่ยกกำปั้น — ทั้งสามคนถูกสั่งตักน้ำร้อยถังทุกวันหนึ่งเดือน", { iq: 1 }), B("ผู้อาวุโสไม่อยู่ห้อง — คุณโดนซ้อมหนักกว่าเดิม", { hp: -8 })),
    C("ยอมจ่ายเงินเก็บไป", N("พวกเขาหัวเราะแล้วจากไป — และจะกลับมาอีกเดือนหน้า", { tael: -1, joy: -4 })),
  ], { when: inSect, title: "ค่าข้าวของศิษย์พี่" }),
  E("sx.forbidden", [14, 40], (l) => `ห้องชั้นบนสุดของหอคัมภีร์${sectName(l)}มีกุญแจสามดอกและป้าย "ห้ามเข้า" — คืนนี้ผู้เฝ้าหอเมาหลับ`, [
    P("แอบขึ้นไปอ่านคัมภีร์ต้องห้าม", ab(0.4, "luck"), fx(BIG("ในหีบไม้มีคัมภีร์ที่ไม่มีใครในสำนักอ่านได้มาร้อยปี — คุณอ่านได้ ทั้งที่ไม่ควรอ่านได้", { iq: 3, flag: "readForbidden" }), (l) => { const g = sectOf(l); const art = ARTS.find((a) => a.sect === g && a.grade === 3); if (art) learn(l, art.id, "หอคัมภีร์ต้องห้าม"); }), fx(B("ผู้เฝ้าหอตื่นพอดี — คุณถูกโบยยี่สิบไม้กลางลานและถูกห้ามเข้าหอคัมภีร์สามปี", { hp: -10, fame: -2 }), (l) => earn(l, -3))),
    C("ไม่เสี่ยง — วิชาจะมาเองเมื่อถึงเวลา", N("คุณเดินผ่านหอคัมภีร์ไปโดยไม่หันกลับไปมอง", {})),
  ], { when: (l) => inSect(l) && lv(l) <= 3, title: "ห้องชั้นบนของหอคัมภีร์" }),
  E("sx.traitor_elder", [20, 70], (l) => `คุณเห็นผู้อาวุโสคนหนึ่งของ${sectName(l)}แอบพบชายสวมหน้ากากของลัทธิมารใต้สะพานกลางดึก — เขายื่นแผนผังภูเขาให้อีกฝ่าย`, [
    K("เก็บหลักฐานแล้วนำไปให้เจ้าสำนัก", "smarts", 55, fx(BIG("ผู้อาวุโสคนนั้นถูกจับคาที่ตอนส่งแผนผังฉบับที่สอง — คุณช่วยสำนักไว้จากการถูกบุกในคืนเดียว", { fame: 6, align: 4 }), (l) => earn(l, 6)), fx(B("เขารู้ตัวก่อน — และประกาศกลางที่ประชุมว่าคุณคือคนทรยศ", { fame: -5 }), (l) => earn(l, -4))),
    FIGHT("ขวางเขาไว้ตรงนั้น", "ผู้อาวุโสทรยศ", near(1), { on: "sxTraitor" }),
    C("ทำเป็นไม่เห็น", N("สามเดือนต่อมาลัทธิมารบุกภูเขาทางที่ไม่มีใครเฝ้า", { joy: -5 })),
  ], { when: (l) => inSect(l) && !guildById(sectOf(l))?.demonic, title: "แผนผังใต้สะพาน" }),
  E("sx.rival_meet", [15, 30], (l) => `งานประลองระหว่างสำนัก — ศิษย์เอกของสำนักคู่แข่งชี้กระบี่มาที่คุณกลางลาน "${sectName(l)}เหลือแค่ชื่อแล้วสินะ"`, [
    FIGHT("รับคำท้าเพื่อชื่อเสียงของสำนัก", "ศิษย์เอกของสำนักคู่แข่ง", near(0), { on: "sxRival", spar: true }),
    C("ยิ้มแล้วถอยลงจากลาน", N("ศิษย์ในสำนักของคุณก้มหน้าทั้งแถว", { fame: -1 })),
  ], { when: inSect, title: "งานประลองระหว่างสำนัก" }),
  E("sx.master_daughter", [16, 30], (l) => `${l.gender === "m" ? "ลูกสาว" : "ลูกชาย"}ของเจ้าสำนัก${sectName(l)}มาฝึกกระบี่ที่ลานเดียวกับคุณทุกเช้า — และเริ่มทำกระบี่หล่นใกล้คุณบ่อยเกินไป`, [
    C("เก็บกระบี่ส่งให้ แล้วชวนคุย", G("บทสนทนาเรื่องกระบวนท่ากลายเป็นบทสนทนาเรื่องอื่นในเดือนที่สาม", { joy: 6, meet: { rel: "partner", bond: 60 } })),
    C("ถอยห่าง — ลูกเจ้าสำนักคือปัญหา", N("คุณย้ายไปฝึกที่ลานหลังเขา ศิษย์พี่ที่หมายตาคนนั้นอยู่ก่อนแล้วโล่งใจ", {})),
  ], { when: inSect, title: "กระบี่ที่ตกบ่อยเกินไป" }),
];

/** ขึ้นเป็นเจ้าสำนัก */
function becomeHead(l: Life) {
  const g = sectOf(l);
  if (!g || !l.job) return;
  l.job.level = 5;
  l.flags.sectHead = g;
  const f = factionById(l, g);
  if (f) {
    f.leader = displayName(l);
    f.leaderAge = l.age;
    f.unity = clamp(f.unity + 10, 0, 100);
    shiftRep(l, g, 30);
  }
  log(l, `🏯 คุณขึ้นเป็นเจ้าสำนัก${guildById(g)?.name ?? ""} — แหวนประจำตำแหน่งหนักกว่าที่คิด`, "milestone");
}

DUEL_END.sxMission = (l, r) => (r === "win" ? (earn(l, 3), addFame(l, 2), "— ชาวบ้านใต้เขาส่งไก่ขึ้นมาให้สำนักทั้งเดือน") : r === "lose" || r === "yield" ? (earn(l, 1), "— โจรหนีไปได้ แต่หมู่บ้านรอด") : "");
DUEL_END.sxScroll = (l, r) => (r === "win" ? (earn(l, 5), addFame(l, 3), "— คัมภีร์กลับมาอยู่บนหิ้งของหอคัมภีร์ เจ้าสำนักเรียกชื่อคุณต่อหน้าที่ประชุม") : "");
DUEL_END.sxExam = (l, r) => {
  if (r !== "win" || !l.job || l.job.careerId !== "disciple") { l.flags.sectMerit = Math.floor(merit(l) / 2); return "— ยังไม่ผ่าน ปีหน้าค่อยขึ้นลานใหม่"; }
  l.job.level = Math.min(4, l.job.level + 1);
  l.job.performance = 55;
  l.flags.sectMerit = 0;
  addFame(l, 2 + l.job.level);
  return `— ผู้อาวุโสประกาศชื่อคุณเป็น${TITLES[l.job.level]}ของสำนัก ศิษย์รุ่นน้องเริ่มเรียกคุณว่าศิษย์พี่`;
};
DUEL_END.sxSuccession = (l, r) => (r === "win" ? (becomeHead(l), "— ทั้งลานคุกเข่าพร้อมกัน") : r === "lose" || r === "yield" ? "— คุณคุกเข่ารับเจ้าสำนักคนใหม่ต่อหน้าศิษย์ทั้งสำนัก" : "");
DUEL_END.sxBully = (l, r) => (r === "win" ? (addFame(l, 1), "— ศิษย์พี่ทั้งสามไม่เคยมาที่โรงครัวอีกเลย") : "— คุณนอนห้องยาสามวัน แต่ศิษย์พี่ก็จำได้ว่าคุณไม่ยอม");
DUEL_END.sxTraitor = (l, r) => (r === "win" ? (earn(l, 6), addFame(l, 6), "— คุณลากเขาที่ถูกสกัดจุดไปโยนไว้หน้าหอเจ้าสำนักตอนรุ่งสาง") : r === "lose" || r === "yield" ? "— เขาหนีไปพร้อมแผนผัง และรู้แล้วว่าคุณเห็น" : "");
DUEL_END.sxRival = (l, r) => (r === "win" ? (earn(l, 2), addFame(l, 4), "— ศิษย์ในสำนักโห่ร้องจนผู้อาวุโสต้องสั่งให้เงียบ") : "");

// ───── ฟื้นฟูสำนักที่เสื่อมถอย ─────
const weak = (l: Life) => { const f = mySectFaction(l); return !!f && (f.power < 45 || f.status === "declining" || f.status === "fallen"); };
export const REVIVE_EVENTS: GameEvent[] = [
  E("sx.revive", [18, 90], (l) => { const f = mySectFaction(l)!; return `${f.name}เหลือศิษย์ไม่ถึงสามสิบคน หลังคาหอบรรพชนรั่ว และสำนักข้างเขาส่งคนมาวัดที่ดินแล้ว (กำลังสำนัก ${f.power}/100)`; }, [
    PAY("ซ่อมหอบรรพชนด้วยเงินตัวเอง", 30, fx(G("หลังคาใหม่ไม่รั่วแล้ว — ศิษย์รุ่นเก่าสองคนที่ลงเขาไปทำงาน กลับขึ้นมาเพราะเห็นควันธูปอีกครั้ง", {}), (l) => bump(l, 5))),
    K("ลงเขาไปเกลี้ยกล่อมเด็กที่มีแววมาเป็นศิษย์", "looks", 45, fx(G("เด็กเจ็ดคนเดินตามคุณขึ้นเขา — หนึ่งในนั้นมีกระดูกที่หาได้ร้อยปีครั้ง", {}), (l) => bump(l, 6)), N("พ่อแม่ทุกบ้านส่ายหน้า \"สำนักนั้นจนจะตายอยู่แล้ว\"", {})),
    FIGHT("ไปทวงที่ดินคืนจากสำนักข้างเขา", "ผู้อาวุโสสำนักข้างเขา", near(0), { on: "sxReclaim" }),
    C("ปล่อยไปตามยถากรรม", N("ศิษย์อีกสามคนลงเขาไปในปีนั้น", {})),
  ], { when: (l) => inSect(l) && weak(l), weight: 0, maxTimes: 0, title: "สำนักที่กำลังจะดับ" }),
];
function bump(l: Life, n: number) {
  const f = mySectFaction(l);
  if (!f) return;
  const before = f.power;
  f.power = clamp(f.power + n, 0, 100);
  if (f.status === "fallen" && f.power >= 15) f.status = "declining";
  earn(l, 2);
  if (before < 55 && f.power >= 55 && !l.flags.sectRevived) {
    l.flags.sectRevived = true;
    addFame(l, 12);
    log(l, `🌸 ${f.name}กลับมายืนหยัดอีกครั้ง — ป้ายชื่อสำนักที่เคยมีแต่ฝุ่นถูกเช็ดจนเงา ยุทธภพเริ่มพูดชื่อนี้อีกครั้ง และพูดชื่อคุณด้วย`, "milestone");
  }
}
DUEL_END.sxReclaim = (l, r) => (r === "win" ? (bump(l, 8), addFame(l, 3), "— หลักเขตที่ดินถูกปักคืนที่เดิม") : r === "lose" || r === "yield" ? "— สำนักข้างเขาได้ที่ดินไปอีกแปลง" : "");

// ───── หอคัมภีร์: แลกความดีความชอบ ─────
const sectArt = (l: Life, grade: number) => ARTS.find((a) => a.sect === sectOf(l) && a.grade === grade && !knows(l, a.id));
export const LIBRARY_EVENTS: GameEvent[] = [
  E("sx.library", [12, 95], (l) => `ผู้เฝ้าหอคัมภีร์${sectName(l)}เปิดสมุดความดีความชอบ — คุณมี ${merit(l)} แต้ม`, [
    C((l) => `แลกวิชาพื้นฐานของสำนัก${sectArt(l, 2) ? `「${sectArt(l, 2)!.name}」` : ""} (2 แต้ม)`, fx(G("คุณได้คัดลอกคัมภีร์ด้วยมือตัวเองหนึ่งชุด", {}), (l) => { const a = sectArt(l, 2); if (a) learn(l, a.id, "หอคัมภีร์ของสำนัก"); earn(l, -2); }), { show: (l) => merit(l) >= 2 && !!sectArt(l, 2) }),
    C((l) => `แลกวิชาลับ${sectArt(l, 3) ? `「${sectArt(l, 3)!.name}」` : ""} (8 แต้ม · ศิษย์สายตรงขึ้นไป)`, fx(BIG("ผู้เฝ้าหอเปิดกุญแจสามดอกด้วยมือที่สั่น — สำนักนี้ไม่ได้มอบวิชานี้ให้ใครมาหลายปีแล้ว", {}), (l) => { const a = sectArt(l, 3); if (a) learn(l, a.id, "หอคัมภีร์ของสำนัก"); earn(l, -8); }), { show: (l) => merit(l) >= 8 && lv(l) >= 3 && !!sectArt(l, 3) }),
    C("แลกยาเม็ดทะลวงชีพจร (4 แต้ม)", fx(G("ยาเม็ดสีทองในกล่องหยก — ของจริงจากโรงยาของสำนัก", {}), (l) => { l.power?.items.push("ยาเม็ดทะลวงชีพจร"); earn(l, -4); }), { show: (l) => merit(l) >= 4 }),
    C("แลกกระบี่ประจำสำนัก (5 แต้ม)", fx(G("กระบี่ที่สลักชื่อสำนักไว้ที่ด้าม — คนในยุทธภพเห็นแล้วรู้ทันทีว่าคุณมาจากไหน", { fame: 1 }), (l) => { if (Number(l.flags.mwWeaponTier ?? 0) < 2) { l.flags.mwWeaponTier = 2; l.flags.mwWeapon = `กระบี่ประจำ${sectName(l)}`; } earn(l, -5); }), { show: (l) => merit(l) >= 5 && Number(l.flags.mwWeaponTier ?? 0) < 2 }),
    C("ยังไม่แลก — เก็บไว้ก่อน", N("ผู้เฝ้าหอปิดสมุด", {})),
  ], { when: inSect, weight: 0, maxTimes: 0, title: "หอคัมภีร์ของสำนัก" }),
];

ACTIVITIES.push(
  M({ group: "ยุทธภพ", id: "mw_sect_mission", emoji: "📜", name: "รับภารกิจสำนัก", desc: "สะสมความดีความชอบ ครบแล้วได้สอบเลื่อนขั้น", minAge: 12, available: inSect, run: (l) => { runEvent(l, "sx.mission"); return { text: "" }; } }),
  M({ group: "ยุทธภพ", id: "mw_sect_library", emoji: "📚", name: "หอคัมภีร์ของสำนัก", desc: "แลกความดีความชอบเป็นวิชา ยา หรือกระบี่", minAge: 12, available: (l) => inSect(l) && merit(l) >= 2, run: (l) => { runEvent(l, "sx.library"); return { text: "" }; } }),
  M({ group: "ยุทธภพ", id: "mw_sect_revive", emoji: "🌸", name: "ฟื้นฟูสำนัก", desc: "ซ่อมหอ หาศิษย์ ทวงที่ดินคืน", minAge: 18, available: (l) => inSect(l) && weak(l), run: (l) => { runEvent(l, "sx.revive"); return { text: "" }; } }),
);

export const ALL_SECT_LIFE_EVENTS = [...SECT_LIFE_EVENTS, ...REVIVE_EVENTS, ...LIBRARY_EVENTS];
