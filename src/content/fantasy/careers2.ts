// การงาน 2 (Release 11): อาชีพใหม่สายศาล ศรัทธา ศิลปะ และการเดินทาง · บททดสอบก่อนรับเข้างาน · เรื่องเฉพาะของแต่ละสายงาน
// กิจการของตัวเอง งานเสริม สมาคมของสายงาน ผลงานที่มีชื่อ ลูกมือ จุดเปลี่ยนกลางชีวิต ขอขึ้นเงินเดือน ผู้อุปถัมภ์ และรอยที่ทิ้งไว้ตอนจากงาน
import { ACTIVITIES, activityFilters, type Activity } from "../../engine/activities";
import type { Choice, Ctx, GameEvent } from "../../engine/events";
import { hireTrialHooks, jobChance, jobChanceHooks, jobEndHooks, jobStartHooks, runEvent, salaryHooks, startJob, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, log, shortName } from "../../engine/util";
import { CAREERS, careerById, type Career } from "../core/careers";
import { B, BIG, C, E, G, GOLD, K, N, P, PAY, SCENE, type Res } from "./kit";
import { fightOdds } from "./power";
import { addStanding, deed, fl } from "./state";
import { lean } from "./persona";
import { KINDS } from "./cities";
import { CAREER_FIT, bossOf } from "./worklife";
import { stageAge } from "./folk";
import { addHeat } from "./underworld";
import { SCHOOLS } from "./places";
import { JOB_ACTIONS, type JobAction } from "../murim/life/jobActions";
import { FT_JOB_ACTIONS } from "./careers";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
const yearly = (k: string) => (l: Life) => Number(l.flags[k] ?? -1) !== l.age;
const after = (e: GameEvent, fn: (l: Life, c: Ctx) => void): GameEvent => ({ ...e, choices: e.choices?.map((ch) => ({ ...ch, run: (l, c, ok) => { fn(l, c); return ch.run(l, c, ok); } })) });

// ───────────── อาชีพใหม่ ─────────────
const NEW: Omit<Career, "emoji" | "world">[] = [
  { id: "ft_scribe", name: "เสมียนศาล", minAge: 16, key: "smarts", dc: 45, baseSalary: 10000, titles: ["เสมียนศาล", "นักกฎหมาย", "ผู้ช่วยผู้พิพากษา", "ผู้พิพากษา", "ประธานศาลหลวง"] },
  { id: "ft_taxman", name: "เจ้าพนักงานภาษี", minAge: 16, key: "smarts", dc: 40, baseSalary: 11000, titles: ["คนจดบัญชีภาษี", "เจ้าพนักงานภาษี", "นายด่าน", "อธิบดีกรมคลัง", "ขุนคลังหลวง"] },
  { id: "ft_inquisitor", name: "นักไต่สวนแห่งศาสนจักร", minAge: 18, key: "smarts", dc: 50, baseSalary: 15000, titles: ["ผู้ติดตามนักไต่สวน", "นักไต่สวน", "นักไต่สวนอาวุโส", "ผู้พิพากษาแห่งศรัทธา", "มหาไต่สวน"] },
  { id: "ft_healer", name: "หมอวิหาร", minAge: 14, key: "smarts", dc: 40, baseSalary: 10000, titles: ["ผู้ช่วยพยาบาล", "หมอวิหาร", "หมอใหญ่", "ผู้ดูแลโรงหมอ", "หัตถ์แห่งเทพ"] },
  { id: "ft_painter", name: "จิตรกร", minAge: 14, key: "looks", dc: 35, baseSalary: 7000, titles: ["ลูกมือช่างวาด", "จิตรกร", "จิตรกรมีชื่อ", "จิตรกรราชสำนัก", "ปรมาจารย์แห่งสี"] },
  { id: "ft_playwright", name: "นักเขียนบทละคร", minAge: 16, key: "smarts", dc: 45, baseSalary: 8000, titles: ["คนลอกบท", "นักเขียนบท", "นักเขียนบทประจำโรงละคร", "เจ้าของโรงละคร", "กวีแห่งยุค"] },
  { id: "ft_jester", name: "ตัวตลก", minAge: 14, key: "looks", dc: 40, baseSalary: 8000, titles: ["ตัวตลกตลาด", "ตัวตลกเร่", "ตัวตลกประจำคฤหาสน์", "ตัวตลกหลวง", "คนเดียวที่กล้าพูดความจริงต่อหน้าผู้ครอง"] },
  { id: "ft_caravan", name: "ผู้นำทางกองคาราวาน", minAge: 16, key: "health", dc: 40, baseSalary: 10000, titles: ["ลูกหาบ", "คนนำทาง", "ผู้นำกองคาราวาน", "นายกองคาราวาน", "เจ้าแห่งเส้นทางทราย"] },
];
const CITY_JOBS: [keyof typeof KINDS, string[]][] = [["capital", ["ft_scribe", "ft_taxman", "ft_inquisitor", "ft_jester", "ft_playwright"]], ["arcane", ["ft_painter"]], ["forest", ["ft_healer"]], ["frontier", ["ft_caravan"]], ["port", ["ft_caravan"]]];

/** สายงาน: ใช้กับบททดสอบ เรื่องประจำสาย สมาคม ผลงาน และการเปลี่ยนสายกลางชีวิต */
export type Fam = "craft" | "arms" | "court" | "faith" | "arts" | "travel" | "trade" | "wild" | "magic" | "dark";
const FAM: Record<string, Fam> = {
  ft_smith: "craft", ft_enchanter: "craft", ft_wandwright: "craft", ft_alchemist: "craft", ft_chef: "craft",
  ft_knight: "arms", ft_soldier: "arms", ft_gladiator: "arms", ft_ranger: "arms",
  ft_courtier: "court", ft_diplomat: "court", ft_scribe: "court", ft_taxman: "court",
  ft_priest: "faith", ft_inquisitor: "faith", ft_healer: "faith",
  ft_bard: "arts", ft_painter: "arts", ft_playwright: "arts", ft_jester: "arts",
  ft_sailor: "travel", ft_cartographer: "travel", ft_caravan: "travel",
  ft_merchant: "trade", ft_inn: "trade", ft_farmer: "trade",
  ft_tamer: "wild", ft_dragonkeeper: "wild", ft_miner: "wild",
  ft_mage: "magic", ft_scholar: "magic", ft_thief: "dark",
};
export const famOf = (id?: string): Fam | undefined => (id ? FAM[id] : undefined);
const myFam = (l: Life) => famOf(l.job?.careerId);
const jobName = (l: Life) => careerById(l.job?.careerId ?? "")?.name ?? "งาน";

// ───────────── บททดสอบก่อนรับเข้างาน ─────────────
const TRIAL_TEXT: Record<Fam, string> = {
  craft: "นายช่างวางวัตถุดิบตรงหน้าคุณ \"ทำให้ดูหนึ่งชิ้น ก่อนตะวันตกดิน\"",
  arms: "ครูฝึกโยนดาบไม้ให้คุณ \"ประลองกับข้าสามยก ไม่ต้องชนะ แค่อย่าล้ม\"",
  court: "ขุนนางผู้สัมภาษณ์ยื่นคดีความเก่าให้อ่าน \"ถ้าเจ้าเป็นผู้ตัดสิน เจ้าจะว่าอย่างไร\"",
  faith: "นักบวชอาวุโสถามคำถามที่ไม่มีคำตอบในตำรา \"ถ้าคนดีต้องตายเพื่อคนชั่วร้อยคน เทพจะว่าอย่างไร\"",
  arts: "เจ้าของโรงละครชี้ไปที่เวทีว่างเปล่า \"แสดงให้ดู คนดูข้างนอกจะเป็นคนตัดสิน\"",
  travel: "นายกองชี้แผนที่ที่ขาดครึ่งแผ่น \"ถ้าพายุมาตอนนี้ เจ้าจะพาทุกคนไปทางไหน\"",
  trade: "เจ้าของร้านยื่นถุงเงินให้ \"ขายของในร้านให้ได้กำไรภายในวันเดียว\"",
  wild: "ผู้ดูแลเปิดประตูคอกที่มีสัตว์ตัวใหญ่ที่สุด \"เข้าไปให้มันจำกลิ่นเจ้าได้\"",
  magic: "นักเวทผู้สอบวางผลึกขุ่นไว้บนโต๊ะ \"ทำให้มันสว่าง หรืออธิบายว่าทำไมมันไม่สว่าง\"",
  dark: "ชายสวมฮู้ดวางกุญแจไว้ตรงหน้า \"เปิดหีบนั่นก่อนข้านับถึงสิบ\"",
};
const contactFor = (l: Life, c: Career) => l.people.find((p) => p.alive && p.bond >= 50 && (p.tags?.includes(`work:${c.id}`) || p.tags?.includes("work_ex") || (p.job ?? "").includes(c.name)));
const schoolFor = (l: Life, c: Career) => { const s = SCHOOLS.find((x) => x.id === fl(l).school); return !!fl(l).graduated && s?.career === c.id; };
/** โอกาสผ่านบททดสอบ: โอกาสสมัครปกติ + คนรู้จัก + โรงเรียน */
export const TRIAL_EDGE = 0.1, CONTACT_EDGE = 0.15, SCHOOL_EDGE = 0.1;
const trialOdds = (l: Life, c: Ctx, extra: number) => { const k = careerById(String(c.cid))!; return clamp(jobChance(l, k) + extra + (schoolFor(l, k) ? SCHOOL_EDGE : 0), 0.05, 0.95); };
const hired: Res = (l, c) => { const out = startJob(l, String(c.cid)); return { text: `คุณผ่านบททดสอบ ${out.text}`, kind: "good" }; };
const notHired: Res = (_l, c) => ({ text: `บททดสอบของ${careerById(String(c.cid))?.name}ยากเกินไปสำหรับวันนี้ ลองใหม่ปีหน้าได้`, kind: "bad" });
const TRIAL = SCENE("ft.c2.trial", "บททดสอบ", (_l, c) => { const k = careerById(String(c.cid))!; return `บททดสอบเข้าทำงาน${k.name}: ${TRIAL_TEXT[famOf(k.id) ?? "trade"]}`; }, [
  P("แสดงฝีมือเต็มที่", (l, c) => trialOdds(l, c, TRIAL_EDGE), hired, notHired),
  P((l, c) => `เอ่ยชื่อ${shortName(contactFor(l, careerById(String(c.cid))!)!)}ที่รู้จักคนในนั้น`, (l, c) => trialOdds(l, c, CONTACT_EDGE + TRIAL_EDGE), hired, notHired, { show: (l, c) => !!contactFor(l, careerById(String(c.cid))!) }),
  K("บอกตามตรงว่ายังต้องเรียนอีกมาก แต่พร้อมเรียน", "looks", 45, hired, notHired),
  C("เปลี่ยนใจ ไม่สมัคร", N("คุณขอบคุณแล้วเดินออกมา")),
]);

// ───────────── รอยที่ทิ้งไว้ตอนจากงาน ─────────────
export const FIRED_PENALTY = 0.15, REFERENCE_EDGE = 0.12, MARK_YEARS = 10;

// ───────────── ขอขึ้นเงินเดือน ─────────────
export const RAISE_STEP = 0.08, RAISE_MAX = 3;
const raises = (l: Life) => Number(l.flags[`ftRaise_${l.job?.careerId}`] ?? 0);
const raiseOdds = (l: Life) => clamp(0.3 + (l.job?.performance ?? 0) / 200 + ((bossOf(l)?.bond ?? 0) >= 60 ? 0.1 : 0) - raises(l) * 0.1, 0.05, 0.85);
const RAISE = SCENE("ft.c2.raise", "ขอขึ้นเงินเดือน", (l) => `คุณยืนอยู่หน้าห้องของ${bossOf(l) ? shortName(bossOf(l)!) : "เจ้านาย"} ผลงานปีนี้ ${l.job?.performance ?? 0} จาก 100`, [
  P("ขอขึ้นเงินเดือนตามผลงาน", raiseOdds, G("เจ้านายพยักหน้า ค่าจ้างของคุณขึ้นจากปีหน้า", { joy: 5 }, (l) => { l.flags[`ftRaise_${l.job!.careerId}`] = raises(l) + 1; }), B("เจ้านายมองคุณนานจนอึดอัด \"กลับไปทำงานก่อน\"", { joy: -3 }, (l) => { l.job!.performance = clamp(l.job!.performance - 6, 0, 100); })),
  C("เปลี่ยนใจ ไว้ปีหน้า", N("คุณเดินผ่านหน้าห้องไปเฉยๆ")),
]);

// ───────────── งานเสริม ─────────────
const GIG = SCENE("ft.c2.gig", "งานเสริม", "นอกเวลางานยังมีเงินให้หาอีกหลายทาง", [
  K("ร้องเพลงเปิดหมวกที่ลานตลาด", "looks", 40, G("หมวกหนักขึ้นทุกเพลง ได้ 3 เหรียญทอง", { gold: 3, joy: 2 }), N("ไม่มีใครหยุดฟัง นอกจากหมาจรหนึ่งตัว")),
  K("สอนหนังสือลูกพ่อค้า", "smarts", 50, G("เด็กอ่านออกเขียนได้ภายในฤดูเดียว ได้ 4 เหรียญทอง", { gold: 4, iq: 1 }), N("เด็กหลับทุกครั้งที่คุณเปิดตำรา")),
  P("รับงานคุ้มกันระยะสั้น", (l) => fightOdds(l, 14), G("เกวียนถึงปลายทางโดยไม่มีรอยขีดข่วน ได้ 5 เหรียญทอง", { gold: 5 }), B("โจรมาจริง และคุณได้แผลแทนค่าจ้าง", { hp: -6 })),
  P("ขนของหนีภาษีข้ามด่าน", (l) => clamp(0.55 + (l.stats.luck - 50) / 200, 0.1, 0.9), G("ด่านเปิดให้โดยไม่ค้น ได้ 8 เหรียญทอง", { gold: 8 }, (l) => { addHeat(l, 8); lean(l, { h: -2 }); }), B("ด่านยึดของและจดชื่อคุณไว้", { gold: -5 }, (l) => { addHeat(l, 15); addStanding(l, -3); })),
  C("ปีนี้พักผ่อนดีกว่า", N("คุณใช้เวลาว่างนอนดูเมฆ")),
]);

// ───────────── กิจการของตัวเอง ─────────────
export const BIZ: Record<string, { name: string; noun: string; fam: Fam }> = {
  smithy: { name: "โรงตีเหล็ก", noun: "โรงตีเหล็ก", fam: "craft" },
  apothecary: { name: "ร้านยา", noun: "ร้านยา", fam: "craft" },
  tavern: { name: "โรงเตี๊ยม", noun: "โรงเตี๊ยม", fam: "trade" },
  trading: { name: "ห้างค้าขาย", noun: "ห้าง", fam: "trade" },
};
export const BIZ_LEVELS = ["", "ร้านเล็ก", "ร้านมีลูกจ้าง", "สาขาที่เมืองใหม่", "เครือข่ายทั่วแผ่นดิน", "ตระกูลการค้า"];
export const BIZ_OPEN = 40, BIZ_INCOME = 4, BIZ_BAD = 0.15;
export const growCost = (l: Life) => (fl(l).biz?.level ?? 1) * 45;
const growOdds = (l: Life) => clamp(0.65 - (fl(l).biz?.level ?? 1) * 0.07 + (l.stats.smarts - 50) / 200 + (famOf(l.job?.careerId) === BIZ[fl(l).biz?.kind ?? "trading"]?.fam ? 0.1 : 0), 0.1, 0.9);
const BIZ_OPEN_EV = SCENE("ft.c2.biz_open", "เปิดกิจการ", `ห้องแถวว่างหน้าตลาดติดป้ายให้เช่า เงินทุนตั้งต้น ${BIZ_OPEN} เหรียญทอง คุณจะเปิดอะไร`, [
  ...Object.entries(BIZ).map(([k, b]) => C(b.name, (l) => { addMoney(l, -BIZ_OPEN * GOLD); fl(l).biz = { kind: k, name: `${b.noun}ของตระกูล${l.lastName}`, level: 1, since: l.age }; return { text: `ป้าย "${b.noun}ของตระกูล${l.lastName}" แขวนขึ้นหน้าร้านในเช้าวันฝนตก`, kind: "milestone" as const }; }, { req: (l) => (l.money < BIZ_OPEN * GOLD ? `ต้องมี ${BIZ_OPEN} เหรียญทอง` : undefined) })),
  C("ยังไม่พร้อม", N("คุณเดินผ่านห้องแถวนั้นไป แต่ยังคิดถึงมันทั้งคืน")),
]);
const BIZ_GROW = SCENE("ft.c2.biz_grow", "ขยายกิจการ", (l) => `${fl(l).biz!.name} · ${BIZ_LEVELS[fl(l).biz!.level]} · ขยายเป็น${BIZ_LEVELS[fl(l).biz!.level + 1]}ต้องใช้ ${growCost(l)} เหรียญทอง`, [
  P((l) => `ลงทุนขยาย (${growCost(l)} เหรียญทอง)`, growOdds, (l) => {
    const b = fl(l).biz!; addMoney(l, -growCost(l) * GOLD); b.level++; b.bad = 0;
    if (b.level === 2) { const p = createPerson(l, "ally", { age: Math.max(16, l.age - randInt(l, 5, 15)), bond: 45 }); p.job = `ลูกจ้างใน${b.name}`; p.tags = [...(p.tags ?? []), "biz_staff"]; }
    if (b.level >= 5) deed(l, `ผู้สร้าง${b.name}`);
    return { text: `${b.name}เป็น${BIZ_LEVELS[b.level]}แล้ว`, kind: b.level >= 3 ? "milestone" : "good" };
  }, (l) => { addMoney(l, -Math.round(growCost(l) / 2) * GOLD); return { text: "การขยายล้มเหลว เงินหายไปครึ่งหนึ่ง ร้านยังอยู่ที่เดิม", kind: "bad" }; }, { req: (l) => (fl(l).biz!.level >= 5 ? "กิจการใหญ่ที่สุดแล้ว" : l.money < growCost(l) * GOLD ? `ต้องมี ${growCost(l)} เหรียญทอง` : undefined) }),
  C("ขายกิจการ", (l) => { const b = fl(l).biz!; const g = b.level * 40; addMoney(l, g * GOLD); fl(l).biz = undefined; return { text: `คุณขาย${b.name}ได้ ${g} เหรียญทอง และเดินออกมาโดยไม่หันหลัง`, kind: "good" }; }),
  C("อยู่ขนาดนี้ก็พอ", N("คุณนับเงินในลิ้นชักแล้วยิ้ม")),
]);
const RIVAL_NAMES = ["ร้านตระกูลวาเลน", "ห้างพี่น้องคอร์โก", "ร้านของหญิงม่ายเบลลา", "กิจการของพ่อค้าจากทะเลใต้"];
const BIZ_RIVAL = after(E("ft.c2.biz_rival", [18, 900], (l) => `${fl(l).biz!.rival}เปิดร้านแบบเดียวกันตรงข้าม${fl(l).biz!.name} และตัดราคาลงครึ่งหนึ่ง`, [
  K("สู้ด้วยของที่ดีกว่า", "smarts", 50, G("ลูกค้ากลับมาหาคุณภายในฤดูเดียว คู่แข่งปิดร้านไปเงียบๆ", { fame: 2 }, (l) => { fl(l).biz!.rival = undefined; }), B("ของดีกว่าแต่แพงกว่า ลูกค้าหายไปหนึ่งในสาม", { gold: -10 })),
  PAY("ซื้อกิจการคู่แข่ง", 60, G("ป้ายร้านคู่แข่งถูกปลดลง และลูกจ้างของเขามาทำงานกับคุณ", {}, (l) => { fl(l).biz!.rival = undefined; fl(l).biz!.level = Math.min(5, fl(l).biz!.level + 1); }), { show: (l) => (fl(l).biz?.level ?? 5) < 5 }),
  C("ปล่อยข่าวว่าของเขาปลอม", (l) => { lean(l, { h: -5 }); if (chance(l, 0.6)) { fl(l).biz!.rival = undefined; return { text: "ลูกค้าเลิกเข้าร้านเขา คุณได้ตลาดคืน แต่รู้ว่าทำอะไรลงไป", kind: "good" }; } addStanding(l, -4); return { text: "ข่าวลือย้อนกลับมาหาคุณ คนทั้งตลาดรู้ว่าใครปล่อย", kind: "bad" }; }),
], { title: "คู่แข่งตรงข้ามร้าน", when: (l) => on(l) && !!fl(l).biz?.rival, forced: true, maxTimes: 0 }), (l) => { l.flags.ftRivalAt = l.age; });

// ───────────── สมาคมของสายงาน ─────────────
export const GUILDS: Partial<Record<Fam, string>> = { craft: "สมาคมช่างฝีมือ", trade: "สมาคมพ่อค้า", arts: "สมาคมศิลปิน", travel: "สมาคมนักเดินทาง" };
export const GUILD_RANKS = ["", "สมาชิกใหม่", "สมาชิก", "กรรมการสมาคม", "นายกสมาคม"];
export const DUES = 4, GUILD_JOIN = 10, GUILD_EDGE = 0.12;
const tg = (l: Life) => fl(l).tguild;
function expel(l: Life, why: string) { const g = tg(l)!; fl(l).tguild = undefined; l.flags.ftGuildBan = `${g.fam}:${l.age}`; addStanding(l, -3); log(l, `${GUILDS[g.fam as Fam]}ขับคุณออก ${why}`, "bad"); }
const GUILD_RULE = E("ft.c2.guildrule", [16, 900], (l) => `${GUILDS[tg(l)!.fam as Fam]}ออกคำสั่ง: ห้ามสมาชิกขายของต่ำกว่าราคาที่สมาคมกำหนด แต่หญิงชราข้างบ้านไม่มีเงินพอจะซื้อของที่จำเป็น`, [
  C("ทำตามกฎของสมาคม", N("หญิงชรากลับบ้านมือเปล่า สมาคมจดชื่อคุณเป็นสมาชิกที่ดี", {}, (l) => { lean(l, { m: -3 }); tg(l)!.since -= 1; })),
  C("ขายให้ในราคาที่เธอจ่ายได้", (l) => { lean(l, { m: 5 }); if (chance(l, 0.4)) { expel(l, "ฐานขายต่ำกว่าราคา"); return { text: "มีคนรายงานสมาคม คุณถูกขับออก แต่หญิงชรามีของกินทั้งหน้าหนาว", kind: "bad" }; } return { text: "ไม่มีใครรู้ หญิงชราอวยพรให้คุณทุกเช้า", kind: "good" }; }),
  K("ยื่นเรื่องให้สมาคมแก้กฎ", "looks", 55, G("สมาคมยอมลดราคาให้คนชราและเด็กกำพร้า ชื่อคุณถูกพูดถึงในที่ประชุม", { fame: 2 }, (l) => { tg(l)!.since -= 2; }), N("ที่ประชุมหัวเราะใส่ข้อเสนอของคุณ")),
], { title: "กฎของสมาคม", when: (l) => on(l) && !!tg(l), weight: 6, maxTimes: 1 });

// ───────────── ผลงานที่มีชื่อ ─────────────
const WORK_NOUN: Partial<Record<Fam, string[]>> = {
  craft: ["ดาบ", "ยา", "ตำรับ", "เกราะ"], arts: ["เพลง", "ภาพ", "บทละคร", "มุกตลก"], travel: ["แผนที่", "เส้นทาง", "บันทึกการเดินทาง"], court: ["คำพิพากษา", "กฎหมาย", "สนธิสัญญา"],
  faith: ["บทสวด", "คำเทศน์"], magic: ["ตำราเวท", "ทฤษฎี"],
};
const WORK_WORD = ["รุ่งอรุณ", "น้ำตาแม่น้ำ", "เงาจันทร์", "ลมเหนือ", "ใจเหล็ก", "ฝนแรก", "หอคอยขาว", "นกไฟ", "ทุ่งหญ้าทองคำ", "ดาวที่หายไป"];
export const WORK_CHANCE = 0.15, WORK_LEGEND = 6;
const worksOf = (l: Life) => fl(l).works ?? [];
function makeWork(l: Life): string {
  const fam = myFam(l);
  const nouns = fam && WORK_NOUN[fam];
  if (!nouns) return "";
  const used = new Set(worksOf(l).map((w) => w.name));
  let name = "";
  for (let i = 0; i < 6 && (!name || used.has(name)); i++) name = `${pick(l, nouns)}${pick(l, WORK_WORD)}`;
  if (used.has(name)) return "";
  fl(l).works = [...worksOf(l), { name, fam, fame: 1, age: l.age }];
  return name;
}

// ───────────── ลูกมือ ─────────────
const apprentice = (l: Life) => l.people.find((p) => p.alive && p.tags?.includes("apprentice"));
const APPRENTICE_EV = E("ft.c2.apprentice", [20, 900], (l) => `${shortName(apprentice(l)!)}ลูกมือของคุณทำงานชิ้นแรกที่ดีกว่างานของคุณเอง ทุกคนในร้านเงียบไป`, [
  C("ชมต่อหน้าทุกคน", G((l) => `${shortName(apprentice(l)!)}น้ำตาคลอ วันหนึ่งเขาจะเล่าเรื่องวันนี้ให้ลูกมือของตัวเองฟัง`, { joy: 4 }, (l) => { const a = apprentice(l)!; a.bond = clamp(a.bond + 12, 0, 100); a.tags = [...(a.tags ?? []), "carries_name"]; lean(l, { m: 3 }); })),
  C("บอกว่ายังไม่ดีพอ", N((l) => `${shortName(apprentice(l)!)}ก้มหน้ากลับไปทำงาน และเริ่มทำงานตอนกลางคืนคนเดียว`, {}, (l) => { const a = apprentice(l)!; a.bond = clamp(a.bond - 10, 0, 100); })),
  C("เก็บความลับสำคัญของงานไว้กับตัว", N((l) => `${shortName(apprentice(l)!)}รู้ว่าคุณกั๊กไว้ และวันหนึ่งเขาก็จากไปเปิดร้านเอง`, {}, (l) => { const a = apprentice(l)!; a.tags = [...(a.tags ?? []).filter((t) => t !== "apprentice"), "rival_apprentice"]; a.relation = "rival"; a.job = `คู่แข่งที่เคยเป็นลูกมือของคุณ`; })),
], { title: "ลูกมือที่เก่งกว่า", when: (l) => on(l) && !!apprentice(l) && l.age - Number(apprentice(l)!.tags?.find((t) => t.startsWith("app_since:"))?.slice(10) ?? l.age) >= 4, weight: 12, maxTimes: 1 });

// ───────────── จุดเปลี่ยนกลางชีวิต ─────────────
const TURN = after(E("ft.c2.turn", [30, 900], (l) => `คุณทำงาน${jobName(l)}มา ${l.job?.years ?? 0} ปีแล้ว เช้าวันหนึ่งคุณตื่นมาแล้วไม่แน่ใจว่าอยากทำมันต่ออีกยี่สิบปีหรือเปล่า`, [
  C("ทำงานเดิมต่อด้วยใจที่ตั้งมั่น", G("คุณกลับไปทำงานเหมือนคนที่เพิ่งได้งานใหม่", { joy: 4 }, (l) => { if (l.job) l.job.performance = clamp(l.job.performance + 10, 0, 100); })),
  C("ลาออกไปเริ่มทางใหม่", N("คุณยื่นใบลาออก ทุกคนคิดว่าคุณบ้า สิ่งที่เรียนมาจะช่วยคุณในงานใหม่ที่ใช้ฝีมือแบบเดียวกัน", { joy: 6 }, (l) => { const c = careerById(l.job!.careerId)!; l.flags.ftTurnKey = c.key; l.flags.ftTurnFrom = c.id; l.job = undefined; lean(l, { c: 4 }); })),
  C("หยุดพักหนึ่งปีแล้วค่อยคิด", G("คุณเดินทางไปดูทะเลครั้งแรกในชีวิต และกลับมาพร้อมใจที่เบาลง", { joy: 8 }, (l) => { if (l.job) l.job.performance = clamp(l.job.performance - 8, 0, 100); })),
], { title: "จุดเปลี่ยนกลางชีวิต", when: (l) => on(l) && !!l.job?.careerId.startsWith("ft_") && l.job.years >= 5 && stageAge(l) >= 35 && stageAge(l) <= 50, weight: 30, maxTimes: 1 }), () => {});

// ───────────── ผู้อุปถัมภ์ ─────────────
const PATRONS: Record<"noble" | "mage" | "hero", { label: string; names: string[] }> = {
  noble: { label: "ขุนนาง", names: ["ท่านเคานต์ออสวอลด์", "ท่านหญิงเอเลนอร์", "ท่านบารอนเกรกอรี"] },
  mage: { label: "นักเวท", names: ["จอมเวทมอร์ริแกน", "นักปราชญ์ทาลเลียน", "แม่มดแห่งหอคอยหมอก"] },
  hero: { label: "วีรบุรุษ", names: ["เซอร์โรแลนด์ผู้ไม่แพ้", "อัศวินหญิงเบรนนา", "นักล่ามังกรเฮลก้า"] },
};
export const PATRON_STIPEND = 2, PATRON_FALL = 0.08;
const pat = (l: Life) => fl(l).patron;
const PATRON_EV = SCENE("ft.c2.patron", "ผู้อุปถัมภ์", "ฝีมือของคุณเริ่มเป็นที่รู้จัก คนใหญ่คนโตหลายคนส่งคนมาทาบทาม", [
  ...(Object.keys(PATRONS) as (keyof typeof PATRONS)[]).map((k) => K(`รับใช้${PATRONS[k].label}`, "looks", 40, (l) => { const name = pick(l, PATRONS[k].names); fl(l).patron = { name, kind: k, favor: 50, since: l.age }; return { text: `${name}รับคุณเข้าบ้าน ทุกปีจะมีเงินอุดหนุนและงานจากบ้านนี้`, kind: "good" }; }, N("คนของเขาบอกว่าจะติดต่อกลับ แต่ไม่เคยติดต่อมา"))),
  C("ไม่ผูกตัวกับใคร", N("คุณอยากเป็นนายของตัวเอง")),
]);
const PATRON_FEUD = E("ft.c2.patron_feud", [16, 900], (l) => `${pat(l)!.name}ทะเลาะกับคู่แข่งที่มีอำนาจพอๆ กัน และต้องการให้คุณเลือกข้างต่อหน้าทุกคน`, [
  C("ยืนข้างผู้อุปถัมภ์", (l) => { const p = pat(l)!; p.favor = clamp(p.favor + 20, 0, 100); if (chance(l, 0.3)) { addStanding(l, -5); return { text: "ฝ่ายตรงข้ามจำชื่อคุณไว้ และงานจากฝั่งนั้นหายไปหมด", kind: "bad" }; } return { text: `${p.name}จะไม่ลืมว่าวันนั้นใครยืนข้างเขา`, kind: "good" }; }),
  K("หาทางให้ทั้งสองฝ่ายคืนดีกัน", "looks", 60, G("ทั้งสองฝ่ายจับมือกันในงานเลี้ยงที่คุณจัด และชื่อคุณดังขึ้นอีก", { fame: 4 }), B("ทั้งสองฝ่ายมองว่าคุณสองหน้า", {}, (l) => { pat(l)!.favor -= 25; })),
  C("ขอถอนตัวจากบ้านนี้", N("คุณเก็บของออกจากบ้านผู้อุปถัมภ์อย่างสุภาพ", {}, (l) => { fl(l).patron = undefined; })),
], { title: "ศึกของผู้อุปถัมภ์", when: (l) => on(l) && !!pat(l) && l.age - pat(l)!.since >= 3, weight: 8, maxTimes: 1 });

// ───────────── เจ้านายกำลังจะล้ม ─────────────
const BOSS_FALL = E("ft.c2.bossfall", [20, 900], (l) => `คุณเจอบัญชีลับที่พิสูจน์ว่า${shortName(bossOf(l)!)}ยักยอกเงินมาหลายปี และทุกคนรู้ว่าใครจะได้ตำแหน่งต่อถ้าเขาล้ม`, [
  C("ส่งบัญชีให้ผู้ตรวจ", (l) => { const b = bossOf(l)!; b.tags = (b.tags ?? []).filter((t) => t !== "boss" && !t.startsWith("work:")); b.relation = "rival"; b.job = "อดีตเจ้านายที่ถูกคุณเปิดโปง"; const j = l.job!; if (j.level < 5) j.level++; j.performance = 55; lean(l, { h: 3 }); return { text: `${shortName(b)}ถูกปลด และคุณได้ตำแหน่งของเขา เขาจะจำวันนี้ไปตลอดชีวิต`, kind: "milestone" }; }),
  C("เอาบัญชีไปต่อรองกับเขา", (l) => { const b = bossOf(l)!; b.bond = clamp(b.bond - 20, 0, 100); addMoney(l, 30 * GOLD); lean(l, { h: -5 }); return { text: "เขาจ่ายเงินปิดปากคุณ และจะหาทางกำจัดคุณทีหลัง", kind: "good" }; }),
  C("เผาบัญชีทิ้ง", N("ไม่มีใครรู้ว่าคุณเคยเห็นมัน และงานยังเดินต่อไปเหมือนเดิม")),
], { title: "เจ้านายกำลังจะล้ม", when: (l) => on(l) && !!bossOf(l) && (l.job?.level ?? 0) >= 2 && (l.job?.years ?? 0) >= 3, weight: 5, maxTimes: 1 });

// ───────────── เรื่องประจำสายงาน: ฉากแรกของขั้นสอง และวิกฤตของสาย ─────────────
type Arc = { first: [string, string, Choice[]]; crisis: [string, string, Choice[]] };
const perf = (d: number) => (l: Life) => { if (l.job) l.job.performance = clamp(l.job.performance + d, 0, 100); };
const ARCS: Record<Fam, Arc> = {
  craft: { first: ["งานสั่งทำชิ้นแรก", "ลูกค้าคนแรกที่ระบุชื่อคุณเดินเข้ามา เขาอยากได้ของที่ไม่มีใครในเมืองทำได้", [K("รับงานและทำให้ดีที่สุด", "smarts", 45, G("ลูกค้าถือของชิ้นนั้นออกไปอวดทั้งตลาด", { fame: 2 }, perf(8)), N("งานเสร็จแต่ไม่ดีอย่างที่หวัง ลูกค้าจ่ายครึ่งราคา", {}, perf(-3))), C("บอกตามตรงว่ายังทำไม่ได้", N("ลูกค้าไปหาคนอื่น แต่จำว่าคุณไม่โกหก", {}, (l) => lean(l, { h: 3 })))]],
    crisis: ["ของที่คุณทำพัง", "ของที่คุณทำพังกลางพิธีของขุนนาง ทั้งเมืองรู้ว่าใครเป็นคนทำ", [C("รับผิดและทำใหม่ให้ฟรี", N("คุณทำงานทั้งเดือนโดยไม่ได้เงิน แต่ชื่อคุณกลับมาเป็นของคนที่รับผิดชอบ", { gold: -10 }, perf(4))), K("พิสูจน์ว่าคนใช้ผิดวิธี", "smarts", 55, G("ช่างหลวงยืนยันว่างานของคุณไม่ผิด", {}, perf(6)), B("ไม่มีใครเชื่อ ลูกค้าหายไปครึ่งหนึ่ง", {}, perf(-10)))]] },
  arms: { first: ["คำสาบานครั้งแรก", "ผู้บังคับบัญชาให้คุณคุกเข่าและสาบานต่อธงของหน่วย", [C("สาบานทุกคำ", G("คำสาบานนั้นอยู่ในใจคุณทุกครั้งที่ชักดาบ", { joy: 3 }, (l) => { lean(l, { f: 2, c: 2 }); perf(5)(l); })), C("สาบานแต่ปากในใจคิดอีกอย่าง", N("ไม่มีใครรู้ นอกจากคุณ", {}, (l) => lean(l, { h: -3 })))]],
    crisis: ["คำสั่งที่ผิด", "ผู้บังคับบัญชาสั่งให้เผาหมู่บ้านที่ซ่อนข้าศึกไว้ ทั้งที่ยังมีเด็กอยู่ข้างใน", [C("ทำตามคำสั่ง", N("ควันไฟขึ้นถึงฟ้า และคุณไม่ได้นอนหลับสนิทอีกหลายปี", { joy: -8 }, (l) => { lean(l, { m: -8 }); perf(6)(l); })), C("ขัดคำสั่งและพาเด็กออกมา", (l) => { lean(l, { m: 8, c: 4 }); perf(-12)(l); addFame(l, 3); return { text: "คุณถูกลงโทษต่อหน้าแถว แต่ชาวบ้านทั้งแคว้นรู้ชื่อคุณ", kind: "good" }; })]] },
  court: { first: ["คดีแรก", "คดีแรกที่คุณรับผิดชอบเองเป็นเรื่องที่ดินระหว่างหญิงม่ายกับขุนนาง", [K("ตัดสินตามหลักฐาน", "smarts", 50, G("หญิงม่ายได้ที่ดินคืน และขุนนางจำชื่อคุณไว้", {}, (l) => { perf(6)(l); lean(l, { h: 4 }); }), N("หลักฐานไม่พอ คดียืดเยื้อไปอีกปี", {}, perf(-2))), C("ตัดสินให้ขุนนาง", G("ขุนนางส่งของขวัญมาที่บ้าน", { gold: 15 }, (l) => lean(l, { h: -5, m: -3 })))]],
    crisis: ["คดีของผู้ครอง", "คดีที่ไปถึงตัวคนในราชวงศ์มาถึงโต๊ะคุณ ทุกคนบอกให้ปล่อยมันไป", [C("ไต่สวนต่อจนสุดทาง", (l) => { lean(l, { h: 6, c: 5 }); if (chance(l, 0.5)) { addFame(l, 6); deed(l, `ผู้ไต่สวนคดีของราชวงศ์`); return { text: "ความจริงถูกเปิดเผย และชื่อคุณเข้าไปอยู่ในพงศาวดาร", kind: "milestone" }; } if (l.job) l.job.level = Math.max(1, l.job.level - 1); return { text: "คุณถูกลดตำแหน่งในคืนเดียว แต่ไม่เคยเสียใจ", kind: "bad" }; }), C("ปิดสำนวนเงียบๆ", N("คดีหายไปจากโต๊ะ และตำแหน่งของคุณมั่นคงขึ้น", {}, (l) => { perf(8)(l); lean(l, { h: -6 }); }))]] },
  faith: { first: ["พิธีแรก", "คุณได้นำพิธีครั้งแรกเป็นงานศพของเด็กหญิงที่ทั้งหมู่บ้านรัก", [C("พูดจากใจแทนบทสวด", G("ทั้งหมู่บ้านร้องไห้และกอดกัน แม่ของเด็กจับมือคุณไม่ยอมปล่อย", { joy: 3 }, (l) => { lean(l, { m: 4 }); perf(5)(l); })), C("ทำตามพิธีทุกขั้นตอน", N("พิธีสมบูรณ์แบบ และว่างเปล่า", {}, (l) => { lean(l, { f: 3 }); perf(3)(l); }))]],
    crisis: ["ศรัทธาที่สั่นคลอน", "ผู้อาวุโสในวิหารสั่งให้ไล่คนป่วยออกไปเพราะเขาเป็นคนต่างศาสนา", [C("ทำตามคำสั่ง", N("ประตูวิหารปิด และคุณรู้สึกว่าเทพเงียบไปทั้งปี", { joy: -6 }, (l) => lean(l, { m: -5, f: 2 }))), C("ซ่อนเขาไว้ในห้องเก็บของ", (l) => { lean(l, { m: 7, f: -2 }); if (chance(l, 0.35)) { perf(-15)(l); return { text: "ผู้อาวุโสจับได้ คุณถูกลงโทษให้ขัดพื้นวิหารทั้งฤดู", kind: "bad" }; } return { text: "เขาหายดีและเดินจากไปตอนรุ่งสาง ทิ้งไว้แต่คำขอบคุณ", kind: "good" }; })]] },
  arts: { first: ["คืนเปิดตัว", "คืนแรกที่ชื่อคุณอยู่บนป้ายหน้าโรงละคร ที่นั่งเต็มทุกแถว", [K("ทุ่มทุกอย่างบนเวที", "looks", 45, BIG("เสียงปรบมือดังจนหลังคาสั่น และนักวิจารณ์เขียนถึงคุณทั้งเมือง", { fame: 4 }, perf(8)), B("คุณลืมท่อนสำคัญ มีคนหัวเราะในจังหวะที่ผิด", { joy: -4 }, perf(-4))), C("เล่นแบบปลอดภัย", N("คนดูปรบมือพอเป็นพิธี", {}, perf(2)))]],
    crisis: ["งานที่ล้อผู้ครอง", "งานชิ้นใหม่ของคุณล้อเลียนผู้ครองแผ่นดินแบบที่ใครเห็นก็รู้", [C("แสดงต่อไป", (l) => { lean(l, { c: 6, h: 3 }); addFame(l, 5); if (chance(l, 0.4)) { addStanding(l, -10); return { text: "ทหารปิดโรงละคร และชื่อคุณอยู่ในบัญชีของราชสำนัก แต่ทั้งเมืองท่องบทของคุณได้", kind: "bad" }; } return { text: "ผู้ครองหัวเราะเสียงดังที่สุดในโรง และส่งเงินรางวัลมาให้", kind: "milestone" }; }), C("แก้บทให้ปลอดภัย", N("งานยังดี แต่คนดูรู้ว่ามีบางอย่างหายไป", {}, perf(2)))]] },
  travel: { first: ["การเดินทางครั้งแรกในฐานะผู้นำ", "ครั้งแรกที่ทั้งขบวนรอคำสั่งจากคุณ ฟ้าทางตะวันตกเริ่มมืด", [K("อ่านฟ้าแล้วเลี่ยงพายุ", "smarts", 45, G("ทุกคนถึงปลายทางครบ และเริ่มเรียกคุณว่าหัวหน้า", {}, perf(8)), B("พายุมาเร็วกว่าที่คิด ของเสียหายไปหนึ่งในสาม", { gold: -5 }, perf(-4))), C("ฝ่าพายุไปตามกำหนด", N("ทุกคนเปียกโชกแต่ถึงตรงเวลา", {}, perf(3)))]],
    crisis: ["คนหายกลางทาง", "ระหว่างทาง คนในขบวนหายไปหนึ่งคน ทุกคนอยากเดินต่อเพราะเสบียงใกล้หมด", [C("หยุดขบวนออกตามหา", (l) => { lean(l, { m: 6 }); if (chance(l, 0.6)) { perf(5)(l); return { text: "คุณพบเขาในหุบเขาขาเจ็บ ทั้งขบวนจะไม่ลืมเรื่องนี้", kind: "good" }; } addStat(l, "health", -8); return { text: "คุณตามหาสามวันไม่เจอ และกลับมาพร้อมเสบียงที่เกือบหมด", kind: "bad" }; }), C("เดินต่อตามกำหนด", N("ขบวนถึงปลายทาง แต่มีคนหนึ่งที่ไม่ได้มาด้วย", { joy: -5 }, (l) => lean(l, { m: -4 })))]] },
  trade: { first: ["ลูกค้าประจำคนแรก", "ลูกค้าคนหนึ่งกลับมาเป็นครั้งที่สิบ และขอให้ลดราคาเพราะเป็นขาประจำ", [C("ลดให้และแถมของเล็กๆ", G("เขาพาเพื่อนมาอีกห้าคนในเดือนต่อมา", {}, perf(6))), C("ราคาคือราคา", N("เขาซื้อ แต่ไม่กลับมาอีก", {}, perf(-1)))]],
    crisis: ["ปีที่ข้าวยากหมากแพง", "ปีนี้ของแพงจนชาวบ้านไม่มีจะกิน ทุกคนรู้ว่าคุณมีของเก็บไว้เต็มโกดัง", [C("ขายในราคาเดิม", G("โกดังว่างเร็วกว่าที่คิด และทั้งเมืองจำว่าใครไม่ซ้ำเติม", { fame: 3 }, (l) => lean(l, { m: 6 }))), C("ขึ้นราคาตามตลาด", G("ปีนี้คุณรวยที่สุดในชีวิต และมีคนเขียนคำด่าไว้หน้าประตูร้าน", { gold: 40 }, (l) => { lean(l, { m: -6 }); addStanding(l, -4); }))]] },
  wild: { first: ["สัตว์ที่ไว้ใจคุณ", "สัตว์ที่ดุที่สุดในคอกยอมกินอาหารจากมือคุณเป็นครั้งแรก", [C("นั่งอยู่กับมันทั้งคืน", G("ตั้งแต่วันนั้น มันไม่ยอมให้ใครเข้าใกล้นอกจากคุณ", { joy: 4 }, perf(6))), C("รีบบอกหัวหน้า", N("หัวหน้าเอามันไปขายให้ขุนนางในเดือนเดียว", { joy: -3 }, perf(3)))]],
    crisis: ["คอกพัง", "พายุพัดคอกพัง สัตว์ทั้งหมดหนีเข้าป่า เจ้านายบอกว่าใครหาคืนไม่ได้ต้องชดใช้", [K("ตามรอยในป่าทั้งคืน", "health", 50, G("คุณพาพวกมันกลับมาได้เกือบหมดตอนรุ่งสาง", {}, perf(10)), B("ป่าลึกกว่าที่คิด คุณกลับมาพร้อมแผลและสัตว์แค่ตัวเดียว", { hp: -8 }, perf(-8))), PAY("ชดใช้ค่าเสียหายเอง", 20, N("เจ้านายรับเงินแล้วบอกว่าคุณเป็นคนเดียวที่ไม่หนีความรับผิดชอบ", {}, perf(4)))]] },
  magic: { first: ["การทดลองครั้งแรก", "คุณได้รับอนุญาตให้ทำการทดลองของตัวเองเป็นครั้งแรก ผลึกในห้องเริ่มสั่น", [K("ทำต่อจนจบ", "smarts", 55, BIG("ผลการทดลองถูกจดไว้ในตำราของหอคอย พร้อมชื่อคุณ", { iq: 2 }, perf(8)), B("ผลึกแตก ห้องทดลองไหม้ไปครึ่งห้อง", { hp: -5 }, perf(-6))), C("หยุดก่อนจะเกินควบคุม", N("ไม่มีอะไรระเบิด และไม่มีอะไรเกิดขึ้น", {}, perf(2)))]],
    crisis: ["ความรู้ต้องห้าม", "ในห้องสมุดชั้นล่าง คุณเจอตำราที่หอคอยห้ามอ่าน คำตอบของงานวิจัยทั้งชีวิตอยู่ในนั้น", [C("อ่านมัน", (l) => { lean(l, { f: -4, c: 4 }); fl(l).magic += 15; if (chance(l, 0.35)) { perf(-15)(l); return { text: "หอคอยรู้ และคุณถูกห้ามเข้าห้องสมุดตลอดชีวิต แต่สิ่งที่อ่านไปแล้วไม่หายไป", kind: "bad" }; } return { text: "งานวิจัยของคุณก้าวหน้าไปสิบปีในคืนเดียว", kind: "good" }; }), C("ส่งคืนผู้ดูแล", G("ผู้ดูแลมองคุณด้วยความเคารพ และให้กุญแจห้องที่ไม่มีใครได้เข้า", {}, (l) => { lean(l, { h: 4 }); perf(5)(l); }))]] },
  dark: { first: ["งานแรกของกิลด์", "หัวหน้าส่งคุณไปงานแรกที่ไม่ได้มีไว้ซ้อม", [K("ทำให้เงียบที่สุด", "luck", 50, G("ไม่มีใครรู้ว่าคุณเคยอยู่ที่นั่น", { gold: 10 }, perf(8)), B("สุนัขเห่าทั้งถนน คุณหนีมาได้แต่มือเปล่า", {}, perf(-5))), C("ทำพลาดโดยตั้งใจ", N("หัวหน้ามองคุณนาน แล้วส่งคุณไปเฝ้าประตูแทน", {}, (l) => { lean(l, { h: 3 }); perf(-6)(l); }))]],
    crisis: ["คนทรยศในกิลด์", "หัวหน้าสงสัยว่ามีคนส่งข่าวให้ยาม และเขาสงสัยคุณ", [K("ชี้ตัวคนทรยศตัวจริง", "smarts", 55, G("หัวหน้าเชื่อ และคุณได้ตำแหน่งของคนนั้น", {}, perf(10)), B("หลักฐานของคุณไม่พอ หัวหน้าเริ่มจับตาคุณ", {}, perf(-10))), C("หนีออกจากเมืองก่อน", N("คุณออกเดินทางก่อนรุ่งสาง ทิ้งงานทั้งหมดไว้ข้างหลัง", {}, (l) => { l.job = undefined; }))]] },
};
const FAMS = Object.keys(ARCS) as Fam[];
const ARC_EVENTS: GameEvent[] = FAMS.flatMap((fam) => {
  const a = ARCS[fam];
  return [
    E(`ft.c2.first_${fam}`, [14, 900], a.first[1], a.first[2], { title: a.first[0], when: (l) => on(l) && myFam(l) === fam && (l.job?.level ?? 0) >= 2 && l.flags[`ftArc1_${l.job!.careerId}`] === undefined, weight: 35, forced: true, maxTimes: 0, prepare: (l) => { l.flags[`ftArc1_${l.job!.careerId}`] = l.age; return {}; } }),
    E(`ft.c2.crisis_${fam}`, [16, 900], a.crisis[1], a.crisis[2], { title: a.crisis[0], when: (l) => on(l) && myFam(l) === fam && (l.job?.level ?? 0) >= 3 && l.flags[`ftArc2_${l.job!.careerId}`] === undefined, weight: 25, forced: true, maxTimes: 0, prepare: (l) => { l.flags[`ftArc2_${l.job!.careerId}`] = l.age; return {}; } }),
  ];
});
// ตั้งค่าธงใน prepare ทำให้ queue ทิ้งเรื่องนี้ทันที (when กลายเป็นเท็จ) · จึงย้ายไปตั้งในทางเลือกแทน
for (const e of ARC_EVENTS) { const k = e.id.includes("first_") ? "ftArc1_" : "ftArc2_"; e.prepare = undefined; e.choices = e.choices?.map((ch) => ({ ...ch, run: (l, c, ok) => { if (l.job) l.flags[`${k}${l.job.careerId}`] = l.age; return ch.run(l, c, ok); } })); }

// ───────────── งานประจำของอาชีพใหม่ (แท็บอาชีพ) ─────────────
const lv = (l: Life) => l.job?.level ?? 1;
const by = (stat: "smarts" | "looks" | "health" | "luck", base = 0.45) => (l: Life) => clamp(base + (l.stats[stat] - 50) / 150 + (lv(l) - 1) * 0.06, 0.05, 0.95);
const pay = (l: Life, g: number) => { const v = Math.round(g * (1 + (lv(l) - 1) * 0.35)); addMoney(l, v * GOLD); return v; };
const work = (l: Life, d: number) => { if (l.job) l.job.performance = clamp(l.job.performance + d, 0, 100); };
const good = (text: string) => ({ text, kind: "good" as const });
const bad = (text: string) => ({ text, kind: "bad" as const });
const JA = (a: Omit<JobAction, "world" | "emoji">): JobAction => ({ ...a, emoji: "", world: "fantasy" });
const NEW_ACTIONS: JobAction[] = [
  JA({ id: "fj_s_case", jobs: ["ft_scribe"], name: "ร่างคำฟ้องให้ชาวบ้าน", desc: "ค่าธรรมเนียมเล็กน้อย · ผลงาน +", odds: by("smarts"), run: (l, s) => { work(l, s ? 7 : 1); return s ? good(`คำฟ้องของคุณชนะคดีที่ดิน ได้ค่าธรรมเนียม ${pay(l, 8)} เหรียญทอง`) : { text: "คำฟ้องถูกตีกลับเพราะสะกดชื่อพยานผิด" }; } }),
  JA({ id: "fj_s_bribe", jobs: ["ft_scribe"], name: "รับเงินใต้โต๊ะเลื่อนคดี", desc: "เงินดี · ถูกจับได้จบอาชีพ", minLevel: 2, odds: by("luck", 0.6), run: (l, s) => { lean(l, { h: -4 }); if (s) return good(`ลิ้นชักโต๊ะคุณหนักขึ้น ${pay(l, 20)} เหรียญทอง`); l.job = undefined; addStanding(l, -8); return bad("ผู้ตรวจของศาลสูงเปิดลิ้นชักคุณต่อหน้าทุกคน คุณถูกปลดในวันนั้น"); } }),
  JA({ id: "fj_t_collect", jobs: ["ft_taxman"], name: "ออกเก็บภาษีหมู่บ้านไกล", desc: "ผลงาน + · ชาวบ้านไม่ชอบคุณ", odds: by("health"), run: (l, s) => { work(l, s ? 8 : 2); addStanding(l, -1); return s ? good("คุณเก็บภาษีครบทุกหลัง และไม่มีใครยิ้มให้คุณ") : { text: "หมู่บ้านปิดประตูใส่ คุณกลับมามือเปล่า" }; } }),
  JA({ id: "fj_t_mercy", jobs: ["ft_taxman"], name: "ผ่อนผันให้ครอบครัวที่ยากจน", desc: "ชื่อเสียงในแผ่นดิน + · ผลงาน −", run: (l) => { work(l, -4); addStanding(l, 4); lean(l, { m: 4 }); return good("คุณขีดชื่อสามครอบครัวออกจากบัญชีปีนี้ หัวหน้าไม่พอใจ แต่ทั้งหมู่บ้านรู้"); } }),
  JA({ id: "fj_i_hunt", jobs: ["ft_inquisitor"], name: "ไต่สวนข่าวลือเรื่องแม่มด", desc: "ผลงาน + · บางครั้งคนบริสุทธิ์ก็โดน", odds: by("smarts"), run: (l, s) => { work(l, s ? 8 : 0); if (!s) lean(l, { m: -4 }); return s ? good("คุณพบว่าแม่มดคือหมอสมุนไพรธรรมดา และปล่อยเธอไปพร้อมคำขอโทษ") : bad("ชาวบ้านจับหญิงชราคนหนึ่งก่อนคุณจะไปถึง และคุณช่วยไม่ทัน"); } }),
  JA({ id: "fj_i_purge", jobs: ["ft_inquisitor"], name: "กวาดล้างผู้ใช้เวทเถื่อน", desc: "ผลงานมาก · ใจแข็งขึ้น", minLevel: 2, odds: by("health", 0.5), run: (l, s) => { work(l, s ? 12 : -2); lean(l, { m: -5, f: 3 }); return s ? good(`ห้องใต้ดินของผู้ใช้เวทเถื่อนถูกปิด คุณได้เงินรางวัล ${pay(l, 15)} เหรียญทอง`) : bad("พวกเขารู้ตัวก่อนและหนีไปหมด"); } }),
  JA({ id: "fj_h_ward", jobs: ["ft_healer"], name: "เฝ้าคนไข้หนักทั้งคืน", desc: "ผลงาน + · เหนื่อย", odds: by("health"), run: (l, s) => { work(l, s ? 8 : 2); addStat(l, "health", -1); return s ? good("คนไข้ลืมตาตอนรุ่งสาง และเรียกชื่อคุณ") : bad("คุณทำทุกอย่างแล้ว แต่เขาไม่ตื่นขึ้นมาอีก"); } }),
  JA({ id: "fj_h_free", jobs: ["ft_healer"], name: "เปิดรักษาฟรีที่ลานวิหาร", desc: "ชื่อเสียง + · ไม่ได้เงิน", run: (l) => { addFame(l, 2); addStanding(l, 3); lean(l, { m: 4 }); return good("แถวคนไข้ยาวไปถึงประตูเมือง คุณรักษาจนมือสั่น"); } }),
  JA({ id: "fj_p_portrait", jobs: ["ft_painter"], name: "รับวาดภาพเหมือนขุนนาง", desc: "เงินดีถ้าเขาพอใจ", odds: by("looks"), run: (l, s) => { work(l, s ? 7 : -2); return s ? good(`ขุนนางยืนหน้าภาพนานจนทุกคนอึดอัด แล้วจ่าย ${pay(l, 14)} เหรียญทอง`) : bad("ขุนนางบอกว่าภาพทำให้เขาดูแก่ และไม่จ่ายสักเหรียญ"); } }),
  JA({ id: "fj_p_mural", jobs: ["ft_painter"], name: "วาดภาพบนกำแพงเมือง", desc: "ชื่อเสียง + · ผลงาน +", minLevel: 2, run: (l) => { addFame(l, 2); work(l, 5); return good("เด็กๆ ทั้งเมืองมานั่งดูคุณวาดทุกวัน"); } }),
  JA({ id: "fj_w_play", jobs: ["ft_playwright"], name: "เขียนบทละครเรื่องใหม่", desc: "ผลงาน + · ดังได้ถ้าโชคดี", odds: by("smarts", 0.4), run: (l, s) => { work(l, s ? 9 : 1); if (s) addFame(l, 2); return s ? good(`บทใหม่ของคุณแสดงเต็มโรงสามสัปดาห์ ได้ส่วนแบ่ง ${pay(l, 12)} เหรียญทอง`) : { text: "เจ้าของโรงละครอ่านสามหน้าแล้ววางลง" }; } }),
  JA({ id: "fj_w_ghost", jobs: ["ft_playwright"], name: "เขียนบทให้คนอื่นใส่ชื่อ", desc: "เงินดี · ไม่มีใครรู้ว่าเป็นของคุณ", run: (l) => { lean(l, { h: -2 }); return good(`บทของคุณดังทั่วเมืองภายใต้ชื่อของคนอื่น คุณได้ ${pay(l, 18)} เหรียญทอง`); } }),
  JA({ id: "fj_j_show", jobs: ["ft_jester"], name: "แสดงในงานเลี้ยงของขุนนาง", desc: "เงินดีถ้าพวกเขาหัวเราะ", odds: by("looks"), run: (l, s) => { work(l, s ? 8 : -3); return s ? good(`ทั้งโต๊ะหัวเราะจนไวน์หก ได้ ${pay(l, 10)} เหรียญทอง`) : bad("มุกของคุณไปโดนภรรยาของเจ้าภาพ และไม่มีใครหัวเราะ"); } }),
  JA({ id: "fj_j_truth", jobs: ["ft_jester"], name: "ล้อผู้มีอำนาจต่อหน้าทุกคน", desc: "ชื่อเสียงมาก · เสี่ยงถูกไล่", minLevel: 2, odds: by("luck", 0.5), run: (l, s) => { lean(l, { c: 3, h: 3 }); if (s) { addFame(l, 4); return good("เขาหัวเราะตาม เพราะถ้าไม่หัวเราะก็เท่ากับยอมรับ"); } l.job = undefined; return bad("ไม่มีใครหัวเราะ คุณถูกส่งออกจากคฤหาสน์ตอนเที่ยงคืน"); } }),
  JA({ id: "fj_c_route", jobs: ["ft_caravan"], name: "นำขบวนข้ามช่องเขา", desc: "ค่าจ้าง · เสี่ยงโจร", odds: (l) => fightOdds(l, 14 + lv(l) * 3), run: (l, s) => { work(l, s ? 8 : -2); if (!s) addStat(l, "health", -8); return s ? good(`ขบวนถึงปลายทางครบ ได้ค่านำทาง ${pay(l, 12)} เหรียญทอง`) : bad("โจรภูเขาซุ่มที่ช่องแคบ คุณพาคนรอดมาได้แต่ของหายครึ่งหนึ่ง"); } }),
  JA({ id: "fj_c_new", jobs: ["ft_caravan"], name: "สำรวจเส้นทางใหม่", desc: "ผลงานมากถ้าเจอทางลัด", minLevel: 2, odds: by("luck", 0.4), run: (l, s) => { work(l, s ? 12 : 0); return s ? good("คุณเจอทางลัดที่ย่นเวลาเดินทางไปห้าวัน ทุกกองคาราวานอยากจ้างคุณ") : { text: "ทางที่คิดว่าลัดกลับพาไปหน้าผา" }; } }),
];

// ───────────── กิจกรรม ─────────────
const M = (a: Omit<Activity, "world" | "emoji">): Activity => ({ ...a, emoji: "", world: "fantasy" });
const ACTS: Activity[] = [
  M({ group: "การงาน", id: "ft_raise", name: "ขอขึ้นเงินเดือน", desc: "ปีละครั้ง · ผลงานดีโอกาสสูง · พลาดแล้วเจ้านายจำ", minAge: 14, time: 0, available: (l) => !!l.job?.careerId.startsWith("ft_") && l.job.years >= 1 && raises(l) < RAISE_MAX && yearly("ftRaiseAsk")(l), run: (l) => { l.flags.ftRaiseAsk = l.age; runEvent(l, "ft.c2.raise"); return { text: "" }; } }),
  M({ group: "การงาน", id: "ft_gig", name: "งานเสริม", desc: "ร้องเพลง สอนหนังสือ คุ้มกัน หรือขนของเถื่อน · ปีละครั้ง", minAge: 14, available: (l) => on(l) && yearly("ftGig")(l), run: (l) => { l.flags.ftGig = l.age; runEvent(l, "ft.c2.gig"); return { text: "" }; } }),
  M({ group: "การงาน", id: "ft_biz_open", name: "เปิดกิจการของตัวเอง", desc: `ร้านเล็กที่โตได้ทีละขั้น · ทุน ${BIZ_OPEN} เหรียญทอง`, minAge: 18, time: 0, available: (l) => on(l) && !fl(l).biz, run: (l) => { runEvent(l, "ft.c2.biz_open"); return { text: "" }; } }),
  M({ group: "การงาน", id: "ft_biz_grow", name: "ดูแลกิจการ", desc: "ขยาย ขาย หรือพอแค่นี้ · ปีละครั้ง", minAge: 18, time: 0, available: (l) => !!fl(l).biz && yearly("ftBizGrow")(l), run: (l) => { l.flags.ftBizGrow = l.age; runEvent(l, "ft.c2.biz_grow"); return { text: "" }; } }),
  M({ group: "การงาน", id: "ft_tguild", name: "เข้าสมาคมของสายงาน", desc: `ช่วยหางานและปกป้องคุณ · ค่าบำรุงปีละ ${DUES} เหรียญทอง`, minAge: 14, time: 0, cost: GUILD_JOIN * GOLD, available: (l) => { const f = myFam(l); const ban = String(l.flags.ftGuildBan ?? ""); return !!f && !!GUILDS[f] && !tg(l) && !(ban.startsWith(`${f}:`) && l.age - Number(ban.split(":")[1]) < 10); }, run: (l) => { const f = myFam(l)!; addMoney(l, -GUILD_JOIN * GOLD); fl(l).tguild = { fam: f, rank: 1, since: l.age, owed: 0 }; const t = `คุณได้ตราของ${GUILDS[f]}ติดอก`; log(l, t, "good"); return { text: t, kind: "good" }; } }),
  M({ group: "การงาน", id: "ft_apprentice", name: "รับลูกมือ", desc: "ต้องเป็นขั้นสามขึ้นไป · ช่วยงาน และอาจเก่งเกินคุณ", minAge: 20, time: 0, available: (l) => (l.job?.level ?? 0) >= 3 && !!l.job?.careerId.startsWith("ft_") && !apprentice(l), run: (l) => { const p = createPerson(l, "ally", { age: randInt(l, 14, 18), bond: 50 }); p.job = `ลูกมือ${jobName(l)}ของคุณ`; p.tags = [...(p.tags ?? []), "apprentice", `app_since:${l.age}`]; const t = `${shortName(p)}มาเคาะประตูพร้อมห่อผ้าใบเดียว ขอเป็นลูกมือของคุณ`; log(l, t, "good"); return { text: t, kind: "good" }; } }),
  M({ group: "การงาน", id: "ft_patron", name: "หาผู้อุปถัมภ์", desc: "รับใช้ขุนนาง นักเวท หรือวีรบุรุษ · รุ่งและร่วงไปกับเขา", minAge: 16, time: 0, available: (l) => on(l) && !pat(l) && (l.fame >= 10 || (l.job?.level ?? 0) >= 2), run: (l) => { runEvent(l, "ft.c2.patron"); return { text: "" }; } }),
];

// ───────────── ทุกปี ─────────────
function careerYear(l: Life) {
  if (!on(l) || !l.alive || Number(l.flags.jailUntil ?? -1) > l.age) return;
  const f = fl(l), j = l.job;
  // กิจการ: รายได้ตามขั้น · ปีแย่ขาดทุน · ขั้นสองขึ้นไปมีคู่แข่งมาเป็นระยะ
  const b = f.biz;
  if (b) {
    if (chance(l, BIZ_BAD)) {
      const loss = b.level * 6; addMoney(l, -loss * GOLD); b.bad = (b.bad ?? 0) + 1;
      if (b.bad >= 2 && b.level > 1) { b.level--; b.bad = 0; log(l, `${b.name}ขาดทุนสองปีติด ต้องปิดสาขาลงเหลือ${BIZ_LEVELS[b.level]}`, "bad"); }
      else log(l, `ปีนี้${b.name}ขาดทุน ${loss} เหรียญทอง`, "bad");
    } else { const g = b.level * BIZ_INCOME + randInt(l, 0, b.level * 3); addMoney(l, g * GOLD); b.bad = 0; }
    if (b.level >= 2 && !b.rival && l.age - Number(l.flags.ftRivalAt ?? -99) >= 6 && chance(l, 0.2)) b.rival = pick(l, RIVAL_NAMES);
  }
  // สมาคม: ค่าบำรุง ขั้นตามอายุงาน · ค้างสองปีถูกขับออก · ไม่มีงานในสายแล้วก็ออกไปเอง
  const g = f.tguild;
  if (g) {
    if (myFam(l) !== g.fam && !(b && BIZ[b.kind]?.fam === g.fam)) { f.tguild = undefined; log(l, `คุณไม่ได้ทำงานในสายของ${GUILDS[g.fam as Fam]}แล้ว จึงคืนตราให้สมาคม`); }
    else if (l.money >= DUES * GOLD) { addMoney(l, -DUES * GOLD); g.owed = 0; if (j) j.performance = clamp(j.performance + 2, 0, 100); if (g.rank < 4 && l.age - g.since >= g.rank * 6 && (j?.level ?? 0) > g.rank) { g.rank++; log(l, `${GUILDS[g.fam as Fam]}เลื่อนคุณเป็น${GUILD_RANKS[g.rank]}`, "good"); if (g.rank >= 4) deed(l, `${GUILD_RANKS[g.rank]}แห่ง${GUILDS[g.fam as Fam]}`); } }
    else if (++g.owed >= 2) expel(l, "ฐานค้างค่าบำรุงสองปี");
    else log(l, `ปีนี้คุณจ่ายค่าบำรุง${GUILDS[g.fam as Fam]}ไม่ได้ ค้างสองปีจะถูกขับออก`, "bad");
  }
  // ผลงานที่มีชื่อ: ขั้นสองขึ้นไปในสายที่สร้างงานได้ · งานดังเรียกลูกค้า และดังพอก็กลายเป็นตำนาน
  if (j && j.level >= 2 && chance(l, WORK_CHANCE)) { const name = makeWork(l); if (name) log(l, `คุณสร้าง「${name}」 คนเริ่มพูดถึงมันในโรงเตี๊ยม`, "good"); }
  for (const w of worksOf(l)) if (chance(l, 0.25)) { w.fame++; if (w.fame === WORK_LEGEND) { deed(l, `ผู้สร้าง「${w.name}」`); addFame(l, 4); log(l, `「${w.name}」ของคุณถูกเล่าต่อไปทั่วแผ่นดิน`, "milestone"); } }
  if (j && worksOf(l).length) j.performance = clamp(j.performance + Math.min(3, worksOf(l).length), 0, 100);
  // ลูกมือช่วยงาน
  if (j && apprentice(l)) j.performance = clamp(j.performance + 2, 0, 100);
  // ผู้อุปถัมภ์: เงินอุดหนุน · ล้มหรือรุ่งได้ และคุณล้มหรือรุ่งไปด้วย
  const p = f.patron;
  if (p) {
    addMoney(l, PATRON_STIPEND * GOLD); if (j) j.performance = clamp(j.performance + 1, 0, 100);
    if (chance(l, PATRON_FALL)) { f.patron = undefined; addStanding(l, -4); log(l, `${p.name}ผู้อุปถัมภ์ของคุณหมดอำนาจในชั่วข้ามคืน คุณถูกลากลงไปด้วย`, "bad"); }
    else if (chance(l, 0.05)) { addMoney(l, 15 * GOLD); addFame(l, 2); log(l, `${p.name}ได้ตำแหน่งใหญ่ในราชสำนัก และไม่ลืมคนของบ้าน`, "good"); }
  }
}

export const CAREERS2_EVENTS: GameEvent[] = [TRIAL, RAISE, GIG, BIZ_OPEN_EV, BIZ_GROW, BIZ_RIVAL, GUILD_RULE, APPRENTICE_EV, TURN, PATRON_EV, PATRON_FEUD, BOSS_FALL, ...ARC_EVENTS];

/** เรียกหลังลงทะเบียน event ทั้งหมดแล้ว */
export function loadCareers2() {
  for (const c of NEW) CAREERS.push({ ...c, emoji: "", world: "fantasy" });
  FT_JOB_ACTIONS.push(...NEW_ACTIONS); JOB_ACTIONS.push(...NEW_ACTIONS);
  for (const [k, ids] of CITY_JOBS) KINDS[k].jobs.push(...ids);
  Object.assign(CAREER_FIT, { ft_scribe: { h: 5 }, ft_taxman: { h: -2, c: 2 }, ft_inquisitor: { f: 8, m: -3 }, ft_healer: { m: 8, f: 3 }, ft_painter: { c: -2 }, ft_playwright: { h: 3 }, ft_jester: { c: 5, h: 4 }, ft_caravan: { c: 6 } });
  ACTIVITIES.push(...ACTS);
  yearHooks.push(careerYear);
  // ปุ่มที่ยังไม่ถึงเวลาไม่ต้องขึ้นเป็นปุ่มล็อก (ขอขึ้นเงินเดือน รับลูกมือ หาผู้อุปถัมภ์ ดูแลกิจการ)
  const LATER = new Set(["ft_biz_grow", "ft_biz_open", "ft_raise", "ft_apprentice", "ft_patron"]);
  activityFilters.push((l, a) => !LATER.has(a.id) || !a.available || a.available(l));
  // บททดสอบก่อนรับเข้างาน (โลกแฟนตาซี)
  hireTrialHooks.push((l, c) => (on(l) && c.world === "fantasy" && famOf(c.id) ? "ft.c2.trial" : undefined));
  // ถูกไล่ออกติดตัวไปสิบปี · ลาออกดีๆ หลังทำงานนานได้คำรับรอง · ถูกไล่ออกแต่สมาคมช่วยหางานให้ได้ครั้งหนึ่ง
  jobEndHooks.push((l, cid, how, job) => {
    if (!on(l)) return;
    const fam = famOf(cid);
    if (!fam) return;
    const f = fl(l);
    if (how === "fired") {
      f.leftMark = { ...f.leftMark, [fam]: { how: "fired", age: l.age } };
      const g = f.tguild;
      if (g && g.fam === fam && !g.saved) { g.saved = true; startJob(l, cid); if (l.job) l.job.level = Math.max(1, job.level - 1); log(l, `${GUILDS[g.fam as Fam]}หางานใหม่ในสายเดิมให้คุณภายในเดือนเดียว`, "good"); }
    } else if (job.years >= 3 && job.performance >= 50) f.leftMark = { ...f.leftMark, [fam]: { how: "reference", age: l.age } };
  });
  jobChanceHooks.push((l, c, p) => {
    if (!on(l)) return p;
    const fam = famOf(c.id), m = fam ? fl(l).leftMark?.[fam] : undefined;
    if (m && l.age - m.age <= MARK_YEARS) p += m.how === "fired" ? -FIRED_PENALTY : REFERENCE_EDGE;
    if (fam && fl(l).tguild?.fam === fam) p += GUILD_EDGE;
    return p;
  });
  // เปลี่ยนสายกลางชีวิต: งานใหม่ที่ใช้ฝีมือแบบเดิมเริ่มขั้นสอง
  jobStartHooks.push((l) => {
    if (!on(l) || !l.job || !l.flags.ftTurnKey) return;
    const c = careerById(l.job.careerId);
    if (c && c.id !== l.flags.ftTurnFrom && c.key === l.flags.ftTurnKey) { l.job.level = 2; log(l, "สิ่งที่เรียนมาจากงานเก่าทำให้คุณเริ่มงานใหม่ได้เร็วกว่าคนอื่น", "good"); }
    delete l.flags.ftTurnKey; delete l.flags.ftTurnFrom;
  });
  salaryHooks.push((l, c, base) => (on(l) && l.job?.careerId === c.id ? base * (1 + Number(l.flags[`ftRaise_${c.id}`] ?? 0) * RAISE_STEP) : base));
}

/** สรุปสำหรับแท็บอาชีพ */
export function careerLines(l: Life): string[] {
  const f = fl(l), out: string[] = [];
  if (f.biz) out.push(`กิจการ: ${f.biz.name} · ${BIZ_LEVELS[f.biz.level]}${f.biz.rival ? ` · คู่แข่ง: ${f.biz.rival}` : ""}`);
  if (f.tguild) out.push(`${GUILDS[f.tguild.fam as Fam]}: ${GUILD_RANKS[f.tguild.rank]}${f.tguild.owed ? " · ค้างค่าบำรุง" : ""}`);
  if (f.patron) out.push(`ผู้อุปถัมภ์: ${f.patron.name} (${PATRONS[f.patron.kind].label})`);
  const a = apprentice(l); if (a) out.push(`ลูกมือ: ${shortName(a)}`);
  if (worksOf(l).length) out.push(`ผลงาน: ${worksOf(l).map((w) => `「${w.name}」${w.fame >= WORK_LEGEND ? " (ตำนาน)" : ""}`).join(" · ")}`);
  if (raises(l)) out.push(`ขึ้นเงินเดือนมาแล้ว ${raises(l)} ครั้ง (+${Math.round(raises(l) * RAISE_STEP * 100)}%)`);
  for (const [fam, m] of Object.entries(f.leftMark ?? {})) if (l.age - m.age <= MARK_YEARS) out.push(m.how === "fired" ? `ประวัติถูกไล่ออกจากสาย${FAM_NAME[fam as Fam]} ยังติดตัว (สมัครงานสายนี้ยากขึ้นถึงอายุ ${m.age + MARK_YEARS})` : `มีคำรับรองจากงานเก่าสาย${FAM_NAME[fam as Fam]} (สมัครงานสายนี้ง่ายขึ้นถึงอายุ ${m.age + MARK_YEARS})`);
  return out;
}
export const FAM_NAME: Record<Fam, string> = { craft: "ช่างฝีมือ", arms: "นักรบ", court: "ราชสำนักและกฎหมาย", faith: "ศรัทธา", arts: "ศิลปะ", travel: "การเดินทาง", trade: "การค้า", wild: "สัตว์และป่าเขา", magic: "เวทและความรู้", dark: "ทางมืด" };
