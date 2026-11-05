// ใต้ดินและกฎหมาย (Release 10): กิลด์โจรห้าขั้น งานปล้นหลายจังหวะ ของเถื่อน ความร้อนจากยาม
// ศาลและการพิจารณาคดี คุกที่เป็นช่วงชีวิตของมันเอง (พวก ศัตรู แผนแหกคุก สินบน ครูในคุก) และผลของการฆ่าคน
import { ACTIVITIES, activityFilters, type Activity } from "../../engine/activities";
import { eligibilityFilters, getEvent, type Choice, type Ctx, type GameEvent, type Scene } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, addStat, clamp, createPerson, log, shortName } from "../../engine/util";
import { B, BIG, C, E, G, GOLD, K, N, P, PAY, SCENE, type Res } from "./kit";
import { fightOdds } from "./power";
import { addStanding, deed, fl, homeKingdom, standingOf } from "./state";
import { lean } from "./persona";
import { flee } from "./civic";
import { nextUp } from "./danger";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
export const jailed = (l: Life) => on(l) && Number(l.flags.jailUntil ?? -1) > l.age;
export const yearsLeft = (l: Life) => Math.max(0, Number(l.flags.jailUntil ?? 0) - l.age);
const harsh = (l: Life) => !!homeKingdom(l).laws?.includes("harshCourts");
const after = (e: GameEvent, fn: (l: Life, c: Ctx) => void): GameEvent => ({ ...e, choices: e.choices?.map((ch) => ({ ...ch, run: (l, c, ok) => { fn(l, c); return ch.run(l, c, ok); } })) });

// ───────────── คำตัดสิน ─────────────
/** ส่งเข้าคุก: เสียงาน แผนแหกคุกเริ่มใหม่ · ยิ่งเคยทำผิดมาก่อนโทษยิ่งหนัก */
export function sentence(l: Life, years: number) {
  const f = fl(l), y = Math.max(1, years + (harsh(l) ? 1 : 0) + ((f.crimes ?? 0) >= 4 ? 1 : 0));
  // ติดคุก y ปีเต็ม: ปีที่ตัดสินอยู่ในห้องขัง แล้วพ้นโทษหลังผ่านไป y ปี
  l.flags.jailUntil = (jailed(l) ? Number(l.flags.jailUntil) : l.age + 1) + y;
  l.flags.ftJailFrom = l.age;
  f.crimes = (f.crimes ?? 0) + 1; f.escape = 0;
  // ถูกจับแล้ว ยามเลิกจับตามอง
  if (f.ug) f.ug = { ...f.ug, heat: Math.max(0, f.ug.heat - 40) };
  l.job = undefined;
  addStanding(l, -4);
  return y;
}

// ───────────── กิลด์โจร ─────────────
export const UG_RANKS = ["คนนอก", "ลูกมือ", "นักย่อง", "นักปล้น", "เจ้าถิ่น", "ราชาเงา"];
export const HEAT_DECAY = 6;
export const RAID_HEAT = 60;
const ug = (l: Life) => fl(l).ug ?? { rank: 0, merit: 0, heat: 0 };
export const ugRank = (l: Life) => fl(l).ug?.rank ?? 0;
export const heatOf = (l: Life) => fl(l).ug?.heat ?? 0;
export const meritNeed = (l: Life) => ugRank(l) * 3;
export function addHeat(l: Life, d: number) { const u = ug(l); fl(l).ug = { ...u, heat: clamp(u.heat + d, 0, 100) }; }
function addMerit(l: Life, d: number): string {
  const u = { ...ug(l) };
  if (!u.rank) return "";
  u.merit += d;
  let up = "";
  if (u.rank < 5 && u.merit >= u.rank * 3) {
    u.rank++; u.merit = 0;
    up = ` กิลด์เลื่อนคุณเป็น${UG_RANKS[u.rank]}`;
    if (u.rank >= 4) deed(l, `${UG_RANKS[u.rank]}แห่งกิลด์โจร${homeKingdom(l).name}`);
  }
  fl(l).ug = u;
  return up;
}
const odds = (base: number) => (l: Life) => clamp(base + (l.stats.luck - 50) / 200 + (l.stats.smarts - 50) / 300 + (fl(l).race === "halfling" ? 0.1 : 0) - heatOf(l) / 400, 0.05, 0.92);
/** ถูกจับ: ไปศาลทันทีหลังฉากนี้ */
const arrest = (sev: number, extra: Ctx = {}): Res => (l) => { nextUp(l, "ft.l.arrest", { sev, ...extra }); return { text: "เสียงนกหวีดของยามดังรอบตัว มือหนึ่งตะปบไหล่คุณ", kind: "bad" }; };
const job = (text: string, gold: number, merit: number, heat: number): Res => (l) => { addMoney(l, gold * GOLD); addHeat(l, heat); fl(l).crimes = (fl(l).crimes ?? 0) + 1; addStanding(l, -1); return { text: `${text} ได้ ${gold} เหรียญทอง${addMerit(l, merit)}`, kind: "good" }; };

const JOIN = SCENE("ft.ug.join", "กิลด์โจร", "ประตูกิลด์โจรอยู่หลังร้านขายปลาเค็ม คนเฝ้าประตูมองคุณตั้งแต่หัวจรดเท้า \"ทุกคนต้องพิสูจน์ตัวเองหนึ่งครั้ง\"", [
  K("ล้วงกระเป๋าคนเฝ้าประตูให้ดู", "luck", 45, G("คนเฝ้าประตูหัวเราะแล้วขอถุงเงินคืน คุณเป็นลูกมือของกิลด์แล้ว", { joy: 3 }, (l) => { fl(l).ug = { rank: 1, merit: 0, heat: 0 }; lean(l, { h: -3 }); }), N("มือคุณถูกจับไว้กลางอากาศ \"กลับไปฝึกมาใหม่\"")),
  C("ให้คนในวงการรับรอง", G("ชื่อของคนที่รับรองคุณเปิดประตูได้ทันที", {}, (l) => { fl(l).ug = { rank: 1, merit: 1, heat: 0 }; lean(l, { h: -2 }); }), { show: (l) => l.job?.careerId === "ft_thief" || fl(l).school === "thieves" || fl(l).faction === "night" }),
  C("เปลี่ยนใจแล้วเดินออกไป", N("กลิ่นปลาเค็มตามคุณไปถึงบ้าน")),
]);
const UG_JOB = SCENE("ft.ug.job", "งานของกิลด์", (l) => `${UG_RANKS[ugRank(l)]}แห่งกิลด์โจร · ผลงาน ${ug(l).merit}/${meritNeed(l)} · ยามจับตามอง ${heatOf(l)}${heatOf(l) >= 40 ? " (ร้อนเกินไป ทุกงานยากขึ้น)" : ""}`, [
  P("ล้วงกระเป๋าตามรายชื่อของกิลด์", odds(0.65), job("ถุงเงินของพ่อค้าที่ไม่จ่ายส่วยเบาลง", 8, 1, 5), arrest(1)),
  P("ขนของเถื่อนข้ามแดน", odds(0.55), job("เกวียนผ่านด่านไปโดยไม่มีใครเปิดผ้าใบ", 30, 2, 10), (l, c) => (chance(l, 0.4) ? arrest(2)(l, c) : B("ด่านตรวจเข้มกว่าที่คิด คุณทิ้งเกวียนแล้ววิ่งหนี", { gold: -10 }, (l) => addHeat(l, 8))(l, c)), { show: (l) => ugRank(l) >= 2 }),
  C("วางแผนปล้นครั้งใหญ่", (l) => { nextUp(l, "ft.ug.heist", {}); return { text: "คุณกางแผนที่บนโต๊ะในห้องลับของกิลด์" }; }, { show: (l) => ugRank(l) >= 3 }),
  C("เก็บค่าคุ้มครองย่านตลาด", (l) => { lean(l, { m: -3 }); return job("แม่ค้าทุกร้านยื่นซองให้โดยไม่ต้องพูดอะไร", 25, 1, 8)(l, {}); }, { show: (l) => ugRank(l) >= 4 }),
  P("ล้มเจ้าถิ่นของแก๊งคู่แข่ง", (l) => fightOdds(l, 30), (l) => { addHeat(l, 12); return { text: `ย่านของแก๊งคู่แข่งเป็นของคุณแล้ว${addMerit(l, 3)}`, kind: "good" }; }, B("คนของเจ้าถิ่นมากกว่าที่คิด คุณถูกทิ้งไว้ในตรอก", { hp: -12 }), { show: (l) => ugRank(l) >= 4 }),
  PAY("ส่งส่วยให้กิลด์ซื้อตัวยาม", 15, N("ยามที่เคยจ้องคุณเริ่มมองไปทางอื่น", {}, (l) => addHeat(l, -30))),
  C("ปีนี้เงียบไว้ก่อน", N("คุณนั่งดื่มในห้องลับของกิลด์ ฟังคนอื่นเล่าว่าใครโดนจับ")),
]);

// งานปล้นใหญ่: เป้าหมาย → แผน → ทีม → ลงมือ
const TARGETS: { name: string; base: number; loot: number; rank: number; faith?: boolean }[] = [
  { name: "คลังของพ่อค้าใหญ่", base: 0.5, loot: 80, rank: 3 },
  { name: "คฤหาสน์ขุนนาง", base: 0.4, loot: 150, rank: 3 },
  { name: "คลังสมบัติของวิหาร", base: 0.35, loot: 200, rank: 4, faith: true },
  { name: "โรงกษาปณ์หลวง", base: 0.25, loot: 500, rank: 5 },
];
const tg = (c: Ctx) => TARGETS[Number(c.tg ?? 0)];
const bump = (c: Ctx, d: number) => { c.edge = Number(c.edge ?? 0) + d; };
const step = (text: string | ((l: Life, c: Ctx) => string), d: number, next: string): Res => (l, c) => { bump(c, d); return { text: typeof text === "string" ? text : text(l, c), next }; };
const crewMate = (l: Life) => l.people.find((p) => p.alive && (p.tags?.some((t) => t.startsWith("party:")) || p.tags?.includes("prisoner")) && p.bond >= 40);
const heistOdds = (l: Life, c: Ctx) => clamp(odds(tg(c).base)(l) + Number(c.edge ?? 0), 0.05, 0.92);
const HEIST_SCENES: Record<string, Scene> = {
  plan: { title: "งานปล้น", text: (_l, c) => `เป้าหมายคือ${tg(c).name} จะเตรียมตัวอย่างไร`, choices: [
    C("ซื้อตัวคนในให้เปิดประตูหลัง (20 เหรียญทอง)", (l, c) => { addMoney(l, -20 * GOLD); return step("คนในรับเงินแล้วบอกเวรยามทุกกะ", 0.15, "crew")(l, c); }, { req: (l) => (l.money < 20 * GOLD ? "ต้องมี 20 เหรียญทอง" : undefined) }),
    K("ไปสำรวจเองสามคืน", "smarts", 50, step("คุณจำได้ทุกก้าวของยาม", 0.12, "crew"), step("คุณถูกคนเห็นหน้าคืนที่สาม", -0.05, "crew")),
    C("ไปเลย ไม่ต้องวางแผน", step("คุณเชื่อในมือของตัวเอง", 0, "crew")),
  ] },
  crew: { title: "งานปล้น", text: () => "ใครจะไปกับคุณ", choices: [
    C((l) => `ชวน${shortName(crewMate(l)!)}ไปด้วย`, (l, c) => { c.mate = crewMate(l)!.id; return step((l) => `${shortName(crewMate(l)!)}พยักหน้าโดยไม่ถามอะไร`, 0.1, "go")(l, c); }, { show: (l) => !!crewMate(l) }),
    C("จ้างคนของกิลด์ (15 เหรียญทอง)", (l, c) => { addMoney(l, -15 * GOLD); return step("กิลด์ส่งคนที่เงียบที่สุดมาให้", 0.08, "go")(l, c); }, { req: (l) => (l.money < 15 * GOLD ? "ต้องมี 15 เหรียญทอง" : undefined) }),
    C("ทำคนเดียว", step("ไม่มีใครให้ไว้ใจ ไม่มีใครให้หักหลัง", 0, "go")),
  ] },
  go: { title: "งานปล้น", text: (_l, c) => `คืนนี้คือคืนนั้น ${tg(c).name}เงียบสนิท`, choices: [
    P("ลงมือ", heistOdds, (l, c) => {
      const t = tg(c); addMoney(l, t.loot * GOLD); addHeat(l, 25); fl(l).crimes = (fl(l).crimes ?? 0) + 1; addStanding(l, -4);
      if (t.faith) lean(l, { f: -6 });
      if (t.rank >= 5) deed(l, `ปล้นโรงกษาปณ์หลวงแห่ง${homeKingdom(l).name}`);
      const p = l.people.find((x) => x.id === c.mate); if (p) p.bond = clamp(p.bond + 10, 0, 100);
      return { text: `คุณออกจาก${t.name}พร้อม ${t.loot} เหรียญทอง ทั้งเมืองตื่นมาพร้อมข่าวลือ${addMerit(l, 3)}`, kind: "milestone" };
    }, (l, c) => {
      const p = l.people.find((x) => x.id === c.mate);
      if (p) { p.bond = clamp(p.bond - 15, 0, 100); p.job = "ติดคุกเพราะงานปล้นกับคุณ"; }
      return arrest(3)(l, c);
    }, { tone: "danger" }),
    C("ยกเลิกกลางคัน", N("คุณรู้สึกบางอย่างไม่ถูกต้อง และเดินจากไป เงินที่ลงไปแล้วไม่ได้คืน")),
  ] },
};
const HEIST: GameEvent = { ...SCENE("ft.ug.heist", "งานปล้น", "จะปล้นที่ไหน", [
  ...TARGETS.map((t, i) => C(`${t.name} · ราว ${t.loot} เหรียญทอง`, (_l, c) => { c.tg = i; return { text: `คุณวงชื่อ${t.name}ด้วยหมึกแดง`, next: "plan" }; }, { show: (l) => ugRank(l) >= t.rank })),
  C("ยังไม่ถึงเวลา", N("คุณม้วนแผนที่เก็บ")),
]), scenes: HEIST_SCENES };

const RAID = after(E("ft.ug.raid", [14, 900], "ยามยี่สิบนายล้อมบ้านคุณก่อนรุ่งสาง หัวหน้ายามถือหมายจับที่มีชื่อคุณ", [
  P("สู้ฝ่าวงล้อม", (l) => fightOdds(l, 22 + ugRank(l) * 4), G("คุณหายเข้าไปในท่อระบายน้ำ ยามได้แค่เสื้อคลุมของคุณ", {}, (l) => { addHeat(l, 10); addStanding(l, -8); }), arrest(2)),
  PAY("ติดสินบนหัวหน้ายาม", 30, N("หัวหน้ายามฉีกหมายจับต่อหน้าคุณ", {}, (l) => addHeat(l, -35))),
  C("หนีข้ามแดนก่อนเช้า", N("คุณทิ้งทุกอย่างไว้ข้างหลัง ที่แผ่นดินใหม่ไม่มีใครรู้จักหน้าคุณ", { joy: -5 }, (l) => { flee(l); fl(l).ug = { ...ug(l), heat: 0 }; })),
  C("ยอมมอบตัว", arrest(2, { gave: 1 })),
], { title: "ยามบุก", forced: true, maxTimes: 0, when: (l) => on(l) && !jailed(l) && heatOf(l) >= RAID_HEAT && l.age >= Number(l.flags.ftRaidNext ?? 0) }), (l) => { l.flags.ftRaidNext = l.age + 3; });

// ───────────── ศาล: ทางสู้คดีเพิ่ม ─────────────
const sevOf = (c: Ctx) => Number(c.sev ?? 1);
const friendWitness = (l: Life) => l.people.find((p) => p.alive && ["friend", "spouse", "partner", "ally"].includes(p.relation) && p.bond >= 60);
/** แก้ต่างเองยากขึ้นคดีละขั้น */
export const SELF_DEFEND = 0.12;
const lawyerFee = (c: Ctx) => 15 + sevOf(c) * 15;
const COURT: Choice[] = [
  { label: (_l, c) => `จ้างทนายฝีปากดี (${lawyerFee(c)} เหรียญทอง)`, req: (l, c) => (l.money < lawyerFee(c) * GOLD ? `ต้องมี ${lawyerFee(c)} เหรียญทอง` : undefined), odds: (l, c) => clamp(0.75 - sevOf(c) * 0.08 - (harsh(l) ? 0.15 : 0) + (c.gave ? 0.1 : 0), 0.1, 0.85),
    run: (l, c, ok) => { addMoney(l, -lawyerFee(c) * GOLD); if (ok) return { text: "ทนายของคุณพลิกคำให้การของพยานทีละคน ศาลยกฟ้อง", kind: "good" }; const y = sentence(l, sevOf(c)); return { text: `ทนายพูดเก่ง แต่หลักฐานพูดดังกว่า ศาลตัดสินจำคุก ${y} ปี`, kind: "bad" }; } },
  K((l) => `เรียก${shortName(friendWitness(l)!)}มาเป็นพยาน`, "looks", 45, (l) => { const p = friendWitness(l)!; p.bond = clamp(p.bond + 5, 0, 100); return { text: `${shortName(p)}ยืนยันว่าคืนนั้นอยู่กับคุณ ศาลไม่มีทางเลือกนอกจากปล่อยตัว`, kind: "good" }; },
    (l, c) => { const p = friendWitness(l)!; p.bond = clamp(p.bond - 8, 0, 100); const y = sentence(l, sevOf(c)); return { text: `คำให้การของ${shortName(p)}ขัดกันเอง ศาลตัดสินจำคุก ${y} ปี และเพื่อนคุณถูกปรับฐานให้การเท็จ`, kind: "bad" }; },
    { show: (l) => !!friendWitness(l) }),
  K("อ้างว่าป้องกันตัว", "smarts", 35, G("ศาลเห็นว่าคุณไม่มีทางเลือก และปล่อยตัวพร้อมคำตักเตือน", {}), (l, c) => { const y = sentence(l, 1); return B(`ศาลไม่เชื่อทั้งหมด จำคุก ${y} ปี`, {})(l, c); }, { show: (_l, c) => !!c.selfdef }),
  C("สารภาพทุกอย่างเพื่อลดโทษ", (l, c) => { lean(l, { h: 4 }); const y = sentence(l, Math.max(1, Math.ceil(sevOf(c) / 2) - 1)); return { text: `ศาลลดโทษให้คนที่พูดความจริง จำคุก ${y} ปี`, kind: "bad" }; }),
  { label: (_l, c) => `ติดสินบนผู้พิพากษา (${sevOf(c) * 30} เหรียญทอง)`, req: (l, c) => (l.money < sevOf(c) * 30 * GOLD ? `ต้องมี ${sevOf(c) * 30} เหรียญทอง` : undefined), odds: (l) => (harsh(l) ? 0.35 : 0.7),
    run: (l, c, ok) => { addMoney(l, -sevOf(c) * 30 * GOLD); lean(l, { h: -3 }); if (ok) return { text: "ผู้พิพากษาพบว่าหลักฐานไม่พอ อย่างน่าประหลาด", kind: "good" }; addStanding(l, -6); const y = sentence(l, sevOf(c) + 1); return { text: `ผู้พิพากษาคนนี้ซื่อตรงเกินไป สินบนกลายเป็นอีกคดี จำคุก ${y} ปี`, kind: "bad" }; } },
];

// ───────────── คุก ─────────────
export const ESCAPE_STEPS = 3;
export const BRIBE_YEAR = 30;
const M = (a: Omit<Activity, "world" | "emoji">): Activity => ({ ...a, emoji: "", world: "fantasy" });
const yearly = (k: string) => (l: Life) => Number(l.flags[k] ?? -1) !== l.age;
const TEACHERS: [string, string, (l: Life) => string][] = [
  ["โจรเฒ่าที่ไม่เคยถูกจับจนถึงอายุหกสิบ", "สะเดาะกุญแจ", (l) => { if (!ugRank(l)) fl(l).ug = { ...ug(l), rank: 1 }; return `เขาสอนวิธีฟังเสียงกุญแจ คุณได้ผลงานในกิลด์โจร${addMerit(l, 2)}`; }],
  ["นักปราชญ์ที่ถูกขังเพราะเขียนหนังสือผิดใจผู้ครอง", "อ่านเขียนและกฎหมาย", (l) => { addStat(l, "smarts", 3); return "คุณอ่านตำรากฎหมายจนจบเล่ม สติปัญญา +3"; }],
  ["ทหารผ่านศึกที่ฆ่านายกองของตัวเอง", "การต่อสู้มือเปล่า", (l) => { fl(l).body += 12; return "เขาสอนท่าที่ไม่มีในตำรา แต้มฝึกกาย +12"; }],
];
const ACTS: Activity[] = [
  M({ group: "ทางมืด", id: "ft_ug_join", name: "เข้ากิลด์โจร", desc: "ห้าขั้นจากลูกมือถึงราชาเงา", minAge: 14, available: (l) => on(l) && !fl(l).ug?.rank && !jailed(l), run: (l) => { runEvent(l, "ft.ug.join"); return { text: "" }; } }),
  M({ group: "ทางมืด", id: "ft_ug_job", name: "งานของกิลด์โจร", desc: "ล้วง ขนของเถื่อน ปล้นใหญ่ · ยิ่งทำยามยิ่งจับตา", minAge: 14, time: 2, available: (l) => ugRank(l) > 0 && !jailed(l) && yearly("ftUgJob")(l), run: (l) => { l.flags.ftUgJob = l.age; runEvent(l, "ft.ug.job"); return { text: "" }; } }),
  M({ group: "ชีวิตในคุก", id: "ft_p_work", name: "ทำงานในคุก", desc: "ทอผ้า ตอกหิน ได้เงินนิดหน่อย", minAge: 10, available: jailed, run: (l) => { addMoney(l, 3 * GOLD); return { text: "คุณตอกหินจนมือแตก ได้ค่าแรง 3 เหรียญทอง" }; } }),
  M({ group: "ชีวิตในคุก", id: "ft_p_train", name: "ฝึกในห้องขัง", desc: "แต้มฝึกกาย +", minAge: 10, available: jailed, run: (l) => { fl(l).body += 8; addStat(l, "health", 1); return { text: "คุณวิดพื้นจนพื้นหินเปียกเหงื่อ", kind: "good" }; } }),
  M({ group: "ชีวิตในคุก", id: "ft_p_learn", name: "เรียนจากนักโทษ", desc: "ทุกคนในนี้มีเรื่องให้สอน · ปีละครั้ง", minAge: 10, available: (l) => jailed(l) && yearly("ftPLearn")(l), run: (l) => { l.flags.ftPLearn = l.age; const [who, what, fx] = pick(l, TEACHERS); const t = `${who}สอน${what}ให้คุณ ${fx(l)}`; log(l, t, "good"); return { text: t, kind: "good" }; } }),
  M({ group: "ชีวิตในคุก", id: "ft_p_ally", name: "หาพวกในคุก", desc: "คนที่ช่วยคุณในลานคุก และอาจช่วยงานข้างนอก", minAge: 10, available: (l) => jailed(l) && !l.people.some((p) => p.alive && p.tags?.includes("prisoner")), run: (l) => { const p = createPerson(l, "friend", { age: Math.max(18, l.age + randInt(l, -10, 10)), bond: 50, job: "นักโทษห้องข้างๆ" }); p.tags = [...(p.tags ?? []), "prisoner"]; const t = `คุณแบ่งขนมปังให้${shortName(p)} และตั้งแต่วันนั้นไม่มีใครกล้ามายุ่งกับคุณสองคน`; log(l, t, "good"); return { text: t, kind: "good" }; } }),
  M({ group: "ชีวิตในคุก", id: "ft_p_plan", name: "วางแผนแหกคุก", desc: `ครบ ${ESCAPE_STEPS} ขั้นแล้วลงมือได้ · ผู้คุมอาจค้นเจอ`, minAge: 10, available: (l) => jailed(l) && (fl(l).escape ?? 0) < ESCAPE_STEPS, run: (l) => {
    const f = fl(l);
    if (chance(l, 0.15)) { f.escape = 0; l.flags.jailUntil = Number(l.flags.jailUntil) + 1; return { text: "ผู้คุมค้นห้องขังแล้วเจอช้อนที่ฝนจนคม แผนทั้งหมดพัง และโทษเพิ่มหนึ่งปี", kind: "bad" }; }
    f.escape = (f.escape ?? 0) + 1;
    return { text: ["คุณเริ่มขูดปูนรอบลูกกรงด้วยช้อน", "คุณจำเวรยามได้ครบทุกกะ", "คุณซ่อนเชือกที่ถักจากผ้าห่มไว้ใต้ฟาง"][f.escape - 1] + ` (แผน ${f.escape}/${ESCAPE_STEPS})` };
  } }),
  M({ group: "ชีวิตในคุก", id: "ft_p_escape", name: "แหกคุก", desc: "หนีได้ก็เป็นคนหนีคดี · พลาดโทษเพิ่ม", minAge: 10, available: (l) => jailed(l) && (fl(l).escape ?? 0) >= ESCAPE_STEPS, run: (l) => { runEvent(l, "ft.ug.escape"); return { text: "" }; } }),
  M({ group: "ชีวิตในคุก", id: "ft_p_bribe", name: "ติดสินบนผู้คุม", desc: "ลดโทษหนึ่งปี · ปีละครั้ง", minAge: 10, cost: BRIBE_YEAR * GOLD, available: (l) => jailed(l) && yearly("ftPBribe")(l), run: (l) => { l.flags.ftPBribe = l.age; addMoney(l, -BRIBE_YEAR * GOLD); l.flags.jailUntil = Number(l.flags.jailUntil) - 1; lean(l, { h: -2 }); return { text: "ผู้คุมแก้ตัวเลขในสมุดทะเบียนโดยไม่เงยหน้า" }; } }),
  M({ group: "ชีวิตในคุก", id: "ft_p_appeal", name: "ยื่นอุทธรณ์", desc: "ครั้งเดียวต่อคดี · ต้องใช้สติปัญญา", minAge: 10, available: (l) => jailed(l) && l.flags.ftAppealed !== l.flags.ftJailFrom, run: (l) => { runEvent(l, "ft.ug.appeal"); return { text: "" }; } }),
];
const ESCAPE = SCENE("ft.ug.escape", "แหกคุก", "คืนเดือนมืด ลูกกรงหลวมพอให้ดึงออก เชือกผ้าห่มยาวพอถึงพื้น", [
  P("หนีตอนเปลี่ยนเวรยาม", (l) => clamp(0.5 + (l.stats.luck - 50) / 200 + (l.people.some((p) => p.alive && p.tags?.includes("prisoner")) ? 0.1 : 0), 0.15, 0.9),
    BIG("คุณวิ่งจนรุ่งสางแล้วไม่หันกลับไปมองกำแพงคุกอีก คุณเป็นคนหนีคดีแล้ว", { joy: 8 }, (l) => { delete l.flags.jailUntil; l.flags.ftEscaped = true; fl(l).escape = 0; addHeat(l, 40); addStanding(l, -15); }),
    (l, c) => { fl(l).escape = 0; l.flags.jailUntil = Number(l.flags.jailUntil) + 2; return B("สุนัขเฝ้าคุกได้กลิ่นคุณก่อนถึงกำแพง โทษเพิ่มสองปี", { hp: -10 })(l, c); }, { tone: "danger" }),
  C("รอให้พ้นโทษดีกว่า", N("คุณดันลูกกรงกลับเข้าที่ แล้วนอนลงบนฟาง")),
]);
const APPEAL = after(SCENE("ft.ug.appeal", "อุทธรณ์", (l) => `คุณเขียนคำร้องถึงศาลสูงด้วยมือตัวเอง เหลือโทษอีก ${yearsLeft(l)} ปี`, [
  K("ชี้ช่องโหว่ในคำพิพากษา", "smarts", 60, G("ศาลสูงพบว่าคดีของคุณตัดสินผิดขั้นตอน ประตูคุกเปิดพรุ่งนี้", { joy: 8 }, (l) => { l.flags.jailUntil = l.age; }), N("คำร้องถูกตีกลับพร้อมรอยประทับ \"ไม่รับพิจารณา\"")),
  C("ขอความเมตตาเพราะครอบครัว", (l) => (l.people.some((p) => p.alive && p.relation === "child" && p.age < 16) && chance(l, 0.5) ? G("ศาลลดโทษหนึ่งปีเพื่อเด็กที่รออยู่บ้าน", {}, (l) => { l.flags.jailUntil = Number(l.flags.jailUntil) - 1; })(l, {}) : N("ศาลอ่านคำร้องแล้ววางไว้ใต้กองเอกสาร")(l, {}))),
]), (l) => { l.flags.ftAppealed = l.flags.ftJailFrom ?? l.age; });

const PRISON_EVENTS: GameEvent[] = [
  after(E("ft.ug.yard", [10, 900], "นักโทษตัวใหญ่ที่สุดในลานคุกเดินมาหยุดตรงหน้าคุณ \"ที่นี่ทุกคนจ่ายค่าที่นั่ง\"", [
    P("สู้ให้ทุกคนเห็น", (l) => fightOdds(l, 16), G("เขาล้มลงกลางลาน ไม่มีใครมาเก็บค่าที่นั่งจากคุณอีก", { fame: 1 }), B("คุณได้ซี่โครงร้าวเป็นของที่ระลึก", { hp: -10 })),
    PAY("จ่ายค่าคุ้มครอง", 5, N("เขาตบไหล่คุณแล้วเดินไปหาคนใหม่")),
    C((l) => `ให้${shortName(l.people.find((p) => p.alive && p.tags?.includes("prisoner"))!)}ช่วย`, G("พวกของคุณยืนข้างคุณ และเขาถอยไปเอง", {}), { show: (l) => l.people.some((p) => p.alive && p.tags?.includes("prisoner")) }),
    K("หลบสายตาและอยู่เงียบๆ", "luck", 45, N("เขาลืมคุณไปในสัปดาห์เดียว"), B("ความเงียบของคุณทำให้เขาสนใจมากขึ้น", { hp: -6 })),
  ], { title: "ลานคุก", when: (l) => jailed(l) && Number(l.flags.ftYardAt ?? -99) < Number(l.flags.ftJailFrom ?? 0), weight: 60, maxTimes: 0 }), (l) => { l.flags.ftYardAt = l.age; }),
  E("ft.ug.riot", [10, 900], "นักโทษปีกตะวันตกจุดไฟเผาฟาง ผู้คุมคนหนึ่งติดอยู่กลางวงล้อม", [
    C("ช่วยผู้คุมออกมา", G("ผู้บัญชาการคุกลดโทษให้คุณหนึ่งปี แต่นักโทษบางคนเรียกคุณว่าหมาของยาม", {}, (l) => { l.flags.jailUntil = Number(l.flags.jailUntil) - 1; lean(l, { m: 4 }); })),
    C("ร่วมจลาจล", B("ไฟดับในตอนเช้า หัวโจกทุกคนรวมทั้งคุณได้โทษเพิ่ม", { hp: -6 }, (l) => { l.flags.jailUntil = Number(l.flags.jailUntil) + 1; if (ugRank(l)) addMerit(l, 2); })),
    C("หลบในห้องขัง", N("คุณนอนคว่ำหน้าลงกับพื้นจนเสียงตะโกนเงียบไป")),
  ], { title: "จลาจลในคุก", when: (l) => jailed(l) && yearsLeft(l) >= 2, weight: 20, maxTimes: 1 }),
  E("ft.ug.visit", [10, 900], (l) => { const p = l.people.find((x) => x.alive && ["mother", "father", "spouse", "child", "sibling"].includes(x.relation) && x.bond >= 40)!; return `${shortName(p)}มาเยี่ยมพร้อมขนมปังที่ยังอุ่น คุยกันผ่านลูกกรงได้แค่ครึ่งชั่วโมง`; }, [
    C("ขอโทษที่ทำให้ต้องมาที่นี่", G("น้ำตาของคุณทั้งคู่ตกลงบนขนมปัง", { joy: 6 }, (l) => { for (const p of l.people) if (p.alive && ["mother", "father", "spouse", "child", "sibling"].includes(p.relation)) p.bond = clamp(p.bond + 4, 0, 100); lean(l, { h: 2 }); })),
    C("ทำเป็นว่าทุกอย่างสบายดี", N("คุณยิ้มจนหมดเวลาเยี่ยม แล้วนั่งเงียบทั้งคืน", { joy: 2 })),
  ], { title: "วันเยี่ยม", when: (l) => jailed(l) && l.people.some((x) => x.alive && ["mother", "father", "spouse", "child", "sibling"].includes(x.relation) && x.bond >= 40), weight: 30, maxTimes: 2 }),
  E("ft.ug.cellmate", [10, 900], "ผู้คุมโยนนักโทษใหม่เข้ามาในห้องขังของคุณ ตัวสั่นทั้งคืน และกอดห่อผ้าเล็กๆ ไว้แน่น", [
    C("แบ่งผ้าห่มให้และฟังเรื่องของเขา", G("เขาเล่าว่าขโมยขนมปังให้น้องที่บ้าน คุณสองคนคุยกันจนรุ่งสาง", { joy: 3 }, (l) => { lean(l, { m: 4 }); const p = createPerson(l, "friend", { age: Math.max(16, l.age - randInt(l, 5, 15)), bond: 55, job: "เพื่อนร่วมห้องขัง" }); p.tags = [...(p.tags ?? []), "prisoner"]; })),
    C("แย่งห่อผ้าของเขามา", N("ในห่อมีแค่ขนมปังแห้งกับจดหมายจากแม่ เขาไม่พูดกับคุณอีกเลย", { gold: 1 }, (l) => lean(l, { m: -5 }))),
    C("ปล่อยเขาไว้คนเดียว", N("ที่นี่ทุกคนต้องเรียนรู้เอง คุณคิด แล้วหันหน้าเข้ากำแพง")),
  ], { title: "เพื่อนร่วมห้องขัง", when: jailed, weight: 40, maxTimes: 2 }),
  E("ft.ug.letter", [16, 900], (l) => { const p = l.people.find((x) => x.alive && (x.relation === "spouse" || x.relation === "partner")); return p ? `จดหมายจาก${shortName(p)}มาถึงพร้อมรอยน้ำตาบนหมึก "ข้าจะรอ หรือข้าควรเลิกรอ"` : "จดหมายไม่มีชื่อผู้ส่งมาถึง ข้างในมีแค่ภาพวาดบ้านเกิดของคุณ"; }, [
    C("เขียนตอบว่าขอให้รอ", G("คุณเขียนจนเทียนหมด และนับวันที่เหลือบนกำแพงทุกคืน", { joy: 4 }, (l) => { const p = l.people.find((x) => x.alive && (x.relation === "spouse" || x.relation === "partner")); if (p) p.bond = clamp(p.bond + 6, 0, 100); })),
    C("เขียนตอบว่าอย่ารอ", N("คุณปล่อยให้เขาไปมีชีวิตของตัวเอง มันเป็นจดหมายที่ยากที่สุดที่คุณเคยเขียน", { joy: -6 }, (l) => { const p = l.people.find((x) => x.alive && (x.relation === "spouse" || x.relation === "partner")); if (p) p.bond = clamp(p.bond - 20, 0, 100); lean(l, { m: 3 }); })),
    C("เก็บไว้ใต้ฟางโดยไม่ตอบ", N("คุณอ่านมันซ้ำทุกคืนจนตัวหนังสือเลือน", { joy: -2 })),
  ], { title: "จดหมายจากข้างนอก", when: jailed, weight: 30, maxTimes: 2 }),
  E("ft.ug.deal", [14, 900], "ผู้คุมคนหนึ่งกระซิบผ่านลูกกรง \"บอกชื่อคนที่ขนของเข้าคุกมา แล้วโทษเจ้าจะลดลงหนึ่งปี\"", [
    C("บอกชื่อ", N("โทษของคุณลดลงหนึ่งปี และตั้งแต่วันนั้นคุณกินข้าวโดยหันหลังชนกำแพง", {}, (l) => { l.flags.jailUntil = Number(l.flags.jailUntil) - 1; lean(l, { h: -3, m: -3 }); l.flags.ftYardAt = -99; })),
    C("บอกว่าไม่รู้อะไร", G("ผู้คุมถุยน้ำลายแล้วเดินไป นักโทษห้องข้างๆ พยักหน้าให้คุณ", {}, (l) => { if (ugRank(l)) addMerit(l, 1); })),
  ], { title: "ข้อเสนอของผู้คุม", when: (l) => jailed(l) && yearsLeft(l) >= 2, weight: 25, maxTimes: 1 }),
  E("ft.ug.fever", [10, 900], "ไข้คุกระบาดในปีกตะวันออก ทุกคืนมีคนถูกหามออกไปไม่กลับมา", [
    K("ดื่มแต่น้ำต้มและอยู่ห่างคนป่วย", "smarts", 45, G("คุณรอดมาได้โดยไม่ไอสักครั้ง", {}), B("ไข้หาคุณเจอจนได้", { hp: -10 })),
    K("ช่วยดูแลคนป่วย", "health", 50, G("คนที่คุณดูแลรอดสามคน ทั้งคุกเริ่มเรียกคุณว่าหมอ", { fame: 1 }, (l) => lean(l, { m: 5 })), B("คุณติดไข้จากคนที่ดูแล", { hp: -14 }, (l) => lean(l, { m: 5 }))),
  ], { title: "ไข้คุก", when: jailed, weight: 20, maxTimes: 1 }),
  E("ft.ug.out", [10, 900], "ประตูคุกเปิดออก แสงข้างนอกจ้าจนคุณต้องหรี่ตา ไม่มีใครมารอรับ หรือบางทีอาจมี", [
    C("เริ่มต้นใหม่อย่างสุจริต", G("คุณหางานด้วยชื่อจริง บางร้านปิดประตูใส่ บางร้านไม่ถามอะไรเลย", { joy: 4 }, (l) => { lean(l, { h: 4 }); addStanding(l, 4); delete l.flags.ftReleased; })),
    C("กลับไปหากิลด์", G("กิลด์จำคนที่ไม่ปากโป้งได้เสมอ", {}, (l) => { const u = ug(l); fl(l).ug = { rank: Math.max(1, u.rank), merit: u.merit, heat: 0 }; addMerit(l, 2); lean(l, { h: -3 }); delete l.flags.ftReleased; })),
    C("กลับบ้านไปหาครอบครัว", G("แม้จะไม่มีใครพูดถึงปีที่หายไป แต่ทุกคนกินข้าวด้วยกันจนดึก", { joy: 6 }, (l) => { for (const p of l.people) if (p.alive && ["mother", "father", "spouse", "child", "sibling"].includes(p.relation)) p.bond = clamp(p.bond + 3, 0, 100); delete l.flags.ftReleased; })),
  ], { title: "วันพ้นโทษ", forced: true, maxTimes: 0, when: (l) => on(l) && !jailed(l) && l.flags.ftReleased !== undefined }),
];

// ───────────── ฆ่าคนมีผล ─────────────
/** คนตายด้วยมือคุณนอกสงคราม: ใจแข็งขึ้น ยามสืบ และครอบครัวของเขาไม่ลืม */
export function killedSomeone(l: Life, selfdef: boolean): string {
  const f = fl(l);
  f.kills = (f.kills ?? 0) + 1;
  lean(l, { m: selfdef ? -2 : -6 });
  if (!l.flags.ftKinRevengeAt) l.flags.ftKinRevengeAt = l.age + randInt(l, 4, 9);
  if (chance(l, selfdef ? 0.5 : 0.4)) { nextUp(l, "ft.l.arrest", { sev: selfdef ? 2 : 3, ...(selfdef ? { selfdef: 1 } : {}) }); return " ยามมาถึงก่อนเลือดจะแห้ง"; }
  return "";
}
const KIN = after(E("ft.ug.kin", [16, 900], "คนแปลกหน้ายืนรอหน้าบ้านคุณ \"ข้าเป็นน้องของคนที่ท่านฆ่า ข้ารอวันนี้มาหลายปีแล้ว\"", [
  P("สู้เพื่อชีวิต", (l) => fightOdds(l, 24), N("เขาล้มลง และคุณรู้ว่าวันหนึ่งจะมีคนมาหาคุณอีก", { joy: -6 }, (l) => lean(l, { m: -3 })), B("เขาทิ้งแผลไว้แล้วหายไปในฝูงชน", { hp: -12 })),
  PAY("ชดใช้ค่าสินไหมให้ครอบครัวเขา", 40, G("เขารับเงินด้วยมือที่สั่น แล้วเดินจากไปโดยไม่พูดอะไร", { joy: 2 }, (l) => lean(l, { m: 4 }))),
  K("เล่าความจริงทั้งหมดว่าเกิดอะไรขึ้นคืนนั้น", "looks", 50, G("เขาฟังจนจบ แล้วทิ้งมีดลงบนพื้น", { joy: 4 }, (l) => lean(l, { h: 3 })), B("ความจริงไม่ได้ทำให้เขาเจ็บน้อยลง", { hp: -8 })),
], { title: "คนที่ไม่ลืม", forced: true, maxTimes: 0, when: (l) => on(l) && !jailed(l) && l.flags.ftKinRevengeAt !== undefined && l.age >= Number(l.flags.ftKinRevengeAt) }), (l) => { delete l.flags.ftKinRevengeAt; });

// ───────────── ทุกปี ─────────────
function lawYear(l: Life) {
  if (!on(l) || !l.alive) return;
  const u = fl(l).ug;
  if (u && u.heat > 0) fl(l).ug = { ...u, heat: Math.max(0, u.heat - HEAT_DECAY * (jailed(l) ? 2 : 1)) };
  if (jailed(l)) {
    // เข้าคุกจากทางไหนก็ตาม (ศาล งาน หนี้) นับเป็นช่วงชีวิตใหม่
    if (!l.flags.ftInJail) { l.flags.ftInJail = true; if (Number(l.flags.ftJailFrom ?? -1) < l.age - 1) l.flags.ftJailFrom = l.age - 1; fl(l).escape = 0; log(l, `ชีวิตในคุกเริ่มต้นแล้ว เหลืออีก ${yearsLeft(l)} ปี · ทำได้เฉพาะสิ่งที่ทำในคุกได้ (แท็บทำ)`, "bad"); }
    addStat(l, "happiness", -3); addStat(l, "health", -randInt(l, 0, 2));
  } else if (l.flags.ftInJail || (l.flags.jailUntil !== undefined && Number(l.flags.jailUntil) <= l.age)) {
    const escaped = !!l.flags.ftEscaped; delete l.flags.ftEscaped;
    delete l.flags.jailUntil; delete l.flags.ftInJail; fl(l).escape = 0;
    if (escaped) return;
    l.flags.ftReleased = l.age;
  }
}

export const UNDERWORLD_EVENTS: GameEvent[] = [JOIN, UG_JOB, HEIST, RAID, ESCAPE, APPEAL, ...PRISON_EVENTS, KIN];
/** ในคุกเกิดได้แค่เรื่องของคุก การทะลวงขั้นในห้องขัง ฉากสุดท้ายของชีวิต และเพื่อนที่มาช่วยให้ออกจากคุก · เรื่องชีวิตในบ้านรอจนพ้นโทษ */
const JAIL_EVENTS = /^ft\.(ug\.|break_|f2\.last|fr\.jail)/;

/** เรียกหลังลงทะเบียน event ทั้งหมดแล้ว */
export function loadUnderworld() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push(lawYear);
  getEvent("ft.l.arrest")?.choices?.splice(1, 0, ...COURT);
  // ค่าปรับใช้ได้เฉพาะคดีเล็ก · แก้ต่างเองยากขึ้นตามความหนักของคดี ทนายจึงมีความหมาย
  for (const ch of getEvent("ft.l.arrest")?.choices ?? []) {
    const lab = typeof ch.label === "string" ? ch.label : "";
    if (lab === "จ่ายค่าปรับ") { const req = ch.req; ch.req = (l, c) => (sevOf(c) >= 2 ? "คดีนี้หนักเกินกว่าจะจบด้วยค่าปรับ" : req?.(l, c)); }
    if (lab === "แก้ต่างในศาล" && ch.check) ch.check = { ...ch.check, bonus: (l, c) => -SELF_DEFEND * sevOf(c) - (harsh(l) ? 0.1 : 0) };
  }
  // ศาลเดิมใช้คำตัดสินเดียวกับศาลใหม่ เพื่อให้คุกเป็นช่วงชีวิตจริง
  for (const ch of getEvent("ft.l.arrest")?.choices ?? []) if (!COURT.includes(ch)) {
    const run = ch.run;
    ch.run = (l, c, ok) => { const before = Number(l.flags.jailUntil ?? -1); const out = run(l, c, ok); if (Number(l.flags.jailUntil ?? -1) > before && before <= l.age) { l.flags.ftJailFrom = l.age; fl(l).escape = 0; } return out; };
  }
  // รับจ้างฆ่าสำเร็จคือการฆ่าคน · ชนะโจรกลางทางบางครั้งมีคนตาย (ป้องกันตัว)
  const hit = getEvent("ft.l.crime")?.choices?.[2];
  if (hit) { const run = hit.run; hit.run = (l, c, ok) => { const out = run(l, c, ok); return ok && l.alive ? { ...out, text: out.text + killedSomeone(l, false) } : out; }; }
  const road = getEvent("ft.dg.road")?.choices?.[0];
  if (road) { const run = road.run; road.run = (l, c, ok) => { const out = run(l, c, ok); return ok && l.alive && chance(l, 0.2) ? { ...out, text: out.text + " โจรคนหนึ่งไม่ลุกขึ้นมาอีก" + killedSomeone(l, true) } : out; }; }
  // ในคุกเห็นแค่สิ่งที่ทำในคุกได้ (ไม่ต้องไล่ดูปุ่มที่ล็อกทั้งหน้า) · ปุ่มของคุกซ่อนไว้ตอนอยู่ข้างนอก · ภัยข้างนอกตามมาไม่ถึง
  activityFilters.push((l, a) => (jailed(l) ? a.id.startsWith("ft_p_") || /_rest$/.test(a.id) : !a.id.startsWith("ft_p_")));
  activityFilters.push((l, a) => a.id !== "ft_ug_join" || !fl(l).ug?.rank);
  activityFilters.push((l, a) => a.id !== "ft_p_escape" || (fl(l).escape ?? 0) >= ESCAPE_STEPS);
  eligibilityFilters.push((l, e) => !jailed(l) || JAIL_EVENTS.test(e.id));
}

/** สรุปสำหรับแท็บพลัง */
export function lawLines(l: Life): string[] {
  const f = fl(l), out: string[] = [];
  if (jailed(l)) out.push(`ติดคุก · เหลืออีก ${yearsLeft(l)} ปี${(f.escape ?? 0) > 0 ? ` · แผนแหกคุก ${f.escape}/${ESCAPE_STEPS}` : ""}`);
  if (f.ug?.rank) out.push(`กิลด์โจร: ${UG_RANKS[f.ug.rank]} · ผลงาน ${f.ug.merit}/${f.ug.rank * 3}${f.ug.rank >= 5 ? " (ขั้นสูงสุด)" : ""} · ยามจับตามอง ${f.ug.heat}${f.ug.heat >= RAID_HEAT && !jailed(l) ? " (ยามใกล้บุกแล้ว)" : ""}`);
  if ((f.crimes ?? 0) > 0) out.push(`ประวัติอาชญากรรม ${f.crimes} คดี${(f.crimes ?? 0) >= 4 ? " · ศาลจะลงโทษหนักขึ้น" : ""} · ชื่อเสียงใน${homeKingdom(l).name} ${standingOf(l)}`);
  if ((f.kills ?? 0) > 0) out.push(`คนที่ตายด้วยมือคุณนอกสงคราม ${f.kills} คน`);
  return out;
}
