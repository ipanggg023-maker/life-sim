// การเกิด: ลางในวันเกิด · คำใบ้ของดาว · ครอบครัวแบบต่างๆ · ฝาแฝดและพี่ที่กำหนดชีวิต · ลูกครึ่งสองเผ่า · เผ่าหายากที่วิญญาณปลดได้
// ทุกอย่างยังสุ่มทั้งหมดตามที่ตกลงไว้ · แผนอยู่ที่ design/GRILL.md ส่วนที่ 1 และ design/WHOLE_GAME_SPEC.md (Release 3)
import type { GameEvent } from "../../engine/events";
import { birthHooks, yearHooks } from "../../engine/game";
import { remember } from "../../engine/npc";
import { chance, pick, randInt, weightedPick } from "../../engine/rng";
import type { Life, Person, Soul } from "../../engine/types";
import { addStat, clamp, createPerson, log, people, relationLabel, shortName } from "../../engine/util";
import { B, BIG, C, E, G, N, P } from "./kit";
import { addStanding, deed, fl, homeKingdom, type RaceId } from "./state";
import { RACES, applyRaceStats } from "./life";
import { setPersonRace } from "./folk";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;

// ───────────── ลางในวันเกิด ─────────────
export type OmenId = "war" | "comet" | "dragonflight" | "plague" | "eclipse" | "harvest";
export const OMENS: Record<OmenId, { name: string; birth: string; apply: (l: Life) => void }> = {
  war: { name: "เกิดกลางสงคราม", birth: "คุณเกิดคืนที่ทหารเดินผ่านหน้าบ้านทั้งคืน แม่บอกว่าคุณไม่ร้องเลยแม้แต่ครั้งเดียว", apply: (l) => { fl(l).body += 10; addStat(l, "happiness", -3); } },
  comet: { name: "เกิดใต้ดาวหาง", birth: "ดาวหางหางยาวพาดฟ้าในคืนที่คุณเกิด คนทั้งหมู่บ้านออกมายืนดู และบางคนก็กระซิบว่าเด็กคนนี้ไม่ธรรมดา", apply: (l) => { fl(l).magic += 10; addStat(l, "luck", 4); addStanding(l, 2); } },
  dragonflight: { name: "เกิดคืนมังกรบินผ่าน", birth: "เงาปีกมังกรพาดผ่านหลังคาบ้านตอนคุณลืมตาครั้งแรก หมอตำแยบอกว่ามันหันมามองหน้าต่างห้องนี้", apply: (l) => { fl(l).dragonBond += 8; } },
  plague: { name: "เกิดในปีโรคระบาด", birth: "คุณเกิดในปีที่โรคระบาดพาคนไปครึ่งหมู่บ้าน ร่างเล็กๆ ของคุณรอดมาได้ทั้งที่ไม่มีใครคิดว่าจะรอด", apply: (l) => { addStat(l, "health", -6); fl(l).lifeBonus = (fl(l).lifeBonus ?? 0) + 3; } },
  eclipse: { name: "เกิดตอนสุริยุปราคา", birth: "ฟ้ามืดลงกลางวันตอนคุณเกิด นักบวชประจำหมู่บ้านทำสัญลักษณ์กันปีศาจที่หน้าผากคุณ", apply: (l) => { addStat(l, "smarts", 3); addStat(l, "happiness", -2); addStanding(l, -2); } },
  harvest: { name: "เกิดในปีข้าวงาม", birth: "ปีที่คุณเกิดเป็นปีที่ข้าวงามที่สุดในรอบสิบปี ทุกบ้านนำขนมมาเยี่ยม", apply: (l) => { addStat(l, "happiness", 5); l.money += 5 * 100; } },
};
const OMEN_IDS = Object.keys(OMENS) as OmenId[];
export const omenOfBirth = (l: Life) => l.flags.ftOmen as OmenId | undefined;
function rollOmen(l: Life): OmenId | undefined {
  const k = homeKingdom(l);
  if (k.war && chance(l, 0.5)) return "war";
  if (k.plague && chance(l, 0.5)) return "plague";
  const x = weightedPick(l, [...OMEN_IDS, "none"] as const, (x) => ({ war: 4, comet: 4, dragonflight: 3, plague: 3, eclipse: 3, harvest: 6, none: 77 })[x]);
  return x === "none" ? undefined : x;
}

// ───────────── คำใบ้ของดาวตอนเกิด ─────────────
export function starHint(l: Life): string {
  const f = fl(l), b = f.bstars ?? 0, m = f.potential;
  if (b >= 7 && m >= 7) return "หมอตำแยวางคุณลงแล้วถอยหลังหนึ่งก้าว มือเล็กๆ ของคุณกำนิ้วเธอแน่นจนเจ็บ และเทียนในห้องก็สว่างขึ้นพร้อมกัน";
  if (b >= 7) return "หมอตำแยบอกว่าไม่เคยเห็นทารกคนไหนกำมือแน่นขนาดนี้";
  if (m >= 7) return "เทียนทุกเล่มในห้องสว่างขึ้นตอนคุณร้องไห้ครั้งแรก";
  if (b >= 4 || m >= 4) return "หมอตำแยยิ้มแล้วบอกว่าเด็กคนนี้ตาไว และน่าจะโตมาแข็งแรง";
  return "คุณเป็นทารกธรรมดาที่ร้องเสียงดังที่สุดในหมู่บ้าน และนั่นก็มากพอสำหรับพ่อแม่";
}

// ───────────── ครอบครัวแบบต่างๆ ─────────────
export type FamilyType = "orphan" | "adopted" | "noble" | "outcast";
export const FAMILY_TYPES: Record<FamilyType, { name: string }> = {
  orphan: { name: "เด็กกำพร้าที่มีคนเก็บมาเลี้ยง" },
  adopted: { name: "ถูกเลี้ยงดูโดยคนต่างเผ่า" },
  noble: { name: "สายเลือดขุนนาง" },
  outcast: { name: "ครอบครัวที่ถูกขับไล่" },
};
export const familyTypeOf = (l: Life) => l.flags.ftFamily as FamilyType | undefined;
const parents = (l: Life) => l.people.filter((p) => p.relation === "father" || p.relation === "mother");
/** ย้ายพ่อแม่และพี่น้องแท้ๆ ออกจากรายชื่อคนที่รู้จัก เด็กที่ถูกทิ้งไม่รู้ว่าพวกเขาเป็นใคร */
export function hideKin(l: Life) {
  const kin = l.people.filter((p) => (p.relation === "father" || p.relation === "mother" || p.relation === "sibling") && !p.tags?.includes("guardian"));
  if (!kin.length) return;
  l.people = l.people.filter((p) => !kin.includes(p));
  fl(l).lostKin = [...(fl(l).lostKin ?? []), ...kin.map((p) => ({ ...p, tags: (p.tags ?? []).filter((t) => !t.startsWith("away:") && t !== "lost_parent") }))];
}
/** พ่อแม่แท้ๆ กลับมาพบ: เพิ่มเข้ารายชื่อด้วยอายุตามเวลาที่ผ่านไป · พี่น้องตามมาด้วย */
function restoreKin(l: Life, bond: number) {
  const lost = fl(l).lostKin ?? [];
  fl(l).lostKin = undefined;
  for (const p of lost) {
    l.people.push({ ...p, age: p.age + l.age, bond: p.relation === "sibling" ? Math.round(bond / 2) : bond, met: l.age, tags: [...(p.tags ?? []), ...(p.relation === "sibling" ? [] : ["birth_parent"])] });
  }
}
const lostParents = (l: Life) => (fl(l).lostKin ?? []).filter((p) => p.alive && (p.relation === "father" || p.relation === "mother"));
const COMMON: RaceId[] = ["human", "elf", "dwarf", "orc", "beastfolk", "halfling"];

function setFamily(l: Life, t: FamilyType) {
  l.flags.ftFamily = t;
  const ps = parents(l);
  if (t === "orphan") {
    // พ่อแม่และพี่น้องแท้ๆ ยังอยู่ที่ไหนสักแห่ง แต่เด็กที่ถูกทิ้งไม่รู้ว่าเป็นใคร · รู้แค่ว่าใครรับมาเลี้ยง
    hideKin(l);
    const job = pick(l, ["นักบวชประจำวิหาร", "แม่ครัวของกิลด์", "ช่างตีเหล็กหัวใจดี"]);
    const g = createPerson(l, job === "ช่างตีเหล็กหัวใจดี" ? "father" : chance(l, 0.5) ? "mother" : "father", { age: randInt(l, 35, 60), bond: 75, job });
    g.tags = [...(g.tags ?? []), "guardian"];
    // บรรทัดแนะนำพ่อแม่ตอนเกิดเปลี่ยนเป็นคนที่รับเลี้ยง
    const intro = [...l.log].reverse().find((e) => e.text.startsWith("พ่อของคุณคือ"));
    if (intro) intro.text = `${relationLabel(g, l)}ของคุณคือ${shortName(g)} (${g.job}) อายุ ${g.age} ปี`;
    l.wealth = "poor";
    log(l, `คุณถูกพบในตะกร้าหน้าประตูวิหาร ${shortName(g)}${g.job ? ` (${g.job})` : ""}รับคุณไปเลี้ยง ไม่มีใครรู้ว่าพ่อแม่จริงของคุณเป็นใคร`, "milestone");
  } else if (t === "adopted") {
    const other = pick(l, COMMON.filter((r) => r !== fl(l).race));
    l.flags.ftRaisedBy = other;
    for (const p of ps) setPersonRace(p, other);
    if (other === "elf") addStat(l, "smarts", 3);
    if (other === "dwarf") addStat(l, "health", 3);
    if (other === "orc") fl(l).body += 10;
    if (other === "halfling") addStat(l, "happiness", 3);
    if (other === "beastfolk") addStat(l, "luck", 3);
    log(l, `ครอบครัว${RACES[other].name}เป็นคนเลี้ยงคุณมาตั้งแต่ยังแบเบาะ คุณโตมากับภาษาและธรรมเนียมของพวกเขา ทั้งที่หน้าตาไม่เหมือนใครในบ้านเลย`, "milestone");
  } else if (t === "noble") {
    const known = chance(l, 0.35);
    l.flags.ftNobleBlood = known ? "known" : "hidden";
    if (known) { l.wealth = "elite"; addStanding(l, 10); log(l, `คุณเกิดในตระกูลขุนนางแห่ง${homeKingdom(l).name} คนในเมืองโค้งให้คุณตั้งแต่ยังเดินไม่ได้`, "milestone"); }
  } else {
    l.flags.ftOutcast = true;
    l.wealth = "poor";
    addStanding(l, -8);
    log(l, `ตระกูล${l.lastName}ถูกขับออกจากเมืองหลวงเมื่อรุ่นปู่ ทุกคนที่ได้ยินนามสกุลนี้ยังมองคุณด้วยสายตาแปลกๆ`, "milestone");
  }
}
function rollFamily(l: Life): FamilyType | undefined {
  const x = weightedPick(l, ["orphan", "adopted", "noble", "outcast", "none"] as const, (x) => ({ orphan: 6, adopted: 4, noble: 3, outcast: 4, none: 83 })[x]);
  return x === "none" ? undefined : x;
}

// ───────────── ฝาแฝดและพี่ ─────────────
export type SibRole = "protector" | "rival" | "heir";
export const SIB_ROLE: Record<SibRole, string> = { protector: "พี่ที่คอยปกป้องคุณ", rival: "พี่ที่แข่งกับคุณทุกเรื่อง", heir: "พี่ที่พ่อแม่หมายจะให้สืบกิจการ" };
export const sibRoleOf = (p: Person) => p.tags?.find((t) => t.startsWith("sibrole:"))?.slice(8) as SibRole | undefined;
export const twinOf = (l: Life) => l.people.find((p) => p.relation === "sibling" && p.tags?.includes("twin"));
function familyBonds(l: Life) {
  if (chance(l, TWIN_CHANCE)) {
    const t = createPerson(l, "sibling", { age: 0, bond: 85, lastName: l.lastName });
    t.tags = [...(t.tags ?? []), "twin"];
    log(l, `คุณไม่ได้เกิดมาคนเดียว ${shortName(t)}ลืมตาตามคุณมาในอีกไม่กี่นาที`, "milestone");
  }
  for (const s of people(l, "sibling").filter((p) => p.age > 0)) s.tags = [...(s.tags ?? []), `sibrole:${pick(l, ["protector", "rival", "heir"] as SibRole[])}`];
}
export const TWIN_CHANCE = 0.03;

// ───────────── ลูกครึ่งสองเผ่า ─────────────
export const halfOf = (l: Life) => fl(l).half;
export const raceLabel = (l: Life) => { const f = fl(l); return f.half ? `${RACES[f.race].name}เลือดครึ่ง${RACES[f.half].name}` : RACES[f.race].name; };
/** ลูกครึ่ง: ได้ลักษณะของอีกเผ่าครึ่งหนึ่ง · อายุขัยอยู่กลางระหว่างสองเผ่า */
export function makeHalf(l: Life, other: RaceId) {
  const f = fl(l);
  if (other === f.race || f.half) return;
  f.half = other;
  applyRaceStats(l, other, 0.5);
}
function rollHalf(l: Life) {
  if (!chance(l, HALF_CHANCE)) return;
  const other = pick(l, COMMON.filter((r) => r !== fl(l).race));
  makeHalf(l, other);
  const p = pick(l, parents(l));
  if (p) setPersonRace(p, other);
  log(l, `${p ? `${shortName(p)}เป็น${RACES[other].name}` : `เลือด${RACES[other].name}ไหลอยู่ในตัวคุณ`} คุณจึงเกิดมาเป็นลูกครึ่งสองเผ่า`, "milestone");
}
export const HALF_CHANCE = 0.06;

// ───────────── เผ่าหายากที่วิญญาณปลดได้ ─────────────
export const RARE_UNLOCK: Record<"dragon" | "demon", { name: string; how: string; weight: number }> = {
  dragon: { name: "มังกรในร่างมนุษย์", how: "ผูกพันกับมังกรจนได้ขี่ หรือฟักไข่มังกรได้สำเร็จ", weight: 5 },
  demon: { name: "ทายาทปีศาจ", how: "ทำพันธสัญญากับสิ่งที่อยู่เหนือโลก หรือรอดจากการไล่ล่าของศาสนจักร", weight: 5 },
};
export const unlockedRare = (l: Life) => String(l.flags.ftRare ?? "").split(",").filter(Boolean) as ("dragon" | "demon")[];
/** ชีวิตนี้ปลดเผ่าหายากอะไรให้วิญญาณได้บ้าง */
export function earnedRare(l: Life): ("dragon" | "demon")[] {
  if (!l.ft) return [];
  const f = fl(l), out: ("dragon" | "demon")[] = [];
  if (f.mount || f.whelp || (f.dragonBond ?? 0) >= 60) out.push("dragon");
  if ((f.pacts ?? 0) > 0 || l.flags.ftHuntSurvived) out.push("demon");
  return out;
}
export function recordRare(s: Soul, l: Life) {
  const got = earnedRare(l).filter((r) => !(s.rareRaces ?? []).includes(r));
  if (got.length) s.rareRaces = [...(s.rareRaces ?? []), ...got];
}

// ───────────── ตอนเกิด ─────────────
function birthSetup(l: Life) {
  if (!on(l) || l.flags.ftBirthDone) return;
  l.flags.ftBirthDone = true;
  const o = rollOmen(l);
  if (o) { l.flags.ftOmen = o; OMENS[o].apply(l); log(l, OMENS[o].birth, "milestone"); }
  log(l, starHint(l), "normal");
  const t = rollFamily(l);
  if (t) setFamily(l, t);
  if (t !== "orphan") rollHalf(l);
  familyBonds(l);
}

// ───────────── เรื่องที่ตามมาในชีวิต ─────────────
const omenAt = (id: OmenId) => (l: Life) => on(l) && omenOfBirth(l) === id;
const parentLost = (l: Life) => lostParents(l)[0];
const sibWith = (r: SibRole) => (l: Life) => l.people.find((p) => p.alive && p.relation === "sibling" && sibRoleOf(p) === r);
const nm = (p?: Person) => (p ? shortName(p) : "เขา");
const OMEN_EVENTS: GameEvent[] = [
  E("ft.bt.omen_war", [7, 13], "เด็กในหมู่บ้านเรียกคุณว่าลูกสงคราม เพราะคุณเกิดคืนที่ทหารเดินผ่าน ทหารผ่านศึกขาเดียวคนหนึ่งเรียกคุณไปนั่งข้างๆ", [
    C("ขอให้เขาสอนจับดาบ", G("ทหารแก่สอนวิธีจับดาบที่ไม่มีใครในหมู่บ้านรู้ คุณฝึกกับกิ่งไม้ทุกเย็น", { body: 12 })),
    C("ถามว่าสงครามเป็นอย่างไร", G("เขาเล่าจนพระอาทิตย์ตก ไม่มีตอนไหนเลยที่ฟังดูกล้าหาญ คุณกลับบ้านแล้วกอดแม่แน่นกว่าทุกวัน", { iq: 2, joy: 2 })),
  ], { title: "ลูกสงคราม", weight: 40, when: omenAt("war") }),
  E("ft.bt.omen_comet", [7, 13], "นักดาราศาสตร์จากเมืองหลวงเดินทางมาถามหาเด็กที่เกิดคืนดาวหาง และหยุดที่ประตูบ้านคุณ", [
    P("ยอมให้เขาทดสอบ", (l) => 0.4 + fl(l).potential * 0.05, BIG("ลูกแก้วในมือเขาเรืองแสงเมื่อคุณแตะ เขาจดชื่อคุณลงสมุดเล่มหนา", { magic: 15, fame: 1 }), N("ลูกแก้วไม่เป็นอะไร เขาขอบคุณแล้วเดินไปเคาะประตูบ้านถัดไป")),
    C("ซ่อนตัวใต้เตียง", N("เขารอครึ่งวันแล้วกลับไป แม่บอกว่าคุณจะเสียใจ แต่คุณไม่แน่ใจ")),
  ], { title: "เด็กแห่งดาวหาง", weight: 40, when: omenAt("comet") }),
  E("ft.bt.omen_dragon", [7, 13], "มังกรตัวหนึ่งบินต่ำผ่านหมู่บ้านอีกครั้ง คนแก่บอกว่ามันบินผ่านแบบนี้ครั้งเดียวก่อนหน้า คือคืนที่คุณเกิด", [
    C("วิ่งตามเงาของมันไปที่เนินเขา", G("มันวนกลับมาหนึ่งรอบเหนือหัวคุณ ก่อนจะหายไปในเมฆ คุณรู้สึกว่ามันจำคุณได้", { joy: 6 }, (l) => { fl(l).dragonBond += 10; })),
    C("หลบเข้าบ้านตามที่แม่สั่ง", N("คุณมองผ่านช่องหน้าต่าง และคิดถึงปีกคู่นั้นไปอีกหลายปี")),
  ], { title: "เงาปีกเดิม", weight: 40, when: omenAt("dragonflight") }),
  E("ft.bt.omen_plague", [7, 13], "หมอยาประจำหมู่บ้านบอกว่าเด็กที่รอดจากปีโรคระบาดมักมีเลือดที่สู้โรคได้ เขาอยากให้คุณช่วยดูแลคนป่วย", [
    C("ไปช่วยหมอ", G("คุณช่วยป้อนยาคนป่วยทั้งฤดูหนาว และไม่ติดโรคแม้แต่ครั้งเดียว", { hp: 4, iq: 1 }, (l) => addStanding(l, 2))),
    C("ไม่อยากเข้าใกล้คนป่วย", N("หมอพยักหน้าเข้าใจ และไปขอเด็กคนอื่นแทน")),
  ], { title: "เลือดที่สู้โรค", weight: 40, when: omenAt("plague") }),
  E("ft.bt.omen_eclipse", [7, 13], "เด็กในหมู่บ้านไม่ยอมเล่นกับคุณ เพราะพ่อแม่ของพวกเขาบอกว่าเด็กสุริยุปราคานำโชคร้าย", [
    C("พิสูจน์ว่าไม่จริง ด้วยการช่วยทุกคน", G("คุณช่วยงานทุกบ้านจนหมดฤดู ป้าข้างบ้านคนแรกที่ยอมยิ้มให้คุณ แล้วคนอื่นๆ ก็ตามมา", { joy: 4 }, (l) => addStanding(l, 3))),
    C("เล่นคนเดียวในป่าแทน", G("คุณเจอที่ลับของตัวเองริมลำธาร และใช้เวลาคิดเรื่องต่างๆ ที่เด็กคนอื่นไม่คิด", { iq: 3, joy: -1 })),
  ], { title: "เด็กสุริยุปราคา", weight: 40, when: omenAt("eclipse") }),
  E("ft.bt.omen_harvest", [7, 13], "ชาวบ้านเชื่อว่าเด็กที่เกิดในปีข้าวงามนำโชค ผู้ใหญ่บ้านขอให้คุณเป็นคนหว่านเมล็ดแรกของปีนี้", [
    C("รับหน้าที่อย่างภูมิใจ", G("ปีนั้นข้าวงามอีกครั้ง และทุกคนในหมู่บ้านจำชื่อคุณได้", { joy: 5, fame: 1 })),
    C("ปฏิเสธเพราะเขินอาย", N("ผู้ใหญ่บ้านหัวเราะแล้วหว่านเอง ข้าวก็งามเหมือนเดิม")),
  ], { title: "เมล็ดแรกของปี", weight: 40, when: omenAt("harvest") }),
];
const FAMILY_EVENTS: GameEvent[] = [
  E("ft.bt.parents_found", [16, 45], `ชายแปลกหน้ากับหญิงคนหนึ่งยืนรอคุณอยู่หน้าบ้าน ทั้งคู่ถือผ้าห่อตัวเด็กผืนเก่าที่มีรอยปักเหมือนผ้าในตะกร้าที่คุณถูกพบ`, [
    C("ฟังเรื่องของพวกเขาจนจบ", G("พวกเขาเล่าว่าหนีโจรมาในคืนนั้น และวางคุณไว้หน้าวิหารเพื่อให้รอด ทั้งสามคนร้องไห้อยู่หน้าประตูนานจนฟ้ามืด", { joy: 10 }, (l) => { restoreKin(l, 55); deed(l, "ได้พบพ่อแม่ที่แท้จริง"); })),
    C("บอกว่าครอบครัวของคุณคือคนที่เลี้ยงมา", N("ทั้งคู่ก้มหน้า แล้วฝากผ้าผืนนั้นไว้ให้ก่อนเดินจากไป", { joy: -2 }, (l) => { const g = l.people.find((p) => p.tags?.includes("guardian")); if (g) g.bond = clamp(g.bond + 15, 0, 100); fl(l).lostKin = undefined; l.flags.ftKinRefused = true; })),
  ], { title: "คนที่ทิ้งตะกร้าไว้", weight: 25, when: (l) => on(l) && familyTypeOf(l) === "orphan" && !!parentLost(l) }),
  E("ft.bt.own_people", [14, 40], (l) => `คุณเห็นกลุ่ม${RACES[fl(l).race].name}เดินผ่านตลาด หน้าตาเหมือนคุณทุกคน แต่พูดภาษาที่คุณฟังไม่ออกสักคำ คนหนึ่งหันมามองคุณนาน`, [
    C("เข้าไปทักทายพวกเขา", G((l) => `พวกเขาชวนคุณกินข้าวและสอนคำแรกในภาษาของคุณเอง คุณกลับบ้านไปเล่าให้ครอบครัว${RACES[l.flags.ftRaisedBy as RaceId]?.name ?? ""}ฟังทั้งคืน`, { joy: 6, iq: 1 })),
    C("กลับบ้านไปหาครอบครัวที่เลี้ยงมา", G("คุณเดินกลับบ้านเร็วกว่าเดิม แม่บุญธรรมถามว่าเป็นอะไร คุณตอบแค่ว่าคิดถึง", { joy: 3 }, (l) => { for (const p of parents(l)) p.bond = clamp(p.bond + 6, 0, 100); })),
  ], { title: "คนหน้าเหมือนกัน", weight: 25, when: (l) => on(l) && familyTypeOf(l) === "adopted" }),
  E("ft.bt.noble_reveal", [16, 45], (l) => `ผู้ส่งสารในชุดตราขุนนางแห่ง${homeKingdom(l).name}มาหาคุณถึงบ้าน เขาบอกว่าคุณคือทายาทที่หายไปของตระกูลที่ล่มสลาย และยังมีสิทธิ์ในที่ดินกับตำแหน่ง`, [
    C("ทวงสิทธิ์ของตระกูลคืน", BIG("คุณยืนต่อหน้าสภาขุนนางพร้อมหลักฐาน ตราตระกูลถูกคืนให้คุณ แต่ญาติที่ยึดที่ดินไว้กลายเป็นศัตรูทันที", { fame: 6, gold: 40 }, (l) => { l.flags.ftNobleBlood = "known"; addStanding(l, 15); deed(l, "ทวงคืนตำแหน่งของตระกูลขุนนาง"); const foe = createPerson(l, "rival", { age: l.age + 15, bond: 10, job: "ญาติที่ยึดที่ดินไว้" }); remember(l, foe, "noble", "คุณทวงสิทธิ์ที่เขาถืออยู่", 3, { grudge: 40 }); })),
    C("เก็บเป็นความลับต่อไป", N("คุณเผาจดหมายนั้นทิ้ง และใช้ชีวิตเหมือนเดิม แต่บางคืนก็ยังสงสัยว่าถ้าเลือกอีกทางจะเป็นอย่างไร", {}, (l) => { l.flags.ftNobleBlood = "kept"; })),
    C("ขายความลับให้ญาติที่ยึดที่ดิน", B("ญาติคนนั้นจ่ายเงินก้อนใหญ่ให้คุณเงียบ และส่งคนมาเฝ้าคุณไปอีกหลายปี", { gold: 60, joy: -3 }, (l) => { l.flags.ftNobleBlood = "sold"; })),
  ], { title: "ทายาทที่หายไป", weight: 25, when: (l) => on(l) && l.flags.ftNobleBlood === "hidden" }),
  E("ft.bt.outcast_name", [13, 30], (l) => `ครูประจำเมืองไม่ยอมรับชื่อคุณลงทะเบียน เพราะนามสกุล${l.lastName}เคยทรยศเมืองหลวงเมื่อสามรุ่นก่อน`, [
    C("เปลี่ยนนามสกุลทิ้ง", N("คุณใช้นามสกุลใหม่ ประตูหลายบานเปิดง่ายขึ้น แต่พ่อไม่พูดกับคุณไปหลายเดือน", {}, (l) => { addStanding(l, 6); delete l.flags.ftOutcast; for (const p of parents(l)) p.bond = clamp(p.bond - 12, 0, 100); })),
    C("ยืนยันชื่อเดิม และพิสูจน์ตัวเอง", G("คุณสอบได้ที่หนึ่งของรุ่นทั้งที่ครูให้นั่งหลังห้อง คนในเมืองเริ่มพูดถึงนามสกุลนี้อีกแบบ", { iq: 2, joy: 4 }, (l) => { addStanding(l, 4); deed(l, "ล้างชื่อของตระกูลที่ถูกขับไล่"); delete l.flags.ftOutcast; })),
    C("ไปเรียนที่อื่น", N("คุณย้ายไปเรียนกับนักพรตนอกเมือง ไม่มีใครถามนามสกุลที่นั่น", { iq: 1 })),
  ], { title: "นามสกุลต้องห้าม", weight: 25, when: (l) => on(l) && !!l.flags.ftOutcast }),
];
const SIBLING_EVENTS: GameEvent[] = [
  E("ft.bt.twin", [10, 40], (l) => `คืนหนึ่งคุณสะดุ้งตื่นพร้อมใจเต้นแรง แล้วรู้ทันทีว่า${nm(twinOf(l))}กำลังมีเรื่อง`, [
    C("ออกเดินทางไปหาทันที", G((l) => `คุณไปถึงตอนที่${nm(twinOf(l))}กำลังจะถูกโจรรุมพอดี ทั้งคู่หนีรอดมาได้ด้วยกัน`, { joy: 6 }, (l) => { const t = twinOf(l); if (t) { t.bond = clamp(t.bond + 15, 0, 100); remember(l, t, "twin", "คุณมาทันตอนเขาเกือบตาย", 3, { love: 20, debt: 25 }); } })),
    C("ส่งจดหมายไปถาม", N((l) => `จดหมายตอบกลับมาในสองสัปดาห์ ${nm(twinOf(l))}บอกว่ารอดมาได้หวุดหวิด และฝันถึงคุณคืนนั้นเหมือนกัน`, {})),
  ], { title: "สายใยของฝาแฝด", weight: 25, maxTimes: 1, when: (l) => on(l) && !!twinOf(l)?.alive }),
  E("ft.bt.sib_protector", [8, 18], (l) => `เด็กโตกลุ่มหนึ่งล้อมคุณไว้หลังตลาด แล้ว${nm(sibWith("protector")(l))}ก็เดินออกมายืนขวางหน้า`, [
    C("ยืนสู้ข้างพี่", G("ทั้งสองคนกลับบ้านพร้อมตาเขียวคนละข้าง และหัวเราะกันทั้งคืน", { joy: 5, body: 6 }, (l) => { const s = sibWith("protector")(l); if (s) s.bond = clamp(s.bond + 12, 0, 100); })),
    C("บอกพี่ว่าคุณจัดการเองได้", N("พี่ถอยออกไปยืนดู คุณเจ็บตัว แต่ไม่มีใครกล้ามายุ่งกับคุณอีก", { hp: -3 }, (l) => { const s = sibWith("protector")(l); if (s) remember(l, s, "sib", "คุณอยากยืนได้ด้วยตัวเอง", 2, { respect: 15 }); })),
  ], { title: "พี่ที่ยืนขวางหน้า", weight: 25, maxTimes: 1, when: (l) => on(l) && !!sibWith("protector")(l) }),
  E("ft.bt.sib_rival", [8, 18], (l) => `${nm(sibWith("rival")(l))}ได้ที่หนึ่งในทุกการแข่งขันของหมู่บ้าน และพ่อแม่ก็พูดถึงแต่เรื่องนั้นที่โต๊ะอาหาร`, [
    P("ท้าแข่งให้รู้กันไป", (l) => 0.35 + (l.stats.smarts + l.stats.health - 100) / 200, G("คุณชนะเป็นครั้งแรก พี่เงียบไปนาน แล้วยื่นมือมาจับมือคุณ", { joy: 6, fame: 1 }), B("คุณแพ้อีกครั้งต่อหน้าทุกคน", { joy: -5 }, (l) => { const s = sibWith("rival")(l); if (s) remember(l, s, "sib", "คุณแพ้เขาต่อหน้าทุกคน", 2, { jealousy: -5, respect: -5 }); })),
    C("หาทางของตัวเองที่พี่ไม่ได้ทำ", G("คุณหันไปเรียนสิ่งที่ไม่มีใครในบ้านเคยทำ และเก่งจนพ่อแม่ต้องหันมามอง", { iq: 3, joy: 3 })),
  ], { title: "พี่ที่เก่งกว่าเสมอ", weight: 25, maxTimes: 1, when: (l) => on(l) && !!sibWith("rival")(l) }),
  E("ft.bt.sib_heir", [12, 20], (l) => `พ่อแม่ประกาศว่า${nm(sibWith("heir")(l))}จะเป็นคนสืบกิจการของบ้าน ส่วนคุณต้องหาทางของตัวเอง`, [
    C("ยอมรับแล้วออกไปหาทางเอง", G("คุณเก็บกระเป๋าออกจากบ้านเร็วกว่าเพื่อนรุ่นเดียวกัน และเรียนรู้โลกเร็วกว่าพวกเขาด้วย", { joy: 2, iq: 2 }, (l) => addStanding(l, 1))),
    C("ขอแข่งเป็นทายาทแทน", B("บ้านแตกเป็นสองฝั่ง พี่ไม่พูดกับคุณอีกหลายปี", { joy: -4 }, (l) => { const s = sibWith("heir")(l); if (s) remember(l, s, "sib", "คุณพยายามแย่งตำแหน่งทายาท", 3, { grudge: 25, jealousy: 15 }); })),
  ], { title: "ทายาทของบ้าน", weight: 25, maxTimes: 1, when: (l) => on(l) && !!sibWith("heir")(l) }),
];
const HALF_EVENTS: GameEvent[] = [
  E("ft.bt.half_belong", [13, 25], (l) => `เด็ก${RACES[fl(l).race].name}บอกว่าคุณไม่ใช่พวกเขา เด็ก${RACES[fl(l).half!].name}ก็บอกแบบเดียวกัน`, [
    C("บอกตัวเองว่าคุณเป็นทั้งสองอย่าง", G("คุณเลิกพยายามเป็นแค่ฝั่งเดียว และพบว่าเพื่อนที่ดีที่สุดคือเด็กที่ไม่เข้าพวกเหมือนกัน", { joy: 5 })),
    C("ฝึกให้เหมือนฝั่งพ่อ", N("คุณฝึกทุกอย่างของเผ่าพ่อจนชำนาญ แต่ทุกคนยังมองหูของคุณอยู่ดี", { body: 6, joy: -1 })),
    C("ฝึกให้เหมือนฝั่งแม่", N("คุณเรียนเพลงและภาษาของเผ่าแม่จนพูดได้คล่องกว่าเด็กแท้ๆ", { iq: 3, joy: -1 })),
  ], { title: "ไม่ใช่ทั้งสองฝั่ง", weight: 30, maxTimes: 1, when: (l) => on(l) && !!fl(l).half }),
  E("ft.bt.half_bridge", [25, 600], (l) => `${RACES[fl(l).race].name}กับ${RACES[fl(l).half!].name}ทะเลาะกันเรื่องที่ดินริมแม่น้ำ ทั้งสองฝั่งชี้มาที่คุณ เพราะคุณเป็นคนเดียวที่พูดภาษาทั้งสองเผ่าได้`, [
    P("เป็นคนกลางเจรจา", (l) => 0.45 + l.stats.smarts / 300 + l.stats.looks / 400, BIG("ทั้งสองเผ่าลงนามแบ่งที่ดินกันต่อหน้าคุณ หมู่บ้านริมแม่น้ำตั้งชื่อสะพานใหม่ตามชื่อคุณ", { fame: 5, joy: 6 }, (l) => { addStanding(l, 5); deed(l, "เป็นสะพานระหว่างสองเผ่า"); }), B("การเจรจาล่ม ทั้งสองฝั่งโทษคุณว่าเข้าข้างอีกฝ่าย", { joy: -5 }, (l) => addStanding(l, -3))),
    C("ไม่เข้าไปยุ่ง", N("ทั้งสองเผ่าตกลงกันไม่ได้ไปอีกหลายปี")),
  ], { title: "สะพานระหว่างสองเผ่า", weight: 20, maxTimes: 1, when: (l) => on(l) && !!fl(l).half }),
];

/** ฝาแฝดที่จากไปทิ้งรูโหว่ในใจมากกว่าพี่น้องทั่วไป */
function twinGrief(l: Life) {
  if (!on(l) || !l.alive) return;
  const t = twinOf(l);
  if (t && !t.alive && !l.flags.ftTwinGrief) { l.flags.ftTwinGrief = true; addStat(l, "happiness", -10); log(l, `ตั้งแต่${shortName(t)}จากไป คุณรู้สึกเหมือนครึ่งหนึ่งของตัวเองหายไปด้วย`, "bad"); }
}

export const BIRTH_EVENTS: GameEvent[] = [...OMEN_EVENTS, ...FAMILY_EVENTS, ...SIBLING_EVENTS, ...HALF_EVENTS];
/** เซฟเก่า: เด็กที่ถูกทิ้งเคยเห็นพ่อแม่แท้ๆ ในรายชื่อ · ย้ายออกไป และให้คนที่รับเลี้ยงเป็นพ่อแม่บุญธรรม */
function fixOldFoundling(l: Life) {
  if (!on(l) || familyTypeOf(l) !== "orphan") return;
  const old = parents(l).filter((p) => p.tags?.includes("lost_parent"));
  if (!old.length) return;
  l.people = l.people.filter((p) => !old.includes(p));
  fl(l).lostKin = [...(fl(l).lostKin ?? []), ...old.map((p) => ({ ...p, age: p.age - l.age, tags: (p.tags ?? []).filter((t) => !t.startsWith("away:") && t !== "lost_parent") }))];
  const g = l.people.find((p) => p.tags?.includes("guardian") && p.relation === "friend");
  if (g) g.relation = g.gender === "m" ? "father" : "mother";
}

export function loadBirth() {
  birthHooks.push(birthSetup);
  yearHooks.push(fixOldFoundling);
  yearHooks.push(twinGrief);
}
