// อันตราย (Release 9): ศึกใหญ่หลายจังหวะ แผลสดและแผลถาวร พิษ คำสาป โรค กระดานงาน ค่าหัว สัตว์คู่อาฆาต
// ปกป้องเมือง บทบาทในสงคราม ภัยที่มาหาถึงตัว ของที่เก็บได้ อาวุธหักกลางศึก ศึกกลางทะเลและบนหลังสัตว์ ความกลัว และทางของคนไม่จับอาวุธ
// กติกา: ตายยากและต้องสมควร (ส่วนใหญ่แค่เจ็บ) · ภัยที่บังคับเจอทุกเรื่องมีทางผ่านโดยไม่ต้องสู้เสมอ
import { ACTIVITIES, type Activity } from "../../engine/activities";
import { getEvent, type Choice, type Ctx, type GameEvent, type Scene } from "../../engine/events";
import { choiceHooks, kill, oddsHooks, runEvent, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, addStat, clamp, log, shortName } from "../../engine/util";
import { B, BIG, C, E, G, GOLD, K, N, P, PAY, SCENE, type Res } from "./kit";
import { canCast, combat, combatHooks, deathOdds, fightOdds, safetyHooks } from "./power";
import { addStanding, deed, fl, homeKingdom, kingdomsOf } from "./state";
import { lean, tr } from "./persona";
import { beastEdge, meet } from "./bestiary";
import { CONTRACT_THREAT, MONSTERS, reward } from "./places";
import { cityOf } from "./cities";
import { techsOf, weaponNoun } from "./styles";
import { craftRank } from "./power2";
import { ownedEstates } from "./economy";
import { stageAge } from "./folk";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
/** กิจกรรมที่ทำในปีที่เพิ่งผ่าน (doneThisYear ถูกล้างก่อน yearHooks) */
const didLastYear = (l: Life, id: string) => String(l.flags.lastActs ?? "").split("|").includes(`act:${id}`);
const atWar = (l: Life) => !!homeKingdom(l).war;
/** เปิดฉากต่อทันทีหลังฉากนี้ (ใช้ในผลของทางเลือกเท่านั้น: ฉากปัจจุบันจะถูกเอาออกหลังจบ) */
export function nextUp(l: Life, id: string, ctx: Ctx) {
  runEvent(l, id, ctx);
  const q = l.queue.pop();
  if (q) l.queue.splice(1, 0, q);
}
const after = (e: GameEvent, fn: (l: Life, c: Ctx) => void): GameEvent => ({ ...e, choices: e.choices?.map((ch) => ({ ...ch, run: (l, c, ok) => { fn(l, c); return ch.run(l, c, ok); } })) });

// ───────────── แผล ─────────────
export const WOUND_HP = 6;
/** แผลสดที่ไม่ได้รักษา มีโอกาสกลายเป็นแผลถาวรทุกปี */
export const WOUND_TURN = 0.25;
export const REST_HEAL = 0.6;
/** แผลหายแล้วได้สุขภาพคืนบ้าง */
export const WOUND_BACK = 4;
export type Injury = "eye" | "leg" | "hand" | "lung";
export const INJURIES: Record<Injury, { name: string; desc: string; combat: number }> = {
  eye: { name: "ตาบอดข้างหนึ่ง", desc: "เล็งพลาดง่าย ยิ่งใช้ธนูยิ่งเสียเปรียบ", combat: -4 },
  leg: { name: "ขาเจ็บถาวร", desc: "เดินกะเผลก หนีได้ช้าและเจ็บตัวกว่าคนอื่น", combat: -5 },
  hand: { name: "มือไหม้", desc: "งานช่างและงานปรุงยาได้ผลแค่ครึ่งเดียว", combat: -2 },
  lung: { name: "ปอดช้ำ", desc: "เหนื่อยง่าย หลังวัยสี่สิบสุขภาพลดลงทุกปี", combat: -2 },
};
export const CURE_PRICE = 80;
export const injuriesOf = (l: Life) => fl(l).injuries ?? [];
export const hasInjury = (l: Life, k: Injury) => injuriesOf(l).includes(k);
export function wound(l: Life) {
  if (!on(l) || !l.alive) return;
  const f = fl(l);
  if (f.wound === undefined) f.wound = l.age;
}
export function addInjury(l: Life, k?: Injury) {
  const f = fl(l), free = (Object.keys(INJURIES) as Injury[]).filter((x) => !hasInjury(l, x));
  if (!free.length) return;
  const got = k && free.includes(k) ? k : pick(l, free);
  f.injuries = [...injuriesOf(l), got];
  log(l, `แผลเก่าไม่หายดี คุณ${INJURIES[got].name} · ${INJURIES[got].desc} (เวทเยียวยาชั้นสูงช่วยได้)`, "bad");
}

// ───────────── พิษ คำสาป โรค ─────────────
export const AILMENTS: Record<"poison" | "curse" | "plague", { name: string; cure: string }> = {
  poison: { name: "พิษในเลือด", cure: "หมอรักษาหรือผู้รู้การรักษาขั้นชำนาญ" },
  curse: { name: "คำสาป", cure: "ขอพรที่วิหารหรือชำระบาป" },
  plague: { name: "ไข้ระบาด", cure: "หมอรักษา" },
};
/** หายเองได้บ้างทุกปี · เสียสุขภาพปีละ AIL_HP × ขั้น · สูงสุด AIL_MAX ขั้น */
export const AIL_FADE: Record<keyof typeof AILMENTS, number> = { poison: 0.3, curse: 0.1, plague: 0.35 };
export const AIL_HP = 1, AIL_MAX = 3;
export function afflict(l: Life, kind: keyof typeof AILMENTS) {
  const f = fl(l);
  if (f.ailment || !l.alive) return;
  f.ailment = { kind, stage: 1 };
  log(l, `${AILMENTS[kind].name}เริ่มกัดกินร่างกายคุณ มันจะทรุดลงทุกปีจนกว่าจะรักษา (${AILMENTS[kind].cure})`, "bad");
}

// ───────────── ความกล้า ความกลัว และคำปฏิญาณ ─────────────
/** ทางเลือกที่เป็นการต่อสู้จริง (ใช้พลังต่อสู้) · ทางเลือกที่ผ่านได้โดยไม่สู้ */
const FIGHTS = new WeakSet<Choice>();
/** ทางเลือกนี้เป็นการต่อสู้จริงไหม (ใช้กับอาวุธตำนานในฉากต่อสู้) */
export const isFight = (c: Choice) => FIGHTS.has(c) || (c.tone === "danger" && !!c.odds);
const PEACE = new WeakSet<Choice>();
export const FEAR_PENALTY = 0.06;
export const BOLD_EDGE = 0.03;
export const VOW_EDGE = 0.1;
const bold = (l: Life) => tr(l, "c") >= 25;
const cautious = (l: Life) => tr(l, "c") <= -25;
const markFight = (c: Choice) => { FIGHTS.add(c); return c; };
const markPeace = (c: Choice) => { PEACE.add(c); return c; };

// ───────────── ของที่เก็บได้ ─────────────
export const LOOT_CHANCE = 0.12;
function loot(l: Life): string {
  if (!chance(l, LOOT_CHANCE)) return "";
  const f = fl(l), roll = randInt(l, 0, 3);
  if (roll === 0 && (f.weapon?.quality ?? 0) < 3) { f.weapon = { name: `${weaponNoun(l)}ไร้ชื่อที่ยังคมกริบ`, quality: (f.weapon?.quality ?? 0) + 1 }; return ` ในกองกระดูกมี${weaponNoun(l)}เล่มหนึ่งที่ยังคมกริบ คุณเอามันมาใช้แทนของเดิม`; }
  if (roll === 1) { addStat(l, "luck", 2); addMoney(l, 10 * GOLD); l.flags.ftMapFound = true; return " คุณเจอแผนที่เก่าที่มีกากบาทแดง ขายให้นักสำรวจได้ 10 เหรียญทอง และเก็บสำเนาไว้เอง"; }
  if (roll === 2) { const g = randInt(l, 15, 40); addMoney(l, g * GOLD); return ` เขี้ยวของมันขายให้ร้านยาได้ ${g} เหรียญทอง`; }
  nextUp(l, "ft.dg.letter", {});
  return " ในย่ามของศพมีจดหมายผนึกครั่งที่ยังไม่มีใครเปิด";
}

// ───────────── ศึกใหญ่หลายจังหวะ ─────────────
const bump = (c: Ctx, d: number) => { c.edge = Number(c.edge ?? 0) + d; };
type Txt = string | ((l: Life, c: Ctx) => string);
const say = (t: Txt, l: Life, c: Ctx) => (typeof t === "string" ? t : t(l, c));
const go = (t: Txt, d: number | ((l: Life, c: Ctx) => number), next = "turn"): Res => (l, c) => { bump(c, typeof d === "number" ? d : d(l, c)); return { text: say(t, l, c), next }; };
/** สัตว์คู่ใจอื่นๆ ช่วยในจังหวะกลางของศึกได้ (creatures.ts) · แพ้แล้วสัตว์ที่ช่วยอาจเจ็บ */
export const allyHooks: ((l: Life, c: Ctx) => string | undefined)[] = [];
export const allyLossHooks: ((l: Life, c: Ctx) => string)[] = [];
const allyName = (l: Life, c: Ctx) => {
  if (c.crew) return "ลูกเรือ";
  const extra = allyHooks.map((h) => h(l, c)).find(Boolean);
  if (extra) return extra;
  const f = fl(l);
  if (c.mounted && f.mount) return f.mount === "whelp" ? f.whelp?.name ?? "มังกรของคุณ" : "มังกรของคุณ";
  if (f.pet?.kind === "wolf") return f.pet.name;
  const party = l.people.find((p) => p.alive && p.tags?.some((t) => t.startsWith("party:")));
  return party ? shortName(party) : "";
};
interface Beat {
  id: string; title: string; ages: [number, number];
  intro: Txt; foe: Txt; threat: (l: Life, c: Ctx) => number;
  win: Res; lose: Res;
  /** หนีได้ (มีราคา) · ไม่ใส่ = หนีไม่ได้ เช่น ถูกซุ่ม ถูกล้อมเมือง */
  flee?: [string, Res];
  /** ทางผ่านโดยไม่ต้องสู้ (ซ่อน จ่าย เจรจา) */
  peace: Choice[];
  when?: (l: Life) => boolean; weight?: number | ((l: Life) => number); forced?: boolean; maxTimes?: number; manual?: boolean; prepare?: (l: Life) => Ctx;
}
/** ศึกใหญ่ 3 จังหวะ: เปิดฉาก → จังหวะพลิก (ท่า เวท ยา พวก ไหวพริบ) → ปิดฉาก */
function beat(o: Beat): GameEvent {
  const threat = o.threat;
  const final = (l: Life, c: Ctx) => clamp(fightOdds(l, threat(l, c)) + Number(c.edge ?? 0), 0.04, 0.96);
  const deathFrac = (l: Life, c: Ctx) => deathOdds(l, threat(l, c)) * (c.guard ? 0.5 : 1) * (threat(l, c) - combat(l) > 20 ? 1.8 : 0.6);
  const lose: Res = (l, c) => {
    // ยาคืนชีพช่วยให้รอด แล้วเรื่องเดินต่อเหมือนแพ้ธรรมดา
    if (chance(l, deathFrac(l, c))) { kill(l, `ตายในศึก${o.title}`); if (!l.alive) return { text: "ครั้งนี้คุณลุกขึ้นมาไม่ได้อีก", kind: "bad" }; }
    const f = fl(l);
    addStat(l, "health", -randInt(l, 8, 14)); f.fear = true;
    let extra = "";
    if (f.weapon && chance(l, 0.25)) { nextUp(l, "ft.dg.broken", { w: f.weapon.name }); extra = ` ${f.weapon.name}หักกลางการต่อสู้`; }
    if (c.allyUsed) extra += allyLossHooks.map((h) => h(l, c)).join("");
    const out = o.lose(l, c);
    return { ...out, text: out.text + extra + " · ความพ่ายแพ้ครั้งนี้ทิ้งความกลัวไว้ในใจ", kind: "bad" };
  };
  const win: Res = (l, c) => { const f = fl(l); const was = f.fear; f.fear = false; const out = o.win(l, c); return { ...out, text: out.text + (was ? " · ความกลัวที่ติดตัวมานานหายไปแล้ว" : "") + loot(l) }; };
  const opening: Choice[] = [
    C("บุกเข้าใส่ทันที", go("คุณพุ่งเข้าหาก่อนที่มันจะตั้งตัว", (l) => 0.03 + (bold(l) ? BOLD_EDGE : 0))),
    C("ตั้งรับดูเชิง", (l, c) => { c.guard = true; return go("คุณถอยครึ่งก้าว รอดูว่ามันจะมาทางไหน", 0.02)(l, c); }),
    K("ใช้ภูมิประเทศหลอกล่อ", "luck", 50, go("คุณล่อมันเข้าที่แคบ มันเสียจังหวะ", 0.08), go("พื้นใต้เท้าคุณลื่นกว่าที่คิด", -0.04)),
    ...o.peace.map(markPeace),
  ];
  const turn: Choice[] = [
    C((l) => `ใช้ท่าไม้ตาย「${techsOf(l).at(-1)}」`, go((l) => `「${techsOf(l).at(-1)}」ของคุณเปิดช่องโหว่ให้เห็น`, (l) => 0.08 + (fl(l).myTech ? 0.04 : 0), "end"), { show: (l) => techsOf(l).length > 0 }),
    C("ร่ายเวทใส่", go("เวทของคุณทำให้มันชะงักไปครู่หนึ่ง", (l, c) => 0.06 + (c.weak && fl(l).element === c.weak ? 0.06 : 0), "end"), { show: (l) => canCast(l) }),
    C("ดื่มยาเพิ่มพลัง", (l, c) => { fl(l).potions!.strength!--; return go("ยาร้อนวูบไปทั่วร่าง แขนคุณหนักแน่นขึ้น", 0.1, "end")(l, c); }, { show: (l) => (fl(l).potions?.strength ?? 0) > 0 }),
    C((l, c) => `ให้${allyName(l, c)}ช่วย`, (l, c) => { c.allyUsed = allyName(l, c); return go(`${allyName(l, c)}เข้ามาประกบอีกด้าน`, 0.06 + (c.mounted && fl(l).whelp ? fl(l).whelp!.bond / 1000 : 0), "end")(l, c); }, { show: (l, c) => !!allyName(l, c) }),
    K("มองหาจุดอ่อน", "smarts", 50, go("คุณเห็นจุดที่มันระวังน้อยที่สุด", (l, c) => 0.08 + beastEdge(l, String(c.foe ?? "")), "end"), go("คุณมองนานเกินไปจนโดนเข้าเต็มแรง", -0.04, "end")),
    C("สู้ต่อด้วยแรงที่มี", go("คุณกัดฟันสู้ต่อ", 0, "end")),
  ];
  const end: Choice[] = [
    markFight(P("ปิดฉาก", final, win, lose, { tone: "danger", survival: (l, c) => 1 - (1 - final(l, c)) * deathFrac(l, c) })),
    ...(o.flee ? [C(o.flee[0], (l, c) => { if (hasInjury(l, "leg")) addStat(l, "health", -6); return o.flee![1](l, c); })] : []),
  ];
  const scenes: Record<string, Scene> = {
    turn: { title: o.title, text: (l, c) => `${say(o.foe, l, c)} · จังหวะต่อไปคุณจะใช้อะไร`, choices: turn },
    end: { title: o.title, text: (l) => `ถึงจังหวะตัดสินแล้ว${hasInjury(l, "leg") && o.flee ? " (ขาที่เจ็บทำให้หนีลำบาก)" : ""}`, choices: end },
  };
  const ev = o.manual ? SCENE(o.id, o.title, o.intro, opening) : E(o.id, o.ages, o.intro, opening, { title: o.title, when: o.when, weight: o.weight, forced: o.forced, maxTimes: o.maxTimes, prepare: o.prepare });
  return { ...ev, scenes };
}

// ───────────── สัตว์คู่อาฆาต ─────────────
const MARKS = ["ตาข้างเดียว", "แผลเป็นรูปดาว", "ขนสีเงิน", "เขาหัก", "หางขาด"];
export const NEMESIS_GAP = 6;
export const NEMESIS_GROW = 6;
export const NEMESIS_CHANCE = 0.35;
function maybeNemesis(l: Life, beast: string, threat: number) {
  const f = fl(l);
  if (f.nemesis || !l.alive || !chance(l, NEMESIS_CHANCE)) return "";
  f.nemesis = { name: `${beast}${pick(l, MARKS)}`, power: threat + 6, met: 1, last: l.age };
  return ` มันหันมามองคุณก่อนหายเข้าไปในความมืด มันจำกลิ่นคุณได้ และคุณก็จำมันได้ (${f.nemesis.name})`;
}
const nem = (l: Life) => fl(l).nemesis!;
const NEMESIS = beat({
  id: "ft.dg.nemesis", title: "คู่อาฆาต", ages: [10, 900],
  intro: (l) => `${nem(l).name}กลับมาอีกแล้ว ใหญ่กว่าครั้งก่อน และมันรู้ว่าบ้านคุณอยู่ที่ไหน (พบกันครั้งที่ ${nem(l).met + 1})`,
  foe: (l) => `${nem(l).name}คำรามจนกระจกหน้าต่างสั่น`,
  threat: (l) => nem(l).power,
  win: BIG((l) => `${nem(l).name}ล้มลงตรงหน้าคุณ หลังเจอกันมา ${nem(l).met + 1} ครั้ง เรื่องนี้จบแล้ว`, { fame: 8, joy: 10 }, (l) => { const n = nem(l); n.dead = true; n.met++; n.last = l.age; deed(l, `ล้ม${n.name}`); fl(l).trophies = [...(fl(l).trophies ?? []), `เขี้ยวของ${n.name}`]; }),
  lose: B((l) => `${nem(l).name}ทิ้งรอยเล็บไว้บนตัวคุณแล้วหายไป มันจะกลับมาอีก`, {}, (l) => { const n = nem(l); n.power += NEMESIS_GROW; n.met++; n.last = l.age; wound(l); }),
  flee: ["ถอยหนี ปล่อยให้มันอาละวาดในทุ่ง", B((l) => `คุณรอดมาได้ แต่${nem(l).name}กินฝูงสัตว์ของหมู่บ้านไปครึ่งหนึ่ง`, { fame: -2 }, (l) => { const n = nem(l); n.power += 4; n.met++; n.last = l.age; })],
  peace: [C("ซ่อนตัวในเมืองจนมันไป", N((l) => `คุณปิดประตูลงกลอน ${nem(l).name}วนรอบกำแพงสามคืนแล้วจากไป มันยังไม่ลืม`, { joy: -3 }, (l) => { const n = nem(l); n.power += 4; n.last = l.age; }))],
  when: (l) => on(l) && !!fl(l).nemesis && !fl(l).nemesis!.dead && l.age - fl(l).nemesis!.last >= NEMESIS_GAP,
  weight: 40, forced: true, maxTimes: 0,
});

// ───────────── กระดานงาน (3 งานต่อปี) ─────────────
const CLIENTS = ["เจ้าของโรงสีม่าย", "นักบวชแห่งวิหารอรุณ", "ลอร์ดชายแดน", "สมาคมพ่อค้าเกลือ", "นักปราชญ์ตาบอด", "หัวหน้าหมู่บ้านริมป่า", "เจ้าของเรือสินค้า", "ช่างตีเหล็กหลวง"];
/** twist: ความจริงที่ลูกค้าไม่ได้บอก (เฉพาะงานที่ตามหาคน) */
const TASKS: { t: string; d: number; beast?: string; twist?: string }[] = [
  { t: "ตามหาเด็กที่หายเข้าป่า", d: -4, beast: "หมาป่าเขาเดียว", twist: "เด็กคนนั้นไม่ได้หลงป่า เขาหนีออกจากบ้านเพราะถูกตีทุกวัน และขอร้องไม่ให้คุณพากลับ" }, { t: "คุ้มกันเกวียนเกลือข้ามช่องเขา", d: 0 },
  { t: "ไล่โทรลออกจากใต้สะพาน", d: 4, beast: "โทรลใต้สะพาน" }, { t: "เอาแหวนตระกูลคืนจากหัวขโมย", d: -2, twist: "หัวขโมยคือคนหนีหนี้ที่หิวโซ แหวนวงนั้นเคยเป็นของแม่เขาก่อนถูกยึดไปใช้หนี้" },
  { t: "สำรวจเหมืองร้างที่มีเสียงร้อง", d: 6, beast: "โกเลมศิลา" }, { t: "ส่งจดหมายข้ามแนวรบ", d: 2 },
  { t: "กำจัดไคเมร่าที่กินฝูงแกะ", d: 10, beast: "ไคเมร่าสามหัว" },
];
const BIG_TASKS = ["คุ้มกันลูกชายคนเดียวของตระกูลไปเมืองหลวง", "ทวงคืนคลังสินค้าที่ถูกยึด", "ปิดปากถ้ำที่สัตว์อสูรออกมาทุกคืน"];
export const BOARD_SIZE = 3;
const guildThreat = (l: Life) => CONTRACT_THREAT[Math.max(1, fl(l).guild)];
const trustOf = (l: Life, cl: string) => fl(l).clients?.[cl] ?? 0;
const jobThreat = (l: Life, c: Ctx, i: number) => guildThreat(l) + TASKS[Number(c[`t${i}`])].d + (Number(c[`x${i}`]) === 1 ? 10 : 0);
/** งานอันตรายกว่าจ่ายมากกว่า */
const jobPay = (l: Life, c: Ctx, i: number) => Math.round((10 + fl(l).guild * 18 + TASKS[Number(c[`t${i}`])].d * 2) * (Number(c[`x${i}`]) === 1 ? 2 : 1) * (trustOf(l, CLIENTS[Number(c[`c${i}`])]) >= 2 ? 1.3 : 1));
function hurtJob(l: Life, threat: number, beast: string | undefined, text: string): ReturnType<Res> {
  if (chance(l, deathOdds(l, threat) * 0.5)) return B("ป้ายกิลด์ของคุณถูกส่งกลับบ้าน", { die: "ตายระหว่างรับงานกิลด์" })(l, {});
  addStat(l, "health", -12);
  return { text: text + (beast ? maybeNemesis(l, beast, threat) : ""), kind: "bad" };
}
const boardJob = (i: number): Choice => markFight(P(
  (l, c) => { const cl = CLIENTS[Number(c[`c${i}`])]; return `${cl}: ${TASKS[Number(c[`t${i}`])].t} · ${jobPay(l, c, i)} เหรียญทอง${trustOf(l, cl) >= 2 ? " · ลูกค้าประจำ" : ""}`; },
  (l, c) => fightOdds(l, jobThreat(l, c, i)) + (TASKS[Number(c[`t${i}`])].beast ? beastEdge(l, TASKS[Number(c[`t${i}`])].beast!) : 0),
  (l, c) => {
    const cl = CLIENTS[Number(c[`c${i}`])], task = TASKS[Number(c[`t${i}`])], tw = Number(c[`x${i}`]);
    if (task.beast) meet(l, task.beast);
    const f = fl(l);
    reward(l, jobPay(l, c, i) / (10 + f.guild * 18));
    f.clients = { ...f.clients, [cl]: trustOf(l, cl) + 1 };
    if (tw === 2 && task.twist) { nextUp(l, "ft.dg.twist", { cl: Number(c[`c${i}`]), t: Number(c[`t${i}`]), half: Math.round(jobPay(l, c, i) / 2) }); return { text: `งานเสร็จ แต่เรื่องไม่ได้เป็นอย่างที่${cl}เล่า`, kind: "good" }; }
    if (trustOf(l, cl) >= 2 && chance(l, 0.5)) nextUp(l, "ft.dg.bigjob", { cl: Number(c[`c${i}`]), step: 1 });
    return { text: `${tw === 1 ? `${cl}โกหกเรื่องความอันตราย แต่คุณทำสำเร็จและได้ค่าจ้างสองเท่า ` : ""}${cl}จ่ายเงินครบและจำชื่อคุณไว้${loot(l)}`, kind: "good" };
  },
  (l, c) => { const task = TASKS[Number(c[`t${i}`])]; if (task.beast) meet(l, task.beast); return hurtJob(l, jobThreat(l, c, i), task.beast, Number(c[`x${i}`]) === 1 ? "งานนี้อันตรายกว่าที่ลูกค้าบอกมาก คุณหนีกลับมาพร้อมแผล" : "งานพลาด คุณกลับมาพร้อมแผลและมือเปล่า"); },
));
const BOARD = SCENE("ft.dg.board", "กระดานงาน", (l) => `กระดานงานของกิลด์ปีนี้มีประกาศสามใบที่ตรงกับขั้นของคุณ${hasInjury(l, "eye") ? " (ตาข้างที่เสียทำให้คุณต้องเอียงคอเพื่ออ่าน)" : ""}`, [
  ...Array.from({ length: BOARD_SIZE }, (_, i) => boardJob(i)),
  C("ปีนี้ไม่รับงาน", N("คุณมองกระดานนานแล้วเดินออกไป")),
]);
const TWIST = SCENE("ft.dg.twist", "ความจริงหลังงาน", (_l, c) => `ระหว่างทางกลับ คุณรู้ความจริงที่${CLIENTS[Number(c.cl)]}ไม่ได้บอก: ${TASKS[Number(c.t)]?.twist ?? "คนที่คุณตามมาไม่ใช่คนร้ายอย่างที่ประกาศบอก"}`, [
  C("ส่งตัวตามสัญญา", N("คุณทำตามที่รับปากไว้ เขามองคุณตอนถูกพาตัวไป", {}, (l) => lean(l, { m: -4 }))),
  C((_l, c) => `ปล่อยไปแล้วคืนค่าจ้างครึ่งหนึ่ง (${Number(c.half ?? 10)} เหรียญทอง)`, G("เขาร้องไห้ขอบคุณ คุณเสียเงินแต่หลับสบาย", { joy: 3 }, (l, c) => { addMoney(l, -Number(c.half ?? 10) * GOLD); lean(l, { m: 5 }); })),
]);
const BIGJOB = SCENE("ft.dg.bigjob", "งานที่ใหญ่กว่า", (_l, c) => `${CLIENTS[Number(c.cl)]}ไว้ใจคุณแล้ว จึงยื่นงานที่ใหญ่กว่าให้: ${BIG_TASKS[Number(c.step) - 1]}`, [
  markFight(P((l, c) => `รับงาน · ${Math.round((10 + fl(l).guild * 18) * (1.5 + Number(c.step) * 0.5))} เหรียญทอง`, (l, c) => fightOdds(l, guildThreat(l) + 8 * Number(c.step)),
    (l, c) => {
      const cl = CLIENTS[Number(c.cl)], step = Number(c.step), f = fl(l);
      reward(l, 1.5 + step * 0.5); f.clients = { ...f.clients, [cl]: trustOf(l, cl) + 1 };
      if (step < BIG_TASKS.length) { nextUp(l, "ft.dg.bigjob", { cl: Number(c.cl), step: step + 1 }); return { text: `${cl}ยิ้มกว้าง "ข้ามีอีกเรื่องหนึ่งที่ไว้ใจใครไม่ได้"`, kind: "good" }; }
      deed(l, `คนสนิทของ${cl}`); addStanding(l, 4);
      return { text: `${cl}ประกาศต่อหน้าทุกคนว่าคุณคือคนที่ไว้ใจที่สุด`, kind: "milestone" };
    },
    (l, c) => hurtJob(l, guildThreat(l) + 8 * Number(c.step), undefined, "งานใหญ่เกินตัวไปก้าวหนึ่ง คุณถูกหามกลับมา"))),
  C("ปฏิเสธอย่างสุภาพ", N("คุณบอกว่าพอแค่นี้ก่อน ลูกค้าพยักหน้าเข้าใจ")),
]);

// ───────────── ค่าหัว ─────────────
const OUTLAWS = ["ไรค์ ผู้หัวเราะ", "แม่มดเฮเซล", "เบรน ฟันทอง", "โจรป่าดอร์ม", "นักต้มตุ๋นลีโอ", "คาร์ ผู้ไม่มีเงา"];
const CRIMES = ["ปล้นกองคาราวาน", "วางเพลิงยุ้งฉาง", "ฆ่าทหารยาม", "ขโมยของในวิหาร"];
const GANGS = ["งูดำ", "มือเหล็ก", "หมาป่าแดง"];
const bountyThreat = (l: Life) => guildThreat(l) + 6;
const bountyPay = (l: Life) => 20 + fl(l).guild * 12;
const BOUNTY = SCENE("ft.dg.bounty", "ใบประกาศจับ", (l, c) => `ใบประกาศจับ: ${OUTLAWS[Number(c.n)]} ข้อหา${CRIMES[Number(c.cr)]} · ค่าหัว ${bountyPay(l)} เหรียญทอง`, [
  markFight(P("ตามล่าและจับตัว", (l) => fightOdds(l, bountyThreat(l)), (l, c) => {
    if (c.inn) { nextUp(l, "ft.dg.innocent", { n: c.n }); return { text: `คุณจับ${OUTLAWS[Number(c.n)]}ได้ แต่สิ่งที่เขาพูดทำให้คุณลังเล`, kind: "good" }; }
    addMoney(l, bountyPay(l) * GOLD); addStanding(l, 1);
    if (chance(l, 0.3)) l.flags.ftRevengeAt = l.age + randInt(l, 2, 5), l.flags.ftRevengeN = Number(c.n);
    if (c.gang !== undefined) { nextUp(l, "ft.dg.gang", { g: c.gang }); return { text: `คุณได้ค่าหัว ${bountyPay(l)} เหรียญทอง และเจอตราแก๊งในย่ามของเขา`, kind: "good" }; }
    return { text: `คุณได้ค่าหัว ${bountyPay(l)} เหรียญทอง${loot(l)}`, kind: "good" };
  }, (l) => hurtJob(l, bountyThreat(l), undefined, "เขาไวกว่าที่ใบประกาศบอก คุณได้แผลแทนค่าหัว"))),
  markPeace(K("ตามสืบก่อนลงมือ", "smarts", 50, (l, c) => {
    if (c.inn) { nextUp(l, "ft.dg.innocent", { n: c.n }); return { text: "ยิ่งสืบ เรื่องยิ่งไม่ตรงกับใบประกาศ" }; }
    addMoney(l, Math.round(bountyPay(l) * 0.9) * GOLD);
    return { text: `คุณรู้ว่าเขานอนที่ไหน และจับตัวได้โดยไม่ต้องชักอาวุธ ได้ค่าหัว ${Math.round(bountyPay(l) * 0.9)} เหรียญทอง`, kind: "good" };
  }, N("ร่องรอยหายไปที่ริมแม่น้ำ คุณกลับมามือเปล่า"))),
  C("ไม่รับงานนี้", N("คุณดึงหมุดออกแล้วติดใบประกาศคืนที่เดิม")),
]);
const INNOCENT = SCENE("ft.dg.innocent", "เขาไม่ได้ทำ", (_l, c) => `${OUTLAWS[Number(c.n)]}สาบานว่าไม่ได้ทำ คนที่ตั้งค่าหัวคือเจ้าหนี้ที่อยากปิดปากเขา และหลักฐานก็ชี้ไปทางนั้นจริง`, [
  C("ส่งตัวอยู่ดี งานคืองาน", N((l) => `คุณรับค่าหัว ${bountyPay(l)} เหรียญทอง และไม่มองหน้าเขาอีก`, {}, (l) => { addMoney(l, bountyPay(l) * GOLD); lean(l, { m: -6 }); })),
  K("ปล่อยไปแล้วบอกความจริงกับกิลด์", "looks", 45, G("กิลด์ถอนประกาศ และเจ้าหนี้คนนั้นถูกสอบสวนแทน", { fame: 2 }, (l) => lean(l, { m: 5, h: 3 })), B("กิลด์ไม่เชื่อ และหักแต้มคุณที่ปล่อยเป้าหมาย", {}, (l) => { addStanding(l, -3); lean(l, { m: 5 }); })),
  C("รับเงินจากเขาแล้วปล่อยไป", N("เขาให้ทุกอย่างที่มีแล้วหายไปในความมืด", { gold: 8 }, (l) => lean(l, { h: -4 }))),
]);
const GANG = SCENE("ft.dg.gang", "แก๊งเบื้องหลัง", (_l, c) => `ตราที่เจอเป็นของแก๊ง${GANGS[Number(c.g)]} ค่าหัวนั้นเป็นแค่ปลายเชือก`, [
  markFight(P("บุกรังแก๊ง", (l) => fightOdds(l, bountyThreat(l) + 12), (l, c) => { addMoney(l, (40 + fl(l).guild * 15) * GOLD); deed(l, `ทลายแก๊ง${GANGS[Number(c.g)]}`); addStanding(l, 5); return { text: `แก๊ง${GANGS[Number(c.g)]}แตกพ่าย คุณได้ทั้งเงินรางวัลและชื่อเสียง${loot(l)}`, kind: "milestone" }; }, (l) => hurtJob(l, bountyThreat(l) + 12, undefined, "รังของพวกมันมีคนมากกว่าที่คิด คุณหนีออกมาทางท่อน้ำ"))),
  markPeace(C("ส่งตราให้ทหารยาม", G("ทหารยามขอบคุณและให้เงินรางวัลเล็กน้อย", { gold: 8 }, (l) => addStanding(l, 2)))),
  C("ทำเป็นไม่เห็น", N("คุณเผาตรานั้นทิ้งในเตาผิง")),
]);
const REVENGE = after(E("ft.dg.revenge", [14, 900], (l) => `เพื่อนของ${OUTLAWS[Number(l.flags.ftRevengeN ?? 0)]}ที่คุณส่งตัวไปรอคุณอยู่ในตรอกมืด พวกเขาไม่ลืม`, [
  markFight(P("สู้ในตรอก", (l) => fightOdds(l, bountyThreat(l)), G("พวกเขาหนีไปพร้อมรอยฟกช้ำ และจะไม่กลับมาอีก", { fame: 2 }), B("พวกเขาทิ้งคุณไว้ในตรอกพร้อมแผล", { hp: -10 }))),
  markPeace(K("อธิบายว่าเขาทำผิดจริง", "looks", 55, G("คนที่โตที่สุดลดมีดลงก่อน", { joy: 2 }), B("พวกเขาไม่ฟัง", { hp: -8 }))),
  markPeace(PAY("จ่ายค่าทำขวัญให้ครอบครัวเขา", 20, N("พวกเขารับเงินแล้วเดินจากไป เรื่องจบแค่นี้"))),
], { title: "คนที่ไม่ลืม", forced: true, maxTimes: 0, when: (l) => on(l) && l.flags.ftRevengeAt !== undefined && l.age >= Number(l.flags.ftRevengeAt) }), (l) => { delete l.flags.ftRevengeAt; });

// ───────────── ของที่เก็บได้ · อาวุธหัก · จดหมายผนึก ─────────────
const LETTER = SCENE("ft.dg.letter", "จดหมายผนึก", "จดหมายผนึกครั่งตราขุนนาง ลายมือข้างหน้าเขียนว่า \"ถึงมือท่านเท่านั้น\"", [
  C("นำไปส่งเจ้าของตรา", G("ขุนนางคนนั้นเปิดอ่านแล้วหน้าซีด เขาจ่ายค่าส่งให้คุณมากเกินไป", { gold: 15, fame: 2 }, (l) => addStanding(l, 2))),
  K("แกะอ่านก่อน", "smarts", 45, G("ข้างในเป็นแผนชิงบัลลังก์ คุณจำทุกชื่อได้ และเก็บไว้ในใจ", { iq: 2 }, (l) => { l.flags.ftCourtSecret = true; }), B("ครั่งแตกเป็นเสี่ยง ไม่มีใครรับจดหมายที่ถูกเปิดแล้ว", {}, (l) => addStanding(l, -2))),
  C("ขายให้คนที่ให้ราคาสูงสุด", N("พ่อค้าข่าวลือจ่ายคุณโดยไม่ถามอะไร", { gold: 30 }, (l) => lean(l, { h: -4 }))),
]);
const BROKEN = SCENE("ft.dg.broken", "อาวุธที่หัก", (_l, c) => `${c.w}หักเป็นสองท่อนตรงหน้าคุณ เศษเหล็กยังอุ่นอยู่ในมือ`, [
  C((l) => (craftRank(l, "smith") >= 2 ? "ตีใหม่เองจากเศษเดิม" : `ให้ช่างตีใหม่ให้แข็งกว่าเดิม (30 เหรียญทอง)`), (l, c) => {
    const f = fl(l), free = craftRank(l, "smith") >= 2;
    if (!free) addMoney(l, -30 * GOLD);
    f.weapon = { name: `${weaponNoun(l)}ที่ตีใหม่จากเศษ${c.w}`, quality: Math.min(5, (f.weapon?.quality ?? 0) + 1), named: true, kills: f.weapon?.kills };
    return { text: "เหล็กที่เคยหักกลับแข็งกว่าเดิม และมันมีเรื่องเล่าแล้ว", kind: "good" };
  }, { req: (l) => (craftRank(l, "smith") < 2 && l.money < 30 * GOLD ? "ต้องมี 30 เหรียญทอง" : undefined) }),
  C("เก็บเศษไว้เป็นที่ระลึก", N("คุณห่อเศษเหล็กด้วยผ้าแล้ววางไว้บนหิ้ง", { joy: -3 }, (l) => { fl(l).weapon = undefined; })),
  C("ขายเศษเหล็ก", N("ช่างให้ราคาเศษเหล็กตามน้ำหนัก ไม่ใช่ตามเรื่องที่มันผ่านมา", { gold: 3 }, (l) => { fl(l).weapon = undefined; })),
]);

// ───────────── รักษาแผลถาวร ─────────────
const CURE = SCENE("ft.dg.cure", "รักษาแผลเก่า", (l) => `นักบวชชั้นสูงในวิหารใหญ่ดูแผลของคุณ: ${injuriesOf(l).map((k) => INJURIES[k].name).join(" · ")}`, [
  PAY("ขอเวทเยียวยาชั้นสูง", CURE_PRICE, G((l) => `แสงอุ่นไหลผ่านแผลเก่า ${INJURIES[injuriesOf(l)[0]].name}ของคุณค่อยๆ หายไป`, { joy: 8 }, (l) => { fl(l).injuries = injuriesOf(l).slice(1); })),
  C("รักษาตัวเองด้วยวิชาที่มี", G("คุณใช้ทุกอย่างที่เรียนมากับแผลของตัวเอง และมันได้ผล", { joy: 6 }, (l) => { fl(l).injuries = injuriesOf(l).slice(1); }), { show: (l) => craftRank(l, "healing") >= 5 }),
  C("อยู่กับมันต่อไป", N("คุณขอบคุณนักบวชแล้วกลับบ้าน แผลนี้เป็นส่วนหนึ่งของคุณแล้ว", { joy: 1 })),
]);

// ───────────── สงคราม: เลือกบทบาท ─────────────
const warPower = (l: Life, d: number) => { const k = homeKingdom(l); k.power = clamp(k.power + d, 0, 100); const foe = kingdomsOf(l).find((x) => x.id === k.war); if (foe) foe.power = clamp(foe.power - d, 0, 100); };
const WAR_ROLES: Choice[] = [
  markFight(P("เป็นนายกอง", (l) => fightOdds(l, 36), BIG("กองของคุณยึดเนินสำคัญไว้ได้ ชื่อคุณอยู่ในรายงานถึงราชสำนัก", { fame: 10, gold: 30 }, (l) => { warPower(l, 4); deed(l, `นายกองผู้ยึดเนินในสงครามของ${homeKingdom(l).name}`); }), B("กองของคุณแตก คุณพาคนที่เหลือถอยกลับมาได้ครึ่งหนึ่ง", { hp: -14, fame: -2 }, (l) => { warPower(l, -2); wound(l); }), { show: (l) => fl(l).bodyRank >= 2 || l.fame >= 30 })),
  markPeace(K("เป็นหมอสนาม", "smarts", 45, G("คุณเย็บแผลจนมือสั่น ทหารหลายร้อยคนได้กลับบ้านเพราะคุณ", { fame: 5 }, (l) => { warPower(l, 2); addStanding(l, 3); lean(l, { m: 4 }); }), B("ไข้ในค่ายระบาดถึงตัวคุณ", { hp: -8 }, (l) => afflict(l, "plague")))),
  K("เป็นสายลับหลังแนวข้าศึก", "luck", 55, G("แผนที่ค่ายข้าศึกที่คุณขโมยมาพลิกสงคราม", { fame: 4, gold: 30 }, (l) => warPower(l, 6)), (l, c) => (chance(l, 0.15) ? B("คุณถูกจับได้ และไม่มีใครรู้ว่าศพอยู่ที่ไหน", { die: "ถูกจับได้ขณะเป็นสายลับ" })(l, c) : B("คุณถูกจับได้ แต่หนีออกมาได้พร้อมรอยแส้", { hp: -15 })(l, c))),
  PAY("ส่งเสบียงให้กองทัพ", 40, (l, c) => (chance(l, 0.6) ? G("กองทัพจ่ายคืนเกือบสองเท่าหลังศึกจบ", { gold: 75 }, (l) => warPower(l, 3))(l, c) : B("เกวียนเสบียงถูกปล้นกลางทาง", { joy: -4 })(l, c))),
  C("ไปรบ แล้วหนีทัพกลางทาง", N("คุณทิ้งหอกไว้ในป่าแล้วเดินกลับบ้านตอนกลางคืน ชื่อคุณอยู่ในบัญชีคนหนีทัพ", { fame: -6 }, (l) => { l.flags.ftDeserter = true; lean(l, { c: -6 }); })),
];

// ───────────── ปกป้องเมือง ─────────────
const homeHit = (l: Life) => { const h = Number(l.flags.ftHome ?? 0); if (h > 0) l.flags.ftHome = h - 1; const es = ownedEstates(l); if (es.length && chance(l, 0.5)) { const f = fl(l); const id = pick(l, es); const { [id]: _gone, ...rest } = f.estates ?? {}; f.estates = rest; return " บ้านคุณเสียหายและทรัพย์สินชิ้นหนึ่งถูกเผา"; } return h > 0 ? " บ้านคุณเสียหายหนักจนต้องย้ายไปอยู่ที่เล็กลง" : ""; };
const SIEGE = E("ft.dg.siege", [15, 900], (l) => `กองทัพข้าศึกล้อม${cityOf(l).name}ไว้ทุกด้าน ควันไฟขึ้นจากประตูเมืองฝั่งตะวันออก`, [
  markFight(P("ขึ้นกำแพงสู้", (l) => fightOdds(l, 32), G("ข้าศึกถอยไปในวันที่สาม และคนทั้งเมืองจำหน้าคนบนกำแพงได้", { fame: 4 }, (l) => { const k = homeKingdom(l); k.stability = clamp(k.stability + 5, 0, 100); warPower(l, 2); addStanding(l, 3); }), (l, c) => (chance(l, deathOdds(l, 32) * 0.5) ? B("ลูกธนูดอกหนึ่งหาคุณเจอบนกำแพง", { die: "ตายบนกำแพงเมือง" })(l, c) : B((l) => `กำแพงฝั่งของคุณแตก${homeHit(l)}`, { hp: -14 }, (l) => wound(l))(l, c)))),
  markFight(P("นำกองอาสาของเมือง", (l) => fightOdds(l, 40), BIG((l) => `กองอาสาที่คุณนำตีข้าศึกแตกตอนรุ่งสาง ${cityOf(l).name}รอดเพราะคุณ`, { fame: 8 }, (l) => { warPower(l, 4); deed(l, `ผู้ปกป้อง${cityOf(l).name}`); }), B((l) => `กองอาสาแตกกระเจิง${homeHit(l)}`, { hp: -16, fame: -2 }, (l) => wound(l)), { show: (l) => l.fame >= 20 || fl(l).bodyRank >= 2 })),
  markPeace(C("พาครอบครัวหนีไปที่ปลอดภัย", N((l) => `ทุกคนในบ้านรอดมาได้ แต่บ้านที่ทิ้งไว้ไม่เหลือเหมือนเดิม${homeHit(l)}`, {}, (l) => { for (const p of l.people) if (p.alive && ["spouse", "child", "mother", "father", "sibling"].includes(p.relation)) p.bond = clamp(p.bond + 5, 0, 100); }))),
  markPeace(PAY("ติดสินบนให้ข้าศึกเว้นย่านของคุณ", 40, N("ย่านของคุณรอด คนในย่านอื่นมองคุณไม่เหมือนเดิม", { fame: -3 }))),
  markPeace(C("หนีเอาตัวรอดคนเดียว", B((l) => `คุณรอดมาได้ แต่ไม่มีใครลืมว่าคุณทิ้งเมือง${homeHit(l)}`, { fame: -6, joy: -6 }, (l) => lean(l, { c: -5 })))),
], { title: "เมืองถูกล้อม", when: (l) => on(l) && atWar(l), weight: 10, maxTimes: 2 });

// ───────────── ภัยที่มาหาถึงตัว ─────────────
const vowCut = (base: number) => (l: Life) => (on(l) ? base * (fl(l).peaceVow ? 0.5 : 1) : 0);
const ROAD = E("ft.dg.road", [14, 900], "โจรห้าคนขวางทางเกวียนกลางป่า หัวหน้ายิ้มเห็นฟันทอง \"ของทุกอย่างวางลง แล้วเดินต่อไปได้\"", [
  markFight(P("ชักอาวุธสู้", (l) => fightOdds(l, 14), G("โจรที่เหลือวิ่งหนีเข้าป่าไปคนละทาง", { fame: 1 }), B("พวกมันมากกว่าที่คิด คุณรอดมาพร้อมแผลและกระเป๋าเบาลง", { hp: -7, gold: -5 }))),
  markPeace(PAY("จ่ายค่าผ่านทาง", 8, N("หัวหน้าโจรนับเหรียญแล้วหลีกทางให้"))),
  markPeace(K("พูดให้พวกมันเปลี่ยนใจ", "looks", 50, G("หัวหน้าโจรหัวเราะแล้วปล่อยคุณไป \"คนพูดเก่งแบบนี้ปล้นไปก็เสียดาย\"", { joy: 2 }), B("พวกมันไม่ฟัง และเอาไปมากกว่าที่ขอ", { gold: -8 }))),
  markPeace(C("ทิ้งเกวียนแล้ววิ่ง", B((l) => `คุณรอดมาได้แต่ของทั้งหมดหายไป${hasInjury(l, "leg") ? " และขาที่เจ็บทำให้คุณล้มกลางทาง" : ""}`, { gold: -5 }, (l) => { if (hasInjury(l, "leg")) addStat(l, "health", -6); }))),
], { title: "โจรกลางทาง", weight: vowCut(5), maxTimes: 2 });
const RAID = E("ft.dg.raid", [12, 900], (l, c) => `ฝูง${MONSTERS[Number(c.mon)].name}บุกเข้า${cityOf(l).name}ตอนกลางคืน เสียงระฆังดังไม่หยุด`, [
  markFight(P("ออกไปสู้หน้าบ้าน", (l) => fightOdds(l, 18), (l, c) => { meet(l, MONSTERS[Number(c.mon)].name); return G("พวกมันถอยกลับเข้าป่า เพื่อนบ้านออกมายืนดูคุณ", { fame: 2 })(l, c); }, (l, c) => { meet(l, MONSTERS[Number(c.mon)].name); return B("มันเหวี่ยงคุณกระเด็นไปชนกำแพง", { hp: -8 })(l, c); })),
  markPeace(C("พาคนในบ้านซ่อนในห้องใต้ดิน", N("เช้ามามีรอยกรงเล็บรอบประตู ทุกคนรอด แต่ยุ้งข้าวหายไปครึ่งหนึ่ง", { gold: -3, joy: -2 }))),
  markPeace(PAY("ลงขันจ้างนักล่ามาจัดการ", 10, N("นักล่าสามคนเฝ้าหมู่บ้านทั้งเดือน และฝูงนั้นไม่กลับมาอีก"))),
], { title: "สัตว์อสูรบุกเมือง", weight: vowCut(5), maxTimes: 2, prepare: (l) => ({ mon: randInt(l, 0, MONSTERS.length - 1) }) });
const ASSASSIN = E("ft.dg.assassin", [16, 900], "คืนนั้นเงาที่หน้าต่างไม่ใช่เงาของกิ่งไม้ ชื่อเสียงของคุณทำให้ใครบางคนยอมจ่ายแพงเพื่อให้คุณหายไป", [
  markFight(P("สู้ในความมืด", (l) => fightOdds(l, 30 + Math.round(l.fame / 5)), G("นักฆ่าหนีออกทางหน้าต่าง ทิ้งมีดอาบยาพิษไว้บนพื้น", { fame: 3 }), (l, c) => (chance(l, deathOdds(l, 30 + Math.round(l.fame / 5)) * 0.5) ? B("มีดเล่มนั้นหาคุณเจอก่อน", { die: "ถูกลอบสังหาร" })(l, c) : B("มีดอาบยาพิษเฉียดคุณไป แต่พิษเข้าเลือดแล้ว", { hp: -10 }, (l) => afflict(l, "poison"))(l, c)))),
  markPeace(K("สังเกตเห็นก่อนแล้วจับไว้", "smarts", 55, G("คุณรอนักฆ่าอยู่หลังม่าน เขายอมบอกชื่อคนจ้างก่อนรุ่งสาง", { iq: 1 }), B("คุณเห็นช้าไปนิด แผลที่ไหล่ไม่ลึกแต่เจ็บนาน", { hp: -8 }))),
  markPeace(PAY("จ้างองครักษ์ไว้ทั้งปี", 30, N("องครักษ์สองคนยืนเฝ้าประตูทุกคืน และเงาที่หน้าต่างไม่กลับมาอีก"))),
], { title: "เงาที่หน้าต่าง", when: (l) => on(l) && l.fame >= 60, weight: vowCut(6), maxTimes: 3 });
const STORM = E("ft.dg.storm", [10, 900], (l) => (cityOf(l).kind === "mountain" ? "หิมะทั้งไหล่เขาเคลื่อนลงมาพร้อมเสียงเหมือนฟ้าผ่า" : "พายุจากทะเลพัดหลังคาบ้านปลิวไปทั้งแถบ"), [
  markPeace(K("เตรียมรับมือไว้ก่อนแล้ว", "smarts", 45, G("คุณเห็นสัญญาณตั้งแต่เมื่อวาน บ้านของคุณจึงรอดทั้งหลัง", {}), B("คุณเตรียมไม่ทัน บ้านพังไปครึ่งหลัง", { gold: -6, hp: -3 }))),
  markPeace(C("หลบในวิหารกับคนทั้งเมือง", N("คุณนั่งฟังเสียงลมทั้งคืนกับคนแปลกหน้า เช้ามาทุกคนรู้จักกันหมดแล้ว", { joy: 1 }))),
  markPeace(K("ออกไปช่วยเพื่อนบ้าน", "health", 50, G("คุณดึงเด็กสองคนออกจากบ้านที่กำลังพัง", { fame: 3, joy: 3 }), B("ไม้ขื่อหล่นใส่หลังคุณ", { hp: -7 }))),
], { title: "ภัยธรรมชาติ", when: (l) => on(l) && ["mountain", "port"].includes(cityOf(l).kind), weight: 5, maxTimes: 2 });

// ───────────── ศึกกลางทะเลและบนหลังสัตว์ ─────────────
const PIRATES = beat({
  id: "ft.dg.pirates", title: "โจรสลัด", ages: [14, 900],
  intro: "เรือใบสีดำโผล่จากหมอก ธงหัวกะโหลกขึ้นเสา และตะขอเกี่ยวกราบเรือของคุณแล้ว",
  foe: "โจรสลัดปีนข้ามกราบเรือมาทีละคน",
  threat: () => 26,
  win: G("โจรสลัดกระโดดกลับเรือตัวเองแล้วตัดเชือกหนี ลูกเรือยกคุณขึ้นบ่า", { fame: 3, gold: 12 }),
  lose: N("พวกมันขนสินค้าไปครึ่งลำ และทิ้งคุณไว้บนดาดฟ้า", { gold: -10 }),
  flee: ["หันหัวเรือหนีเข้าหมอก", N("เรือรอด แต่ต้องโยนสินค้าทิ้งทะเลให้เรือเบาลง", { gold: -8 })],
  peace: [PAY("ยอมจ่ายค่าผ่านทาง", 20, N("กัปตันโจรสลัดนับเงินแล้วโบกมือให้ผ่าน")), K("เจรจากับกัปตันโจรสลัด", "looks", 50, G("กัปตันหัวเราะแล้วชวนคุณดื่มก่อนจากไป", { joy: 3 }), B("เขาไม่สนใจคำพูด และเอาไปมากกว่าเดิม", { gold: -12 }))],
  when: (l) => on(l) && (cityOf(l).kind === "port" || l.job?.careerId === "ft_sailor"), weight: vowCut(5), maxTimes: 2,
  prepare: () => ({ crew: true }),
});
const MOUNTED = beat({
  id: "ft.dg.mounted", title: "ศึกบนหลังสัตว์", ages: [16, 900],
  intro: (l) => (fl(l).mount ? "ฝูงไวเวิร์นป่าบินเข้าล้อมคุณกลางฟ้า" : "ทหารม้าข้าศึกสิบนายพุ่งข้ามทุ่งเข้าหาแนวของคุณ"),
  foe: (l) => (fl(l).mount ? "ไวเวิร์นตัวใหญ่ที่สุดพุ่งเข้าหาคอมังกรของคุณ" : "หอกของทหารม้าคนหน้าพุ่งตรงมาที่อกคุณ"),
  threat: () => 30,
  win: G((l) => (fl(l).mount ? "ฝูงไวเวิร์นแตกกระจาย มังกรของคุณร้องก้องฟ้า" : "แนวทหารม้าข้าศึกแตก คุณยึดม้าของหัวหน้ามาได้"), { fame: 4 }, (l) => { if (fl(l).whelp) fl(l).whelp!.bond = clamp(fl(l).whelp!.bond + 5, 0, 100); }),
  lose: N("คุณตกจากหลังสัตว์และกลิ้งไปกับพื้น"),
  flee: ["หันหลังหนีเต็มกำลัง", N("คุณหนีมาได้ แต่ทิ้งของไว้กลางทาง", { gold: -5 })],
  peace: [C("ถอยตามคำสั่งโดยไม่ปะทะ", N("คุณกลับถึงค่ายโดยไม่มีใครเจ็บ และไม่มีใครได้เหรียญ"))],
  when: (l) => on(l) && (!!fl(l).mount || ["ft_knight", "ft_soldier"].includes(l.job?.careerId ?? "")), weight: vowCut(4), maxTimes: 2,
  prepare: () => ({ mounted: true }),
});

// ───────────── กิจกรรม ─────────────
const M = (a: Omit<Activity, "world" | "emoji">): Activity => ({ ...a, emoji: "", world: "fantasy" });
const yearly = (k: string) => (l: Life) => Number(l.flags[k] ?? -1) !== l.age;
const ACTS: Activity[] = [
  M({ group: "ผจญภัย", id: "ft_guildboard", name: "กระดานงานของกิลด์", desc: "งานสามใบจากลูกค้าที่มีชื่อ · ลูกค้าจำคุณได้", minAge: 14, time: 2, available: (l) => !!l.ft && fl(l).guild > 0 && yearly("ftGuildBoard")(l), run: (l) => {
    l.flags.ftGuildBoard = l.age;
    const ctx: Ctx = {}, cl = [...CLIENTS.keys()], ts = [...TASKS.keys()];
    for (let i = 0; i < BOARD_SIZE; i++) { ctx[`c${i}`] = cl.splice(randInt(l, 0, cl.length - 1), 1)[0]; ctx[`t${i}`] = ts.splice(randInt(l, 0, ts.length - 1), 1)[0]; ctx[`x${i}`] = chance(l, 0.25) ? (TASKS[Number(ctx[`t${i}`])].twist && chance(l, 0.6) ? 2 : 1) : 0; }
    runEvent(l, "ft.dg.board", ctx); return { text: "" };
  } }),
  M({ group: "ผจญภัย", id: "ft_bounty", name: "ล่าค่าหัว", desc: "ใบประกาศจับจากกิลด์ · บางใบไม่เป็นอย่างที่เขียน · ต้องเป็นขั้นทองแดงขึ้นไป", minAge: 16, time: 2, available: (l) => !!l.ft && fl(l).guild >= 2 && yearly("ftBounty")(l), run: (l) => {
    l.flags.ftBounty = l.age;
    const ctx: Ctx = { n: randInt(l, 0, OUTLAWS.length - 1), cr: randInt(l, 0, CRIMES.length - 1) };
    if (chance(l, 0.25)) ctx.inn = true; else if (chance(l, 0.3)) ctx.gang = randInt(l, 0, GANGS.length - 1);
    runEvent(l, "ft.dg.bounty", ctx); return { text: "" };
  } }),
  M({ group: "ชีวิต", id: "ft_cure", name: "รักษาแผลเก่า", desc: `เวทเยียวยาชั้นสูงที่วิหารใหญ่ · ${CURE_PRICE} เหรียญทอง`, minAge: 10, available: (l) => !!l.ft && injuriesOf(l).length > 0, run: (l) => { runEvent(l, "ft.dg.cure"); return { text: "" }; } }),
  M({ group: "ชีวิต", id: "ft_peacevow", name: "ปฏิญาณไม่จับอาวุธ", desc: "ภัยมาหาน้อยลง ทางที่ไม่ต้องสู้ได้ผลขึ้น · จับอาวุธเมื่อไหร่คำปฏิญาณก็แตก", minAge: 16, time: 0, available: (l) => !!l.ft && !fl(l).peaceVow, run: (l) => { fl(l).peaceVow = true; lean(l, { m: 4 }); addStat(l, "happiness", 3); const t = "คุณวางอาวุธไว้หน้าแท่นบูชาแล้วสาบานว่าจะไม่จับมันอีก"; log(l, t, "good"); return { text: t, kind: "good" }; } }),
];

// ───────────── ทุกปี ─────────────
function dangerYear(l: Life) {
  if (!on(l) || !l.alive) return;
  const f = fl(l);
  // แผลสด: พักหรือหาหมอแล้วหาย · ปล่อยไว้อาจกลายเป็นแผลถาวร
  if (f.wound !== undefined && f.wound < l.age) {
    const healer = didLastYear(l, "ft_healer") || craftRank(l, "healing") >= 2;
    const potion = (f.potions?.heal ?? 0) > 0;
    if (healer || (didLastYear(l, "ft_rest") && chance(l, REST_HEAL))) { f.wound = undefined; addStat(l, "health", WOUND_BACK); log(l, "แผลที่ได้มาเมื่อปีก่อนหายสนิทแล้ว", "good"); }
    else if (potion) { f.potions!.heal!--; f.wound = undefined; addStat(l, "health", WOUND_BACK); log(l, "คุณใช้ยาสมานแผลกับแผลที่ยังไม่หาย มันปิดสนิทในคืนเดียว", "good"); }
    else if (chance(l, WOUND_TURN)) { f.wound = undefined; addInjury(l); }
    else log(l, "แผลเมื่อปีก่อนยังไม่หาย พักผ่อนหรือหาหมอรักษา ไม่งั้นมันอาจอยู่กับคุณไปตลอด", "bad");
  }
  // พิษ คำสาป โรค ทรุดลงทีละปี
  const a = f.ailment;
  if (a) {
    const cured = a.kind === "curse" ? didLastYear(l, "ft_h_temple") || didLastYear(l, "ft_penance") : didLastYear(l, "ft_healer") || craftRank(l, "healing") >= 3 || chance(l, AIL_FADE[a.kind]);
    if (cured) { f.ailment = undefined; log(l, `${AILMENTS[a.kind].name}หายไปจากตัวคุณแล้ว`, "good"); }
    else { addStat(l, "health", -AIL_HP * a.stage); a.stage = Math.min(AIL_MAX, a.stage + 1); log(l, `${AILMENTS[a.kind].name}ทรุดลงอีก (ขั้น ${a.stage}/${AIL_MAX}) · ${AILMENTS[a.kind].cure}`, "bad"); }
  }
  if (!f.ailment && (f.corruption ?? 0) >= 40 && chance(l, 0.04)) afflict(l, "curse");
  if (hasInjury(l, "lung") && stageAge(l) > 40 && l.age % 2 === 0) addStat(l, "health", -1);
  // สัตว์คู่อาฆาตโตขึ้นทุกปีที่ไม่ได้เจอ
  if (f.nemesis && !f.nemesis.dead) f.nemesis.power = Math.min(95, f.nemesis.power + 1);
}

export const DANGER_EVENTS: GameEvent[] = [NEMESIS, BOARD, TWIST, BIGJOB, BOUNTY, INNOCENT, GANG, REVENGE, LETTER, BROKEN, CURE, SIEGE, ROAD, RAID, ASSASSIN, STORM, PIRATES, MOUNTED];
/** เรื่องอันตรายเดิมที่แผล ความกลัว สมุดสัตว์อสูร และของที่เก็บได้ต้องรู้จัก */
const OLD_DANGER = ["ft.contract", "ft.h.floor", "ft.w.draft", "ft.w.feud"];

function choicesOf(e: GameEvent): Choice[] { return [...(e.choices ?? []), ...Object.values(e.scenes ?? {}).flatMap((s) => s.choices)]; }

/** เรียกหลังลงทะเบียน event ทั้งหมดแล้ว */
export function loadDanger() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push(dangerYear);
  // สงคราม: เลือกบทบาทของคุณเอง
  getEvent("ft.w.draft")?.choices?.splice(1, 0, ...WAR_ROLES);
  // ทางเลือกเดิมที่ใช้พลังต่อสู้นับเป็นการต่อสู้ · ทางที่ไม่ต้องสู้นับเป็นทางสงบ
  for (const id of OLD_DANGER) for (const ch of getEvent(id)?.choices ?? []) (ch.odds ? FIGHTS : PEACE).add(ch);
  for (const ch of getEvent("ft.h.floor")?.choices ?? []) if (typeof ch.label === "string" && /ย่อง|ถอย|พัก/.test(ch.label)) { FIGHTS.delete(ch); PEACE.add(ch); }
  // เจ็บหนักในงานอันตรายเป็นแผลสด · กับดักในดันเจี้ยนมีพิษ · ไข้ระบาดเล่นงานหนักติดตัวไปหลายปี
  for (const e of [...OLD_DANGER.map((id) => getEvent(id)!).filter(Boolean), ...DANGER_EVENTS]) for (const ch of choicesOf(e)) {
    const run = ch.run;
    ch.run = (l, c, ok) => {
      const h0 = l.stats.health;
      const out = run(l, c, ok);
      if (!on(l) || !l.alive) return out;
      const drop = h0 - l.stats.health;
      if (drop >= WOUND_HP) {
        wound(l);
        if (e.id === "ft.h.floor" && chance(l, 0.2)) afflict(l, "poison");
        return { ...out, text: `${out.text} · แผลนี้ต้องพักหรือหาหมอ ไม่งั้นอาจไม่หาย` };
      }
      // ชนะในงานเดิมก็มีโอกาสได้ของ
      if (ok && FIGHTS.has(ch) && (e.id === "ft.contract" || e.id === "ft.h.floor")) return { ...out, text: out.text + loot(l) };
      return out;
    };
  }
  // สมุดสัตว์อสูร: งานกิลด์และบอสดันเจี้ยน
  for (const ch of getEvent("ft.contract")?.choices ?? []) if (FIGHTS.has(ch)) { const run = ch.run; ch.run = (l, c, ok) => { meet(l, MONSTERS[Number(c.mon ?? 0)].name); return run(l, c, ok); }; }
  oddsHooks.push((l, c, ctx, p) => {
    if (!on(l)) return p;
    const f = fl(l);
    if (FIGHTS.has(c)) {
      if (ctx.mon !== undefined && ctx.dg === undefined) p += beastEdge(l, MONSTERS[Number(ctx.mon)]?.name ?? "");
      if (f.fear) p -= FEAR_PENALTY;
      if (bold(l)) p += BOLD_EDGE;
    } else if (PEACE.has(c) && f.peaceVow) p += VOW_EDGE;
    return p;
  });
  // ชนะการต่อสู้หายกลัว · จับอาวุธแล้วคำปฏิญาณแตก
  choiceHooks.push((l, c, _ctx, ok) => {
    if (!on(l) || !FIGHTS.has(c)) return;
    const f = fl(l);
    if (ok && f.fear) { f.fear = false; log(l, "คุณเผชิญหน้ากับความกลัวแล้ว และมันเล็กลงกว่าที่เคย", "good"); }
    if (f.peaceVow) { f.peaceVow = false; addStat(l, "happiness", -8); lean(l, { m: -2 }); log(l, "คุณจับอาวุธอีกครั้ง คำปฏิญาณที่ให้ไว้หน้าแท่นบูชาแตกแล้ว", "bad"); }
  });
  // คนกล้าสู้ได้ดีแต่เสี่ยงตายกว่า · คนรอบคอบเอาตัวรอดเก่ง
  safetyHooks.push((l) => (!on(l) ? 1 : cautious(l) ? 0.85 : bold(l) ? 1.1 : 1));
  // แผลถาวร แผลสด
  combatHooks.push((l) => {
    if (!on(l)) return [];
    const out: [string, number][] = injuriesOf(l).map((k) => [INJURIES[k].name, k === "eye" && fl(l).style === "bow" ? -10 : INJURIES[k].combat]);
    if (fl(l).wound !== undefined) out.push(["แผลที่ยังไม่หาย", -3]);
    return out;
  });
}

/** สรุปสำหรับแท็บพลัง */
export function dangerLines(l: Life): string[] {
  const f = fl(l), out: string[] = [];
  if (f.wound !== undefined) out.push("มีแผลที่ยังไม่หาย · พักผ่อนหรือหาหมอรักษาก่อนสิ้นปี");
  for (const k of injuriesOf(l)) out.push(`${INJURIES[k].name} · ${INJURIES[k].desc}`);
  if (f.ailment) out.push(`${AILMENTS[f.ailment.kind].name} ขั้น ${f.ailment.stage}/${AIL_MAX} · ${AILMENTS[f.ailment.kind].cure}`);
  if (f.fear) out.push("ยังกลัวจากความพ่ายแพ้ครั้งก่อน · ชนะการต่อสู้สักครั้งแล้วจะหาย");
  if (f.peaceVow) out.push("ปฏิญาณไม่จับอาวุธ · ภัยมาหาน้อยลง ทางที่ไม่ต้องสู้ได้ผลขึ้น");
  if (f.nemesis) out.push(f.nemesis.dead ? `ล้ม${f.nemesis.name}ได้แล้ว` : `คู่อาฆาต: ${f.nemesis.name} · พลัง ${f.nemesis.power} (คุณ ${combat(l)}) · เจอกันมาแล้ว ${f.nemesis.met} ครั้ง`);
  const regulars = Object.entries(f.clients ?? {}).filter(([, n]) => n >= 2).map(([n]) => n);
  if (regulars.length) out.push(`ลูกค้าประจำ: ${regulars.join(" · ")}`);
  return out;
}
