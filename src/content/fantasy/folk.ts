// ผู้คนแต่ละเผ่าในโลกแฟนตาซี: ใครเกิดเป็นเผ่าไหน ชื่อตามเผ่า และอายุยืนตามเผ่าของตัวเอง
import { randInt, weightedPick } from "../../engine/rng";
import type { Gender, Life, Person, Relation } from "../../engine/types";
import { nameHooks } from "../../engine/util";
import { nameFor, raceOfLast, type NameRace } from "./names";
import type { RaceId } from "./state";

/** ประชากรของแต่ละแผ่นดิน · แผ่นดินใหม่ใช้ค่ากลาง */
const FOLK: Record<string, Partial<Record<RaceId, number>>> = {
  aldria: { human: 60, elf: 10, dwarf: 15, orc: 3, beastfolk: 6, halfling: 6 },
  varn: { human: 60, orc: 15, dwarf: 8, beastfolk: 10, elf: 3, halfling: 4 },
  thalos: { human: 50, halfling: 18, elf: 15, dwarf: 8, beastfolk: 6, orc: 3 },
};
const BASE: Partial<Record<RaceId, number>> = { human: 58, elf: 9, dwarf: 11, orc: 7, beastfolk: 8, halfling: 7 };
const FAMILY: Relation[] = ["father", "mother", "sibling"];
const COMMON: RaceId[] = ["human", "elf", "dwarf", "orc", "beastfolk", "halfling"];

/** อายุที่เผ่านี้แก่ช้ากว่ามนุษย์ (ปี) */
export const RACE_YOUNGER: Record<RaceId, number> = { human: 0, elf: 250, dwarf: 70, orc: -8, beastfolk: -4, halfling: 25, dragon: 400, demon: 200 };
export const RACE_LABEL: Record<RaceId, string> = { human: "มนุษย์", elf: "เอลฟ์", dwarf: "คนแคระ", orc: "ออร์ก", beastfolk: "ชนเผ่าสัตว์", halfling: "ฮาล์ฟลิง", dragon: "มังกรในร่างมนุษย์", demon: "ทายาทปีศาจ" };

export const raceOf = (p: Pick<Person, "tags">): RaceId | undefined => p.tags?.find((t) => t.startsWith("race:"))?.slice(5) as RaceId | undefined;
export function setPersonRace(p: Person, r: RaceId) {
  p.tags = [...(p.tags ?? []).filter((t) => !t.startsWith("race:")), `race:${r}`];
}

/** คนที่ไม่ใช่ญาติ: สุ่มตามประชากรของแผ่นดินนั้น และคนเผ่าเดียวกันมักคบกัน */
export function folkRace(l: Life): RaceId {
  const own = l.ft?.race;
  const w = (l.ft && FOLK[l.ft.kingdom]) ?? BASE;
  return weightedPick(l, COMMON, (r) => (w[r] ?? 2) * (r === own ? 2.2 : 1))!;
}

/** ลูกได้เผ่าของพ่อหรือแม่ */
function childRace(l: Life): RaceId {
  const own = l.ft!.race;
  const mate = l.people.find((p) => p.alive && (p.relation === "spouse" || p.relation === "partner"));
  const other = mate && raceOf(mate);
  return other && other !== own && randInt(l, 0, 1) === 1 ? other : own;
}

function raceFor(l: Life, relation?: Relation): RaceId {
  if (!l.ft) return "human";
  if (relation && FAMILY.includes(relation)) return l.ft.race;
  if (relation === "child") return childRace(l);
  return folkRace(l);
}

/** ชื่อใหม่ตามเผ่า · ญาติใช้นามสกุลของบ้าน (createPerson ส่ง lastName มาเอง) */
export function fantasyName(l: Life, gender: Gender, relation?: Relation) {
  const race = raceFor(l, relation);
  return { ...nameFor(l, race as NameRace, gender), tags: [`race:${race}`] };
}

/** ตอนเกิดเผ่าเพิ่งถูกสุ่ม: ตั้งชื่อตัวละครและครอบครัวใหม่ให้เข้ากับเผ่า */
export function renameFamily(l: Life, race: RaceId) {
  const own = nameFor(l, race as NameRace, l.gender);
  const keepLast = !!l.flags.descendant || raceOfLast(l.lastName) === race;
  l.firstName = own.first;
  l.nickname = own.first;
  if (!keepLast) l.lastName = own.last;
  for (const p of l.people) {
    if (!FAMILY.includes(p.relation)) continue;
    const n = nameFor(l, race as NameRace, p.gender);
    p.name = `${n.first} ${l.lastName}`;
    setPersonRace(p, race);
    // เผ่าอายุยืนมีพ่อแม่ที่อายุมากกว่ามนุษย์
    if (p.relation !== "sibling" && RACE_YOUNGER[race] > 50) p.age += randInt(l, 0, Math.round(RACE_YOUNGER[race] / 3));
  }
}

/** ทายาทได้ชื่อตามเผ่าของบ้าน */
export function renameHeir(l: Life, race: RaceId) {
  const n = nameFor(l, race as NameRace, l.gender);
  l.firstName = n.first;
  l.nickname = n.first;
}

export function loadFolk() {
  nameHooks.fantasy = fantasyName;
}
