// สังคม (Release 13): วัฒนธรรมของแต่ละแผ่นดิน ชนชั้นที่ปีนได้ ชื่อเสียงหลายด้าน ทางในราชสำนัก การปกครองที่ต้องตัดสินใจทุกปี
// ศรัทธาที่มีพรและหน้าที่ การล่าคนนอกรีต สงครามศักดิ์สิทธิ์ สมาคมลับ กบฏ และการเดินทางข้ามแผ่นดินที่เป็นการเดินทางจริง
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Ctx, GameEvent } from "../../engine/events";
import { jobChanceHooks, runEvent, salaryHooks, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, addStat, clamp, createPerson, log, shortName } from "../../engine/util";
import { B, BIG, C, E, G, GOLD, K, N, P, PAY, SCENE } from "./kit";
import { fightOdds } from "./power";
import { addStanding, deed, fl, homeKingdom, kingdomsOf, standingOf, type Kingdom } from "./state";
import { lean, personaOf } from "./persona";
import { GODS } from "./hobbies";
import { cityOf, moveTo } from "./cities";
import { crown, throneOf } from "./realm";
import { famOf, type Fam } from "./careers2";
import { taxRate } from "./money2";
import { nextUp } from "./danger";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
const gold = (l: Life) => Math.floor(l.money / GOLD);
const jailed = (l: Life) => Number(l.flags.jailUntil ?? -1) > l.age;
const yearly = (k: string) => (l: Life) => Number(l.flags[k] ?? -1) !== l.age;
const after = (e: GameEvent, fn: (l: Life, c: Ctx) => void): GameEvent => ({ ...e, choices: e.choices?.map((ch) => ({ ...ch, run: (l, c, ok) => { fn(l, c); return ch.run(l, c, ok); } })) });
const hash = (s: string) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 1009; return h; };

// ───────────── วัฒนธรรมของแผ่นดิน ─────────────
export type Value = "honour" | "trade" | "faith" | "magic";
export const CULTURES: Record<Value, { name: string; desc: string; fams: Fam[] }> = {
  honour: { name: "เกียรติและดาบ", desc: "นักรบและขุนนางรุ่งเรือง คนรักษาคำพูดได้รับความนับถือ", fams: ["arms", "court"] },
  trade: { name: "การค้าและท่าเรือ", desc: "พ่อค้าและนักเดินทางรุ่งเรือง เงินพูดได้ดังกว่าตระกูล", fams: ["trade", "travel", "craft"] },
  faith: { name: "ศรัทธาและวิหาร", desc: "นักบวชมีอำนาจ คนนอกรีตอยู่ยาก", fams: ["faith"] },
  magic: { name: "เวทและตำรา", desc: "นักเวทและนักปราชญ์รุ่งเรือง หอคอยมีเสียงในสภา", fams: ["magic", "arts"] },
};
const VALUES = Object.keys(CULTURES) as Value[];
/** แผ่นดินตั้งต้นมีวัฒนธรรมตามเรื่องของมัน · แผ่นดินที่เกิดใหม่สุ่มจากชื่อ */
const BASE: Record<string, [Value, string]> = { aldria: ["faith", "solia"], varn: ["honour", "garroth"], thalos: ["trade", "myra"] };
export const cultureOf = (k: Kingdom): Value => BASE[k.id]?.[0] ?? VALUES[hash(k.id) % VALUES.length];
export const godOfKingdom = (k: Kingdom) => GODS.find((g) => g.id === BASE[k.id]?.[1]) ?? GODS[hash(k.id + "g") % GODS.length];
export const CULTURE_EDGE = 0.08, CULTURE_PAY = 0.1;

// ───────────── ชนชั้น ─────────────
export const CLASSES = ["ไพร่", "สามัญชน", "คหบดี", "ผู้ดี", "ขุนนาง"];
export function classOf(l: Life): number {
  const f = fl(l);
  if (throneOf(l) || l.flags.ftNobleBlood === "known" || l.flags.ftNobleWed || (f.court?.rank ?? 0) >= 3) return 4;
  if (l.flags.ftLord || (f.court?.rank ?? 0) >= 1 || l.fame >= 50) return 3;
  if (gold(l) >= 300 || (f.biz?.level ?? 0) >= 3) return 2;
  return l.wealth === "poor" && gold(l) < 20 ? 0 : 1;
}

// ───────────── ชื่อเสียงหลายด้าน ─────────────
export type Rep = "honour" | "cruelty" | "wealth" | "skill" | "faith";
export const REP_NAME: Record<Rep, string> = { honour: "เกียรติ", cruelty: "ความโหด", wealth: "ความมั่งคั่ง", skill: "ฝีมือ", faith: "ศรัทธา" };
export function repsOf(l: Life): Record<Rep, number> {
  const p = personaOf(l), f = fl(l);
  return {
    honour: clamp(Math.round(40 + p.h * 0.6 + (f.kills ? -10 : 0) + Math.min(20, f.deeds.length * 2)), 0, 100),
    cruelty: clamp(Math.round(-p.m * 0.8 + (f.kills ?? 0) * 8), 0, 100),
    wealth: clamp(Math.round(Math.log10(Math.max(1, gold(l))) * 22), 0, 100),
    skill: clamp(Math.max(f.bodyRank, f.magicRank) * 15 + (l.job?.level ?? 0) * 6, 0, 100),
    faith: clamp(Math.round(30 + p.f * 0.7 + (f.god ? 15 : 0)), 0, 100),
  };
}
/** งานแต่ละสายดูชื่อเสียงคนละด้าน */
const FAM_REP: Partial<Record<Fam, Rep>> = { court: "honour", arms: "skill", trade: "wealth", travel: "wealth", faith: "faith", magic: "skill", craft: "skill" };

// ───────────── ราชสำนัก ─────────────
export const COURT_RANKS = ["", "ข้าราชสำนัก", "ที่ปรึกษา", "ขุนนาง", "คนสนิทของบัลลังก์"];
export const favorNeed = (rank: number) => 60 + rank * 10;
const court = (l: Life) => fl(l).court ?? { rank: 0, favor: 0 };
const addFavor = (l: Life, d: number): string => {
  const c = { ...court(l) };
  c.favor = clamp(c.favor + d, 0, 100);
  let up = "";
  if (c.rank < 4 && c.favor >= favorNeed(c.rank)) { c.rank++; c.favor = 30; up = ` ผู้ครองแต่งตั้งคุณเป็น${COURT_RANKS[c.rank]}`; if (c.rank >= 3) deed(l, `${COURT_RANKS[c.rank]}แห่ง${homeKingdom(l).name}`); addStanding(l, 4); }
  fl(l).court = c;
  return up;
};
const canCourt = (l: Life) => on(l) && !jailed(l) && !throneOf(l) && (classOf(l) >= 2 || l.fame >= 30 || court(l).rank > 0);
const single = (l: Life) => !l.people.some((p) => p.alive && (p.relation === "spouse" || p.relation === "partner"));
const COURT_EV = SCENE("ft.so.court", "ราชสำนัก", (l) => `โถงใหญ่ของ${homeKingdom(l).name} ${homeKingdom(l).ruler}นั่งบนบัลลังก์ · คุณเป็น${COURT_RANKS[court(l).rank] || "แขกของราชสำนัก"} · ความโปรดปราน ${court(l).favor}/${favorNeed(court(l).rank)}`, [
  K("รับใช้งานราชการอย่างซื่อตรง", "smarts", 45, (l) => ({ text: `งานของคุณเรียบร้อยไม่มีที่ติ${addFavor(l, 10 + Math.round(repsOf(l).honour / 10))}`, kind: "good" }), N("งานล่าช้า และคนในสภาเริ่มพูดถึงคุณในทางไม่ดี", {}, (l) => { addFavor(l, -5); })),
  P("วางแผนให้คู่แข่งในราชสำนักเสียหน้า", (l) => clamp(0.45 + (l.stats.smarts - 50) / 150 - personaOf(l).h / 300, 0.1, 0.85), (l) => { lean(l, { h: -4 }); const r = createPerson(l, "rival", { age: Math.max(20, l.age + randInt(l, -10, 10)), bond: 10 }); r.job = `ขุนนางที่เสียหน้าเพราะคุณ`; return { text: `คู่แข่งพูดผิดต่อหน้าผู้ครอง และทุกคนหันมามองคุณแทน${addFavor(l, 20)}`, kind: "good" }; }, (l) => { addFavor(l, -15); addStanding(l, -3); return { text: "แผนของคุณย้อนกลับ ทั้งสภารู้ว่าใครอยู่เบื้องหลัง", kind: "bad" }; }),
  C((l) => `ถวายของขวัญแด่ผู้ครอง (${20 + court(l).rank * 20} เหรียญทอง)`, (l) => { addMoney(l, -(20 + court(l).rank * 20) * GOLD); return { text: `ผู้ครองยิ้มให้ของขวัญชิ้นนั้น${addFavor(l, 10)}`, kind: "good" }; }, { req: (l) => (l.money < (20 + court(l).rank * 20) * GOLD ? `ต้องมี ${20 + court(l).rank * 20} เหรียญทอง` : undefined) }),
  K("ขอให้ผู้ครองจับคู่แต่งงานกับตระกูลขุนนาง", "looks", 55, (l) => { const sp = createPerson(l, "spouse", { gender: l.gender === "m" ? "f" : "m", age: Math.max(18, l.age + randInt(l, -5, 3)), bond: 45 }); sp.job = "ทายาทตระกูลขุนนาง"; sp.tags = [...(sp.tags ?? []), "noble"]; l.flags.ftNobleWed = true; return { text: `คุณแต่งงานกับ${shortName(sp)}ทายาทตระกูลเก่าแก่ ประตูทุกบานในราชสำนักเปิดให้คุณ${addFavor(l, 5)}`, kind: "milestone" }; }, N("ตระกูลขุนนางส่งคำตอบกลับมาสุภาพ แต่ชัดเจนว่าไม่"), { show: (l) => single(l) && court(l).rank >= 1 && !l.flags.ftNobleWed }),
  C("กลับบ้าน", N("คุณโค้งแล้วถอยออกจากโถงใหญ่")),
]);
const PLOT = after(E("ft.so.plot", [18, 900], (l) => `ขุนนางกลุ่มหนึ่งในราชสำนักของ${homeKingdom(l).name}วางแผนวางยา${homeKingdom(l).ruler} และพวกเขาอยากให้คุณเข้าร่วม`, [
  C("แอบไปทูลผู้ครอง", (l) => { lean(l, { h: 3 }); return { text: `ผู้วางแผนถูกจับทั้งหมดก่อนรุ่งสาง${addFavor(l, 25)}`, kind: "good" }; }),
  P("เข้าร่วมแผน", (l) => clamp(0.35 + (l.stats.smarts - 50) / 200, 0.1, 0.7), (l) => { const k = homeKingdom(l); k.ruler = `${pick(l, ["ดยุก", "เคานต์", "ท่านหญิง"])}${pick(l, ["เอดริก", "มอร์แกน", "เซลีน", "โอเว่น"])}`; k.stability = clamp(k.stability - 15, 5, 95); fl(l).court = { rank: Math.min(4, court(l).rank + 1), favor: 40 }; lean(l, { h: -6, m: -4 }); return { text: `${k.ruler}ขึ้นครองแทน และไม่ลืมคนที่ช่วยให้นั่งบัลลังก์ได้`, kind: "milestone" }; }, (l) => { fl(l).court = undefined; nextUp(l, "ft.l.arrest", { sev: 3 }); return { text: "แผนรั่ว ทหารองครักษ์มาถึงบ้านคุณพร้อมโซ่", kind: "bad" }; }),
  C("ไม่ขอยุ่ง", N("คุณทำเป็นไม่ได้ยิน และนอนไม่หลับไปหลายคืน")),
], { title: "แผนในวัง", when: (l) => on(l) && court(l).rank >= 1 && !throneOf(l) && l.age - Number(l.flags.ftPlotAt ?? -99) >= 8, weight: 12, maxTimes: 0 }), (l) => { l.flags.ftPlotAt = l.age; });
const REGENT = after(E("ft.so.regent", [25, 900], (l) => `${homeKingdom(l).ruler}ประชวรหนักและไม่มีทายาท สภาขุนนางลงมติให้คุณสำเร็จราชการ และสืบบัลลังก์ต่อ`, [
  C("รับมงกุฎ", (l) => { crown(l, homeKingdom(l), "ได้รับเลือกจากสภาขุนนาง"); fl(l).court = undefined; return { text: "เสียงระฆังดังทั่วเมืองหลวง คุณคือผู้ครองแผ่นดินคนใหม่", kind: "milestone" }; }),
  C("ปฏิเสธและเสนอคนอื่น", N("สภาเงียบไปนาน แล้วเลือกคนที่คุณเสนอ ทุกคนรู้ว่าคนที่สละบัลลังก์ได้คือคนที่ควรได้มันที่สุด", { fame: 5 }, (l) => { addStanding(l, 8); lean(l, { h: 4 }); })),
], { title: "สภาเลือกผู้สืบบัลลังก์", when: (l) => on(l) && court(l).rank >= 4 && !throneOf(l) && !homeKingdom(l).playerRuled, weight: 15, maxTimes: 1 }), () => {});

// ───────────── ปกครองต้องตัดสินใจทุกปี ─────────────
const ISSUES = ["famine", "rebels", "taxes", "heir", "border"] as const;
const tk = (l: Life) => throneOf(l)!;
const move = (stab: number, power: number, prosp: number) => (l: Life) => { const k = tk(l); k.stability = clamp(k.stability + stab, 5, 95); k.power = clamp(k.power + power, 5, 95); k.prosperity = clamp((k.prosperity ?? 100) + prosp, 40, 160); };
const ISSUE_TEXT: Record<(typeof ISSUES)[number], string> = {
  famine: "ข้าวยากหมากแพงในหัวเมืองทางใต้ ชาวบ้านส่งคนมาขอให้เปิดยุ้งฉางหลวง",
  rebels: "กลุ่มคนถือธงสีดำยึดหมู่บ้านทางเหนือ ประกาศว่าไม่ขึ้นกับบัลลังก์อีกแล้ว",
  taxes: "ขุนคลังรายงานว่าคลังหลวงพร่องลงทุกปี และขอให้ขึ้นภาษี",
  heir: "สภาขุนนางถามว่าใครจะสืบบัลลังก์ต่อจากคุณ ทุกคนรอคำตอบ",
  border: "แผ่นดินเพื่อนบ้านส่งทหารมาตั้งค่ายชิดชายแดน",
};
const issueOf = (c: Ctx) => ISSUES[Number(c.is ?? 0)];
const RULE = after(E("ft.so.rule", [16, 900], (l, c) => `ปีนี้ในฐานะผู้ครอง${tk(l).name}: ${ISSUE_TEXT[issueOf(c)]} (ความมั่นคง ${tk(l).stability} · กำลัง ${tk(l).power})`, [
  C((_l, c) => ({ famine: "เปิดยุ้งฉางหลวงแจกจ่าย", rebels: "ส่งทูตไปเจรจา", taxes: "ลดรายจ่ายในวังแทนขึ้นภาษี", heir: "ประกาศชื่อลูกคนโต", border: "ส่งทูตไปเจรจาสงบศึก" })[issueOf(c)], (l, c) => { const is = issueOf(c); if (is === "famine") move(10, 0, -6)(l); else if (is === "rebels") move(6, -4, 0)(l); else if (is === "taxes") { move(5, 0, 0)(l); addStat(l, "happiness", -3); } else if (is === "heir") move(6, 0, 0)(l); else move(3, -3, 0)(l); lean(l, { m: 3 }); return { text: "คำสั่งของคุณถูกประกาศทั่วแผ่นดิน ผู้คนพูดถึงความเมตตาของผู้ครอง", kind: "good" }; }),
  C((_l, c) => ({ famine: "ปล่อยให้แต่ละเมืองจัดการกันเอง", rebels: "ส่งทัพไปปราบ", taxes: "ขึ้นภาษีทั้งแผ่นดิน", heir: "ไม่ตอบ ปล่อยให้ทุกคนแย่งกันเอง", border: "ส่งทัพไปตั้งรับที่ชายแดน" })[issueOf(c)], (l, c) => { const is = issueOf(c); if (is === "famine") move(-12, 0, 2)(l); else if (is === "rebels") { move(-4, 4, 0)(l); lean(l, { m: -4 }); } else if (is === "taxes") { move(-8, 3, 0)(l); addMoney(l, 40 * GOLD); } else if (is === "heir") move(-6, 0, 0)(l); else move(-2, 5, 0)(l); return { text: "คำสั่งของคุณถูกปฏิบัติ และผู้คนเรียนรู้ที่จะกลัวคุณ", kind: "bad" }; }),
], { title: "ราชกิจประจำปี", forced: true, maxTimes: 0, when: (l) => on(l) && !!throneOf(l) && Number(l.flags.ftRuleAt ?? -1) !== l.age, prepare: (l) => ({ is: randInt(l, 0, ISSUES.length - 1) }) }), (l) => { l.flags.ftRuleAt = l.age; });

// ───────────── ศรัทธา ─────────────
const god = (l: Life) => GODS.find((g) => g.id === fl(l).god);
export const DUTY_GAP = 4, BLESS_CHANCE = 0.3;
/** พรเล็กๆ ทุกปีของผู้ที่อุทิศตน (เบากว่าพรที่ขอเองที่วิหาร) */
const BLESS: Record<string, (l: Life) => string> = {
  solia: (l) => { addStat(l, "health", 2); return "แผลเล็กๆ หายเร็วกว่าที่ควร"; },
  garroth: (l) => { fl(l).body += 4; return "แขนของคุณหนักแน่นขึ้นโดยไม่ต้องฝึก"; },
  myra: (l) => { addMoney(l, 3 * GOLD); return "คุณเก็บเหรียญที่ใครทำตกไว้ได้บนทาง"; },
  alven: (l) => { fl(l).magic += 3; return "คุณฝันถึงตำราที่ไม่เคยอ่าน แล้วจำได้บางหน้า"; },
  verda: (l) => { addStat(l, "happiness", 2); return "บ้านของคุณอบอุ่นขึ้นตลอดปี"; },
};
const DEVOTE = SCENE("ft.so.devote", "อุทิศตนให้เทพ", (l) => `เทพหลักของ${homeKingdom(l).name}คือ${godOfKingdom(homeKingdom(l)).name} ผู้ที่อุทิศตนจะได้พรทุกปี แต่ต้องทำหน้าที่ต่อเทพด้วย`, [
  ...GODS.map((g) => C(`${g.name} · เทพแห่ง${g.domain}`, (l) => { fl(l).god = g.id; fl(l).godLost = undefined; l.flags.ftDutyAt = l.age; lean(l, { f: 6 }); return { text: `คุณคุกเข่าต่อหน้า${g.name}และให้คำสัตย์`, kind: "milestone" }; }, { show: (l) => fl(l).god !== g.id })),
  C("ไม่ผูกตัวกับเทพองค์ใด", N("คุณจุดเทียนให้ทุกแท่นบูชาแล้วเดินออกมา")),
]);
const DUTY = after(E("ft.so.duty", [14, 900], (l) => `ถึงเวลาทำหน้าที่ต่อ${god(l)!.name}: วิหารขอเงินบำรุงหนึ่งในสิบของทรัพย์สิน หรือการแสวงบุญไปยังแท่นบูชาแห่งแรก`, [
  C((l) => `ถวายเงินบำรุง (${Math.max(2, Math.round(gold(l) / 10))} เหรียญทอง)`, (l) => { addMoney(l, -Math.max(2, Math.round(gold(l) / 10)) * GOLD); lean(l, { f: 3 }); return { text: "นักบวชจดชื่อคุณในสมุดผู้ศรัทธา", kind: "good" }; }, { req: (l) => (gold(l) < 2 ? "ต้องมีเงินสักเล็กน้อย" : undefined) }),
  C("ออกแสวงบุญ", G("การเดินทางสามเดือนทำให้เท้าแตกแต่ใจสงบ", { joy: 6, hp: -2 }, (l) => { lean(l, { f: 4 }); addStanding(l, 2); })),
  C("ปีนี้ขอเว้นไว้ก่อน", N("เทียนบนแท่นบูชาของคุณดับลงเอง", { joy: -3 }, (l) => { fl(l).godLost = l.age; })),
], { title: "หน้าที่ต่อเทพ", when: (l) => on(l) && !!fl(l).god && !jailed(l) && l.age - Number(l.flags.ftDutyAt ?? -99) >= DUTY_GAP, weight: 30, maxTimes: 0 }), (l) => { l.flags.ftDutyAt = l.age; });
const HERESY = after(E("ft.so.heresy", [14, 900], (l) => `นักไต่สวนแห่ง${godOfKingdom(homeKingdom(l)).name}มาเคาะประตู ${fl(l).race === "demon" ? "เลือดปีศาจในตัวคุณคือความผิดในสายตาพวกเขา" : `การบูชา${god(l)?.name ?? "เทพอื่น"}ในแผ่นดินนี้คือความนอกรีต`}`, [
  C((l) => `เปลี่ยนมาบูชา${godOfKingdom(homeKingdom(l)).name}`, N("คุณคุกเข่าต่อหน้าแท่นบูชาใหม่ นักไต่สวนพยักหน้าแล้วจากไป", {}, (l) => { fl(l).god = godOfKingdom(homeKingdom(l)).id; lean(l, { f: -2 }); }), { show: (l) => fl(l).race !== "demon" }),
  K("ซ่อนแท่นบูชาและทำเป็นไม่รู้เรื่อง", "luck", 50, N("พวกเขาค้นทั้งบ้านแต่ไม่เจออะไร"), B("พวกเขาเจอแท่นบูชาใต้พื้น คุณถูกปรับและถูกจับตา", { gold: -15 }, (l) => addStanding(l, -8))),
  P("ไล่พวกเขาออกไป", (l) => fightOdds(l, 26), G("นักไต่สวนหนีไป แต่จะกลับมาพร้อมคนอีกมาก", {}, (l) => addStanding(l, -10)), B("พวกเขาลากคุณไปลงโทษที่ลานวิหาร", { hp: -12 }, (l) => addStanding(l, -6))),
  C("ย้ายไปแผ่นดินอื่น", (l) => { const k = pick(l, kingdomsOf(l).filter((x) => x.id !== homeKingdom(l).id)); moveTo(l, k); return { text: `คุณออกเดินทางไป${k.name}ก่อนรุ่งสาง`, kind: "bad" }; }),
], { title: "นักไต่สวน", when: (l) => on(l) && cultureOf(homeKingdom(l)) === "faith" && (fl(l).race === "demon" || (!!fl(l).god && fl(l).god !== godOfKingdom(homeKingdom(l)).id)) && l.age - Number(l.flags.ftHeresyAt ?? -99) >= 6, weight: 14, maxTimes: 0 }), (l) => { l.flags.ftHeresyAt = l.age; });
const HOLY = after(E("ft.so.holywar", [16, 70], (l) => `นักบวชประกาศสงครามศักดิ์สิทธิ์ในนามของ${godOfKingdom(homeKingdom(l)).name} ทุกคนที่ถือดาบได้ถูกเรียกไปแนวหน้า`, [
  P("ไปรบในนามของเทพ", (l) => fightOdds(l, 32), BIG("คุณกลับมาพร้อมธงของศัตรูและพรจากนักบวชสูงสุด", { fame: 6 }, (l) => { deed(l, `ผู้รบในสงครามศักดิ์สิทธิ์แห่ง${godOfKingdom(homeKingdom(l)).name}`); lean(l, { f: 5 }); addStanding(l, 5); }), B("คุณกลับมาพร้อมแผลและคำถามที่ไม่มีใครตอบ", { hp: -14 })),
  C("ปฏิเสธ", N("ชื่อคุณถูกอ่านในวิหารว่าเป็นคนไร้ศรัทธา", {}, (l) => { addStanding(l, -5); lean(l, { f: -3 }); })),
  PAY("บริจาคเงินแทนการไปรบ", 25, N("นักบวชรับเงินแล้วยกโทษให้คุณต่อหน้าทุกคน")),
], { title: "สงครามศักดิ์สิทธิ์", when: (l) => on(l) && cultureOf(homeKingdom(l)) === "faith" && !!homeKingdom(l).war && !jailed(l), weight: 10, maxTimes: 1 }), () => {});

// ───────────── สมาคมลับ ─────────────
const SECRET_MISSIONS = ["ขโมยจดหมายจากโต๊ะของขุนคลัง", "ตามดูว่าทูตต่างแดนพบใครตอนกลางคืน", "แอบวางหนังสือต้องห้ามไว้ในห้องสมุดหลวง", "ซื้อเสียงสมาชิกสภาสองคน"];
const shadow = (l: Life) => fl(l).shadow;
const SECRET_INVITE = after(E("ft.so.secret", [20, 900], "จดหมายไม่มีชื่อผู้ส่งวางอยู่บนหมอน \"เราเฝ้าดูท่านมานาน ถ้าอยากรู้ว่าใครปกครองแผ่นดินจริงๆ คืนพรุ่งนี้มาที่ห้องใต้ดินของโรงเตี๊ยม\"", [
  C("ไปตามนัด", N("คนสวมหน้ากากสิบสามคนนั่งรอบโต๊ะกลม พวกเขาเรียกตัวเองว่าวงเงา คุณสาบานด้วยเลือดหนึ่งหยด", {}, (l) => { fl(l).shadow = { rank: 1, missions: 0 }; lean(l, { h: -2 }); })),
  C("เผาจดหมายทิ้ง", N("ไม่มีจดหมายมาอีก แต่บางคืนคุณรู้สึกว่ามีคนเฝ้ามองอยู่")),
], { title: "จดหมายไม่มีชื่อ", when: (l) => on(l) && !shadow(l) && (l.stats.smarts >= 60 || l.fame >= 25), weight: 6, maxTimes: 1 }), () => {});
const SECRET_JOB = after(E("ft.so.secret_job", [20, 900], (l) => `วงเงาส่งงานมา: ${SECRET_MISSIONS[(shadow(l)!.missions) % SECRET_MISSIONS.length]}`, [
  P("ทำงานให้สำเร็จ", (l) => clamp(0.5 + (l.stats.luck - 50) / 200 + (l.stats.smarts - 50) / 300, 0.15, 0.9), (l) => { const s = shadow(l)!; s.missions++; if (s.missions % 3 === 0 && s.rank < 3) s.rank++; addMoney(l, 15 * GOLD); return { text: `งานเสร็จโดยไม่มีใครเห็น วงเงาส่งเงินมาให้ 15 เหรียญทอง${s.rank >= 3 && s.missions === 6 ? " และเชิญคุณเข้าร่วมวงใน" : ""}`, kind: "good" }; }, (l) => { addStanding(l, -5); return { text: "คุณเกือบถูกจับได้ และวงเงาไม่ชอบคนที่ทำพลาด", kind: "bad" }; }),
  C("ปฏิเสธงานนี้", N("ไม่มีใครตอบจดหมายของคุณ จนกระทั่งมีมีดปักอยู่บนประตู", {}, (l) => { addStat(l, "happiness", -4); })),
], { title: "งานของวงเงา", when: (l) => on(l) && !!shadow(l) && !shadow(l)!.out && !jailed(l) && Number(l.flags.ftSecretAt ?? -1) !== l.age, weight: 20, maxTimes: 0 }), (l) => { l.flags.ftSecretAt = l.age; });
const SECRET_PLOT = E("ft.so.secret_plot", [25, 900], (l) => `ในวงในของวงเงา คุณรู้ความจริง: พวกเขาจะวางหุ่นเชิดไว้บนบัลลังก์ของ${homeKingdom(l).name} และปกครองจากเงามืด`, [
  C("ช่วยพวกเขา", (l) => { const k = homeKingdom(l); k.ruler = `หุ่นเชิดของวงเงา ${pick(l, ["เจ้าชายลีออน", "เจ้าหญิงมาริส", "ดยุกเฟลิกซ์"])}`; k.stability = clamp(k.stability - 10, 5, 95); shadow(l)!.out = true; deed(l, `ผู้อยู่เบื้องหลังบัลลังก์${k.name}`); addMoney(l, 80 * GOLD); lean(l, { h: -6 }); return { text: "บัลลังก์ได้ผู้ครองคนใหม่ที่ไม่มีใครรู้ว่าใครเป็นคนเลือก นอกจากคุณ", kind: "milestone" }; }),
  C("หักหลังวงเงาต่อผู้ครอง", (l) => { shadow(l)!.out = true; addStanding(l, 12); deed(l, `ผู้เปิดโปงวงเงา`); fl(l).court = { rank: Math.max(2, court(l).rank), favor: 40 }; return { text: "วงเงาถูกกวาดล้างทั้งวง ผู้ครองขอบคุณคุณด้วยตำแหน่ง แต่คนที่หนีรอดจะไม่ลืม", kind: "milestone" }; }),
  C("ถอนตัวเงียบๆ", N("คุณคืนแหวนของวงเงาไว้บนโต๊ะแล้วเดินออกมา ไม่มีใครห้าม", {}, (l) => { shadow(l)!.out = true; })),
], { title: "ความจริงของวงเงา", forced: true, maxTimes: 1, when: (l) => on(l) && (shadow(l)?.rank ?? 0) >= 3 && !shadow(l)!.out });

// ───────────── กบฏ ─────────────
const REBEL_INVITE = after(E("ft.so.rebel", [18, 900], (l) => `${homeKingdom(l).name}อดอยากและถูกกดขี่ ชายตาเดียวในโรงเตี๊ยมกระซิบ "เรากำลังจะโค่น${homeKingdom(l).ruler} ท่านอยู่ข้างไหน"`, [
  C("เข้าร่วมกบฏ", N("คุณได้ผ้าพันคอสีแดงและชื่อจัดตั้งใหม่", {}, (l) => { fl(l).rebel = { missions: 0, kingdom: homeKingdom(l).id }; lean(l, { c: 3 }); })),
  C("แอบรายงานยาม", N("ยามขอบคุณ ชายตาเดียวหายไปในคืนนั้น", {}, (l) => { addStanding(l, 4); lean(l, { m: -3 }); })),
  C("อยู่เฉยๆ", N("คุณจ่ายค่าเหล้าแล้วเดินออกไป")),
], { title: "ผ้าพันคอสีแดง", when: (l) => on(l) && !fl(l).rebel && !throneOf(l) && !homeKingdom(l).playerRuled && homeKingdom(l).stability < 40 && l.age - Number(l.flags.ftRebelAskAt ?? -99) >= 10, weight: 10, maxTimes: 0 }), (l) => { l.flags.ftRebelAskAt = l.age; });
const rebel = (l: Life) => fl(l).rebel;
export const UPRISING_AT = 3;
const REBEL_JOB = after(E("ft.so.rebel_job", [18, 900], "กบฏต้องการคนช่วยขนอาวุธเข้าเมือง และแจกใบปลิวในตลาดก่อนรุ่งสาง", [
  P("รับงาน", (l) => clamp(0.55 + (l.stats.luck - 50) / 200, 0.2, 0.9), (l) => { rebel(l)!.missions++; return { text: "อาวุธถึงที่หมาย และใบปลิวอยู่ในมือคนทั้งตลาด", kind: "good" }; }, (l) => { nextUp(l, "ft.l.arrest", { sev: 2 }); return { text: "ยามเจอดาบใต้กองฟาง", kind: "bad" }; }),
  C("ขอพักสักปี", N("หัวหน้ากบฏพยักหน้า แต่สายตาเย็นลง")),
], { title: "งานของกบฏ", when: (l) => on(l) && !!rebel(l) && rebel(l)!.kingdom === homeKingdom(l).id && rebel(l)!.missions < UPRISING_AT && !jailed(l) && Number(l.flags.ftRebelAt ?? -1) !== l.age, weight: 22, maxTimes: 0 }), (l) => { l.flags.ftRebelAt = l.age; });
const UPRISING = after(E("ft.so.uprising", [18, 900], (l) => `คืนนี้กบฏจะบุกพระราชวังของ${homeKingdom(l).name} และพวกเขาอยากให้คุณเป็นคนนำ`, [
  P("นำการบุก", (l) => fightOdds(l, 40), (l) => { const k = homeKingdom(l); crown(l, k, "นำกบฏโค่นบัลลังก์"); k.stability = 35; return { text: `ประตูวังเปิดก่อนรุ่งสาง ${k.ruler}คือผู้ครองคนใหม่ คือคุณเอง`, kind: "milestone" }; }, (l, c) => (chance(l, 0.25) ? B("หัวของผู้นำกบฏถูกเสียบไว้หน้าประตูเมือง", { die: "ถูกประหารฐานกบฏ" })(l, c) : (nextUp(l, "ft.l.arrest", { sev: 3 }), { text: "การบุกล้มเหลว คุณถูกจับได้ในท่อน้ำใต้วัง", kind: "bad" as const }))),
  C("ให้คนอื่นนำ คุณคอยอยู่แนวหลัง", (l) => { const k = homeKingdom(l); if (chance(l, 0.5)) { k.ruler = `${pick(l, ["แม่ทัพกบฏ", "ผู้นำชาวนา"])} ${pick(l, ["บรอน", "ไอลีน", "ทอร์บยอร์น"])}`; k.stability = 30; addStanding(l, 6); return { text: `บัลลังก์เปลี่ยนมือ ${k.ruler}ขึ้นครอง และจำชื่อคนที่ช่วย`, kind: "milestone" }; } k.stability = clamp(k.stability + 10, 5, 95); return { text: "การบุกล้มเหลว คุณหนีรอดมาได้เพราะอยู่แนวหลัง", kind: "bad" }; }),
  C("ถอนตัวคืนสุดท้าย", N("คุณทิ้งผ้าพันคอสีแดงลงในแม่น้ำ", {}, (l) => lean(l, { c: -4 }))),
], { title: "คืนแห่งการลุกฮือ", forced: true, maxTimes: 0, when: (l) => on(l) && !!rebel(l) && rebel(l)!.kingdom === homeKingdom(l).id && rebel(l)!.missions >= UPRISING_AT && !throneOf(l) && !jailed(l) }), (l) => { fl(l).rebel = undefined; });

// ───────────── ชนชั้น: ขุนนางดูถูกเงินใหม่ ─────────────
const SNEER = after(E("ft.so.sneer", [20, 900], "ในงานเลี้ยงของตระกูลเก่า ท่านหญิงคนหนึ่งพูดดังพอให้ทุกคนได้ยิน \"เงินซื้อเสื้อผ้าได้ แต่ซื้อตระกูลไม่ได้หรอก\"", [
  K("ตอบกลับด้วยไหวพริบ", "smarts", 55, G("ทั้งห้องหัวเราะ และไม่ใช่หัวเราะคุณ", { fame: 2 }, (l) => addStanding(l, 3)), N("คำตอบของคุณช้าไปจังหวะเดียว ทุกคนหันไปคุยเรื่องอื่น", { joy: -3 })),
  C("ยิ้มแล้วบริจาคเงินก้อนใหญ่ในงาน", N("เธอยังดูถูกคุณ แต่คนอื่นในงานไม่กล้าแล้ว", { gold: -20 }, (l) => addStanding(l, 4))),
  C("เดินออกจากงาน", N("คุณกลับบ้านแล้วนั่งนับเงินที่ซื้อตระกูลไม่ได้", { joy: -4 })),
], { title: "เงินใหม่", when: (l) => on(l) && classOf(l) === 2 && l.wealth !== "elite" && l.wealth !== "rich" && !l.flags.ftSneered, weight: 10, maxTimes: 1 }), (l) => { l.flags.ftSneered = true; });

// ───────────── การเดินทางข้ามแผ่นดิน ─────────────
export const JOURNEY_COST = 10;
const dest = (l: Life, c: Ctx) => kingdomsOf(l).find((k) => k.id === c.to)!;
const arrive = (l: Life, c: Ctx, text: string) => { const k = dest(l, c); moveTo(l, k); const v = cultureOf(k); return { text: `${text} คุณมาถึง${cityOf(l).name === k.name ? k.name : `${cityOf(l).name}แห่ง${k.name}`} · แผ่นดินแห่ง${CULTURES[v].name} ${CULTURES[v].desc} · เทพหลักคือ${godOfKingdom(k).name} · ชื่อเสียงของคุณที่นี่ ${standingOf(l)}`, kind: "good" as const }; };
const JOURNEY = { ...SCENE("ft.so.journey", "ย้ายแผ่นดิน", () => `จะไปเริ่มชีวิตใหม่ที่ไหน (ค่าเดินทางเริ่มต้น ${JOURNEY_COST} เหรียญทอง)`, [
  ...[0, 1, 2, 3, 4, 5].map((i) => C((l) => { const k = kingdomsOf(l).filter((x) => x.id !== homeKingdom(l).id)[i]; return `${k.name} · ${CULTURES[cultureOf(k)].name} · ภาษี ${Math.round(taxRate(k) * 100)}% · ${godOfKingdom(k).name}${k.war ? " · กำลังมีสงคราม" : ""}${standingOf(l, k.id) ? ` · ชื่อเสียงที่นั่น ${standingOf(l, k.id)}` : ""}`; }, (l, c) => { c.to = kingdomsOf(l).filter((x) => x.id !== homeKingdom(l).id)[i].id; return { text: "คุณเก็บของทั้งบ้านใส่เกวียน", next: "how" }; }, { show: (l) => !!kingdomsOf(l).filter((x) => x.id !== homeKingdom(l).id)[i] })),
  C("ยังไม่ย้าย", N("คุณวางแผนที่ลงแล้วนั่งมองบ้านเดิม")),
]), scenes: {
  how: { title: "ระหว่างทาง", text: (l, c) => `เส้นทางไป${dest(l, c).name}ไกลหลายสัปดาห์ จะไปทางไหน`, choices: [
    P("เดินทางเองทางบก", (l) => clamp(0.7 + (l.stats.luck - 50) / 200, 0.3, 0.92), (l, c) => { addMoney(l, -JOURNEY_COST * GOLD); return arrive(l, c, "ทางบกเงียบสงบตลอดสามสัปดาห์"); }, (l, c) => { addMoney(l, -(JOURNEY_COST + 10) * GOLD); addStat(l, "health", -6); return arrive(l, c, "โจรดักปล้นกลางป่า คุณเสียของไปบางส่วนแต่ไปถึงจนได้"); }),
    P("ลงเรือไปทางทะเล", () => 0.8, (l, c) => { addMoney(l, -(JOURNEY_COST + 5) * GOLD); return arrive(l, c, "ลมดีตลอดทาง คุณเห็นปลาวาฬครั้งแรกในชีวิต"); }, (l, c) => { addMoney(l, -(JOURNEY_COST + 15) * GOLD); return arrive(l, c, "พายุพัดเรือออกนอกเส้นทางหลายวัน ของบางส่วนต้องทิ้งลงทะเล"); }, { show: (l) => cityOf(l).kind === "port" }),
    PAY("ติดไปกับกองคาราวานที่มีคนคุ้มกัน", JOURNEY_COST + 15, (l, c) => arrive(l, c, "กองคาราวานพาคุณไปถึงอย่างปลอดภัย และคุณได้เพื่อนร่วมทางสองสามคน")),
  ] },
} } as GameEvent;

// ───────────── กิจกรรม ─────────────
const M = (a: Omit<Activity, "world" | "emoji">): Activity => ({ ...a, emoji: "", world: "fantasy" });
const ACTS: Activity[] = [
  M({ group: "สังคม", id: "ft_court", name: "เข้าเฝ้าในราชสำนัก", desc: "รับใช้ วางแผน ถวายของ หรือหาคู่จากตระกูลขุนนาง · ต้องเป็นคหบดีขึ้นไปหรือมีชื่อเสียง", minAge: 16, available: (l) => canCourt(l) && yearly("ftCourtAt")(l), run: (l) => { l.flags.ftCourtAt = l.age; runEvent(l, "ft.so.court"); return { text: "" }; } }),
  M({ group: "สังคม", id: "ft_devote", name: "อุทิศตนให้เทพ", desc: "พรทุกปี แต่มีหน้าที่ต่อเทพ", minAge: 12, time: 0, available: (l) => on(l), run: (l) => { runEvent(l, "ft.so.devote"); return { text: "" }; } }),
];

// ───────────── ทุกปี ─────────────
function societyYear(l: Life) {
  if (!on(l) || !l.alive) return;
  const f = fl(l), k = homeKingdom(l);
  // พรของเทพ (ถ้ายังทำหน้าที่อยู่) · เทพเดียวกับแผ่นดินได้ชื่อเสียงเพิ่ม
  const g = god(l);
  if (g && (f.godLost === undefined || l.age - f.godLost >= 3)) {
    if (chance(l, BLESS_CHANCE)) log(l, `พรของ${g.name}: ${BLESS[g.id]?.(l) ?? g.fx(l)}`, "good");
    if (g.id === godOfKingdom(k).id && chance(l, 0.5)) addStanding(l, 1);
  }
  // ความโปรดปรานในราชสำนักจางลงถ้าไม่ไปเข้าเฝ้า
  if (f.court && Number(l.flags.ftCourtAt ?? -9) < l.age - 2) f.court.favor = Math.max(0, f.court.favor - 5);
}

export const SOCIETY2_EVENTS: GameEvent[] = [COURT_EV, PLOT, REGENT, RULE, DEVOTE, DUTY, HERESY, HOLY, SECRET_INVITE, SECRET_JOB, SECRET_PLOT, REBEL_INVITE, REBEL_JOB, UPRISING, SNEER, JOURNEY];

/** เรียกหลังลงทะเบียน event ทั้งหมดแล้ว */
export function loadSociety2() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push(societyYear);
  // ย้ายแผ่นดินเป็นการเดินทางจริง: เลือกปลายทางจากวัฒนธรรม ภาษี และเทพ แล้วเลือกทางไป
  const mv = ACTIVITIES.find((a) => a.id === "ft_move");
  if (mv) { mv.desc = "เลือกแผ่นดินจากวัฒนธรรม ภาษี และเทพ แล้วออกเดินทาง"; mv.cost = undefined; mv.run = (l) => { runEvent(l, "ft.so.journey"); return { text: "" }; }; mv.available = (l) => l.money >= JOURNEY_COST * GOLD; }
  // วัฒนธรรมของแผ่นดินและชื่อเสียงด้านที่งานนั้นสนใจช่วยตอนสมัครงาน
  jobChanceHooks.push((l, c, p) => {
    if (!on(l)) return p;
    const fam = famOf(c.id);
    if (!fam) return p;
    if (CULTURES[cultureOf(homeKingdom(l))].fams.includes(fam)) p += CULTURE_EDGE;
    const r = FAM_REP[fam];
    if (r) p += (repsOf(l)[r] - 50) / 1000;
    if (fam === "court" && classOf(l) >= 3) p += 0.08;
    return p;
  });
  salaryHooks.push((l, c, base) => (on(l) && famOf(c.id) && CULTURES[cultureOf(homeKingdom(l))].fams.includes(famOf(c.id)!) ? base * (1 + CULTURE_PAY) : base));
}

/** สรุปสำหรับแท็บโลก */
export function societyLines(l: Life): string[] {
  const f = fl(l), k = homeKingdom(l), v = cultureOf(k), out: string[] = [];
  out.push(`${k.name}: แผ่นดินแห่ง${CULTURES[v].name} · ${CULTURES[v].desc} · เทพหลักคือ${godOfKingdom(k).name}`);
  out.push(`ชนชั้นของคุณ: ${CLASSES[classOf(l)]}${f.court?.rank ? ` · ${COURT_RANKS[f.court.rank]} (ความโปรดปราน ${f.court.favor}/${favorNeed(f.court.rank)})` : ""}`);
  const r = repsOf(l);
  out.push(`ชื่อเสียง: ${(Object.keys(REP_NAME) as Rep[]).map((x) => `${REP_NAME[x]} ${r[x]}`).join(" · ")}`);
  if (f.god) out.push(`อุทิศตนให้${god(l)!.name}${f.godLost !== undefined && l.age - f.godLost < 3 ? " · ผิดหน้าที่ พรหายไปชั่วคราว" : " · ได้พรทุกปี"}${f.god !== godOfKingdom(k).id && v === "faith" ? " · ที่นี่ถือว่านอกรีต" : ""}`);
  if (f.shadow && !f.shadow.out) out.push(`สมาชิกวงเงา ขั้น ${f.shadow.rank} · ทำงานให้แล้ว ${f.shadow.missions} ครั้ง`);
  if (f.rebel) out.push(`อยู่กับกบฏของ${kingdomsOf(l).find((x) => x.id === f.rebel!.kingdom)?.name} · ภารกิจ ${f.rebel.missions}/${UPRISING_AT}`);
  return out;
}
