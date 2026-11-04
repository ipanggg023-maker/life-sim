// โลกที่มีชีวิตขึ้นอีก: ลางแห่งยุค (ดาวหาง สุริยุปราคา คลื่นอสูร...) · กระดานภารกิจของเมือง · สัตว์ในตำนาน · บ้านของคุณ
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Choice, Ctx, GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, addStat, clamp, displayName } from "../../engine/util";
import { addLegend, recordChronicle } from "../../engine/worldState";
import { B, BIG, C, E, G, GOLD, K, N, P, PAY, SCENE } from "./kit";
import { canCast, deathOdds, fightOdds } from "./power";
import { addStanding, dataOf, deed, fl, worldOfLife } from "./state";
import { techChoice } from "./styles";

// ── ลางแห่งยุค ──
export interface Omen { id: string; name: string; desc: string; year: number; until: number }
const OMENS: { id: string; name: string; desc: string; text: string; a: [string, string]; b: [string, string] }[] = [
  { id: "comet", name: "ดาวหางหางเพลิง", desc: "โชคของทุกคนผันผวน", text: "ดาวหางหางเพลิงปรากฏบนฟ้าทั้งกลางวันกลางคืน หมอดูทุกคนทำนายไม่ตรงกัน", a: ["อธิษฐานกับดาวหาง", "คืนนั้นคุณฝันดีที่สุดในชีวิต"], b: ["ซื้อเครื่องรางกันโชคร้าย", "พ่อค้าขายเครื่องรางหมดทั้งตลาด รวมทั้งของคุณ"] },
  { id: "eclipse", name: "สุริยุปราคานิรันดร์", desc: "เวทมืดแรงขึ้น ผู้คนหวาดกลัว", text: "ดวงอาทิตย์มืดไปครึ่งดวงและไม่ยอมสว่างคืนทั้งเดือน เงาทุกเงายาวกว่าที่ควร", a: ["ศึกษาเวทในความมืด", "มานาในอากาศหนาจนคุณจับต้องได้"], b: ["อยู่ในบ้านจุดเทียน", "เทียนของคุณดับเองสามครั้งในคืนเดียว"] },
  { id: "tide", name: "คลื่นอสูร", desc: "สัตว์อสูรบุกทุกแผ่นดิน กำแพงทุกเมืองต้องการคน", text: "สัตว์อสูรนับพันหลั่งไหลออกมาจากป่าลึกพร้อมกัน กำแพงทุกเมืองต้องการคนเฝ้า", a: ["อาสาเฝ้ากำแพง", "คุณยืนเฝ้ากำแพงจนเช้า เห็นสัตว์ที่ไม่เคยมีในตำรา"], b: ["ช่วยอพยพเด็กๆ", "เด็กทุกคนในถนนของคุณปลอดภัย"] },
  { id: "surge", name: "มานาท่วมโลก", desc: "นักเวททุกคนแข็งแกร่งขึ้น", text: "ต้นไม้ทุกต้นเรืองแสงในคืนเดียว มานาในอากาศหนาจนเด็กธรรมดาจุดเทียนด้วยนิ้วได้", a: ["ฝึกเวทอย่างหนัก", "เวทของคุณไหลลื่นกว่าที่เคย"], b: ["ดูเด็กๆ เล่นกับแสง", "ทั้งเมืองหัวเราะเหมือนเป็นเทศกาล"] },
  { id: "migration", name: "มังกรย้ายถิ่น", desc: "มังกรบินผ่านแผ่นดินบ่อยขึ้น", text: "ฝูงมังกรป่านับร้อยบินผ่านฟ้าไปทางใต้ เงาของพวกมันบังแดดทั้งวัน", a: ["ปีนขึ้นเขาไปดูใกล้ๆ", "มังกรตัวหนึ่งบินลงต่ำเพื่อมองคุณ แล้วร้องทักทาย"], b: ["ซ่อนวัวไว้ในโรงนา", "วัวของคุณรอด วัวของเพื่อนบ้านไม่"] },
  { id: "winter", name: "ฤดูหนาวยาวสามปี", desc: "ของแพง สุขภาพทรุดง่าย", text: "หิมะตกไม่หยุดทั้งที่ควรเป็นฤดูร้อน แม่น้ำกลายเป็นน้ำแข็งถึงก้นแม่น้ำ", a: ["แบ่งฟืนให้เพื่อนบ้าน", "หมู่บ้านของคุณไม่มีใครหนาวตายในปีนั้น"], b: ["ตุนอาหารไว้", "บ้านคุณอิ่มทั้งปี แต่เพื่อนบ้านมองด้วยสายตาไม่ดี"] },
  { id: "golden", name: "ปีทองแห่งการเก็บเกี่ยว", desc: "ทุกคนรวยขึ้น", text: "พืชผลทุกไร่ออกผลสองเท่า ราคาขนมปังถูกลงครึ่งหนึ่ง ทั้งแผ่นดินเลี้ยงฉลองทุกคืน", a: ["ร่วมฉลองกับทุกคน", "คุณเต้นรำในจัตุรัสจนเท้าพอง"], b: ["เก็บออมไว้ปีหน้า", "คุณมีเงินเก็บมากที่สุดในชีวิต"] },
];
type OmenData = { omen?: Omen };
export const omenOf = (l: Life): Omen | undefined => { const o = (dataOf(l) as unknown as OmenData).omen; return o && o.until >= worldOfLife(l).year ? o : undefined; };

const omenEvent: GameEvent = E("ft.om.seen", [4, 900], (l) => OMENS.find((o) => o.id === omenOf(l)!.id)!.text, [
  C((l) => OMENS.find((o) => o.id === omenOf(l)!.id)!.a[0], (l) => { const o = OMENS.find((x) => x.id === omenOf(l)!.id)!; l.flags.ftOmenSeen = omenOf(l)!.year; omenChoice(l, o.id, 0); return { text: o.a[1], kind: "good" }; }),
  C((l) => OMENS.find((o) => o.id === omenOf(l)!.id)!.b[0], (l) => { const o = OMENS.find((x) => x.id === omenOf(l)!.id)!; l.flags.ftOmenSeen = omenOf(l)!.year; omenChoice(l, o.id, 1); return { text: o.b[1] }; }),
], { title: "ลางแห่งยุค", forced: true, maxTimes: 0, when: (l) => !!l.ft && !!omenOf(l) && Number(l.flags.ftOmenSeen ?? -1) !== omenOf(l)!.year });

function omenChoice(l: Life, id: string, i: number) {
  const f = fl(l);
  if (id === "comet") addStat(l, "luck", i === 0 ? randInt(l, -3, 8) : 2);
  if (id === "eclipse") { if (i === 0) f.magic += canCast(l) ? 15 : 3; else addStat(l, "happiness", -2); }
  if (id === "tide") { if (i === 0) { f.body += 10; addStanding(l, 4); } else addStanding(l, 6); }
  if (id === "surge") { if (i === 0) f.magic += 20; else addStat(l, "happiness", 5); }
  if (id === "migration") { if (i === 0) f.dragonBond += 5; else addMoney(l, 5 * GOLD); }
  if (id === "winter") { if (i === 0) { addStanding(l, 6); addMoney(l, -6 * GOLD); } else addStanding(l, -3); }
  if (id === "golden") { if (i === 0) addStat(l, "happiness", 8); else addMoney(l, 40 * GOLD); }
}

// ── กระดานภารกิจของเมือง: ปีละสามงาน สุ่มใหม่ทุกปี ──
interface Quest { name: string; text: string; kind: "fight" | "smarts" | "looks" | "luck"; threat: number; gold: number; ok: string; fail: string }
const QUESTS: Quest[] = [
  { name: "ตามหาแมวของคุณนายเมืองหลวง", text: "แมวขนยาวสีทองหายไปสามวัน คุณนายจ่ายเท่าค่าจ้างคนงานหนึ่งเดือน", kind: "luck", threat: 45, gold: 8, ok: "แมวนั่งอยู่บนหลังคาโรงตีเหล็ก มันไม่ได้หาย มันแค่ไม่อยากกลับ", fail: "คุณเจอแมวสิบตัว แต่ไม่มีตัวไหนเป็นสีทอง" },
  { name: "กำจัดหนูยักษ์ในห้องใต้ดิน", text: "หนูขนาดเท่าหมากินเสบียงของโรงเตี๊ยมไปครึ่งห้อง", kind: "fight", threat: 10, gold: 10, ok: "หนูตัวสุดท้ายวิ่งหนีออกท่อระบายน้ำ เจ้าของโรงเตี๊ยมเลี้ยงข้าวคุณหนึ่งเดือน", fail: "หนูกัดรองเท้าคุณจนขาด" },
  { name: "ส่งจดหมายข้ามภูเขา", text: "จดหมายด่วนต้องถึงเมืองข้างภูเขาภายในสามวัน และถนนมีโจร", kind: "fight", threat: 18, gold: 14, ok: "จดหมายถึงทันเวลา มันคือคำขอแต่งงาน และคำตอบคือใช่", fail: "โจรดักคุณกลางทาง จดหมายเปียกฝนจนอ่านไม่ออก" },
  { name: "คุ้มกันพ่อค้าผ้าไหม", text: "พ่อค้าผ้าไหมต้องการคนคุ้มกันข้ามป่าหมาป่า", kind: "fight", threat: 24, gold: 18, ok: "หมาป่าเห็นคุณแล้วไม่กล้าเข้าใกล้ ผ้าไหมถึงตลาดครบทุกม้วน", fail: "หมาป่ามามากเกินไป ผ้าไหมหายไปสามม้วน" },
  { name: "แก้ข้อพิพาทเรื่องรั้ว", text: "ชาวนาสองคนทะเลาะเรื่องรั้วที่เลื่อนไปหนึ่งศอก จนเกือบฆ่ากัน", kind: "smarts", threat: 50, gold: 6, ok: "คุณวัดเขตใหม่ต่อหน้าทั้งสองคน และทั้งคู่จับมือกัน", fail: "ทั้งคู่โกรธคุณแทน" },
  { name: "สอนหนังสือเด็กกำพร้า", text: "บ้านเด็กกำพร้าต้องการครูหนึ่งฤดู ค่าจ้างน้อยแต่เด็กๆ น่ารัก", kind: "looks", threat: 40, gold: 4, ok: "เด็กทั้งยี่สิบคนเขียนชื่อตัวเองได้ และวาดรูปคุณติดผนัง", fail: "เด็กๆ เล่นซนจนคุณหมดแรง แต่ก็สนุก" },
  { name: "สืบหาโจรขโมยไก่", text: "ไก่ในหมู่บ้านหายทุกคืน ทุกคนสงสัยกันเอง", kind: "smarts", threat: 50, gold: 8, ok: "โจรคือจิ้งจอกแม่ลูกอ่อน คุณย้ายรังมันไปป่าลึก ทั้งหมู่บ้านคืนดีกัน", fail: "คุณกล่าวหาคนผิด และต้องขอโทษทั้งหมู่บ้าน" },
  { name: "ปราบโทรลใต้สะพาน", text: "โทรลตัวหนึ่งเก็บค่าผ่านสะพานเป็นแกะ และเริ่มขึ้นราคาเป็นวัว", kind: "fight", threat: 32, gold: 24, ok: "โทรลกระโดดลงแม่น้ำหนีไป สะพานเปิดให้ทุกคนผ่านฟรี", fail: "โทรลโยนคุณลงแม่น้ำ" },
  { name: "เก็บดอกไม้จันทราบนหน้าผา", text: "หมอยาต้องการดอกไม้ที่บานเฉพาะคืนจันทร์เต็มดวงบนหน้าผาสูง", kind: "luck", threat: 50, gold: 16, ok: "ดอกไม้สีเงินอยู่ในมือคุณ หมอยาให้ยาวิเศษหนึ่งขวดเป็นค่าตอบแทนด้วย", fail: "คืนนั้นเมฆบังจันทร์ ดอกไม้ไม่ยอมบาน" },
  { name: "ไล่ผีในบ้านร้าง", text: "เจ้าของบ้านร้างต้องการขายบ้าน แต่ผีในบ้านไม่ยอมย้ายออก", kind: "looks", threat: 50, gold: 15, ok: "ผีแค่อยากให้มีคนฟังเรื่องของเธอ คุณฟังจนจบ และเธอก็จากไปอย่างสงบ", fail: "ผีโยนจานใส่คุณจนต้องหนีออกมา" },
  { name: "ชิงธงในงานประลองหมู่บ้าน", text: "หมู่บ้านข้างๆ ท้าหมู่บ้านคุณชิงธงในงานประจำปี และคุณถูกเลือกเป็นตัวแทน", kind: "fight", threat: 20, gold: 10, ok: "ธงอยู่ในมือคุณ หมู่บ้านทั้งหมู่บ้านแบกคุณกลับบ้าน", fail: "คุณลื่นล้มต่อหน้าทุกคน" },
  { name: "หาหมอให้ลูกช่างทอผ้า", text: "ลูกของช่างทอผ้าป่วยหนัก และหมอที่เก่งที่สุดอยู่อีกเมือง", kind: "luck", threat: 45, gold: 5, ok: "คุณพาหมอกลับมาทันคืนนั้น เด็กหายดี และช่างทอผ้าทอผ้าคลุมให้คุณ", fail: "หมอไม่อยู่ คุณได้แต่ยามาให้" },
];
const offers = (l: Life): Quest[] => {
  const seed = (l.seed + l.age * 977) >>> 0;
  const r = { rng: seed };
  const pool = QUESTS.slice();
  return [0, 1, 2].map(() => pool.splice(Math.floor(((r.rng = (r.rng * 1103515245 + 12345) >>> 0) / 4294967296) * pool.length), 1)[0]);
};
const questOdds = (l: Life, q: Quest) => (q.kind === "fight" ? fightOdds(l, q.threat) : clamp(0.5 + (l.stats[q.kind] - q.threat) / 120, 0.05, 0.95));
const questChoice = (i: number): Choice => P(
  (l) => { const q = offers(l)[i]; return `${q.name} · ${q.gold} เหรียญทอง`; },
  (l) => questOdds(l, offers(l)[i]),
  (l, c) => { const q = offers(l)[i]; addStanding(l, 2); l.flags.ftQuests = Number(l.flags.ftQuests ?? 0) + 1; return G(`${q.text}\n\n${q.ok}`, { gold: q.gold, fame: 1 })(l, c); },
  (l, c) => { const q = offers(l)[i]; return q.kind === "fight" && chance(l, deathOdds(l, q.threat) * 0.3) ? B("งานง่ายๆ กลายเป็นงานสุดท้าย", { die: "ตายระหว่างทำภารกิจของเมือง" })(l, c) : N(`${q.text}\n\n${q.fail}`, { hp: q.kind === "fight" ? -6 : 0 })(l, c); },
);

// ── สัตว์ในตำนาน ──
interface Beast { id: string; name: string; desc: string; threat: number; reward: number; trophy: string }
export const BEASTS: Beast[] = [
  { id: "stag", name: "กวางเขาทองแห่งป่าหมอก", desc: "กวางที่วิ่งเร็วกว่าลม เขาของมันเป็นทองคำแท้", threat: 35, reward: 60, trophy: "เขากวางทองคำ" },
  { id: "manticore", name: "แมนทิคอร์แห่งเนินทราย", desc: "ตัวสิงโต หางแมงป่อง หน้าเหมือนคนที่กำลังยิ้ม", threat: 50, reward: 90, trophy: "เหล็กในแมนทิคอร์" },
  { id: "kraken", name: "คราเคนแห่งอ่าวมืด", desc: "หนวดยาวเท่าเรือรบ กินเรือมาแล้วสามสิบลำ", threat: 62, reward: 140, trophy: "ฟันคราเคน" },
  { id: "chimera", name: "ไคเมร่าสามหัว", desc: "หัวสิงโต หัวแพะ หัวงู พ่นไฟได้ทั้งสามหัว", threat: 68, reward: 160, trophy: "แผงคอไคเมร่า" },
  { id: "behemoth", name: "เบฮีมอธผู้หลับใหล", desc: "สัตว์ที่ใหญ่จนคนคิดว่าเป็นภูเขา ตื่นทุกร้อยปี", threat: 85, reward: 260, trophy: "เกล็ดเบฮีมอธ" },
  { id: "phoenix", name: "ฟีนิกซ์เพลิงดำ", desc: "ฟีนิกซ์ที่เกิดใหม่จากเถ้าผิดวิธี ไฟของมันเผาได้แม้แต่น้ำ", threat: 92, reward: 300, trophy: "ขนฟีนิกซ์ดำ" },
];
type BeastData = { beasts?: Record<string, string> };
const slainBy = (l: Life, id: string) => (dataOf(l) as unknown as BeastData).beasts?.[id];
const BS = (c: Ctx) => BEASTS.find((b) => b.id === c.bs)!;
function slayBeast(l: Life, b: Beast) {
  const d = dataOf(l) as unknown as BeastData;
  d.beasts = { ...d.beasts, [b.id]: displayName(l) };
  deed(l, `ล่า${b.name}`);
  fl(l).trophies = [...(fl(l).trophies ?? []), b.trophy];
  const w = worldOfLife(l);
  recordChronicle(w, `${displayName(l)}ล่า${b.name}สำเร็จ`);
  if (b.threat >= 80) addLegend(w, { name: displayName(l), deed: `ล่า${b.name}`, lifeId: l.id });
}

// ── บ้าน ──
export const HOMES: { name: string; cost: number; joy: number; desc: string }[] = [
  { name: "บ้านเช่า", cost: 0, joy: 0, desc: "หลังคารั่วนิดหน่อย" },
  { name: "กระท่อมของตัวเอง", cost: 40, joy: 1, desc: "มีสวนผักเล็กๆ หลังบ้าน" },
  { name: "บ้านไม้สองชั้น", cost: 150, joy: 2, desc: "มีห้องให้ทุกคนในครอบครัว" },
  { name: "คฤหาสน์หิน", cost: 500, joy: 3, desc: "มีห้องสมุดและคอกม้า" },
  { name: "ปราสาทเล็กบนเนินเขา", cost: 2200, joy: 4, desc: "มีหอคอยดูดาวและกำแพงของตัวเอง" },
];
export const homeOf = (l: Life) => HOMES[Number(l.flags.ftHome ?? 0)];

const M = (a: Omit<Activity, "world" | "emoji">): Activity => ({ ...a, emoji: "", world: "fantasy" });
const yearly = (k: string) => (l: Life) => Number(l.flags[k] ?? -1) !== l.age;
const ACTS: Activity[] = [
  M({ group: "เมือง", id: "ft_board", name: "กระดานภารกิจของเมือง", desc: "สามงานใหม่ทุกปี · เลือกได้หนึ่งงาน", minAge: 12, available: yearly("ftBoard"), run: (l) => { l.flags.ftBoard = l.age; runEvent(l, "ft.w2.board"); return { text: "" }; } }),
  M({ group: "ผจญภัย", id: "ft_beast", name: "ล่าสัตว์ในตำนาน", desc: "หกตัวในโลก · ล่าได้ครั้งเดียวต่อตัว", minAge: 18, time: 2, available: (l) => BEASTS.some((b) => !slainBy(l, b.id)) && yearly("ftBeast")(l), run: (l) => { l.flags.ftBeast = l.age; runEvent(l, "ft.w2.beasts"); return { text: "" }; } }),
  M({ group: "ชีวิต", id: "ft_home", name: "ขยายบ้าน", desc: "บ้านที่ดีขึ้นให้ความสุขทุกปี", minAge: 18, available: (l) => Number(l.flags.ftHome ?? 0) < HOMES.length - 1, run: (l) => { runEvent(l, "ft.w2.home"); return { text: "" }; } }),
];

export const WORLD2_EVENTS: GameEvent[] = [
  omenEvent,
  SCENE("ft.w2.board", "กระดานภารกิจ", "กระดาษประกาศสามแผ่นปักอยู่บนกระดานไม้หน้าศาลากลาง", [questChoice(0), questChoice(1), questChoice(2), C("ไม่รับงานปีนี้", N("คุณอ่านประกาศจบแล้วเดินผ่านไป"))]),
  SCENE("ft.w2.beasts", "สัตว์ในตำนาน", "นักล่ารุ่นเก่าเล่าถึงสัตว์หกตัวที่ไม่เคยมีใครล่าได้", [
    ...BEASTS.map((b): Choice => C((l) => `${b.name} · ${b.desc} · ชนะ ${Math.round(fightOdds(l, b.threat) * 100)}%`, (l) => { runEvent(l, "ft.w2.hunt", { bs: b.id }); return { text: `คุณออกตามรอย${b.name}` }; }, { show: (l) => !slainBy(l, b.id) })),
    C("ยังไม่ออกล่า", N("บางตำนานควรรอให้พร้อมกว่านี้")),
  ]),
  SCENE("ft.w2.hunt", "การล่า", (_l, c) => `${BS(c).name}ยืนอยู่ตรงหน้าคุณ ${BS(c).desc}`, [
    P("สู้ตรงหน้า", (l, c) => fightOdds(l, BS(c).threat), (l, c) => { const b = BS(c); slayBeast(l, b); return BIG(`${b.name}ล้มลง คุณตัด${b.trophy}กลับไปเป็นหลักฐาน`, { fame: Math.round(b.threat / 4), gold: b.reward, body: 10 })(l, c); }, (l, c) => (chance(l, deathOdds(l, BS(c).threat) * 0.7) ? B("ตำนานบทนี้จบลงพร้อมกับคุณ", { die: `ถูก${BS(c).name}สังหาร` })(l, c) : B("มันแข็งแกร่งเกินไป คุณถอยหนีพร้อมแผลที่จะเป็นแผลเป็นไปตลอดชีวิต", { hp: -18 })(l, c)), { tone: "danger" }),
    techChoice((_l, c) => BS(c).threat, () => (l, c) => { const b = BS(c); slayBeast(l, b); return BIG(`ท่าไม้ตายของคุณจบ${b.name}ในพริบตา คุณตัด${b.trophy}กลับไป`, { fame: Math.round(b.threat / 4), gold: b.reward, body: 10 })(l, c); }, B("ท่าไม้ตายพลาด มันสวนกลับจนคุณกระเด็น", { hp: -18 })),
    K("วางกับดักแล้วรอ", "smarts", 60, (l, c) => { const b = BS(c); if (b.threat >= 80) return N(`${b.name}ใหญ่เกินกว่ากับดักจะหยุดได้ มันเหยียบกับดักพังแล้วเดินต่อ`)(l, c); slayBeast(l, b); return BIG(`${b.name}ติดกับดักของคุณ ตำนานจบลงด้วยปัญญา`, { fame: Math.round(b.threat / 5), gold: b.reward })(l, c); }, N("มันฉลาดกว่ากับดักของคุณ")),
    C("ถอยกลับ", N("คุณมองมันจากที่ไกลแล้วถอยกลับอย่างเงียบๆ")),
  ]),
  SCENE("ft.w2.home", "ขยายบ้าน", (l) => `ตอนนี้คุณอยู่${homeOf(l).name} · ${homeOf(l).desc}`, [
    ...HOMES.map((h, i): Choice => PAY(`${h.name} · ${h.desc}`, h.cost, G(`คุณย้ายเข้า${h.name} ทุกคนในบ้านยิ้มกว้าง`, { joy: 8 }, (l) => { l.flags.ftHome = i; }), { show: (l) => i === Number(l.flags.ftHome ?? 0) + 1 })),
    C("อยู่ที่เดิมก่อน", N("บ้านเดิมก็ยังอบอุ่นดี")),
  ]),
];

export function loadWorld2() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push((l) => {
    if (l.worldId !== "fantasy" || !l.ft || !l.alive) return;
    const d = dataOf(l) as unknown as OmenData, w = worldOfLife(l);
    // ลางใหม่เกิดขึ้นในโลกปีละราว 7% อยู่หนึ่งถึงสามปี
    if (!omenOf(l) && chance(l, 0.07)) {
      const o = pick(l, OMENS);
      d.omen = { id: o.id, name: o.name, desc: o.desc, year: w.year, until: w.year + randInt(l, 0, 2) };
      recordChronicle(w, `${o.name}เริ่มขึ้น`);
    }
    const om = omenOf(l);
    if (om?.id === "surge" && canCast(l)) fl(l).magic += 5;
    if (om?.id === "winter") { addStat(l, "health", -2); addMoney(l, -3 * GOLD); }
    if (om?.id === "golden") addMoney(l, 10 * GOLD);
    const h = homeOf(l);
    if (h.joy) addStat(l, "happiness", h.joy);
  });
}
