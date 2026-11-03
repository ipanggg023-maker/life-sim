// อาชีพของโลกแฟนตาซี: ทุกงานมีสิ่งที่ทำได้ของตัวเอง (แท็บอาชีพ) ทรัพย์สินที่สะสมได้ และเรื่องราวของตัวเอง
// ทรัพย์สิน (ไร่ ร้าน ห้องพัก) ให้รายได้ทุกปีแม้ลาออกไปแล้ว · ช่างตีอาวุธ ทำคทา และลงอาคมของตัวเองได้
import type { Outcome } from "../../engine/events";
import { kill, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, StatKey } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, log, shortName } from "../../engine/util";
import { CAREERS } from "../core/careers";
import { JOB_ACTIONS, type JobAction } from "../murim/life/jobActions";
import { C, E, G, GOLD, K, N, type Fx } from "./kit";
import { SPELLS, learnSpell } from "./magic";
import { MYSTERIES } from "./mysteries";
import { canCast, deathOdds, fightOdds } from "./power";
import { weaponNoun } from "./styles";
import { addStanding, dataOf, deed, fl, homeKingdom, standingOf } from "./state";
import { mysteryState } from "./mysteries";
import type { GameEvent } from "../../engine/events";

type Need = (l: Life) => string | undefined;
interface Job { id: string; name: string; minAge: number; key: StatKey; dc: number; baseSalary: number; titles: string[]; needs?: Need }

const castNeed: Need = (l) => (canCast(l) ? undefined : "ต้องร่ายเวทได้");
export const NEW_CAREERS: Job[] = [
  { id: "ft_alchemist", name: "นักเล่นแร่แปรธาตุ", minAge: 16, key: "smarts", dc: 50, baseSalary: 15000, titles: ["ผู้ช่วยปรุงยา", "นักปรุงยา", "นักเล่นแร่แปรธาตุ", "ปรมาจารย์แปรธาตุ", "นักแปรธาตุหลวง"] },
  { id: "ft_priest", name: "นักบวชแห่งศาสนจักรอรุณ", minAge: 14, key: "smarts", dc: 40, baseSalary: 9000, titles: ["สามเณร", "นักบวช", "บาทหลวง", "สังฆนายก", "อัครสังฆราช"], needs: (l) => (fl(l).race === "demon" ? "ศาสนจักรไม่รับทายาทปีศาจ" : undefined) },
  { id: "ft_bard", name: "กวีพเนจร", minAge: 14, key: "looks", dc: 35, baseSalary: 7000, titles: ["นักร้องข้างถนน", "กวีพเนจร", "กวีประจำโรงละคร", "กวีราชสำนัก", "ตำนานแห่งบทเพลง"] },
  { id: "ft_ranger", name: "พรานป่า", minAge: 14, key: "health", dc: 40, baseSalary: 9000, titles: ["พรานฝึกหัด", "พราน", "ผู้นำทาง", "ผู้พิทักษ์ป่า", "เจ้าป่าเจ้าเขา"] },
  { id: "ft_sailor", name: "กะลาสีเรือ", minAge: 14, key: "health", dc: 30, baseSalary: 8000, titles: ["เด็กเรือ", "กะลาสี", "ต้นหน", "กัปตัน", "จอมพลเรือ"] },
  { id: "ft_miner", name: "คนงานเหมือง", minAge: 14, key: "health", dc: 25, baseSalary: 7500, titles: ["คนขุดแร่", "ช่างเหมือง", "หัวหน้าอุโมงค์", "นายเหมือง", "เจ้าของเหมือง"] },
  { id: "ft_thief", name: "สมาชิกกิลด์โจร", minAge: 14, key: "luck", dc: 45, baseSalary: 13000, titles: ["นักล้วงกระเป๋า", "ย่องเบา", "หัวขโมย", "เจ้าแห่งเงา", "ราชาโจร"] },
  { id: "ft_chef", name: "พ่อครัว", minAge: 14, key: "smarts", dc: 35, baseSalary: 9000, titles: ["เด็กล้างจาน", "ผู้ช่วยครัว", "พ่อครัว", "หัวหน้าพ่อครัว", "พ่อครัวหลวง"] },
  { id: "ft_diplomat", name: "ทูต", minAge: 20, key: "looks", dc: 60, baseSalary: 20000, titles: ["เสมียนสถานทูต", "ผู้ช่วยทูต", "ทูต", "ราชทูต", "อัครราชทูต"], needs: (l) => (l.stats.smarts >= 55 ? undefined : "ต้องมีสติปัญญา 55 ขึ้นไป") },
  { id: "ft_tamer", name: "นักฝึกสัตว์เวท", minAge: 16, key: "health", dc: 45, baseSalary: 11000, titles: ["คนเลี้ยงม้า", "นักฝึกสัตว์", "นักฝึกกริฟฟิน", "ผู้ควบคุมสัตว์เวท", "ราชันสัตว์เวท"] },
  { id: "ft_enchanter", name: "ช่างลงอาคม", minAge: 18, key: "smarts", dc: 55, baseSalary: 18000, titles: ["ผู้ช่วยช่างรูน", "ช่างสลักรูน", "ช่างลงอาคม", "ปรมาจารย์อาคม", "ช่างอาคมหลวง"], needs: (l) => ((fl(l).rune ?? 0) >= 1 || canCast(l) ? undefined : "ต้องร่ายเวทได้หรือรู้อักษรรูน") },
  { id: "ft_gladiator", name: "นักสู้ในสังเวียน", minAge: 16, key: "health", dc: 50, baseSalary: 14000, titles: ["นักสู้หน้าใหม่", "นักสู้สังเวียน", "ขวัญใจฝูงชน", "แชมป์สังเวียน", "ตำนานสังเวียน"], needs: (l) => (fl(l).bodyRank >= 1 ? undefined : "ต้องเป็นนักสู้ขึ้นไป") },
  { id: "ft_cartographer", name: "นักสำรวจทำแผนที่", minAge: 16, key: "smarts", dc: 45, baseSalary: 12000, titles: ["ผู้ช่วยสำรวจ", "นักทำแผนที่", "นักสำรวจ", "นักสำรวจหลวง", "ผู้พิชิตแผนที่โลก"] },
  { id: "ft_wandwright", name: "ช่างทำคทา", minAge: 16, key: "smarts", dc: 50, baseSalary: 15000, titles: ["ลูกมือร้านคทา", "ช่างเหลาคทา", "ช่างทำคทา", "ช่างคทาชั้นครู", "ช่างคทาในตำนาน"], needs: castNeed },
  { id: "ft_dragonkeeper", name: "ผู้ดูแลมังกร", minAge: 18, key: "health", dc: 60, baseSalary: 22000, titles: ["คนตักมูลคอก", "ผู้ดูแลคอก", "ผู้ดูแลมังกร", "ผู้ฝึกมังกร", "เจ้าคอกมังกรหลวง"], needs: (l) => (fl(l).dragonBond >= 8 || Object.values(fl(l).dBonds ?? {}).some((b) => b >= 20) || fl(l).race === "dragon" ? undefined : "มังกรต้องคุ้นกับคุณก่อน") },
  { id: "ft_courtier", name: "ขุนนางราชสำนัก", minAge: 18, key: "looks", dc: 55, baseSalary: 21000, titles: ["มหาดเล็ก", "ขุนนางชั้นผู้น้อย", "ขุนนาง", "เสนาบดี", "อัครเสนาบดี"], needs: (l) => (l.wealth === "elite" || standingOf(l) >= 40 ? undefined : "ต้องเกิดในตระกูลขุนนาง หรือมีชื่อเสียงในแผ่นดิน 40") },
];

// ── ตัวช่วย ──
const lv = (l: Life) => l.job?.level ?? 1;
const by = (stat: StatKey, base = 0.45, perLv = 0.06) => (l: Life) => clamp(base + (l.stats[stat] - 50) / 150 + (lv(l) - 1) * perLv, 0.05, 0.95);
const fight = (base: number, step: number) => (l: Life) => fightOdds(l, base + lv(l) * step);
const perf = (l: Life, n: number) => { if (l.job) l.job.performance = clamp(l.job.performance + n, 0, 100); };
/** ค่าจ้างพิเศษ: ตำแหน่งสูงได้มากขึ้น */
const pay = (l: Life, g: number) => { const v = Math.round(g * (1 + (lv(l) - 1) * 0.35)); addMoney(l, v * GOLD); return v; };
const ok = (text: string): Outcome => ({ text, kind: "good" });
const meh = (text: string): Outcome => ({ text });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const n = (l: Life, k: string) => Number(l.flags[k] ?? 0);
const bump = (l: Life, k: string, d = 1) => { l.flags[k] = n(l, k) + d; };
/** งานอันตราย: พลาดแล้วเจ็บ บางทีถึงตาย */
const hurt = (l: Life, threat: number, text: string, cause: string, risk = 0.4): Outcome => {
  if (chance(l, deathOdds(l, threat) * risk)) { kill(l, cause); return bad("คราวนี้ไม่มีใครช่วยทัน"); }
  addStat(l, "health", -randInt(l, 8, 14));
  return bad(text);
};
const jail = (l: Life, years: number) => { l.flags.jailUntil = l.age + years; fl(l).crimes = (fl(l).crimes ?? 0) + 1; addStanding(l, -6); l.job = undefined; };
const learnMystery = (l: Life) => {
  const m = MYSTERIES.find((x) => !fl(l).mKnown?.includes(x.id) && !mysteryState(l, x.id).solvedBy);
  if (!m) return false;
  fl(l).mKnown = [...(fl(l).mKnown ?? []), m.id];
  return true;
};
const relicClue = (l: Life) => { const r = pick(l, dataOf(l).relics.filter((x) => x.holder === "lost")); if (!r) return undefined; fl(l).clues[r.id] = (fl(l).clues[r.id] ?? 0) + 1; return r; };
const forge = (l: Life, slot: "weapon" | "armor", name: string, q: number) => { const f = fl(l); if ((f[slot]?.quality ?? 0) < q) f[slot] = { name, quality: q, enchant: f[slot]?.enchant }; };

/** ทรัพย์สินที่ให้รายได้ทุกปี (เหรียญทองต่อหน่วย, หน่วยสูงสุด) */
export const ASSETS: Record<string, { name: string; gold: number; max: number }> = {
  ftLand: { name: "ที่ดิน", gold: 8, max: 6 },
  ftShop: { name: "ร้านสาขา", gold: 15, max: 4 },
  ftInn: { name: "ห้องพัก", gold: 10, max: 4 },
  ftShip: { name: "เรือสินค้า", gold: 20, max: 3 },
  ftMine: { name: "สายแร่", gold: 14, max: 3 },
};
export const assetIncome = (l: Life) => Object.entries(ASSETS).reduce((s, [k, a]) => s + Math.min(n(l, k), a.max) * a.gold, 0);
const buy = (k: string): Need => (l) => (n(l, k) >= ASSETS[k].max ? `มี${ASSETS[k].name}ครบ ${ASSETS[k].max} แล้ว` : undefined);

const A = (a: Omit<JobAction, "world" | "emoji">): JobAction => ({ ...a, emoji: "", world: "fantasy" });
const atWar = (l: Life) => !!homeKingdom(l).war;

export const FT_JOB_ACTIONS: JobAction[] = [
  // ชาวนา
  A({ id: "fj_harvest", jobs: ["ft_farmer"], name: "ดูแลไร่ให้เต็มที่", desc: "รายได้พิเศษตามฟ้าฝน", odds: by("health", 0.55), run: (l, s) => { perf(l, s ? 8 : 2); return s ? ok(`ข้าวสาลีออกรวงทองเต็มทุ่ง ขายได้ ${pay(l, 12)} เหรียญทอง`) : meh("ฝนไม่ตกทั้งฤดู คุณได้แค่พอกิน"); } }),
  A({ id: "fj_land", jobs: ["ft_farmer", "ft_courtier"], name: "ซื้อที่ดินเพิ่มหนึ่งแปลง", desc: `ได้ ${ASSETS.ftLand.gold} เหรียญทองทุกปี`, cost: 60, req: buy("ftLand"), run: (l) => { bump(l, "ftLand"); return ok(`คุณปักหลักเขตที่ดินแปลงที่ ${n(l, "ftLand")} ของตระกูล`); } }),
  A({ id: "fj_market", jobs: ["ft_farmer"], name: "ขนผลผลิตไปขายในเมือง", desc: "ต่อราคากับพ่อค้า", odds: by("smarts", 0.5), run: (l, s) => (s ? ok(`พ่อค้าในเมืองให้ราคาดีกว่าที่หมู่บ้านเท่าตัว ได้ ${pay(l, 10)} เหรียญทอง`) : meh("ถนนเป็นโคลน ผักเหี่ยวไปครึ่งเกวียน")) }),
  // ช่างตีเหล็ก
  A({ id: "fj_order", jobs: ["ft_smith"], name: "รับงานตีอาวุธให้กองทัพ", desc: "งานหนักแต่ค่าจ้างดี", odds: by("health", 0.5), run: (l, s) => { perf(l, s ? 8 : 3); return s ? ok(`ดาบสามสิบเล่มเรียงอยู่บนชั้น ได้ ${pay(l, 16)} เหรียญทอง`) : meh("เหล็กล็อตนี้เปราะ คุณต้องหลอมใหม่ทั้งหมด"); } }),
  A({ id: "fj_forge", jobs: ["ft_smith"], name: "ตีอาวุธให้ตัวเอง", desc: "อาวุธดีขึ้นตามฝีมือ · พลังต่อสู้ +", cost: 20, odds: by("health", 0.5), run: (l, s) => { if (!s) return meh("ใบดาบบิดตอนชุบน้ำ คุณได้แต่เศษเหล็ก"); forge(l, "weapon", `${weaponNoun(l)}ฝีมือ${l.lastName}`, Math.min(5, lv(l) + 1)); return ok(`คุณตี${weaponNoun(l)}ชิ้นใหม่จนคมพอผ่าใบไม้กลางอากาศ (คุณภาพ ${fl(l).weapon!.quality})`); } }),
  A({ id: "fj_armor", jobs: ["ft_smith"], name: "ตีเกราะชั้นดี", desc: "เกราะช่วยให้รอดในงานอันตราย", minLevel: 3, cost: 40, odds: by("health", 0.45), run: (l, s) => { if (!s) return meh("แผ่นเกราะไม่เข้ารูป ต้องเริ่มใหม่ปีหน้า"); forge(l, "armor", `เกราะฝีมือ${l.lastName}`, Math.min(5, lv(l))); return ok(`เกราะชุดใหม่พอดีตัวจนลืมว่าใส่อยู่ (คุณภาพ ${fl(l).armor!.quality})`); } }),
  // พ่อค้า
  A({ id: "fj_caravan", jobs: ["ft_merchant"], name: "ส่งกองคาราวานข้ามแดน", desc: "ลงทุนแล้วลุ้นกำไร", cost: 30, odds: by("smarts", 0.5), run: (l, s) => { perf(l, s ? 10 : 0); return s ? ok(`กองคาราวานกลับมาพร้อมผ้าไหมและเครื่องเทศ กำไร ${pay(l, 60)} เหรียญทอง`) : bad("โจรดักปล้นกลางทาง ทุนหายหมด"); } }),
  A({ id: "fj_haggle", jobs: ["ft_merchant"], name: "ต่อรองซื้อของล็อตใหญ่", desc: "ซื้อถูกขายแพง", odds: by("looks", 0.5), run: (l, s) => (s ? ok(`คุณกดราคาจนพ่อค้าอีกฝ่ายหน้าซีด ได้ ${pay(l, 16)} เหรียญทอง`) : meh("คู่ค้าเห็นทางคุณหมด ปีนี้เสมอตัว")) }),
  A({ id: "fj_shop", jobs: ["ft_merchant", "ft_chef", "ft_alchemist"], name: "เปิดร้านสาขาใหม่", desc: `ได้ ${ASSETS.ftShop.gold} เหรียญทองทุกปี`, minLevel: 3, cost: 150, req: buy("ftShop"), run: (l) => { bump(l, "ftShop"); return ok(`ป้ายร้านสาขาที่ ${n(l, "ftShop")} ของคุณแขวนขึ้นกลางตลาด`); } }),
  // นักปราชญ์
  A({ id: "fj_research", jobs: ["ft_scholar"], name: "ค้นคว้าตำราโบราณ", desc: "อาจเจอปริศนาของโลก", odds: by("smarts", 0.5), run: (l, s) => { perf(l, 8); addStat(l, "smarts", 2); if (s && learnMystery(l)) return ok("หน้ากระดาษที่ขาดครึ่งพูดถึงเรื่องที่ไม่มีใครควรรู้ คุณจดไว้ในสมุดปริศนา"); return s ? ok("คุณแปลจารึกได้อีกสามบรรทัด หอสมุดจ่ายค่าตอบแทนให้") : meh("ทั้งปีคุณอ่านแต่ตำราที่มีคนแปลไว้แล้ว"); } }),
  A({ id: "fj_tutor", jobs: ["ft_scholar"], name: "สอนพิเศษลูกขุนนาง", desc: "ค่าสอนสูง", odds: by("looks", 0.5), run: (l, s) => (s ? ok(`ลูกขุนนางสอบผ่าน พ่อเขาจ่าย ${pay(l, 14)} เหรียญทอง`) : meh("ลูกศิษย์หลับในห้องเรียนทั้งปี")) }),
  A({ id: "fj_book", jobs: ["ft_scholar"], name: "เขียนตำราของตัวเอง", desc: "ชื่อเสียงยาวนาน", minLevel: 3, odds: by("smarts", 0.3), run: (l, s) => { if (!s) return meh("คุณเขียนได้สองร้อยหน้าแล้วทิ้งหมด"); addFame(l, 6); if (!l.flags.ftBook) { l.flags.ftBook = true; deed(l, "เขียนตำราที่ทุกหอสมุดต้องมี"); } return ok("ตำราของคุณถูกคัดลอกไปทุกหอสมุดในแผ่นดิน"); } }),
  // ทหาร
  A({ id: "fj_patrol", jobs: ["ft_soldier"], name: "ลาดตระเวนชายแดน", desc: "เสี่ยงแต่ได้ผลงาน", odds: fight(18, 6), run: (l, s) => { if (!s) return hurt(l, 18 + lv(l) * 6, "กองโจรซุ่มโจมตี คุณกลับค่ายพร้อมแผล", "ตายขณะลาดตระเวนชายแดน"); perf(l, 10); fl(l).body += 8; return ok(`คุณไล่กองโจรแตกกระเจิง ได้เบี้ยรางวัล ${pay(l, 8)} เหรียญทอง`); } }),
  A({ id: "fj_drill", jobs: ["ft_soldier", "ft_knight"], name: "ฝึกทหารใหม่", desc: "ผลงานและพลังกาย", odds: by("health", 0.55), run: (l, s) => { perf(l, s ? 7 : 2); fl(l).body += 6; addStanding(l, 1); return s ? ok("ทหารใหม่ยืนแถวตรงได้ภายในสามเดือน") : meh("ทหารใหม่ครึ่งหนึ่งหนีกลับบ้าน"); } }),
  A({ id: "fj_war", jobs: ["ft_soldier", "ft_knight"], name: "อาสาออกศึก", desc: "เฉพาะยามสงคราม · ชื่อเสียงสูง", req: (l) => (atWar(l) ? undefined : "ตอนนี้ไม่มีสงคราม"), odds: fight(30, 8), run: (l, s) => { if (!s) return hurt(l, 30 + lv(l) * 8, "แนวหน้าแตก คุณถูกหามกลับมา", "ตายในสนามรบ"); perf(l, 15); addFame(l, 8); addStanding(l, 5); return ok(`ธงของคุณปักอยู่บนกำแพงข้าศึก ได้บำเหน็จ ${pay(l, 25)} เหรียญทอง`); } }),
  // โรงเตี๊ยม
  A({ id: "fj_feast", jobs: ["ft_inn"], name: "จัดงานเลี้ยงในร้าน", desc: "ลงทุนเล็กน้อย กำไรดี", cost: 10, odds: by("looks", 0.55), run: (l, s) => { addStat(l, "happiness", 3); return s ? ok(`ทั้งเมืองมาเต้นรำในร้านคุณ กำไร ${pay(l, 25)} เหรียญทอง`) : meh("ฝนตกทั้งคืน มีแต่หมาจรมาหลบฝน"); } }),
  A({ id: "fj_room", jobs: ["ft_inn"], name: "ต่อเติมห้องพัก", desc: `ได้ ${ASSETS.ftInn.gold} เหรียญทองทุกปี`, cost: 50, req: buy("ftInn"), run: (l) => { bump(l, "ftInn"); return ok(`ห้องพักใหม่ ${n(l, "ftInn")} ปีกของร้านเต็มตั้งแต่คืนแรก`); } }),
  A({ id: "fj_rumor", jobs: ["ft_inn", "ft_bard"], name: "ฟังข่าวลือจากนักเดินทาง", desc: "อาจได้ยินเรื่องอาวุธตำนาน", odds: by("luck", 0.4), run: (l, s) => { if (s) { const r = relicClue(l); if (r) return ok(`นักเดินทางเมาเล่าถึง${r.name}ว่าเห็นเงาของมันที่${dataOf(l).kingdoms.find((k) => k.id === r.at)?.name ?? "แดนไกล"}`); } addStat(l, "smarts", 1); return meh("ข่าวลือปีนี้มีแต่เรื่องลูกชายขุนนางหนีตามสาวใช้"); } }),
  // นักเวทรับจ้าง
  A({ id: "fj_exorcist", jobs: ["ft_mage"], name: "รับงานปราบภูตให้ขุนนาง", desc: "อันตรายปานกลาง", odds: fight(10, 6), run: (l, s) => { if (!s) return hurt(l, 10 + lv(l) * 6, "ภูตตนนั้นแรงกว่าที่คิด คุณต้องถอยออกมา", "ถูกภูตร้ายสังหาร"); fl(l).magic += 8; perf(l, 9); return ok(`ปราสาทสงบลงในคืนเดียว ขุนนางจ่าย ${pay(l, 20)} เหรียญทอง`); } }),
  A({ id: "fj_lecture", jobs: ["ft_mage", "ft_scholar"], name: "บรรยายที่หอเวท", desc: "ชื่อเสียงและพลังเวท", odds: by("smarts", 0.5), run: (l, s) => { fl(l).magic += 5; if (s) addFame(l, 2); return s ? ok("ห้องบรรยายเต็มจนต้องยืนฟังนอกประตู") : meh("นักเรียนถามคำถามที่คุณตอบไม่ได้"); } }),
  A({ id: "fj_newspell", jobs: ["ft_mage", "ft_wandwright"], name: "วิจัยเวทบทใหม่", desc: "เรียนเวทได้โดยไม่ต้องจ่าย", minLevel: 3, odds: by("smarts", 0.35), run: (l, s) => { const sp = SPELLS.find((x) => !fl(l).spells?.includes(x.id) && x.tier <= Math.max(1, fl(l).magicRank)); if (!s || !sp) return meh("สมการเวทไม่ลงตัว ห้องทดลองไหม้ไปครึ่งห้อง"); learnSpell(l, sp.id); return ok(`คุณถอดรหัส${sp.name}ได้สำเร็จ`); } }),
  // อัศวิน
  A({ id: "fj_joust", jobs: ["ft_knight"], name: "ลงประลองทวนบนหลังม้า", desc: "ชื่อเสียงและเงินรางวัล", odds: fight(22, 7), run: (l, s) => { if (!s) { addStat(l, "health", -6); return meh("ทวนของคู่แข่งกระแทกคุณตกม้า"); } addFame(l, 5); return ok(`ฝูงชนโห่ร้องชื่อคุณ เงินรางวัล ${pay(l, 14)} เหรียญทอง`); } }),
  A({ id: "fj_quest", jobs: ["ft_knight"], name: "ออกภารกิจของผู้ครองแผ่นดิน", desc: "ชื่อเสียงในแผ่นดิน", odds: fight(30, 8), run: (l, s) => { if (!s) return hurt(l, 30 + lv(l) * 8, "ภารกิจล้มเหลว คุณกลับมาพร้อมโล่ที่แตก", "ตายระหว่างภารกิจของผู้ครอง"); addFame(l, 6); addStanding(l, 4); perf(l, 12); return ok(`คุณกลับมาพร้อมหัวของหัวหน้าโจร ได้ ${pay(l, 18)} เหรียญทอง`); } }),
  A({ id: "fj_oath", jobs: ["ft_knight"], name: "ถวายสัตย์ต่อผู้ครอง", desc: "ครั้งเดียวในชีวิต · ชื่อเสียงในแผ่นดิน", minLevel: 3, req: (l) => (l.flags.ftOath ? "ถวายสัตย์ไปแล้ว" : undefined), run: (l) => { l.flags.ftOath = true; addStanding(l, 10); deed(l, `อัศวินผู้ถวายสัตย์ต่อ${homeKingdom(l).ruler}`); return ok(`คุณคุกเข่าต่อหน้า${homeKingdom(l).ruler} ดาบหลวงแตะบ่าทั้งสองข้าง`); } }),
  // นักเล่นแร่แปรธาตุ
  A({ id: "fj_brew", jobs: ["ft_alchemist"], name: "ปรุงยาขาย", desc: "รายได้สม่ำเสมอ", odds: by("smarts", 0.55), run: (l, s) => { perf(l, s ? 8 : 2); return s ? ok(`ยาแก้ไข้ของคุณขายหมดก่อนเที่ยง ได้ ${pay(l, 16)} เหรียญทอง`) : meh("หม้อยาเดือดล้นจนห้องเหม็นไปสามวัน"); } }),
  A({ id: "fj_elixir", jobs: ["ft_alchemist"], name: "ทดลองยาอายุวัฒนะ", desc: "อายุยืนขึ้น · อันตราย", minLevel: 3, req: (l) => (n(l, "ftElixir") >= 4 ? "ร่างกายไม่รับยาอีกแล้ว" : undefined), odds: by("smarts", 0.3), run: (l, s) => { if (!s) { addStat(l, "health", -12); return bad("ควันสีม่วงพุ่งออกจากหม้อ คุณไอเป็นเลือดทั้งเดือน"); } bump(l, "ftElixir"); fl(l).lifeBonus = (fl(l).lifeBonus ?? 0) + 4; return ok("ยาหยดสีทองไหลลงคอ คุณรู้สึกว่าเวลาเดินช้าลง (อายุขัย +4 ปี)"); } }),
  A({ id: "fj_gold", jobs: ["ft_alchemist"], name: "ลองเปลี่ยนตะกั่วเป็นทอง", desc: "โอกาสน้อยมาก รางวัลใหญ่", odds: () => 0.12, run: (l, s) => { if (s) { addMoney(l, 120 * GOLD); return ok("ตะกั่วในเบ้าหลอมกลายเป็นทองคำแท้ คุณล็อกประตูแล้วนั่งหัวเราะคนเดียว"); } addStat(l, "health", -4); return meh("หม้อระเบิด คิ้วคุณหายไปข้างหนึ่ง"); } }),
  // นักบวช
  A({ id: "fj_heal", jobs: ["ft_priest"], name: "รักษาคนป่วยในวิหาร", desc: "ความสุขและชื่อเสียงในแผ่นดิน", odds: by("smarts", 0.55), run: (l, s) => { perf(l, 8); addStat(l, "happiness", 3); if (s) { addStanding(l, 3); addFame(l, 1); } return s ? ok("แม่ที่คุณรักษาลูกให้หาย กราบคุณจนหน้าผากแตะพื้น") : meh("ปีนี้คนป่วยมากกว่ายาที่มี"); } }),
  A({ id: "fj_sermon", jobs: ["ft_priest"], name: "เทศน์ในวันศักดิ์สิทธิ์", desc: "ผลงานและชื่อเสียง", odds: by("looks", 0.5), run: (l, s) => { perf(l, s ? 10 : 3); if (s) addFame(l, 3); return s ? ok("วิหารเงียบจนได้ยินเสียงเทียนไหม้") : meh("คนแถวหลังหลับกันครึ่งโบสถ์"); } }),
  A({ id: "fj_exorcise", jobs: ["ft_priest"], name: "ขับไล่วิญญาณร้าย", desc: "อันตราย · ชื่อเสียงสูง", minLevel: 2, odds: fight(14, 6), run: (l, s) => { if (!s) return hurt(l, 14 + lv(l) * 6, "วิญญาณนั้นหัวเราะใส่คำสวดของคุณ", "ถูกวิญญาณร้ายพรากชีวิต"); fl(l).magic += 6; addFame(l, 5); return ok("เสียงกรีดร้องจางหายไปพร้อมรุ่งอรุณ หมู่บ้านทั้งหมู่บ้านออกมาขอบคุณ"); } }),
  // กวี
  A({ id: "fj_song", jobs: ["ft_bard"], name: "แต่งเพลงใหม่", desc: "ชื่อเสียงและค่าตอบแทน", odds: by("smarts", 0.5), run: (l, s) => { if (!s) return meh("ท่อนฮุกไม่ติดหูใครเลย แม้แต่คุณเอง"); addFame(l, 3); return ok(`เพลงของคุณถูกร้องในทุกโรงเตี๊ยม ได้ ${pay(l, 8)} เหรียญทอง`); } }),
  A({ id: "fj_tour", jobs: ["ft_bard"], name: "ตระเวนแสดงทั่วแผ่นดิน", desc: "อาจได้เพื่อนใหม่", odds: by("looks", 0.5), run: (l, s) => { if (!s) return meh("ฝนตกทุกเมืองที่คุณไป คนดูมีแต่เด็กกับหมา"); addFame(l, 4); const p = chance(l, 0.4) ? createPerson(l, "friend", { age: Math.max(16, l.age + randInt(l, -8, 8)), bond: 50 }) : undefined; return ok(`คุณร้องเพลงในเจ็ดเมือง ได้ ${pay(l, 20)} เหรียญทอง${p ? ` และได้${shortName(p)}มาเป็นเพื่อนร่วมทาง` : ""}`); } }),
  A({ id: "fj_court_song", jobs: ["ft_bard"], name: "ขับร้องต่อหน้าผู้ครอง", desc: "ชื่อเสียงสูงมาก", minLevel: 3, odds: by("looks", 0.4), run: (l, s) => { if (!s) { addStanding(l, -3); return bad("ผู้ครองหาวกลางเพลง ราชสำนักทั้งห้องหาวตาม"); } addFame(l, 8); addStanding(l, 4); return ok(`${homeKingdom(l).ruler}ถอดแหวนพระหัตถ์มอบให้คุณ ได้ ${pay(l, 30)} เหรียญทอง`); } }),
  // พราน
  A({ id: "fj_hunt", jobs: ["ft_ranger"], name: "ล่าสัตว์ขายหนัง", desc: "รายได้และพลังกาย", odds: by("health", 0.55), run: (l, s) => { fl(l).body += 5; return s ? ok(`หนังหมาป่าขาวขายได้ ${pay(l, 12)} เหรียญทอง`) : meh("ทั้งฤดูคุณเจอแต่รอยเท้า"); } }),
  A({ id: "fj_guide", jobs: ["ft_ranger", "ft_cartographer"], name: "นำทางคณะเดินทางข้ามป่า", desc: "ค่าจ้างดี", odds: by("smarts", 0.55), run: (l, s) => (s ? ok(`ทุกคนถึงปลายทางครบ ได้ ${pay(l, 15)} เหรียญทอง`) : meh("คณะเดินทางหลงไปสามวันจนคุณเจอทางเดิม")) }),
  A({ id: "fj_maneater", jobs: ["ft_ranger"], name: "ตามล่าสัตว์อสูรที่กินคน", desc: "อันตราย · ชื่อเสียงสูง", minLevel: 3, odds: fight(35, 6), run: (l, s) => { if (!s) return hurt(l, 35 + lv(l) * 6, "มันกลับมาล่าคุณแทน", "ถูกสัตว์อสูรกินในป่าลึก"); addFame(l, 6); addStanding(l, 3); return ok(`หมู่บ้านแขวนหัวมันไว้หน้าประตูเมือง พร้อมรางวัล ${pay(l, 25)} เหรียญทอง`); } }),
  // กะลาสี
  A({ id: "fj_voyage", jobs: ["ft_sailor"], name: "ออกเรือค้าขายไกล", desc: "ลุ้นพายุ", odds: by("luck", 0.5), run: (l, s) => { if (!s) { addStat(l, "health", -8); return bad("พายุฉีกใบเรือ คุณกลับมามือเปล่าและเปียกโชก"); } perf(l, 10); return ok(`เรือกลับมาพร้อมเครื่องเทศเต็มลำ ได้ ${pay(l, 25)} เหรียญทอง`); } }),
  A({ id: "fj_pirates", jobs: ["ft_sailor"], name: "ไล่ล่าโจรสลัด", desc: "อันตราย · รางวัลสูง", minLevel: 2, odds: fight(25, 7), run: (l, s) => { if (!s) return hurt(l, 25 + lv(l) * 7, "โจรสลัดกระโดดข้ามกราบเรือมามากเกินไป", "ตายในศึกกับโจรสลัด"); addFame(l, 4); return ok(`คุณยึดธงโจรสลัดมาแขวนในท่าเรือ ได้ ${pay(l, 30)} เหรียญทอง`); } }),
  A({ id: "fj_ship", jobs: ["ft_sailor", "ft_merchant"], name: "ซื้อเรือสินค้าของตัวเอง", desc: `ได้ ${ASSETS.ftShip.gold} เหรียญทองทุกปี`, minLevel: 3, cost: 220, req: buy("ftShip"), run: (l) => { bump(l, "ftShip"); return ok(`เรือลำที่ ${n(l, "ftShip")} ของคุณชักธงนามสกุล${l.lastName}ออกจากท่า`); } }),
  A({ id: "fj_island", jobs: ["ft_sailor", "ft_cartographer"], name: "สำรวจเกาะที่ไม่มีบนแผนที่", desc: "อาจเจอสมบัติ", odds: by("luck", 0.35), run: (l, s) => { if (!s) return meh("เกาะนั้นมีแต่นกนางนวลกับหินร้อน"); addMoney(l, 60 * GOLD); return ok("ใต้ต้นมะพร้าวต้นเดียวบนเกาะ มีหีบสมบัติของโจรสลัดที่ไม่มีใครกลับมาเอา"); } }),
  // คนงานเหมือง
  A({ id: "fj_dig", jobs: ["ft_miner"], name: "ขุดสายแร่ใหม่", desc: "คนแคระทำได้ดีกว่า", odds: (l) => clamp(by("health", 0.5)(l) + (fl(l).race === "dwarf" ? 0.15 : 0), 0.05, 0.95), run: (l, s) => { perf(l, s ? 8 : 2); fl(l).body += 4; return s ? ok(`สายแร่เงินทอดยาวเข้าไปในภูเขา ได้ ${pay(l, 12)} เหรียญทอง`) : meh("ทั้งปีคุณขุดเจอแต่หินธรรมดา"); } }),
  A({ id: "fj_gem", jobs: ["ft_miner"], name: "ตามหาอัญมณีในอุโมงค์ลึก", desc: "โอกาสน้อย รางวัลใหญ่", odds: by("luck", 0.3), run: (l, s) => { if (!s) return meh("ตะเกียงดับกลางอุโมงค์ คุณคลำทางกลับมาได้ก็บุญแล้ว"); addMoney(l, 70 * GOLD); return ok("ทับทิมเท่ากำปั้นเรืองแสงอยู่ในผนังหิน"); } }),
  A({ id: "fj_vein", jobs: ["ft_miner"], name: "ซื้อสิทธิ์สายแร่", desc: `ได้ ${ASSETS.ftMine.gold} เหรียญทองทุกปี`, minLevel: 3, cost: 120, req: buy("ftMine"), run: (l) => { bump(l, "ftMine"); return ok(`สายแร่สายที่ ${n(l, "ftMine")} จดทะเบียนในชื่อของคุณ`); } }),
  A({ id: "fj_deep", jobs: ["ft_miner"], name: "ลงไปชั้นที่ไม่มีใครกลับมา", desc: "อันตรายมาก · อาจเจอความลับ", minLevel: 3, odds: fight(40, 4), run: (l, s) => { if (!s) return hurt(l, 44, "บางอย่างในความมืดหายใจใส่ต้นคอคุณ คุณวิ่งโดยไม่หันกลับไป", "หายไปในเหมืองชั้นลึก"); addMoney(l, 90 * GOLD); const f = fl(l); f.rune = Math.max(1, f.rune ?? 0); return ok("ชั้นล่างสุดคือห้องโถงของคนแคระโบราณ ผนังเต็มไปด้วยอักษรรูนที่คุณอ่านออกเอง"); } }),
  // โจร
  A({ id: "fj_pick", jobs: ["ft_thief"], name: "ล้วงกระเป๋าในตลาด", desc: "พลาดอาจติดคุก", odds: by("luck", 0.6), run: (l, s) => { if (s) { perf(l, 8); return ok(`ถุงเงินของขุนนางอ้วนเบาลงไป ${pay(l, 10)} เหรียญทอง`); } if (chance(l, n(l, "ftBribed") > l.age ? 0.15 : 0.45)) { jail(l, 1); return bad("มือคุณถูกจับคาถุงเงิน ยามลากคุณไปขังหนึ่งปี"); } return meh("เกือบโดนจับ คุณวิ่งหนีข้ามหลังคาไปสามหลัง"); } }),
  A({ id: "fj_heist", jobs: ["ft_thief"], name: "ปล้นคลังของขุนนาง", desc: "รางวัลใหญ่ พลาดติดคุกนาน", minLevel: 2, odds: by("luck", 0.35), run: (l, s) => { if (s) { addMoney(l, 120 * GOLD); perf(l, 15); return ok("คุณออกจากคลังพร้อมทองคำหนักจนต้องคลานกลับบ้าน"); } jail(l, 3); return bad("กับดักเวทในคลังทำงาน คุณตื่นมาในคุกใต้ดิน"); } }),
  A({ id: "fj_bribe", jobs: ["ft_thief"], name: "ซื้อตัวยามในเมือง", desc: "โอกาสถูกจับลดลงห้าปี", cost: 30, run: (l) => { l.flags.ftBribed = l.age + 5; return ok("หัวหน้ายามรับถุงเงินโดยไม่มองหน้าคุณ"); } }),
  // พ่อครัว
  A({ id: "fj_menu", jobs: ["ft_chef"], name: "คิดเมนูใหม่", desc: "ผลงานและรายได้", odds: by("smarts", 0.55), run: (l, s) => { perf(l, s ? 8 : 2); return s ? ok(`สตูว์เห็ดเวทของคุณมีคิวยาวถึงหัวถนน ได้ ${pay(l, 10)} เหรียญทอง`) : meh("ลูกค้าคนแรกสำลักแล้วขอน้ำเปล่า"); } }),
  A({ id: "fj_banquet", jobs: ["ft_chef", "ft_courtier"], name: "เตรียมงานเลี้ยงขุนนาง", desc: "ค่าจ้างสูง", odds: by("smarts", 0.45), run: (l, s) => { if (!s) return meh("ห่านย่างไหม้ทั้งสิบตัว ขุนนางยิ้มแห้งทั้งงาน"); addFame(l, 2); return ok(`ขุนนางทั้งโต๊ะขอสูตรของคุณ ได้ ${pay(l, 25)} เหรียญทอง`); } }),
  A({ id: "fj_cookoff", jobs: ["ft_chef"], name: "ลงประกวดอาหารประจำแผ่นดิน", desc: "ชื่อเสียง", minLevel: 2, odds: by("smarts", 0.35), run: (l, s) => { if (!s) return meh("กรรมการชมว่าน้ำซุปของคุณ 'น่าสนใจ'"); addFame(l, 6); return ok(`ถ้วยทองของการประกวดตั้งอยู่หน้าเตาของคุณ พร้อมรางวัล ${pay(l, 20)} เหรียญทอง`); } }),
  // ทูต
  A({ id: "fj_treaty", jobs: ["ft_diplomat"], name: "เจรจาสนธิสัญญาการค้า", desc: "เศรษฐกิจแผ่นดินดีขึ้น", odds: by("looks", 0.5), run: (l, s) => { if (!s) return meh("ทูตอีกฝ่ายขอเวลาคิดอีกสามปี"); const k = homeKingdom(l); k.prosperity = Math.min(150, (k.prosperity ?? 100) + 4); addStanding(l, 5); perf(l, 12); return ok(`สนธิสัญญาลงนามแล้ว ตลาดของ${k.name}คึกคักขึ้น ได้ ${pay(l, 18)} เหรียญทอง`); } }),
  A({ id: "fj_peace", jobs: ["ft_diplomat"], name: "เจรจาสงบศึก", desc: "เฉพาะยามสงคราม · หยุดสงครามได้", req: (l) => (atWar(l) ? undefined : "ตอนนี้ไม่มีสงคราม"), odds: by("looks", 0.25), run: (l, s) => { if (!s) { addStanding(l, -3); return bad("ข้อเสนอของคุณถูกฉีกต่อหน้า และทั้งสองฝ่ายเกลียดคุณ"); } const k = homeKingdom(l), foe = dataOf(l).kingdoms.find((x) => x.id === k.war); if (foe?.war === k.id) foe.war = undefined; k.war = undefined; addFame(l, 10); deed(l, `เจรจาสงบศึกระหว่าง${k.name}กับ${foe?.name ?? "ศัตรู"}`); return ok("ทั้งสองฝ่ายวางอาวุธในวันที่คุณเปิดประตูห้องเจรจา"); } }),
  A({ id: "fj_spy", jobs: ["ft_diplomat", "ft_courtier"], name: "ขายความลับให้ฝ่ายอื่น", desc: "เงินดี พลาดจบอาชีพ", odds: by("smarts", 0.5), run: (l, s) => { if (s) { addMoney(l, 45 * GOLD); return ok("จดหมายลับเปลี่ยนมือในโบสถ์ร้าง ถุงเงินหนักกว่าที่ตกลง"); } jail(l, 2); return bad("จดหมายของคุณถูกเปิดกลางสภา คุณถูกปลดและจำคุก"); } }),
  // นักฝึกสัตว์
  A({ id: "fj_warhorse", jobs: ["ft_tamer"], name: "ฝึกม้าศึกให้กองทัพ", desc: "รายได้สม่ำเสมอ", odds: by("health", 0.55), run: (l, s) => { perf(l, s ? 8 : 2); return s ? ok(`ม้าศึกยี่สิบตัวไม่สะดุ้งแม้แต่เสียงฟ้าผ่า ได้ ${pay(l, 13)} เหรียญทอง`) : meh("ม้าตัวหนึ่งเตะคุณจนลอย"); } }),
  A({ id: "fj_griffin", jobs: ["ft_tamer"], name: "ฝึกกริฟฟินป่า", desc: "มังกรเห็นแล้วคุ้นกับคุณ", minLevel: 2, odds: by("health", 0.35), run: (l, s) => { if (!s) { addStat(l, "health", -7); return meh("กริฟฟินจิกหัวคุณแล้วบินหนีไป"); } addFame(l, 4); fl(l).dragonBond += 3; return ok("กริฟฟินยอมให้คุณขึ้นหลังเป็นครั้งแรก ฟ้าทั้งฟ้าเป็นของคุณสามนาที"); } }),
  A({ id: "fj_beastshow", jobs: ["ft_tamer"], name: "พาสัตว์เวทแสดงในงานเทศกาล", desc: "ความสุขและรายได้", odds: by("looks", 0.5), run: (l, s) => { addStat(l, "happiness", 3); return s ? ok(`เด็กๆ กรี๊ดเมื่อจิ้งจอกไฟกระโดดลอดห่วง ได้ ${pay(l, 15)} เหรียญทอง`) : meh("จิ้งจอกไฟเผาเต็นท์ข้างๆ"); } }),
  // ช่างลงอาคม
  A({ id: "fj_engrave", jobs: ["ft_enchanter"], name: "สลักรูนบนเกราะลูกค้า", desc: "รายได้และพลังเวท", odds: by("smarts", 0.55), run: (l, s) => { fl(l).magic += 4; perf(l, s ? 8 : 2); return s ? ok(`อักษรรูนเรืองแสงทุกครั้งที่ลูกค้าเดินผ่านความมืด ได้ ${pay(l, 18)} เหรียญทอง`) : meh("รูนตัวหนึ่งกลับหัว เกราะจึงดึงดูดฟ้าผ่าแทน"); } }),
  A({ id: "fj_enchant", jobs: ["ft_enchanter"], name: "ลงอาคมอาวุธของตัวเอง", desc: "อาวุธแรงขึ้นถาวร", cost: 30, req: (l) => (!fl(l).weapon ? "ต้องมีอาวุธของตัวเองก่อน" : fl(l).weapon!.enchant ? "อาวุธลงอาคมแล้ว" : undefined), run: (l) => { fl(l).weapon!.enchant = true; return ok(`${fl(l).weapon!.name}เรืองแสงจางๆ ทุกครั้งที่คุณจับด้าม`); } }),
  A({ id: "fj_ward", jobs: ["ft_enchanter"], name: "สร้างวงป้องกันเมือง", desc: "ชื่อเสียงในแผ่นดิน", minLevel: 3, odds: by("smarts", 0.4), run: (l, s) => { if (!s) return meh("วงเวทติดไฟตอนเที่ยงคืน ทั้งเมืองตื่นมาดู"); addStanding(l, 6); addFame(l, 5); return ok("วงแสงครอบเมืองไว้ทั้งคืน ไม่มีสัตว์อสูรตัวไหนข้ามมาได้"); } }),
  // นักสู้สังเวียน
  A({ id: "fj_bout", jobs: ["ft_gladiator"], name: "ลงสังเวียน", desc: "เงินรางวัลและชื่อเสียง", odds: fight(12, 7), run: (l, s) => { if (!s) return hurt(l, 12 + lv(l) * 7, "คุณถูกหามออกจากสังเวียนท่ามกลางเสียงโห่", "ตายกลางสังเวียน", 0.25); fl(l).body += 6; addFame(l, 4); perf(l, 10); return ok(`ฝูงชนตะโกนชื่อคุณจนสังเวียนสั่น ได้ ${pay(l, 18)} เหรียญทอง`); } }),
  A({ id: "fj_beastbout", jobs: ["ft_gladiator"], name: "สู้กับสัตว์อสูรต่อหน้าฝูงชน", desc: "อันตรายมาก · รางวัลใหญ่", minLevel: 2, odds: fight(28, 7), run: (l, s) => { if (!s) return hurt(l, 28 + lv(l) * 7, "เขี้ยวของมันฝากแผลยาวไว้ที่หลังคุณ", "ถูกสัตว์อสูรสังหารกลางสังเวียน", 0.3); addFame(l, 7); return ok(`คุณยืนเหยียบซากแมนทิคอร์ ฝูงชนโยนดอกไม้ลงสนาม ได้ ${pay(l, 35)} เหรียญทอง`); } }),
  A({ id: "fj_pupil", jobs: ["ft_gladiator", "ft_knight"], name: "รับลูกศิษย์", desc: "ได้ศิษย์ที่ติดตามคุณ", minLevel: 4, req: (l) => (l.people.some((p) => p.alive && p.tags?.includes("ft_pupil")) ? "มีศิษย์อยู่แล้ว" : undefined), run: (l) => { const p = createPerson(l, "ally", { age: randInt(l, 15, 19), bond: 60 }); p.job = "ลูกศิษย์"; p.tags = [...(p.tags ?? []), "ft_pupil"]; return ok(`${shortName(p)}คุกเข่าขอให้คุณสอนทุกอย่างที่รู้`); } }),
  // นักสำรวจ
  A({ id: "fj_map", jobs: ["ft_cartographer"], name: "ทำแผนที่หุบเขาที่ยังไม่มีใครวาด", desc: "รายได้และสติปัญญา", odds: by("smarts", 0.55), run: (l, s) => { addStat(l, "smarts", 1); perf(l, s ? 8 : 2); return s ? ok(`แผนที่ของคุณแม่นจนกองทัพขอซื้อ ได้ ${pay(l, 14)} เหรียญทอง`) : meh("หมอกปกคลุมหุบเขาทั้งฤดู คุณวาดได้แค่ขอบภูเขา"); } }),
  A({ id: "fj_ruin", jobs: ["ft_cartographer"], name: "สำรวจซากเมืองโบราณ", desc: "สมบัติหรือปริศนา", odds: by("luck", 0.4), run: (l, s) => { if (!s) { addStat(l, "health", -8); return bad("พื้นหินถล่มลงไปในห้องใต้ดิน คุณปีนออกมาด้วยแขนข้างเดียว"); } if (learnMystery(l)) return ok("ภาพสลักบนเสาเล่าเรื่องที่ไม่มีในตำราเล่มไหน คุณจดไว้ในสมุดปริศนา"); addMoney(l, 45 * GOLD); return ok("ห้องเก็บของใต้วิหารร้างยังมีถ้วยทองวางเรียงอยู่"); } }),
  A({ id: "fj_atlas", jobs: ["ft_cartographer"], name: "ขายแผนที่ให้ราชสำนัก", desc: "รายได้ก้อนใหญ่", minLevel: 3, odds: by("looks", 0.5), run: (l, s) => { if (!s) return meh("ราชสำนักบอกว่ามีแผนที่ที่ดีกว่าแล้ว"); addStanding(l, 3); return ok(`แผนที่ของคุณแขวนอยู่ในห้องวางแผนศึก ได้ ${pay(l, 40)} เหรียญทอง`); } }),
  // ช่างทำคทา
  A({ id: "fj_wand_sell", jobs: ["ft_wandwright"], name: "ทำคทาขาย", desc: "รายได้สม่ำเสมอ", odds: by("smarts", 0.55), run: (l, s) => { perf(l, s ? 8 : 2); return s ? ok(`เด็กคนหนึ่งยิ้มจนแก้มปริเมื่อคทาของคุณเลือกเขา ได้ ${pay(l, 16)} เหรียญทอง`) : meh("คทาล็อตนี้ไม่ยอมเลือกใครเลย"); } }),
  A({ id: "fj_wand_self", jobs: ["ft_wandwright"], name: "ทำคทาสำหรับตัวเอง", desc: "คทาดีกว่าที่ร้านขาย", cost: 40, req: (l) => ((fl(l).wand?.quality ?? 0) >= Math.min(5, lv(l) + 1) ? "คทาของคุณดีเท่าฝีมือตอนนี้แล้ว" : undefined), odds: by("smarts", 0.5), run: (l, s) => { if (!s) return meh("แกนคทาแตกตอนใส่ขนนกฟีนิกซ์"); const q = Math.min(5, lv(l) + 1); fl(l).wand = { name: `คทาฝีมือ${l.lastName}`, quality: q, material: "ไม้เลือกสรร" }; return ok(`คทาเล่มใหม่สั่นในมือคุณเหมือนมีชีวิต (คุณภาพ ${q})`); } }),
  // ผู้ดูแลมังกร
  A({ id: "fj_feed", jobs: ["ft_dragonkeeper"], name: "ดูแลมังกรในคอกหลวง", desc: "มังกรคุ้นกับคุณมากขึ้น", run: (l) => { fl(l).dragonBond += 3; perf(l, 8); return ok(`มังกรในคอกเลียแก้มคุณด้วยลิ้นที่ร้อนเหมือนเตาผิง ได้ ${pay(l, 8)} เหรียญทอง`); } }),
  A({ id: "fj_flight", jobs: ["ft_dragonkeeper"], name: "พามังกรหลวงออกบิน", desc: "ชื่อเสียงและพลังกาย", minLevel: 3, odds: by("health", 0.4), run: (l, s) => { if (!s) { addStat(l, "health", -10); return bad("มังกรสะบัดคุณหลุดจากอานกลางอากาศ โชคดีที่ตกลงทะเลสาบ"); } addFame(l, 5); fl(l).body += 8; return ok("คุณบินวนเหนือเมืองหลวงสามรอบ ทั้งเมืองแหงนหน้ามอง"); } }),
  A({ id: "fj_royal_egg", jobs: ["ft_dragonkeeper"], name: "ขอดูแลไข่มังกรที่ราชสำนักฝากไว้", desc: "อาจได้ไข่มาเลี้ยงเอง", minLevel: 4, req: (l) => (fl(l).egg || fl(l).whelp ? "คุณดูแลไข่หรือลูกมังกรอยู่แล้ว" : undefined), odds: by("luck", 0.25), run: (l, s) => { if (!s) return meh("ราชสำนักเลือกคนอื่นไปดูแลไข่ใบนั้น"); fl(l).egg = { element: fl(l).element ?? "fire", warmth: 0, from: "คอกหลวง", lastCare: l.age }; return ok("ราชสำนักมอบไข่มังกรให้คุณดูแล มันอุ่นเหมือนหัวใจที่ยังเต้น"); } }),
  // ขุนนาง
  A({ id: "fj_intrigue", jobs: ["ft_courtier"], name: "เล่นการเมืองในราชสำนัก", desc: "ชื่อเสียงในแผ่นดินขึ้นหรือลง", odds: by("looks", 0.5), run: (l, s) => { if (!s) { addStanding(l, -4); return bad("พันธมิตรของคุณหักหลังกลางสภา"); } addStanding(l, 5); perf(l, 10); return ok("คุณกระซิบสามประโยคในสวนหลวง เสนาบดีคนหนึ่งตกจากตำแหน่ง"); } }),
  A({ id: "fj_favor", jobs: ["ft_courtier"], name: "ทูลขอที่ดินจากผู้ครอง", desc: "ได้ที่ดินสองแปลง", minLevel: 3, req: buy("ftLand"), odds: by("looks", 0.35), run: (l, s) => { if (!s) return meh("ผู้ครองยิ้มแล้วเปลี่ยนเรื่อง"); bump(l, "ftLand", 2); return ok(`${homeKingdom(l).ruler}พระราชทานที่ดินริมแม่น้ำสองแปลงให้ตระกูล${l.lastName}`); } }),
];

// ── เรื่องราวของแต่ละอาชีพ: สองทางเลือก ทางแรกลุ้นตามค่าสถานะได้ ──
type Opt = [label: string, text: string, fx?: Fx];
type Row = [job: string, id: string, title: string, text: string, a: Opt, b: Opt, check?: [StatKey, number, string, Fx?]];
const ROWS: Row[] = [
  ["ft_farmer", "crows", "ฝูงกาดำ", "ฝูงกาดำนับพันลงกินไร่ของคุณในเช้าเดียว หุ่นไล่กาไม่ได้ผลแล้ว", ["ขอให้แม่มดท้ายหมู่บ้านช่วย", "นางร้องเพลงเพลงเดียว ฝูงกาบินหนีไปไร่ของเจ้าที่ดินแทน", { gold: 6 }], ["ปล่อยไปตามบุญ", "คุณเก็บเกี่ยวได้ครึ่งเดียว", { gold: -4 }], ["luck", 45, "แม่มดขอค่าตอบแทนเป็นไก่สามตัว", { gold: -2 }]],
  ["ft_farmer", "pumpkin", "ฟักทองยักษ์", "ฟักทองในไร่คุณใหญ่จนเด็กๆ ปีนขึ้นไปนั่งได้", ["ส่งเข้าประกวดงานเทศกาล", "ฟักทองของคุณชนะ และกลายเป็นรถม้าในละครเวทีของเมือง", { fame: 3, gold: 8 }], ["ทำซุปแจกทั้งหมู่บ้าน", "ทั้งหมู่บ้านกินซุปฟักทองไปสามวัน", { joy: 5 }]],
  ["ft_smith", "blade_vision", "ฝันถึงดาบ", "คืนหนึ่งคุณฝันถึงดาบที่ไม่มีใครเคยตี ตื่นมาจำรายละเอียดได้ทุกเส้น", ["ตีมันขึ้นมาจริงๆ", "ดาบเล่มนั้นร้องเสียงแหลมเมื่อคุณเหวี่ยง อัศวินคนหนึ่งขอซื้อด้วยราคาเท่าบ้าน", { gold: 60, fame: 3 }], ["วาดเก็บไว้ในสมุด", "สมุดเล่มนั้นอาจมีค่าสักวัน", { iq: 2 }], ["health", 55, "เหล็กไม่ยอมเป็นรูปตามฝัน คุณเสียถ่านไปทั้งเดือน", { gold: -5 }]],
  ["ft_smith", "dwarf_rival", "ช่างจากภูเขา", "ช่างคนแคระเปิดเตาฝั่งตรงข้าม และติดป้ายว่า \"เหล็กดีกว่าครึ่งราคา\"", ["ท้าแข่งตีดาบต่อหน้าเมือง", "ดาบของคุณผ่าดาบของเขาขาดครึ่ง เขาหัวเราะลั่นแล้วขอเป็นเพื่อน", { fame: 4 }], ["ลดราคาตาม", "ปีนี้ทั้งสองร้านจนเท่ากัน", { gold: -6 }], ["health", 55, "ดาบเขาคมกว่า คุณยอมรับแล้วขอเรียนเคล็ด", { body: 4 }]],
  ["ft_merchant", "cursed_cargo", "สินค้าต้องสาป", "หีบสินค้าที่ซื้อมาจากท่าเรือส่งเสียงเคาะจากข้างในทุกคืน", ["เปิดดู", "ข้างในคือภูตตะเกียงที่ติดอยู่มาร้อยปี มันให้พรเรื่องค้าขายเป็นการตอบแทน", { luck: 4, gold: 15 }], ["ขายต่อให้คนอื่นเร็วที่สุด", "คุณได้กำไรนิดหน่อยและนอนหลับสบายขึ้น", { gold: 5 }], ["luck", 50, "สิ่งที่อยู่ข้างในกัดนิ้วคุณแล้วหนีไป", { hp: -5 }]],
  ["ft_merchant", "guild_tax", "สมาคมทองคำ", "สมาคมทองคำส่งคนมาบอกว่าร้านของคุณต้องจ่ายค่าคุ้มครองปีละสิบเหรียญ", ["เจรจาเข้าเป็นสมาชิกแทน", "สมาคมรับคุณเข้ากลุ่ม ค่าคุ้มครองกลายเป็นส่วนลดสินค้า", { gold: 10, fame: 2 }], ["จ่ายไปตามนั้น", "ร้านคุณปลอดภัย แต่กระเป๋าเบา", { gold: -10 }], ["looks", 55, "พวกเขาหัวเราะแล้วขึ้นค่าคุ้มครองเป็นสองเท่า", { gold: -15 }]],
  ["ft_scholar", "forbidden_page", "หน้าต้องห้าม", "หน้ากระดาษที่ถูกฉีกออกจากตำราเวทเก่าโผล่มาในกองหนังสือบริจาค", ["อ่านออกเสียง", "ห้องทั้งห้องเย็นเฉียบ แล้วคุณเข้าใจเวทมนตร์ลึกขึ้นอีกขั้น", { magic: 12, iq: 2 }], ["ส่งให้สภาเจ็ดหอ", "สภาส่งจดหมายขอบคุณและเงินรางวัล", { gold: 15 }], ["smarts", 60, "ตัวอักษรขยับหนีสายตาคุณ คุณปวดหัวไปทั้งสัปดาห์", { hp: -4 }]],
  ["ft_scholar", "debate", "ศึกวาทะ", "ปราชญ์จากนครรัฐทาลอสท้าคุณโต้วาทีต่อหน้าสภา หัวข้อคือ \"มังกรมีวิญญาณหรือไม่\"", ["รับคำท้า", "คุณชนะด้วยประโยคเดียวที่ทั้งสภาจดไว้", { fame: 5, iq: 2 }], ["ปฏิเสธอย่างสุภาพ", "เขาบอกทุกคนว่าคุณกลัว", { fame: -2 }], ["smarts", 60, "คุณพูดติดอ่างกลางสภา เขายิ้มอย่างผู้ชนะ", { joy: -4 }]],
  ["ft_soldier", "deserter", "ทหารหนีทัพ", "เพื่อนร่วมหน่วยของคุณถูกจับได้ว่าจะหนีทัพ เขาขอให้คุณช่วยปิดเรื่อง", ["ช่วยเขาหนีไปคืนนี้", "เขาหายไปในความมืด คุณได้จดหมายขอบคุณในอีกสิบปีต่อมา", { joy: 3 }], ["รายงานผู้บังคับบัญชา", "คุณได้เลื่อนขั้น แต่ไม่มีใครในหน่วยคุยกับคุณอีก", { fame: 2, joy: -4 }]],
  ["ft_soldier", "siege_song", "เพลงก่อนรุ่งสาง", "คืนก่อนศึก ทหารทั้งค่ายนั่งเงียบ ไม่มีใครหลับ", ["ร้องเพลงบ้านเกิดให้ทุกคนฟัง", "ทั้งค่ายร้องตาม รุ่งเช้าทุกคนออกรบด้วยหัวใจเดียวกัน", { joy: 5, fame: 2 }], ["ลับดาบเงียบๆ", "เสียงหินลับมีดคือเพลงเดียวที่คุณรู้จัก", { body: 3 }]],
  ["ft_inn", "dragon_guest", "แขกตัวใหญ่", "ชายร่างสูงสวมผ้าคลุมขอพักห้องที่ใหญ่ที่สุด เขาจ่ายเป็นเกล็ดสีทองแทนเหรียญ", ["รับเกล็ดไว้", "เกล็ดนั้นขายได้ราคาเท่าร้านทั้งร้าน และตอนเช้าห้องพักมีรอยไหม้รูปปีก", { gold: 50 }], ["ขอเป็นเหรียญทองเหมือนแขกอื่น", "เขาหัวเราะเสียงดังจนแก้วสั่น แล้วจ่ายทองคำแท่งแทน", { gold: 20 }]],
  ["ft_inn", "brawl", "ศึกในโรงเตี๊ยม", "นักผจญภัยสองกลุ่มเริ่มขว้างเก้าอี้ใส่กันกลางร้าน", ["กระโดดขึ้นโต๊ะหยุดศึก", "ทั้งสองกลุ่มหยุด หัวเราะ แล้วเลี้ยงเหล้ากันเองทั้งคืน", { gold: 8, fame: 2 }], ["หลบหลังเคาน์เตอร์", "ร้านพังไปครึ่งร้าน", { gold: -12 }], ["looks", 50, "เก้าอี้ตัวหนึ่งลอยมาโดนหัวคุณ", { hp: -5 }]],
  ["ft_mage", "familiar", "สัตว์รับใช้", "นกฮูกสีเงินเกาะหน้าต่างห้องทดลองคุณทุกคืนมาหนึ่งเดือนแล้ว", ["ทำพิธีผูกพันธะ", "นกฮูกกระพริบตาช้าๆ ตอนนี้คุณเห็นทุกอย่างที่มันเห็น", { magic: 10, flag: "ftFamiliar" }], ["ไล่มันไป", "มันบินไปเกาะหน้าต่างของคนอื่น"]],
  ["ft_mage", "rogue_spell", "เวทหลุดมือ", "นักเรียนของคุณร่ายเวทผิดจนเปลวไฟเริ่มกินหอคอยของสมาคม", ["ร่ายเวทน้ำสวนทันที", "หอคอยรอด นักเรียนของคุณรอด และสมาคมจ่ายค่าตอบแทนให้", { fame: 4, magic: 6 }], ["อพยพทุกคนออกมา", "ไม่มีใครเจ็บ แต่หอคอยเหลือแต่โครง", { joy: -2 }], ["smarts", 55, "เวทของคุณทำให้ไฟลุกหนักขึ้น", { hp: -8 }]],
  ["ft_knight", "dragon_challenge", "คำท้าของมังกร", "มังกรหนุ่มส่งเสียงคำรามท้าอัศวินทุกคนในแผ่นดิน", ["ขี่ม้าออกไปรับคำท้า", "คุณกับมังกรสู้กันถึงเที่ยง แล้วมันก้มหัวให้แล้วบินจากไป", { fame: 8, body: 8 }], ["เขียนจดหมายเจรจา", "มังกรตอบจดหมายเป็นลายมือที่สวยกว่าของคุณ", { iq: 2 }], ["health", 60, "ไฟของมันละลายโล่คุณในพริบตา", { hp: -12 }]],
  ["ft_knight", "squire", "เด็กถือโล่", "เด็กชาวนาคนหนึ่งเดินตามม้าคุณมาสามหมู่บ้านแล้ว ขอเป็นเด็กถือโล่", ["รับไว้", "เขาขัดเกราะคุณจนเงาวับ และร้องไห้เมื่อคุณชนะประลอง", { joy: 5 }], ["ส่งกลับบ้าน", "เขามองตามคุณจนลับตา"]],
  ["ft_alchemist", "explosion", "ระเบิดกลางเมือง", "หม้อยาที่ต้มทิ้งไว้ระเบิดจนหลังคาร้านปลิว ชาวเมืองมุงดู", ["บอกว่าตั้งใจทำ", "ทุกคนเชื่อว่าเป็นการทดลองลับ ร้านคุณขายดีขึ้น", { gold: 10, fame: 2 }], ["ขอโทษและจ่ายค่าเสียหาย", "เพื่อนบ้านให้อภัย แต่ไม่ให้แมวเข้าใกล้ร้านคุณอีก", { gold: -10 }], ["looks", 50, "ไม่มีใครเชื่อ ยามมาออกใบสั่งปรับ", { gold: -8 }]],
  ["ft_alchemist", "unicorn_hair", "ขนยูนิคอร์น", "พ่อค้าเร่เสนอขายขนยูนิคอร์นแท้ ราคาถูกเกินจริง", ["ซื้อมาทดลอง", "เป็นของแท้! ยาที่ปรุงได้รักษาแผลเก่าของคุณหายสนิท", { hp: 10, gold: -5 }], ["ปฏิเสธ", "ปีหน้าคุณได้ข่าวว่ามันคือขนม้าย้อมสี"], ["luck", 50, "มันคือขนแพะย้อมสี", { gold: -5 }]],
  ["ft_priest", "doubt", "คืนแห่งความสงสัย", "เด็กกำพร้าที่คุณดูแลตายด้วยไข้ ทั้งที่คุณสวดทุกคืน", ["สวดต่อไป", "ศรัทธาของคุณแข็งแรงขึ้นอย่างเงียบๆ เหมือนกระดูกที่หักแล้วติดใหม่", { joy: -3, iq: 2 }], ["ออกไปเดินในฝนทั้งคืน", "รุ่งเช้าคุณกลับมาทำงานต่อ แต่ไม่ใช่คนเดิมแล้ว", { joy: -5 }]],
  ["ft_priest", "miracle", "ปาฏิหาริย์", "เทียนในวิหารลุกเป็นไฟสีทองเองในคืนที่คุณสวดคนเดียว", ["บอกทุกคน", "ผู้คนแห่มาวิหารของคุณจากทุกเมือง", { fame: 6 }], ["เก็บเป็นความลับ", "คุณรู้ว่ามีใครบางคนฟังอยู่ และนั่นก็พอแล้ว", { joy: 6, magic: 5 }]],
  ["ft_bard", "duel_song", "ดวลเพลง", "กวีขี้เมาจากเมืองหลวงท้าคุณดวลเพลงด่ากัน ผู้แพ้ต้องจ่ายค่าเหล้าทั้งร้าน", ["รับคำท้า", "กลอนของคุณคมจนเขาหัวเราะจนตกเก้าอี้ แล้วยอมจ่ายเอง", { fame: 3, joy: 4 }], ["ชวนร้องคู่แทน", "เพลงคู่คืนนั้นกลายเป็นเพลงฮิตของเมือง", { fame: 2 }], ["smarts", 50, "เขาด่าคุณเป็นกลอนได้สิบสองท่อนรวด คุณจ่ายค่าเหล้า", { gold: -6 }]],
  ["ft_bard", "lost_verse", "บทเพลงที่หายไป", "หญิงชราร้องเพลงที่ไม่มีในตำราเล่มไหน แล้วบอกว่าเป็นท่อนสุดท้ายของเพลงที่ปลุกมังกรได้", ["จดเนื้อเพลงไว้", "ทุกครั้งที่คุณฮัมเพลงนี้ มังกรบนฟ้าวนกลับมาดู", { fame: 3, flag: "ftDragonSong" }], ["ฟังเฉยๆ", "เพลงนั้นติดอยู่ในหัวคุณไปตลอดชีวิต", { joy: 3 }]],
  ["ft_ranger", "white_stag", "กวางขาว", "กวางสีขาวเขาเงินยืนมองคุณอยู่กลางลำธาร มีคนบอกว่าใครล่ามันได้จะเป็นราชา", ["ยิงธนู", "ลูกธนูทะลุผ่านตัวมันเหมือนผ่านหมอก กวางหันมาแล้วหายไป ทิ้งไว้แต่รอยเท้าเรืองแสง", { luck: -3 }], ["ลดธนูลง", "กวางก้มหัวให้คุณ แล้วป่าทั้งป่าก็เงียบเหมือนกำลังขอบคุณ", { luck: 5, joy: 4 }]],
  ["ft_ranger", "poachers", "พรานเถื่อน", "พรานเถื่อนวางกับดักลูกยูนิคอร์นในป่าที่คุณดูแล", ["ซุ่มจับพวกมัน", "คุณมัดพวกมันส่งยามทั้งแก๊ง ลูกยูนิคอร์นวิ่งกลับไปหาแม่", { fame: 4 }], ["ทำลายกับดักเงียบๆ", "พวกมันไม่รู้เลยว่าใครทำ", { luck: 2 }], ["health", 55, "พวกมันมีหกคน ไม่ใช่สอง", { hp: -9 }]],
  ["ft_sailor", "mermaid", "เสียงเพลงกลางทะเล", "เสียงเพลงลอยมาจากโขดหินกลางทะเลตอนเที่ยงคืน กัปตันสั่งให้ทุกคนอุดหู", ["ฟังเพลงจนจบ", "นางเงือกหยุดร้องแล้วหัวเราะ เธอโยนไข่มุกให้คุณหนึ่งเม็ดเพราะคุณไม่กระโดดลงไป", { gold: 25, joy: 4 }], ["อุดหูตามคำสั่ง", "เรือผ่านไปอย่างปลอดภัย"], ["smarts", 55, "คุณเกือบกระโดดลงทะเล เพื่อนร่วมเรือมัดคุณไว้กับเสา", { joy: -3 }]],
  ["ft_sailor", "kraken", "หนวดใต้ท้องเรือ", "หนวดยักษ์รัดกระดูกงูเรือ เรือเอียงจนน้ำเข้า", ["ฟันหนวดด้วยขวาน", "หนวดคลายออก ทั้งเรือโห่ร้องชื่อคุณ", { fame: 5, body: 6 }], ["โยนสินค้าลงทะเลให้มันกิน", "มันกินเครื่องเทศแล้วจามจนดำน้ำหนีไป", { gold: -8 }], ["health", 60, "หนวดฟาดคุณกระเด็นไปอีกฝั่งเรือ", { hp: -12 }]],
  ["ft_miner", "canary", "นกขมิ้นเงียบ", "นกขมิ้นในกรงหยุดร้องกลางอุโมงค์ ทุกคนรู้ว่าแปลว่าอะไร", ["ตะโกนให้ทุกคนวิ่งออก", "อุโมงค์ถล่มหลังคนสุดท้ายออกมาพอดี คุณช่วยได้ทั้งกะ", { fame: 4, joy: 3 }], ["วิ่งออกคนเดียว", "คุณรอด แต่ไม่ใช่ทุกคน", { joy: -8 }]],
  ["ft_miner", "golem", "ยักษ์หินหลับ", "ปลายสายแร่คือหน้าอกของยักษ์หินที่หลับอยู่ในภูเขา", ["เคาะเรียกมันเบาๆ", "ยักษ์หินลืมตา มองคุณนาน แล้วยื่นอัญมณีจากหัวใจให้หนึ่งเม็ด", { gold: 40, luck: 2 }], ["ถมอุโมงค์ปิดไว้", "บางเรื่องควรหลับต่อไป"], ["luck", 55, "ยักษ์พลิกตัว อุโมงค์สั่นจนคุณกระเด็น", { hp: -10 }]],
  ["ft_thief", "noble_ring", "แหวนผิดวง", "แหวนที่คุณขโมยมาจากขุนนางสลักตราของราชวงศ์ที่ล่มไปแล้ว", ["ขายให้นักสะสม", "นักสะสมจ่ายราคาที่ทำให้คุณเลิกขโมยไปทั้งปี", { gold: 40 }], ["เก็บไว้เอง", "บางคืนคุณได้ยินเสียงกระซิบจากแหวน", { luck: 3 }]],
  ["ft_thief", "guild_test", "บททดสอบของกิลด์", "หัวหน้ากิลด์โจรให้คุณขโมยขนนกจากหมวกของหัวหน้ายามโดยที่เขายังสวมอยู่", ["ลงมือกลางขบวนแห่", "ขนนกอยู่ในมือคุณ หัวหน้ายามยังโบกมือให้ฝูงชนอยู่เลย", { fame: 3, luck: 2 }], ["ปฏิเสธ", "หัวหน้ากิลด์ไม่ไว้ใจคุณอีกนาน"], ["luck", 55, "หัวหน้ายามหันมาสบตาคุณพอดี", { hp: -5 }]],
  ["ft_chef", "royal_taste", "ผู้ชิมของผู้ครอง", "คนชิมอาหารของผู้ครองแผ่นดินมาที่ร้านคุณโดยปลอมตัว", ["ทำเมนูที่ดีที่สุด", "หนึ่งเดือนต่อมามีจดหมายเชิญจากห้องครัวหลวง", { fame: 5, gold: 10 }], ["ทำเหมือนแขกทุกคน", "เขากินหมดจานแล้วจากไปเงียบๆ"]],
  ["ft_chef", "ogre_order", "ลูกค้ายักษ์", "ยักษ์สองหัวสั่งอาหารสำหรับสามสิบคน แล้วบอกว่าจะกินคนเดียว", ["ทำให้ทันใน 1 ชั่วโมง", "ทั้งสองหัวเรอพร้อมกัน แล้วจ่ายทองเป็นกำ", { gold: 30 }], ["บอกว่าวัตถุดิบหมด", "หัวหนึ่งเชื่อ อีกหัวไม่เชื่อ", { hp: -3 }], ["health", 50, "ไม่ทัน หัวซ้ายเริ่มมองพ่อครัวผู้ช่วยแทน", { joy: -4 }]],
  ["ft_diplomat", "poison_cup", "ถ้วยสองใบ", "ทูตฝ่ายตรงข้ามรินไวน์สองถ้วย แล้วยิ้มให้คุณเลือก", ["สลับถ้วยกับเขา", "เขาหน้าซีดแล้วยอมเซ็นสนธิสัญญาทันที", { fame: 4, iq: 1 }], ["ปฏิเสธการดื่ม", "การเจรจาเย็นชาลงทั้งปี"], ["smarts", 60, "ทั้งสองถ้วยมียาพิษ คุณป่วยไปสามเดือน", { hp: -15 }]],
  ["ft_diplomat", "princess_letter", "จดหมายของเจ้าหญิง", "เจ้าหญิงต่างแดนฝากจดหมายรักผ่านคุณถึงเจ้าชายของแผ่นดินคุณ", ["ส่งให้ถึงมือ", "ทั้งสองแต่งงานกัน สองแผ่นดินเป็นพันธมิตรเพราะจดหมายฉบับเดียว", { fame: 6 }], ["ส่งให้สภาตรวจก่อน", "สภาเผาจดหมายทิ้ง เจ้าหญิงไม่เคยรู้ว่าทำไมไม่มีคำตอบ", { joy: -3 }]],
  ["ft_tamer", "chimera", "ไคเมร่าในคอก", "ไคเมร่าที่ถูกจับมาจากภูเขาไฟไม่ยอมกินอะไรมาสามวัน", ["นอนค้างในคอกกับมัน", "เช้าวันที่สี่มันกินเนื้อจากมือคุณ ทั้งสามหัว", { fame: 4, joy: 5 }], ["รายงานว่ามันฝึกไม่ได้", "มันถูกส่งไปสังเวียน คุณไม่เคยลืมตาของมัน", { joy: -4 }], ["health", 55, "หัวแพะของมันพ่นไฟใส่คุณ", { hp: -9 }]],
  ["ft_tamer", "pegasus_foal", "ลูกเพกาซัส", "ม้าตัวเมียในคอกคลอดลูกที่มีปีก", ["เลี้ยงไว้เอง", "สามปีต่อมามันพาคุณบินข้ามทะเลสาบเป็นครั้งแรก", { joy: 8, fame: 3 }], ["ขายให้ราชสำนัก", "ราชสำนักจ่ายราคาเท่าไร่ทั้งไร่", { gold: 60 }]],
  ["ft_enchanter", "talking_sword", "ดาบที่พูดได้", "ดาบที่ลูกค้าส่งมาลงอาคมเริ่มพูดขึ้นมากลางดึก บอกว่าเจ้าของมันเป็นฆาตกร", ["แจ้งยาม", "ดาบพูดเป็นพยานในศาล คนร้ายถูกจับ และดาบขอให้คุณเป็นเจ้าของใหม่", { fame: 5, magic: 6 }], ["ลงอาคมให้มันเงียบ", "เจ้าของมารับดาบไปพร้อมรอยยิ้มแปลกๆ", { joy: -3 }]],
  ["ft_enchanter", "rune_storm", "พายุรูน", "รูนที่คุณสลักทิ้งไว้ทั้งห้องเรืองแสงพร้อมกันในคืนพายุ", ["ยืนกลางวงรูน", "พายุไหลเข้าตัวคุณ คุณเข้าใจรูนลึกกว่าที่ตำราเล่มไหนสอน", { magic: 12 }], ["ลบรูนทิ้งให้หมด", "ห้องมืดลง และคุณหายใจโล่งขึ้น"], ["smarts", 60, "พายุโยนคุณกระแทกผนัง", { hp: -10 }]],
  ["ft_gladiator", "rigged", "นัดล้มมวย", "เจ้าของสังเวียนจ่ายเงินก้อนใหญ่ให้คุณแพ้ในยกที่สาม", ["รับเงินแล้วแพ้", "คุณนอนบนพื้นทรายฟังเสียงโห่ แต่กระเป๋าหนัก", { gold: 40, fame: -4 }], ["ชนะต่อหน้าเขา", "ฝูงชนบ้าคลั่ง เจ้าของสังเวียนจะจำคุณไปอีกนาน", { fame: 6 }]],
  ["ft_gladiator", "old_champion", "แชมป์เก่า", "แชมป์สังเวียนเมื่อยี่สิบปีก่อนมานั่งดูคุณซ้อมทุกวัน", ["ขอให้เขาสอน", "เขาสอนท่าเดียว ท่านั้นชนะได้ทุกคน", { body: 14 }], ["ท้าเขาสู้", "เขาหัวเราะแล้วล้มคุณด้วยไม้เท้า", { hp: -4, body: 4 }]],
  ["ft_cartographer", "moving_mountain", "ภูเขาที่ย้ายที่", "ภูเขาลูกหนึ่งอยู่คนละที่กับในแผนที่ของคุณเมื่อปีก่อน", ["เฝ้าดูทั้งคืน", "ตอนตีสาม ภูเขาลืมตา มันคือเต่ายักษ์ที่นอนหลับ", { iq: 3, fame: 4 }], ["แก้แผนที่ตามจริง", "แผนที่ของคุณแม่นยำแม้กับสิ่งที่ขยับได้"]],
  ["ft_cartographer", "edge", "ขอบโลก", "ทางทิศตะวันตกสุดของแผนที่ คุณเจอหน้าผาที่มองลงไปเห็นแต่ดวงดาว", ["โยนหินลงไป", "หินไม่ตก มันลอยไปเป็นดาวดวงใหม่", { magic: 8, iq: 2 }], ["วาดไว้แล้วกลับบ้าน", "ไม่มีใครเชื่อแผนที่หน้านั้น", { iq: 1 }]],
  ["ft_wandwright", "wand_choice", "คทาเลือกคน", "คทาที่คุณทำไว้นานที่สุดในร้าน สั่นแรงเมื่อเด็กขอทานคนหนึ่งเดินผ่าน", ["มอบให้เด็กฟรี", "สิบปีต่อมาเด็กคนนั้นกลับมาในชุดจอมเวท พร้อมทองคำเต็มกระเป๋า", { gold: 50, joy: 5 }], ["รอคนที่จ่ายได้", "คทาเงียบไปอีกหลายปี"]],
  ["ft_wandwright", "phoenix_feather", "ขนฟีนิกซ์", "นกไฟบินมาเกาะหน้าร้านคุณ แล้วทิ้งขนไว้หนึ่งเส้น", ["ใช้ทำแกนคทา", "คทาที่ได้แรงจนทั้งหอเวทมาขอดู", { fame: 4, gold: 30 }], ["เก็บไว้เป็นเครื่องราง", "ร้านคุณไม่เคยไฟไหม้อีกเลย", { luck: 3 }]],
  ["ft_dragonkeeper", "sick_dragon", "มังกรป่วย", "มังกรที่แก่ที่สุดในคอกหลวงไม่ยอมพ่นไฟมาหนึ่งเดือนแล้ว", ["ปีนเข้าไปดูในปากมัน", "กระดูกแกะติดอยู่ในฟันกราม มังกรเลียคุณจนตัวเปียก", { fame: 3, joy: 5 }], ["เรียกนักเวทหลวงมาดู", "นักเวทใช้เวลาสามเดือนจึงพบสาเหตุ"], ["health", 55, "มันจามตอนคุณอยู่ในปาก", { hp: -10 }]],
  ["ft_dragonkeeper", "wild_call", "เสียงเรียกจากฟ้า", "มังกรป่าบินวนเหนือคอกหลวงทั้งคืน มังกรในคอกร้องตอบ", ["เปิดคอกให้มันออกไป", "มังกรในคอกบินขึ้นไปหาเพื่อนของมัน คุณถูกลงโทษ แต่มังกรป่าทุกตัวจำคุณได้", { fame: -2, joy: 6 }], ["ปลอบมังกรในคอก", "มันนอนลงช้าๆ แต่ตาไม่เคยละจากฟ้า"]],
  ["ft_courtier", "succession", "ทายาทสองคน", "เจ้าชายสองพระองค์ต่างขอให้คุณอยู่ข้างตัวเองในวันที่ผู้ครองประชวรหนัก", ["เลือกพระองค์โต", "พระองค์โตขึ้นครอง และจำว่าคุณยืนข้างเขาก่อนใคร", { fame: 5 }], ["เลือกพระองค์เล็ก", "พระองค์เล็กพ่ายแพ้ คุณถูกส่งไปดูแลที่ดินชายแดนห้าปี", { joy: -5 }]],
  ["ft_courtier", "masquerade", "งานเต้นรำสวมหน้ากาก", "ในงานเต้นรำหน้ากาก คนแปลกหน้าคนหนึ่งกระซิบชื่อจริงของคุณ แล้วบอกว่ารู้ความลับทุกเรื่อง", ["ตามเขาไปที่ระเบียง", "เขาคือหัวหน้าราชสำนักรัตติกาล และอยากให้คุณเป็นหูตาในวัง", { gold: 20, fame: 2 }], ["กลับไปเต้นรำต่อ", "คืนนั้นคุณนอนไม่หลับเลย"]],
];

const jobIs = (id: string) => (l: Life) => l.job?.careerId === id;
const CAREER_EVENTS: GameEvent[] = ROWS.map(([job, id, title, text, a, b, ck]) => E(`ft.j.${id}`, [14, 400], text, [
  ck ? K(a[0], ck[0], ck[1], G(a[1], a[2]), N(ck[2], ck[3])) : C(a[0], G(a[1], a[2])),
  C(b[0], N(b[1], b[2])),
], { title, when: jobIs(job), maxTimes: 1, weight: 12 }));

export { CAREER_EVENTS };

export function loadCareers() {
  for (const c of NEW_CAREERS) CAREERS.push({ ...c, emoji: "", world: "fantasy" });
  JOB_ACTIONS.push(...FT_JOB_ACTIONS);
  // ทรัพย์สินจ่ายทุกปี และบอกยอดในบันทึกปีละครั้ง
  yearHooks.push((l) => {
    if (l.worldId !== "fantasy" || !l.ft || !l.alive) return;
    const g = assetIncome(l);
    if (!g) return;
    addMoney(l, g * GOLD);
    if (l.age % 5 === 0) log(l, `ที่ดินและกิจการของคุณให้รายได้ปีละ ${g} เหรียญทอง`);
  });
}
