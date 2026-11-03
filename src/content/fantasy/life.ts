// เกิด จบชีวิต เล่นต่อ และย้อนชะตา
import { pick, randInt, weightedPick } from "../../engine/rng";
import type { Life, Soul } from "../../engine/types";
import { addStat, displayName, log } from "../../engine/util";
import { addLegend, recordChronicle } from "../../engine/worldState";
import { fl, kingdomsOf, worldOfLife, type FLife, type RaceId } from "./state";
import { release } from "./dragons";
import { inheritThrone, passThrone } from "./realm";
import { rollElement } from "./magic";
import { applyFtTalents } from "./talents";
import { fastForward } from "./world";

export const RACES: Record<RaceId, { name: string; younger: number; desc: string }> = {
  human: { name: "มนุษย์", younger: 0, desc: "ชีวิตสั้นแต่ไปได้ทุกทาง" },
  elf: { name: "เอลฟ์", younger: 250, desc: "มีอายุเป็นร้อยปี เห็นคนที่รักแก่ไปก่อน" },
  dwarf: { name: "คนแคระ", younger: 70, desc: "ทนทาน สืบตระกูลใต้ภูเขา · อักษรรูนแรงเป็นสองเท่า" },
  orc: { name: "ออร์ก", younger: -8, desc: "ฝึกกายได้เร็วและตีหนัก แต่ทุกแผ่นดินมองด้วยความระแวง" },
  beastfolk: { name: "ชนเผ่าสัตว์", younger: -4, desc: "ประสาทสัมผัสคม ตามรอยเก่ง และเข้ากับสัตว์ได้ดี" },
  halfling: { name: "ฮาล์ฟลิง", younger: 25, desc: "โชคดี เงียบ และมักถูกมองข้าม ซึ่งบางทีก็เป็นข้อดี" },
  dragon: { name: "มังกรในร่างมนุษย์", younger: 400, desc: "เผ่าหายาก · เกิดมาอ่อนแอแต่แกร่งขึ้นตามอายุ ร่ายเวทได้เอง มังกรทุกตัวนับเป็นญาติ แต่คนกลัว" },
  demon: { name: "ทายาทปีศาจ", younger: 200, desc: "เผ่าหายาก · เวทมืดติดตัว พรสวรรค์เวทสูง แต่ทุกแผ่นดินระแวงและศาสนจักรตามล่า" },
};
/** เผ่าที่เลือกเองตอนเกิดไม่ได้ ต้องเกิดมาเป็นเท่านั้น */
export const RARE_RACES: RaceId[] = ["dragon", "demon"];
const RACE_IDS = Object.keys(RACES) as RaceId[];
export const STRANGER_GAP: [number, number] = [20, 60];
export const TURNING_POINTS = [6, 12, 16, 20, 30, 45, 60, 80, 120, 200, 300];
export const MERCY_AGE = 30;
const SCARS = ["มีเงาตัวเองขยับช้ากว่าร่างครึ่งก้าว", "แมวทุกตัวขู่ใส่คุณ", "ฝันถึงวันตายของตัวเองทุกปีใหม่", "ผมขาวขึ้นหนึ่งปอย", "นาฬิกาแดดหยุดเมื่อคุณเดินผ่าน"];

function rollFlife(l: Life, race: RaceId): FLife {
  const potential = weightedPick(l, [0, 1, 2, 3, 4, 5], (p) => [34, 26, 20, 12, 6, 2][p])!;
  return { race, kingdom: pick(l, kingdomsOf(l)).id, potential, body: 0, magic: 0, bodyRank: 0, magicRank: 0, guild: 0, contracts: 0, fRank: 0, clues: {}, dragonBond: 0, deeds: [], scars: [], threads: l.talents.some((t) => t.id === "ft_fate_thread") ? 2 : 0 };
}

/** สร้างข้อมูลตอนเกิด · ยังไม่รู้จักวิญญาณ จะผูกกับโลกจริงใน attachWorld */
export function setupLife(l: Life) {
  worldOfLife(l);
  const race = weightedPick(l, RACE_IDS, (r) => ({ human: 55, elf: 12, dwarf: 12, orc: 8, beastfolk: 8, halfling: 5, dragon: 0.6, demon: 1.2 })[r])!;
  applyRaceStats(l, race, 1);
  l.ft = { ...rollFlife(l, race), element: rollElement(l) };
  l.flags.ftBornRace = race;
  if (race === "demon") { l.ft.element = "dark"; l.ft.potential = Math.min(5, l.ft.potential + 1); }
  l.flags.allowance = true;
  l.flags.seenRuler = "";
  applyFtTalents(l);
}
function applyRaceStats(l: Life, r: RaceId, sign: number) {
  if (r === "elf") { addStat(l, "smarts", 6 * sign); addStat(l, "looks", 6 * sign); addStat(l, "health", -4 * sign); }
  if (r === "dwarf") { addStat(l, "health", 8 * sign); addStat(l, "looks", -4 * sign); }
  if (r === "orc") { addStat(l, "health", 10 * sign); addStat(l, "smarts", -4 * sign); addStat(l, "looks", -4 * sign); }
  if (r === "beastfolk") { addStat(l, "luck", 6 * sign); addStat(l, "health", 4 * sign); addStat(l, "smarts", -2 * sign); }
  if (r === "halfling") { addStat(l, "luck", 8 * sign); addStat(l, "looks", 2 * sign); addStat(l, "health", -4 * sign); }
  if (r === "dragon") { addStat(l, "health", 6 * sign); addStat(l, "smarts", 4 * sign); addStat(l, "happiness", -6 * sign); }
  if (r === "demon") { addStat(l, "smarts", 6 * sign); addStat(l, "looks", 4 * sign); addStat(l, "happiness", -8 * sign); }
}
/** ปรับแต่งตอนเกิด: เปลี่ยนเผ่าได้ก่อนเริ่มชีวิต */
export function setRace(l: Life, r: RaceId) {
  applyRaceStats(l, fl(l).race, -1);
  applyRaceStats(l, r, 1);
  fl(l).race = r;
}

/** ผูกตัวละครใหม่เข้ากับโลกที่อยู่ต่อจากชีวิตก่อน */
export function attachWorld(l: Life, s: Soul) {
  if (!s.fantasyWorld) return;
  const w = structuredClone(s.fantasyWorld);
  fastForward(w, randInt(l, STRANGER_GAP[0], STRANGER_GAP[1]), l);
  l.fw = w;
  l.birthYear = w.year;
  l.flags.seenRuler = "";
  if (!kingdomsOf(l).some((k) => k.id === fl(l).kingdom)) fl(l).kingdom = kingdomsOf(l)[0].id;
}

/** ก่อนเล่นต่อ: โลกจดจำคนที่จากไป แล้วบันทึกไว้กับวิญญาณ */
export function closeLife(s: Soul, l: Life) {
  const w = worldOfLife(l), f = fl(l);
  w.year = l.birthYear + l.age;
  recordChronicle(w, `${displayName(l)}จากโลกไปเมื่ออายุ ${l.age} ปี`);
  for (const r of (w.data as { relics: { holder: string; id: string; at: string }[] }).relics) if (r.holder === "player") { r.holder = "lost"; r.at = f.kingdom; }
  for (const x of (w.data as { factions?: { playerLed?: boolean; leader: string }[] }).factions ?? []) if (x.playerLed) { x.playerLed = false; x.leader = ""; }
  passThrone(l);
  if (f.whelp) { release(w, l, f.whelp, "บินกลับขุนเขาหลังเจ้าของจากไป"); f.whelp = undefined; }
  const top = f.deeds.at(-1);
  // ชีวิตที่มีตำนานบันทึกไว้แล้ว ไม่ต้องสรุปซ้ำตอนจากไป
  if (top && (l.fame >= 30 || f.deeds.length >= 2) && !w.legends.some((g) => g.lifeId === l.id)) addLegend(w, { name: displayName(l), deed: top, lifeId: l.id });
  s.fantasyWorld = w;
}

/** ลูกรับเผ่า อาณาจักร และความแค้นของบ้าน · ฝีมือต้องฝึกเอง */
export function inheritLife(dead: Life, next: Life) {
  const d = fl(dead);
  next.fw = dead.fw;
  next.ft = { ...rollFlife(next, d.race), element: d.element, kingdom: d.kingdom, egg: d.egg ? { ...d.egg, lastCare: 0 } : undefined, standing: Object.fromEntries(Object.entries(d.standing ?? {}).map(([k, v]) => [k, Math.trunc(v / 2)])), potential: Math.max(0, d.potential + randInt(next, -1, 1)) };
  if (next.ft.potential > 5) next.ft.potential = 5;
  next.flags.seenRuler = "";
  next.flags.allowance = true;
  inheritThrone(dead, next);
  applyFtTalents(next);
}

/** ย้อนชะตาได้ไหม · เด็กตายเร็วได้โอกาสหนึ่งครั้ง พรสวรรค์หายากให้เพิ่ม */
export const canMercy = (l: Life) => l.age < MERCY_AGE && !fl(l).mercyUsed;
/** ขึ้นเป็นเทพคือการเลือกจากไปเอง ย้อนกลับไม่ได้ */
export const canRewind = (l: Life) => l.age > 0 && !l.causeOfDeath?.startsWith("ขึ้นสู่สวรรค์") && (canMercy(l) || fl(l).threads > 0);
export const rewindTarget = (l: Life) => [...TURNING_POINTS].reverse().find((a) => a < l.age) ?? 0;

/** กลับไปที่ snapshot พร้อมโลกทั้งใบ · เหลือแต่ความจำกับแผลแห่งชะตา */
export function applyRewind(dead: Life, snap: Life): Life {
  const usedMercy = canMercy(dead);
  const scar = pick(dead, SCARS);
  const next: Life = { ...structuredClone(snap), log: dead.log.filter((e) => e.age <= snap.age), queue: [], alive: true };
  delete next.causeOfDeath;
  const f = fl(next);
  f.mercyUsed = fl(dead).mercyUsed || usedMercy;
  f.threads = usedMercy ? fl(dead).threads : fl(dead).threads - 1;
  f.scars = [...fl(dead).scars, scar];
  log(next, `คุณตายตอนอายุ ${dead.age} แล้วลืมตาขึ้นตอนอายุ ${snap.age} ชะตาทิ้งแผลไว้: ${scar}`, "milestone");
  addStat(next, "happiness", -3);
  return next;
}
