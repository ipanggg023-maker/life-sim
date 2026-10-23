// ความสำเร็จของยุทธภพ — ฝีมือ ทำเนียบ พรสวรรค์ ชีวิต ครอบครัว เป้าหมายชีวิต และบัลลังก์มังกร
// ตรวจทุกปี (shared/achieveHook) — สิ่งที่เคยทำได้ระหว่างชีวิตยังนับตอนจบ แม้สถานะนั้นจะหายไปแล้ว (เช่น สละราชย์)
import { ACHIEVEMENTS, type Achievement } from "../../achievements";
import type { Life } from "../../../engine/types";
import { people } from "../../../engine/util";
import { alignment, mySect } from "../m17core";
import { artsOf } from "../martial/arts";
import { activeEdicts } from "../world/edicts";
import { empressOf, haremOf } from "../world/harem";
import { palaceOf } from "../world/palace";
import { GOALS } from "./goals";

const mu = (l: Life) => l.worldId === "murim";
const rank = (l: Life) => (mu(l) ? l.power?.rank ?? -1 : -1);
const n = (l: Life, k: string) => Number(l.flags[k] ?? 0);
const best = (l: Life) => n(l, "bestPlace");
const combos = (l: Life) => Object.keys(l.flags).filter((k) => k.startsWith("combo:") && l.flags[k]).length;
const goalsWon = (l: Life) => GOALS.filter((g) => l.flags[`goalWon_${g.id}`]).length;
const emp = (l: Life) => mu(l) && !!l.flags.emperorSelf;

type A = Omit<Achievement, "cat">;
const martial: A[] = [
  { id: "mu_awaken", name: "ก้าวแรกในยุทธภพ", desc: "ทะลวงเส้นชีพจร เริ่มฝึกวิชายุทธ์", points: 5, check: (l) => rank(l) >= 0 },
  { id: "mu_rank2", name: "ยอดฝีมือขั้นสอง", desc: "ฝีมือถึงขั้นที่สองของยุทธภพ", points: 8, check: (l) => rank(l) >= 2 },
  { id: "mu_rank4", name: "ยอดฝีมือขั้นหนึ่ง", desc: "ฝีมือถึงขั้นที่สี่ของยุทธภพ", points: 15, check: (l) => rank(l) >= 4 },
  { id: "mu_rank6", name: "สุดยอดแห่งวิชา", desc: "ฝีมือถึงขั้นที่หกของยุทธภพ", points: 25, check: (l) => rank(l) >= 6 },
  { id: "mu_rank8", name: "เหนือความเป็นความตาย", desc: "ฝีมือถึงขั้นสูงสุดของมนุษย์", points: 45, check: (l) => rank(l) >= 8 },
  { id: "mu_arts5", name: "ห้าวิชาในกาย", desc: "รู้วิชายุทธ์ 5 วิชา", points: 10, check: (l) => mu(l) && artsOf(l).length >= 5 },
  { id: "mu_arts10", name: "คลังวิชาเดินได้", desc: "รู้วิชายุทธ์ 10 วิชา", points: 20, check: (l) => mu(l) && artsOf(l).length >= 10 },
  { id: "mu_created", name: "ผู้คิดค้นกระบวนท่า", desc: "คิดค้นวิชายุทธ์ของตัวเอง", points: 20, check: (l) => mu(l) && !!l.flags.createdArt },
  { id: "mu_duel10", name: "สิบศึกไม่แพ้ใจ", desc: "ชนะการต่อสู้ 10 ครั้ง", points: 10, check: (l) => n(l, "duelWins") >= 10 },
  { id: "mu_duel50", name: "ร้อยศึกโชกเลือด", desc: "ชนะการต่อสู้ 50 ครั้ง", points: 25, check: (l) => n(l, "duelWins") >= 50 },
  { id: "mu_dragon", name: "มังกรรุ่นใหม่", desc: "ติดทำเนียบมังกร", points: 10, check: (l) => mu(l) && !!l.flags.youngListed },
  { id: "mu_dragon1", name: "มังกรตัวแรก", desc: "ขึ้นอันดับหนึ่งของทำเนียบมังกร", points: 25, check: (l) => mu(l) && !!l.flags.youngTop },
  { id: "mu_list20", name: "ชื่อบนทำเนียบ", desc: "ติดยี่สิบอันดับแรกของทำเนียบยุทธภพ", points: 15, check: (l) => best(l) > 0 && best(l) <= 20 },
  { id: "mu_list10", name: "หนึ่งในสิบยอดฝีมือ", desc: "ขึ้นถึงสิบอันดับแรกของทำเนียบยุทธภพ", points: 30, check: (l) => best(l) > 0 && best(l) <= 10 },
  { id: "mu_list1", name: "ไร้เทียมทานใต้หล้า", desc: "อันดับหนึ่งของทำเนียบยุทธภพ", points: 60, check: (l) => best(l) === 1 },
  { id: "mu_tourney", name: "ป้ายทองงานประลอง", desc: "ชนะเลิศงานประลองยุทธ์", points: 20, check: (l) => mu(l) && (!!l.flags.tourneyChampion || !!l.flags.gatheringChampion) },
  { id: "mu_slayer", name: "ผู้ปราบจอมมาร", desc: "สังหารจอมมารแห่งยุค", points: 35, check: (l) => mu(l) && !!l.flags.slewDemonLord },
  { id: "mu_demon_throne", name: "บัลลังก์ลัทธิมาร", desc: "ขึ้นเป็นจอมมารสวรรค์", points: 35, check: (l) => mu(l) && (!!l.flags.heavenlyDemon || !!l.flags.becameDemonLord) },
  { id: "mu_sect", name: "เจ้าสำนัก", desc: "ก่อตั้งสำนักของตัวเอง", points: 20, check: (l) => mu(l) && !!mySect(l) },
  { id: "mu_sect30", name: "สำนักใหญ่", desc: "สำนักมีศิษย์ 30 คนขึ้นไป", points: 25, check: (l) => mu(l) && (mySect(l)?.d ?? 0) >= 30 },
  { id: "mu_saint", name: "ผู้ทรงธรรมแห่งยุค", desc: "ใจสว่างถึงธรรมะ 70", points: 15, check: (l) => mu(l) && alignment(l) >= 70 },
  { id: "mu_fiend", name: "ใจดำดั่งน้ำหมึก", desc: "ใจมืดถึงธรรมะ -70", points: 15, check: (l) => mu(l) && alignment(l) <= -70 },
  { id: "mu_blood", name: "ทางเดินเปื้อนเลือด", desc: "ปลิดชีพคน 20 คน", points: 10, hidden: true, check: (l) => n(l, "mwKills") >= 20 },
  { id: "mu_evolve", name: "พรสวรรค์ตื่น", desc: "พรสวรรค์วิวัฒน์ครั้งแรก", points: 10, check: (l) => n(l, "taEvolved") >= 1 },
  { id: "mu_evolve2", name: "สองวิวัฒน์", desc: "พรสวรรค์วิวัฒน์สองครั้งในชีวิตเดียว", points: 20, check: (l) => n(l, "taEvolved") >= 2 },
  { id: "mu_combo", name: "ฟ้าลิขิตซ้อนกัน", desc: "ค้นพบพลังที่ซ่อนจากพรสวรรค์ที่ประสานกัน", points: 15, hidden: true, check: (l) => combos(l) >= 1 },
  { id: "mu_regressor", name: "กลับชาติมาเกิด", desc: "ความทรงจำจากชาติก่อนผุดขึ้นในคืนฟ้าผ่า", points: 20, hidden: true, check: (l) => mu(l) && !!l.flags.regressor },
  { id: "mu_cave", name: "ทายาทในถ้ำ", desc: "ได้มรดกวิชาจากถ้ำลับ", points: 15, check: (l) => mu(l) && !!l.flags.caveInheritance },
  { id: "mu_legend_weapon", name: "อาวุธในตำนาน", desc: "ได้ครองอาวุธในตำนาน", points: 15, check: (l) => mu(l) && Number(l.flags.mwWeaponTier ?? 0) >= 4 },
  { id: "mu_cliff", name: "ก้นหุบเขา", desc: "กระโดดหน้าผาแล้วเจอปรมาจารย์ที่ก้นหุบเขา", points: 15, hidden: true, check: (l) => mu(l) && !!l.flags.cliffMaster },
  { id: "mu_sect_head", name: "แหวนเจ้าสำนัก", desc: "ชิงตำแหน่งเจ้าสำนักที่ตัวเองเติบโตมาได้", points: 25, check: (l) => mu(l) && !!l.flags.sectHead },
  { id: "mu_revive", name: "ดอกเหมยบานอีกครั้ง", desc: "ฟื้นฟูสำนักที่กำลังจะดับให้กลับมายิ่งใหญ่", points: 30, check: (l) => mu(l) && !!l.flags.sectRevived },
  { id: "mu_combo3", name: "สามลิขิตในกายเดียว", desc: "ค้นพบพลังประสาน 3 แบบในชีวิตเดียว", points: 35, hidden: true, check: (l) => combos(l) >= 3 },
];

const life: A[] = [
  { id: "mu_rich", name: "หมื่นตำลึงทอง", desc: "มีทรัพย์สินสองหมื่นตำลึง", points: 15, check: (l) => mu(l) && l.money - l.debt >= 20_000_000 },
  { id: "mu_rich2", name: "มหาเศรษฐีแห่งแผ่นดิน", desc: "มีทรัพย์สินแสนตำลึง", points: 30, check: (l) => mu(l) && l.money - l.debt >= 100_000_000 },
  { id: "mu_kids8", name: "ลูกหลานเต็มบ้าน", desc: "มีลูก 8 คนขึ้นไป", points: 15, check: (l) => mu(l) && people(l, "child", false).length >= 8 },
  { id: "mu_gen3", name: "ตระกูลสามชั่วคน", desc: "เล่นต่อเป็นลูกหลานถึงรุ่นที่ 3 ในยุทธภพ", points: 20, check: (l) => mu(l) && n(l, "generation") >= 3 },
  { id: "mu_gen5", name: "ห้าชั่วคนไม่ขาดสาย", desc: "เล่นต่อเป็นลูกหลานถึงรุ่นที่ 5", points: 35, check: (l) => mu(l) && n(l, "generation") >= 5 },
  { id: "mu_sworn", name: "พี่น้องร่วมสาบาน", desc: "ดื่มเหล้าสาบานเป็นพี่น้อง", points: 10, check: (l) => mu(l) && l.people.some((p) => p.tags?.includes("sworn")) },
  { id: "mu_wander10", name: "สิบปีบนหลังม้า", desc: "ท่องยุทธภพรวม 10 ปี", points: 10, check: (l) => n(l, "mwWanderYears") >= 10 },
  { id: "mu_beauty", name: "งามล่มเมือง", desc: "ชนะงานประกวดโฉมงาม", points: 10, check: (l) => mu(l) && !!l.flags.beautyWinner },
  { id: "mu_escort", name: "ขบวนไม่เคยหาย", desc: "คุ้มกันขบวนสินค้าสำเร็จ", points: 8, check: (l) => mu(l) && !!l.flags.escortWon },
  { id: "mu_scholar", name: "จอหงวน", desc: "สอบได้ที่หนึ่งของการสอบหลวง", points: 25, check: (l) => mu(l) && !!l.flags.zhuangyuan },
  { id: "mu_jinshi", name: "บัณฑิตหลวง", desc: "สอบได้จิ้นซื่อ", points: 12, check: (l) => mu(l) && !!l.flags.jinshi },
  { id: "mu_wanted", name: "หมายจับติดทุกเมือง", desc: "ถูกทางการประกาศจับ", points: 5, hidden: true, check: (l) => mu(l) && (!!l.flags.wanted || !!l.flags.mwWanted) },
  { id: "mu_jail", name: "ห้องขังคุ้นเคย", desc: "เคยติดคุก", points: 5, hidden: true, check: (l) => mu(l) && l.flags.jailUntil !== undefined },
  { id: "mu_century", name: "ร้อยปีในยุทธภพ", desc: "มีชีวิตถึง 100 ปีในยุทธภพ", points: 30, check: (l) => mu(l) && l.age >= 100 },
  { id: "mu_basin", name: "อ่างทองคำ", desc: "ล้างมือในอ่างทองคำ วางมือจากยุทธภพ", points: 12, check: (l) => mu(l) && l.flags.goldenBasin !== undefined },
  { id: "mu_wulin", name: "เจ้ายุทธจักร", desc: "ขึ้นเป็นเจ้ายุทธจักร", points: 40, check: (l) => mu(l) && l.flags.wulinLeader !== undefined },
  { id: "mu_cases", name: "นักสืบแห่งยุทธภพ", desc: "ไขคดีปริศนาได้สามคดี", points: 15, check: (l) => n(l, "casesSolved") >= 3 },
  { id: "mu_signboards", name: "ป้ายเต็มบ้าน", desc: "ถอดป้ายสำนักมวยได้สามป้าย", points: 12, check: (l) => n(l, "signboards") >= 3 },
  { id: "mu_disguise", name: "เด็กชายที่ไม่ใช่เด็กชาย", desc: "ปลอมตัวเป็นชายเข้าสำนัก", points: 10, hidden: true, check: (l) => mu(l) && !!l.flags.disguised },
  { id: "mu_sixteen", name: "สิบหกปีให้หลัง", desc: "รอคนรักครบสิบหกปีตามคำสัญญา", points: 20, hidden: true, check: (l) => mu(l) && !!l.seen["wf.sixteen_meet"] },
  { id: "mu_ascend", name: "ขึ้นสวรรค์ทั้งร่าง", desc: "บรรลุเซียนในยุทธภพ", points: 60, check: (l) => mu(l) && !!l.flags.ascended },
];

const throne: A[] = [
  { id: "mu_court", name: "สวมหมวกขุนนาง", desc: "ได้ตำแหน่งในราชสำนัก", points: 8, check: (l) => mu(l) && n(l, "courtRank") >= 1 },
  { id: "mu_court5", name: "เสาค้ำบัลลังก์", desc: "ตำแหน่งในราชสำนักถึงขั้นที่ 5", points: 20, check: (l) => mu(l) && n(l, "courtRank") >= 5 },
  { id: "mu_lord", name: "เจ้าแคว้น", desc: "ขึ้นเป็นเจ้าแคว้นในยุคแผ่นดินแตก", points: 25, check: (l) => mu(l) && !!l.flags.isLord },
  { id: "mu_emperor", name: "โอรสสวรรค์", desc: "ขึ้นครองราชย์เป็นฮ่องเต้", points: 40, check: emp },
  { id: "mu_dynasty", name: "ปฐมกษัตริย์", desc: "ก่อตั้งราชวงศ์ใหม่", points: 35, check: (l) => mu(l) && !!l.flags.foundedDynasty },
  { id: "mu_unifier", name: "รวมแผ่นดิน", desc: "รวมสามแคว้นเป็นหนึ่ง", points: 45, check: (l) => mu(l) && !!l.flags.unifier },
  { id: "mu_harem10", name: "สามพันนางใน (เกือบ)", desc: "มีสนมในวังหลัง 10 คนพร้อมกัน", points: 15, check: (l) => emp(l) && haremOf(l).length >= 10 },
  { id: "mu_empress", name: "แม่แห่งแผ่นดิน", desc: "แต่งตั้งฮองเฮา", points: 10, check: (l) => emp(l) && !!empressOf(l) },
  { id: "mu_heirs", name: "โอรสธิดาเต็มวัง", desc: "มีพระโอรสธิดา 10 พระองค์", points: 15, check: (l) => emp(l) && people(l, "child", false).length >= 10 },
  { id: "mu_edicts6", name: "หกราชโองการ", desc: "มีราชโองการมีผลพร้อมกัน 6 ฉบับ", points: 15, check: (l) => emp(l) && activeEdicts(l).length >= 6 },
  { id: "mu_treasury", name: "ท้องพระคลังล้นทอง", desc: "ท้องพระคลังเต็มถึง 90", points: 15, check: (l) => emp(l) && palaceOf(l).treasury >= 90 },
  { id: "mu_purge", name: "ดาบของฮ่องเต้", desc: "กวาดล้างขุนนางที่คิดคดได้ 3 คน", points: 15, check: (l) => n(l, "purgedTraitors") >= 3 },
  { id: "mu_abdicate", name: "วางบัลลังก์ด้วยมือตัวเอง", desc: "สละราชสมบัติให้รัชทายาท", points: 10, check: (l) => mu(l) && l.flags.abdicatedAt !== undefined },
  { id: "mu_peach", name: "ใต้ต้นท้อ", desc: "สาบานเป็นพี่น้องในยุคแผ่นดินแตก", points: 10, check: (l) => mu(l) && !!l.flags.peachOath },
  { id: "mu_red_cliffs", name: "ไฟเผาผาแดง", desc: "เผาทัพเรือแสนลำด้วยลมตะวันออก", points: 25, check: (l) => mu(l) && !!l.flags.redCliffs },
  { id: "mu_empty_fort", name: "พิณบนกำแพงเมือง", desc: "ไล่ทัพแสนคนด้วยกลยุทธ์เมืองว่าง", points: 25, check: (l) => mu(l) && !!l.flags.emptyFort },
  { id: "mu_loyal", name: "ภักดีจนตัวตาย", desc: "เป็นตำนานแห่งความภักดีในยุคสามแคว้น", points: 20, check: (l) => mu(l) && !!l.flags.loyalLegend },
  { id: "mu_strat10", name: "ตำราพิชัยสงคราม", desc: "ใช้กลยุทธ์ต่างกันสิบกล", points: 15, check: (l) => mu(l) && String(l.flags.stratagems ?? "").split(",").filter(Boolean).length >= 10 },
  { id: "mu_strat36", name: "สามสิบหกกลยุทธ์", desc: "ใช้ครบทั้งสามสิบหกกลยุทธ์", points: 50, check: (l) => mu(l) && String(l.flags.stratagems ?? "").split(",").filter(Boolean).length >= 36 },
  { id: "mu_legit", name: "ฟ้ารับรอง", desc: "ความชอบธรรมของราชบัลลังก์ถึง 90", points: 20, check: (l) => emp(l) && (l.mw?.legitimacy ?? 0) >= 90 },
];

const goals: A[] = [
  { id: "mu_goal1", name: "ฝันที่เป็นจริง", desc: "ทำเป้าหมายชีวิตสำเร็จหนึ่งข้อ", points: 10, check: (l) => goalsWon(l) >= 1 },
  { id: "mu_goal3", name: "ชีวิตที่คุ้มค่า", desc: "ทำเป้าหมายชีวิตสำเร็จ 3 ข้อในชีวิตเดียว", points: 25, check: (l) => goalsWon(l) >= 3 },
  { id: "mu_goal5", name: "ไม่มีอะไรต้องเสียดาย", desc: "ทำเป้าหมายชีวิตสำเร็จ 5 ข้อในชีวิตเดียว", points: 45, check: (l) => goalsWon(l) >= 5 },
  // หนึ่งความสำเร็จต่อหนึ่งเป้าหมาย
  ...GOALS.map((g): A => ({ id: `mu_g_${g.id}`, name: g.name, desc: `ทำเป้าหมาย「${g.name}」สำเร็จ`, points: 8, check: (l) => mu(l) && !!l.flags[`goalWon_${g.id}`] })),
];

ACHIEVEMENTS.push(
  ...martial.map((a) => ({ ...a, cat: "murim" as const })),
  ...life.map((a) => ({ ...a, cat: "murim_life" as const })),
  ...goals.map((a) => ({ ...a, cat: "murim_goal" as const })),
  ...throne.map((a) => ({ ...a, cat: "murim_throne" as const })),
);
