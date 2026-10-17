// M21: ภารกิจจากระบบที่มากกว่าภารกิจประจำปี — ภารกิจลงโทษ · ภารกิจลับ · ภารกิจต่อเนื่อง · นิสัยของระบบ
import type { GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { randInt } from "../../engine/rng";
import type { Life, SysStat } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, money, people, shortName } from "../../engine/util";
import { effSys } from "../gameStats";
import { markTurn } from "../hunter/power";
import { SYS_CAP, gainSysExp } from "./sys";

const sys = (text: string, next?: string): Outcome => ({ text, kind: "system", next });
const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });

const has = (l: Life) => !!l.sys;
const lv = (l: Life) => l.sys?.level ?? 0;
const pts = (l: Life, n: number) => { if (l.sys) l.sys.points += n; };
const up = (l: Life, k: SysStat, n: number) => { if (l.sys) l.sys[k] = clamp(l.sys[k] + n, 0, SYS_CAP); };
const step = (l: Life, key: string) => Number(l.flags[key] ?? 0);
/** ปีที่แล้วไม่ได้ทำภารกิจรายวันเลย */
const skippedDaily = (l: Life) => has(l) && Number(l.flags.dailyAt ?? l.age) < l.age - 1;
const pardon = (l: Life) => { l.flags.dailyAt = l.age - 1; };

// ───────────────────────── ภารกิจลงโทษ ─────────────────────────

const PENALTY: GameEvent[] = [
  {
    id: "o21.pen_centipede",
    minAge: 8, maxAge: 70, forced: true,
    when: skippedDaily,
    system: true,
    title: "ภารกิจลงโทษ: มิติทะเลทราย",
    text: () => "[บทลงโทษ] ผู้ใช้ไม่ทำภารกิจรายวันตลอดปีที่ผ่านมา\n「ภารกิจลงโทษ: เอาชีวิตรอดในมิติทะเลทรายสี่ชั่วโมง」\nพริบตาเดียวคุณยืนอยู่บนเนินทราย และพื้นใต้เท้าเริ่มสั่น — ตะขาบยาวเท่ารถไฟโผล่ขึ้นมา",
    choices: [
      { label: "วิ่ง! วิ่งไม่หยุด!", tone: "danger", skill: ["escape"], odds: (l) => clamp(0.45 + effSys(l, "sta") / 120 + effSys(l, "agi") / 200, 0.3, 0.97), run: (l, _c, ok) => { pardon(l); if (ok) { up(l, "sta", 3); return sys("[ภารกิจลงโทษสำเร็จ] คุณกลับมานอนหอบบนเตียงตัวเอง ทรายยังติดอยู่ในรองเท้า (STA +3)"); } addStat(l, "health", -18); if (l.stats.health <= 0) { kill(l, "หัวใจวายขณะหลับ (ไม่มีใครรู้ว่าเกิดอะไรขึ้นจริงๆ)"); return bad("…"); } return bad("ตะขาบกัดขาคุณก่อนเวลาหมดสิบนาที — คุณตื่นขึ้นมาพร้อมรอยช้ำที่หมอก็อธิบายไม่ได้"); } },
      { label: "ขุดหลุมซ่อนตัวแล้วภาวนา", check: { stat: "luck", dc: 50 }, run: (l, _c, ok) => { pardon(l); if (ok) return sys("ตะขาบเลื้อยผ่านไปเฉยๆ — [ระบบ] 「วิธีนี้ไม่ควรได้ผล แต่ก็ได้ผล」"); addStat(l, "health", -10); return bad("ทรายถล่มทับคุณ ระบบดึงกลับมาตอนเกือบขาดอากาศ"); } },
    ],
  },
  {
    id: "o21.pen_pushups",
    minAge: 8, maxAge: 70, forced: true,
    when: (l) => skippedDaily(l) && (l.seen["o21.pen_centipede"] ?? 0) > 0,
    system: true,
    title: "ภารกิจลงโทษ: กลางห้างสรรพสินค้า",
    text: () => "[บทลงโทษ] ผู้ใช้ขี้เกียจซ้ำสอง\n「ภารกิจลงโทษ: วิดพื้น 300 ครั้ง ภายใน 1 ชั่วโมง — สถานที่: ตรงนี้」\nตรงนี้ คือกลางลานห้างสรรพสินค้าในวันลดราคา",
    choices: [
      { label: "วิดพื้นกลางห้าง", check: { stat: "health", dc: 45 }, run: (l, _c, ok) => { pardon(l); up(l, "str", 2); if (ok) { addFame(l, 2); return good("ครบ 300 ครั้ง มีคนปรบมือ มีคนอัดคลิป มีพนักงานห้างมาถามว่าขายอาหารเสริมอะไร (STR +2)"); } addStat(l, "happiness", -5); return bad("คุณหมดแรงที่ครั้งที่ 180 แล้วนอนคว่ำหน้าอยู่หน้าร้านชุดชั้นใน — ระบบไม่ยกเว้นโทษ"); } },
      { label: "ปฏิเสธ", run: (l) => { pardon(l); addStat(l, "health", -8); if (l.sys) l.sys.exp = 0; return sys("[ระบบ] การปฏิเสธถูกบันทึก — ปวดหัวรุนแรงสามวัน และ EXP เลเวลนี้ถูกรีเซ็ต"); } },
    ],
  },
  {
    id: "o21.pen_silence",
    minAge: 12, maxAge: 80, forced: true,
    when: (l) => skippedDaily(l) && (l.seen["o21.pen_pushups"] ?? 0) > 0,
    system: true,
    title: "ภารกิจลงโทษ: เงียบ",
    text: () => "[บทลงโทษ] 「ภารกิจลงโทษ: ห้ามพูดคำว่า 'ไม่' เป็นเวลา 7 วัน」\nวันแรก หัวหน้าถามว่าคุณว่างทำงานเสาร์อาทิตย์ไหม",
    choices: [
      { label: "ตอบว่า 'ได้ครับ/ค่ะ' ทุกเรื่อง", run: (l) => { pardon(l); addStat(l, "happiness", -6); if (l.job) l.job.performance = clamp(l.job.performance + 15, 0, 100); return meh("เจ็ดวันนั้นคุณรับงานเพิ่มสามโปรเจกต์ ยืมเงินเพื่อนไปสองคน และสมัครยิมรายปีโดยไม่ตั้งใจ"); } },
      { label: "เลี่ยงคำด้วยความฉลาด", check: { stat: "smarts", dc: 55 }, run: (l, _c, ok) => { pardon(l); if (ok) { up(l, "int", 2); return sys("「เดี๋ยวขอเช็กตารางก่อนนะ」 — [ระบบ] ช่องโหว่ทางภาษาถูกยอมรับ (INT +2)"); } addStat(l, "health", -6); return bad("วันที่สามคุณหลุดปาก ไฟช็อตเบาๆ วิ่งผ่านกระดูกสันหลัง"); } },
    ],
  },
  {
    id: "o21.pen_ghost",
    minAge: 15, maxAge: 80, forced: true,
    when: (l) => skippedDaily(l) && (l.seen["o21.pen_silence"] ?? 0) > 0,
    system: true,
    title: "ภารกิจลงโทษ: โรงพยาบาลร้าง",
    text: () => "[บทลงโทษ] ระบบเริ่มหงุดหงิด\n「ภารกิจลงโทษ: เก็บป้ายชื่อ 7 อันในโรงพยาบาลร้าง ก่อนตีสี่」\nไฟฉายในมือคุณกะพริบตั้งแต่ก้าวแรก",
    choices: [
      { label: "เดินเก็บทีละชั้นอย่างใจเย็น", check: { stat: "happiness", dc: 50 }, run: (l, _c, ok) => { pardon(l); if (ok) { gainSysExp(l, 200); return sys("ป้ายชื่ออันสุดท้ายเขียนชื่อคุณ — [ระบบ] 「ล้อเล่น」 (EXP +200)"); } addStat(l, "happiness", -10); return bad("คุณได้ยินเสียงเรียกชื่อจากห้องผ่าตัด แล้ววิ่งออกมาโดยไม่หันหลัง ระบบหักคะแนนความกล้า"); } },
      { label: "พาเพื่อนไปด้วย", run: (l) => { pardon(l); const f = people(l, "friend")[0]; if (f) { f.bond = clamp(f.bond + 10, 0, 100); return good(`${shortName(f)}กรี๊ดดังกว่าผีทุกตัว แต่ก็อยู่ด้วยจนครบเจ็ดอัน — มิตรภาพที่ผ่านโรงพยาบาลร้างด้วยกันไม่มีวันจาง`); } addStat(l, "happiness", -4); return meh("คุณไม่มีเพื่อนจะชวน — ระบบส่งข้อความ 「นี่ก็เป็นบทลงโทษในตัวแล้ว」"); } },
    ],
  },
  {
    id: "o21.pen_final",
    minAge: 18, maxAge: 90, forced: true,
    when: (l) => skippedDaily(l) && (l.seen["o21.pen_ghost"] ?? 0) > 0,
    system: true,
    title: "คำเตือนครั้งสุดท้าย",
    text: () => "[คำเตือนสุดท้าย] 「ผู้ใช้ละเลยภารกิจซ้ำหลายปี — ระบบกำลังพิจารณาหาผู้ใช้คนใหม่」\nหน้าต่างสีฟ้ากะพริบเป็นสีแดงเป็นครั้งแรก",
    choices: [
      { label: "ขอโทษระบบ สัญญาว่าจะตั้งใจ", run: (l) => { pardon(l); if (l.sys) l.sys.points = Math.max(0, l.sys.points - 3); return sys("[ระบบ] 「คำสัญญาถูกบันทึก」 — แต้มสถานะที่ยังไม่แจก -3 เป็นค่ามัดจำ"); } },
      { label: "บอกระบบว่าอยากไปก็ไป", run: (l) => { pardon(l); for (const k of ["str", "agi", "sta", "int", "cha", "luk"] as SysStat[]) up(l, k, -2); addStat(l, "happiness", 6); return sys("[ระบบ] 「…」 หน้าต่างเงียบไปทั้งเดือน แล้วกลับมาพร้อมค่าสถานะที่ลดลง แต่คุณรู้สึกเป็นตัวของตัวเองที่สุดในรอบหลายปี"); } },
    ],
  },
];

// ───────────────────────── ภารกิจลับ ─────────────────────────

const HIDDEN: GameEvent[] = [
  {
    id: "o21.hid_grandma",
    minAge: 10, maxAge: 40, weight: 8,
    when: (l) => has(l) && l.people.some((p) => p.alive && (p.relation === "father" || p.relation === "mother") && p.age >= 55),
    system: true,
    title: "ภารกิจลับ: กลับบ้าน",
    text: () => "[ภารกิจลับถูกปลดล็อก] 「เงื่อนไข: ผู้ปกครองอายุเกิน 55 และผู้ใช้ไม่ได้กลับบ้านมาเกินหกเดือน」\n「ภารกิจ: กินข้าวเย็นที่บ้านทุกวันอาทิตย์ตลอดหนึ่งปี」",
    choices: [
      { label: "รับภารกิจ", run: (l) => { for (const p of l.people) if (p.alive && (p.relation === "father" || p.relation === "mother")) p.bond = clamp(p.bond + 20, 0, 100); pts(l, 2); addStat(l, "happiness", 6); return sys("ห้าสิบสองมื้อ ห้าสิบสองเรื่องเล่าซ้ำ ห้าสิบสองครั้งที่แม่ตักกับข้าวให้ — [ภารกิจลับสำเร็จ] แต้มสถานะ +2"); } },
      { label: "งานยุ่ง ไว้ปีหน้า", run: (l) => { addStat(l, "happiness", -2); return sys("[ระบบ] 「ภารกิจลับไม่มีปีหน้า」"); } },
    ],
  },
  {
    id: "o21.hid_stranger",
    minAge: 12, maxAge: 70,
    when: (l) => has(l) && l.stats.happiness >= 55,
    system: true,
    title: "ภารกิจลับ: คนแปลกหน้าในฝน",
    text: () => "ฝนตกหนักที่ป้ายรถเมล์ หญิงชราคนหนึ่งยืนตัวเปียกไม่มีร่ม — หน้าต่างระบบเด้งขึ้นเองแบบไม่มีเสียง\n「ภารกิจลับ: ?」",
    choices: [
      { label: "ยื่นร่มให้ แล้วเดินตากฝนกลับ", run: (l) => { up(l, "luk", 4); addStat(l, "health", -2); return sys("หญิงชรายิ้มแล้วหายไปตอนรถเมล์ผ่าน — [ภารกิจลับสำเร็จ: 'ความใจดีที่ไม่มีใครเห็น'] LUK +4"); } },
      { label: "แชร์ร่มไปส่งถึงบ้าน", run: (l) => { up(l, "cha", 2); gainSysExp(l, 150); return sys("ระหว่างทางเธอเล่าเรื่องสามีที่ตายในสงคราม — [ภารกิจลับสำเร็จ] CHA +2 · EXP +150"); } },
      { label: "รีบขึ้นรถเมล์", run: () => meh("ผ่านไปสามป้าย คุณหันกลับไปมอง ป้ายรถเมล์ว่างเปล่า") },
    ],
  },
  {
    id: "o21.hid_rock_bottom",
    minAge: 15, maxAge: 80, forced: true,
    when: (l) => has(l) && l.stats.happiness <= 15,
    system: true,
    title: "ภารกิจลับ: ผู้ใช้ยังอยู่ไหม",
    text: () => "หน้าต่างระบบเด้งขึ้นตอนตีสาม ไม่มีเสียงติ๊ง ไม่มีตัวเลข\n「ภารกิจลับ: ออกไปดูพระอาทิตย์ขึ้นหนึ่งครั้ง」\n「รางวัล: ไม่มี」",
    choices: [
      { label: "ออกไปดู", run: (l) => { addStat(l, "happiness", 18); addStat(l, "health", 3); return sys("คุณนั่งบนสะพานลอยจนฟ้าเป็นสีส้ม — [ระบบ] 「ภารกิจสำเร็จ · รางวัลถูกส่งแล้ว」 คุณไม่แน่ใจว่ารางวัลคืออะไร แต่หายใจได้ง่ายขึ้น"); } },
      { label: "นอนต่อ", run: (l) => { addStat(l, "happiness", 4); return sys("[ระบบ] 「พรุ่งนี้ก็มีพระอาทิตย์ขึ้น ภารกิจไม่มีวันหมดอายุ」"); } },
    ],
  },
  {
    id: "o21.hid_rich_test",
    minAge: 20, maxAge: 80,
    when: (l) => has(l) && l.money >= 10_000_000,
    system: true,
    title: "ภารกิจลับ: บททดสอบของเงิน",
    text: (l) => `[ภารกิจลับ] 「ผู้ใช้มีเงินเกิน ${money(l, 10_000_000)} — ระบบขอทดสอบนิสัย」\n「บริจาคหนึ่งในสิบให้คนที่คุณไม่รู้จัก โดยไม่บอกใคร」`,
    choices: [
      { label: "บริจาคแบบไม่ประกาศ", run: (l) => { const v = Math.round(l.money / 10); addMoney(l, -v); pts(l, 4); up(l, "luk", 3); return sys(`คุณโอน ${money(l, v)} เข้ามูลนิธิเด็กกำพร้าตอนตีสอง — [ภารกิจลับสำเร็จ] แต้มสถานะ +4 · LUK +3`); } },
      { label: "บริจาคแล้วโพสต์ลงโซเชียล", run: (l) => { addMoney(l, -Math.round(l.money / 10)); addFame(l, 5); return sys("ยอดไลก์ถล่มทลาย — [ระบบ] 「เงื่อนไข 'ไม่บอกใคร' ล้มเหลว · ไม่มีรางวัล」"); } },
      { label: "เงินของฉัน ฉันหามาเอง", run: () => sys("[ระบบ] 「รับทราบ」 — แค่นั้นจริงๆ") },
    ],
  },
  {
    id: "o21.hid_enemy",
    minAge: 18, maxAge: 80,
    when: (l) => has(l) && people(l, "rival").length > 0,
    system: true,
    title: "ภารกิจลับ: ศัตรูในโรงพยาบาล",
    text: (l) => `คุณรู้ข่าวว่า${shortName(people(l, "rival")[0])}คู่แข่งตลอดชีวิตของคุณ นอนป่วยอยู่ในโรงพยาบาลคนเดียว\n「ภารกิจลับ: ?」`,
    choices: [
      { label: "ไปเยี่ยมพร้อมกระเช้าผลไม้", run: (l) => { const r = people(l, "rival")[0]; r.relation = "friend"; r.bond = 55; pts(l, 3); return sys(`${shortName(r)}มองกระเช้าแล้วหัวเราะจนไอ "ทำไมต้องเป็นแกที่มา" — [ภารกิจลับสำเร็จ: ศัตรูกลายเป็นมิตร] แต้มสถานะ +3`); } },
      { label: "ไม่ไป", run: () => meh("คุณเลือกไม่ไป — หน้าต่างระบบปิดเงียบๆ") },
    ],
  },
  {
    id: "o21.hid_firstlove",
    minAge: 25, maxAge: 60,
    when: (l) => has(l) && !people(l, "spouse").length && !people(l, "partner").length,
    system: true,
    title: "ภารกิจลับ: คนที่เคยชอบ",
    text: () => "ร้านกาแฟใกล้ที่ทำงาน คุณเห็นคนที่เคยชอบสมัย ม.ปลาย นั่งอยู่คนเดียว — หน้าต่างระบบกะพริบ\n「ภารกิจลับ: พูดสิ่งที่ไม่เคยพูด」",
    choices: [
      { label: "เดินไปทัก แล้วสารภาพ", skill: ["social"], check: { stat: "looks", dc: 50 }, run: (l, _c, ok) => { if (ok) { createPerson(l, "partner", { age: l.age, bond: 70 }); pts(l, 2); return sys("\"ฉันก็รอให้เธอพูดมาสิบปีแล้ว\" — [ภารกิจลับสำเร็จ] แต้มสถานะ +2"); } pts(l, 1); return sys("เขาแต่งงานแล้ว มีลูกสองคน แต่ยิ้มให้คุณอย่างอบอุ่น — [ภารกิจสำเร็จ: คำพูดถูกพูดแล้ว] แต้มสถานะ +1"); } },
      { label: "ซื้อกาแฟแล้วรีบออกมา", run: (l) => { addStat(l, "happiness", -3); return meh("คุณดื่มกาแฟเย็นชืดในรถ แล้วคิดว่าถ้าเดินไปทักจะเป็นยังไง"); } },
    ],
  },
  {
    id: "o21.hid_kid_question",
    minAge: 25, maxAge: 70,
    when: (l) => has(l) && people(l, "child").some((c) => c.age >= 5 && c.age <= 12),
    system: true,
    title: "ภารกิจลับ: คำถามของเด็ก",
    text: (l) => `${shortName(people(l, "child").find((c) => c.age >= 5 && c.age <= 12)!)}ถามคุณก่อนนอนว่า "ทำไมพ่อแม่ชอบพูดคนเดียวตอนดึกๆ" — ระบบเด้งภารกิจลับขึ้นมาทันที\n「ภารกิจลับ: ตอบให้เด็กยิ้ม โดยไม่โกหก」`,
    choices: [
      { label: "\"พ่อแม่คุยกับเพื่อนที่มองไม่เห็น เขาช่วยให้เก่งขึ้น\"", run: (l) => { const c = people(l, "child").find((x) => x.age >= 5 && x.age <= 12)!; c.bond = clamp(c.bond + 15, 0, 100); pts(l, 2); return sys(`${shortName(c)}ตาโต "หนูมีบ้างได้ไหม" — [ภารกิจสำเร็จ] ทุกคืนหลังจากนั้น ลูกคุยกับ 'เพื่อนที่มองไม่เห็น' ของตัวเอง แต้มสถานะ +2`); } },
      { label: "\"พ่อแม่ซ้อมพูดเฉยๆ\"", run: () => sys("[ระบบ] 「ไม่ผ่าน — คำตอบไม่ใช่ความจริงทั้งหมด」") },
    ],
  },
  {
    id: "o21.hid_wrong_bus",
    minAge: 14, maxAge: 60,
    when: (l) => has(l) && effSys(l, "luk") >= 30,
    system: true,
    title: "ภารกิจลับ: รถเมล์ผิดสาย",
    text: () => "คุณขึ้นรถเมล์ผิดสายเพราะมัวแต่ดูโทรศัพท์ หน้าต่างระบบเด้งขึ้น 「อย่าลง」",
    choices: [
      { label: "เชื่อระบบ นั่งไปจนสุดสาย", run: (l) => { const v = randInt(l, 5, 20) * 10_000; addMoney(l, v); up(l, "luk", 2); return sys(`ปลายสายมีงานวัดเล็กๆ คุณสอยดาวได้รางวัลใหญ่ ${money(l, v)} — [ภารกิจลับสำเร็จ] LUK +2`); } },
      { label: "ลงป้ายหน้าแล้วเรียกแท็กซี่", run: () => meh("คุณไปถึงที่ทำงานทันเวลา — และไม่มีวันรู้ว่าปลายสายมีอะไรรออยู่") },
    ],
  },
  {
    id: "o21.hid_mirror",
    minAge: 16, maxAge: 70,
    when: (l) => has(l) && lv(l) >= 8,
    system: true,
    title: "ภารกิจลับ: กระจกบานนั้น",
    text: () => "ตอนแปรงฟัน เงาในกระจกขยับช้ากว่าคุณครึ่งวินาที\n「ภารกิจลับ: เผชิญหน้ากับตัวเองในเวอร์ชันที่ไม่มีระบบ」",
    choices: [
      { label: "คุยกับเงา", run: (l) => { addStat(l, "happiness", 5); gainSysExp(l, 250); return sys("เงาบอกว่า 'ฉันก็อยู่ได้นะ แม้ไม่มีหน้าต่างสีฟ้า' — คุณนั่งนิ่งไปนาน [EXP +250]"); } },
      { label: "ต่อยกระจก", tone: "danger", run: (l) => { addStat(l, "health", -5); up(l, "str", 1); return bad("กระจกแตก มือเลือดออก เงาหายไป — ระบบไม่พูดอะไรอีกทั้งวัน (STR +1)"); } },
    ],
  },
  {
    id: "o21.hid_teacher",
    minAge: 22, maxAge: 70,
    when: (l) => has(l) && effSys(l, "int") >= 40,
    system: true,
    title: "ภารกิจลับ: ครูที่สอบตกคุณ",
    text: () => "คุณบังเอิญเจอครูที่เคยให้ F คุณตอน ม.2 ยืนต่อคิวซื้อข้าวมันไก่\n「ภารกิจลับ: ขอบคุณเขา」",
    choices: [
      { label: "เดินไปขอบคุณจริงๆ", run: (l) => { up(l, "int", 2); up(l, "cha", 1); return sys("ครูจำคุณได้ \"เธอคนที่ส่งการบ้านเป็นรูปวาดใช่ไหม\" แล้วหัวเราะทั้งน้ำตา — [ภารกิจลับสำเร็จ] INT +2 · CHA +1"); } },
      { label: "แกล้งทำเป็นไม่เห็น", run: () => meh("คุณสั่งข้าวมันไก่เหมือนกัน แต่วันนั้นมันไม่อร่อย") },
    ],
  },
];

// ───────────────────────── ภารกิจต่อเนื่อง ─────────────────────────

// สาย A: ตามหาผู้ใช้คนก่อน (4 ตอน)
const CHAIN_A: GameEvent[] = [
  {
    id: "o21.a1", minAge: 16, maxAge: 70, weight: 14,
    when: (l) => has(l) && lv(l) >= 5 && step(l, "chainA") === 0,
    system: true,
    title: "ภารกิจต่อเนื่อง: ผู้ใช้คนก่อน (1/4)",
    text: () => "[ภารกิจต่อเนื่อง] 「ไฟล์ที่เสียหาย: ผู้ใช้หมายเลข 0」\nระบบส่งพิกัดมาเป็นร้านหนังสือเก่าในซอยที่คุณไม่เคยเดินผ่าน",
    choices: [
      { label: "ไปตามพิกัด", run: (l) => { l.flags.chainA = 1; gainSysExp(l, 120); return sys("ในชั้นหนังสือมีสมุดบันทึกเล่มหนึ่ง ลายมือเขียนว่า 'วันที่ 1 ระบบมาหาฉัน' — ลงวันที่ห้าสิบปีก่อน"); } },
      { label: "ไม่สนใจ", run: (l) => { l.flags.chainA = -1; return sys("[ระบบ] 「ภารกิจถูกเก็บเข้าลิ้นชัก」"); } },
    ],
  },
  {
    id: "o21.a2", minAge: 16, maxAge: 75, weight: 14,
    when: (l) => has(l) && step(l, "chainA") === 1,
    system: true,
    title: "ภารกิจต่อเนื่อง: ผู้ใช้คนก่อน (2/4)",
    text: () => "สมุดบันทึกหน้าสุดท้ายเขียนชื่อโรงพยาบาลแห่งหนึ่ง และคำว่า 'ห้อง 407'",
    choices: [
      { label: "ไปห้อง 407", check: { stat: "smarts", dc: 45 }, run: (l, _c, ok) => { l.flags.chainA = 2; if (ok) { up(l, "int", 2); return sys("พยาบาลบอกว่าคนไข้ห้อง 407 จากไปเมื่อสิบปีก่อน แต่ทิ้งกล่องไว้ให้ 'คนที่จะมาถามหา' (INT +2)"); } return sys("พยาบาลไม่ยอมบอกอะไร แต่คุณเห็นชื่อบนแฟ้ม — พอแล้วสำหรับก้าวต่อไป"); } },
      { label: "ค้นข้อมูลออนไลน์แทน", run: (l) => { l.flags.chainA = 2; return meh("ข่าวเก่าเมื่อสี่สิบปีก่อน: 'ชายหนุ่มช่วยคนจากตึกถล่มสิบเจ็ดคน แล้วหายตัวไป'"); } },
    ],
  },
  {
    id: "o21.a3", minAge: 16, maxAge: 80, weight: 14,
    when: (l) => has(l) && step(l, "chainA") === 2,
    system: true,
    title: "ภารกิจต่อเนื่อง: ผู้ใช้คนก่อน (3/4)",
    text: () => "ในกล่องมีจดหมายหนึ่งฉบับ\n'ถึงผู้ใช้คนถัดไป — ระบบไม่ใช่ของขวัญ มันคือคำถาม และฉันตอบผิด'",
    choices: [
      { label: "ถามระบบว่าคำถามคืออะไร", run: (l) => { l.flags.chainA = 3; return sys("[ระบบ] 「คำถามคือ: ถ้าแข็งแกร่งที่สุดแล้ว จะเอาความแข็งแกร่งไปทำอะไร」 — หน้าต่างปิดเอง"); } },
      { label: "เผาจดหมายทิ้ง", run: (l) => { l.flags.chainA = 3; addStat(l, "happiness", -3); return meh("ไฟเผากระดาษช้าผิดปกติ ตัวอักษรสุดท้ายที่ไหม้คือคำว่า 'ระวัง'"); } },
    ],
  },
  {
    id: "o21.a4", minAge: 16, maxAge: 90, weight: 14,
    when: (l) => has(l) && step(l, "chainA") === 3 && lv(l) >= 12,
    system: true,
    title: "ภารกิจต่อเนื่อง: ผู้ใช้คนก่อน (4/4)",
    text: () => "[ภารกิจต่อเนื่อง — ตอนจบ] 「ผู้ใช้หมายเลข 0 ตอบว่า 'เพื่อตัวเอง' — ผู้ใช้ปัจจุบันจะตอบว่าอะไร」",
    choices: [
      { label: "\"เพื่อคนที่ฉันรัก\"", run: (l) => { l.flags.chainA = 4; pts(l, 5); for (const p of l.people) if (p.alive) p.bond = clamp(p.bond + 5, 0, 100); markTurn(l); return { text: "[ภารกิจต่อเนื่องสำเร็จ] 「คำตอบถูกบันทึก — ไม่มีคำตอบที่ถูก มีแต่คำตอบที่ซื่อสัตย์」 แต้มสถานะ +5", kind: "milestone" }; } },
      { label: "\"เพื่อคนที่ไม่มีใครช่วย\"", run: (l) => { l.flags.chainA = 4; pts(l, 5); addFame(l, 5); markTurn(l); return { text: "[ภารกิจต่อเนื่องสำเร็จ] 「ผู้ใช้หมายเลข 0 ก็เคยตอบแบบนี้ในวันแรก」 แต้มสถานะ +5", kind: "milestone" }; } },
      { label: "\"ยังไม่รู้\"", run: (l) => { l.flags.chainA = 4; pts(l, 6); return { text: "[ภารกิจต่อเนื่องสำเร็จ] 「คำตอบที่ดีที่สุดในประวัติระบบ」 แต้มสถานะ +6", kind: "milestone" }; } },
    ],
  },
];

// สาย B: ช่วยคนร้อยคน (4 ตอน)
const CHAIN_B: GameEvent[] = [
  {
    id: "o21.b1", minAge: 12, maxAge: 70, weight: 12,
    when: (l) => has(l) && step(l, "chainB") === 0,
    system: true,
    title: "ภารกิจต่อเนื่อง: ร้อยคน (1/4)",
    text: () => "[ภารกิจต่อเนื่อง] 「ช่วยเหลือคนร้อยคน — ความคืบหน้า 0/100」\nวันแรกคุณเห็นคุณยายเข็นรถผักขึ้นสะพานลอยไม่ไหว",
    choices: [
      { label: "ช่วยเข็น", run: (l) => { l.flags.chainB = 1; up(l, "str", 1); return sys("「1/100」 คุณยายให้มะนาวมาสามลูก — ระบบบันทึกว่าเป็น 'รางวัลระดับตำนาน'"); } },
      { label: "แบ่งเป็นเป้าหมายรายสัปดาห์", run: (l) => { l.flags.chainB = 1; up(l, "int", 1); return sys("คุณทำตาราง Excel สำหรับความดี — ระบบงงแต่ยอมรับ"); } },
    ],
  },
  {
    id: "o21.b2", minAge: 12, maxAge: 75, weight: 12,
    when: (l) => has(l) && step(l, "chainB") === 1,
    system: true,
    title: "ภารกิจต่อเนื่อง: ร้อยคน (2/4)",
    text: () => "「ความคืบหน้า 41/100」 — คนที่สี่สิบสองคือเด็กผู้ชายที่โดนรุมรีดไถหลังโรงเรียน",
    choices: [
      { label: "เข้าไปขวาง", tone: "danger", skill: ["combat"], odds: (l) => clamp(0.4 + effSys(l, "str") / 100, 0.3, 0.95), run: (l, _c, ok) => { l.flags.chainB = 2; if (ok) { up(l, "str", 2); return sys("พวกนั้นวิ่งหนีกระเจิง เด็กคนนั้นจ้องคุณเหมือนเห็นซูเปอร์ฮีโร่ — 「42/100」 STR +2"); } addStat(l, "health", -8); return bad("คุณโดนต่อยไปสองที แต่เด็กคนนั้นหนีรอด — 「42/100」 ระบบยังนับให้"); } },
      { label: "โทรเรียกครูและตำรวจ", run: (l) => { l.flags.chainB = 2; up(l, "int", 1); return sys("ช้ากว่าแต่ปลอดภัยกว่า — 「42/100」 ระบบเพิ่มหมายเหตุ: 'ไม่ต้องเป็นฮีโร่ก็ช่วยได้'"); } },
    ],
  },
  {
    id: "o21.b3", minAge: 12, maxAge: 80, weight: 12,
    when: (l) => has(l) && step(l, "chainB") === 2,
    system: true,
    title: "ภารกิจต่อเนื่อง: ร้อยคน (3/4)",
    text: () => "「ความคืบหน้า 99/100」 — แต่สามเดือนแล้วที่ตัวเลขไม่ขยับ ไม่ว่าคุณช่วยใคร ระบบก็ไม่นับ",
    choices: [
      { label: "ถามระบบตรงๆ", run: (l) => { l.flags.chainB = 3; return sys("[ระบบ] 「คนที่ร้อยคือคนที่ผู้ใช้ไม่เคยช่วย」 — คุณนั่งคิดทั้งคืนว่าคือใคร"); } },
      { label: "ช่วยต่อไปเรื่อยๆ ไม่สนตัวเลข", run: (l) => { l.flags.chainB = 3; up(l, "luk", 2); return sys("คุณช่วยไปอีกสามสิบคนโดยไม่ดูหน้าต่าง — LUK +2"); } },
    ],
  },
  {
    id: "o21.b4", minAge: 12, maxAge: 90, weight: 12,
    when: (l) => has(l) && step(l, "chainB") === 3,
    system: true,
    title: "ภารกิจต่อเนื่อง: ร้อยคน (4/4)",
    text: () => "เช้าวันหนึ่งคุณตื่นมาไม่อยากลุกจากเตียง หน้าต่างระบบเด้งขึ้น\n「คนที่ 100: ผู้ใช้เอง — ภารกิจ: ลาพักหนึ่งสัปดาห์ ไม่ทำอะไรเพื่อใครเลย」",
    choices: [
      { label: "ลาพักจริงๆ", run: (l) => { l.flags.chainB = 4; addStat(l, "happiness", 15); addStat(l, "health", 6); pts(l, 5); markTurn(l); return { text: "「100/100」 [ภารกิจต่อเนื่องสำเร็จ] คุณนอนสิบสองชั่วโมงติดเป็นครั้งแรกในรอบสิบปี — แต้มสถานะ +5", kind: "milestone" }; } },
      { label: "พักไม่เป็น", run: (l) => { l.flags.chainB = 4; pts(l, 2); return sys("วันที่สองคุณแอบไปช่วยเพื่อนบ้านซ่อมหลังคา — [ระบบ] 「นับให้ครึ่งเดียว」 แต้มสถานะ +2"); } },
    ],
  },
];

// สาย C: บริษัทที่ไม่มีอยู่จริง (3 ตอน)
const CHAIN_C: GameEvent[] = [
  {
    id: "o21.c1", minAge: 20, maxAge: 70, weight: 10,
    when: (l) => has(l) && !!l.job && step(l, "chainC") === 0,
    system: true,
    title: "ภารกิจต่อเนื่อง: บริษัทผี (1/3)",
    text: () => "[ภารกิจต่อเนื่อง] 「ตรวจพบความผิดปกติ: บริษัทคู่ค้าของที่ทำงานคุณไม่มีพนักงานแม้แต่คนเดียว」",
    choices: [
      { label: "แอบตรวจเอกสาร", skill: ["stealth", "study"], check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { l.flags.chainC = ok ? 1 : -1; if (ok) { up(l, "int", 2); return sys("ใบแจ้งหนี้สามร้อยใบ ที่อยู่เดียวกัน: ห้องเช่าว่างเปล่าชั้นสาม — INT +2"); } return bad("คุณเปิดผิดแฟ้ม แล้วโดนฝ่ายบัญชีเห็น — ภารกิจถูกยกเลิก"); } },
      { label: "อย่ายุ่งดีกว่า", run: (l) => { l.flags.chainC = -1; return meh("คุณปิดหน้าต่างระบบ แล้วกลับไปทำงานของตัวเอง"); } },
    ],
  },
  {
    id: "o21.c2", minAge: 20, maxAge: 75, weight: 12,
    when: (l) => has(l) && step(l, "chainC") === 1,
    system: true,
    title: "ภารกิจต่อเนื่อง: บริษัทผี (2/3)",
    text: () => "ห้องเช่าชั้นสามว่างเปล่า ยกเว้นคอมพิวเตอร์เครื่องเดียวที่ยังเปิดอยู่ หน้าจอแสดงชื่อผู้อนุมัติ — ผู้บริหารของบริษัทคุณเอง",
    choices: [
      { label: "ก๊อบไฟล์ทั้งหมด", tone: "danger", odds: (l) => clamp(0.5 + effSys(l, "agi") / 150, 0.4, 0.95), run: (l, _c, ok) => { l.flags.chainC = 2; if (ok) return sys("USB เสียบเสร็จก่อนเสียงลิฟต์ดังหนึ่งวินาที — หลักฐานอยู่ในมือคุณแล้ว"); addStat(l, "health", -6); return bad("ยามจับได้ คุณหนีออกมาได้พร้อมไฟล์ครึ่งเดียว"); } },
      { label: "ถ่ายรูปหน้าจอแล้วรีบออก", run: (l) => { l.flags.chainC = 2; return meh("รูปเบลอไปนิด แต่ชื่อยังอ่านออก"); } },
    ],
  },
  {
    id: "o21.c3", minAge: 20, maxAge: 80, weight: 12,
    when: (l) => has(l) && step(l, "chainC") === 2,
    system: true,
    title: "ภารกิจต่อเนื่อง: บริษัทผี (3/3)",
    text: (l) => `ผู้บริหารคนนั้นเรียกคุณเข้าห้อง วางเช็คเปล่าบนโต๊ะ "${money(l, 5_000_000)} พอไหม"`,
    choices: [
      { label: "ส่งหลักฐานให้สื่อและตำรวจ", run: (l) => { l.flags.chainC = 3; addFame(l, 10); pts(l, 4); if (l.job) l.job.performance = clamp(l.job.performance + 25, 0, 100); markTurn(l); return { text: "ข่าวใหญ่ทั่วประเทศ ผู้บริหารถูกจับ คุณกลายเป็น 'พนักงานผู้เปิดโปง' — [ภารกิจต่อเนื่องสำเร็จ] แต้มสถานะ +4", kind: "milestone" }; } },
      { label: "รับเช็ค", run: (l) => { l.flags.chainC = 3; addMoney(l, 5_000_000); if (l.sys) l.sys.luk = Math.max(0, l.sys.luk - 8); return sys("[ระบบ] 「ภารกิจล้มเหลว — โชคของผู้ใช้ถูกหักเป็นค่าปรับ」 LUK -8 แต่เช็คขึ้นเงินได้จริง"); } },
    ],
  },
];

// สาย D: ร่างกายของผู้ใช้ (3 ตอน) — ระบบสั่งให้ไปตรวจสุขภาพ
const CHAIN_D: GameEvent[] = [
  {
    id: "o21.d1", minAge: 30, maxAge: 70, weight: 10,
    when: (l) => has(l) && step(l, "chainD") === 0,
    system: true,
    title: "ภารกิจต่อเนื่อง: สัญญาณเตือน (1/3)",
    text: () => "[ภารกิจต่อเนื่อง] 「ระบบตรวจพบค่าผิดปกติในร่างกายผู้ใช้ — ภารกิจ: ไปตรวจสุขภาพภายใน 30 วัน」",
    choices: [
      { label: "ไปตรวจทันที", run: (l) => { l.flags.chainD = 1; addStat(l, "health", 6); return sys("หมอเจอติ่งเนื้อเล็กๆ ที่ลำไส้ ตัดออกได้ทันที \"โชคดีที่มาตรวจตอนนี้\""); } },
      { label: "เลื่อนไปก่อน งานยุ่ง", run: (l) => { l.flags.chainD = 1; addStat(l, "health", -10); return bad("หกเดือนต่อมาคุณปวดท้องจนต้องเข้าห้องฉุกเฉิน — ระบบส่งข้อความเดียว 「บอกแล้ว」"); } },
    ],
  },
  {
    id: "o21.d2", minAge: 30, maxAge: 75, weight: 12,
    when: (l) => has(l) && step(l, "chainD") === 1,
    system: true,
    title: "ภารกิจต่อเนื่อง: สัญญาณเตือน (2/3)",
    text: () => "「ภารกิจ: เลิกนิสัยแย่หนึ่งอย่างเป็นเวลาหนึ่งปี」",
    choices: [
      { label: "เลิกกาแฟเย็นหวานเจี๊ยบ", run: (l) => { l.flags.chainD = 2; addStat(l, "health", 5); addStat(l, "happiness", -4); return sys("เดือนแรกคุณหงุดหงิดใส่ทุกคน เดือนที่หกคุณลืมไปแล้วว่ามันรสชาติยังไง (สุขภาพ +5)"); } },
      { label: "เลิกเล่นมือถือก่อนนอน", run: (l) => { l.flags.chainD = 2; addStat(l, "health", 3); up(l, "int", 2); return sys("คุณอ่านหนังสือจบสิบสองเล่มในปีนั้น (INT +2)"); } },
      { label: "เลิกนอนดึก", run: (l) => { l.flags.chainD = 2; up(l, "sta", 3); return sys("ร่างกายคุณขอบคุณด้วยการตื่นเองตอนหกโมงทุกวัน (STA +3)"); } },
    ],
  },
  {
    id: "o21.d3", minAge: 30, maxAge: 80, weight: 12,
    when: (l) => has(l) && step(l, "chainD") === 2,
    system: true,
    title: "ภารกิจต่อเนื่อง: สัญญาณเตือน (3/3)",
    text: () => "「ภารกิจสุดท้าย: สอนคนอื่นให้ดูแลตัวเองหนึ่งคน」",
    choices: [
      { label: "สอนพ่อแม่", show: (l) => l.people.some((p) => p.alive && (p.relation === "father" || p.relation === "mother")), run: (l) => { l.flags.chainD = 3; for (const p of l.people) if (p.alive && (p.relation === "father" || p.relation === "mother")) { p.bond = clamp(p.bond + 10, 0, 100); p.age = Math.max(40, p.age - 2); } pts(l, 4); return sys("แม่บ่นทุกวันแต่ก็ทำตาม — หมอบอกว่าความดันลดลงชัดเจน [ภารกิจต่อเนื่องสำเร็จ] แต้มสถานะ +4"); } },
      { label: "สอนเพื่อนร่วมงาน", run: (l) => { l.flags.chainD = 3; pts(l, 4); up(l, "cha", 1); return sys("ทั้งแผนกเริ่มเดินขึ้นบันไดแทนลิฟต์ — [ภารกิจต่อเนื่องสำเร็จ] แต้มสถานะ +4"); } },
    ],
  },
];

// ───────────────────────── นิสัยของระบบ ─────────────────────────

const QUIRKS: GameEvent[] = [
  {
    id: "o21.q_update",
    minAge: 10, maxAge: 80,
    when: has,
    system: true,
    text: () => "[อัปเดตระบบ v2.3.1] 「แก้ไขบั๊กที่ทำให้ผู้ใช้ได้ยินเสียงติ๊งตอนอาบน้ำ · เพิ่มอีโมจิ 3 ตัว · ประสิทธิภาพโดยรวมดีขึ้น」\nคุณไม่รู้สึกถึงความแตกต่างอะไรเลย",
    auto: (l) => { gainSysExp(l, 50); return "system"; },
  },
  {
    id: "o21.q_ads",
    minAge: 12, maxAge: 80,
    when: (l) => has(l) && lv(l) >= 3,
    system: true,
    title: "โฆษณาในระบบ",
    text: () => "หน้าต่างระบบแสดงโฆษณาเป็นครั้งแรก 「ดูโฆษณา 30 วินาที รับ EXP x2 หนึ่งวัน」 — โฆษณาคือแอปหาคู่",
    choices: [
      { label: "ดูจนจบ", run: (l) => { gainSysExp(l, 120); return sys("EXP +120 — และคุณดาวน์โหลดแอปหาคู่ไปแล้วโดยไม่รู้ตัว"); } },
      { label: "กดข้าม", run: () => sys("[ระบบ] 「ผู้ใช้ปฏิเสธรายได้ของระบบ — ระบบจะจำไว้」") },
    ],
  },
  {
    id: "o21.q_jealous",
    minAge: 15, maxAge: 70,
    when: (l) => has(l) && (people(l, "partner").length > 0 || people(l, "spouse").length > 0),
    system: true,
    title: "ระบบหึง",
    text: () => "ตั้งแต่คุณมีแฟน หน้าต่างระบบเด้งถี่ขึ้นสามเท่า ภารกิจล่าสุด: 「เลิกกินข้าวเย็นกับแฟน แล้วไปฝึก STR」",
    choices: [
      { label: "บอกระบบว่าชีวิตไม่ได้มีแค่ตัวเลข", run: (l) => { addStat(l, "happiness", 4); return sys("[ระบบ] 「…รับทราบ」 — แต่คืนนั้นหน้าต่างแสดงตัวเลขแบบตัวหนาทั้งหมดเหมือนประชด"); } },
      { label: "ไปฝึกตามสั่ง", run: (l) => { up(l, "str", 2); const p = people(l, "partner")[0] ?? people(l, "spouse")[0]; p.bond = clamp(p.bond - 10, 0, 100); return meh(`STR +2 — ${shortName(p)}กินข้าวคนเดียวเป็นครั้งที่สามของเดือน`); } },
    ],
  },
  {
    id: "o21.q_bug",
    minAge: 12, maxAge: 80,
    when: (l) => has(l) && lv(l) >= 6,
    system: true,
    title: "บั๊ก",
    text: () => "หน้าต่างระบบค้าง ตัวเลข LUK กระโดดเป็น 999 สามวินาที แล้วกลับมาเป็นปกติ",
    choices: [
      { label: "รีบไปซื้อลอตเตอรี่ภายในสามวินาที", check: { stat: "luck", dc: 60 }, run: (l, _c, ok) => { if (ok) { const v = randInt(l, 2, 6) * 100_000; addMoney(l, v); return good(`คุณวิ่งไปถึงแผงทันพอดี — ถูกรางวัล ${money(l, v)} ระบบส่งแพตช์แก้บั๊กมาในชั่วโมงถัดไป`); } return meh("คุณวิ่งไปไม่ถึงแผง ไม่ทัน 2.8 วินาที"); } },
      { label: "แจ้งบั๊กให้ระบบ", run: (l) => { pts(l, 1); return sys("[ระบบ] 「ขอบคุณสำหรับรายงาน — รางวัลนักล่าบั๊ก: แต้มสถานะ +1」"); } },
    ],
  },
  {
    id: "o21.q_tutorial",
    minAge: 30, maxAge: 90,
    when: (l) => has(l) && Number(l.flags.awakenAge ?? 0) + 10 <= l.age,
    system: true,
    text: () => "[ระบบ] 「ตรวจพบว่าผู้ใช้ยังไม่ได้ดูวิดีโอแนะนำการใช้งาน — ต้องการดูตอนนี้ไหม (ความยาว 47 ชั่วโมง)」",
    choices: [
      { label: "ดู", run: (l) => { gainSysExp(l, 400); addStat(l, "happiness", -4); return sys("ชั่วโมงที่ 31 อธิบายฟีเจอร์ที่คุณใช้มาสิบปีโดยไม่รู้ว่ามีอยู่ (EXP +400)"); } },
      { label: "ข้าม (ข้ามมาสิบปีแล้ว)", run: () => sys("[ระบบ] 「วิดีโอจะถูกเสนออีกครั้งในอีกสิบปี」") },
    ],
  },
  {
    id: "o21.q_birthday",
    minAge: 10, maxAge: 90,
    when: (l) => has(l) && l.age % 10 === 0,
    maxTimes: 4,
    system: true,
    text: (l) => `[ระบบ] 「สุขสันต์วันเกิดครบรอบ ${l.age} ปี 🎂 — ของขวัญ: กล่องสุ่ม」`,
    auto: (l) => {
      const r = randInt(l, 0, 2);
      if (r === 0) pts(l, 2);
      else if (r === 1) gainSysExp(l, 300);
      else addStat(l, "happiness", 8);
      return "system";
    },
  },
  {
    id: "o21.q_rival_user",
    minAge: 20, maxAge: 70, weight: 6,
    when: (l) => has(l) && lv(l) >= 15,
    system: true,
    title: "ผู้ใช้อีกคน?",
    text: () => "บนรถไฟฟ้า ผู้ชายตรงข้ามพึมพำ \"แจกแต้มไป INT สาม\" — แล้วเงยหน้ามาสบตาคุณ",
    choices: [
      { label: "พูดว่า \"ระบบ?\"", run: (l) => { l.flags.otherUser = true; createPerson(l, "friend", { age: l.age + randInt(l, -5, 5), bond: 60, job: "ผู้ใช้ระบบอีกคน (หรือเปล่า?)" }); return sys("เขาหน้าซีด แล้วหัวเราะลั่น — สองชั่วโมงต่อมาคุณสองคนนั่งเทียบหน้าต่างสถานะกันในร้านกาแฟ… ของเขาเป็นแอปจดเป้าหมายฟิตเนส"); } },
      { label: "แกล้งไม่ได้ยิน", run: () => meh("เขาลงสถานีถัดไป แล้วหันกลับมามองคุณจนประตูปิด") },
    ],
  },
  {
    id: "o21.q_mood",
    minAge: 10, maxAge: 80,
    when: (l) => has(l) && l.stats.happiness >= 70,
    system: true,
    text: () => "หน้าต่างระบบวันนี้มีอีโมจิดอกไม้ประดับมุมจอ ระบบดูอารมณ์ดีเป็นพิเศษ — ภารกิจรายวันง่ายลงครึ่งหนึ่ง",
    auto: (l) => { gainSysExp(l, 80); return "system"; },
  },
];

export const M21_QUEST_EVENTS: GameEvent[] = [...PENALTY, ...HIDDEN, ...CHAIN_A, ...CHAIN_B, ...CHAIN_C, ...CHAIN_D, ...QUIRKS];
