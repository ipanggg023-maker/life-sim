import { nextFloat, pick } from "./rng";
import { worldOf } from "../content/worlds";
import { countryMoney, countryOf, localize } from "../content/countries";
import { passiveCheck } from "../content/passives";
import type { Country, Gender, Life, LogKind, Person, Relation, StatKey, WorldId } from "./types";

/** ประเทศที่มีผลกับชีวิตนี้ (โลกแฟนตาซีไม่มีประเทศ) */
export const countryIn = (l: { worldId?: WorldId; country?: Country }): Country | undefined =>
  worldOf(l.worldId).modern ? (l.country ?? "th") : undefined;

/** แปลงคำเฉพาะถิ่นตามประเทศของชีวิตนี้ */
export const loc = (l: { worldId?: WorldId; country?: Country }, text: string) => localize(text, countryIn(l));

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function addStat(life: Life, key: StatKey, delta: number) {
  life.stats[key] = clamp(Math.round(life.stats[key] + delta), 0, 100);
}

export function addMoney(life: Life, delta: number) {
  life.money = Math.round(life.money + delta);
}

export function addFame(life: Life, delta: number) {
  life.fame = clamp(Math.round(life.fame + delta), -100, 100);
}

export function log(life: Life, text: string, kind: LogKind = "normal") {
  life.log.push({ age: life.age, text: loc(life, text), kind });
}

export function uid(life: Life): string {
  return Math.floor(nextFloat(life) * 1e9).toString(36);
}

/** ชื่อเต็มตามธรรมเนียมของโลก (ยุทธภพ: แซ่ขึ้นก่อน ไม่เว้นวรรค) */
export function displayName(life: Pick<Life, "firstName" | "lastName" | "worldId" | "country">) {
  if (life.worldId === "murim") return `${life.lastName}${life.firstName}`;
  const c = countryIn(life);
  return c && countryOf(c).familyFirst ? `${life.lastName} ${life.firstName}` : `${life.firstName} ${life.lastName}`;
}

/** แสดงจำนวนเงินด้วยสกุลเงินของโลกนั้น */
export function money(life: Pick<Life, "worldId" | "country">, n: number) {
  const c = countryIn(life);
  return c ? countryMoney(c, n) : worldOf(life.worldId).currency(n);
}

export function hasTalent(life: Life, id: string) {
  return life.talents.some((t) => t.id === id && t.revealed);
}

export function people(life: Life, relation: Relation, aliveOnly = true): Person[] {
  return life.people.filter((p) => p.relation === relation && (!aliveOnly || p.alive));
}

export function firstPerson(life: Life, relation: Relation): Person | undefined {
  return people(life, relation)[0];
}

export function randomName(life: Life, gender: Gender) {
  const c = countryIn(life);
  if (c && c !== "th") {
    const k = countryOf(c).names;
    const first = pick(life, gender === "m" ? k.male : k.female);
    return { first, nick: first, last: pick(life, k.last) };
  }
  const n = worldOf(life.worldId).names;
  return {
    first: pick(life, gender === "m" ? n.male : n.female),
    nick: pick(life, gender === "m" ? n.nickM : n.nickF),
    last: pick(life, n.last),
  };
}

export function createPerson(
  life: Life,
  relation: Relation,
  opts: { gender?: Gender; age: number; bond?: number; lastName?: string; job?: string },
): Person {
  const gender = opts.gender ?? (nextFloat(life) < 0.5 ? "m" : "f");
  const n = randomName(life, gender);
  const c = countryIn(life);
  const familyFirst = !!c && countryOf(c).familyFirst;
  const person: Person = {
    id: uid(life),
    // ยุทธภพเรียกชื่อเต็มแบบแซ่นำหน้า (shortName จะได้ชื่อเต็ม ซึ่งเข้ากับสำนวนนิยายจีน)
    name:
      life.worldId === "murim"
        ? `${opts.lastName ?? n.last}${n.first}`
        : familyFirst
          ? `${opts.lastName ?? n.last} ${n.first}` // เกาหลี/ญี่ปุ่น: นามสกุลขึ้นก่อน เรียกด้วยชื่อตัว
          : life.worldId === "court"
          ? `${n.first} ${opts.lastName ?? n.last}` // ราชสำนักเรียกด้วยชื่อตัว (shortName = ชื่อตัว)
          : `${n.first} (${n.nick}) ${opts.lastName ?? n.last}`,
    gender,
    relation,
    age: opts.age,
    bond: opts.bond ?? 50,
    alive: true,
    job: opts.job,
    ...(familyFirst ? { short: n.first } : {}),
  };
  life.people.push(person);
  return person;
}

/** ชื่อสั้นสำหรับใช้ในประโยค: ชื่อเล่น */
export function shortName(p: Person) {
  if (p.short) return p.short;
  const m = p.name.match(/\((.+?)\)/);
  return m ? m[1] : p.name.split(" ")[0];
}

export function relationLabel(p: Person): string {
  switch (p.relation) {
    case "father":
      return "พ่อ";
    case "mother":
      return "แม่";
    case "sibling":
      return p.gender === "m" ? "พี่น้องชาย" : "พี่น้องหญิง";
    case "friend":
      return "เพื่อน";
    case "partner":
      return "แฟน";
    case "spouse":
      return p.gender === "m" ? "สามี" : "ภรรยา";
    case "child":
      return p.gender === "m" ? "ลูกชาย" : "ลูกสาว";
    case "ally":
      return "เพื่อนร่วมทีม";
    case "rival":
      return "คู่ปรับ";
  }
}

/**
 * โอกาสผ่านการเช็กสเตตัส (0.05–0.95)
 * dc คือค่าสเตตัสที่ถือว่า 50/50 · โชคมีผลเล็กน้อยกับทุกการเช็ก
 */
export function checkChance(life: Life, stat: StatKey, dc: number, bonus = 0): number {
  const base = 0.5 + (life.stats[stat] - dc) / 60 + (life.stats.luck - 50) / 400 + bonus + passiveCheck(life, stat);
  return clamp(base, 0.05, 0.95);
}

export function formatMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}฿${Math.abs(n).toLocaleString("th-TH")}`;
}
