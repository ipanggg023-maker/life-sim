// จดหมายจากบ้านและงานของครอบครัวที่อยู่ไกล
// อยู่สำนักแล้วพ่อแม่พี่น้องไม่เดินมาหา — เรื่องของบ้านมาเป็นจดหมายแทน และงานใหญ่ต้องเลือกว่าจะไปเอง ส่งของ หรือไม่ไป
// คนที่ถูกทิ้งจำได้ (hl.snubbed)
import { eligibilityFilters, type Ctx, type GameEvent } from "../../../engine/events";
import { kinDeathHooks } from "../../../engine/game";
import type { Life, Person, Relation } from "../../../engine/types";
import { mySectFaction } from "../world/factions";
import { B, C, E, G, N, ONE, PAY, call, kinDies, nm, who, withPerson, type Res } from "../story/kit";

const HOME: Relation[] = ["father", "mother", "sibling"];
/** อยู่ที่สำนัก ไม่ได้อยู่บ้าน */
export const awayFromHome = (l: Life) => !!mySectFaction(l) && l.power?.guild !== "families";

// เรื่องที่ต้องมีพ่อแม่พี่น้องอยู่ตรงหน้า รอจนกว่าจะไม่ได้อยู่สำนัก
eligibilityFilters.push((l, e) => {
  if (l.worldId !== "murim" || e.id.startsWith("hl.") || !awayFromHome(l)) return true;
  const rels = (e.prepare as { rels?: Relation[] } | undefined)?.rels;
  return !rels?.every((r) => HOME.includes(r));
});

const fx = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign(((l: Life, c: Ctx) => { f(l, c); return r(l, c); }) as Res, { fx: r.fx });
const tagged = (r: Res, tag: string) => fx(r, (l, c) => { const p = who(l, c); if (p) p.tags = [...(p.tags ?? []), tag]; });
/** ไม่ไปงาน — คนนั้นจะจำได้ */
const snub = (r: Res) => fx(r, (l, c) => { l.flags.hlSnub = String(c.pid); l.flags.hlSnubAge = l.age; });
const endFuneral = (r: Res) => fx(r, (l) => { delete l.flags.hlFuneral; });
const noTag = (p: Person, tag: string) => !p.tags?.includes(tag);

const parent = withPerson(["father", "mother"]);
const oldParent = withPerson(["father", "mother"], (p) => p.age >= 55 && noTag(p, "hlSick"));
const sibWed = withPerson(["sibling"], (p) => p.age >= 18 && p.age <= 40 && noTag(p, "hlWed"));
const childWed = withPerson(["child"], (p) => p.age >= 18 && p.age <= 35 && noTag(p, "hlWed"));
const grandchild = withPerson(["child"], (p) => p.age >= 20 && p.age <= 45 && !noTag(p, "hlWed") && noTag(p, "hlGrand"));
const childSick = withPerson(["child"], (p) => p.age >= 18 && noTag(p, "hlSick"));

export const LETTER_EVENTS: GameEvent[] = [
  // ───── จดหมายจากบ้าน ─────
  E("hl.letter", [12, 60], (l, c) => `จดหมายจากบ้านมาถึงสำนัก ลายมือของ${call(l, c)} "ปีนี้ข้าวดี ทุกคนสบายดี กินให้อิ่ม อย่าห่วงทางนี้"`, [
    C("เขียนตอบยาวๆ", G("คุณเขียนถึงเรื่องบันไดพันขั้นและอาหารโรงครัว — เขาอ่านให้คนทั้งบ้านฟัง", { joy: 3, feel: { love: 4 } })),
    PAY("ส่งเงินกลับไปด้วย", 3, G("เงินถึงบ้านก่อนหน้าหนาว — หลังคาที่รั่วได้ซ่อมเสียที", { joy: 4, feel: { love: 6, debt: 4 } })),
    C("เก็บไว้ใต้หมอน ค่อยตอบวันหลัง", N("วันหลังไม่เคยมาถึง จดหมายยังอยู่ใต้หมอน", { joy: -1, feel: { love: -2 } })),
  ], { ...parent, when: awayFromHome, maxTimes: 4, weight: 7, title: "จดหมายจากบ้าน" }),

  E("hl.money", [14, 50], (l, c) => `จดหมายของ${call(l, c)}สั้นกว่าทุกครั้ง "ปีนี้แล้ง นาไม่ได้ผล ถ้าพอมีให้ช่วยบ้าง ถ้าไม่มีก็ไม่เป็นไร"`, [
    PAY("ส่งเงินเท่าที่มี", 8, G("บ้านผ่านหน้าหนาวไปได้ — ไม่มีใครต้องขายนา", { joy: 3, feel: { love: 6, debt: 6 } })),
    C("ตอบว่าตอนนี้ไม่มีจริงๆ", N("คุณเขียนคำขอโทษสามบรรทัด เขียนใหม่สี่รอบ", { joy: -3 })),
    C("ไม่ตอบ", snub(B("จดหมายฉบับถัดมาไม่มาอีกเลย", { joy: -2, feel: { love: -6, grudge: 4 } }))),
  ], { ...parent, when: awayFromHome, maxTimes: 2, weight: 3, title: "จดหมายขอความช่วยเหลือ" }),

  // ───── งานไกลบ้าน: ไปเอง · ส่งของ · ไม่ไป ─────
  E("hl.sibling_wed", [14, 70], (l, c) => `จดหมายจากบ้าน: ${call(l, c)}จะแต่งงานเดือนหน้า ทั้งบ้านถามว่าคุณจะกลับไหม`, [
    PAY("เดินทางกลับไปเอง", 3, tagged(G((l, c) => `คุณถึงทันตอนจุดประทัด ${nm(l, c)}เห็นคุณที่ประตูแล้วร้องไห้ทั้งชุดแต่งงาน`, { joy: 6, hp: -1, feel: { love: 8, loyalty: 4 }, mem: ["wedding", "กลับมาทันงานแต่ง", 2] }), "hlWed")),
    PAY("ส่งของขวัญกับจดหมาย", 1, tagged(N("ของขวัญถึงงาน คนอ่านจดหมายของคุณให้แขกฟัง — เก้าอี้ของคุณยังว่างอยู่", { joy: 1, feel: { love: 2 } }), "hlWed")),
    C("ไม่ไป ไม่ส่งอะไร", snub(tagged(B("งานจบไปโดยไม่มีชื่อคุณ", { joy: -2, feel: { love: -6, grudge: 5 }, mem: ["snub", "ไม่มางานแต่ง", 2] }), "hlWed"))),
  ], { ...sibWed, when: awayFromHome, maxTimes: 3, weight: 6, title: "งานแต่งที่บ้าน" }),

  E("hl.parent_sick", [16, 90], (l, c) => `ข่าวด่วนจากบ้าน: ${call(l, c)}ล้มป่วยหนัก หมอบอกให้เตรียมใจ ถ้าจะกลับต้องออกเดินทางคืนนี้`, [
    PAY("ออกเดินทางคืนนี้", 4, tagged(ONE(
      G((l, c) => `คุณเฝ้าไข้อยู่สามเดือน ${nm(l, c)}ลุกขึ้นนั่งกินข้าวต้มได้เอง`, { joy: 6, feel: { love: 10, debt: 5 }, mem: ["vigil", "กลับมาเฝ้าไข้", 3] }),
      fx(kinDies("คุณถึงบ้านทันจับมือในคืนสุดท้าย เขายิ้มและเรียกชื่อตอนเด็กของคุณ", "ป่วยหนัก", { align: 1 }), (l) => { l.flags.hlSkipFuneral = true; }),
    ), "hlSick")),
    PAY("ส่งยาดีกับเงินกลับไป", 6, tagged(G("ยาถึงทัน อาการดีขึ้น เขาถามหาคุณทุกวันแต่ไม่บ่นสักคำ", { joy: 1, feel: { love: 3 } }), "hlSick")),
    C("อยู่ที่นี่ต่อ", snub(tagged(fx(kinDies("ข่าวร้ายมาถึงอีกสิบวันให้หลัง คุณอ่านจดหมายจบแล้วกลับไปฝึกต่อ แต่จับกระบี่ไม่อยู่", "ป่วยหนัก", { joy: -8 }), (l) => { l.flags.hlSkipFuneral = true; }), "hlSick"))),
  ], { ...oldParent, when: awayFromHome, maxTimes: 2, weight: 4, title: "ข่าวด่วนจากบ้าน" }),

  E("hl.funeral", [10, 120], (l, c) => `จดหมายขอบดำมาถึงสำนัก: ${call(l, c)}จากไปแล้ว งานศพจะจัดในเจ็ดวัน`, [
    PAY("กลับไปร่วมงาน", 3, endFuneral(G("คุณสวมผ้าป่านคุกเข่าหน้าศพจนเข่าแตก พี่น้องที่เหลือจับมือคุณไม่ปล่อย", { joy: 2, align: 1 }))),
    PAY("ส่งเงินทำบุญกับจดหมาย", 2, endFuneral(N("เงินถึงงาน ชื่อคุณถูกอ่านหน้าศพ คุณจุดธูปหนึ่งดอกอยู่หลังเขา", {}))),
    C("ไม่ไป ไม่ส่งอะไร", endFuneral(fx(B("คุณพับจดหมายเก็บ — คนในบ้านนับวันแล้วเลิกรอ", { joy: -4 }), (l) => { const s = l.people.find((p) => p.alive && p.relation === "sibling"); if (s) { l.flags.hlSnub = s.id; l.flags.hlSnubAge = l.age; } }))),
  ], { when: (l) => l.flags.hlFuneral !== undefined && !!l.people.find((p) => p.id === l.flags.hlFuneral), prepare: (l) => ({ pid: String(l.flags.hlFuneral) }), forced: true, maxTimes: 0, title: "จดหมายขอบดำ" }),

  E("hl.child_wed", [36, 100], (l, c) => `${call(l, c)}ส่งข่าวจากเมืองที่ไปตั้งตัว: จะแต่งงานฤดูใบไม้ผลินี้ ถามว่าคุณจะมานั่งเก้าอี้ผู้ใหญ่ไหม`, [
    PAY("เดินทางไปเอง", 5, tagged(G((l, c) => `คุณนั่งเก้าอี้ผู้ใหญ่รับน้ำชา มือของ${nm(l, c)}สั่นตอนยกจอกให้คุณ`, { joy: 7, feel: { love: 8, respect: 5 }, mem: ["wedding", "มานั่งเก้าอี้ผู้ใหญ่ให้", 3] }), "hlWed")),
    PAY("ส่งสินสอดกับจดหมาย", 8, tagged(N("ของหนักคันรถถึงงาน คนชมว่าบ้านนี้ใจกว้าง — แต่เก้าอี้ยังว่าง", { joy: 1, feel: { love: 2, debt: 3 } }), "hlWed")),
    C("ไม่ไป", snub(tagged(B("เก้าอี้ผู้ใหญ่ว่างทั้งงาน แขกเลิกถามหลังจอกที่สาม", { joy: -3, feel: { love: -8, grudge: 6 }, mem: ["snub", "ไม่มางานแต่งของข้า", 3] }), "hlWed"))),
  ], { ...childWed, maxTimes: 4, weight: 6, title: "งานแต่งของลูก" }),

  E("hl.grandchild", [40, 110], (l, c) => `จดหมายจาก${call(l, c)}: หลานคนแรกของคุณเกิดแล้ว ยังไม่มีชื่อ รอให้ปู่ย่าตายายตั้ง`, [
    PAY("เดินทางไปอุ้มหลานเอง", 3, tagged(G("หลานกำนิ้วคุณไว้แน่น คุณอยู่ต่ออีกครึ่งเดือนโดยไม่ได้ตั้งใจ", { joy: 8, feel: { love: 6 } }), "hlGrand")),
    C("ตั้งชื่อใส่จดหมายกลับไป", tagged(N("คุณเขียนชื่อเดียวบนกระดาษทั้งแผ่น ชื่อนั้นถูกปักบนผ้าห่ม", { joy: 3, feel: { love: 3 } }), "hlGrand")),
    C("ให้เขาตั้งเอง ไม่ตอบ", snub(tagged(B("ปีต่อมาคุณรู้ชื่อหลานจากคนอื่น", { joy: -2, feel: { love: -5 } }), "hlGrand"))),
  ], { ...grandchild, maxTimes: 4, weight: 5, title: "หลานคนแรก" }),

  E("hl.child_sick", [36, 110], (l, c) => `ข่าวจากต่างเมือง: ${call(l, c)}ป่วยหนักมาหลายเดือน ไม่ได้บอกใครเพราะกลัวคุณเป็นห่วง`, [
    PAY("ไปดูแลเอง", 4, tagged(G((l, c) => `${nm(l, c)}ลืมตาเห็นคุณต้มยาอยู่ข้างเตียงแล้วเงียบไปนาน`, { joy: 3, feel: { love: 10, debt: 6 }, mem: ["vigil", "มาดูแลตอนป่วย", 3] }), "hlSick")),
    PAY("ส่งหมอกับเงินไปให้", 6, tagged(N("หมอที่ดีที่สุดในเมืองออกเดินทางแทนคุณ อาการดีขึ้น", { feel: { love: 3 } }), "hlSick")),
    C("เขียนจดหมายให้กำลังใจ", snub(tagged(B("กระดาษแผ่นเดียวข้ามเมืองไป — เขาหายเอง และจำได้ว่าใครไม่มา", { feel: { love: -5, grudge: 4 } }), "hlSick"))),
  ], { ...childSick, maxTimes: 3, weight: 3, title: "ข่าวป่วยจากต่างเมือง" }),

  // ───── คนที่ถูกทิ้งจำได้ ─────
  E("hl.snubbed", [14, 120], (l, c) => `${call(l, c)}มายืนตรงหน้าคุณเป็นครั้งแรกในรอบหลายปี "ตอนนั้น... ข้ารอท่าน" ไม่มีคำโกรธสักคำ ซึ่งแย่กว่า`, [
    C("คุกเข่าขอโทษ ไม่แก้ตัว", fx(G("เงียบอยู่นาน แล้วเขาก็ดึงคุณลุกขึ้น", { joy: 3, feel: { love: 8, grudge: -8 } }), (l) => { delete l.flags.hlSnub; })),
    C("อธิบายว่าตอนนั้นจำเป็น", fx(N("เขาฟังจนจบ พยักหน้า และไม่พูดเรื่องนี้อีกเลย", { feel: { grudge: -2 } }), (l) => { delete l.flags.hlSnub; })),
    C("บอกว่าเรื่องผ่านไปแล้ว", fx(B("เขามองคุณอีกครั้ง แล้วเดินจากไปโดยไม่หันกลับ", { joy: -4, feel: { love: -10, grudge: 8 } }), (l) => { delete l.flags.hlSnub; })),
  ], {
    when: (l) => l.flags.hlSnub !== undefined && l.age >= Number(l.flags.hlSnubAge) + 3 && !!l.people.find((p) => p.alive && p.id === l.flags.hlSnub),
    prepare: (l) => ({ pid: String(l.flags.hlSnub) }),
    maxTimes: 0, weight: 14, title: "เรื่องที่ยังไม่จบ",
  }),
];

kinDeathHooks.push((l, p) => {
  if (l.worldId !== "murim" || !awayFromHome(l) || !HOME.includes(p.relation)) return;
  if (l.flags.hlSkipFuneral) { delete l.flags.hlSkipFuneral; return; }
  l.flags.hlFuneral = p.id;
});
