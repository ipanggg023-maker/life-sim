// M16 — ระบบประจำโลก Hunter
// 1) ตลาดคอร์มอนสเตอร์: บอสดรอปคอร์ให้เก็บไว้เอง ราคาขึ้นลงทุกปีตามเหตุการณ์ของโลก
// 2) กิลด์ของตัวเอง: แรงก์ B ขึ้นไปก่อตั้งได้ รับสมาชิก เลเวล/ชื่อเสียง รายรับรายจ่ายรายปี
// 3) Gate Break กลางเมือง: ปีที่ประตูแตก (ดู events/m16Break.ts) ราคาคอร์พุ่ง
// สถานะทั้งหมดอยู่ใน life.flags (ไม่แตะ types.ts)
import { yearHooks } from "../../engine/game";
import { chance, nextFloat, pick, randInt } from "../../engine/rng";
import type { Outcome } from "../../engine/events";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, log, money, randomName } from "../../engine/util";
import { GATE_PAY, RETAINER, guildHooks, rankName } from "./power";

// ───────────────────────── ตลาดคอร์ ─────────────────────────

export const CORE_TIERS = [
  { name: "คอร์เศษผลึก", emoji: "🔹", ranks: "F–D", base: 20_000 },
  { name: "คอร์สีคราม", emoji: "🔷", ranks: "C–B", base: 600_000 },
  { name: "คอร์สีเลือด", emoji: "🔴", ranks: "A–S", base: 15_000_000 },
  { name: "คอร์มังกร", emoji: "🐉", ranks: "SS–SSS", base: 300_000_000 },
] as const;

export const tierOf = (gateRank: number) => (gateRank <= 2 ? 0 : gateRank <= 4 ? 1 : gateRank <= 6 ? 2 : 3);
export const coresOf = (l: Life, tier: number) => Number(l.flags[`core${tier}`] ?? 0);
export const totalCores = (l: Life) => CORE_TIERS.reduce((s, _t, i) => s + coresOf(l, i), 0);
/** ดัชนีราคาตลาด (100 = ปกติ) */
export const marketIndex = (l: Life) => Number(l.flags.coreMkt ?? 100);
export const corePrice = (l: Life, tier: number) => Math.round((CORE_TIERS[tier].base * marketIndex(l)) / 100 / 1000) * 1000;
export const holdingValue = (l: Life) => CORE_TIERS.reduce((s, _t, i) => s + coresOf(l, i) * corePrice(l, i), 0);

export function addCores(l: Life, tier: number, n: number) {
  l.flags[`core${tier}`] = Math.max(0, coresOf(l, tier) + n);
  if (n > 0) l.flags.coreDrops = Number(l.flags.coreDrops ?? 0) + n;
}

/** บอสดรอปคอร์ (เฉพาะโลก Hunter) — คืนข้อความต่อท้าย */
export function dropCores(l: Life, gateRank: number): string {
  if (l.worldId !== "hunter") return "";
  const tier = tierOf(clamp(gateRank, 0, 8));
  // แรงก์บนของแต่ละชั้นดรอปเยอะกว่า
  const n = 1 + (chance(l, 0.25 + (gateRank % 2) * 0.15) ? 1 : 0);
  addCores(l, tier, n);
  return ` · เก็บ${CORE_TIERS[tier].emoji}${CORE_TIERS[tier].name} ${n} ก้อนไว้เอง`;
}

/** ขายคอร์ (ตลาดสมาคม หรือตลาดมืด) */
export function sellCores(l: Life, tier: number, n: number, black = false): Outcome {
  const have = coresOf(l, tier);
  const k = Math.min(have, n);
  if (k <= 0) return { text: "ไม่มีคอร์ชั้นนี้ให้ขาย" };
  const t = CORE_TIERS[tier];
  addCores(l, tier, -k);
  if (black) {
    l.flags.blackDeals = Number(l.flags.blackDeals ?? 0) + 1;
    // ยิ่งขายตลาดมืดบ่อยยิ่งเสี่ยงโดนตรวจ
    if (chance(l, Math.min(0.5, 0.12 + Number(l.flags.blackDeals) * 0.04))) {
      const fine = Math.round(corePrice(l, tier) * k * 0.8);
      addMoney(l, -fine);
      addFame(l, -8);
      return { text: `🚨 หน่วยตรวจสอบสมาคมบุกโกดังของนายหน้า! คอร์ ${k} ก้อนถูกยึด และคุณโดนปรับ ${money(l, fine)}`, kind: "bad" };
    }
    const got = Math.round(corePrice(l, tier) * k * 1.5);
    addMoney(l, got);
    l.flags.coreEarned = Number(l.flags.coreEarned ?? 0) + got;
    return { text: `🕶️ นายหน้าตลาดมืดรับ${t.name} ${k} ก้อน จ่ายเงินสดไม่ถามที่มา ${money(l, got)}`, kind: "good" };
  }
  const got = corePrice(l, tier) * k;
  addMoney(l, got);
  l.flags.coreEarned = Number(l.flags.coreEarned ?? 0) + got;
  return { text: `💎 ขาย${t.name} ${k} ก้อนให้ตลาดของสมาคม ได้ ${money(l, got)}`, kind: "good" };
}

export function sellAllCores(l: Life): Outcome {
  let got = 0;
  for (let i = 0; i < CORE_TIERS.length; i++) {
    const k = coresOf(l, i);
    if (!k) continue;
    got += corePrice(l, i) * k;
    addCores(l, i, -k);
  }
  if (!got) return { text: "ไม่มีคอร์ให้ขาย" };
  addMoney(l, got);
  l.flags.coreEarned = Number(l.flags.coreEarned ?? 0) + got;
  return { text: `💎 เทขายคอร์ทั้งหมดที่ตลาดสมาคม ได้ ${money(l, got)} (ดัชนีราคา ${marketIndex(l)})`, kind: "good" };
}

export const MARKET_NEWS: Record<string, string> = {
  break: "Gate Break ในเมือง — คอร์ขาดตลาด ราคาพุ่ง",
  glut: "คอร์ล้นตลาดจากการเคลียร์ Gate ครั้งใหญ่ — ราคาดิ่ง",
  tech: "บริษัทพลังงานประกาศเครื่องปฏิกรณ์คอร์รุ่นใหม่ — แห่ซื้อ",
  calm: "ตลาดเงียบ ราคาเคลื่อนไหวตามปกติ",
  ban: "ต่างประเทศจำกัดการนำเข้าคอร์ — ราคาในประเทศอ่อนตัว",
};

/** ปรับดัชนีตลาดทุกปี (ถูกเรียกจาก yearHook) */
function driftMarket(l: Life) {
  let idx = marketIndex(l);
  idx += (100 - idx) * 0.35 + randInt(l, -12, 12);
  let news = "calm";
  if (l.flags.breakAge === l.age) {
    idx += randInt(l, 40, 90);
    news = "break";
  } else if (chance(l, 0.06)) {
    idx -= randInt(l, 30, 50);
    news = "glut";
  } else if (chance(l, 0.05)) {
    idx += randInt(l, 25, 45);
    news = "tech";
  } else if (chance(l, 0.04)) {
    idx -= randInt(l, 15, 30);
    news = "ban";
  }
  l.flags.coreMkt = Math.round(clamp(idx, 30, 320));
  l.flags.coreNews = news;
  const peak = Number(l.flags.coreMktPeak ?? 100);
  if (l.flags.coreMkt > peak) l.flags.coreMktPeak = l.flags.coreMkt;
}

// ───────────────────────── Gate Break ─────────────────────────

/** ปีที่ประตูแตกกลางเมือง — สุ่มก่อน event ของปีถูกเลือก */
function rollBreak(l: Life) {
  if (l.age < 5) return;
  const since = l.age - Number(l.flags.breakAge ?? -99);
  if (since >= 4 && chance(l, 0.075)) {
    l.flags.breakAge = l.age;
    l.flags.breaks = Number(l.flags.breaks ?? 0) + 1;
  }
}

// ───────────────────────── กิลด์ของตัวเอง ─────────────────────────

export interface Member {
  /** ชื่อ */
  n: string;
  /** แรงก์ */
  r: number;
  /** ความภักดี 0–100 */
  y: number;
  /** ฉายา/บทบาทในกิลด์ */
  t: string;
}

export const FOUND_COST = 30_000_000;
export const FOUND_FAME = 15;
export const MAX_GUILD_LV = 5;
export const myGuild = (l: Life) => (l.flags.myGuild ? String(l.flags.myGuild) : undefined);
export const guildLv = (l: Life) => Number(l.flags.gLv ?? 0);
export const guildRep = (l: Life) => Number(l.flags.gRep ?? 0);
export const rosterCap = (l: Life) => 3 + guildLv(l) * 3;

export function roster(l: Life): Member[] {
  try {
    return JSON.parse(String(l.flags.gRoster ?? "[]")) as Member[];
  } catch {
    return [];
  }
}
export const setRoster = (l: Life, m: Member[]) => {
  l.flags.gRoster = JSON.stringify(m);
};
/** อันดับกิลด์ในประเทศ (โดยประมาณ) */
export const guildRanking = (l: Life) => Math.max(1, Math.round(80 - guildLv(l) * 12 - guildRep(l) / 4 - roster(l).length));

const ROLES = ["ดาบหน้า", "นักเวทประจำทีม", "ฮีลเลอร์", "หน่วยสอดแนม", "แทงก์", "พ่อครัวประจำกิลด์", "นักบัญชีที่ตื่นพลัง", "เด็กฝึกงาน"];

export function canFound(l: Life): string | undefined {
  if (l.worldId !== "hunter") return "เฉพาะโลก Hunter";
  if (!l.power) return "ยังไม่ตื่นพลัง";
  if (myGuild(l)) return "มีกิลด์แล้ว";
  if (l.power.rank < 4) return "ต้องแรงก์ B ขึ้นไป";
  if (l.job?.careerId !== "hunter") return "ต้องลงทะเบียนเป็น Hunter";
  if (l.money < FOUND_COST) return `ต้องมีเงิน ${money(l, FOUND_COST)}`;
  if (l.fame < FOUND_FAME) return `ต้องมีชื่อเสียง ${FOUND_FAME}+`;
  if (l.queue.length) return "กำลังมีเหตุการณ์อยู่";
  return;
}

export function newMember(l: Life, rank: number, role?: string): Member {
  const nm = randomName(l, chance(l, 0.5) ? "m" : "f");
  return { n: l.country && l.country !== "th" ? `${nm.last} ${nm.first}` : `${nm.first} (${nm.nick})`, r: clamp(rank, 0, 8), y: randInt(l, 45, 75), t: role ?? pick(l, ROLES) };
}

export function foundGuild(l: Life, name: string): Outcome {
  const why = canFound(l);
  if (why) return { text: `ก่อตั้งกิลด์ไม่ได้: ${why}` };
  const clean = name.trim().slice(0, 24) || `กิลด์${l.lastName}`;
  addMoney(l, -FOUND_COST);
  l.flags.myGuild = clean;
  l.flags.gLv = 1;
  l.flags.gRep = 20;
  l.flags.gFounded = l.age;
  l.power!.guild = undefined; // ออกจากกิลด์เดิม
  const r = l.power!.rank;
  const vice = createPerson(l, "ally", { age: l.age + randInt(l, -3, 6), bond: 65, job: `รองหัวหน้า${clean}` });
  l.flags.gVice = vice.id;
  setRoster(l, [newMember(l, r - 2, "ดาบหน้า"), newMember(l, r - 3, "ฮีลเลอร์")]);
  addFame(l, 6);
  return { text: `🏰 ก่อตั้ง「${clean}」สำเร็จ! ป้ายชื่อกิลด์ขึ้นหน้าตึกเช่าเก่าๆ แห่งหนึ่ง สมาชิกเริ่มต้น 2 คน และรองหัวหน้าที่ไว้ใจได้ ${vice.name}`, kind: "milestone" };
}

export const recruitCost = (l: Life) => Math.round(RETAINER[clamp((l.power?.rank ?? 0) - 1, 0, 8)] * 0.5);

export function canRecruit(l: Life): string | undefined {
  if (!myGuild(l)) return "ยังไม่มีกิลด์";
  if (l.doneThisYear.includes("g:recruit")) return "ปีนี้เปิดรับสมัครไปแล้ว";
  if (roster(l).length >= rosterCap(l)) return `สมาชิกเต็ม (เพิ่มได้เมื่อกิลด์เลเวลอัป)`;
  if (l.money < recruitCost(l)) return `ต้องมีเงิน ${money(l, recruitCost(l))}`;
  return;
}

/** เปิดรับสมัครสมาชิก: ชื่อเสียงกิลด์สูงได้คนเก่ง */
export function recruit(l: Life): Outcome {
  const why = canRecruit(l);
  if (why) return { text: why };
  l.doneThisYear.push("g:recruit");
  addMoney(l, -recruitCost(l));
  const r = (l.power?.rank ?? 0) - 3 + (chance(l, guildRep(l) / 100) ? 2 : 0) + (chance(l, 0.1) ? 1 : 0);
  const m = newMember(l, r);
  setRoster(l, [...roster(l), m]);
  return { text: `📋 ผู้สมัครเข้ากิลด์หลายสิบคน คุณเลือก ${m.n} แรงก์ ${rankName(m.r)} (${m.t})`, kind: "good" };
}

export function disbandGuild(l: Life): Outcome {
  const name = myGuild(l);
  if (!name) return { text: "ไม่มีกิลด์" };
  for (const k of ["myGuild", "gLv", "gRep", "gRoster", "gFounded", "gNet", "gVice"]) delete l.flags[k];
  addStat(l, "happiness", -10);
  return { text: `คุณถอดป้าย「${name}」ลงจากหน้าตึกด้วยมือตัวเอง ทุกคนแยกย้ายกันไป`, kind: "bad" };
}

export function addRep(l: Life, d: number) {
  if (myGuild(l)) l.flags.gRep = clamp(guildRep(l) + d, 0, 100);
}

const LV_REP = [0, 0, 30, 50, 70, 88];

/** รายรับรายจ่ายของกิลด์ปีนี้ */
export function guildYear(l: Life) {
  const name = myGuild(l);
  if (!name || !l.power) return;
  let m = roster(l);
  const lv = guildLv(l);
  const rep = guildRep(l);
  // สมาชิกโตขึ้น / ความภักดีเปลี่ยน
  m = m.map((x) => ({ ...x, r: x.r < 7 && chance(l, 0.06) ? x.r + 1 : x.r, y: clamp(x.y + (rep >= 50 ? 2 : rep < 25 ? -6 : -1) + randInt(l, -3, 3), 0, 100) }));
  // คนที่ไม่ภักดีลาออก
  const leaving = m.filter((x) => x.y < 20 && chance(l, 0.5));
  if (leaving.length) {
    m = m.filter((x) => !leaving.includes(x));
    log(l, `${leaving.map((x) => x.n).join(", ")} ยื่นใบลาออกจาก「${name}」— "ขอโทษครับหัวหน้า ที่อื่นให้มากกว่า"`, "bad");
  }
  const income = m.reduce((s, x) => s + GATE_PAY[x.r] * 0.9 * (0.6 + (rep / 100) * 0.8), 0) * (1 + lv * 0.08);
  const cost = m.reduce((s, x) => s + RETAINER[x.r] * 0.35, 0) + lv * 400_000;
  const net = Math.round(((income - cost) * (0.75 + nextFloat(l) * 0.5)) / 1000) * 1000;
  addMoney(l, net);
  l.flags.gNet = net;
  l.flags.gTotal = Number(l.flags.gTotal ?? 0) + net;
  l.flags.income = Number(l.flags.income ?? 0) + net;
  setRoster(l, m);
  addRep(l, net > 0 ? 2 : -3);
  // เลเวลอัป
  if (lv < MAX_GUILD_LV && guildRep(l) >= LV_REP[lv + 1] && m.length >= lv * 2) {
    l.flags.gLv = lv + 1;
    addFame(l, 4);
    log(l, `🏰 「${name}」เลื่อนเป็นกิลด์เลเวล ${lv + 1}! สมาคมจัดอันดับให้อยู่ที่ #${guildRanking(l)} ของประเทศ`, "milestone");
  }
  l.flags.gPeakLv = Math.max(Number(l.flags.gPeakLv ?? 0), guildLv(l));
}

// กิลด์ของตัวเองทำหน้าที่เหมือนกิลด์จริง: ยิ่งเลเวลสูง ยิ่งช่วยในการต่อสู้และปลอดภัยขึ้น
guildHooks.push((l) => {
  const name = myGuild(l);
  if (!name || l.worldId !== "hunter") return;
  const lv = guildLv(l);
  return { id: "own", name, minRank: 4, pay: 1.3 + lv * 0.25, cp: Math.round(2 + lv * 1.5) + (l.flags.gHall ? 1 : 0), safety: 0.02 * lv, desc: "กิลด์ที่คุณก่อตั้งเอง" };
});

// ───────────────────────── ทุกปี ─────────────────────────

yearHooks.push((l) => {
  if (l.worldId !== "hunter" || !l.alive) return;
  rollBreak(l);
  driftMarket(l);
  guildYear(l);
});
