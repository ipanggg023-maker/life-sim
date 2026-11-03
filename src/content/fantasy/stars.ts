// พรสวรรค์ดาว: กายกับเวท 0–10 ดาว ทอยตอนเกิด · แผนอยู่ที่ design/STARS_PLAN.md
// ดาวกำหนดจุดเริ่มต้น เพดานขั้น ความเร็วในการฝึก และวิชาประจำดาว · ไม่มีดาวก็ยังรุ่งได้ทางอื่น
import type { GameEvent } from "../../engine/events";
import { chance, pick, randInt, weightedPick } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { addStat, displayName, log } from "../../engine/util";
import { addLegend, recordChronicle } from "../../engine/worldState";
import { B, BIG, C, E, G, GOLD, K, N, P } from "./kit";
import { addStanding, dataOf, deed, fl, homeKingdom, worldOfLife, type RaceId } from "./state";
import { notableName } from "./names";
import { combat, fightOdds } from "./power";

export const STAR_MAX = 10;
/** โอกาสเกิดมามีดาวแต่ละขั้น · 7 ดาว ~1/50 · 9 ดาว ~1/500 · 10 ดาว ~1/2000 */
const ROLL = [30, 22, 17, 12, 8, 5, 3, 1.6, 0.8, 0.2, 0.05];
export const STAR_TIERS = ["ไร้พรสวรรค์", "ธรรมดา", "ธรรมดา", "มีแวว", "มีแวว", "พรสวรรค์", "พรสวรรค์", "อัจฉริยะ", "อัจฉริยะ", "หนึ่งในพัน", "หนึ่งในยุค"];
export const AWAKEN_AGE = 6;

export type Track = "body" | "magic";
export interface Stars { b: number; m: number }

const cap10 = (n: number) => Math.max(0, Math.min(STAR_MAX, n));
export const rollOne = (l: Life) => weightedPick(l, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], (s) => ROLL[s])!;
/** เผ่าเอียงดาวเล็กน้อย · มนุษย์กับฮาล์ฟลิงไม่เอียงแต่ผันผวนกว่า */
const RACE_TILT: Record<RaceId, Stars> = { human: { b: 0, m: 0 }, halfling: { b: 0, m: 0 }, orc: { b: 1, m: 0 }, beastfolk: { b: 1, m: 0 }, dwarf: { b: 1, m: 0 }, elf: { b: 0, m: 1 }, demon: { b: 0, m: 1 }, dragon: { b: 1, m: 1 } };
const wide = (l: Life, race: RaceId, n: number) => (race !== "human" && race !== "halfling" ? n : chance(l, 0.1) ? n + 2 : chance(l, 0.1) ? n - 1 : n);
export function rollStars(l: Life, race: RaceId): Stars {
  const t = RACE_TILT[race];
  return { b: cap10(wide(l, race, rollOne(l) + t.b)), m: cap10(wide(l, race, rollOne(l) + t.m)) };
}

export const starsOfMe = (l: Life): Stars => ({ b: fl(l).bstars ?? 0, m: fl(l).potential });
export const topStar = (l: Life) => Math.max(fl(l).bstars ?? 0, fl(l).potential);
export const seen = (l: Life) => !!l.flags.ftStarsSeen;
export const starRow = (n: number) => "★".repeat(n) + "☆".repeat(STAR_MAX - n);
export const starsOn = (n: number) => "★".repeat(cap10(n));
export const starsOff = (n: number) => "☆".repeat(STAR_MAX - cap10(n));
export const tierOf = (n: number) => STAR_TIERS[cap10(n)];
/** เพิ่มดาว · ทางเดียวที่ดาวขยับหลังเกิด (วิวัฒน์ ตำนาน พันธสัญญา ของวิเศษ) */
export function addStars(l: Life, track: Track, n: number) {
  const f = fl(l);
  if (track === "body") f.bstars = cap10((f.bstars ?? 0) + n);
  else f.potential = cap10(f.potential + n);
}
/** ทั้งสองสายสูงพอจะเดินทางดาบเวท */
export const dual = (l: Life) => (fl(l).bstars ?? 0) >= 6 && fl(l).potential >= 6;

/** จุดเริ่มต้นตามดาว · เรียกครั้งเดียวตอนเกิดหลังพรสวรรค์ทำงานแล้ว */
export function applyStarStart(l: Life) {
  const f = fl(l), b = f.bstars ?? 0, m = f.potential;
  f.body += b * 6;
  f.magic += m * 6;
  addStat(l, "health", b);
  addStat(l, "looks", Math.floor(b / 3));
  addStat(l, "smarts", Math.floor(m / 2));
  f.bodyRank = Math.max(f.bodyRank, b >= 10 ? 2 : b >= 9 ? 1 : 0);
  f.magicRank = Math.max(f.magicRank, m >= 10 ? 2 : m >= 9 ? 1 : 0);
  l.flags.ftBornStars = `${b}/${m}`;
  // ไร้ดาวสักสาย มีโอกาสเล็กน้อยที่ดาวจะตื่นช้า
  if ((b === 0 || m === 0) && chance(l, 0.05)) { l.flags.ftBloomAt = randInt(l, 20, 40); l.flags.ftBloomTrack = b === 0 && (m !== 0 || chance(l, 0.5)) ? "body" : "magic"; }
}

/** ลูกได้ดาวจากพ่อแม่ทั้งสองคน */
export function childStars(l: Life, a: Stars, other?: Stars): Stars {
  const o = other ?? { b: rollOne(l), m: rollOne(l) };
  const mix = (x: number, y: number) => cap10(Math.round((x + y) / 2) + randInt(l, -1, 1) + (chance(l, 0.04) ? randInt(l, 2, 4) : 0));
  return { b: mix(a.b, o.b), m: mix(a.m, o.m) };
}

/** คนสำคัญมีดาว: คู่ครอง ลูก คู่ปรับ ยอดฝีมือในโลก */
const keyPerson = (p: Person) => ["spouse", "partner", "child", "rival"].includes(p.relation) || p.notable !== undefined || !!p.tags?.some((t) => t.startsWith("party:") || t === "life_rival");
const otherParent = (l: Life) => l.people.find((p) => p.relation === "spouse" && p.alive) ?? l.people.find((p) => p.relation === "partner" && p.alive) ?? l.people.find((p) => p.relation === "spouse");
export function giveNpcStars(l: Life) {
  for (const p of l.people) {
    if (p.stars || !keyPerson(p)) continue;
    if (p.relation === "child") p.stars = childStars(l, starsOfMe(l), otherParent(l)?.stars);
    else { const s = { b: rollOne(l), m: rollOne(l) }; if (p.relation === "rival" || p.notable !== undefined) { s.b = cap10(s.b + 1); s.m = cap10(s.m + 1); } p.stars = s; }
  }
}
export const npcStarText = (p: Person) => (p.stars ? `กาย ${p.stars.b}★ เวท ${p.stars.m}★` : "");

/** วิชาประจำดาว · ได้เองเมื่อดาวถึง ไม่ต้องฝึก */
export interface StarArt { at: number; name: string; desc: string }
export const BODY_ARTS: StarArt[] = [
  { at: 3, name: "ลมหายใจนักรบ", desc: "แผลหายเร็ว สุขภาพฟื้นทุกปี" },
  { at: 5, name: "ร่างไม่รู้ล้า", desc: "ฝึกกายแต่ละครั้งได้มากขึ้น" },
  { at: 7, name: "ผิวเหล็ก", desc: "ตายยากขึ้นในงานเสี่ยง" },
  { at: 9, name: "หมัดผ่าศิลา", desc: "พลังต่อสู้ +8" },
  { at: 10, name: "ร่างไร้กาลเวลา", desc: "แก่ช้า อายุยืนขึ้น 30 ปี" },
];
export const MAGIC_ARTS: StarArt[] = [
  { at: 3, name: "ตามานา", desc: "เห็นสายมานา สติปัญญาเติบโตทุกสองปี" },
  { at: 5, name: "ธารมานา", desc: "มานาสูงสุด +2" },
  { at: 7, name: "ร่ายไร้วาจา", desc: "พลังต่อสู้สายเวท +5" },
  { at: 9, name: "วงเวทซ้อน", desc: "พลังต่อสู้ +8" },
  { at: 10, name: "ดวงตาแห่งดวงดาว", desc: "อายุยืนขึ้น 30 ปี" },
];
/** วิชาดาบเวท ปลดตามขั้นที่ต่ำกว่าของสองสาย */
export const BLADE_ARTS = ["ดาบอาคมเพลิง", "โล่มานาบนคมดาบ", "ก้าวสายฟ้า", "ดาบดวงดาว", "ฟันข้ามมิติ", "ดาวคู่ร่วงฟ้า"];
const has = (l: Life, track: Track, at: number) => (track === "body" ? fl(l).bstars ?? 0 : fl(l).potential) >= at;
export const bladeArts = (l: Life) => (dual(l) ? BLADE_ARTS.slice(0, Math.min(fl(l).bodyRank, fl(l).magicRank)) : []);
export const starFight = (l: Life) => (has(l, "body", 9) ? 8 : 0) + (has(l, "magic", 9) ? 8 : 0) + (has(l, "magic", 7) && fl(l).magicRank >= 1 ? 5 : 0) + bladeArts(l).length * 3;
export const starSafety = (l: Life) => (has(l, "body", 7) ? 0.85 : 1);
export const starMana = (l: Life) => (has(l, "magic", 5) ? 2 : 0);
/** ตัวคูณแต้มฝึก · สิบดาวฝึกครั้งเดียวได้เท่าคนธรรมดาฝึกสองครั้ง */
export const starTrain = (l: Life, track: Track) => 1 + 0.12 * (track === "body" ? fl(l).bstars ?? 0 : fl(l).potential);
export const starLife = (l: Life) => (has(l, "body", 10) ? 30 : 0) + (has(l, "magic", 10) ? 30 : 0);
export const twinStar = (l: Life) => dual(l) && fl(l).bodyRank >= 4 && fl(l).magicRank >= 4;

export function starYear(l: Life) {
  giveNpcStars(l);
  // ดาวห้าดวงขึ้นไปเติบโตเองแม้ไม่ได้ฝึก
  if (l.age >= AWAKEN_AGE && l.age <= 60) { const f = fl(l); f.body += Math.max(0, (f.bstars ?? 0) - 4) * 5; f.magic += Math.max(0, f.potential - 4) * 5; }
  if (has(l, "body", 3) && l.stats.health < 85) addStat(l, "health", 1);
  if (has(l, "magic", 3) && l.age % 2 === 0) addStat(l, "smarts", 1);
  // อัจฉริยะที่ไม่ฝึก ถูกทั้งบ้านทั้งเมืองถามหา
  if (seen(l) && topStar(l) >= 8 && l.age >= 10 && l.age <= 30 && l.age - Number(l.flags.ftTrainedAge ?? -99) >= 2) {
    addStat(l, "happiness", -2);
    addStanding(l, -1);
    if (chance(l, 0.3)) log(l, "คนในเมืองซุบซิบว่าอัจฉริยะคนนั้นเลิกฝึกแล้วหรือ");
  }
  if (l.flags.ftPatron !== undefined && l.age <= 35) l.money += 5 * GOLD;
  if (twinStar(l) && !l.flags.ftTwinStar) { l.flags.ftTwinStar = true; deed(l, "ดาวคู่ผู้ถือดาบและเวทถึงขั้นสูงสุดพร้อมกัน"); log(l, "คนทั้งแผ่นดินเรียกคุณว่า ดาวคู่", "milestone"); }
}

/** ชนะคนที่ดาวเหนือกว่าห้าดาวขึ้นไป · ตำนานของคนธรรมดา */
export function underdogWin(l: Life, their?: Stars): string {
  if (!their || !seen(l)) return "";
  const gap = Math.max(their.b, their.m) - topStar(l);
  if (gap < 5) return "";
  l.flags.ftUnderdog = Number(l.flags.ftUnderdog ?? 0) + 1;
  if (l.flags.ftUnderdog === 1) deed(l, "สามัญชนผู้ล้มอัจฉริยะ");
  addStanding(l, 8);
  l.fame = Math.min(100, l.fame + 15);
  return " ข่าวว่าคนดาวน้อยล้มอัจฉริยะได้ แพร่ไปทั่วแผ่นดิน";
}

interface Prodigy { name: string; year: number; lifeId: string; track: Track }
const prodigies = (l: Life) => ((dataOf(l) as { prodigies?: Prodigy[] }).prodigies ??= []);

const readText = (l: Life) => {
  const { b, m } = starsOfMe(l);
  const line = (k: string, n: number) => `${k} ${starRow(n)} · ${tierOf(n)}`;
  const top = Math.max(b, m);
  const mood = top >= 10 ? "แผ่นศิลาร้าวกลางวิหาร นักบวชทรุดลงคุกเข่า ระฆังทั้งเมืองดังเอง" : top >= 8 ? "ศิลาสว่างจนทุกคนต้องหลับตา นักบวชเรียกเจ้าเมืองมาดูด้วยตัวเอง" : top >= 5 ? "ศิลาเรืองแสงนิ่งๆ นักบวชพยักหน้าช้าๆ" : top >= 1 ? "ศิลาวาบขึ้นจางๆ แล้วดับลง" : "ศิลาเย็นและมืดสนิท แม่บีบมือคุณแน่น";
  return `วันเกิดปีที่หกคุณถูกพาไปวิหารเพื่อวางมือบนศิลาอ่านดาว ${mood}\n${line("กาย", b)}\n${line("เวท", m)}`;
};
const reveal = (l: Life) => {
  l.flags.ftStarsSeen = true;
  const { b, m } = starsOfMe(l), w = worldOfLife(l);
  for (const [t, n] of [["body", b], ["magic", m]] as [Track, number][]) {
    if (n < 10) continue;
    const what = t === "body" ? "ร่างสิบดาว" : "เวทสิบดาว";
    prodigies(l).push({ name: displayName(l), year: w.year, lifeId: l.id, track: t });
    recordChronicle(w, `${displayName(l)}เกิดมาพร้อม${what} ที่${homeKingdom(l).name}`);
    addLegend(w, { name: displayName(l), deed: `เกิดมาพร้อม${what}`, lifeId: l.id });
    l.fame = Math.min(100, l.fame + 10);
  }
  if (dual(l)) l.flags.ftDual = true;
};

const s7 = (l: Life) => seen(l) && topStar(l) >= 7;
const s8 = (l: Life) => seen(l) && topStar(l) >= 8;
const train = (l: Life) => { l.flags.ftTrainedAge = l.age; };

export const STAR_EVENTS: GameEvent[] = [
  // ก่อนอ่านดาว มีแค่ลางบอก
  E("ft.st.hint_body", [1, 5], "คุณบีบนิ้วพ่อจนเขาร้อง แล้วลากเก้าอี้ไม้ทั้งตัวข้ามห้องก่อนจะเดินได้คล่องเสียอีก", [C("ยิ้มให้พ่อ", G("พ่อหัวเราะ แต่ตาเขาจ้องคุณนานกว่าปกติ", { hp: 2 }))], { when: (l) => (fl(l).bstars ?? 0) >= 6, maxTimes: 1, weight: 20, title: "เด็กแรงช้าง" }),
  E("ft.st.hint_magic", [1, 5], "ทุกครั้งที่คุณร้องไห้ เปลวเทียนทั้งบ้านจะเอนเข้าหาคุณ และหน้าต่างจะมีน้ำค้างแข็งเป็นลวดลาย", [C("หัวเราะใส่เปลวไฟ", G("แม่เก็บเทียนทุกเล่มขึ้นที่สูง", { iq: 2 }))], { when: (l) => fl(l).potential >= 6, maxTimes: 1, weight: 20, title: "เปลวเทียนเอน" }),
  E("ft.st.awaken", [AWAKEN_AGE, 900], readText, [
    C("ถามนักบวชว่าแปลว่าอะไร", (l) => { reveal(l); const t = topStar(l); return { text: t >= 8 ? "นักบวชบอกว่าในชีวิตเขาเห็นแบบนี้มาไม่ถึงสามครั้ง" : t >= 4 ? "นักบวชบอกว่าถ้าฝึกหนัก คุณจะไปได้ไกลกว่าคนส่วนใหญ่" : "นักบวชบอกว่าดาวไม่ใช่ทุกอย่าง คนธรรมดาเป็นกษัตริย์ พ่อค้า และช่างฝีมือมานักต่อนัก", kind: t >= 8 ? "milestone" : "normal" }; }),
    C("กำมือแน่นแล้วสัญญากับตัวเอง", (l) => { reveal(l); train(l); return { text: topStar(l) >= 5 ? "คุณสัญญาว่าจะไม่ทำให้ดาวเหล่านี้สูญเปล่า" : "คุณสัญญาว่าจะพิสูจน์ว่าศิลาก้อนนั้นคิดผิด", kind: "good" }; }),
  ], { forced: true, maxTimes: 1, title: "ศิลาอ่านดาว", when: (l) => !seen(l) }),

  // ดาวตื่นช้า
  E("ft.st.bloom", [20, 60], (l) => `${l.flags.ftBloomTrack === "body" ? "ร่างกายที่เคยธรรมดาร้อนผ่าวเหมือนมีเตาไฟอยู่ในกระดูก" : "มานาที่ไม่เคยมีไหลออกจากปลายนิ้วเป็นครั้งแรก"} ดาวที่หลับมาตั้งแต่เกิดเพิ่งตื่น`, [
    C("ปล่อยให้มันไหลออกมา", BIG("คุณกลับไปที่วิหาร ศิลาอ่านดาวสว่างขึ้นสามดาว นักบวชบอกว่าไม่เคยเห็นใครตื่นช้าขนาดนี้", { joy: 10 }, (l) => { addStars(l, l.flags.ftBloomTrack === "body" ? "body" : "magic", 3); delete l.flags.ftBloomAt; l.flags.ftBloomed = true; deed(l, "ดาวที่ตื่นเมื่ออายุมากแล้ว"); })),
  ], { forced: true, maxTimes: 1, title: "ดาวตื่นช้า", when: (l) => !!l.flags.ftBloomAt && (l.age >= Number(l.flags.ftBloomAt) || (Number(l.flags.lossAge ?? -99) >= l.age - 1 || l.stats.health < 25)) }),

  // คนดาวน้อยโดนอัจฉริยะท้า
  E("ft.st.prodigy", [16, 50], (_l, c) => `${c.name} อัจฉริยะ${c.stars}ดาวที่ทุกคนพูดถึง เดินผ่านมาแล้วหัวเราะใส่ศิลาอ่านดาวของคุณ "คนแบบเจ้าควรไปไถนา"`, [
    P("ท้าดวลต่อหน้าทุกคน", (l) => fightOdds(l, combat(l) + 14), (l, c) => ({ text: `ดาบของ${c.name}หลุดจากมือ คนทั้งลานเงียบกริบ${underdogWin(l, { b: Number(c.stars), m: 0 })}`, kind: "milestone" }), B("เขาเก่งสมคำร่ำลือ คุณได้แผลกลับบ้านพร้อมกับความแค้น", { hp: -12, joy: -4 }, train)),
    C("ไม่สนใจแล้วเดินต่อ", N("คุณมีงานต้องทำ และคำพูดของเขาไม่ได้จ่ายค่าเช่าให้คุณ", { joy: -1 })),
  ], { when: (l) => seen(l) && topStar(l) <= 4, weight: 5, maxTimes: 2, title: "อัจฉริยะผู้ดูแคลน", prepare: (l) => ({ name: notableName(l), stars: Math.max(topStar(l) + 5, randInt(l, 8, 10)) }) }),

  // ผู้มาเยือนเพราะดาว
  E("ft.st.scout_knight", [9, 18], "อัศวินในเสื้อคลุมสีเงินมาหาที่บ้าน เขาได้ยินเรื่องการอ่านดาวของคุณและอยากรับเป็นเด็กฝึก", [
    C("ไปกับเขา", G("ฝึกหนักจนมือแตก แต่ดาบในมือคุณไม่สั่นอีกต่อไป", { body: 45, hp: 2 }, (l) => { addStanding(l, 4); train(l); })),
    C("ขอบคุณแต่ยังไม่ไป", N("เขาวางเข็มกลัดไว้ให้ เผื่อคุณเปลี่ยนใจ")),
  ], { when: (l) => seen(l) && (fl(l).bstars ?? 0) >= 7, maxTimes: 1, weight: 30, title: "อัศวินมาเยือน" }),
  E("ft.st.scout_tower", [9, 18], "นกฮูกส่งจดหมายผนึกขี้ผึ้งสีม่วงมา หอเวทหลวงเสนอทุนเรียนเต็มจำนวนให้เด็กที่ศิลาสว่างจ้า", [
    C("ตอบรับทุน", G("ห้องสมุดของหอเวทมีหนังสือมากกว่าดาวบนฟ้า", { magic: 45, iq: 3 }, (l) => { const f = fl(l); f.wand ??= { name: "คทาของหอเวทหลวง", quality: 2, material: "ไม้โอ๊กเงิน" }; train(l); })),
    C("เก็บจดหมายไว้ก่อน", N("นกฮูกจ้องคุณอย่างไม่พอใจ")),
  ], { when: (l) => seen(l) && fl(l).potential >= 7, maxTimes: 1, weight: 30, title: "ทุนจากหอเวท" }),
  E("ft.st.patron", [12, 30], (l) => `ท่านลอร์ดแห่ง${homeKingdom(l).name}อยากอุปถัมภ์อัจฉริยะอย่างคุณ ทุกปีจะส่งทองมาให้ แลกกับการถือธงของเขาในงานประลอง`, [
    C("รับการอุปถัมภ์", G("หีบทองใบแรกมาถึงพร้อมผ้าคลุมตราตระกูลของเขา", { gold: 20 }, (l) => { l.flags.ftPatron = l.age; })),
    C("ไม่ขอเป็นของใคร", G("คุณเลือกเดินทางนี้ด้วยตัวเอง", { joy: 3 })),
  ], { when: s7, maxTimes: 1, weight: 14, title: "ผู้อุปถัมภ์" }),
  E("ft.st.patron_ask", [14, 40], "ผู้อุปถัมภ์ขอให้คุณลงประลองในนามตระกูลเขา คู่ต่อสู้คือแชมป์ของตระกูลศัตรู", [
    P("ลงสนาม", (l) => fightOdds(l, 30 + l.age), G("ธงของท่านลอร์ดโบกสะบัด เขาส่งทองมาเป็นรางวัลอีกก้อน", { gold: 30, fame: 6 }), B("คุณแพ้ และท่านลอร์ดเย็นชาไปทั้งปี", { hp: -8 }, (l) => { addStanding(l, -3); })),
    C("ปฏิเสธและคืนเงินอุปถัมภ์", N("การอุปถัมภ์จบลง แต่คุณได้อิสระคืนมา", { gold: -10 }, (l) => { delete l.flags.ftPatron; })),
  ], { when: (l) => l.flags.ftPatron !== undefined, maxTimes: 3, weight: 12, title: "หนี้ของผู้อุปถัมภ์" }),
  E("ft.st.guild_invite", [16, 30], "ปรมาจารย์กิลด์นักผจญภัยมาหาเอง เขาไม่อยากให้อัจฉริยะเริ่มจากขั้นเหล็กเหมือนคนอื่น", [
    C("รับป้ายขั้นเงิน", G("ป้ายเงินเย็นในมือ คนในกิลด์มองคุณด้วยสายตาทั้งอิจฉาและหวาดระแวง", { fame: 4 }, (l) => { fl(l).guild = Math.max(fl(l).guild, 3); })),
    C("ขอเริ่มจากศูนย์เหมือนคนอื่น", G("ปรมาจารย์ยิ้ม เขาเคารพคำตอบนี้", { joy: 3 }, (l) => { fl(l).guild = Math.max(fl(l).guild, 1); })),
  ], { when: s8, maxTimes: 1, weight: 14, title: "คำเชิญจากกิลด์" }),

  // ความริษยาและอันตราย
  E("ft.st.envy", [10, 25], "เพื่อนร่วมรุ่นคนหนึ่งแอบใส่ยาในน้ำของคุณก่อนวันสอบ เพราะทนไม่ได้ที่คนอย่างคุณเกิดมาพร้อมดาวทั้งหมดนั้น", [
    K("ฝืนสอบต่อ", "health", 55, G("คุณสอบผ่านทั้งที่มือสั่น และคนที่วางยามองคุณด้วยความกลัว", { fame: 3 }), B("คุณล้มกลางห้องสอบ และต้องนอนพักครึ่งเดือน", { hp: -14 })),
    C("สืบหาคนทำ", G("คุณรู้ว่าเป็นใคร และเลือกจะไม่บอกใคร แต่เขารู้ว่าคุณรู้", { iq: 2 })),
  ], { when: s8, maxTimes: 1, weight: 12, title: "ความริษยา" }),
  E("ft.st.assassin", [14, 60], (l) => `แผ่นดินศัตรูของ${homeKingdom(l).name}กลัวว่าอัจฉริยะอย่างคุณจะโตขึ้นเป็นแม่ทัพ คืนนี้มีเงาสามเงาบนหลังคา`, [
    P("สู้", (l) => fightOdds(l, 34 + Math.min(30, l.age)), G("เงาทั้งสามร่วงลงจากหลังคา และคุณได้มีดสั้นอาบยาพิษมาหนึ่งเล่ม", { fame: 6, body: 15 }), B("มีดเฉียดหัวใจไปนิ้วเดียว", { hp: -24 })),
    C("หนีออกทางหน้าต่าง", N("คุณรอด แต่ต้องย้ายที่นอนทุกคืนไปอีกปี", { joy: -5 })),
  ], { when: s8, maxTimes: 2, weight: 8, title: "นักฆ่าใต้แสงจันทร์" }),
  E("ft.st.demon", [16, 80], "เสียงกระซิบดังในฝันว่าร่างอย่างคุณหาได้ยากในพันปี ปีศาจตนหนึ่งขอเข้าไปอยู่ด้วย แลกกับพลังที่มากขึ้นอีก", [
    C("ยอมแลก", BIG("ดาวในตัวคุณสว่างขึ้นอีกดวง แต่บางคืนคุณได้ยินเสียงหัวเราะที่ไม่ใช่ของคุณ", { joy: -6 }, (l) => { addStars(l, fl(l).potential >= (fl(l).bstars ?? 0) ? "magic" : "body", 1); fl(l).pacts = (fl(l).pacts ?? 0) + 1; })),
    P("ขับไล่มันออกไป", (l) => fightOdds(l, 40), G("คุณตื่นมาพร้อมเหงื่อท่วมตัว เสียงนั้นไม่กลับมาอีก", { iq: 2, joy: 2 }), B("มันจากไป แต่ทิ้งรอยไหม้ไว้ที่หน้าอก", { hp: -10 })),
  ], { when: (l) => seen(l) && topStar(l) >= 9, maxTimes: 1, weight: 10, title: "ปีศาจอยากได้ร่าง" }),
  E("ft.st.kidnap", [6, 12], "พวกค้าทาสได้ยินว่ามีเด็กศิลาสว่างจ้าในเมืองนี้ คืนนั้นมีมือปิดปากคุณจากด้านหลัง", [
    K("กัดมือแล้ววิ่ง", "luck", 45, G("คุณวิ่งกลับบ้านทั้งเท้าเปล่า พ่อแม่ไม่ยอมปล่อยมือคุณไปหลายคืน", { joy: -2 }), B("คุณถูกพาไปไกลสองวันก่อนยามเมืองจะตามทัน", { hp: -8, joy: -8 })),
  ], { when: s8, maxTimes: 1, weight: 10, title: "มือในความมืด" }),

  // ความคาดหวัง
  E("ft.st.expect", [8, 16], "ญาติทุกคนในงานเลี้ยงถามเรื่องดาวของคุณ ไม่มีใครถามว่าคุณอยากเป็นอะไร", [
    C("บอกว่าจะเป็นที่หนึ่งให้ได้", G("ทุกคนปรบมือ คุณฝึกหนักขึ้นอีกเท่าตัวปีนั้น", { body: 20, magic: 20, joy: -3 }, train)),
    C("บอกว่าอยากเปิดร้านขนมปัง", N("งานเลี้ยงเงียบไปทั้งโต๊ะ แต่คุณรู้สึกเบาขึ้น", { joy: 5 }, (l) => { addStanding(l, -3); l.flags.ftDefied = true; })),
  ], { when: s8, maxTimes: 1, weight: 16, title: "ความคาดหวัง" }),
  E("ft.st.disgrace", [28, 40], "คนทั้งเมืองเล่าถึงคุณว่าเป็นอัจฉริยะสิบดาวที่ทิ้งพรสวรรค์ แม่ๆ ใช้ชื่อคุณขู่ลูกที่ขี้เกียจ", [
    C("ยอมรับมันแล้วใช้ชีวิตต่อ", N("คุณเลือกชีวิตนี้เอง และคุณจะไม่ขอโทษใคร", { joy: 2 }, (l) => { deed(l, "อัจฉริยะสิบดาวที่ทิ้งพรสวรรค์"); addStanding(l, -10); })),
    C("หยิบดาบหรือคทาขึ้นมาอีกครั้ง", G("มือที่ไม่ได้จับมานานยังจำทุกอย่างได้", { body: 60, magic: 60 }, (l) => { addStanding(l, -4); train(l); })),
  ], { when: (l) => seen(l) && topStar(l) >= 10 && fl(l).bodyRank < 3 && fl(l).magicRank < 3, maxTimes: 1, forced: true, title: "อัจฉริยะที่หายไป" }),

  // ตำนานของคนรุ่นก่อน
  E("ft.st.legend_tale", [8, 70], (_l, c) => `ในวิหารมีรูปปั้นของ${c.name} ผู้เกิดมาพร้อม${c.track === "body" ? "ร่าง" : "เวท"}สิบดาวเมื่อปี ${c.year} นักบวชบอกว่าศิลาอ่านดาวยังมีรอยร้าวจากวันนั้น`, [
    C("แตะรอยร้าวนั้น", G("ศิลาอุ่นใต้มือคุณ ราวกับยังจำได้", { joy: 3, iq: 1 })),
  ], { when: (l) => prodigies(l).some((p) => p.lifeId !== l.id), maxTimes: 1, weight: 10, title: "รอยร้าวบนศิลา", prepare: (l) => { const p = pick(l, prodigies(l).filter((x) => x.lifeId !== l.id)); return { name: p.name, year: p.year, track: p.track }; } }),
];

/** เซฟเก่า: เวท 0–5 กลายเป็น 0–10 · กายทอยใหม่ · ผ่านหกขวบแล้วถือว่าอ่านดาวแล้ว */
export function migrateStars(l: Life) {
  const f = l.ft;
  if (!f || f.bstars !== undefined) return;
  f.potential = cap10(f.potential * 2);
  // ฝีมือที่ฝึกมาแล้วในเซฟเก่าต้องไม่ติดเพดานใหม่
  const need = [0, 0, 2, 4, 6, 8, 10][f.bodyRank] ?? 10;
  f.bstars = Math.max(rollStars(l, f.race).b, need);
  if (l.age >= AWAKEN_AGE) l.flags.ftStarsSeen = true;
}
