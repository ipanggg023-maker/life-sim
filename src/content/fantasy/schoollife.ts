// ชีวิตในโรงเรียนเชิงลึก: สอบประจำปี อันดับในรุ่น งานประลอง คู่ปรับที่เติบโตเอง ความลับ และทางเลือกนอกโรงเรียน
import type { Ctx, GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { randInt } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { clamp, createPerson, log, shortName } from "../../engine/util";
import { recordChronicle } from "../../engine/worldState";
import { B, BIG, C, E, G, K, N, P, SCENE, type Res } from "./kit";
import { learnSpell, spellChoices, spellsOf, SPELLS } from "./magic";
import { fightOdds } from "./power";
import { deed, fl, worldOfLife } from "./state";
import { underdogWin } from "./stars";

const student = (l: Life) => !!fl(l).school && !fl(l).graduated;
const noSchool = (l: Life) => !fl(l).school;
export const rivalOf = (l: Life): Person | undefined => l.people.find((p) => p.id === fl(l).rivalId);
const rivalName = (l: Life) => { const r = rivalOf(l); return r ? shortName(r) : "คู่ปรับ"; };
const score = (l: Life, d: number) => { const f = fl(l); f.classScore = clamp((f.classScore ?? 50) + d, 0, 100); };
export const classStanding = (l: Life) => { const s = fl(l).classScore ?? 50; return s >= 85 ? "ที่หนึ่งของรุ่น" : s >= 65 ? "กลุ่มหัวกะทิ" : s >= 40 ? "กลางๆ ของรุ่น" : "ท้ายแถว"; };
const firstSpell = (l: Life) => SPELLS.find((s) => s.tier === 1 && s.element === fl(l).element)!;

/** บทความลับสามตอนของแต่ละโรงเรียน */
const SECRETS: Record<string, [string, string, string]> = {
  arcanvale: ["ใต้หอดูดาวมีบันไดที่นับขั้นได้ไม่เท่ากันทุกครั้ง", "ปลายบันไดคือห้องของอาจารย์ใหญ่คนแรก ซึ่งไม่เคยออกจากห้องมาสามร้อยปี", "เขายังมีชีวิตอยู่ในรูปของตัวอักษรบนผนัง และถามว่าคุณพร้อมรับช่วงต่อไหม"],
  steelcrest: ["รอยดาบบนเสาลานฝึกเรียงเป็นกระบวนท่าที่ไม่มีในตำรา", "มันคือท่าของผู้ก่อตั้ง ที่ถูกลบจากบันทึกเพราะเคยฆ่าเพื่อนร่วมสำนัก", "คุณฝึกจนจบท่า และเข้าใจว่าทำไมเขาถูกลบชื่อ"],
  lionheart: ["ห้องประชุมสภานักเรียนมีเก้าอี้ว่างตัวหนึ่งที่ห้ามนั่ง", "ลูกหลานขุนนางส่งต่อคำสาบานลับกันมาสองร้อยปี", "สมาชิกกลุ่มนี้ตัดสินว่าใครจะได้ครองบัลลังก์รุ่นถัดไป และเขาเสนอที่นั่งให้คุณ"],
  mercy: ["ผู้ป่วยในเรือนหลังสุดไม่เคยหายและไม่เคยตาย", "พวกเขาคือทหารจากสงครามเมื่อหลายร้อยปีก่อน ถูกเวทรักษารั้งไว้", "คุณต้องเลือกว่าจะรักษาต่อไป หรือปล่อยให้พวกเขาได้พัก"],
  beastwarden: ["ลูกสัตว์ในคอกไม่เคยโตเกินวัยหนึ่งปี", "คอกทั้งหมดสร้างทับรังของสัตว์ที่อาจารย์ไม่กล้าเอ่ยชื่อ", "แม่ของพวกมันยังอยู่ใต้ดิน และเธอจำกลิ่นคุณได้"],
};


const roundThreat = (l: Life, c: Ctx) => (Number(c.round) >= 3 ? fl(l).rivalPower ?? 20 : 4 + Number(c.round) * 4 + (l.age - 11));
const roundThreatOdds = (l: Life, c: Ctx) => fightOdds(l, roundThreat(l, c));
const roundLose = N("คุณตกรอบ แต่ได้ประสบการณ์กลับไป", { hp: -2, body: 3, magic: 2 });
const roundWin: Res = (l, c) => {
  const r = Number(c.round);
  if (r >= 3) return BIG(`คุณชนะ${rivalName(l)} ถ้วยรางวัลเป็นของคุณ`, { fame: 8, joy: 8, body: 5, magic: 5 }, (x) => { score(x, 12); fl(x).cups = (fl(x).cups ?? 0) + 1; if (fl(x).cups === 1) deed(x, "แชมป์งานประลองโรงเรียน"); })(l, c);
  runEvent(l, "ft.s.round", { round: r + 1 });
  return { text: `คุณผ่านรอบที่ ${r}`, kind: "good" };
};

export const SCHOOL_EVENTS: GameEvent[] = [
  E("ft.s.exam", [11, 40], (l) => `สอบปลายปีแล้ว ตอนนี้คุณอยู่${classStanding(l)}`, [
    K("อ่านหนังสือจนเช้า", "smarts", 50, G("ชื่อคุณขึ้นบนกระดาน", { iq: 1 }, (l) => score(l, 12)), N("ข้อสุดท้ายออกเรื่องที่คุณข้ามไป", {}, (l) => score(l, -6))),
    K("ซ้อมภาคปฏิบัติ", "health", 50, G("กรรมการเงยหน้าจากสมุด", { body: 4, magic: 4 }, (l) => score(l, 10)), N("คุณพลาดต่อหน้ากรรมการ", {}, (l) => score(l, -6))),
    C("ติวให้เพื่อนในห้อง", G("คะแนนคุณไม่ขึ้น แต่ทั้งห้องรักคุณ", { joy: 4 }, (l) => score(l, 2))),
  ], { when: (l) => student(l) && l.age > Number(fl(l).schoolSince) && l.flags.ftExam !== l.age, forced: true, maxTimes: 0, title: "สอบปลายปี", prepare: (l) => { l.flags.ftExam = l.age; return {}; } }),

  E("ft.s.cup", [12, 40], "งานประลองประจำโรงเรียนเริ่มแล้ว ผู้ชมเต็มอัฒจันทร์ และป้ายชื่อคุณอยู่บนสาย", [
    C("ลงสนาม", (l) => { runEvent(l, "ft.s.round", { round: 1 }); return { text: "คุณเดินลงสนามท่ามกลางเสียงเชียร์" }; }),
    C("ถอนตัวปีนี้", N("คุณนั่งดูจากอัฒจันทร์และจดท่าของคู่แข่ง", { body: 2 })),
  ], { when: (l) => student(l) && (l.age - Number(fl(l).schoolSince)) % 2 === 1, forced: true, maxTimes: 0, title: "งานประลอง" }),
  SCENE("ft.s.round", "งานประลอง", (l, c) => (Number(c.round) >= 3 ? `รอบชิงชนะเลิศ คนตรงหน้าคือ${rivalName(l)} คู่ปรับของคุณ` : `รอบที่ ${c.round}`), [
    P("สู้เต็มที่", roundThreatOdds, roundWin, roundLose),
    ...spellChoices(roundThreat, () => undefined, () => undefined, () => roundWin, roundLose),
  ]),
  E("ft.s.rival_talk", [12, 40], (l) => `${rivalName(l)}มานั่งข้างคุณบนหลังคาหอพัก คืนนี้ไม่มีใครทะเลาะกัน`, [
    C("คุยกันตรงๆ", G("คุณรู้ว่าเขาเองก็กลัวเหมือนกัน", { joy: 3 }, (l) => { const r = rivalOf(l); if (r) { r.bond = clamp(r.bond + 20, 0, 100); r.relation = r.bond >= 60 ? "friend" : "rival"; } })),
    C("ท้าเขาพรุ่งนี้อีกรอบ", N("เขายิ้ม นี่คือคำตอบที่เขาอยากได้ยิน", { body: 2 })),
  ], { when: (l) => student(l) && !!rivalOf(l)?.alive, weight: 12, maxTimes: 2, title: "บนหลังคา" }),

  E("ft.s.secret", [12, 60], (l) => SECRETS[fl(l).school ?? "arcanvale"][fl(l).secret ?? 0], [
    K("สืบต่อ", "smarts", 50, (l, c) => {
      const f = fl(l), n = (f.secret ?? 0) + 1;
      f.secret = n;
      if (n < 3) return G("คุณบันทึกทุกอย่างลงสมุดเล่มเล็ก", { magic: 4, body: 4 })(l, c);
      return BIG("คุณรู้ความลับของโรงเรียนแล้ว และไม่มีวันมองที่นี่เหมือนเดิม", { iq: 3, magic: 15, body: 15 }, (x) => { deed(x, "รู้ความลับของโรงเรียน"); recordChronicle(worldOfLife(x), `${x.firstName}ค้นพบความลับของ${f.school}`); })(l, c);
    }, N("คนดูแลเดินผ่านมา คุณต้องรอปีหน้า")),
    C("ปล่อยไว้", N("บางประตูปิดไว้ก็ดีแล้ว")),
  ], { when: (l) => !!fl(l).school && (fl(l).secret ?? 0) < 3, weight: 40, maxTimes: 8, title: "ความลับของโรงเรียน" }),

  E("ft.s.rival_return", [26, 80], (l) => `${rivalName(l)} คู่ปรับสมัยเรียน กลับมาพร้อมชื่อเสียง เขาบอกว่ายังติดค้างการประลองกับคุณอยู่`, [
    P("รับคำท้า", (l) => fightOdds(l, fl(l).rivalPower ?? 30), (l, c) => ({ ...G("คุณชนะ และเขาหัวเราะเป็นครั้งแรกในรอบสิบปี", { fame: 8, joy: 5 })(l, c), text: `คุณชนะ และเขาหัวเราะเป็นครั้งแรกในรอบสิบปี${underdogWin(l, rivalOf(l)?.stars)}` }), B("เขาเก่งขึ้นมาก คุณได้แผลเป็นเป็นที่ระลึก", { hp: -8 })),
    C("ชวนไปดื่มแทน", G("พวกคุณเล่าเรื่องเก่าจนร้านปิด", { joy: 7 })),
  ], { when: (l) => !!fl(l).graduated && !!rivalOf(l)?.alive, weight: 10, maxTimes: 2, title: "คู่ปรับเก่า" }),

  E("ft.o.master", [12, 30], "ชายชราถือไม้เท้าหยุดดูคุณซ้อมอยู่นาน แล้วพูดว่าโรงเรียนสอนคุณผิดทั้งนั้น ทั้งที่คุณไม่ได้เรียนโรงเรียนไหน", [
    K("ขอเดินทางไปกับเขาหนึ่งปี", "looks", 40, G("เขาสอนสิ่งที่ไม่มีในตำรา แล้วจากไปโดยไม่บอกลา", { body: 18, magic: 12 }, (l) => { deed(l, "ศิษย์ของอาจารย์พเนจร"); if (!spellsOf(l).length && fl(l).wand) learnSpell(l, firstSpell(l).id); }), N("เขาส่ายหน้าแล้วเดินต่อ")),
    C("ขอบคุณแล้วลา", N("คุณจำท่าที่เขาชี้ได้หนึ่งท่า", { body: 3 })),
  ], { when: noSchool, weight: 14, title: "อาจารย์พเนจร" }),
  E("ft.o.library", [14, 60], "น้ำลดจากซากหอสมุดเก่า หนังสือในหีบตะกั่วยังอ่านได้ครบ", [
    K("อ่านทุกเล่มที่กู้ได้", "smarts", 50, G("คุณเรียนรู้จากครูที่ตายไปแล้วหลายร้อยปี", { iq: 4, magic: 16 }, (l) => { if (!spellsOf(l).length) learnSpell(l, firstSpell(l).id); }), N("ภาษาเก่าเกินจะอ่านออก คุณขายหีบให้พ่อค้า", { gold: 12 })),
    C("แจ้งทางการ", N("นักปราชญ์หลวงขอบคุณคุณ และยึดทุกอย่างไป", { fame: 2 })),
  ], { when: noSchool, weight: 10, title: "หอสมุดใต้น้ำ" }),
  E("ft.o.mercs", [15, 40], "กองทหารรับจ้างธงดำกำลังรับคน ไม่ถามชื่อ ไม่ถามอดีต", [
    P("เข้าร่วมหนึ่งฤดูกาล", (l) => fightOdds(l, 16), G("คุณได้เงิน ได้แผล และได้เพื่อนที่พร้อมตายเคียงข้างคุณ", { gold: 30, body: 18, hp: -5 }, (l) => { const p = createPerson(l, "friend", { age: Math.max(18, l.age + randInt(l, 0, 8)), bond: 70 }); p.job = "ทหารรับจ้าง"; }), B("กองคุณถูกทิ้งไว้แนวหน้า", { hp: -14, body: 8 })),
    C("เดินผ่านไป", N("คุณไม่อยากขายดาบให้ใคร")),
  ], { when: noSchool, weight: 10, title: "ธงดำ" }),
];

yearHooks.push((l) => {
  if (l.worldId !== "fantasy" || !l.ft || !l.alive) return;
  const f = fl(l);
  f.manaUsed = 0;
  // คู่ปรับฝึกของเขาเอง ไม่ได้รอผู้เล่น
  if (rivalOf(l)?.alive) {
    const before = f.rivalPower ?? 15;
    f.rivalPower = Math.min(f.rivalPeak ?? 95, before + (student(l) ? randInt(l, 1, 3) : randInt(l, 2, 6)));
    if (before < 70 && f.rivalPower >= 70) log(l, `ข่าวมาถึงหูคุณ: ${rivalName(l)}กลายเป็นยอดฝีมือที่คนทั้งแผ่นดินรู้จัก`);
  }
});
