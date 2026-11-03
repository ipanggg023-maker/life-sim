// โรงเรียน กิลด์นักผจญภัย อาชีพ และกิจกรรมประจำปี
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Ctx, GameEvent } from "../../engine/events";
import { runEvent } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, addStat, checkChance, createPerson, shortName } from "../../engine/util";
import { CAREERS } from "../core/careers";
import { B, BIG, C, E, G, GOLD, K, N, P, PAY, SCENE, type Res } from "./kit";
import { GUILD_RANKS, canCast, deathOdds, fightOdds } from "./power";
import { ELEMENTS, learnSpell, spellChoices } from "./magic";
import { addStanding, fl, kingdomsOf, deed, type Element } from "./state";

export interface School { id: string; name: string; focus: string; odds: (l: Life) => number; fee: number; body: number; magic: number }
export const SCHOOLS: School[] = [
  { id: "arcanvale", name: "สถาบันเวทอาร์คานเวล", focus: "เวทมนตร์", fee: 60, body: 2, magic: 14, odds: (l) => 0.1 + fl(l).potential * 0.17 + (l.stats.smarts - 50) / 200 },
  { id: "steelcrest", name: "สำนักดาบสตีลเครสต์", focus: "ดาบและร่างกาย", fee: 30, body: 14, magic: 0, odds: (l) => 0.35 + (l.stats.health - 50) / 120 + (l.stats.luck - 50) / 300 },
  { id: "lionheart", name: "วิทยาลัยหลวงไลออนฮาร์ต", focus: "ดาบและเวทมนตร์", fee: 120, body: 8, magic: 8, odds: (l) => 0.25 + (l.stats.smarts - 50) / 200 + ({ poor: 0, middle: 0.05, rich: 0.2, elite: 0.35 })[l.wealth] },
  { id: "mercy", name: "วิหารเยียวยาเมอร์ซี", focus: "การรักษาและเวทแสง", fee: 20, body: 2, magic: 10, odds: (l) => 0.4 + (l.stats.smarts - 50) / 250 + (l.stats.happiness - 50) / 250 },
  { id: "beastwarden", name: "คอกนักฝึกสัตว์เบสต์วอร์เดน", focus: "สัตว์เวทและการต่อสู้คู่กาย", fee: 30, body: 8, magic: 5, odds: (l) => 0.35 + (l.stats.health - 50) / 200 + (l.stats.luck - 50) / 200 + (fl(l).race === "beastfolk" ? 0.3 : 0) },
];
export const schoolOf = (l: Life) => SCHOOLS.find((s) => s.id === fl(l).school);
const MATERIALS: [string, number, number][] = [["ไม้ฮอลลี", 1, 40], ["ไม้เถ้า", 2, 120], ["กระดูกนกฟีนิกซ์", 3, 400]];

const WORLD_CAREERS = [
  { id: "ft_farmer", name: "ชาวนา", emoji: "", minAge: 14, key: "health", dc: 20, baseSalary: 6000, titles: ["ลูกจ้างไร่", "ชาวนา", "ชาวนาเจ้าของที่", "หัวหน้าหมู่บ้าน", "เจ้าที่ดิน"] },
  { id: "ft_smith", name: "ช่างตีเหล็ก", emoji: "", minAge: 14, key: "health", dc: 40, baseSalary: 11000, titles: ["เด็กฝึกงาน", "ช่างตีเหล็ก", "ช่างชำนาญ", "ช่างใหญ่", "ช่างตีดาบหลวง"] },
  { id: "ft_merchant", name: "พ่อค้า", emoji: "", minAge: 16, key: "smarts", dc: 45, baseSalary: 14000, titles: ["เด็กขนของ", "พ่อค้าแผงลอย", "พ่อค้าเมือง", "เจ้าของกองคาราวาน", "เจ้าสัวการค้า"] },
  { id: "ft_scholar", name: "นักปราชญ์", emoji: "", minAge: 18, key: "smarts", dc: 55, baseSalary: 12000, titles: ["ผู้ช่วยหอสมุด", "นักคัดลอก", "นักวิจัย", "ปราชญ์", "ปราชญ์หลวง"] },
  { id: "ft_soldier", name: "ทหาร", emoji: "", minAge: 16, key: "health", dc: 40, baseSalary: 9000, titles: ["พลทหาร", "สิบเอก", "ร้อยเอก", "ผู้บัญชาการ", "แม่ทัพ"] },
  { id: "ft_inn", name: "เจ้าของโรงเตี๊ยม", emoji: "", minAge: 18, key: "looks", dc: 45, baseSalary: 10000, titles: ["เด็กเสิร์ฟ", "คนครัว", "ผู้จัดการร้าน", "เจ้าของร้าน", "เจ้าของเครือโรงเตี๊ยม"] },
  { id: "ft_mage", name: "นักเวทรับจ้าง", emoji: "", minAge: 16, key: "smarts", dc: 50, baseSalary: 17000, titles: ["ผู้ช่วยนักเวท", "นักเวทรับจ้าง", "นักเวทเมือง", "นักเวทประจำราชสำนัก", "ที่ปรึกษาเวทหลวง"], needs: (l: Life) => (canCast(l) ? undefined : "ต้องร่ายเวทได้") },
  { id: "ft_knight", name: "อัศวิน", emoji: "", minAge: 18, key: "health", dc: 55, baseSalary: 16000, titles: ["ทหารม้า", "อัศวิน", "อัศวินเกียรติยศ", "ผู้บัญชาการอัศวิน", "จอมอัศวิน"], needs: (l: Life) => (fl(l).bodyRank >= 1 ? undefined : "ต้องเป็นนักสู้ขึ้นไป") },
];

const M = (a: Omit<Activity, "world">): Activity => ({ ...a, world: "fantasy" });
const school = (l: Life) => !!fl(l).school && !fl(l).graduated;
const free = (l: Life) => !fl(l).school || !!fl(l).graduated;
const CONTRACT_THREAT = [0, 10, 25, 42, 60, 80];
const MONSTERS: { name: string; weak: Element; strong: Element }[] = [
  { name: "ซาลาแมนเดอร์เพลิง", weak: "water", strong: "fire" }, { name: "โกเลมศิลา", weak: "wind", strong: "earth" }, { name: "ภูตหนองน้ำ", weak: "earth", strong: "water" },
  { name: "ฮาร์ปี้", weak: "fire", strong: "wind" }, { name: "ซอมบี้ฝูงใหญ่", weak: "light", strong: "dark" }, { name: "อัศวินเงา", weak: "light", strong: "dark" },
  { name: "ไวเวิร์นหนุ่ม", weak: "water", strong: "fire" }, { name: "ราชาก็อบลิน", weak: "fire", strong: "earth" },
];
const monster = (c: Ctx) => MONSTERS[Number(c.mon ?? 0)];
const threatOf = (l: Life) => CONTRACT_THREAT[fl(l).guild];
/** พลาดงานกิลด์: เจ็บหรือตาย · คนในปาร์ตี้รับดาบแทนได้ บางครั้งไม่รอด */
const partyCost = (l: Life): string => {
  const party = l.people.filter((p) => p.alive && p.tags?.some((t) => t.startsWith("party:")));
  if (!party.length || !chance(l, 0.25)) return "";
  const p = pick(l, party);
  if (chance(l, 0.18)) { p.alive = false; addStat(l, "happiness", -15); return ` ${shortName(p)}ยืนบังคุณจนวินาทีสุดท้าย และไม่ได้กลับมาด้วยกัน`; }
  p.bond = Math.min(100, p.bond + 8);
  return ` ${shortName(p)}ลากคุณออกมาทั้งที่ตัวเองก็เลือดโชก`;
};
const hurt = (text: string, extra: number): Res => (l, c) => (chance(l, deathOdds(l, CONTRACT_THREAT[fl(l).guild] + extra)) ? B("ป้ายกิลด์ของคุณถูกส่งกลับบ้าน", { die: "ตายระหว่างรับงานกิลด์" })(l, c) : B(text + partyCost(l), { hp: -12 })(l, c));

const ACTS: Activity[] = [
  M({ group: "ฝึกฝน", id: "ft_train", emoji: "", name: "ฝึกดาบและร่างกาย", desc: "พลังกาย +", minAge: 6, run: (l) => { const d = randInt(l, 6, 12) + (fl(l).race === "orc" ? 3 : 0); fl(l).body += d; addStat(l, "health", 1); return { text: "คุณซ้อมจนฝ่ามือด้าน", kind: "good" }; } }),
  M({ group: "ฝึกฝน", id: "ft_study", emoji: "", name: "ฝึกเวทมนตร์", desc: "พลังเวท + · ต้องร่ายได้", minAge: 6, available: canCast, run: (l) => { fl(l).magic += randInt(l, 5, 9) + fl(l).potential * 2 + (fl(l).race === "elf" ? 2 : 0); return { text: "ปลายคทาสว่างนานขึ้นอีกหนึ่งลมหายใจ", kind: "good" }; } }),
  M({ group: "ฝึกฝน", id: "ft_wand", emoji: "", name: "ซื้อคทา", desc: "ใครก็ร่ายเวทได้ถ้ามีคทา", minAge: 10, available: (l) => (fl(l).wand?.quality ?? 0) < 3, run: (l) => { runEvent(l, "ft.wandshop"); return { text: "" }; } }),
  M({ group: "ชีวิต", id: "ft_rest", emoji: "", name: "พักผ่อน", desc: "ความสุข + สุขภาพเล็กน้อย", minAge: 3, run: (l) => { addStat(l, "happiness", randInt(l, 3, 6)); addStat(l, "health", 1); return { text: "คุณนอนกลางวันใต้ต้นโอ๊กทั้งบ่าย", kind: "good" }; } }),
  M({ group: "ชีวิต", id: "ft_healer", emoji: "", name: "หาหมอรักษา", desc: "สุขภาพ +", minAge: 0, cost: 5 * GOLD, run: (l) => { addMoney(l, -5 * GOLD); addStat(l, "health", randInt(l, 8, 15)); return { text: "น้ำยาขมจนหน้าเบ้ แต่คุณลุกเดินได้", kind: "good" }; } }),
  M({ group: "ชีวิต", id: "ft_tavern", emoji: "", name: "นั่งโรงเตี๊ยม", desc: "ความสุข + อาจได้เพื่อน", minAge: 16, cost: 2 * GOLD, run: (l) => { addMoney(l, -2 * GOLD); addStat(l, "happiness", 4); if (chance(l, 0.35)) { const p = createPerson(l, "friend", { age: Math.max(16, l.age + randInt(l, -6, 6)), bond: 45 }); return { text: `คุณกับ${shortName(p)}คุยกันจนร้านปิด`, kind: "good" }; } return { text: "นักกวีพเนจรร้องเพลงเรื่องมังกรได้เพี้ยนแต่สนุก" }; } }),
  M({ group: "ชีวิต", id: "ft_match", emoji: "", name: "มองหาคู่ครอง", desc: "งานเต้นรำและตลาดนัด", minAge: 18, available: (l) => !l.people.some((p) => p.alive && (p.relation === "spouse" || p.relation === "partner")), odds: (l) => checkChance(l, "looks", 45), run: (l) => { if (chance(l, checkChance(l, "looks", 45))) { const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: Math.max(18, l.age + randInt(l, -3, 3)), bond: 55 }); return { text: `คุณเต้นรำกับ${shortName(p)}จนดนตรีเลิก`, kind: "good" }; } return { text: "คุณเหยียบเท้าคู่เต้นรำถึงสามครั้ง" }; } }),
  M({ group: "ชีวิต", id: "ft_move", emoji: "", name: "ย้ายไปอาณาจักรอื่น", desc: "เปลี่ยนที่อยู่", minAge: 16, cost: 10 * GOLD, run: (l) => { addMoney(l, -10 * GOLD); const k = pick(l, kingdomsOf(l).filter((x) => x.id !== fl(l).kingdom)); fl(l).kingdom = k.id; return { text: `คุณเก็บของย้ายไป${k.name}`, kind: "good" }; } }),
  M({ group: "การศึกษา", id: "ft_apply", emoji: "", name: "สอบเข้าโรงเรียน", desc: "สมัครได้จนอายุ 20", minAge: 11, available: (l) => !fl(l).school && l.age <= 20, run: (l) => { runEvent(l, "ft.school_apply"); return { text: "" }; } }),
  M({ group: "การศึกษา", id: "ft_school", emoji: "", name: "ชีวิตในโรงเรียน", desc: "เรียน ประลอง และเพื่อนร่วมรุ่น", minAge: 11, available: school, run: (l) => { runEvent(l, "ft.school_day"); return { text: "" }; } }),
  M({ group: "ผจญภัย", id: "ft_guild", emoji: "", name: "สมัครกิลด์นักผจญภัย", desc: "เริ่มที่ขั้นเหล็ก", minAge: 14, available: (l) => fl(l).guild === 0 && free(l), run: (l) => { fl(l).guild = 1; return { text: "เจ้าหน้าที่กิลด์ยื่นป้ายเหล็กให้ \"อย่าตายในเดือนแรกก็พอ\"", kind: "good" }; } }),
  M({ group: "ผจญภัย", id: "ft_contract", emoji: "", name: "รับงานจากกิลด์", desc: "อันตรายตามขั้น", minAge: 14, time: 2, available: (l) => fl(l).guild > 0, odds: (l) => fightOdds(l, CONTRACT_THREAT[fl(l).guild]), run: (l) => { runEvent(l, "ft.contract", { mon: randInt(l, 0, MONSTERS.length - 1) }); return { text: "" }; } }),
];

export const PLACE_EVENTS: GameEvent[] = [
  SCENE("ft.wandshop", "ร้านคทา", "ร้านคทาเก่าอบอวลด้วยกลิ่นขี้เลื่อย เจ้าของร้านวางคทาเรียงบนกำมะหยี่", MATERIALS.map(([n, q, g]) => PAY(`คทา${n}`, g, G(`คทาอุ่นขึ้นในมือคุณทันที มันเลือกคุณแล้ว`, { joy: 3 }, (l) => { fl(l).wand = { name: `คทา${n}`, quality: q, material: n }; }), { show: (l) => (fl(l).wand?.quality ?? 0) < q })).concat(C("ดูเฉยๆ", N("คุณเดินออกจากร้านมือเปล่า")))),

  E("ft.school_letter", [11, 12], (l) => `จดหมายจากโรงเรียนต่างๆ มาถึงบ้าน ทุกแห่งเปิดสอบปีนี้${fl(l).potential >= 3 ? " และครูเวทคนหนึ่งเขียนชื่อคุณเองบนซอง" : ""}`, [C("ไปสอบเข้า", (l) => { runEvent(l, "ft.school_apply"); return { text: "คุณเก็บกระเป๋าเดินทางไปเมืองที่มีโรงเรียน" }; }), C("อยู่บ้านต่อ", N("คุณวางจดหมายไว้บนหิ้ง ชีวิตมีทางอื่นอีกมาก"))], { forced: true, title: "จดหมายเชิญ" }),
  SCENE("ft.school_apply", "สอบเข้า", "ผู้สมัครเรียงแถวยาวถึงประตู คุณจะลองที่ไหน", [
    ...SCHOOLS.map((s) => P(`${s.name} · ${s.focus}`, s.odds, BIG(`ชื่อคุณอยู่ในประกาศ! คุณได้เข้า${s.name}`, { joy: 10, fame: 2 }, (l) => { const f = fl(l); f.school = s.id; f.schoolSince = l.age; f.classScore = 50; const r = createPerson(l, "rival", { age: l.age, bond: 30 }); r.job = `เพื่อนร่วมรุ่นที่${s.name}`; f.rivalId = r.id; f.rivalPower = 12 + randInt(l, 0, 8); f.rivalPeak = randInt(l, 35, 95); if (s.magic >= 8) { f.wand ??= { name: "คทาประจำโรงเรียน", quality: 1, material: "ไม้" }; learnSpell(l, `${f.element ?? "fire"}1`); } l.flags.ftMark = true; }), N(`คุณสอบ${s.name}ไม่ผ่าน ยังมีทางอื่นเสมอ`, { joy: -4 }))),
    C("เปลี่ยนใจไม่สอบ", N("คุณเดินออกจากแถว")),
  ]),
  SCENE("ft.school_day", "ชีวิตในโรงเรียน", (l) => `ปีนี้ที่${schoolOf(l)?.name ?? "โรงเรียน"} คุณจะทุ่มให้อะไร`, [
    C("ตั้งใจเรียนในห้อง", G("คุณจดเลกเชอร์จนหมึกหมดสองขวด", { iq: 2 }, (l) => { const s = schoolOf(l)!; fl(l).body += s.body; fl(l).magic += s.magic; })),
    P("ลงประลองประจำปี", (l) => fightOdds(l, 12 + (l.age - 11) * 3), G("คุณชนะคู่ปรับต่อหน้าทั้งโรงเรียน", { fame: 4, joy: 4 }, (l) => { const s = schoolOf(l)!; fl(l).body += s.body; fl(l).magic += s.magic; }), N("คุณแพ้ แต่เรียนรู้ท่าใหม่จากรอยช้ำ", { hp: -2, body: 3 })),
    K("แอบสำรวจห้องต้องห้าม", "luck", 55, G("หลังชั้นหนังสือมีทางลับและสมุดบันทึกของอาจารย์ใหญ่รุ่นแรก", { iq: 3, magic: 6 }), B("อาจารย์ยืนรออยู่ปลายทางเดิน คุณถูกทำโทษขัดชุดเกราะทั้งเดือน", { joy: -3 })),
    C("ออกไปเที่ยวกับเพื่อน", G("พวกคุณแอบขึ้นหลังคาหอพักดูดาวตก", { joy: 6 })),
  ]),
  E("ft.graduate", [15, 40], (l) => `หลังหลายปีที่${schoolOf(l)?.name} ถึงวันจบการศึกษาแล้ว`, [C("รับป้ายจบการศึกษา", BIG("อาจารย์ใหญ่ส่งป้ายให้ พร้อมบอกว่าประตูโรงเรียนจะเปิดให้คุณเสมอ", { fame: 4, joy: 6 }, (l) => { const s = schoolOf(l)!; fl(l).graduated = true; fl(l).body += s.body * 2; fl(l).magic += s.magic * 2; deed(l, `จบจาก${s.name}`); }))], { when: (l) => school(l) && l.age - Number(fl(l).schoolSince) >= 5, forced: true, maxTimes: 1, title: "จบการศึกษา" }),

  SCENE("ft.contract", "งานจากกิลด์", (l, c) => `กระดานประกาศของกิลด์ขั้น${GUILD_RANKS[fl(l).guild]}: ${monster(c).name}${l.stats.smarts >= 50 ? ` · จุดอ่อนธาตุ${ELEMENTS[monster(c).weak].name}` : " · ไม่รู้จุดอ่อน"}`, [
    P("กำจัดสัตว์อสูรด้วยอาวุธ", (l) => fightOdds(l, threatOf(l)), G("คุณนำเขี้ยวของมันกลับมาขึ้นเงินรางวัล", { fame: 1 }, (l) => reward(l, 1)), hurt("มันแข็งแกร่งกว่าที่ประกาศบอก คุณหนีกลับมาพร้อมแผล", 0)),
    ...spellChoices(threatOf, (_l, c) => monster(c).weak, (_l, c) => monster(c).strong, (sp) => G(`${sp.name}ของคุณจัดการมันได้เรียบร้อย`, { fame: 1, magic: 3 }, (l) => reward(l, 1.1)), hurt("เวทของคุณทำอะไรมันแทบไม่ได้", 0)),
    P("คุ้มกันกองคาราวาน", (l) => fightOdds(l, CONTRACT_THREAT[fl(l).guild] - 6), G("กองคาราวานถึงปลายทางครบทุกเล่ม", {}, (l) => reward(l, 0.8)), hurt("โจรมามากกว่าที่คิด สินค้าหายไปครึ่งหนึ่ง", -6)),
    K("สำรวจดันเจี้ยนเก่า", "luck", 50, G("คุณเจอห้องที่ยังไม่มีใครแตะ", { magic: 4, body: 4 }, (l) => reward(l, 1.4)), hurt("กับดักหลังประตูยังทำงานได้ดีเกินไป", 8)),
    C("เลือกงานง่ายๆ ปีนี้", G("คุณตามหาแมวของคุณนายให้ แล้วได้ค่าจ้างพอกินข้าว", { gold: 4 })),
  ]),
];

function reward(l: Life, mul: number) {
  const f = fl(l);
  addMoney(l, Math.round((10 + f.guild * 18) * mul) * GOLD);
  f.body += 9; f.magic += canCast(l) ? 5 : 0;
  f.contracts++;
  addStanding(l, 1);
  if (f.contracts >= f.guild * 6 && f.guild < 5) {
    f.guild++; f.contracts = 0;
    deed(l, `นักผจญภัยขั้น${GUILD_RANKS[f.guild]}`);
  }
}

export function loadPlaces() {
  ACTIVITIES.push(...ACTS);
  for (const c of WORLD_CAREERS) CAREERS.push({ ...c, key: c.key as "health", world: "fantasy" });
}
