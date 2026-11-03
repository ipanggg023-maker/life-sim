// แท็บโลก: โลกเปลี่ยนเพราะคุณ และจำได้ว่าคุณเปลี่ยนอะไร · ผู้ครองแต่ละแผ่นดินมีนิสัยและมองคุณตามสิ่งที่คุณเป็น
// ฝ่ายอำนาจนับถือหรือรังเกียจคุณตามนิสัยและผลงาน · ยามสงครามคุณเลือกได้ว่าจะยืนตรงไหน และเมื่อสงครามจบ แผ่นดินจะตัดสินคุณ
import type { Ctx, GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { chance, pick, weightedPick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { clamp } from "../../engine/util";
import { ECHO, TAGS, tagged, worldHook } from "./conseq";
import { B, BIG, C, E, G, GOLD, K, N, P, PAY } from "./kit";
import { personaOf, type Persona } from "./persona";
import { fightOdds } from "./power";
import { spread, talkIn } from "./rumors";
import { addStanding, dataOf, deed, fl, homeKingdom, kingdomsOf, standingOf, type Faction, type Kingdom } from "./state";

// ── รอยเท้าของคุณบนแผ่นดิน ──
export interface Mark { text: string; k: string; age: number }
export interface WorldFx { p?: number; s?: number; w?: number }
export const marksOf = (l: Life) => (fl(l).marks ??= []);
/** สิ่งที่คุณทำเปลี่ยนแผ่นดินจริง · ความรุ่งเรือง ความมั่นคง และกำลังทัพ */
export function mark(l: Life, text: string, fx: WorldFx, kid = fl(l).kingdom) {
  const k = kingdomsOf(l).find((x) => x.id === kid);
  if (!k) return;
  if (fx.p) k.prosperity = clamp((k.prosperity ?? 100) + fx.p, 40, 140);
  if (fx.s) k.stability = clamp(k.stability + fx.s, 5, 95);
  if (fx.w) k.power = clamp(k.power + fx.w, 5, 120);
  const m = marksOf(l);
  m.push({ text, k: kid, age: l.age });
  if (m.length > 24) m.splice(0, m.length - 24);
}
const fxWord = (fx: WorldFx) => [fx.p ? (fx.p > 0 ? "แผ่นดินรุ่งเรืองขึ้น" : "แผ่นดินยากจนลง") : "", fx.s ? (fx.s > 0 ? "บ้านเมืองสงบขึ้น" : "บ้านเมืองปั่นป่วนขึ้น") : "", fx.w ? (fx.w > 0 ? "กองทัพแข็งแกร่งขึ้น" : "กองทัพอ่อนแอลง") : ""].filter(Boolean).join(" ");
export { fxWord };

// ── นิสัยของผู้ครอง: คำนวณจากชื่อ คงที่ตลอดรัชกาล ──
export type Temper = "just" | "cruel" | "greedy" | "pious";
export const TEMPERS: Record<Temper, { name: string; likes: Partial<Persona>; desc: string }> = {
  just: { name: "ทรงธรรม", likes: { m: 1, h: 1 }, desc: "รักคนซื่อและคนมีเมตตา" },
  cruel: { name: "เหี้ยมเกรียม", likes: { m: -1, c: 1 }, desc: "นับถือคนกล้าที่ไม่ใจอ่อน" },
  greedy: { name: "ละโมบ", likes: { h: -1 }, desc: "ชอบคนเจ้าเล่ห์และคนมีทอง" },
  pious: { name: "เคร่งศาสนา", likes: { f: 1, m: 1 }, desc: "รักคนศรัทธา รังเกียจคนนอกรีต" },
};
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export const temperOf = (k: Kingdom): Temper => (["just", "cruel", "greedy", "pious"] as Temper[])[hash(k.ruler) % 4];
/** ผู้ครองมองคุณอย่างไร: ชื่อเสียงในแผ่นดินนั้น นิสัยที่ตรงใจ ข่าวลือ และทองในกระเป๋าสำหรับคนละโมบ */
export function rulerView(l: Life, k: Kingdom): number {
  if (k.playerRuled || fl(l).throne === k.id) return 100;
  const t = TEMPERS[temperOf(k)], p = personaOf(l);
  let fit = 0;
  for (const a of Object.keys(t.likes) as (keyof Persona)[]) fit += (t.likes[a] ?? 0) * p[a];
  const talk = talkIn(l, k.id).reduce((s, r) => s + r.tone * r.heat, 0);
  const gold = temperOf(k) === "greedy" ? Math.min(20, l.money / (100 * GOLD)) : 0;
  return clamp(Math.round(standingOf(l, k.id) * 0.6 + fit / 4 + talk / 20 + gold), -100, 100);
}
export const viewWord = (v: number) => (v >= 60 ? "โปรดปรานคุณ" : v >= 30 ? "พอใจในตัวคุณ" : v > -20 ? "ไม่รู้จักคุณดีพอ" : v > -50 ? "ไม่ไว้ใจคุณ" : "อยากเห็นคุณพ้นแผ่นดิน");

// ── ฝ่ายอำนาจนับถือคุณแค่ไหน ──
const FACTION_FIT: Record<string, Partial<Persona>> = { silver: { c: 1, h: 1 }, conclave: { f: -0.5, h: 0.5 }, league: { h: -0.5, c: 0.5 }, night: { h: -1, m: -0.5 }, dawn: { f: 1, m: 1 }, ember: { f: -1, c: 0.5 } };
export function regard(l: Life, x: Faction): number {
  const f = fl(l), p = personaOf(l), fit = FACTION_FIT[x.id] ?? {};
  let s = 0;
  for (const a of Object.keys(fit) as (keyof Persona)[]) s += (fit[a] ?? 0) * p[a];
  const bonus = (f.faction === x.id ? 30 + f.fRank * 10 : 0) - (f.foe === x.id ? 60 : 0) + (x.id === "conclave" ? f.magicRank * 5 : 0) + (x.id === "silver" ? f.bodyRank * 4 : 0) + (x.id === "ember" ? f.dragonBond / 4 : 0) + (x.id === "league" ? Math.min(20, l.money / (100 * GOLD)) : 0);
  return clamp(Math.round(s / 2 + bonus), -100, 100);
}
export const regardWord = (v: number) => (v >= 50 ? "นับถือคุณ" : v >= 20 ? "สนใจคุณ" : v > -20 ? "ไม่สนใจคุณ" : v > -50 ? "รังเกียจคุณ" : "ถือว่าคุณเป็นศัตรู");

const here = (l: Life) => homeKingdom(l);
const ruler = (l: Life) => here(l).ruler;
const facBy = (l: Life, c: Ctx) => dataOf(l).factions.find((x) => x.id === c.fac)!;
const W = (id: string, title: string, text: (l: Life, c: Ctx) => string, choices: GameEvent["choices"], o: { when?: (l: Life) => boolean; prepare?: (l: Life) => Ctx; maxTimes?: number; weight?: number } = {}): GameEvent => ({ ...E(`ft.wd.${id}`, [16, 900], text, choices!, { title, maxTimes: o.maxTimes ?? 2, when: o.when, prepare: o.prepare, weight: o.weight }), manual: true });

// ── ราชสำนักและฝ่ายอำนาจ ──
export const COURT_EVENTS: GameEvent[] = [
  W("summons", "ราชสำนักเรียกตัว", (l) => `${ruler(l)}ผู้${TEMPERS[temperOf(here(l))].name}เรียกคุณเข้าเฝ้า ข่าวเรื่องคุณไปถึงท้องพระโรงแล้ว`, [
    tagged(C("รับตำแหน่งอัศวินกิตติมศักดิ์", BIG((l) => `${ruler(l)}แตะดาบบนบ่าคุณทั้งสองข้าง`, { fame: 8 }, (l) => { deed(l, `อัศวินกิตติมศักดิ์ของ${here(l).name}`); addStanding(l, 10); })), { c: 2 }),
    tagged(C("ขอให้พระองค์ช่วยคนยากจนแทนการให้รางวัลตัวเอง", G("พระองค์นิ่งไปนาน แล้วสั่งเปิดโรงทานในทุกเมือง", { joy: 6 }, (l) => { mark(l, "ทูลขอโรงทานให้คนยากจนทั้งแผ่นดิน", { p: 3, s: 5 }); spread(l, "ทูลขอโรงทานแทนรางวัลของตัวเอง", 1, 55); })), { m: 8 }),
    tagged(K("ขอที่ดินผืนงามเป็นรางวัล", "looks", 50, G("คุณได้ไร่ริมแม่น้ำหนึ่งผืน", { gold: 40 }, (l) => { l.flags.ftLand = Number(l.flags.ftLand ?? 0) + 1; }), N("พระองค์ยิ้มเย็นๆ \"เจ้าโลภกว่าที่ข้าคิด\"", {}, (l) => addStanding(l, -5))), { h: -2 }),
  ], { when: (l) => rulerView(l, here(l)) >= 50 && !fl(l).throne, maxTimes: 2, weight: 12 }),
  W("mission", "งานลับของผู้ครอง", (l) => `${ruler(l)}ไว้ใจคุณมากพอจะมอบงานลับ: ${pick(l, ["กำจัดหัวหน้าโจรที่ซ่อนอยู่ในป่าหลวง", "พาเจ้าหญิงผ่านแดนอันตรายไปพบว่าที่คู่หมั้น", "ตามหาขุนนางที่ยักยอกท้องพระคลังแล้วหนี"])}`, [
    tagged(P("รับงาน", (l) => fightOdds(l, 30 + l.age / 4), BIG("งานสำเร็จ ผู้ครองจดชื่อคุณไว้ในบัญชีผู้ภักดี", { gold: 40, fame: 6 }, (l) => { addStanding(l, 12); mark(l, "ทำงานลับให้ผู้ครองสำเร็จ", { s: 4 }); }), B("งานพลาด คุณรอดกลับมาพร้อมแผลและความผิดหวังของผู้ครอง", { hp: -15 }, (l) => addStanding(l, -6))), { c: 4 }),
    tagged(C("ปฏิเสธอย่างนอบน้อม", N("ผู้ครองพยักหน้า แต่ไม่ได้ลืม", {}, (l) => addStanding(l, -3))), { c: -2 }),
  ], { when: (l) => rulerView(l, here(l)) >= 30 && !fl(l).throne && l.age >= 18, maxTimes: 3, weight: 10 }),
  W("harass", "คนเก็บภาษีชุดพิเศษ", (l) => `${ruler(l)}ไม่ปลื้มคุณ คนเก็บภาษีมาเคาะประตูบ้านคุณเป็นครั้งที่สามในปีนี้ คราวนี้มาพร้อมทหาร`, [
    PAY("จ่ายไปให้จบ", 15, N("ทหารยิ้มเยาะแล้วกลับไป")),
    tagged(K("ไล่ออกไปด้วยคำพูด", "looks", 55, G("ทหารลังเล แล้วถอยออกไปเมื่อเพื่อนบ้านเริ่มมามุง", {}, (l) => spread(l, "ไล่คนเก็บภาษีของผู้ครองออกจากบ้าน", 1, 30)), B("ทหารยึดของในบ้านไปครึ่งหนึ่ง", { gold: -25 })), { c: 5 }),
    C("ย้ายไปแผ่นดินอื่น", N("คุณเก็บของข้ามแดนในคืนเดียว", { joy: -4 }, (l) => { const o = kingdomsOf(l).filter((k) => k.id !== fl(l).kingdom).sort((a, b) => rulerView(l, b) - rulerView(l, a))[0]; if (o) fl(l).kingdom = o.id; })),
  ], { when: (l) => rulerView(l, here(l)) <= -30 && !fl(l).throne, maxTimes: 3, weight: 10 }),
  W("exile", "ราชโองการเนรเทศ", (l) => `${ruler(l)}ออกราชโองการเนรเทศคุณออกจาก${here(l).name} ประกาศติดไว้ทุกประตูเมือง`, [
    C("ออกจากแผ่นดินแต่โดยดี", N("คุณเดินข้ามพรมแดนพร้อมกระเป๋าใบเดียว", { joy: -8 }, (l) => { const from = here(l).name; const o = kingdomsOf(l).filter((k) => k.id !== fl(l).kingdom).sort((a, b) => rulerView(l, b) - rulerView(l, a))[0]; if (o) fl(l).kingdom = o.id; deed(l, `ผู้ถูกเนรเทศจาก${from}`); })),
    tagged(P("ซ่อนตัวอยู่ต่อ", (l) => 0.35 + l.stats.luck / 300, N("คุณหลบยามได้ตลอดปี แต่ต้องย้ายที่นอนทุกคืน", { joy: -5 }), B("ทหารจับคุณได้และโยนข้ามพรมแดน", { hp: -10, gold: -20 }, (l) => { const o = kingdomsOf(l).find((k) => k.id !== fl(l).kingdom); if (o) fl(l).kingdom = o.id; })), { c: 4, h: -2 }),
  ], { when: (l) => rulerView(l, here(l)) <= -60 && !fl(l).throne, maxTimes: 1, weight: 20 }),
  W("foreign", "คำเชิญจากต่างแดน", (l, c) => `ทูตจาก${kingdomsOf(l).find((k) => k.id === c.k)?.name}นำจดหมายของ${kingdomsOf(l).find((k) => k.id === c.k)?.ruler}มาถึง เชิญคุณไปอยู่ที่นั่นพร้อมบ้านและที่ดิน`, [
    C("ย้ายไปตามคำเชิญ", G((l, c) => `คุณย้ายไป${kingdomsOf(l).find((k) => k.id === c.k)?.name} บ้านใหม่ใหญ่กว่าเดิมสองเท่า`, { gold: 30, joy: 4 }, (l, c) => { fl(l).kingdom = String(c.k ?? fl(l).kingdom); })),
    C("ตอบขอบคุณแต่อยู่ที่เดิม", N("จดหมายนั้นถูกเก็บไว้ในกล่อง เผื่อวันหนึ่ง", {}, (l) => addStanding(l, 2))),
  ], { when: (l) => kingdomsOf(l).some((k) => k.id !== fl(l).kingdom && rulerView(l, k) >= 45) && !fl(l).throne, maxTimes: 1, weight: 8, prepare: (l) => ({ k: kingdomsOf(l).filter((k) => k.id !== fl(l).kingdom).sort((a, b) => rulerView(l, b) - rulerView(l, a))[0].id }) }),
  W("fac_invite", "คำเชิญจากฝ่ายอำนาจ", (l, c) => `${facBy(l, c).name} ฝ่าย${facBy(l, c).creed} ส่งคนมาเชิญคุณเข้าร่วม พวกเขาเห็นสิ่งที่คุณเป็นมาตลอด`, [
    C("เข้าร่วม", BIG((l, c) => `คุณเป็นสมาชิกของ${facBy(l, c).name}แล้ว และไม่ต้องเริ่มจากศูนย์`, { fame: 3 }, (l, c) => { const f = fl(l); f.faction = String(c.fac); f.fRank = Math.max(f.fRank, 1); f.fMerit = 10; })),
    C("ขอคิดดูก่อน", N("ทูตทิ้งตราสัญลักษณ์ไว้ให้ เผื่อคุณเปลี่ยนใจ")),
  ], { when: (l) => !fl(l).faction && dataOf(l).factions.some((x) => regard(l, x) >= 45), maxTimes: 1, weight: 10, prepare: (l) => ({ fac: dataOf(l).factions.filter((x) => regard(l, x) >= 45).sort((a, b) => regard(l, b) - regard(l, a))[0].id }) }),
  W("fac_hostile", "ฝ่ายที่รังเกียจคุณ", (l, c) => `${facBy(l, c).name}ประกาศว่าคุณเป็นภัยต่อสิ่งที่พวกเขายึดถือ คนของพวกเขาเริ่มขัดขวางทุกอย่างที่คุณทำ`, [
    tagged(K("ไปพบผู้นำของพวกเขาตรงๆ", "looks", 55, G("ผู้นำฟังคุณ และสั่งให้ลูกน้องเลิกยุ่ง", { fame: 2 }), B("ผู้นำไล่คุณออกมาต่อหน้าทุกคน", { joy: -4 })), { c: 4 }),
    tagged(C("ตอบโต้ด้วยการเปิดโปงพวกเขา", N((l, c) => `ข่าวฉาวของ${facBy(l, c).name}แพร่ไปทั่ว อำนาจของพวกเขาลดลง`, {}, (l, c) => { const x = dataOf(l).factions.find((y) => y.id === c.fac); if (x) x.power = clamp(x.power - 6, 5, 100); fl(l).foe = String(c.fac); })), { c: 3, h: 2 }),
    C("หลบเลี่ยงไปก่อน", N("คุณเลี่ยงเส้นทางของพวกเขาไปทั้งปี", { joy: -2 })),
  ], { when: (l) => dataOf(l).factions.some((x) => regard(l, x) <= -45), maxTimes: 2, weight: 8, prepare: (l) => ({ fac: dataOf(l).factions.filter((x) => regard(l, x) <= -45).sort((a, b) => regard(l, a) - regard(l, b))[0].id }) }),
];

// ── สงคราม: คุณอยู่ตรงไหนเมื่อแผ่นดินรบ ──
const foeOf = (l: Life) => kingdomsOf(l).find((k) => k.id === here(l).war);
const merit = (n: number, text?: string, fx?: WorldFx) => (l: Life) => { l.flags.ftWarMerit = Number(l.flags.ftWarMerit ?? 0) + n; if (text && fx) mark(l, text, fx); };
const atWar = (l: Life) => !!here(l).war && !fl(l).throne;
const V = (id: string, title: string, text: (l: Life) => string, choices: GameEvent["choices"], o: { when?: (l: Life) => boolean; maxTimes?: number } = {}): GameEvent => ({ ...E(`ft.wr.${id}`, [14, 900], text, choices!, { title, maxTimes: o.maxTimes ?? 2, when: (l) => atWar(l) && (!o.when || o.when(l)) }), manual: true });
export const WAR_EVENTS: GameEvent[] = [
  V("militia", "หมู่บ้านชายแดน", (l) => `ทหารจาก${foeOf(l)?.name ?? "ศัตรู"}ปล้นหมู่บ้านชายแดน ชาวบ้านรวมตัวเป็นกองอาสาและขอให้คุณนำ`, [
    tagged(P("นำกองอาสา", (l) => fightOdds(l, 30), BIG("พวกโจรทหารถอยกลับข้ามแม่น้ำ หมู่บ้านรอด", { fame: 6, body: 10 }, merit(4, "นำกองอาสาป้องกันหมู่บ้านชายแดน", { w: 3, s: 2 })), B("กองอาสาแตกพ่าย คุณพาคนที่เหลือหนีออกมาได้", { hp: -16 }, merit(1))), { c: 6 }),
    tagged(C("พาคนแก่กับเด็กหนีก่อน", G("ทุกคนที่คุณพาออกมารอด", { joy: 3 }, merit(2, "พาผู้คนหนีภัยสงคราม", { s: 1 }))), { m: 5 }),
  ]),
  V("smuggle", "เสบียงสงคราม", () => "กองทัพแนวหน้าขาดเสบียง พ่อค้าในตลาดกักข้าวไว้รอราคาขึ้น และมีคนเสนอซื้อข้าวในโกดังของคุณสามเท่า", [
    tagged(C("ส่งข้าวไปให้กองทัพในราคาทุน", G("ทหารแนวหน้าได้กินอิ่มเป็นครั้งแรกในรอบเดือน", { gold: -5 }, merit(3, "ส่งเสบียงให้กองทัพในราคาทุน", { w: 2 }))), { m: 4, h: 2 }),
    tagged(C("ขายให้คนที่จ่ายมากที่สุด", N("คุณได้เงินก้อนใหญ่ และทหารหิวต่อไปอีกเดือน", { gold: 30 }, (l) => { merit(-3, "ขายเสบียงเก็งกำไรยามสงคราม", { w: -2, s: -2 })(l); spread(l, "เก็งกำไรเสบียงยามสงคราม", -1, 40); })), { m: -5, h: -3 }),
  ], { when: (l) => l.age >= 18 }),
  V("deserter_enemy", "ทหารศัตรูในโรงนา", (l) => `ทหารหนุ่มจาก${foeOf(l)?.name ?? "ฝ่ายศัตรู"}ซ่อนตัวอยู่ในโรงนาของคุณ ขาเขาเน่าจากแผล เขาอายุไม่เกินสิบหก`, [
    tagged(C("รักษาแผลแล้วปล่อยไป", G("เขาร้องไห้แล้วจูบมือคุณ ก่อนหายไปในความมืด", {}, (l) => { merit(-1)(l); spread(l, "ช่วยชีวิตทหารศัตรูที่บาดเจ็บ", 1, 25); })), { m: 8, seed: "enemy_boy" }),
    tagged(C("ส่งตัวให้ทหารฝ่ายเรา", N("เขาถูกลากไปที่ค่ายเชลย", { fame: 1 }, merit(2))), { m: -4, h: 2 }),
  ]),
  V("spy_offer", "สายลับของศัตรู", (l) => `คนแปลกหน้าเสนอทองคำหนึ่งถุงใหญ่ แลกกับเส้นทางลำเลียงเสบียงของกองทัพ${here(l).name}`, [
    tagged(C("ขายข้อมูล", N("ทองคำหนักมือ และกองคาราวานเสบียงถูกซุ่มโจมตีในสัปดาห์ต่อมา", { gold: 50 }, merit(-6, "ขายความลับของกองทัพให้ศัตรู", { w: -5 }))), { h: -12, m: -6 }),
    tagged(C("แจ้งทหาร", BIG("สายลับถูกจับ และเครือข่ายของมันแตกทั้งเมือง", { fame: 5 }, merit(4, "จับสายลับของศัตรู", { w: 2, s: 2 }))), { h: 6, c: 3 }),
    tagged(C("ไล่ไปโดยไม่บอกใคร", N("เขาไปเสนอคนอื่นแทน")), {}),
  ], { when: (l) => l.age >= 18 }),
  V("wounded", "เต็นท์คนเจ็บ", () => "เกวียนขนทหารบาดเจ็บมาถึงเมืองไม่หยุด หมอทำงานมาสามวันไม่ได้นอน", [
    tagged(C("อาสาช่วยดูแลคนเจ็บ", G("คุณเห็นสิ่งที่ไม่มีวันลืม และช่วยคนไว้ได้หลายสิบ", { joy: -4, iq: 1 }, merit(3, "อาสาดูแลทหารบาดเจ็บ", { w: 1 }))), { m: 6 }),
    PAY("บริจาคยาและผ้าพันแผล", 10, G("หมอส่งคำขอบคุณมาพร้อมรายชื่อคนที่รอด", {}, merit(2))),
    C("อยู่ห่างๆ", N("เสียงร้องดังมาถึงบ้านคุณทุกคืน")),
  ]),
  V("letters", "จดหมายถึงบ้าน", () => "ทหารที่ตายในศึกทิ้งจดหมายไว้กองใหญ่ ไม่มีใครว่างพอจะนำไปส่งถึงครอบครัวของพวกเขา", [
    tagged(C("รับไปส่งทีละบ้าน", G("คุณเคาะประตูสามสิบบ้าน และอยู่ฟังทุกบ้านจนเขาพร้อมจะปิดประตู", { joy: -3 }, (l) => { merit(2)(l); spread(l, "ส่งจดหมายของทหารที่ตายถึงทุกบ้าน", 1, 35); })), { m: 6, c: 2 }),
    C("บอกว่าไม่ว่าง", N("จดหมายกองนั้นยังอยู่ที่ค่ายจนสงครามจบ")),
  ]),
  V("profiteer", "ค้าอาวุธสองฝั่ง", (l) => `ช่างตีเหล็กใต้ดินเสนอให้คุณเป็นคนกลางขายอาวุธ ทั้งให้${here(l).name}และ${foeOf(l)?.name ?? "ศัตรู"}`, [
    tagged(C("รับเป็นคนกลาง", N("คุณร่ำรวยจากสงครามที่ฆ่าคนทั้งสองฝั่ง", { gold: 60 }, (l) => { merit(-4, "ค้าอาวุธให้ทั้งสองฝั่งของสงคราม", { s: -3 }); spread(l, "ค้าอาวุธให้ศัตรูของแผ่นดิน", -1, 45); })), { h: -8, m: -6, seed: "war_profiteer" }),
    tagged(C("แจ้งทางการ", G("โรงตีเหล็กใต้ดินถูกปิด", { fame: 2 }, merit(2))), { h: 5 }),
  ], { when: (l) => l.age >= 20 }),
];

/** สงครามจบ: แผ่นดินตัดสินว่าคุณทำอะไรระหว่างนั้น */
export const AFTERMATH: GameEvent = { ...E("ft.wr.after", [14, 900], (l) => { const m = Number(l.flags.ftWarMerit ?? 0); return m >= 6 ? `สงครามจบแล้ว ชาวเมืองจัดขบวนแห่ให้คนที่ยืนหยัดระหว่างสงคราม และชื่อคุณถูกเรียกเป็นคนแรก` : m <= -5 ? `สงครามจบแล้ว ชาวเมืองเริ่มนับบัญชี และหลายคนจำได้ว่าคุณทำอะไรระหว่างนั้น` : "สงครามจบแล้ว ผู้คนกลับมาซ่อมบ้าน และลืมเรื่องของคนธรรมดาอย่างคุณ"; }, [
  C("รับฟังคำตัดสิน", (l) => { const m = Number(l.flags.ftWarMerit ?? 0); delete l.flags.ftWarMerit; delete l.flags.ftWarWith; if (m >= 6) { deed(l, `วีรชนแห่งสงคราม${here(l).name}`); addStanding(l, 15); return { text: "คุณได้เหรียญกล้าหาญ และชื่อคุณถูกสลักบนอนุสรณ์สงคราม", kind: "milestone" }; } if (m <= -5) { addStanding(l, -20); spread(l, "ทรยศแผ่นดินระหว่างสงคราม", -1, 70); return { text: "ประตูหลายบ้านปิดใส่คุณ และเด็กๆ ปาหินใส่หน้าต่าง", kind: "bad" }; } return { text: "ชีวิตกลับเป็นปกติ", kind: "normal" }; }),
], { title: "หลังสงคราม", maxTimes: 0 }), manual: true };

export const WORLD_ECHOES: GameEvent[] = [
  ECHO("enemy_boy", "รักษาแผลให้ทหารศัตรูหนุ่มแล้วปล่อยไป", [5, 25], "ทูตสันติภาพจากแผ่นดินศัตรูขอพบคุณเป็นการส่วนตัว เขาคือทหารหนุ่มที่ขาเน่าในโรงนาของคุณ ตอนนี้เป็นคนที่ยืนอยู่ข้างผู้ครองของเขา", [
    C("ฟังสิ่งที่เขาอยากบอก", BIG("เขาบอกว่าทุกครั้งที่สภาของเขาพูดถึงสงคราม เขาเล่าเรื่องโรงนาของคุณ", { joy: 10, fame: 5 }, (l) => { spread(l, "ช่วยชีวิตทูตสันติภาพของแผ่นดินศัตรูไว้ตอนเขาเป็นทหาร", 1, 50); mark(l, "ทูตสันติภาพที่คุณเคยช่วยไว้ทำให้สองแผ่นดินคืนดี", { s: 6, p: 3 }); })),
  ], "ทูตจากแผ่นดินศัตรู"),
  ECHO("war_profiteer", "ค้าอาวุธให้ทั้งสองฝั่งของสงคราม", [3, 15], "หญิงม่ายคนหนึ่งยื่นดาบหักให้ดู ตรงด้ามมีตราช่างที่คุณเคยเป็นคนกลางขาย สามีเธอตายด้วยดาบเล่มนี้ ฝ่ายศัตรูเป็นคนถือ", [
    PAY("ชดใช้ให้เธอ", 30, N("เธอรับเงินโดยไม่มองหน้าคุณ", {}, (l) => mark(l, "ชดใช้ให้ครอบครัวของคนที่ตายด้วยอาวุธที่ตนขาย", { s: 1 }))),
    C("บอกว่าไม่รู้เรื่อง", N("เธอเดินจากไป และเล่าเรื่องนี้ให้ทุกคนในตลาดฟัง", {}, (l) => spread(l, "ขายอาวุธที่ฆ่าคนของแผ่นดินตัวเอง", -1, 50))),
  ], "ดาบหัก"),
];

/** ทุกปี: ราชสำนักและฝ่ายอำนาจ · ยามสงครามมีเรื่องของคนธรรมดา · สงครามจบแล้วถูกตัดสิน */
export const COURT_CHANCE = 0.3;
export const WAR_CHANCE = 0.55;
const pickRun = (l: Life, pool: GameEvent[]) => { const ok = pool.filter((e) => (l.seen[e.id] ?? 0) < (e.maxTimes ?? 2) && l.age >= e.minAge && (!e.when || e.when(l))); const e = weightedPick(l, ok, (x) => (typeof x.weight === "number" ? x.weight : 10)); if (e) runEvent(l, e.id); return !!e; };
function worldYear(l: Life) {
  const k = here(l);
  if (k.war && !l.flags.ftWarWith) { l.flags.ftWarWith = k.war; l.flags.ftWarMerit = 0; }
  if (!k.war && l.flags.ftWarWith) { if (l.age >= 14) runEvent(l, AFTERMATH.id); else { delete l.flags.ftWarWith; delete l.flags.ftWarMerit; } }
  if (l.queue.some((q) => q.eventId.startsWith("ft.wd.") || q.eventId.startsWith("ft.wr."))) return;
  if (k.war && chance(l, WAR_CHANCE) && pickRun(l, WAR_EVENTS)) return;
  if (chance(l, COURT_CHANCE)) pickRun(l, COURT_EVENTS);
}
export function loadWorldmark() {
  worldHook.fn = mark;
  void TAGS;
  yearHooks.push((l) => { if (l.worldId === "fantasy" && l.ft && l.alive) worldYear(l); });
}
