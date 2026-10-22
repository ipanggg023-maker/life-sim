// สำนักของคุณเอง (เขียนใหม่) — ก่อตั้ง รับศิษย์ เงิน ศัตรู ทรยศ ทายาท และวันที่ต้องลงจากตำแหน่ง
// ใช้ข้อมูลสำนักใน m17core (ศิษย์ d · ชื่อเสียง r · คู่อริ rv/rr · ศิษย์เอก h)
import type { GameEvent, Outcome } from "../../../engine/events";
import { kill } from "../../../engine/game";
import { chance } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, money } from "../../../engine/util";
import { gainExp, rankLabel } from "../../hunter/power";
import { SECT_COST, canFound, foundSect, hurt, mySect, npcName, saveSect, sectChange, sectNameOptions, shiftAlign } from "../m17core";

const S = (l: Life) => mySect(l)!;
const has = (l: Life) => !!mySect(l);
const yrs = (l: Life) => (mySect(l) ? l.age - mySect(l)!.y : 0);
const w = (n: number, f: (l: Life) => boolean = () => true) => (l: Life) => (has(l) && f(l) ? n : 0);
const ok = (text: string): Outcome => ({ text, kind: "good" });
const no = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });
const pow = (l: Life) => l.power?.rank ?? 0;

export const MYSECT_EVENTS: GameEvent[] = [
  {
    id: "sc.found",
    minAge: 28,
    maxAge: 110,
    maxTimes: 2,
    weight: (l) => (!canFound(l) ? 25 : 0),
    prepare: (l) => { const [a, b, c] = sectNameOptions(l); return { a, b, c }; },
    title: "ป้ายชื่อสำนัก",
    text: (l) => `ฝีมือขั้น${l.power ? rankLabel(l, l.power.rank) : ""}ของคุณดังจนมีคนมาคุกเข่าขอเป็นศิษย์ทุกสัปดาห์ ที่ดินบนเขาหลังเมืองว่างอยู่ — ค่าสร้างสำนัก ${money(l, SECT_COST)}`,
    choices: [
      { label: (_l, c) => `ตั้งชื่อ「${c.a}」`, run: (l, c) => ({ text: foundSect(l, String(c.a)), kind: "milestone" }) },
      { label: (_l, c) => `ตั้งชื่อ「${c.b}」`, run: (l, c) => ({ text: foundSect(l, String(c.b)), kind: "milestone" }) },
      { label: (_l, c) => `ใช้ชื่อตระกูล「${c.c}」`, run: (l, c) => ({ text: foundSect(l, String(c.c)), kind: "milestone" }) },
      { label: "ยังไม่ถึงเวลา", run: () => meh("คุณบอกคนที่มาขอเป็นศิษย์ให้กลับไปก่อน (ตั้งสำนักเองได้ที่แท็บวิชา)") },
    ],
  },
  {
    id: "sc.first_pupil",
    minAge: 28,
    maxAge: 120,
    weight: w(14, (l) => yrs(l) <= 3 && !S(l).h),
    prepare: (l) => ({ k: npcName(l) }),
    title: "เด็กในสายฝน",
    text: (_l, c) => `เด็กผอมชื่อ${c.k}คุกเข่าหน้าประตูสำนักกลางพายุมาสามวันแล้ว ศิษย์รุ่นแรกถามว่าจะให้ไล่ไปไหม`,
    choices: [
      { label: "ออกไปกางร่มให้เอง", run: (l, c) => { const s = S(l); s.h = String(c.k); saveSect(l, s); return ok(`${c.k}เงยหน้ามองร่มแล้วร้องไห้ — คุณได้ศิษย์เอกคนแรก${sectChange(l, { d: 1, r: 2 })}${shiftAlign(l, 2)}`); } },
      { label: "ให้คุกเข่าต่ออีกสามวัน", check: { stat: "luck", dc: 45 }, run: (l, c, s) => { if (s) { const x = S(l); x.h = String(c.k); saveSect(l, x); return ok(`วันที่หก${c.k}ยังไม่ขยับ — คุณรู้ว่าเด็กคนนี้จะไม่ยอมแพ้อะไรเลย${sectChange(l, { d: 1 })}`); } return no(`วันที่ห้า${c.k}หมดสติ ไข้ขึ้นจนเกือบตาย — ศิษย์ทุกคนมองคุณไม่เหมือนเดิม${sectChange(l, { r: -3 })}`); } },
    ],
  },
  {
    id: "sc.rules",
    minAge: 28,
    maxAge: 120,
    weight: w(10, (l) => yrs(l) <= 2),
    title: "กฎสำนัก",
    text: (l) => `ศิษย์ของ「${S(l).n}」มีมากพอจะเริ่มทะเลาะกันแล้ว — ถึงเวลาสลักกฎสำนักลงศิลาหน้าประตู`,
    choices: [
      { label: "เข้มงวด: ผิดกฎขับออก", run: (l) => ok(`ศิษย์ขี้เกียจหายไปครึ่งหนึ่ง ที่เหลือแข็งเหมือนเหล็ก${sectChange(l, { d: -2, r: 4 })}`) },
      { label: "อบอุ่น: สำนักคือบ้าน", run: (l) => ok(`ศิษย์ใหม่หลั่งไหลมา ชาวบ้านส่งลูกมาฝากเรียน${sectChange(l, { d: 4, r: 1 })}${shiftAlign(l, 2)}`) },
      { label: "แข็งแกร่งคือความถูกต้อง", run: (l) => meh(`ศิษย์ฆ่ากันเองไปหนึ่งคนในปีแรก — ที่เหลือโหดเหี้ยมและเก่งขึ้นเร็ว${sectChange(l, { d: -1, r: 2 })}${shiftAlign(l, -4)}`) },
    ],
  },
  {
    id: "sc.funds",
    minAge: 28,
    maxAge: 120,
    maxTimes: 3,
    weight: w(6, (l) => l.money < 300_000),
    title: "คลังว่าง",
    text: (l) => `คลังของ「${S(l).n}」เหลือข้าวสารสามกระสอบ หลังคาหอฝึกรั่ว ศิษย์เริ่มกินข้าวต้มทุกมื้อ`,
    choices: [
      { label: "รับงานคุ้มกันขบวนสินค้าทั้งสำนัก", skill: ["combat"], odds: (l) => clamp(0.45 + pow(l) * 0.07, 0.2, 0.92), run: (l, _c, s) => { if (s) { addMoney(l, 250_000); return ok(`ขบวนถึงปลายทางปลอดภัย — คลังเต็มอีกครั้ง${sectChange(l, { r: 2 })}`); } return no(`โจรดักกลางทาง ศิษย์ตายสองคน${sectChange(l, { d: -2, r: -3 })}` + hurt(l, 5, 15, "คุ้มกันขบวนสินค้า")); } },
      { label: "ขอเงินสนับสนุนจากเศรษฐีในเมือง", check: { stat: "looks", dc: 55 }, run: (l, _c, s) => { if (s) { addMoney(l, 180_000); return ok("เศรษฐีให้เงินพร้อมขอให้สอนลูกชายเขาด้วย — ไม่ใช่เงื่อนไขที่แย่"); } return meh("เศรษฐียิ้มแล้วบอกว่า 'ปีหน้าค่อยว่ากัน'"); } },
      { label: "เปิดสอนวิชาพื้นฐานให้ชาวบ้าน คิดค่าเรียน", run: (l) => { addMoney(l, 80_000); return meh(`ไม่ได้มาก แต่สม่ำเสมอ — และชาวบ้านเริ่มรักสำนักคุณ${sectChange(l, { r: 2 })}`); } },
    ],
  },
  {
    id: "sc.raid",
    minAge: 28,
    maxAge: 120,
    maxTimes: 0,
    weight: w(4, (l) => S(l).rr >= 50 && Number(l.flags.scRaid ?? -9) < l.age - 4),
    title: "คู่อริบุก",
    text: (l) => `${S(l).rv}ส่งคนสามสิบคนมาล้อมสำนักกลางดึก คบไฟเรียงเป็นแนวยาวบนเชิงเขา`,
    choices: [
      { label: "นำศิษย์ออกรบเอง", skill: ["combat"], tone: "danger", odds: (l) => clamp(0.4 + pow(l) * 0.08 + S(l).d / 300 - S(l).rr / 300, 0.1, 0.92), survival: (l) => clamp(0.8 + pow(l) * 0.03, 0.6, 0.98), run: (l, _c, s) => {
        l.flags.scRaid = l.age;
        if (s) { addFame(l, 6); return { text: `เช้ามา ${S(l).rv}ถอยกลับพร้อมคนเจ็บเต็มเกวียน — ชื่อสำนักคุณดังไปทั้งมณฑล${sectChange(l, { r: 6, rr: -15 })}`, kind: "milestone" }; }
        if (!chance(l, clamp(0.8 + pow(l) * 0.03, 0.6, 0.98))) { kill(l, `ตายขณะปกป้องสำนักจาก${S(l).rv}`); return no("คุณยืนขวางประตูสำนักจนลมหายใจสุดท้าย…"); }
        return no(`หอฝึกถูกเผา ศิษย์ตายห้าคน${sectChange(l, { d: -5, r: -5 })}` + hurt(l, 10, 22, "ศึกป้องกันสำนัก"));
      } },
      { label: "เจรจาก่อนเลือดตก", skill: ["social"], check: { stat: "smarts", dc: 60 }, run: (l, _c, s) => { l.flags.scRaid = l.age; if (s) return ok(`คุณออกไปคนเดียวพร้อมกาน้ำชา — รุ่งเช้าทั้งสองฝ่ายแยกย้าย โดยไม่มีใครตาย${sectChange(l, { r: 3, rr: -5 })}`); addMoney(l, -200_000); return no(`ต้องจ่ายค่าไถ่ ${money(l, 200_000)} ให้พวกมันถอย${sectChange(l, { r: -4 })}`); } },
    ],
  },
  {
    id: "sc.traitor",
    minAge: 30,
    maxAge: 120,
    weight: w(4, (l) => S(l).d >= 10),
    title: "คัมภีร์หาย",
    text: (l) => `คัมภีร์วิชาสำนักหายจากหอคัมภีร์ — ศิษย์คนหนึ่งหายไปพร้อมกัน และมีข่าวว่าไปโผล่ที่${S(l).rv}`,
    choices: [
      { label: "ตามไปเอาคืนด้วยตัวเอง", skill: ["combat"], odds: (l) => clamp(0.4 + pow(l) * 0.08, 0.15, 0.9), run: (l, _c, s) => { if (s) { addFame(l, 4); return ok(`คุณเอาคัมภีร์คืนมาได้ และลากศิษย์ทรยศกลับมาให้ทุกคนเห็น${sectChange(l, { r: 4 })}`); } return no(`คัมภีร์ถูกคัดลอกไปแล้ว — วิชาของสำนักไม่ใช่ความลับอีกต่อไป${sectChange(l, { r: -6, rr: 10 })}`); } },
      { label: "ปล่อยไป แล้วคิดวิชาใหม่", run: (l) => { gainExp(l, 600); return meh(`สามปีที่คุณคิดวิชาชุดใหม่ — ดีกว่าชุดเก่า แต่ศิษย์หลายคนต้องเรียนใหม่หมด${sectChange(l, { d: -3 })}`); } },
    ],
  },
  {
    id: "sc.genius",
    minAge: 30,
    maxAge: 120,
    weight: w(5, (l) => yrs(l) >= 3),
    prepare: (l) => ({ k: npcName(l) }),
    title: "อัจฉริยะในสำนัก",
    text: (_l, c) => `ศิษย์อายุสิบสามชื่อ${c.k}เรียนจบวิชาพื้นฐานที่คนอื่นใช้สามปี ในสามเดือน — ศิษย์พี่ๆ เริ่มอิจฉา`,
    choices: [
      { label: "สอนตัวต่อตัว", run: (l, c) => { const s = S(l); s.h = String(c.k); saveSect(l, s); return ok(`${c.k}กลายเป็นศิษย์เอกคนใหม่ — ศิษย์พี่สองคนลาออกด้วยความน้อยใจ${sectChange(l, { d: -2, r: 5 })}`); } },
      { label: "ให้เรียนตามลำดับเหมือนทุกคน", run: (l, c) => meh(`${c.k}เบื่อ แต่ไม่บ่น — ความยุติธรรมทำให้สำนักสงบ${sectChange(l, { r: 2 })}`) },
    ],
  },
  {
    id: "sc.disciple_dies",
    minAge: 30,
    maxAge: 120,
    weight: w(3, (l) => yrs(l) >= 4),
    title: "ศิษย์ที่ไม่กลับมา",
    text: (l) => `ศิษย์ของ「${S(l).n}」ถูกฆ่าตายระหว่างลงเขา — ศพถูกแขวนไว้ที่ประตูเมือง พร้อมป้ายเย้ยหยันชื่อสำนัก`,
    choices: [
      { label: "ตามล่าคนร้าย", skill: ["combat"], odds: (l) => clamp(0.4 + pow(l) * 0.08, 0.15, 0.92), run: (l, _c, s) => { if (s) { addFame(l, 5); return ok(`คนร้ายถูกพาตัวมาคุกเข่าหน้าหลุมศพศิษย์${sectChange(l, { r: 5 })}${shiftAlign(l, 1)}`); } return no("ร่องรอยหายไปที่ชายแดน — คุณกลับมามือเปล่า" + hurt(l, 5, 12, "ตามล่าคนร้าย")); } },
      { label: "จัดงานศพสมเกียรติ ห้ามศิษย์แก้แค้น", run: (l) => meh(`ศิษย์ที่เหลือก้มหน้ารับคำสั่ง — บางคนไม่เข้าใจ บางคนเข้าใจดีเกินไป${sectChange(l, { d: -1, r: -2 })}${shiftAlign(l, 2)}`) },
    ],
  },
  {
    id: "sc.official",
    minAge: 30,
    maxAge: 120,
    weight: w(3, (l) => S(l).d >= 15),
    title: "ขุนนางมาเยือน",
    text: () => "นายอำเภอคนใหม่มาเยี่ยมสำนัก — สำนักใหญ่ขนาดนี้ 'ควรจ่ายภาษีพิเศษ' และส่งศิษย์ไปช่วยทางการปราบโจรปีละสิบคน",
    choices: [
      { label: "ยอมตามเงื่อนไข", run: (l) => { addMoney(l, -100_000); return meh(`ทางการไม่มายุ่งอีก — แต่ศิษย์สิบคนต้องไปรบแทนทหารทุกปี${sectChange(l, { d: -3, r: 2 })}`); } },
      { label: "ปฏิเสธอย่างสุภาพ", check: { stat: "smarts", dc: 55 }, run: (l, _c, s) => { if (s) return ok(`คุณอ้างถึงราชโองการเก่าที่ยกเว้นภาษีสำนักศาสนา — นายอำเภอกลับไปมือเปล่า${sectChange(l, { r: 3 })}`); l.flags.courtBlacklist = true; return no(`นายอำเภอจดชื่อสำนักคุณลงสมุดดำ${sectChange(l, { r: -3 })}`); } },
    ],
  },
  {
    id: "sc.festival",
    minAge: 30,
    maxAge: 120,
    maxTimes: 3,
    weight: w(3, (l) => yrs(l) >= 5),
    title: "ครบรอบก่อตั้ง",
    text: (l) => `「${S(l).n}」ครบ ${yrs(l)} ปี ศิษย์รุ่นแรกที่ตอนนี้มีศิษย์ของตัวเองกลับมาคุกเข่าพร้อมกันกลางลาน`,
    choices: [
      { label: "จัดประลองภายในฉลอง", run: (l) => { gainExp(l, 300); return ok(`ศิษย์รุ่นสามชนะศิษย์รุ่นแรก — คุณหัวเราะจนน้ำตาไหล${sectChange(l, { r: 3, d: 2 })}`); } },
      { label: "เลี้ยงทั้งเมือง", run: (l) => { addMoney(l, -150_000); addFame(l, 4); return ok(`ชาวเมืองกินกันสามวัน — ชื่อสำนักกลายเป็นของทุกคน${sectChange(l, { r: 5 })}`); } },
    ],
  },
  {
    id: "sc.heir",
    minAge: 55,
    maxAge: 120,
    weight: w(6, (l) => yrs(l) >= 10),
    title: "ผู้สืบทอดสำนัก",
    text: (l) => `「${S(l).n}」ต้องการเจ้าสำนักคนต่อไป — ${S(l).h ? `ศิษย์เอก${S(l).h}` : "ศิษย์อาวุโสสองคน"}รออยู่ ลูกของคุณก็อยากได้ตำแหน่งนี้`,
    choices: [
      { label: "เลือกศิษย์เอก", run: (l) => ok(`ลูกของคุณเดินออกจากห้องโถงโดยไม่หันกลับ — แต่สำนักมีอนาคต${sectChange(l, { r: 4 })}`) },
      { label: "เลือกสายเลือดตัวเอง", run: (l) => meh(`ศิษย์เอกโค้งรับคำสั่งเงียบๆ — สามปีต่อมาเขาตั้งสำนักของตัวเอง${sectChange(l, { d: -6, r: -2 })}`) },
      { label: "จัดประลองตัดสิน", run: (l) => meh(`คนชนะได้ตำแหน่ง คนแพ้ได้แผล — ทุกคนยอมรับเพราะเป็นกติกาเก่าแก่${sectChange(l, { r: 2 })}`) },
    ],
  },
  {
    id: "sc.split",
    minAge: 40,
    maxAge: 120,
    weight: w(3, (l) => S(l).d >= 30 && S(l).r < 50),
    title: "สำนักแตก",
    text: () => "ศิษย์อาวุโสครึ่งหนึ่งประกาศแยกตัว พวกเขาบอกว่าคุณเปลี่ยนไป — สำนักไม่ใช่บ้านอย่างที่เคยสัญญา",
    choices: [
      { label: "ขอให้อยู่ต่อ ยอมรับข้อผิดพลาด", check: { stat: "looks", dc: 55 }, run: (l, _c, s) => (s ? ok(`ห้องโถงเงียบไปนาน แล้วศิษย์อาวุโสคนแรกก็นั่งลง${sectChange(l, { r: 5 })}`) : no(`พวกเขาจากไปอยู่ดี — สำนักเหลือครึ่งเดียว${sectChange(l, { d: -Math.floor(S(l).d / 2), r: -5 })}`)) },
      { label: "ปล่อยไป", run: (l) => no(`ครึ่งหนึ่งของชีวิตเดินออกจากประตูสำนัก${sectChange(l, { d: -Math.floor(S(l).d / 2), r: -3 })}`) },
    ],
  },
  {
    id: "sc.step_down",
    minAge: 65,
    maxAge: 120,
    weight: w(5, (l) => yrs(l) >= 15 && !l.flags.m17Retired),
    title: "ลงจากเก้าอี้",
    text: (l) => `คุณนั่งเก้าอี้เจ้า「${S(l).n}」มา ${yrs(l)} ปี เช้านี้ลุกขึ้นแล้วเข่าไม่ยอมเหยียด`,
    choices: [
      { label: "ส่งมอบตำแหน่ง ขึ้นไปอยู่กระท่อมบนยอดเขา", run: (l) => { l.flags.m17Retired = true; addStat(l, "happiness", 10); return { text: `พิธีส่งมอบเรียบง่าย — คุณเดินขึ้นเขาโดยไม่หันกลับมามอง ศิษย์ทั้งสำนักคุกเข่าส่งจนลับตา${sectChange(l, { r: 3 })}`, kind: "milestone" }; } },
      { label: "นั่งต่อจนกว่าจะตาย", run: (l) => meh(`ศิษย์อาวุโสบางคนเริ่มนับวัน${sectChange(l, { r: -2 })}`) },
    ],
  },
  {
    id: "sc.alliance",
    minAge: 35,
    maxAge: 120,
    weight: w(3, (l) => S(l).r >= 50),
    title: "พันธมิตรผ่านการแต่งงาน",
    text: () => "สำนักใหญ่ทางใต้เสนอแต่งงานระหว่างศิษย์เอกของสองสำนัก — พันธมิตรร้อยปี แต่ศิษย์เอกของคุณมีคนรักอยู่แล้ว",
    choices: [
      { label: "ตกลง เพื่ออนาคตของสำนัก", run: (l) => meh(`งานแต่งยิ่งใหญ่ — ศิษย์เอกยิ้มในงาน และร้องไห้หลังงาน${sectChange(l, { r: 6, rr: -10 })}${shiftAlign(l, -1)}`) },
      { label: "ปฏิเสธ ให้ศิษย์ได้เลือกเอง", run: (l) => ok(`สำนักใหญ่ไม่พอใจ — ศิษย์เอกคุกเข่าขอบคุณคุณทั้งน้ำตา${sectChange(l, { r: 1 })}${shiftAlign(l, 2)}`) },
    ],
  },
];

