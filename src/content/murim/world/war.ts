// ยุคสามแคว้น (MURIM_PLAN §8.6) — เมื่อกลียุคยืดเยื้อและราชวงศ์หมดความชอบธรรม แผ่นดินแตกเป็นสามแคว้นใต้ขุนศึกสามคน
// ตัวละครทั้งหมดสมมุติ · ผู้เล่นรับใช้เจ้าแคว้นในฐานะเสนาธิการหรือนายทัพ ออกศึก ป้องกันเมือง เปลี่ยนนาย — จนกว่าจะมีผู้รวมแผ่นดิน
import type { GameEvent, Outcome } from "../../../engine/events";
import { kill, yearHooks } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, log } from "../../../engine/util";
import { gainExp } from "../../hunter/power";
import { shiftAlign } from "../m17core";
import { calYear, worldOfLife } from "../life/world";
import { TAEL } from "../story/kit";

export interface Kingdom { id: string; name: string; lord: string; power: number; trait: string }

const LORDS: Kingdom[] = [
  { id: "north", name: "แคว้นจิ้นเหนือ", lord: "เฉาเจิ้นอวี่", power: 45, trait: "เหี้ยมแต่ใช้คนเป็น — ใครเก่งได้ขึ้น ใครพลาดได้ตาย" },
  { id: "west", name: "แคว้นซูตะวันตก", lord: "หลิวอันเหริน", power: 30, trait: "ใจกว้าง ราษฎรรัก แต่ทหารน้อยและยากจน" },
  { id: "south", name: "แคว้นหลินใต้", lord: "ซุนเหยาหมิง", power: 35, trait: "ร่ำรวยด้วยเรือและการค้า ระวังตัว ไม่ชอบเสี่ยง" },
];

const murim = (l: Life) => l.worldId === "murim";
const isWar = (l: Life) => murim(l) && l.mw?.era === "war";
const kingdoms = (l: Life): Kingdom[] => (l.mw?.kingdoms ?? []) as Kingdom[];
const myLord = (l: Life) => kingdoms(l).find((k) => k.id === l.flags.lord);
const pow = (l: Life) => l.power?.rank ?? 0;
const ok = (text: string): Outcome => ({ text, kind: "good" });
const no = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });
const big = (text: string): Outcome => ({ text, kind: "milestone" });

/** ทุกปี: กลียุคยืดเยื้อ → แตกเป็นสามแคว้น · สงครามดำเนินไป · ผู้รวมแผ่นดิน */
yearHooks.push((l) => {
  if (!murim(l) || !l.alive) return;
  const w = worldOfLife(l);
  const yr = calYear(l);
  if (w.era === "chaos" && yr - w.eraSince >= 7 && w.legitimacy < 25 && chance(l, 0.35)) {
    w.era = "war";
    w.eraSince = yr;
    w.kingdoms = LORDS.map((k) => ({ ...k, power: clamp(k.power + randInt(l, -8, 8), 10, 80) }));
    log(l, `⚔️ ราชวงศ์ล่มสลาย แผ่นดินแตกเป็นสามแคว้น — ${LORDS.map((k) => `${k.name} (${k.lord})`).join(" · ")} ต่างประกาศว่าตนคือผู้สืบทอดฟ้า`, "milestone");
    return;
  }
  if (w.era !== "war") return;
  const ks = kingdoms(l);
  for (const k of ks) k.power = clamp(k.power + randInt(l, -6, 6), 5, 95);
  const top = ks.slice().sort((a, b) => b.power - a.power)[0];
  if (yr - w.eraSince >= 10 && top.power >= 55 && chance(l, 0.18)) {
    w.era = "recovery";
    w.eraSince = yr;
    w.legitimacy = 55;
    w.unrest = 35;
    if (w.court) { w.court.reigns.push({ name: w.court.emperor.name, from: w.court.emperor.since, to: yr, how: `แผ่นดินแตก ${top.lord}รวมแผ่นดิน` }); w.court.emperor = { name: `ฮ่องเต้${top.lord.slice(-2)}`, age: randInt(l, 40, 60), temper: "wise", health: 75, since: yr }; w.court.heir = undefined; w.court.regent = undefined; }
    const mine = l.flags.lord === top.id;
    log(l, `🏯 ${top.lord}แห่ง${top.name}รวมแผ่นดินเป็นหนึ่ง สถาปนาราชวงศ์ใหม่ — สงครามสามแคว้นสิ้นสุด${mine ? " และคุณยืนอยู่ข้างผู้ชนะ" : l.flags.lord ? " ฝ่ายที่คุณรับใช้พ่ายแพ้" : ""}`, "milestone");
    if (mine) { addFame(l, 15); addMoney(l, 100 * TAEL); l.flags.unifier = true; }
    else if (l.flags.lord) { addFame(l, -5); l.flags.losingSide = true; }
    delete l.flags.lord;
    delete l.flags.warRole;
    w.kingdoms = undefined;
    return;
  }
  // เงินเดือนจากเจ้าแคว้น
  if (myLord(l)) { const pay = (l.flags.warRole === "strategist" ? 25 : 15) * TAEL * (1 + Number(l.flags.warRank ?? 0) * 0.5); addMoney(l, pay); }
});

export const WAR_EVENTS: GameEvent[] = [
  {
    id: "mw.war.recruit",
    minAge: 16,
    maxAge: 60,
    maxTimes: 0,
    weight: (l) => (isWar(l) && !l.flags.lord && !l.flags.refusedLords ? 10 : 0),
    title: "ทัพเกณฑ์คน",
    text: (l) => `ทูตจากสามแคว้นมาถึงอำเภอพร้อมกัน — ${kingdoms(l).map((k) => `${k.name}ของ${k.lord} (${k.trait})`).join(" · ")}`,
    choices: [
      ...LORDS.map((k) => ({
        label: `ไปกับ${k.name}`,
        run: (l: Life): Outcome => { l.flags.lord = k.id; l.flags.warRole = pow(l) >= 2 ? "officer" : "soldier"; l.flags.warRank = 0; return big(`คุณคุกเข่ารับธงของ${k.lord} — ${l.flags.warRole === "officer" ? "ฝีมือของคุณทำให้ได้คุมทหารร้อยคนตั้งแต่วันแรก" : "หอกหนึ่งเล่มกับเสื้อเกราะหนังเก่าๆ คือทั้งหมดที่ได้"}`); },
      })),
      { label: "ไม่รับใช้ใคร พาครอบครัวหลบเข้าเขา", run: (l) => { l.flags.refusedLords = true; addStat(l, "happiness", -2); return meh("ในหุบเขามีแค่ลมกับนก — ข่าวสงครามมาถึงช้าลง แต่ไม่เคยหยุด"); } },
    ],
  },
  {
    id: "mw.war.cottage",
    minAge: 20,
    maxAge: 60,
    weight: (l) => (isWar(l) && l.flags.warRole !== "strategist" && l.stats.smarts >= 65 ? 8 : 0),
    prepare: (l) => ({ k: pick(l, kingdoms(l)).id }),
    title: "สามครั้งที่กระท่อมหญ้าคา",
    text: (l, c) => { const k = kingdoms(l).find((x) => x.id === c.k)!; return `${k.lord}เจ้า${k.name}มาเยือนกระท่อมของคุณเป็นครั้งที่สาม — สองครั้งแรกคุณแกล้งไม่อยู่ ครั้งนี้เขายืนรอหน้าประตูท่ามกลางหิมะ "ข้าต้องการคนที่มองเห็นทั้งกระดาน"`; },
    choices: [
      { label: "รับเป็นเสนาธิการ", run: (l, c) => { l.flags.lord = String(c.k); l.flags.warRole = "strategist"; l.flags.warRank = 1; addFame(l, 6); return big("คุณวาดแผนที่แผ่นดินบนโต๊ะไม้ แบ่งเป็นสามส่วน แล้วชี้ว่าส่วนไหนควรเป็นของเขา — เขาฟังจนเทียนหมด"); } },
      { label: "ปฏิเสธ — ข้าไม่เหมาะกับการเมือง", run: (l) => { addFame(l, 2); return meh("เขาโค้งให้คุณแล้วจากไปในหิมะ — คนทั้งแผ่นดินเล่าว่ามีบัณฑิตปฏิเสธเจ้าแคว้น"); } },
    ],
  },
  {
    id: "mw.war.battle",
    minAge: 16,
    maxAge: 65,
    maxTimes: 0,
    weight: (l) => (isWar(l) && myLord(l) ? 7 : 0),
    title: "ศึกริมแม่น้ำ",
    text: (l) => `ทัพของ${myLord(l)!.lord}ตั้งประจันหน้าข้าศึกข้ามแม่น้ำ ${l.flags.warRole === "strategist" ? "ทุกคนในกระโจมรอฟังแผนของคุณ" : "คุณยืนแถวหน้า หอกในมือเปียกเหงื่อ"}`,
    choices: [
      { label: "แผนไฟเผาทัพเรือ", show: (l) => l.flags.warRole === "strategist", odds: (l) => clamp(0.4 + (l.stats.smarts - 50) / 120 + Number(l.flags.warRank ?? 0) * 0.04, 0.15, 0.92), run: (l, _c, s) => {
        const k = myLord(l)!;
        if (s) { k.power = clamp(k.power + 12, 5, 95); l.flags.warRank = Number(l.flags.warRank ?? 0) + 1; addFame(l, 6); return big(`ลมตะวันออกเฉียงใต้พัดมาตามที่คุณคำนวณ — เรือข้าศึกลุกเป็นไฟทั้งแม่น้ำ ${k.lord}จับมือคุณต่อหน้าทัพทั้งหมด`); }
        k.power = clamp(k.power - 10, 5, 95); addFame(l, -4); return no("ลมไม่มาตามนัด — ทัพคุณเสียคนไปครึ่ง สายตาของนายทัพคนอื่นเริ่มเย็นชา");
      } },
      { label: "บุกนำหน้าทัพ", show: (l) => l.flags.warRole !== "strategist", tone: "danger", odds: (l) => clamp(0.35 + pow(l) * 0.08 + (l.stats.health - 50) / 200, 0.1, 0.9), survival: (l) => clamp(0.75 + pow(l) * 0.03 + (l.stats.health - 50) / 300, 0.5, 0.97), run: (l, _c, s) => {
        const k = myLord(l)!;
        if (s) { k.power = clamp(k.power + 6, 5, 95); l.flags.warRank = Number(l.flags.warRank ?? 0) + 1; if (Number(l.flags.warRank) >= 3) l.flags.warRole = "general"; gainExp(l, 500); addFame(l, 4); return big(`คุณฝ่าแนวข้าศึกเป็นคนแรก ธงข้าศึกล้มในมือคุณ${l.flags.warRole === "general" ? " — เจ้าแคว้นแต่งตั้งคุณเป็นแม่ทัพ" : ""}`); }
        if (!chance(l, clamp(0.75 + pow(l) * 0.03 + (l.stats.health - 50) / 300, 0.5, 0.97))) { kill(l, `ตายในศึกริมแม่น้ำ ใต้ธงของ${k.lord}`); return no("ลูกธนูดอกหนึ่งมาจากที่ไหนสักแห่ง…"); }
        addStat(l, "health", -15); return no("แนวหน้าแตก คุณถูกหามกลับค่ายพร้อมแผลที่ต้นขา");
      } },
      { label: "หลบอยู่แนวหลัง", run: (l) => { addFame(l, -2); return meh("คุณรอด — คนที่บุกไปไม่ได้กลับมาครึ่งหนึ่ง"); } },
    ],
  },
  {
    id: "mw.war.siege",
    minAge: 10,
    maxAge: 90,
    maxTimes: 2,
    weight: (l) => (isWar(l) ? 3 : 0),
    title: "เมืองถูกล้อม",
    text: () => "ทัพของแคว้นศัตรูล้อมเมืองที่คุณอยู่มาสี่สิบวัน ข้าวในยุ้งหมด ผู้คนเริ่มกินหนูและเปลือกไม้",
    choices: [
      { label: "ขึ้นกำแพงช่วยรักษาเมือง", odds: (l) => clamp(0.4 + pow(l) * 0.07 + (l.stats.health - 50) / 200, 0.1, 0.9), run: (l, _c, s) => (s ? ok(`เมืองรอด — ทัพศัตรูถอยไปในวันที่สี่สิบเจ็ด${shiftAlign(l, 2)}`) : no("กำแพงด้านตะวันตกแตก คุณหนีออกมาได้ทางท่อระบายน้ำ — ทรัพย์สินหายหมด")) },
      { label: "ลอบหนีออกกลางคืนพร้อมครอบครัว", odds: (l) => clamp(0.5 + (l.stats.smarts - 50) / 150, 0.15, 0.9), run: (_l, _c, s) => (s ? meh("ทั้งครอบครัวรอดออกมาได้ — บ้านที่อยู่มาทั้งชีวิตลุกเป็นไฟอยู่ข้างหลัง") : no("หน่วยลาดตระเวนจับได้ — ต้องจ่ายค่าไถ่ทุกอย่างที่มี")) },
      { label: "เปิดประตูเมืองให้ศัตรู แลกกับชีวิตตัวเอง", run: (l) => { addMoney(l, 50 * TAEL); addFame(l, -10); return no(`เมืองถูกปล้นสามวัน — คุณได้ทองและชีวิต แต่ไม่มีใครในเมืองนี้มองหน้าคุณอีก${shiftAlign(l, -12)}`); } },
    ],
  },
  {
    id: "mw.war.defect",
    minAge: 20,
    maxAge: 70,
    maxTimes: 0,
    weight: (l) => (isWar(l) && myLord(l) && myLord(l)!.power < 25 ? 6 : 0),
    title: "ทูตลับ",
    text: (l) => `${myLord(l)!.name}กำลังพ่าย — ทูตลับจากแคว้นที่แข็งแกร่งกว่ายื่นจดหมาย "เปลี่ยนฝ่ายมา แล้วตำแหน่งของท่านจะสูงกว่าเดิมสองขั้น"`,
    choices: [
      { label: "เปลี่ยนฝ่าย", run: (l) => { const best = kingdoms(l).slice().sort((a, b) => b.power - a.power)[0]; l.flags.lord = best.id; l.flags.warRank = Number(l.flags.warRank ?? 0) + 2; addFame(l, -6); return meh(`คุณข้ามแม่น้ำไปพร้อมความลับของนายเก่า — ${best.lord}ต้อนรับอย่างดี แต่ไม่เคยหันหลังให้คุณ${shiftAlign(l, -8)}`); } },
      { label: "อยู่กับนายจนวาระสุดท้าย", run: (l) => { addFame(l, 4); return ok(`คุณฉีกจดหมายต่อหน้าทูต — ข่าวแพร่ไปทั้งสามแคว้นว่ายังมีคนซื่อสัตย์อยู่ในโลก${shiftAlign(l, 4)}`); } },
    ],
  },
  {
    id: "mw.war.generals_duel",
    minAge: 18,
    maxAge: 65,
    maxTimes: 2,
    weight: (l) => (isWar(l) && l.flags.warRole === "general" ? 5 : 0),
    title: "แม่ทัพประจันหน้า",
    text: () => "แม่ทัพข้าศึกขี่ม้าออกมากลางสนาม ท้าดวลตัวต่อตัวต่อหน้าทัพสองฝ่าย — ใครแพ้ ทัพนั้นถอย",
    choices: [
      { label: "ขี่ม้าออกไปรับคำท้า", tone: "danger", odds: (l) => clamp(0.4 + pow(l) * 0.07, 0.1, 0.92), survival: (l) => clamp(0.7 + pow(l) * 0.04, 0.5, 0.97), run: (l, _c, s) => {
        if (s) { const k = myLord(l)!; k.power = clamp(k.power + 10, 5, 95); addFame(l, 10); return big("สามสิบเพลง — ทวนของคุณปัดหมวกเกราะข้าศึกกระเด็น ทัพข้าศึกแตกพ่ายโดยไม่ต้องรบ"); }
        if (!chance(l, clamp(0.7 + pow(l) * 0.04, 0.5, 0.97))) { kill(l, "ตายในการดวลแม่ทัพกลางสนามรบ"); return no("ทวนข้าศึกแทงทะลุเกราะอก…"); }
        addStat(l, "health", -20); return no("คุณตกม้า — ทหารลากกลับค่ายได้ทัน แต่ทัพของคุณต้องถอย");
      } },
      { label: "ส่งนายทหารคนอื่นไปแทน", run: (l) => { addFame(l, -3); return meh("นายทหารของคุณตายในเพลงที่ห้า — ทัพถอยสิบลี้"); } },
    ],
  },
  {
    id: "mw.war.conscript_kid",
    minAge: 35,
    maxAge: 80,
    maxTimes: 1,
    weight: (l) => (isWar(l) && l.people.some((p) => p.alive && p.relation === "child" && p.age >= 15 && p.age <= 30) ? 6 : 0),
    title: "หมายเกณฑ์",
    text: () => "หมายเกณฑ์ทหารมาถึงบ้าน — ลูกชายของคุณอยู่ในรายชื่อ ทัพจะออกในอีกสามวัน",
    choices: [
      { label: "ไปแทนลูก", run: (l) => { addStat(l, "health", -5); addFame(l, 3); return ok("คุณสวมเกราะเก่าแทนลูก — ทหารหนุ่มในแถวมองคุณด้วยความนับถือ"); } },
      { label: "จ่ายค่าไถ่ตัว", odds: (l) => clamp(0.4 + (l.stats.looks - 50) / 200 + l.money / 200_000, 0.1, 0.9), run: (l, _c, s) => { addMoney(l, -20 * TAEL); return s ? ok("นายทหารรับเงินแล้วขีดชื่อลูกออก") : no("นายทหารรับเงิน — แล้วเอาชื่อลูกไปอยู่ดี"); } },
      { label: "ให้ลูกไปตามหน้าที่", run: (l) => { const k = l.people.find((p) => p.alive && p.relation === "child" && p.age >= 15)!; if (chance(l, 0.3)) { k.alive = false; return no(`${k.name}ไม่ได้กลับมา — ห่อผ้าเปื้อนเลือดถูกส่งมาที่บ้านในฤดูหนาว`); } return meh(`${k.name}กลับมาในอีกสองปี — ผอมลง เงียบขึ้น และไม่เล่าอะไรเลย`); } },
    ],
  },
  {
    id: "mw.war.supply",
    minAge: 16,
    maxAge: 70,
    maxTimes: 2,
    weight: (l) => (isWar(l) && myLord(l) ? 4 : 0),
    title: "ขบวนเสบียง",
    text: () => "คุณได้รับคำสั่งคุ้มกันขบวนเสบียงผ่านเขตข้าศึก — ถ้าเสบียงไม่ถึง ทัพหน้าจะอดตาย",
    choices: [
      { label: "ใช้ทางหลัก เร็วแต่เสี่ยง", odds: (l) => clamp(0.45 + pow(l) * 0.07, 0.15, 0.9), run: (l, _c, s) => { const k = myLord(l)!; if (s) { k.power = clamp(k.power + 4, 5, 95); l.flags.warRank = Number(l.flags.warRank ?? 0) + 1; return ok("เสบียงถึงทัพหน้าทันเวลา — แม่ทัพจำชื่อคุณได้"); } k.power = clamp(k.power - 5, 5, 95); addStat(l, "health", -10); return no("ข้าศึกดักกลางทาง เผาเกวียนไปครึ่งหนึ่ง"); } },
      { label: "อ้อมทางป่า ช้าแต่ปลอดภัย", odds: (l) => clamp(0.5 + (l.stats.smarts - 50) / 150, 0.2, 0.92), run: (_l, _c, s) => (s ? ok("ช้ากว่ากำหนดสองวัน แต่ไม่เสียเกวียนสักเล่ม") : no("ป่าลึกกว่าที่คิด — เสบียงไปถึงตอนทัพหน้าถอยแล้ว")) },
    ],
  },
  {
    id: "mw.war.envoy",
    minAge: 25,
    maxAge: 75,
    maxTimes: 1,
    weight: (l) => (isWar(l) && l.flags.warRole === "strategist" ? 5 : 0),
    title: "ทูตไปแคว้นศัตรู",
    text: (l) => `${myLord(l)?.lord ?? "นายของคุณ"}ส่งคุณไปเป็นทูตเจรจาพันธมิตรกับแคว้นที่สาม — ในราชสำนักนั้น ครึ่งหนึ่งอยากตัดหัวทูตแคว้นอื่น`,
    choices: [
      { label: "โต้วาทีกับขุนนางทั้งราชสำนัก", odds: (l) => clamp(0.35 + (l.stats.smarts - 50) / 100, 0.1, 0.92), survival: (l) => clamp(0.85 + (l.stats.smarts - 50) / 300, 0.6, 0.98), run: (l, _c, s) => { if (s) { const k = myLord(l); if (k) k.power = clamp(k.power + 15, 5, 95); addFame(l, 8); return big("คุณโต้ขุนนางสิบสองคนจนเงียบทั้งห้อง — พันธมิตรสำเร็จ ชื่อคุณดังไปทั้งสามแคว้น"); } if (!chance(l, 0.8)) { kill(l, "ถูกประหารกลางราชสำนักแคว้นศัตรูขณะเป็นทูต"); return no("เจ้าแคว้นโบกมือ — ดาบเพชฌฆาตยกขึ้น"); } return no("การเจรจาล่ม คุณถูกขับไล่กลับมาพร้อมความอับอาย"); } },
      { label: "ใช้ของขวัญและสินบน", odds: (l) => clamp(0.3 + l.money / 300_000 + (l.stats.looks - 50) / 200, 0.1, 0.85), run: (l, _c, s) => { addMoney(l, -30 * TAEL); return s ? ok("ทองคำเปิดประตูที่คำพูดเปิดไม่ได้ — พันธมิตรได้ แต่ไม่มั่นคงนัก") : no("ขุนนางรับทองแล้วเปลี่ยนใจในวันรุ่งขึ้น"); } },
    ],
  },
  {
    id: "mw.war.spy",
    minAge: 18,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => (isWar(l) && myLord(l) ? 3 : 0),
    title: "สายลับในค่าย",
    text: () => "แผนการรบรั่วไปถึงข้าศึกสามครั้งติด — คุณสงสัยว่าใครบางคนในค่ายเป็นสายลับ",
    choices: [
      { label: "วางกับดักด้วยแผนปลอม", check: { stat: "smarts", dc: 60 }, run: (l, _c, s) => { if (s) { l.flags.warRank = Number(l.flags.warRank ?? 0) + 1; return ok("แผนปลอมไปถึงข้าศึก — และสายลับถูกจับได้ขณะส่งข่าว เป็นรองแม่ทัพเอง"); } return no("สายลับรู้ทัน — และเริ่มใส่ร้ายคุณแทน"); } },
      { label: "รายงานเจ้าแคว้นทันที", run: () => meh("เจ้าแคว้นสั่งสอบสวนทั้งค่าย — ทุกคนระแวงกัน ขวัญทัพตกต่ำ") },
    ],
  },
];
