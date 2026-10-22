// เฟส D — สงครามสำนัก (ROADMAP: คำตัดสินของผู้เล่น)
// ความตึงเครียดสะสม → ประกาศสงคราม → พันธมิตรรวมพล → แนวรบเคลื่อนทุกปีตามกำลัง + ผลงานของผู้เล่น → ปิดล้อม → จบสงคราม/สงบศึก
// ผู้เล่นเลือกข้างหรือเป็นกลาง · รบแนวหน้า ป้องกันประตู สอดแนม ลอบสังหารประมุข นำทัพ เป็นทูตสันติภาพ หรือหนีทัพ
// ผลจริง: NPC ที่อยู่สำนักในสงครามตายในศึกได้ · สำนักแพ้อาจล่มสลาย · ประวัติสงครามถูกจดไว้
import type { Ctx, GameEvent, Outcome } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, clamp, log, shortName } from "../../../engine/util";
import { fightOdds } from "../../hunter/power";
import { DUEL_END } from "../life/duel";
import { calYear } from "../life/world";
import { B, BIG, C, E, FIGHT, G, K, N, P, TAEL, near, type Res } from "../story/kit";
import { factionById, factions, shiftRep, type Faction } from "./factions";
import { mySect } from "../m17core";

export interface SectWar {
  id: string;
  a: string[];
  b: string[];
  cause: string;
  since: number;
  /** แนวรบ −100..100 (บวก = ฝ่าย A ได้เปรียบ) */
  front: number;
  ended?: number;
  /** "a" | "b" | "truce" */
  result?: "a" | "b" | "truce";
  deaths: number;
}

/** ชื่อสำนักของ NPC (npcMartial) → ฝ่ายในโลก */
const SECT_FACTION: Record<string, string> = { สำนักกระบี่เมฆา: "cloud", วัดวัชระ: "vajra", พรรคกระยาจก: "beggar", ตระกูลถัง: "tang" };

export const warsOf = (l: Life): SectWar[] => (l.mw ? (l.mw.wars ??= []) : []);
export const activeWar = (l: Life) => warsOf(l).find((w) => !w.ended);
const names = (l: Life, ids: string[]) => ids.map((id) => factionById(l, id)?.name ?? id).join(" + ");
const power = (l: Life, ids: string[]) => ids.reduce((s, id) => s + (factionById(l, id)?.power ?? 0), 0);
const lead = (ids: string[]) => ids[0];
/** ฝั่งของผู้เล่น: "a" | "b" | undefined */
export const mySide = (l: Life): "a" | "b" | undefined => (l.flags.warSide === "a" || l.flags.warSide === "b" ? (l.flags.warSide as "a" | "b") : undefined);
export const sideNames = (l: Life, w: SectWar, s: "a" | "b") => names(l, w[s]);

const CAUSES = [
  "ศิษย์สายตรงของสองสำนักฆ่ากันตายในงานเลี้ยง",
  "คัมภีร์โบราณที่ทั้งสองฝ่ายอ้างว่าเป็นของตน",
  "เหมืองหยกบนภูเขาที่อยู่ระหว่างเขตสองสำนัก",
  "ประมุขฝ่ายหนึ่งถูกวางยาตาย และทุกหลักฐานชี้ไปที่อีกฝ่าย",
  "ความแค้นเก่าจากศึกเมื่อร้อยปีก่อนที่ไม่เคยจบจริง",
];

/** เริ่มสงคราม: เลือกคู่ขัดแย้งตามสภาพโลก แล้วรวมพันธมิตร */
function declare(l: Life, w = l.mw!): SectWar | undefined {
  const fs = factions(l).filter((f) => f.status !== "fallen");
  const demon = fs.find((f) => f.side === "demonic" && f.power >= 60);
  let a: Faction | undefined, b: Faction | undefined;
  if (demon && chance(l, 0.5 + (w.cult - 50) / 100)) { a = demon; b = fs.filter((f) => f.side === "orthodox").sort((x, y) => y.power - x.power)[0]; }
  else {
    const pool = fs.filter((f) => f.side !== "demonic");
    a = pick(l, pool);
    b = pick(l, pool.filter((f) => f.id !== a!.id && (f.side !== a!.side || chance(l, 0.3))));
  }
  if (!a || !b) return;
  const sa = [a.id], sb = [b.id];
  // พันธมิตรรวมพล: ฝ่ายเดียวกันมักเข้าร่วม · มรรคาดำเลือกข้างที่มีเงิน
  for (const f of fs) {
    if (sa.includes(f.id) || sb.includes(f.id)) continue;
    if (f.side === b.side && b.side === "orthodox" && a.side === "demonic" && chance(l, 0.75)) sb.push(f.id);
    else if (f.side === a.side && f.side !== "orthodox" && chance(l, 0.45)) sa.push(f.id);
    else if (f.id === "blackway" && chance(l, 0.35)) (chance(l, 0.5) ? sa : sb).push(f.id);
  }
  const war: SectWar = { id: `w${calYear(l)}`, a: sa, b: sb, cause: pick(l, CAUSES), since: calYear(l), front: 0, deaths: 0 };
  warsOf(l).push(war);
  if (warsOf(l).length > 8) warsOf(l).splice(0, warsOf(l).length - 8);
  log(l, `⚔️ สงครามสำนักปะทุ! ${names(l, sa)} ปะทะ ${names(l, sb)} — ต้นเหตุ: ${war.cause}`, "bad");
  if (l.power) l.flags.warNew = war.id;
  return war;
}

/** จบสงคราม: ฝ่ายแพ้เสียหายหนัก (อาจล่มสลาย) ฝ่ายชนะได้อำนาจ */
function endWar(l: Life, war: SectWar, result: SectWar["result"]) {
  war.ended = calYear(l);
  war.result = result;
  if (result === "truce") log(l, `🕊️ ${names(l, war.a)} กับ ${names(l, war.b)} ยอมสงบศึก — ศพ ${war.deaths} ศพไม่ได้อะไรกลับมาเลย`);
  else {
    const win = result === "a" ? war.a : war.b, lose = result === "a" ? war.b : war.a;
    for (const id of lose) { const f = factionById(l, id); if (f) { f.power = clamp(f.power - randInt(l, 25, 40), 0, 100); f.unity = clamp(f.unity - 15, 0, 100); if (f.power <= 5) f.status = "fallen"; f.leader = `ผู้สืบทอดของ${f.leader}`; f.leaderAge = randInt(l, 30, 50); } }
    for (const id of win) { const f = factionById(l, id); if (f) f.power = clamp(f.power + 10, 0, 100); }
    log(l, `🏳️ สงครามจบลง — ${names(l, win)} ชนะ · ประมุข${factionById(l, lead(lose))?.name ?? ""}ถูกสังหารที่ประตูภูเขาของตัวเอง`, "milestone");
  }
  l.chron = [...(l.chron ?? []), { year: calYear(l), text: `สงคราม${names(l, war.a)}–${names(l, war.b)} จบด้วย${result === "truce" ? "การสงบศึก" : `ชัยชนะของ${names(l, result === "a" ? war.a : war.b)}`}` }];
  if (mySide(l)) l.flags.warAfter = JSON.stringify({ result, side: mySide(l), id: war.id });
}

/** ทุกปี: ความตึงเครียด → สงคราม · แนวรบเคลื่อน · คนตายในศึก */
function tickWars(l: Life) {
  if (l.worldId !== "murim" || !l.alive || !l.mw || l.mw.era === "war") return;
  const war = activeWar(l);
  if (!war) {
    const last = warsOf(l).at(-1);
    const quiet = calYear(l) - (last?.ended ?? last?.since ?? -99) >= 6;
    if (quiet && chance(l, 0.05 + Math.max(0, l.mw.cult - 60) / 200)) declare(l);
    return;
  }
  // แนวรบ: กำลังรวม + ผลงานของผู้เล่น + ดวง
  const contrib = Number(l.flags.warContrib ?? 0) * (mySide(l) === "a" ? 1 : mySide(l) === "b" ? -1 : 0);
  delete l.flags.warContrib;
  war.front = clamp(war.front + (power(l, war.a) - power(l, war.b)) / 12 + randInt(l, -15, 15) + contrib, -100, 100);
  for (const id of [...war.a, ...war.b]) { const f = factionById(l, id); if (f) f.power = clamp(f.power - randInt(l, 1, 4), 0, 100); }
  war.deaths += randInt(l, 40, 200);
  // คนที่คุณรู้จักที่อยู่ในสำนักที่รบกัน — ตายในศึกได้จริง
  for (const p of l.people) {
    const fid = p.martial?.sect ? SECT_FACTION[p.martial.sect] : undefined;
    if (!p.alive || !fid || ![...war.a, ...war.b].includes(fid) || p.age < 16 || p.age > 65) continue;
    if (chance(l, 0.06)) { p.alive = false; war.deaths++; if (p.bond >= 30 || p.tags?.includes("life_rival")) log(l, `💔 ${shortName(p)}ตายในสนามรบของ${factionById(l, fid)?.name} — ศพถูกส่งกลับมาในเกวียนพร้อมคนอื่นอีกสิบกว่าศพ`, "bad"); }
  }
  const years = calYear(l) - war.since;
  if (war.front >= 100) endWar(l, war, "a");
  else if (war.front <= -100) endWar(l, war, "b");
  else if (years >= 8 || (years >= 4 && Math.abs(war.front) < 20 && chance(l, 0.25))) endWar(l, war, "truce");
}
yearHooks.push(tickWars);

const W = (l: Life) => activeWar(l)!;
const contrib = (n: number, r: Res): Res => Object.assign((l: Life, c: Ctx) => { l.flags.warContrib = Number(l.flags.warContrib ?? 0) + n; return r(l, c); }, { fx: r.fx });
const join = (side: "a" | "b" | "none", r: Res): Res =>
  Object.assign((l: Life, c: Ctx) => {
    l.flags.warSide = side;
    delete l.flags.warNew;
    const w = activeWar(l);
    if (w && side !== "none") { for (const id of w[side]) shiftRep(l, id, 15); for (const id of w[side === "a" ? "b" : "a"]) shiftRep(l, id, -20); }
    return r(l, c);
  }, { fx: r.fx });
const enemyRank = (l: Life) => clamp((l.power?.rank ?? 1) + (chance(l, 0.5) ? 0 : 1), 1, 7);
const canLead = (l: Life) => (l.power?.rank ?? 0) >= 4 || !!mySect(l);
const sideOfGuild = (l: Life, w: SectWar) => (l.power?.guild && w.a.includes(l.power.guild) ? "a" : l.power?.guild && w.b.includes(l.power.guild) ? "b" : undefined);

export const WAR_EVENTS2: GameEvent[] = [
  E("sw.declared", [14, 85], (l) => { const w = W(l); const mine = sideOfGuild(l, w); return `สงครามสำนักปะทุ — ${sideNames(l, w, "a")} ปะทะ ${sideNames(l, w, "b")} เพราะ${w.cause}${mine ? ` · สำนักของคุณอยู่ฝ่าย${sideNames(l, w, mine)} ทุกคนรอดูว่าคุณจะทำอะไร` : " · ทั้งสองฝ่ายส่งคนมาทาบทามคุณ"}`; }, [
    C((l) => `เข้าร่วมฝ่าย${sideNames(l, W(l), "a")}`, join("a", G("คุณผูกผ้าแถบสีของฝ่ายนี้ไว้ที่แขน — ไม่มีทางถอยกลับแล้ว", { fame: 2 }))),
    C((l) => `เข้าร่วมฝ่าย${sideNames(l, W(l), "b")}`, join("b", G("คุณผูกผ้าแถบสีของฝ่ายนี้ไว้ที่แขน — ไม่มีทางถอยกลับแล้ว", { fame: 2 }))),
    C("วางตัวเป็นกลาง", join("none", N("คุณปิดประตูบ้าน — สงครามจะผ่านไปโดยไม่มีคุณ หรือไม่ก็มาเคาะถึงประตูเอง", {}))),
  ], { when: (l) => !!l.flags.warNew && !!activeWar(l) && !!l.power, forced: true, weight: 60, maxTimes: 0, title: "สงครามสำนัก" }),

  E("sw.battle", [16, 80], (l) => { const w = W(l); const s = mySide(l)!; return `ปีที่ ${calYear(l) - w.since + 1} ของสงคราม — ฝ่ายคุณ (${sideNames(l, w, s)}) ${(s === "a" ? w.front : -w.front) >= 30 ? "กำลังรุก" : (s === "a" ? w.front : -w.front) <= -30 ? "กำลังถอย" : "ยันกันอยู่"} ศพสะสม ${w.deaths} ศพ แม่ทัพเรียกทุกคนมาแบ่งงาน`; }, [
    FIGHT("ออกรบแนวหน้า", "ยอดฝีมือของฝ่ายศัตรู", enemyRank, { lethal: true, on: "sectwar", intro: "ธงสองสีโบกสะบัดเหนือหุบเขา — คุณพุ่งเข้าไปพร้อมคนอีกร้อยคน" }),
    K("เฝ้าประตูภูเขา ป้องกันการลอบโจมตี", "health", 50, contrib(8, G("ศัตรูลอบปีนหน้าผาตอนตีสาม — คุณตีระฆังทันเวลา ประตูภูเขาไม่แตก", { fame: 2 })), contrib(-5, B("คุณเผลอหลับในคืนที่ศัตรูมา — คนเฝ้าประตูตายไปสามคน", { hp: -10, joy: -6 }))),
    K("สอดแนมค่ายศัตรู", "smarts", 55, contrib(14, G("คุณจดจำตำแหน่งยุ้งเสบียงของศัตรูกลับมาได้ — ทัพของคุณเผามันในคืนถัดมา", { fame: 3 })), B("คุณถูกจับได้ — หนีรอดมาพร้อมลูกธนูที่ไหล่", { hp: -14, wound: ["armL", "cut", 2] })),
    P("ลอบสังหารประมุขฝ่ายศัตรู", (l) => clamp(fightOdds(l, 5) - 0.25, 0.03, 0.6), contrib(40, BIG((l) => `ประมุข${factionById(l, lead(W(l)[mySide(l) === "a" ? "b" : "a"]))?.name ?? "ฝ่ายศัตรู"}ล้มลงในเต็นท์ของตัวเอง — ทั้งทัพศัตรูแตกตื่น`, { fame: 12, align: -4 })), B("องครักษ์ประมุขอยู่ทุกมุม — คุณหนีออกมาพร้อมแผลสาหัส", { hp: -30, wound: ["organs", "internal", 2] }), { tone: "danger", survival: (l) => clamp(fightOdds(l, 5), 0.4, 0.9) }),
    C("หนีทัพ", Object.assign((l: Life, c: Ctx): Outcome => { const w = W(l); const s = mySide(l)!; for (const id of w[s]) shiftRep(l, id, -40); l.flags.warSide = "none"; l.flags.deserter = true; return N("คุณหายไปในคืนเดือนมืด — ชื่อคุณถูกขีดออกจากทะเบียนศิษย์ และถูกตราหน้าว่าคนทรยศ", { fame: -6, align: -2 })(l, c); }, { fx: { fame: -6 } })),
  ], { when: (l) => !!activeWar(l) && !!mySide(l) && !!l.power && !l.flags.warNew, weight: 25, maxTimes: 0, title: "ศึกประจำปี" }),

  E("sw.command", [25, 90], (l) => `เจ้าสำนักฝ่ายคุณมอบตราบัญชาการให้คุณนำทัพหนึ่งปีกเต็ม — ศิษย์สามร้อยคนรอฟังคำสั่ง (แนวรบ: ${mySide(l) === "a" ? W(l).front : -W(l).front})`, [
    P("บุกตรงหน้า", (l) => clamp(0.4 + (l.power?.rank ?? 0) * 0.05 + (l.stats.health - 50) / 300, 0.15, 0.85), contrib(30, BIG("ทัพของคุณทะลวงแนวศัตรูได้ในชั่วยามเดียว — ข่าวชื่อคุณแพร่ไปทั้งสองฝ่าย", { fame: 10, flag: "warHero" })), contrib(-15, B("แนวหน้าแตก ศิษย์ตายครึ่งปีก — คุณถูกเรียกตัวกลับไปรับโทษ", { fame: -6, joy: -10 }))),
    K("ลอบตีค่ายตอนกลางคืน", "smarts", 60, contrib(25, BIG("เปลวไฟในค่ายศัตรูสว่างไปทั้งหุบเขา — เสียหายน้อยที่สุด ได้ผลมากที่สุด", { fame: 8, flag: "warHero" })), contrib(-8, B("ศัตรูรู้แผนล่วงหน้า — มีหนอนบ่อนไส้ในทัพ", { joy: -6 }))),
    K("ล้อมตัดเสบียง รอให้อดตาย", "smarts", 50, contrib(18, G("สามเดือนต่อมาศัตรูกินม้าของตัวเอง — แนวรบขยับไปทางคุณโดยไม่เสียคนเลย", { fame: 4 })), N("ศัตรูหาเส้นทางส่งเสบียงใหม่ได้", {})),
  ], { when: (l) => !!activeWar(l) && !!mySide(l) && canLead(l) && !l.flags.warNew, weight: 10, maxTimes: 0, title: "นำทัพ" }),

  E("sw.envoy", [25, 90], (l) => `สงครามลากยาวมา ${calYear(l) - W(l).since} ปี ศพ ${W(l).deaths} ศพ — ผู้อาวุโสทั้งสองฝ่ายกระซิบว่าถ้ามีคนกลางที่ทั้งสองฝ่ายนับถือ อาจคุยกันได้`, [
    K("รับเป็นทูตสันติภาพ", "looks", 60, Object.assign((l: Life, c: Ctx): Outcome => { const w = activeWar(l); if (w) endWar(l, w, "truce"); return BIG("คุณเดินผ่านแนวรบไปพร้อมธงขาวผืนเดียว — สามเดือนต่อมามีการจุดธูปสาบานสงบศึกที่ศาลเจ้ากลางหุบเขา", { fame: 15, align: 8, flag: "peacemaker" })(l, c); }, { fx: { fame: 15 } }), B("ทูตจากฝ่ายตรงข้ามถูกวางยาระหว่างเจรจา — ทั้งสองฝ่ายโทษคุณ", { fame: -8, joy: -8 })),
    C("ไม่ใช่เรื่องของข้า", N("สงครามดำเนินต่อไป")),
  ], { when: (l) => !!activeWar(l) && calYear(l) - W(l).since >= 3 && l.fame >= 35, weight: 6, maxTimes: 1, title: "ทูตสันติภาพ" }),

  E("sw.neutral_toll", [16, 90], (l) => `แม้คุณจะไม่เลือกข้าง — ทหารของ${sideNames(l, W(l), chance(l, 0.5) ? "a" : "b")}มาเก็บ "ค่าคุ้มครอง" ถึงหน้าบ้าน และขู่จะเผาถ้าไม่จ่าย`, [
    C("จ่าย", N("ทหารนับเงินแล้วจากไป — สงครามมีราคาแม้คนที่ไม่ได้รบ", { tael: -15 })),
    FIGHT("ไล่ไป", "หัวหน้ากองทหารเก็บส่วย", near(0), { intro: "พวกมันชักดาบ — ชาวบ้านแอบดูจากหลังหน้าต่าง" }),
  ], { when: (l) => !!activeWar(l) && l.flags.warSide === "none" && l.age >= 18, weight: 4, maxTimes: 0, title: "ราคาของการเป็นกลาง" }),

  E("sw.aftermath", [14, 100], (l) => { const a = after(l); return a.result === "truce" ? "สงครามจบด้วยการสงบศึก — ไม่มีใครชนะ ทุกคนกลับบ้านพร้อมแผล" : a.result === a.side ? "ฝ่ายของคุณชนะสงคราม — ขบวนแห่กลับภูเขาเต็มไปด้วยธงและโลงศพพอๆ กัน" : "ฝ่ายของคุณแพ้สงคราม — ทหารฝ่ายชนะเริ่มไล่ล่าคนที่สวมผ้าแถบสีของฝ่ายคุณ"; }, [
    C("รับรางวัลจากเจ้าสำนัก", settle(BIG("คุณได้ชื่อจารึกบนป้ายวีรชนของสำนัก พร้อมทองหนึ่งหีบ", { fame: 10, tael: 80 })), { show: (l) => after(l).result === after(l).side }),
    C("ไปไหว้หลุมศพเพื่อนที่ตายในศึก", settle(G("คุณจุดธูปทีละหลุม — ชื่อบนป้ายหินเยอะกว่าที่คุณจำได้", { joy: -2, align: 2 })), { show: (l) => after(l).result !== "b" || after(l).side !== "a" }),
    P("หนีไปซ่อนตัว", (l) => clamp(0.5 + (l.stats.luck - 50) / 200, 0.2, 0.85), settle(N("คุณหายไปในหุบเขาทางใต้สามปี จนกว่าการไล่ล่าจะซา", { joy: -6 })), settle(B("ทหารฝ่ายชนะตามทัน — คุณรอดมาได้แต่เสียนิ้วไปสองนิ้ว", { hp: -20, wound: ["handL", "fingers", 3] })), { show: (l) => after(l).result !== "truce" && after(l).result !== after(l).side, tone: "danger", survival: () => 0.9 }),
    C("กลับไปใช้ชีวิตต่อ", settle(N("สงครามจบแล้ว — แต่บางคืนคุณยังได้ยินเสียงกลองศึกในฝัน"))),
  ], { when: (l) => !!l.flags.warAfter, forced: true, weight: 60, maxTimes: 0, title: "หลังสงคราม" }),
];

function after(l: Life): { result: SectWar["result"]; side: "a" | "b" } {
  try { return JSON.parse(String(l.flags.warAfter ?? "{}")); } catch { return { result: "truce", side: "a" }; }
}
function settle(r: Res): Res {
  return Object.assign((l: Life, c: Ctx) => { delete l.flags.warAfter; delete l.flags.warSide; return r(l, c); }, { fx: r.fx });
}
/** ผลการดวลในสนามรบ → แนวรบ */
DUEL_END.sectwar = (l, r) => {
  l.flags.warContrib = Number(l.flags.warContrib ?? 0) + (r === "win" ? 12 : r === "lose" ? -6 : 0);
  if (r === "win") { addFame(l, 2); addMoney(l, 5 * TAEL); }
  return r === "win" ? " — แนวรบขยับไปทางฝ่ายคุณ" : "";
};
