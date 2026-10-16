import { chance, nextFloat, pick, weightedPick } from "../../engine/rng";
import type { HunterClass, Life, StatKey } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, formatMoney, log } from "../../engine/util";

// ───────────────────────── แรงก์ ─────────────────────────

export const RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"] as const;
export const rankName = (r: number) => RANKS[clamp(r, 0, RANKS.length - 1)];
export const MAX_RANK = RANKS.length - 1;

// ───────────────────────── สายอาชีพ ─────────────────────────

export interface ClassInfo {
  id: HunterClass;
  name: string;
  emoji: string;
  key: StatKey;
  desc: string;
  /** สกิลที่ปลดล็อกตามเลเวล */
  skills: [number, string][];
  cp: number;
  survival: number;
}

export const CLASSES: ClassInfo[] = [
  {
    id: "sword", name: "นักดาบ", emoji: "⚔️", key: "health", desc: "บุกหน้า ดาเมจสูง", cp: 2, survival: 0,
    skills: [[1, "ฟันเสริมมานา"], [10, "ก้าวพริบตา"], [25, "ดาบพันใบ"], [45, "เจตจำนงดาบ"]],
  },
  {
    id: "mage", name: "นักเวท", emoji: "🔮", key: "smarts", desc: "เวทระยะไกล ทำลายล้างเป็นวงกว้าง", cp: 3, survival: -0.05,
    skills: [[1, "ลูกไฟ"], [10, "โล่มานา"], [25, "อุกกาบาตเพลิง"], [45, "พายุธาตุทั้งห้า"]],
  },
  {
    id: "healer", name: "ฮีลเลอร์", emoji: "✨", key: "smarts", desc: "รักษาตัวเองและทีม รอดง่าย สู้ไม่เก่ง", cp: -2, survival: 0.12,
    skills: [[1, "แสงเยียวยา"], [10, "พรคุ้มครอง"], [25, "ฟื้นคืนชีพฉุกเฉิน"], [45, "สวรรค์โปรด"]],
  },
  {
    id: "assassin", name: "นักลอบสังหาร", emoji: "🗡️", key: "luck", desc: "ซ่อนตัว จู่โจมจุดตาย", cp: 2, survival: 0.03,
    skills: [[1, "ซ่อนเร้น"], [10, "แทงจุดตาย"], [25, "ร่างเงา"], [45, "ราชันแห่งเงา"]],
  },
  {
    id: "tank", name: "แทงก์", emoji: "🛡️", key: "health", desc: "รับดาเมจแทนทีม ตายยาก", cp: 0, survival: 0.15,
    skills: [[1, "ยั่วยุ"], [10, "กำแพงเหล็ก"], [25, "ร่างไม่ล้ม"], [45, "ป้อมปราการมีชีวิต"]],
  },
  {
    id: "summoner", name: "ผู้อัญเชิญ", emoji: "👁️", key: "smarts", desc: "สายหายาก เรียกมอนสเตอร์มาสู้แทน", cp: 6, survival: 0.05,
    skills: [[1, "อัญเชิญหมาป่าเงา"], [10, "สัญญาวิญญาณ"], [25, "กองทัพอมตะ"], [45, "ประตูนรก"]],
  },
];

export const classById = (id: HunterClass) => CLASSES.find((c) => c.id === id)!;

// ───────────────────────── กิลด์ ─────────────────────────

export interface Guild {
  id: string;
  name: string;
  minRank: number;
  pay: number; // ตัวคูณรายได้
  cp: number;
  safety: number;
  desc: string;
}

export const GUILDS: Guild[] = [
  { id: "rice", name: "กิลด์ข้าวมันไก่ประตูน้ำ", minRank: 0, pay: 1.1, cp: 1, safety: 0.03, desc: "กิลด์เล็กๆ ของลุงเจ้าของร้าน อบอุ่นแต่จน" },
  { id: "moon", name: "กิลด์เงาจันทร์", minRank: 2, pay: 1.8, cp: 2, safety: -0.05, desc: "จ่ายดีมาก แต่ข่าวลือเรื่องงานใต้ดินไม่เคยหายไป" },
  { id: "tiger", name: "กิลด์พยัคฆ์ขาว", minRank: 3, pay: 1.5, cp: 3, safety: 0.06, desc: "กิลด์ใหญ่อันดับ 3 ของประเทศ ระบบดี" },
  { id: "naga", name: "กิลด์นาคราช", minRank: 4, pay: 2.2, cp: 5, safety: 0.08, desc: "กิลด์อันดับ 2 เชี่ยวชาญ Gate ใต้น้ำ" },
  { id: "lion", name: "กิลด์ราชสีห์ทองคำ", minRank: 5, pay: 3, cp: 7, safety: 0.1, desc: "กิลด์อันดับ 1 ของประเทศ มีแรงก์ S สามคน" },
];

export const guildById = (id?: string) => GUILDS.find((g) => g.id === id);

// ───────────────────────── ประเภท Gate ─────────────────────────

export const GATE_TYPES = [
  { name: "ป่ามืด", desc: "ต้นไม้สูงเสียดฟ้า แสงลอดลงมาไม่ถึงพื้น", monsters: ["หมาป่าเงา", "ก็อบลินหัวหน้าเผ่า", "ทรีแอนต์เน่า"] },
  { name: "ถ้ำน้ำแข็ง", desc: "ลมหายใจกลายเป็นไอขาวทันทีที่ก้าวเข้าไป", monsters: ["หมีน้ำแข็ง", "เอลฟ์น้ำแข็ง", "ไวเวิร์นหิมะ"] },
  { name: "สุสานโบราณ", desc: "โครงกระดูกเรียงรายอยู่สองข้างทาง บางตัวขยับได้", monsters: ["อัศวินโครงกระดูก", "ลิชผู้หลับใหล", "ราชาศพ"] },
  { name: "ปราสาทใต้ดิน", desc: "ทางเดินหินวกวน ได้ยินเสียงโซ่ลากมาจากที่ไหนสักแห่ง", monsters: ["ออร์กผู้คุม", "แวมไพร์ขุนนาง", "อัศวินนรก"] },
  { name: "หนองน้ำพิษ", desc: "หมอกสีเขียวลอยต่ำ กลิ่นเหมือนไข่เน่าผสมเหล็ก", monsters: ["งูยักษ์สามหัว", "ลิซาร์ดแมนนักรบ", "ราชินีแมงมุม"] },
  { name: "เมืองร้าง", desc: "เมืองที่ถูกทิ้งไว้ครึ่งทาง ป้ายร้านยังเป็นภาษาที่ไม่มีใครรู้จัก", monsters: ["การ์กอยล์", "โกเลมหิน", "ปีศาจหน้ากาก"] },
] as const;

// ───────────────────────── การคำนวณ ─────────────────────────

/** ระยะห่างระดับพลังต่อแรงก์ — 1 แรงก์ ≈ 12 แต้ม */
const RANK_STEP = 12;

export function combatPower(life: Life): number {
  const p = life.power;
  if (!p) return 0;
  const cls = classById(p.hunterClass);
  const g = guildById(p.guild);
  return Math.round(
    p.rank * RANK_STEP + p.level * 0.8 + life.stats[cls.key] * 0.15 + p.skills.length * 2 + cls.cp + (g?.cp ?? 0) + p.items.length,
  );
}

export const gatePower = (gateRank: number) => gateRank * RANK_STEP + 10;

export function fightOdds(life: Life, gateRank: number, mod = 0) {
  return clamp(0.5 + (combatPower(life) - gatePower(gateRank)) / 40 + mod, 0.03, 0.97);
}

export function survivalOdds(life: Life, gateRank: number, mod = 0) {
  const p = life.power;
  const cls = p ? classById(p.hunterClass) : undefined;
  const g = guildById(p?.guild);
  return clamp(fightOdds(life, gateRank, mod) + 0.3 + (cls?.survival ?? 0) + (g?.safety ?? 0) + (life.stats.health - 50) / 300, 0.05, 0.99);
}

export const expToNext = (level: number) => 60 + level * 40;

/** ผลตอบแทนพื้นฐานของ Gate แต่ละแรงก์ */
export const GATE_PAY = [30_000, 80_000, 200_000, 600_000, 2_000_000, 8_000_000, 40_000_000, 150_000_000, 500_000_000];

/** เงินเดือนประจำจากสมาคม/กิลด์ ตามแรงก์ */
export const RETAINER = [60_000, 120_000, 300_000, 800_000, 2_000_000, 6_000_000, 20_000_000, 60_000_000, 150_000_000];

// ───────────────────────── พรสวรรค์สายพลัง ─────────────────────────

/** โบนัสแรงก์ตอนตื่นพลัง (นับแม้ยังไม่เปิดช่องลับ เพราะพลังมาจากตัวพรสวรรค์เอง) */
const RANK_BONUS: Record<string, number> = { mana_heart: 1, dragon_blood: 2, cursed_body: 3 };
export const POWER_TALENTS = ["mana_heart", "late_bloomer", "dragon_blood", "cursed_body", "system_user"];

export const owns = (life: Life, id: string) => life.talents.some((t) => t.id === id);
const ownsActive = (life: Life, id: string) => life.talents.some((t) => t.id === id && t.revealed);

/** สุ่มผลการตื่นพลัง: -1 = ไม่ตื่น */
export function rollAwakening(life: Life, bonus: number): number {
  const hasPowerTalent = POWER_TALENTS.some((id) => owns(life, id));
  const talentBonus = Object.entries(RANK_BONUS).reduce((s, [id, b]) => s + (owns(life, id) ? b : 0), 0);
  // ผู้ใช้ระบบ / ผู้ตื่นช้า เริ่มจาก F เสมอ (บวกโบนัสจากพรสวรรค์อื่นถ้ามี) — แล้วค่อยโต
  if (owns(life, "system_user") || owns(life, "late_bloomer")) return talentBonus;
  const outcomes = [-1, 0, 1, 2, 3, 4, 5, 6, 7];
  const base = [35, 22, 19, 14, 10, 6, 3.5, 1.2, 0.3];
  const luck = 1 + (life.stats.luck - 50) / 80;
  const r = weightedPick(life, outcomes, (o) => {
    const w = base[o + 1];
    if (o === -1) return hasPowerTalent ? 0 : w;
    return o >= 2 ? w * Math.max(0.3, luck) : w;
  })!;
  if (r < 0) return -1;
  return clamp(r + bonus + talentBonus, 0, MAX_RANK - 1); // SSS ได้จากการเติบโตเท่านั้น
}

/** เสนอสายอาชีพ 2–3 สายตามสเตตัสเด่น */
export function offerClasses(life: Life): HunterClass[] {
  const byKey: Record<StatKey, HunterClass[]> = {
    health: ["sword", "tank"],
    smarts: ["mage", "healer"],
    luck: ["assassin"],
    looks: ["healer", "assassin"],
    happiness: ["healer"],
  };
  const keys = (["health", "smarts", "luck", "looks"] as StatKey[]).sort((a, b) => life.stats[b] - life.stats[a]);
  const offer = new Set<HunterClass>();
  offer.add(pick(life, byKey[keys[0]]));
  for (const c of byKey[keys[1]]) if (offer.size < 2 && !offer.has(c)) offer.add(c);
  if (offer.size < 2) offer.add("sword");
  if (life.stats.luck >= 70 || owns(life, "system_user") || chance(life, 0.05)) offer.add("summoner");
  return [...offer];
}

export function awaken(life: Life, rank: number, cls: HunterClass) {
  const info = classById(cls);
  life.power = {
    rank,
    hunterClass: cls,
    level: 1,
    exp: 0,
    skills: [info.skills[0][1]],
    gates: 0,
    bossKills: 0,
    awakenedAt: life.age,
    items: [],
  };
  life.flags.awakenDone = true;
  addFame(life, rank >= 5 ? 25 : rank >= 3 ? 8 : 1);
  addStat(life, "happiness", rank >= 3 ? 20 : 8);
}

export function rankUp(life: Life, reason: string) {
  const p = life.power;
  if (!p || p.rank >= MAX_RANK) return;
  p.rank++;
  addFame(life, p.rank >= 6 ? 15 : 5);
  log(life, `${reason} — แรงก์เพิ่มขึ้นเป็น 【${rankName(p.rank)}】`, "system");
}

function levelUp(life: Life) {
  const p = life.power!;
  p.level++;
  const cls = classById(p.hunterClass);
  if (chance(life, 0.6)) addStat(life, cls.key, 1);
  for (const [lv, skill] of cls.skills) {
    if (lv === p.level && !p.skills.includes(skill)) {
      p.skills.push(skill);
      log(life, `สกิลใหม่ปลดล็อก: 「${skill}」`, "system");
    }
  }
  if (ownsActive(life, "system_user") && p.level % 10 === 0) {
    rankUp(life, "[ระบบ] ครบเงื่อนไขการเลื่อนขั้น");
  } else if (ownsActive(life, "late_bloomer") && p.level % 10 === 0 && p.rank < 6) {
    rankUp(life, "พลังที่หลับใหลตื่นขึ้นอีกขั้น");
  } else if (p.level % 15 === 0 && p.rank < 6 && chance(life, 0.12)) {
    rankUp(life, "คุณทะลวงขีดจำกัดของตัวเอง");
  }
}

export function gainExp(life: Life, amount: number) {
  const p = life.power;
  if (!p) return;
  p.exp += Math.round(amount);
  const before = p.level;
  while (p.exp >= expToNext(p.level)) {
    p.exp -= expToNext(p.level);
    levelUp(life);
  }
  if (p.level > before) log(life, `เลเวลอัป! Lv.${before} → Lv.${p.level}`, "system");
}

/** แจกรางวัลจาก Gate และคืนข้อความสรุป */
export function gateRewards(life: Life, gateRank: number, mult: number, boss: boolean): string {
  const p = life.power!;
  const g = guildById(p.guild);
  // กิลด์หักส่วนแบ่ง แต่ได้ภารกิจที่จ่ายดีกว่า
  const money = Math.round((GATE_PAY[gateRank] * mult * (0.6 + nextFloat(life) * 0.8) * (g ? g.pay * 0.8 : 1)) / 1000) * 1000;
  const exp = Math.pow(gateRank + 1, 1.5) * 60 * mult * (boss ? 1.5 : 1);
  addMoney(life, money);
  p.gates++;
  if (boss) p.bossKills++;
  if (life.job?.careerId === "hunter") life.job.performance = clamp(life.job.performance + (boss ? 8 : 4), 0, 100);
  gainExp(life, exp);
  return `ได้ค่าตอบแทน ${formatMoney(money)} และ EXP ${Math.round(exp)}`;
}
