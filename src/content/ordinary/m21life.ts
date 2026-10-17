// M21: ชีวิตในโลกธรรมดา — เหตุการณ์ตามสายค่าสถานะ (STR/AGI/STA/INT/CHA/LUK) · วัยเด็กก่อนระบบมา · ผู้ใหญ่ · วัยชรา · ความลับของระบบ
import type { GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, randInt } from "../../engine/rng";
import type { Life, SysStat } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, money, people, shortName } from "../../engine/util";
import { effSys } from "../gameStats";
import { trackOf } from "../hunter/power";
import { SYS_CAP, gainSysExp } from "./sys";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });
const sys = (text: string): Outcome => ({ text, kind: "system" });

const has = (l: Life) => !!l.sys;
const hi = (k: SysStat, n: number) => (l: Life) => has(l) && effSys(l, k) >= n;
const up = (l: Life, k: SysStat, n: number) => { if (l.sys) l.sys[k] = clamp(l.sys[k] + n, 0, SYS_CAP); };
const pts = (l: Life, n: number) => { if (l.sys) l.sys.points += n; };
const odds = (k: SysStat, dc: number) => (l: Life) => clamp(0.5 + (effSys(l, k) - dc) / 40, 0.08, 0.95);
const parent = (l: Life) => l.people.find((p) => p.alive && (p.relation === "mother" || p.relation === "father"));
const friend = (l: Life) => people(l, "friend")[0];
const bond = (l: Life, rel: string[], n: number) => { for (const p of l.people) if (p.alive && rel.includes(p.relation)) p.bond = clamp(p.bond + n, 0, 100); };

// ───────────────────────── สาย STR ─────────────────────────

const STR: GameEvent[] = [
  {
    id: "o21.str_jar", minAge: 10, maxAge: 70, when: hi("str", 30),
    text: () => "ทั้งบ้านเปิดฝาขวดแยมไม่ออกมาสามวัน คุณบิดทีเดียว — ฝาขวดหลุดพร้อมคอขวด",
    auto: (l) => { addStat(l, "happiness", 2); return "good"; },
  },
  {
    id: "o21.str_moving", minAge: 16, maxAge: 60, when: hi("str", 38),
    text: () => "เพื่อนย้ายคอนโดแล้วขอให้ช่วย 'ยกของนิดหน่อย' — ของนิดหน่อยคือตู้เย็นสองประตูขึ้นชั้นเจ็ดตอนลิฟต์เสีย",
    choices: [
      { label: "แบกคนเดียว", run: (l) => { up(l, "str", 1); const f = friend(l); if (f) f.bond = clamp(f.bond + 10, 0, 100); return good("คนทั้งตึกออกมายืนดู ยามถ่ายคลิปส่งกลุ่มไลน์หมู่บ้าน — ตั้งแต่นั้นทุกคนที่ย้ายบ้านโทรหาคุณ (STR +1)"); } },
      { label: "แนะนำให้จ้างบริษัทขนย้าย", run: () => meh("เพื่อนจ้างจริง แล้วบ่นว่า 'มีกล้ามไว้ทำไม' ไปอีกครึ่งปี") },
    ],
  },
  {
    id: "o21.str_armwrestle", minAge: 16, maxAge: 60, when: hi("str", 45),
    title: "งัดข้อที่ร้านเหล้า",
    text: (l) => `แชมป์งัดข้อประจำร้านวางเงิน ${money(l, 20_000)} บนโต๊ะ ท้าใครก็ได้ในร้าน — เพื่อนๆ ผลักคุณออกไปข้างหน้า`,
    choices: [
      { label: "รับคำท้า", skill: ["combat"], odds: odds("str", 45), run: (l, _c, ok) => { if (ok) { addMoney(l, 20_000); addFame(l, 1); return good("โต๊ะหักก่อนข้อมือเขาจะแตะพื้น ร้านให้คุณดื่มฟรีตลอดชีพ แต่ขอให้จ่ายค่าโต๊ะ"); } addStat(l, "health", -3); return bad("แขนคุณถูกกดลงในสามวินาที — เขาเป็นแชมป์ประเทศสามสมัยที่มานั่งเล่นวันหยุด"); } },
      { label: "แกล้งเจ็บข้อมือ", run: () => meh("เพื่อนๆ โห่ทั้งโต๊ะ คุณสั่งเฟรนช์ฟรายส์เพิ่มเพื่อปลอบใจตัวเอง") },
    ],
  },
  {
    id: "o21.str_car", minAge: 18, maxAge: 70, when: hi("str", 55),
    title: "รถคว่ำ",
    text: () => "รถเก๋งพลิกคว่ำกลางสี่แยก มีเด็กติดอยู่ใต้ประตูที่บุบเข้าไป คนรอบข้างยืนถ่ายคลิป",
    choices: [
      { label: "ยกรถขึ้นเอง", tone: "danger", odds: odds("str", 55), run: (l, _c, ok) => { if (ok) { addFame(l, 10); up(l, "str", 2); return good("รถยกขึ้นสิบเซนติเมตร — พอให้คนอื่นดึงเด็กออกมา คลิปนั้นทำให้คุณได้ฉายา 'มนุษย์แม่แรง'"); } addStat(l, "health", -12); return bad("หลังคุณดังกร๊อบ แต่รถไม่ขยับ หน่วยกู้ภัยมาถึงในอีกห้านาที เด็กปลอดภัย คุณนอนโรงพยาบาลสองสัปดาห์"); } },
      { label: "โทรเรียกกู้ภัยและปลอบเด็ก", run: (l) => { up(l, "cha", 1); return meh("คุณคุยกับเด็กผ่านกระจกจนกู้ภัยมาถึง เด็กจำเสียงคุณได้จนโต"); } },
    ],
  },
  {
    id: "o21.str_gym", minAge: 16, maxAge: 60, when: hi("str", 40),
    text: () => "เทรนเนอร์ในยิมเดินมาบอกว่าน้ำหนักที่คุณยกอยู่ 'ไม่ใช่สำหรับมือใหม่' — คุณยกน้ำหนักนั้นเพื่อวอร์มอัป",
    choices: [
      { label: "ยกให้ดูอีกเซต", run: (l) => { addFame(l, 1); return meh("เทรนเนอร์ขอเป็นลูกศิษย์ ยิมขอเอารูปคุณไปทำโปสเตอร์"); } },
      { label: "ถามเขาว่าผิดท่าตรงไหน", run: (l) => { up(l, "str", 1); addStat(l, "health", 2); return good("เขาชี้จุดเล็กๆ ที่ระบบไม่เคยบอก — หลังคุณหายปวดที่เป็นมาสองปี"); } },
    ],
  },
];

// ───────────────────────── สาย AGI ─────────────────────────

const AGI: GameEvent[] = [
  {
    id: "o21.agi_phone", minAge: 10, maxAge: 70, when: hi("agi", 30),
    text: () => "มือถือหลุดจากมือคนข้างๆ บนรถไฟฟ้า คุณคว้ามันกลางอากาศก่อนถึงพื้นโดยไม่ละสายตาจากหนังสือ",
    auto: (l) => { up(l, "cha", 1); return "good"; },
  },
  {
    id: "o21.agi_snatch", minAge: 14, maxAge: 65, when: hi("agi", 38),
    title: "โจรกระชากกระเป๋า",
    text: () => "มอเตอร์ไซค์ซิ่งผ่าน กระชากกระเป๋าคุณป้าข้างหน้าแล้วบิดหนี",
    choices: [
      { label: "วิ่งไล่", tone: "danger", skill: ["escape"], odds: odds("agi", 42), run: (l, _c, ok) => { if (ok) { addFame(l, 4); return good("คุณตัดผ่านซอยลัดแล้วโผล่ข้างหน้ามันพอดี โจรตกใจจนล้มเอง คุณป้ากอดคุณร้องไห้"); } addStat(l, "health", -5); return bad("คุณเกือบทัน แต่สะดุดฝาท่อ — ทะเบียนรถจำได้ครบทุกตัว ตำรวจจับได้ในวันรุ่งขึ้น"); } },
      { label: "จดทะเบียนแล้วแจ้งตำรวจ", run: () => meh("ตำรวจจับได้ในสามวัน คุณป้าส่งขนมมาให้ทุกเทศกาล") },
    ],
  },
  {
    id: "o21.agi_dance", minAge: 13, maxAge: 40, when: hi("agi", 40),
    text: () => "งานแต่งเพื่อน ดีเจเปิดเพลงแดนซ์ คนทั้งงานเริ่มล้อมวงรอบคุณแบบไม่ได้นัดหมาย",
    choices: [
      { label: "ปล่อยท่าเต็มที่", skill: ["perform"], odds: odds("agi", 40), run: (l, _c, ok) => { if (ok) { addFame(l, 3); return good("คลิปคุณเต้นในงานแต่งยอดวิวมากกว่าคลิปเจ้าบ่าวเจ้าสาว — ซึ่งเจ้าสาวไม่ค่อยปลื้ม"); } addStat(l, "health", -2); return bad("คุณหมุนตัวแล้วชนโต๊ะเค้กสามชั้น"); } },
      { label: "ดึงเจ้าบ่าวเจ้าสาวมาเต้นด้วย", run: (l) => { const f = friend(l); if (f) f.bond = clamp(f.bond + 8, 0, 100); return good("ทั้งงานเต้นด้วยกัน เจ้าสาวบอกว่าเป็นช่วงที่สนุกที่สุดของคืนนั้น"); } },
    ],
  },
  {
    id: "o21.agi_vr", minAge: 14, maxAge: 50, when: hi("agi", 50),
    title: "สถิติโลก",
    text: () => "เกมจังหวะในห้างมีป้ายสถิติโลก คนต่อแถวยาว คุณเล่นแค่เพราะรอเพื่อน",
    choices: [
      { label: "เล่นจริงจัง", skill: ["game"], odds: odds("agi", 50), run: (l, _c, ok) => { if (ok) { addFame(l, 5); return good("ชื่อย่อสามตัวของคุณขึ้นอันดับหนึ่งของโลก — ห้างติดป้ายใหม่ว่า 'สถิติโลกทำที่นี่'"); } return meh("อันดับสองของประเทศ — เด็กประถมคนหนึ่งยังครองที่หนึ่ง"); } },
      { label: "เล่นเล่นๆ", run: (l) => { addStat(l, "happiness", 3); return meh("คุณได้ตุ๊กตาหมีหนึ่งตัว เพื่อนมาถึงพอดี"); } },
    ],
  },
  {
    id: "o21.agi_knife", minAge: 18, maxAge: 60, when: hi("agi", 55),
    title: "มีดในซอยมืด",
    text: () => "ชายเมาถือมีดเดินตรงเข้ามาในซอยที่คุณเดินกลับบ้าน \"เอาเงินมา!\"",
    choices: [
      { label: "ปัดมีดแล้วล็อกแขน", tone: "danger", skill: ["combat"], odds: odds("agi", 50), run: (l, _c, ok) => { if (ok) { up(l, "agi", 2); return good("ภาพช้าลงเหมือนในหนัง — มีดหลุดจากมือเขาก่อนที่เขาจะรู้ตัว (AGI +2)"); } addStat(l, "health", -14); if (l.stats.health <= 0) { kill(l, "ถูกแทงในซอยเปลี่ยว"); return bad("…"); } return bad("คุณปัดได้ แต่ปลายมีดเฉือนแขนเป็นแผลยาว"); } },
      { label: "ยื่นกระเป๋าให้", run: (l) => { addMoney(l, -5_000); return meh("เขาวิ่งหนีไปพร้อมกระเป๋าตังค์ที่มีบัตรสะสมแต้มร้านกาแฟสิบสองใบ"); } },
    ],
  },
];

// ───────────────────────── สาย STA ─────────────────────────

const STA: GameEvent[] = [
  {
    id: "o21.sta_marathon", minAge: 16, maxAge: 65, when: hi("sta", 38),
    title: "มาราธอนครั้งแรก",
    text: () => "คุณสมัครมาราธอนเพราะเพื่อนท้า โดยไม่เคยวิ่งเกินห้ากิโล — แต่ระบบบอกว่า 'ไหว'",
    choices: [
      { label: "วิ่งตามเพซของระบบ", odds: odds("sta", 40), run: (l, _c, ok) => { if (ok) { up(l, "sta", 2); addStat(l, "happiness", 6); return good("สามชั่วโมงสิบห้านาที — เร็วกว่าเพื่อนที่ท้าคุณหนึ่งชั่วโมง (STA +2)"); } addStat(l, "health", -5); return bad("กิโลที่สามสิบสอง ขาคุณเป็นตะคริวทั้งสองข้าง — แต่คุณก็เดินเข้าเส้นชัย"); } },
      { label: "วิ่งชิลๆ กินทุกจุดให้น้ำ", run: (l) => { addStat(l, "happiness", 5); return meh("คุณเข้าเส้นชัยคนเกือบสุดท้าย อิ่มแตงโมไปทั้งสัปดาห์"); } },
    ],
  },
  {
    id: "o21.sta_allnighter", minAge: 18, maxAge: 55, when: hi("sta", 40),
    text: () => "ทั้งแผนกโต้รุ่งทำงานด่วนสามคืนติด คืนที่สามเหลือคุณคนเดียวที่ยังตาสว่าง",
    choices: [
      { label: "ทำต่อจนเสร็จ", run: (l) => { if (l.job) l.job.performance = clamp(l.job.performance + 12, 0, 100); addStat(l, "health", -3); return good("เช้าวันที่สี่หัวหน้าเปิดประตูมาเจองานเสร็จวางเรียงบนโต๊ะ — และคุณนอนหลับบนกองเอกสาร"); } },
      { label: "ซื้อกาแฟให้ทุกคนแล้วกลับบ้าน", run: (l) => { addMoney(l, -2_000); addStat(l, "happiness", 2); return meh("ทุกคนจำได้ว่าใครซื้อกาแฟ ไม่มีใครจำได้ว่าใครทำงานเสร็จ"); } },
    ],
  },
  {
    id: "o21.sta_flu", minAge: 10, maxAge: 80, when: hi("sta", 45),
    text: () => "ไข้หวัดใหญ่ระบาดทั้งออฟฟิศ ทั้งบ้าน ทั้งซอย — คุณคนเดียวที่ไม่ติด และต้องดูแลทุกคน",
    auto: (l) => { bond(l, ["father", "mother", "spouse", "partner", "child", "sibling"], 6); addStat(l, "happiness", -2); return "normal"; },
  },
  {
    id: "o21.sta_mountain", minAge: 16, maxAge: 60, when: hi("sta", 50),
    text: () => "ทริปเดินป่าครั้งแรกกับเพื่อน วันที่สองฝนตก ทุกคนหมดแรง และมีคนข้อเท้าแพลง",
    choices: [
      { label: "แบกเพื่อนลงเขา", odds: odds("sta", 50), run: (l, _c, ok) => { if (ok) { const f = friend(l); if (f) f.bond = clamp(f.bond + 15, 0, 100); up(l, "sta", 1); return good("เจ็ดกิโลบนหลังคุณ เพื่อนคนนั้นเรียกคุณว่า 'พี่' ตั้งแต่นั้นมา ทั้งที่อายุเท่ากัน"); } addStat(l, "health", -6); return bad("คุณแบกได้สามกิโลแล้วลื่นล้มทั้งคู่ — ต้องรอเจ้าหน้าที่อุทยานมาช่วย"); } },
      { label: "ตั้งแคมป์รอความช่วยเหลือ", run: () => meh("คืนนั้นทุกคนนั่งตัวสั่นในเต็นท์ เล่าเรื่องผีจนเช้า") },
    ],
  },
  {
    id: "o21.sta_iron", minAge: 25, maxAge: 60, when: hi("sta", 60),
    title: "ไอรอนแมน",
    text: () => "ว่ายน้ำ 3.8 กิโล ปั่นจักรยาน 180 กิโล วิ่ง 42 กิโล — ระบบเสนอให้สมัคร 「รางวัล: แต้มสถานะ +3」",
    choices: [
      { label: "ลงแข่ง", tone: "danger", odds: odds("sta", 60), survival: (l) => clamp(0.92 + effSys(l, "sta") / 1000, 0.92, 0.99), run: (l, _c, ok) => { if (ok) { pts(l, 3); addFame(l, 4); return good("คุณเข้าเส้นชัยตอนพระอาทิตย์ตก ผู้บรรยายตะโกนชื่อคุณ 'YOU ARE AN IRONMAN!' — [ระบบ] แต้มสถานะ +3"); } if (chance(l, 0.2)) { kill(l, "หัวใจหยุดเต้นระหว่างแข่งไตรกีฬา"); return bad("กิโลที่สามสิบของการวิ่ง โลกหมุนติ้ว…"); } addStat(l, "health", -10); return bad("คุณถูกพาขึ้นรถพยาบาลที่กิโลที่ยี่สิบ — ร่างกายเกินขีดจำกัดที่ระบบประเมินไว้"); } },
      { label: "ไว้ปีหน้า", run: () => meh("ปีหน้า ปีหน้า และปีหน้า") },
    ],
  },
];

// ───────────────────────── สาย INT ─────────────────────────

const INT: GameEvent[] = [
  {
    id: "o21.int_quiz", minAge: 10, maxAge: 70, when: hi("int", 35),
    title: "เกมโชว์ตอบคำถาม",
    text: () => "รายการเกมโชว์เปิดรับผู้แข่งขัน คุณตอบคำถามหน้าจอทีวีถูกทุกข้อมาสามสัปดาห์จนแม่ส่งใบสมัครให้",
    choices: [
      { label: "ไปแข่ง", skill: ["study"], odds: odds("int", 40), run: (l, _c, ok) => { if (ok) { const v = 1_000_000; addMoney(l, v); addFame(l, 4); return good(`คำถามสุดท้ายเกี่ยวกับปลาหมึก — ระบบเคยให้คุณอ่านสารานุกรมทะเล คุณได้เงินรางวัล ${money(l, v)}`); } addFame(l, 1); return meh("คุณตกรอบที่ข้อเก้า คำถามเรื่องละครหลังข่าวที่คุณไม่เคยดู"); } },
      { label: "ดูอยู่บ้านต่อ", run: () => meh("คุณตอบถูกทุกข้อจากโซฟา แม่ส่ายหน้า") },
    ],
  },
  {
    id: "o21.int_scam", minAge: 16, maxAge: 80, when: hi("int", 40),
    text: () => "แก๊งคอลเซ็นเตอร์โทรมาบอกว่าคุณมีพัสดุผิดกฎหมาย — คุณจับได้ตั้งแต่ประโยคแรก",
    choices: [
      { label: "แกล้งหลงกลแล้วถ่วงเวลาเขาสองชั่วโมง", run: (l) => { addStat(l, "happiness", 5); return good("คุณแกล้งโอนเงินผิดสิบสองรอบ จนปลายสายร้องไห้แล้ววางไปเอง"); } },
      { label: "อัดเสียงส่งตำรวจไซเบอร์", run: (l) => { addFame(l, 1); return meh("ตำรวจขอบคุณ เสียงคุณถูกเอาไปใช้ในคลิปรณรงค์"); } },
    ],
  },
  {
    id: "o21.int_patent", minAge: 20, maxAge: 70, when: hi("int", 50),
    title: "สิ่งประดิษฐ์",
    text: () => "คุณประดิษฐ์ที่เปิดฝาขวดอัจฉริยะเล่นๆ ตอนเบื่อ แล้วเพื่อนบอกว่า 'จดสิทธิบัตรเลย'",
    choices: [
      { label: "จดสิทธิบัตรแล้วขายให้บริษัท", skill: ["business"], odds: odds("int", 50), run: (l, _c, ok) => { if (ok) { addMoney(l, 6_000_000); return good("บริษัทเครื่องครัวซื้อไปผลิตขายทั่วโลก ค่าลิขสิทธิ์เข้าบัญชีคุณทุกไตรมาส"); } addMoney(l, -80_000); return bad("มีคนจดสิทธิบัตรแบบเดียวกันไปก่อนคุณสามวัน"); } },
      { label: "แจกแบบฟรีออนไลน์", run: (l) => { addFame(l, 3); up(l, "cha", 1); return meh("คนทั่วโลกพิมพ์สามมิติไปใช้ บล็อกคุณมีคนอ่านล้านคน"); } },
    ],
  },
  {
    id: "o21.int_chess", minAge: 8, maxAge: 80, when: hi("int", 45),
    text: () => "ลุงที่เล่นหมากรุกในสวนสาธารณะไม่เคยแพ้ใครมายี่สิบปี วันนี้เขาชี้มาที่คุณ",
    choices: [
      { label: "นั่งลงเล่น", odds: odds("int", 50), run: (l, _c, ok) => { if (ok) { createPerson(l, "friend", { age: 74, bond: 65, job: "ปรมาจารย์หมากรุกสวนสาธารณะ" }); return good("ลุงล้มคิงแล้วหัวเราะ \"ในที่สุด!\" — คุณได้เพื่อนเล่นหมากรุกทุกเย็นวันอาทิตย์"); } up(l, "int", 1); return meh("คุณแพ้ในยี่สิบตา ลุงสอนเปิดเกมให้หนึ่งแบบ (INT +1)"); } },
      { label: "ขอดูเฉยๆ", run: () => meh("คุณดูเขาชนะคนอื่นอีกห้าตา และเริ่มเห็นแพตเทิร์น") },
    ],
  },
  {
    id: "o21.int_lecture", minAge: 22, maxAge: 75, when: hi("int", 60),
    title: "เวทีระดับโลก",
    text: () => "มหาวิทยาลัยต่างประเทศเชิญคุณไปบรรยาย — เพราะบทความที่คุณเขียนตอนตีสามแล้วโพสต์ไว้เฉยๆ",
    choices: [
      { label: "ไปบรรยาย", skill: ["study", "perform"], odds: odds("cha", 40), run: (l, _c, ok) => { if (ok) { addFame(l, 8); up(l, "int", 2); return good("ห้องบรรยายเต็ม คนยืนล้นทางเดิน คำถามสุดท้ายมาจากนักวิทยาศาสตร์รางวัลโนเบล"); } addFame(l, 3); return meh("เนื้อหาดีมาก แต่คุณพูดเร็วจนล่ามตามไม่ทัน"); } },
      { label: "ส่งวิดีโอบันทึกไปแทน", run: (l) => { addFame(l, 2); return meh("วิดีโอถูกเปิดในห้องเรียนอีกสามสิบมหาวิทยาลัย"); } },
    ],
  },
];

// ───────────────────────── สาย CHA ─────────────────────────

const CHA: GameEvent[] = [
  {
    id: "o21.cha_cafe", minAge: 14, maxAge: 60, when: hi("cha", 35),
    text: () => "พนักงานร้านกาแฟเขียนเบอร์โทรไว้บนแก้วของคุณ — เป็นครั้งที่สามในสัปดาห์นี้ คนละร้าน",
    auto: (l) => { addStat(l, "happiness", 3); return "good"; },
  },
  {
    id: "o21.cha_scout", minAge: 14, maxAge: 35, when: hi("cha", 42),
    title: "แมวมอง",
    text: () => "ชายใส่หมวกแก๊ปยื่นนามบัตรให้กลางย่านช็อปปิ้ง \"สนใจเป็นนักแสดงไหมครับ\"",
    choices: [
      { label: "ไปแคสติ้ง", skill: ["perform"], odds: odds("cha", 45), run: (l, _c, ok) => { if (ok) { addFame(l, 6); addMoney(l, 300_000); return good("คุณได้บทพระรองในซีรีส์ออนไลน์ คอมเมนต์ใต้คลิปเรียกร้องให้คุณเป็นพระเอก"); } return meh("แคสติ้งเป็นโฆษณาขายครีมบำรุงผิว — คุณได้ครีมฟรีสามกระปุก"); } },
      { label: "ทิ้งนามบัตร", run: () => meh("คุณเห็นหน้าเขาอีกครั้งในข่าว 'แก๊งหลอกเด็กแคสติ้ง' — โชคดีที่ทิ้ง") },
    ],
  },
  {
    id: "o21.cha_wedding_mc", minAge: 20, maxAge: 70, when: hi("cha", 40),
    text: () => "พิธีกรงานแต่งของลูกพี่ลูกน้องเบี้ยวกะทันหัน ทุกคนหันมามองคุณ",
    choices: [
      { label: "จับไมค์", skill: ["perform", "social"], odds: odds("cha", 40), run: (l, _c, ok) => { if (ok) { bond(l, ["sibling", "father", "mother"], 6); addMoney(l, 50_000); return good("ทั้งงานหัวเราะ ร้องไห้ และหัวเราะอีกรอบ — คุณได้งานพิธีกรอีกห้างานในปีนั้น"); } addStat(l, "happiness", -4); return bad("คุณเรียกชื่อเจ้าสาวผิดสองครั้ง"); } },
      { label: "ให้ลุงที่ชอบพูดยาวทำแทน", run: () => meh("ลุงพูดสี่สิบห้านาที แขกครึ่งงานหลับ") },
    ],
  },
  {
    id: "o21.cha_negotiate", minAge: 18, maxAge: 70, when: hi("cha", 50),
    title: "ตัวประกันในธนาคาร",
    text: () => "คุณไปถอนเงินแล้วชายตกงานคนหนึ่งชักปืนขึ้นกลางธนาคาร มือเขาสั่นกว่าคนที่ถูกจี้",
    choices: [
      { label: "คุยกับเขา", tone: "danger", skill: ["social"], odds: odds("cha", 50), run: (l, _c, ok) => { if (ok) { addFame(l, 10); up(l, "cha", 2); return good("ยี่สิบนาทีต่อมาเขาวางปืนแล้วร้องไห้บนไหล่คุณ ไม่มีใครบาดเจ็บ ตำรวจเจรจาต่อรองขอเบอร์คุณ"); } addStat(l, "health", -15); if (l.stats.health <= 0) { kill(l, "ถูกยิงระหว่างเหตุจี้ธนาคาร"); return bad("เสียงปืนดังหนึ่งนัด…"); } return bad("คุณพูดผิดคำเดียว ปืนลั่น กระสุนถากไหล่คุณ"); } },
      { label: "ก้มหมอบรอตำรวจ", run: () => meh("ตำรวจบุกเข้ามาในหนึ่งชั่วโมง คุณได้ยินเสียงเขาร้องไห้ตอนถูกใส่กุญแจมือ") },
    ],
  },
  {
    id: "o21.cha_campaign", minAge: 25, maxAge: 70, when: hi("cha", 55),
    title: "ลงเลือกตั้ง",
    text: () => "ชาวบ้านในเขตมาขอให้คุณลงสมัครสมาชิกสภาท้องถิ่น \"คุณพูดแล้วคนฟัง\"",
    choices: [
      { label: "ลงสมัคร", skill: ["social", "perform"], odds: odds("cha", 55), run: (l, _c, ok) => { if (ok) { addFame(l, 12); l.flags.politician = true; return good("คุณชนะถล่มทลายโดยไม่ซื้อเสียงแม้แต่เสียงเดียว — ทีมหาเสียงของคุณคือแม่บ้านสามสิบคน"); } addMoney(l, -500_000); addFame(l, 3); return bad("คุณแพ้ห้าร้อยคะแนน ผู้ชนะเป็นลูกชายนายกฯ คนเก่า"); } },
      { label: "ปฏิเสธ แล้วช่วยผู้สมัครที่ดีกว่า", run: (l) => { addFame(l, 3); return meh("ผู้สมัครที่คุณช่วยชนะ เขาโทรมาขอคำปรึกษาทุกเดือน"); } },
    ],
  },
];

// ───────────────────────── สาย LUK ─────────────────────────

const LUK: GameEvent[] = [
  {
    id: "o21.luk_wallet", minAge: 8, maxAge: 80, when: hi("luk", 30),
    text: () => "คุณเก็บกระเป๋าสตางค์ได้ข้างทาง ข้างในมีเงินสดปึกหนาและบัตรประชาชน",
    choices: [
      { label: "ตามไปคืนเจ้าของ", run: (l) => { up(l, "luk", 2); const v = randInt(l, 2, 10) * 10_000; addMoney(l, v); return good(`เจ้าของเป็นเจ้าของร้านทองที่ยืนยันให้รางวัล ${money(l, v)} — [ระบบ] LUK +2`); } },
      { label: "เอาไปส่งโรงพัก", run: (l) => { up(l, "luk", 1); return meh("ตำรวจขอบคุณ คุณเดินออกมาแล้วเจอเหรียญบนพื้นทันที"); } },
      { label: "เก็บเงินไว้", run: (l) => { addMoney(l, 15_000); if (l.sys) l.sys.luk = Math.max(0, l.sys.luk - 4); return sys("[ระบบ] 「การกระทำนี้ถูกบันทึก」 LUK -4"); } },
    ],
  },
  {
    id: "o21.luk_flight", minAge: 16, maxAge: 80, when: hi("luk", 45),
    title: "เที่ยวบินที่พลาด",
    text: () => "รถติดจนคุณตกเครื่องเป็นครั้งแรกในชีวิต คุณนั่งหงุดหงิดอยู่ที่สนามบิน",
    auto: (l) => { addStat(l, "happiness", 4); l.flags.missedFlight = true; return "good"; },
  },
  {
    id: "o21.luk_lottery", minAge: 20, maxAge: 80, when: hi("luk", 55),
    title: "ตัวเลขในฝัน",
    text: () => "คุณฝันถึงตัวเลขหกหลักสามคืนติด หน้าต่างระบบแสดงค่า LUK กะพริบเป็นสีทอง",
    choices: [
      { label: "ซื้อเลขนั้น", odds: odds("luk", 60), run: (l, _c, ok) => { if (ok) { addMoney(l, 6_000_000); addFame(l, 2); return good("ถูกรางวัลที่หนึ่ง! ญาติที่ไม่เคยเจอโทรมาพร้อมกันสิบสามคน"); } addMoney(l, -2_000); return meh("ผิดไปหนึ่งตัว — ตัวสุดท้าย เหมือนทุกครั้ง"); } },
      { label: "บอกเลขให้แม่ซื้อแทน", show: (l) => !!parent(l), run: (l) => { const p = parent(l)!; p.bond = clamp(p.bond + 8, 0, 100); if (chance(l, 0.4)) { addMoney(l, 3_000_000); return good("แม่ถูกรางวัลแล้วแบ่งครึ่งให้คุณ แล้วเอาอีกครึ่งไปทำบุญทั้งหมด"); } return meh("ไม่ถูก แต่แม่ดีใจที่ลูกคิดถึง"); } },
      { label: "ไม่เชื่อเรื่องงมงาย", run: () => meh("เลขนั้นออกจริง — คุณเลิกดูข่าวไปหนึ่งสัปดาห์") },
    ],
  },
  {
    id: "o21.luk_hire", minAge: 20, maxAge: 60, when: hi("luk", 40),
    text: () => "คุณเดินเข้าลิฟต์ผิดตัว แล้วคุยเรื่องฟุตบอลกับลุงใส่เสื้อยืดจนถึงชั้นสามสิบ — ลุงคือประธานบริษัท",
    choices: [
      { label: "ยื่นนามบัตรให้ลุง", run: (l) => { if (l.job) l.job.performance = clamp(l.job.performance + 15, 0, 100); else addMoney(l, 200_000); return good("สัปดาห์ต่อมามีอีเมลจากเลขาประธาน — ชีวิตการทำงานของคุณเลี้ยวไปอีกทาง"); } },
      { label: "แค่คุยฟุตบอลต่อ", run: (l) => { createPerson(l, "friend", { age: 63, bond: 60, job: "ลุงประธานบริษัท (เพื่อนดูบอล)" }); return meh("ลุงชวนคุณไปดูบอลที่บ้านทุกนัดสำคัญ ไม่เคยพูดเรื่องงานสักคำ"); } },
    ],
  },
  {
    id: "o21.luk_rain", minAge: 10, maxAge: 80, when: hi("luk", 60),
    text: () => "ฝนตกหนักทั้งเมือง ยกเว้นตรงที่คุณยืน เพื่อนร่วมงานเริ่มขอเดินข้างคุณเวลาลืมร่ม",
    auto: (l) => { addFame(l, 1); addStat(l, "happiness", 2); return "good"; },
  },
];

// ───────────────────────── วัยเด็ก / วัยรุ่นในโลกธรรมดา ─────────────────────────

const YOUNG: GameEvent[] = [
  {
    id: "o21.kid_cartoon", minAge: 5, maxAge: 12, when: (l) => !has(l),
    text: () => "การ์ตูนเช้าวันเสาร์มีตัวเอกที่ได้ 'ระบบ' คุณนั่งพูดกับอากาศว่า \"ระบบ เปิดหน้าต่างสถานะ\" ทุกเช้าหนึ่งเดือน",
    auto: (l) => { addStat(l, "happiness", 3); l.flags.wishedSystem = true; return "normal"; },
  },
  {
    id: "o21.kid_lemonade", minAge: 7, maxAge: 12,
    text: () => "คุณตั้งโต๊ะขายน้ำมะนาวหน้าบ้าน ลูกค้าคนแรกคือยามหมู่บ้านที่ซื้อสามแก้วเพราะสงสาร",
    choices: [
      { label: "ขึ้นราคาเพราะขายดี", check: { stat: "smarts", dc: 40 }, run: (l, _c, ok) => (ok ? (addMoney(l, 800), good("คุณเรียนรู้เรื่องอุปสงค์อุปทานก่อนเพื่อนทั้งห้อง")) : meh("ลูกค้าหายเกลี้ยง ยามหมู่บ้านก็ไม่มาอีก")) },
      { label: "แจกฟรีให้คนงานก่อสร้าง", run: (l) => { addStat(l, "happiness", 5); return good("คนงานทั้งไซต์ปรบมือให้คุณ หนึ่งในนั้นสอนคุณตอกตะปูในวันถัดมา"); } },
    ],
  },
  {
    id: "o21.kid_lost", minAge: 4, maxAge: 9,
    title: "หลงในห้าง",
    text: () => "คุณหลงกับแม่ในห้างสรรพสินค้า รอบตัวมีแต่ขาคนแปลกหน้า",
    choices: [
      { label: "ไปหาพนักงานที่ใส่ชุดฟอร์ม", run: (l) => { addStat(l, "smarts", 2); return good("พี่พนักงานประกาศเสียงตามสาย แม่วิ่งมาถึงในสองนาที — แม่ร้องไห้มากกว่าคุณ"); } },
      { label: "ร้องไห้ดังๆ", run: (l) => { addStat(l, "happiness", -2); return meh("ป้าขายขนมเข้ามาปลอบ ให้ขนมฟรี แล้วพาไปหาแม่"); } },
    ],
  },
  {
    id: "o21.kid_hamster", minAge: 6, maxAge: 12,
    text: () => "หนูแฮมสเตอร์ที่คุณเลี้ยงมาสองปีไม่ตื่นเช้านี้",
    choices: [
      { label: "ทำพิธีศพในสวน", run: (l) => { addStat(l, "happiness", -3); bond(l, ["father", "mother", "sibling"], 4); return meh("ทั้งบ้านยืนไว้อาลัยหนึ่งนาที พ่อทำป้ายหลุมศพจากไม้ไอติม"); } },
      { label: "ถามแม่ว่าคนตายแล้วไปไหน", run: (l) => { addStat(l, "smarts", 2); return meh("แม่ตอบยาวจนคุณหลับไปกลางทาง แต่คืนนั้นคุณกอดแม่แน่นกว่าทุกคืน"); } },
    ],
  },
  {
    id: "o21.kid_bully_sys", minAge: 8, maxAge: 14, when: (l) => has(l),
    title: "เด็กที่มีระบบ",
    text: () => "เด็กห้องข้างๆ ตบหัวคุณทุกเช้ามาครึ่งปี เช้านี้หน้าต่างระบบเด้งขึ้น 「ภารกิจ: ป้องกันตัวเอง (ห้ามทำร้ายเกินจำเป็น)」",
    choices: [
      { label: "จับข้อมือเขาไว้เฉยๆ", odds: odds("str", 20), run: (l, _c, ok) => { if (ok) { up(l, "str", 1); gainSysExp(l, 80); return sys("มือเขาขยับไม่ได้ คุณมองตาเขานิ่งๆ — เขาไม่มาตบหัวใครอีก [ภารกิจสำเร็จ] STR +1"); } addStat(l, "happiness", -3); return bad("เขาสะบัดหลุด แล้วตบแรงกว่าเดิม"); } },
      { label: "บอกครู", run: (l) => { gainSysExp(l, 40); return sys("[ระบบ] 「ภารกิจสำเร็จบางส่วน — การขอความช่วยเหลือก็คือการป้องกันตัว」"); } },
    ],
  },
  {
    id: "o21.teen_exam_sys", minAge: 15, maxAge: 18, when: hi("int", 30),
    title: "สอบเข้ามหาวิทยาลัย",
    text: () => "คืนก่อนสอบใหญ่ หน้าต่างระบบเสนอ 「สรุปเนื้อหาทั้งหมดใน 1 ชั่วโมง — ผลข้างเคียง: ปวดหัวสามวัน」",
    choices: [
      { label: "รับ", run: (l) => { l.education.grade = clamp(l.education.grade + 15, 0, 100); addStat(l, "health", -4); return sys("ข้อมูลไหลเข้าหัวเหมือนน้ำตก — คุณทำข้อสอบได้แทบทุกข้อ แล้วนอนซมสามวัน"); } },
      { label: "อ่านเองตามปกติ", run: (l) => { up(l, "int", 1); return meh("คุณอ่านจนตีสอง สอบได้ตามความสามารถจริง — และภูมิใจกับมัน"); } },
    ],
  },
  {
    id: "o21.teen_crush_sys", minAge: 14, maxAge: 19, when: has,
    text: () => "คนที่คุณแอบชอบเดินผ่าน หน้าต่างระบบแสดงข้อมูลเขาขึ้นมาเอง 「ความชอบต่อผู้ใช้: ???」",
    choices: [
      { label: "ปิดหน้าต่าง ไม่อยากรู้ด้วยตัวเลข", run: (l) => { addStat(l, "happiness", 3); up(l, "cha", 1); return meh("คุณไปถามเขาด้วยตัวเอง เขายิ้ม — คำตอบนั้นมีค่ากว่าตัวเลขไหนๆ"); } },
      { label: "พยายามอัปเลเวลให้ตัวเลขขึ้น", run: (l) => { gainSysExp(l, 60); return sys("[ระบบ] 「ข้อมูลนี้ไม่สามารถปลดล็อกได้ด้วยเลเวล」"); } },
    ],
  },
  {
    id: "o21.teen_part_time", minAge: 15, maxAge: 19,
    text: () => "ร้านปิ้งย่างหน้าซอยรับเด็กเสิร์ฟพาร์ตไทม์ ชั่วโมงละไม่มาก แต่กินฟรี",
    choices: [
      { label: "สมัคร", run: (l) => { addMoney(l, 15_000); addStat(l, "health", 1); up(l, "sta", 1); return good("คุณยกเตาถ่านวันละห้าสิบเตา ได้เงินเก็บก้อนแรก และน้ำหนักขึ้นสามกิโล"); } },
      { label: "ตั้งใจเรียนดีกว่า", run: (l) => { l.education.grade = clamp(l.education.grade + 4, 0, 100); return meh("เกรดคุณดีขึ้น แต่ได้กลิ่นปิ้งย่างทุกเย็นตอนเดินผ่าน"); } },
    ],
  },
  {
    id: "o21.teen_band", minAge: 14, maxAge: 19,
    text: () => "เพื่อนชวนตั้งวงดนตรี ขาดมือกลอง — คุณไม่เคยตีกลองมาก่อนในชีวิต",
    choices: [
      { label: "ตีกลอง!", run: (l) => { addStat(l, "happiness", 6); addStat(l, "looks", 1); return good("วงคุณได้ที่สามในงานโรงเรียน (จากสามวง) แต่เป็นปีที่สนุกที่สุดของ ม.ปลาย"); } },
      { label: "ขอเป็นผู้จัดการวง", run: (l) => { addStat(l, "smarts", 2); return meh("คุณจัดคอนเสิร์ตในโรงอาหาร ขายบัตรได้สามสิบใบ"); } },
    ],
  },
  {
    id: "o21.teen_never", minAge: 16, maxAge: 22, when: (l) => !has(l) && trackOf(l) === "never",
    text: () => "เพื่อนสนิทเพิ่งได้ทุนไปต่างประเทศ คุณยิ้มแสดงความยินดี แล้วกลับบ้านมานั่งเงียบในห้อง",
    choices: [
      { label: "เขียนแผนชีวิตตัวเองลงกระดาษ", run: (l) => { addStat(l, "smarts", 2); addStat(l, "happiness", 2); return good("ไม่มีหน้าต่างระบบมาช่วย แต่กระดาษแผ่นนั้นถูกแปะอยู่หน้าโต๊ะคุณอีกสิบปี"); } },
      { label: "ไปส่งเพื่อนที่สนามบิน", run: (l) => { const f = friend(l); if (f) f.bond = clamp(f.bond + 10, 0, 100); return meh("เพื่อนกอดคุณแน่น \"แกจะเก่งกว่าฉันอีก ฉันรู้\""); } },
    ],
  },
  {
    id: "o21.teen_first_phone", minAge: 10, maxAge: 14,
    text: () => "คุณได้มือถือเครื่องแรก คืนแรกคุณเล่นจนถึงตีสี่ แม่ยึดไปในเช้าวันถัดมา",
    auto: (l) => { addStat(l, "happiness", 1); addStat(l, "health", -1); return "normal"; },
  },
  {
    id: "o21.teen_grandpa", minAge: 10, maxAge: 18,
    text: () => "ปู่ที่บ้านต่างจังหวัดสอนคุณจับปลาด้วยมือเปล่า \"ใจเย็นๆ ปลามันรู้ว่าเรารีบ\"",
    choices: [
      { label: "ฝึกจนจับได้", run: (l) => { addStat(l, "health", 2); addStat(l, "happiness", 4); return good("ตัวแรกหลุดมือ ตัวที่สิบสามติดมือ ปู่หัวเราะจนไอ — เป็นภาพที่คุณจำได้จนแก่"); } },
      { label: "นั่งดูปู่จับ", run: (l) => { addStat(l, "happiness", 2); return meh("ปู่เล่าเรื่องสมัยหนุ่มให้ฟังจนพระอาทิตย์ตก"); } },
    ],
  },
];

// ───────────────────────── ผู้ใหญ่ในโลกธรรมดา ─────────────────────────

const ADULT: GameEvent[] = [
  {
    id: "o21.ad_condo", minAge: 24, maxAge: 50, when: (l) => l.money >= 2_000_000,
    title: "คอนโดแรก",
    text: (l) => `เซลส์คอนโดบอกว่ายูนิตสุดท้ายราคาพิเศษ ${money(l, 2_000_000)} 'วันนี้เท่านั้น'`,
    choices: [
      { label: "จองเลย", run: (l) => { addMoney(l, -2_000_000); l.flags.ownsHome = true; addStat(l, "happiness", 8); return good("คุณได้กุญแจห้องแรกของตัวเอง นอนบนพื้นห้องว่างๆ แล้วยิ้มทั้งคืน"); } },
      { label: "ขอกลับไปคิด", check: { stat: "smarts", dc: 40 }, run: (_l, _c, ok) => (ok ? good("สามเดือนต่อมาโครงการเดียวกันลดราคาอีกยี่สิบเปอร์เซ็นต์") : meh("ยูนิตสุดท้ายยังว่างอยู่หกเดือนต่อมา — และราคาเท่าเดิม")) },
    ],
  },
  {
    id: "o21.ad_reunion", minAge: 28, maxAge: 60,
    title: "งานเลี้ยงรุ่น",
    text: () => "งานเลี้ยงรุ่นครบสิบปี คนที่เคยแกล้งคุณตอนเรียนกลายเป็นเซลส์ประกัน และกำลังเดินตรงมาหาคุณ",
    choices: [
      { label: "ทักทายดีๆ", run: (l) => { addStat(l, "happiness", 3); return meh("เขาขอโทษเรื่องสมัยก่อนก่อนจะพูดเรื่องประกัน — คุณซื้อประกันไปหนึ่งกรมธรรม์เพราะซึ้ง"); } },
      { label: "อวดความสำเร็จ", show: (l) => l.fame >= 10 || l.money >= 5_000_000, run: (l) => { addStat(l, "happiness", 5); return meh("ทั้งโต๊ะเงียบ คุณรู้สึกดีห้านาที แล้วรู้สึกเฉยๆ ตลอดทางกลับบ้าน"); } },
      { label: "เลี่ยงไปคุยกับคนอื่น", run: (l) => { const f = createPerson(l, "friend", { age: l.age, bond: 50 }); return meh(`คุณได้คุยกับ${shortName(f)}ที่ไม่เคยคุยกันเลยตอนเรียน — กลายเป็นเพื่อนสนิทในวัยทำงาน`); } },
    ],
  },
  {
    id: "o21.ad_neighbor", minAge: 22, maxAge: 80,
    text: () => "เพื่อนบ้านห้องข้างๆ เปิดเพลงดังตอนตีสองทุกคืนมาหนึ่งสัปดาห์",
    choices: [
      { label: "เคาะประตูคุยดีๆ", check: { stat: "looks", dc: 40 }, run: (l, _c, ok) => (ok ? (addStat(l, "happiness", 3), good("เขาเป็นนักดนตรีที่เพิ่งโดนทิ้ง คุณสองคนนั่งคุยกันจนเช้า และเพลงเบาลงตั้งแต่นั้น")) : (addStat(l, "happiness", -3), bad("เขาปิดประตูใส่ แล้วเปิดเพลงดังกว่าเดิม"))) },
      { label: "แจ้งนิติบุคคล", run: () => meh("นิติฯ ส่งจดหมายเตือน เพลงเบาลงสามวัน แล้วกลับมาเหมือนเดิม") },
      { label: "เปิดเพลงแข่ง", run: (l) => { addStat(l, "health", -2); return meh("สงครามเพลงกินเวลาสองสัปดาห์ จบลงเมื่อทั้งคู่ถูกเชิญออกจากกรุ๊ปไลน์ตึก"); } },
    ],
  },
  {
    id: "o21.ad_side_hustle", minAge: 22, maxAge: 55,
    text: () => "เพื่อนชวนทำธุรกิจขายของออนไลน์ 'แค่ลงทุนนิดเดียว รวยแน่นอน'",
    choices: [
      { label: "ลงทุนด้วย", skill: ["business"], check: { stat: "luck", dc: 50 }, run: (l, _c, ok) => { if (ok) { addMoney(l, 400_000); return good("ของขายดีจนต้องจ้างคนแพ็กของเพิ่ม"); } addMoney(l, -150_000); return bad("สินค้าหกร้อยกล่องยังกองอยู่ในห้องนอนคุณ — เป็นเครื่องดัดขนตาไฟฟ้า"); } },
      { label: "ขอดูแผนธุรกิจก่อน", check: { stat: "smarts", dc: 45 }, run: (_l, _c, ok) => (ok ? meh("แผนธุรกิจคือแชร์ลูกโซ่ คุณช่วยเพื่อนถอนตัวทัน") : meh("คุณอ่านไม่เข้าใจ แต่ปฏิเสธไปก่อน — ปลอดภัยไว้ก่อน")) },
    ],
  },
  {
    id: "o21.ad_pet", minAge: 20, maxAge: 75,
    text: () => "ลูกแมวตัวหนึ่งเดินตามคุณจากปากซอยถึงหน้าห้อง แล้วนั่งร้องเหมียวไม่ยอมไป",
    choices: [
      { label: "รับเลี้ยง", run: (l) => { l.flags.cat = true; addStat(l, "happiness", 8); return good("มันชื่อ 'ระบบ' — เพราะมันก็มาหาคุณเองโดยไม่ได้ถามความสมัครใจเหมือนกัน"); } },
      { label: "ให้อาหารแล้วหาบ้านให้", run: (l) => { addStat(l, "happiness", 3); return meh("ป้าร้านข้าวแกงรับไปเลี้ยง ทุกครั้งที่ไปกินข้าวมันมาคลอเคลียขาคุณ"); } },
    ],
  },
  {
    id: "o21.ad_burnout", minAge: 26, maxAge: 55, when: (l) => !!l.job && l.stats.happiness < 45,
    title: "หมดไฟ",
    text: () => "เช้าวันจันทร์คุณนั่งในรถหน้าที่ทำงานสี่สิบนาที ไม่มีแรงเปิดประตูลงไป",
    choices: [
      { label: "ลาพักร้อนยาว", run: (l) => { addStat(l, "happiness", 12); if (l.job) l.job.performance = clamp(l.job.performance - 5, 0, 100); return good("สองสัปดาห์ที่ทะเล ไม่มีอีเมล — คุณกลับมาพร้อมผิวคล้ำและหัวใจที่เต้นช้าลง"); } },
      { label: "ไปหาจิตแพทย์", run: (l) => { addStat(l, "happiness", 8); addMoney(l, -20_000); return good("หมอไม่ได้ให้ยา แค่ถามว่า 'คุณอยากทำอะไรจริงๆ' — คุณตอบไม่ได้ และนั่นคือจุดเริ่มต้น"); } },
      { label: "ฝืนเข้างานต่อ", run: (l) => { addStat(l, "health", -6); return bad("คุณเข้างานได้ แต่ทุกอย่างเป็นสีเทา"); } },
    ],
  },
  {
    id: "o21.ad_wedding_cost", minAge: 24, maxAge: 50, when: (l) => people(l, "partner").length > 0,
    text: (l) => `${shortName(people(l, "partner")[0])}ส่งรูปงานแต่งในฝันมาให้ดู ราคาประเมิน ${money(l, 1_500_000)}`,
    choices: [
      { label: "เก็บเงินจัดให้", run: (l) => { const p = people(l, "partner")[0]; p.bond = clamp(p.bond + 12, 0, 100); addMoney(l, -300_000); return good("คุณเปิดบัญชีออมทรัพย์ชื่อ 'งานแต่งของเรา' — ยอดแรกเข้าในวันนั้น"); } },
      { label: "เสนอจัดเล็กๆ แล้วไปเที่ยวแทน", check: { stat: "looks", dc: 40 }, run: (l, _c, ok) => { const p = people(l, "partner")[0]; p.bond = clamp(p.bond + (ok ? 8 : -8), 0, 100); return ok ? good("เขาคิดอยู่นาน แล้วยิ้ม \"ไปญี่ปุ่นนะ\"") : bad("\"เธอไม่เข้าใจว่าวันนั้นสำคัญกับฉันแค่ไหน\""); } },
    ],
  },
  {
    id: "o21.ad_car", minAge: 22, maxAge: 70, when: (l) => l.money >= 800_000,
    text: () => "รถคันแรกของคุณ — มือสอง เจ้าของเดิมเป็นคุณลุงที่ขับไปวัดอย่างเดียว",
    auto: (l) => { addMoney(l, -500_000); addStat(l, "happiness", 5); return "good"; },
  },
  {
    id: "o21.ad_layoff", minAge: 25, maxAge: 60, when: (l) => !!l.job && !(l.job.careerId.startsWith("o_")),
    title: "ปลดพนักงาน",
    text: () => "บริษัทประกาศลดคนสามสิบเปอร์เซ็นต์ หัวหน้าเรียกคุณเข้าห้อง และปิดประตู",
    choices: [
      { label: "ขอโอกาสพิสูจน์ตัว", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { if (ok) { if (l.job) l.job.performance = clamp(l.job.performance + 10, 0, 100); return good("หัวหน้าไม่ได้จะปลดคุณ — เขาจะให้คุณดูแลทีมที่เหลือ"); } l.job = undefined; addMoney(l, 200_000); return bad("คุณได้เงินชดเชยหกเดือนและกล่องกระดาษหนึ่งใบ"); } },
      { label: "รับเงินชดเชยแล้วเริ่มใหม่", run: (l) => { l.job = undefined; addMoney(l, 300_000); addStat(l, "happiness", 2); return meh("คุณเดินออกจากตึกพร้อมกล่องกระดาษ แล้วรู้สึกเบาอย่างประหลาด"); } },
    ],
  },
  {
    id: "o21.ad_hospital_parent", minAge: 30, maxAge: 65, when: (l) => !!parent(l) && (parent(l)?.age ?? 0) >= 60,
    title: "โทรศัพท์ตอนตีสอง",
    text: (l) => `โรงพยาบาลโทรมาแจ้งว่า${shortName(parent(l)!)}ล้มในห้องน้ำ`,
    choices: [
      { label: "ขับรถไปทันที", run: (l) => { const p = parent(l)!; p.bond = clamp(p.bond + 12, 0, 100); addStat(l, "health", -2); return meh("คุณนั่งข้างเตียงจนเช้า มือที่เคยจูงคุณข้ามถนนตอนนี้เล็กลงในมือคุณ"); } },
      { label: "จ้างพยาบาลดูแลแทน งานยุ่งมาก", run: (l) => { addMoney(l, -100_000); const p = parent(l)!; p.bond = clamp(p.bond - 8, 0, 100); return meh("ทุกอย่างเรียบร้อยดี — แต่ทุกครั้งที่โทรไป พ่อแม่ถามว่า 'จะมาเมื่อไหร่'"); } },
    ],
  },
  {
    id: "o21.ad_sys_kid", minAge: 25, maxAge: 60, when: (l) => has(l) && people(l, "child").length > 0,
    title: "ลูกของผู้ใช้",
    text: (l) => `${shortName(people(l, "child")[0])}เดินมาถามว่า "ทำไมพ่อแม่เก่งทุกอย่าง" — หน้าต่างระบบรอคำตอบของคุณเหมือนกัน`,
    choices: [
      { label: "\"เพราะซ้อมทุกวัน\"", run: (l) => { const c = people(l, "child")[0]; c.bond = clamp(c.bond + 8, 0, 100); addStat(l, "happiness", 3); return good("ลูกเริ่มซ้อมเปียโนทุกวันโดยไม่ต้องบังคับ — คำตอบนั้นไม่ได้โกหก"); } },
      { label: "\"เพราะโชคดี\"", run: (l) => { up(l, "luk", 1); return meh("ลูกพยักหน้า แล้วไปไหว้ศาลเจ้าทุกเช้า"); } },
    ],
  },
  {
    id: "o21.ad_robbery_home", minAge: 22, maxAge: 80, when: (l) => l.money >= 1_000_000,
    text: () => "คุณกลับบ้านมาเจอประตูถูกงัด ลิ้นชักทุกอันถูกรื้อ",
    choices: [
      { label: "ดูกล้องวงจรปิดแล้วตามเอง", skill: ["stealth"], check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => (ok ? good("คนร้ายคือช่างที่มาซ่อมแอร์เมื่อเดือนก่อน — ตำรวจได้ของคืนครบ") : (addMoney(l, -150_000), bad("ภาพในกล้องมืดเกินไป ของหายไปพร้อมความรู้สึกปลอดภัย"))) },
      { label: "แจ้งความแล้วย้ายบ้าน", run: (l) => { addMoney(l, -200_000); return meh("คุณย้ายไปคอนโดที่มียามยี่สิบสี่ชั่วโมง และนอนไม่หลับไปหนึ่งเดือน"); } },
    ],
  },
  {
    id: "o21.ad_cooking", minAge: 20, maxAge: 80,
    text: () => "คุณลองทำอาหารสูตรยายจากความจำ รสชาติออกมาเกือบเหมือน — ขาดอะไรไปอย่างหนึ่งที่คุณนึกไม่ออก",
    choices: [
      { label: "โทรถามญาติทุกคน", run: (l) => { bond(l, ["mother", "father", "sibling"], 5); addStat(l, "happiness", 4); return good("ป้าคนเล็กหัวเราะ \"ยายใส่น้ำตาลปี๊บ ไม่ใช่น้ำตาลทราย\" — รสชาติวัยเด็กกลับมาครบ"); } },
      { label: "ปรับเป็นสูตรของตัวเอง", skill: ["cook"], run: (l) => { up(l, "int", 1); return meh("ไม่เหมือนของยาย แต่อร่อยในแบบของคุณ — สูตรนี้จะเป็น 'สูตรยาย' ของหลานคุณในอนาคต"); } },
    ],
  },
  {
    id: "o21.ad_volunteer", minAge: 18, maxAge: 75,
    text: () => "น้ำท่วมใหญ่ในจังหวัดใกล้เคียง ศูนย์รับบริจาคขาดคนแพ็กของ",
    choices: [
      { label: "ไปเป็นอาสาสมัครหนึ่งสัปดาห์", run: (l) => { addStat(l, "happiness", 6); up(l, "sta", 1); return good("คุณแพ็กถุงยังชีพสามพันถุง ได้เพื่อนใหม่ยี่สิบคน และหลังพัง"); } },
      { label: "บริจาคเงิน", run: (l) => { addMoney(l, -20_000); addStat(l, "happiness", 3); return meh("คุณโอนเงินไป แล้วนั่งดูข่าวน้ำท่วมทั้งคืน"); } },
    ],
  },
  {
    id: "o21.ad_sys_doubt", minAge: 30, maxAge: 70, when: (l) => has(l) && (l.sys?.level ?? 0) >= 10,
    title: "ถ้าไม่มีระบบ",
    text: () => "คนสัมภาษณ์ในรายการทอล์กโชว์ถามว่า \"อะไรคือเคล็ดลับความสำเร็จของคุณ\" — คุณหยุดคิดนานเกินไป",
    choices: [
      { label: "\"ฉันมีตัวช่วยที่ไม่มีใครเห็น\"", run: (l) => { addFame(l, 3); return meh("พิธีกรหัวเราะ คิดว่าคุณพูดถึงแม่ — ทั้งประเทศซึ้ง"); } },
      { label: "\"วินัย\"", run: (l) => { up(l, "cha", 1); return meh("คำตอบนั้นจริงครึ่งหนึ่ง และคุณรู้ว่าอีกครึ่งคืออะไร"); } },
    ],
  },
  {
    id: "o21.ad_old_friend_debt", minAge: 25, maxAge: 70, when: (l) => people(l, "friend").length > 0,
    text: (l) => `${shortName(people(l, "friend")[0])}โทรมาขอยืมเงิน ${money(l, 100_000)} เสียงเขาสั่นแบบที่คุณไม่เคยได้ยิน`,
    choices: [
      { label: "ให้ยืม", run: (l) => { addMoney(l, -100_000); const f = people(l, "friend")[0]; f.bond = clamp(f.bond + 10, 0, 100); if (chance(l, 0.5)) { addMoney(l, 110_000); return good("หนึ่งปีต่อมาเขาคืนเงินพร้อมกล่องขนม และเรื่องที่เขาไม่เคยเล่าให้ใครฟัง"); } return meh("เงินก้อนนั้นไม่เคยกลับมา แต่เขายังเป็นเพื่อนคุณ"); } },
      { label: "ปฏิเสธอย่างสุภาพ", run: (l) => { const f = people(l, "friend")[0]; f.bond = clamp(f.bond - 10, 0, 100); return meh("เขาบอกว่าเข้าใจ — แต่ไม่โทรมาอีกเลยหลายเดือน"); } },
    ],
  },
  {
    id: "o21.ad_marathon_tv", minAge: 20, maxAge: 70,
    text: () => "คุณดูซีรีส์รวดเดียวสิบหกตอนในวันหยุดยาว แล้วรู้สึกว่าต้องมีชีวิตแบบพระเอก",
    auto: (l) => { addStat(l, "happiness", 4); addStat(l, "health", -1); return "normal"; },
  },
  {
    id: "o21.ad_sys_hospital", minAge: 25, maxAge: 80, when: (l) => has(l) && l.stats.health < 40,
    title: "เตียงโรงพยาบาล",
    text: () => "คุณนอนโรงพยาบาลด้วยปอดบวม หน้าต่างระบบเปิดค้างไว้ทั้งคืน ไม่มีภารกิจ — มีแค่ตัวเลขสุขภาพที่ลดลงช้าๆ",
    choices: [
      { label: "ใช้แต้มสถานะทั้งหมดอัด STA", show: (l) => (l.sys?.points ?? 0) > 0, run: (l) => { const n = l.sys!.points; l.sys!.points = 0; up(l, "sta", n); addStat(l, "health", 6 + n); return sys(`[ระบบ] 「แต้มสถานะ ${n} แต้ม → STA」 หมอเรียกมันว่าปาฏิหาริย์ คุณเรียกมันว่าการลงทุน`); } },
      { label: "พักผ่อนตามหมอสั่ง", run: (l) => { addStat(l, "health", 5); return meh("คุณออกจากโรงพยาบาลในสองสัปดาห์ เดินช้าลงแต่ยังเดินได้"); } },
    ],
  },
];

// ───────────────────────── วัยชรา ─────────────────────────

const OLD: GameEvent[] = [
  {
    id: "o21.old_retire", minAge: 60, maxAge: 70, when: (l) => !!l.job,
    title: "เกษียณ",
    text: () => "งานเลี้ยงเกษียณ เพื่อนร่วมงานทำวิดีโอรวมรูปคุณตั้งแต่วันแรกที่เข้าทำงาน",
    choices: [
      { label: "เกษียณอย่างมีความสุข", run: (l) => { l.job = undefined; addMoney(l, 1_000_000); addStat(l, "happiness", 10); return good("คุณร้องไห้ตอนวิดีโอจบ แล้วหัวเราะตอนหัวหน้าร้องไห้ดังกว่า"); } },
      { label: "ขอต่ออายุงานอีกห้าปี", run: (l) => { addStat(l, "happiness", -2); return meh("ทุกคนปรบมือ — แต่ภรรยา/สามีที่บ้านไม่ได้ปรบมือด้วย"); } },
    ],
  },
  {
    id: "o21.old_grandkid", minAge: 55, maxAge: 90,
    when: (l) => people(l, "child").some((c) => c.age >= 25),
    text: () => "หลานคนแรกนอนอยู่ในอ้อมแขนคุณ มือเล็กๆ จับนิ้วชี้คุณไว้แน่น",
    auto: (l) => { addStat(l, "happiness", 12); bond(l, ["child"], 8); return "good"; },
  },
  {
    id: "o21.old_sys_last", minAge: 70, maxAge: 110, when: (l) => has(l) && l.stats.health < 35,
    title: "ภารกิจสุดท้าย",
    system: true,
    text: () => "[ระบบ] 「ผู้ใช้ อายุขัยใกล้ครบกำหนด — ภารกิจสุดท้าย: เลือกสิ่งที่จะทิ้งไว้ให้โลก」",
    choices: [
      { label: "บันทึกชีวิตลงสมุดให้ลูกหลาน", run: (l) => { l.flags.memoir = true; addStat(l, "happiness", 8); return sys("คุณเขียนจนหมดสามเล่ม ไม่มีคำว่า 'ระบบ' แม้แต่คำเดียว — [ภารกิจสุดท้ายสำเร็จ]"); } },
      { label: "บริจาคทรัพย์สินครึ่งหนึ่ง", run: (l) => { addMoney(l, -Math.round(Math.max(0, l.money) / 2)); addFame(l, 8); return sys("ทุนการศึกษาชื่อคุณจะส่งเด็กเรียนอีกห้าสิบปี — [ภารกิจสุดท้ายสำเร็จ]"); } },
      { label: "ขอให้ระบบไปหาผู้ใช้คนต่อไปที่ดี", run: (l) => { l.flags.passedSystem = true; return sys("[ระบบ] 「คำขอถูกบันทึก — ขอบคุณที่ใช้บริการ ผู้ใช้หมายเลข 1」"); } },
    ],
  },
  {
    id: "o21.old_park", minAge: 65, maxAge: 100,
    text: () => "ทุกเช้าคุณรำไทเก๊กในสวนกับกลุ่มคุณป้าคุณลุง วันนี้มีสมาชิกใหม่ — แฟนเก่าสมัยมหาวิทยาลัย",
    choices: [
      { label: "ทักทาย", run: (l) => { createPerson(l, "friend", { age: l.age, bond: 60, job: "แฟนเก่าสมัยเรียน (เพื่อนรำไทเก๊ก)" }); addStat(l, "happiness", 6); return good("คุณสองคนหัวเราะเรื่องเดิมๆ เหมือนห้าสิบปีไม่เคยผ่านไป"); } },
      { label: "ย้ายไปรำอีกสวน", run: () => meh("สวนใหม่ไกลกว่าสองกิโล — ดีต่อสุขภาพ") },
    ],
  },
  {
    id: "o21.old_tech", minAge: 65, maxAge: 100,
    text: () => "หลานสอนคุณใช้แอปวิดีโอสั้น อาทิตย์ต่อมาคลิปคุณเต้นในครัวมีคนดูสองล้าน",
    auto: (l) => { addFame(l, 3); addStat(l, "happiness", 6); return "good"; },
  },
  {
    id: "o21.old_scam_sys", minAge: 65, maxAge: 100, when: has,
    text: () => "แก๊งต้มตุ๋นโทรมาหลอกคนแก่ — ระบบแสดงที่อยู่คอลเซ็นเตอร์ขึ้นมาบนจอทันที",
    choices: [
      { label: "ส่งพิกัดให้ตำรวจ", run: (l) => { addFame(l, 4); return good("ตำรวจทลายแก๊งได้ทั้งตึก ข่าวพาดหัว 'คุณตาวัยเจ็ดสิบจับแก๊งคอลเซ็นเตอร์'"); } },
      { label: "วางสายแล้วนอนต่อ", run: () => meh("อายุเท่านี้แล้ว ขอนอนก่อน") },
    ],
  },
  {
    id: "o21.old_visit_school", minAge: 60, maxAge: 95,
    text: () => "คุณกลับไปเยี่ยมโรงเรียนประถมเก่า ต้นมะม่วงที่เคยปีนยังอยู่ ส่วนตึกเรียนกลายเป็นตึกใหม่หมด",
    auto: (l) => { addStat(l, "happiness", 4); return "normal"; },
  },
  {
    id: "o21.old_will", minAge: 70, maxAge: 110, when: (l) => l.money >= 5_000_000 && people(l, "child").length >= 2,
    title: "พินัยกรรม",
    text: () => "ลูกๆ เริ่มทะเลาะกันเรื่องมรดกตั้งแต่คุณยังมีชีวิตอยู่",
    choices: [
      { label: "แบ่งเท่ากันทุกคน", run: (l) => { bond(l, ["child"], 4); return meh("ไม่มีใครพอใจเต็มที่ แต่ไม่มีใครโกรธใครนาน — ยุติธรรมที่สุดแล้ว"); } },
      { label: "เรียกทุกคนมากินข้าวด้วยกันก่อน", check: { stat: "happiness", dc: 50 }, run: (l, _c, ok) => { if (ok) { bond(l, ["child"], 12); return good("มื้อนั้นเงียบสิบนาทีแรก แล้วลูกคนโตเริ่มเล่าเรื่องสมัยเด็ก — ทั้งโต๊ะหัวเราะจนน้ำตาไหล"); } bond(l, ["child"], -5); return bad("มื้อนั้นจบลงด้วยจานแตกหนึ่งใบ"); } },
    ],
  },
];

OLD.push(
  {
    id: "o21.mix_balanced", minAge: 25, maxAge: 70,
    when: (l) => has(l) && (["str", "agi", "sta", "int", "cha", "luk"] as SysStat[]).every((k) => effSys(l, k) >= 35),
    title: "ผู้ใช้สมดุล",
    system: true,
    text: () => "[ระบบ] 「ตรวจพบ: ค่าสถานะทั้งหกเกิน 35 — ผู้ใช้ไม่ได้เก่งที่สุดในด้านไหน แต่ไม่มีจุดอ่อน」\n「ฉายาใหม่: ผู้รอบด้าน」",
    auto: (l) => { pts(l, 3); gainSysExp(l, 200); return "milestone"; },
  },
  {
    id: "o21.mix_glass", minAge: 25, maxAge: 70,
    when: (l) => has(l) && (["str", "agi", "sta", "int", "cha", "luk"] as SysStat[]).some((k) => effSys(l, k) >= 60) && (["str", "agi", "sta", "int", "cha", "luk"] as SysStat[]).some((k) => effSys(l, k) <= 15),
    title: "ปืนใหญ่แก้ว",
    text: () => "คุณเก่งด้านหนึ่งจนคนทั้งประเทศรู้จัก แต่วันนี้คุณทำไข่เจียวไหม้ ล้มบันได และลืมวันเกิดแม่ — ในวันเดียว",
    choices: [
      { label: "ยอมรับแล้วเริ่มฝึกจุดอ่อน", run: (l) => { const low = (["str", "agi", "sta", "int", "cha", "luk"] as SysStat[]).sort((a, b) => effSys(l, a) - effSys(l, b))[0]; up(l, low, 4); return sys("[ระบบ] 「ผู้ใช้ยอมรับจุดอ่อน — โปรแกรมฝึกพิเศษเปิดใช้งาน」 (+4)"); } },
      { label: "เก่งด้านเดียวก็พอแล้ว", run: (l) => { addStat(l, "happiness", 2); return meh("คุณสั่งข้าวกินแทนทำไข่เจียว แล้วโทรขอโทษแม่ — แม่ให้อภัยเพราะเห็นคุณในทีวีทุกวัน"); } },
    ],
  },
  {
    id: "o21.old_sys_farewell", minAge: 80, maxAge: 120, when: (l) => has(l) && (l.sys?.level ?? 0) >= 20,
    system: true,
    text: () => "หน้าต่างระบบเด้งขึ้นตอนคุณนั่งตากแดดหน้าบ้าน ไม่มีภารกิจ ไม่มีตัวเลข มีแค่ข้อความเดียว\n「ระบบสนุกกับการอยู่กับผู้ใช้」",
    auto: (l) => { addStat(l, "happiness", 10); return "system"; },
  },
);

export const M21_LIFE_EVENTS: GameEvent[] = [...STR, ...AGI, ...STA, ...INT, ...CHA, ...LUK, ...YOUNG, ...ADULT, ...OLD];
