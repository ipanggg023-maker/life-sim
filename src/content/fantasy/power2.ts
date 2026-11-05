// พลังชุดที่สอง: ทะลวงขั้นด้วยการทดสอบจริง · อาจารย์ที่สอนท่าต่างสาย · ท่าที่ตั้งชื่อเอง · ความมืดในตัว · ยา · เก็บตัวฝึก
// อาวุธที่มีประวัติ · ฝีมือช่างและตำรา · ร่างกายที่ร่วงโรยและเวทที่ลึกขึ้น · พลังขั้นตำนานที่โลกต้องหันมามอง
// แผนอยู่ที่ design/GRILL.md ส่วนที่ 6 (Release 8)
import { ACTIVITIES, activityFilters, type Activity } from "../../engine/activities";
import { getEvent, type Choice, type Ctx, type GameEvent } from "../../engine/events";
import { choiceHooks, deathSaves, kill, oddsHooks, runEvent, yearHooks } from "../../engine/game";
import { remember } from "../../engine/npc";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addStat, clamp, createPerson, log } from "../../engine/util";
import { B, BIG, C, E, G, GOLD, K, N, P, PAY, SCENE } from "./kit";
import { BODY_RANKS, MAGIC_RANKS, MASTER, bodyCap, breakOdds, canBreak, combatHooks, fightOdds, magicCap, needXp } from "./power";
import { broke, failBreak } from "./powerplus";
import { STYLES, STYLE_IDS, type StyleId } from "./styles";
import { addStanding, deed, fl, homeKingdom } from "./state";
import { stageAge } from "./folk";
import { lean } from "./persona";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;

// ───────────── ทะลวงขั้นด้วยการทดสอบ ─────────────
/** ความแรงของบททดสอบตามขั้นที่จะไป */
const trialThreat = (l: Life, track: "body" | "magic") => 10 + ((track === "body" ? fl(l).bodyRank : fl(l).magicRank) + 1) * 9;
/** ทะลวงแบบเอาชีวิตเข้าแลก: โอกาสสูง แต่พลาดแล้วอาจตาย (ทางเดียวในบททดสอบที่ตายได้) */
export const RECKLESS_DEATH = 0.4;
export const RECKLESS_BONUS = 0.18;
export const PLAIN_PENALTY = 0.15;
function trials(track: "body" | "magic"): Choice[] {
  const ok = (text: string) => (l: Life, c: Ctx) => BIG(`${text} ${broke(l, track)}`, { joy: 6, fame: 2 })(l, c);
  return [
    P(track === "body" ? "ขอให้อาจารย์ประลองเป็นบททดสอบ" : "ให้จอมเวทอาวุโสคุมวงเวทให้", (l) => clamp(breakOdds(l, track) + 0.05 + (fightOdds(l, trialThreat(l, track)) - 0.5) / 5, 0.08, 0.92), ok(track === "body" ? "อาจารย์ลดดาบลงก่อนคุณ" : "วงเวทของคุณสว่างกว่าของจอมเวทอาวุโส"), failBreak(track, 4), { tone: "special" }),
    P(track === "body" ? "ออกไปล้มอสูรตัวหนึ่งด้วยตัวเอง" : "ไปเปิดวงเวทที่ซากวิหารร้าง", (l) => clamp(breakOdds(l, track) + 0.1 + (fightOdds(l, trialThreat(l, track) + 6) - 0.5) / 4, 0.08, 0.94), ok(track === "body" ? "อสูรล้มลงตรงหน้า และกำแพงในตัวคุณก็พังตาม" : "มานาเก่าในซากวิหารไหลเข้าตัวคุณ"), failBreak(track, 8), { tone: "special" }),
    P("นั่งสมาธิจนกว่ากำแพงจะแตก", (l) => clamp(breakOdds(l, track) + (l.stats.smarts - 50) / 200 + (l.stats.happiness - 50) / 300, 0.08, 0.9), ok("เช้าวันที่เจ็ด คุณลืมตาขึ้นแล้วรู้ว่าทุกอย่างเปลี่ยนไป"), (l, c) => failBreak(track, 0)(l, c), { tone: "special" }),
    {
      ...P("ทะลวงแบบเอาชีวิตเข้าแลก", (l) => clamp(breakOdds(l, track) + RECKLESS_BONUS, 0.2, 0.97), ok("คุณผ่านมาได้ทั้งที่ร่างกายแทบแหลกเป็นผุยผง"), (l, c) => (chance(l, RECKLESS_DEATH) ? B("ร่างกายรับพลังไม่ไหว", { die: "ทะลวงขั้นแบบเอาชีวิตเข้าแลก" })(l, c) : failBreak(track, 15)(l, c))),
      tone: "danger", survival: (l) => 1 - (1 - clamp(breakOdds(l, track) + RECKLESS_BONUS, 0.2, 0.97)) * RECKLESS_DEATH,
    },
  ];
}

// ───────────── อาจารย์และท่าที่ตั้งชื่อเอง ─────────────
const otherStyle = (l: Life): StyleId => pick(l, STYLE_IDS.filter((s) => s !== fl(l).style));
export const learnedOf = (l: Life) => fl(l).learned ?? [];
const MASTER_EV: GameEvent = E("ft.pw.master", [14, 400], (l, c) => `ปรมาจารย์${STYLES[c.style as StyleId].name}คนหนึ่งเดินทางผ่าน${homeKingdom(l).name} เขาว่ากันว่าไม่เคยรับศิษย์ที่ไม่ผ่านบททดสอบของเขา`, [
  P("ขอรับบททดสอบ", (l) => fightOdds(l, 24 + fl(l).bodyRank * 6), BIG((_l, c) => { const s = STYLES[c.style as StyleId]; return `ปรมาจารย์พยักหน้าครั้งเดียว แล้วสอนท่า「${s.techs[1]}」ของ${s.name}ให้คุณทั้งฤดูหนาว`; }, { body: 15 }, (l, c) => {
    const s = STYLES[c.style as StyleId], f = fl(l);
    const old = l.people.find((p) => p.alive && p.tags?.includes("master_of"));
    if (old) { remember(l, old, "left_master", "คุณไปเป็นศิษย์คนอื่น", 3, { grudge: 25, respect: -10 }); old.tags = (old.tags ?? []).filter((t) => t !== "master_of"); }
    const m = createPerson(l, "ally", { age: randInt(l, 50, 80), bond: 55, job: `ปรมาจารย์${s.name}` }); m.tags = [...(m.tags ?? []), "master_of", "mentor"];
    f.learned = [...new Set([...learnedOf(l), `${s.techs[1]} (${s.name})`])];
  }), N("ปรมาจารย์ส่ายหน้า \"กลับมาอีกห้าปี\"", { body: 3 })),
  C("ไม่ขอเป็นศิษย์ใคร", N("คุณมองเขาเดินจากไป และกลับไปฝึกแบบของตัวเอง")),
], { title: "ปรมาจารย์พเนจร", weight: 10, maxTimes: 3, when: (l) => on(l) && fl(l).bodyRank >= 1 && !!fl(l).style, prepare: (l) => ({ style: otherStyle(l) }) });
const PARTS_A = ["ดาบ", "เงา", "พายุ", "ดวงดาว", "เพลิง", "จันทร์"], PARTS_B = ["ไร้รอย", "ผ่าฟ้า", "กลืนแสง", "พันปี", "ไม่หวนกลับ", "ใต้น้ำแข็ง"];
const OWN_TECH: GameEvent = E("ft.pw.own_tech", [20, 400], "หลังฝึกมาทั้งชีวิต ท่าทุกท่าที่คุณรู้เริ่มรวมกันเป็นท่าเดียวที่ไม่มีในตำราของใคร มันต้องการชื่อ", [
  ...[0, 1, 2].map((i) => C((l) => `ตั้งชื่อว่า「${nameOf(l, i)}」`, BIG((l) => `ท่า「${nameOf(l, i)}」เป็นของคุณคนเดียวในโลกนี้ ศิษย์รุ่นหลังจะพยายามเลียนแบบมันไปอีกร้อยปี`, { fame: 4, joy: 6 }, (l) => { fl(l).myTech = nameOf(l, i); deed(l, `คิดค้นท่า「${nameOf(l, i)}」`); }))),
], { title: "ท่าที่เป็นของคุณ", forced: true, maxTimes: 1, when: (l) => on(l) && fl(l).bodyRank >= MASTER && !fl(l).myTech });
const nameOf = (l: Life, i: number) => `${PARTS_A[(l.id.length + i * 2) % PARTS_A.length]}${PARTS_B[(l.age + i) % PARTS_B.length]}`;

// ───────────── ความมืดในตัว ─────────────
export const corruptionOf = (l: Life) => fl(l).corruption ?? 0;
export const corrupt = (l: Life, d: number) => { const f = fl(l); f.corruption = clamp((f.corruption ?? 0) + d, 0, 100); };
export const CORRUPT_WORDS = (n: number) => (n >= 80 ? "ความมืดกลืนคุณไปเกินครึ่งแล้ว" : n >= 50 ? "ความมืดในตัวคุณเริ่มมองเห็นจากภายนอก" : n >= 25 ? "มีเงาบางอย่างอยู่ในตัวคุณ" : "");
const DARK: GameEvent[] = [
  E("ft.pw.inquisitor", [16, 900], "นักไต่สวนของศาสนจักรเคาะประตู เขาได้กลิ่นเวทต้องห้ามจากบ้านคุณมาตั้งแต่ปลายถนน", [
    P("หนีไปก่อนรุ่งเช้า", (l) => 0.45 + l.stats.luck / 200, N("คุณข้ามพรมแดนไปได้ทันเวลา และทิ้งทุกอย่างไว้ข้างหลัง", { joy: -5, gold: -10 }), B("นักไต่สวนรออยู่ที่ประตูเมือง คุณถูกขังสามเดือน", { hp: -8, joy: -8 })),
    P("สู้กับเขา", (l) => fightOdds(l, 34), G("นักไต่สวนล้มลง แต่ศาสนจักรจะส่งคนมาอีก", { fame: 2 }, (l) => { corrupt(l, 5); addStanding(l, -5); }), B("คุณแพ้ และถูกตีตราที่หลังมือ", { hp: -10 }, (l) => addStanding(l, -8))),
    PAY("ยอมรับโทษและสารภาพบาป", 20, G("นักไต่สวนให้คุณสวดภาวนาสามเดือน ความมืดในตัวเบาลง", { joy: -2 }, (l) => corrupt(l, -25))),
  ], { title: "นักไต่สวน", forced: true, maxTimes: 0, when: (l) => on(l) && corruptionOf(l) >= 50 && l.age - Number(l.flags.ftInqAt ?? -99) >= 6 }),
  E("ft.pw.lose_control", [16, 900], "คืนนี้ความมืดในตัวคุณตื่นขึ้นเอง มือของคุณเคลื่อนไหวก่อนที่ใจจะสั่ง และมีคนที่คุณรักยืนอยู่ตรงหน้า", [
    K("ดึงตัวเองกลับมาด้วยใจทั้งหมด", "smarts", 60, G("คุณกัดลิ้นจนเลือดออก แล้วความมืดก็ถอยกลับไป คุณนั่งร้องไห้อยู่ทั้งคืน", { joy: -4 }, (l) => corrupt(l, -10)), B("เมื่อรู้ตัวอีกครั้ง บ้านพังไปครึ่งหลัง และคนที่คุณรักมองคุณด้วยความกลัว", { joy: -10 }, (l) => { const p = l.people.find((x) => x.alive && ["spouse", "child", "partner"].includes(x.relation)); if (p) remember(l, p, "dark", "คุณเกือบทำร้ายเขาตอนความมืดครอบงำ", 3, { fear: 40, love: -20 }); })),
  ], { title: "ความมืดที่ตื่นขึ้น", forced: true, maxTimes: 0, when: (l) => on(l) && corruptionOf(l) >= 80 && l.age - Number(l.flags.ftDarkAt ?? -99) >= 5 }),
];

// ───────────── ยา ─────────────
export const POTIONS: Record<"heal" | "strength" | "life", { name: string; price: number; desc: string }> = {
  heal: { name: "ยาสมานแผล", price: 10, desc: "ดื่มเองเมื่อสุขภาพต่ำกว่า 30 · สุขภาพ +20" },
  strength: { name: "ยาเพิ่มพลัง", price: 12, desc: "ใช้เองในการต่อสู้ที่อันตรายครั้งถัดไป โอกาสสำเร็จ +8%" },
  life: { name: "ยาคืนชีพ", price: 90, desc: "รอดตายได้หนึ่งครั้ง (ยกเว้นความชรา) · ได้ผลครั้งเดียวในชีวิต · ต้องปรุงเองด้วยการปรุงยาขั้นชำนาญ" },
};
const alchemyRank = (l: Life) => craftRank(l, "alchemy");
const potionPrice = (l: Life, k: keyof typeof POTIONS) => Math.max(1, Math.round(POTIONS[k].price * (1 - alchemyRank(l) * 0.1)));
const addPotion = (l: Life, k: keyof typeof POTIONS) => { const f = fl(l); f.potions = { ...f.potions, [k]: (f.potions?.[k] ?? 0) + 1 }; };
/** พกยาได้จำกัด ยาคืนชีพขวดเดียว · ยาคืนชีพไม่มีขาย ต้องปรุงเองด้วยการปรุงยาขั้นชำนาญ */
export const LIFE_ALCHEMY = 3;
export const POTION_MAX: Record<keyof typeof POTIONS, number> = { heal: 3, strength: 3, life: 1 };
const POTION_SHOP = SCENE("ft.pw.potions", "ร้านยา", (l) => `ร้านยาท้ายตลาดกลิ่นสมุนไพรแรงจนแสบจมูก${alchemyRank(l) >= 2 ? " คุณปรุงเองได้ถูกกว่าราคาร้าน" : ""}${alchemyRank(l) < LIFE_ALCHEMY ? " · ยาคืนชีพไม่มีขาย ต้องปรุงเองเมื่อการปรุงยาถึงขั้นชำนาญ" : ""}`, [
  ...(Object.keys(POTIONS) as (keyof typeof POTIONS)[]).map((k) => C((l) => `${POTIONS[k].name} (${potionPrice(l, k)} เหรียญทอง) · มีอยู่ ${fl(l).potions?.[k] ?? 0}`, G(() => `คุณเก็บ${POTIONS[k].name}ไว้ในกระเป๋าเสื้อ`, {}, (l) => { l.money -= potionPrice(l, k) * GOLD; addPotion(l, k); }), { req: (l) => (k === "life" && alchemyRank(l) < LIFE_ALCHEMY ? "ต้องปรุงเอง ใช้การปรุงยาขั้นชำนาญ" : k === "life" && l.flags.ftRevived ? "ยาคืนชีพได้ผลกับคนหนึ่งคนครั้งเดียวในชีวิต" : (fl(l).potions?.[k] ?? 0) >= POTION_MAX[k] ? "พกเต็มแล้ว" : l.money < potionPrice(l, k) * GOLD ? `ต้องมี ${potionPrice(l, k)} เหรียญทอง` : undefined), mark: POTIONS[k].desc })),
  C("ยังไม่ซื้ออะไร", N("คุณเดินออกจากร้านพร้อมกลิ่นสมุนไพรติดเสื้อ")),
]);

// ───────────── ฝีมือช่างและตำรา ─────────────
export type Craft = "smith" | "alchemy" | "healing" | "lore";
export const CRAFT_NAME: Record<Craft, string> = { smith: "งานช่าง", alchemy: "การปรุงยา", healing: "การรักษา", lore: "ความรู้และตำรา" };
export const CRAFT_RANKS = ["ไม่เคยเรียน", "เริ่มเรียน", "พอใช้ได้", "ชำนาญ", "เชี่ยวชาญ", "ปรมาจารย์", "ในตำนาน"];
const CRAFT_AT = [0, 30, 80, 160, 280, 450, 700];
export const craftRank = (l: Life, k: Craft) => { const x = fl(l).craft?.[k] ?? 0; let r = 0; for (let i = 0; i < CRAFT_AT.length; i++) if (x >= CRAFT_AT[i]) r = i; return r; };
const addCraft = (l: Life, k: Craft, d: number) => { const f = fl(l); if ((k === "smith" || k === "alchemy") && f.injuries?.includes("hand")) d = Math.round(d / 2); const before = craftRank(l, k); f.craft = { ...f.craft, [k]: (f.craft?.[k] ?? 0) + d }; const after = craftRank(l, k); if (after > before && after >= 3) log(l, `${CRAFT_NAME[k]}ของคุณถึงขั้น${CRAFT_RANKS[after]}`, "good"); if (after >= 5 && before < 5) deed(l, `${CRAFT_RANKS[after]}แห่ง${CRAFT_NAME[k]}`); };
const JOB_CRAFT: Record<string, Craft> = { ft_smith: "smith", ft_enchanter: "smith", ft_wandwright: "smith", ft_alchemist: "alchemy", ft_priest: "healing", ft_scholar: "lore", ft_cartographer: "lore", ft_diplomat: "lore" };
const STUDY = SCENE("ft.pw.study", "ฝึกวิชาช่างและตำรา", "ปีนี้คุณจะใช้เวลาเรียนวิชาไหน", [
  ...(Object.keys(CRAFT_NAME) as Craft[]).map((k) => C((l) => `${CRAFT_NAME[k]} · ${CRAFT_RANKS[craftRank(l, k)]}`, G(() => `คุณใช้ทั้งปีกับ${CRAFT_NAME[k]} มือและหัวเริ่มจำได้เอง`, { iq: 1 }, (l) => addCraft(l, k, 25 + Math.round(l.stats.smarts / 5))))),
]);
const REFORGE = SCENE("ft.pw.reforge", "ตีอาวุธใหม่", (l) => `คุณวาง${fl(l).weapon?.name ?? "อาวุธ"}ลงบนทั่งของตัวเอง ฝีมือตอนนี้ดีพอจะทำให้มันดีกว่าเดิม`, [
  PAY("หลอมใหม่ทั้งเล่ม", 10, G((l) => `${fl(l).weapon?.name}คมขึ้นและเบาขึ้น เหมือนเป็นแขนที่สามของคุณ`, { joy: 4 }, (l) => { const w = fl(l).weapon; if (w) w.quality = Math.min(5, w.quality + 1); })),
  C("ยังไม่แตะมัน", N("อาวุธที่ดีอยู่แล้วบางทีก็ไม่ต้องแก้")),
]);

// ───────────── อาวุธที่มีประวัติ ─────────────
export const KILLS_TO_NAME = 10;
const WEAPON_NAME: GameEvent = E("ft.pw.weapon_name", [14, 900], (l) => `${fl(l).weapon?.name ?? "อาวุธของคุณ"}ล้มศัตรูมาแล้ว ${fl(l).weapon?.kills ?? 0} ครั้ง คนในเมืองเริ่มเรียกมันด้วยชื่อของมันเอง`, [
  ...["ผู้ไม่เคยแพ้", "เขี้ยวรัตติกาล", "เพลงสุดท้าย"].map((n) => C(`ให้มันชื่อ「${n}」`, BIG((l) => `${fl(l).weapon?.name}กลายเป็น「${n}」 มันดูคมขึ้นทั้งที่ไม่มีใครลับ`, { fame: 2, joy: 4 }, (l) => { const w = fl(l).weapon; if (w) { w.name = `${n}`; w.named = true; w.quality = Math.min(5, w.quality + 1); } }))),
], { title: "อาวุธที่มีชื่อ", forced: true, maxTimes: 0, when: (l) => on(l) && !!fl(l).weapon && !fl(l).weapon!.named && (fl(l).weapon!.kills ?? 0) >= KILLS_TO_NAME });

// ───────────── เก็บตัวฝึก ─────────────
export const secludedUntil = (l: Life) => Number(l.flags.ftSecludeUntil ?? 0);
export const secluded = (l: Life) => on(l) && secludedUntil(l) > l.age;
const SECLUDE = SCENE("ft.pw.seclude", "เก็บตัวฝึกวิชา", "บนเขาสูงมีถ้ำที่ยอดฝีมือรุ่นก่อนใช้เก็บตัว ทุกปีที่อยู่ที่นั่นเท่ากับฝึกในเมืองหลายปี แต่โลกข้างล่างจะเดินต่อไปโดยไม่มีคุณ", [
  ...[1, 3, 5].map((n) => C(`เก็บตัว ${n} ปี`, G(() => `คุณเก็บของจำเป็นใส่ย่าม แล้วเดินขึ้นเขาไปคนเดียว${n > 1 ? " งานและผู้คนจะต้องรอคุณ" : ""}`, {}, (l) => { l.flags.ftSecludeUntil = l.age + n; l.flags.ftSecludeTrack = fl(l).potential > (fl(l).bstars ?? 0) ? "magic" : "body"; if (n > 1) l.job = undefined; }), { cons: n > 1 ? "ลาออกจากงาน และคนใกล้ตัวห่างเหิน" : undefined })),
  C("ยังไม่พร้อมทิ้งโลกข้างล่าง", N("คุณกลับลงเขามาพร้อมความคิดเต็มหัว")),
]);
export const SECLUDE_XP = 70;
/** บนเขาไม่มีใครช่วย: ปีละครั้งอาจบาดเจ็บ หรือสิ้นใจเพียงลำพัง · ลงจากเขาแล้วต้องรอห้าปีก่อนขึ้นไปใหม่ */
export const SECLUDE_HURT = 0.12, SECLUDE_DEATH = 0.015, SECLUDE_GAP = 5;

// ───────────── พลังขั้นตำนาน ─────────────
const PEAK: GameEvent = E("ft.pw.peak", [14, 900], (l) => `ข่าวว่าคุณเป็น${fl(l).bodyRank >= 5 ? BODY_RANKS[fl(l).bodyRank] : MAGIC_RANKS[fl(l).magicRank]}ไปถึงทุกราชสำนัก ผู้ครองแผ่นดินส่งทูตมาพร้อมกัน บางคนนำของขวัญมา บางคนนำทหารมาด้วย`, [
  C("รับใช้ผู้ครองแผ่นดินบ้านเกิด", BIG("ผู้ครองของคุณประกาศให้คุณเป็นเสาหลักของแผ่นดิน แผ่นดินอื่นไม่กล้าแตะชายแดนอีกหลายปี", { fame: 6, gold: 60 }, (l) => { addStanding(l, 20); const k = homeKingdom(l); k.power = clamp(k.power + 10, 0, 100); })),
  C("ยืนอยู่เหนือทุกฝ่าย", BIG("คุณปฏิเสธทุกราชสำนัก ทุกแผ่นดินจึงต้องเกรงใจคุณเท่ากัน และมังกรเริ่มบินมาเกาะยอดเขาใกล้บ้านคุณ", { fame: 8 }, (l) => { fl(l).dragonBond += 15; })),
], { title: "พลังที่โลกต้องหันมามอง", forced: true, maxTimes: 1, when: (l) => on(l) && (fl(l).bodyRank >= 5 || fl(l).magicRank >= 5) });

// ───────────── ปีละครั้ง ─────────────
function powerYear(l: Life) {
  if (!on(l) || !l.alive) return;
  const f = fl(l);
  // งานที่ทำสอนฝีมือช่างและตำราไปเอง · การรักษาช่วยร่างกาย
  // ฝึกต่อเนื่องนับเป็นปีฝึก · ทุกสิบห้าปีดันเพดานขึ้นหนึ่งขั้น (power.ts)
  // ปีที่เพิ่งผ่านมา: doneThisYear ถูกล้างก่อน yearHooks จึงอ่านจาก lastActs
  const last = String(l.flags.lastActs ?? "").split("|");
  if (last.includes("act:ft_train") || last.includes("act:ft_study") || secluded(l)) f.trainYears = (f.trainYears ?? 0) + 1;
  const ck = l.job && JOB_CRAFT[l.job.careerId];
  if (ck) addCraft(l, ck, 12);
  if (craftRank(l, "healing") >= 3) addStat(l, "health", 1);
  // ความมืด: ศาสตร์ความตายสะสมทุกปี · ความมืดสูงทำให้นิสัยเย็นชาลง
  if (f.mschool === "death") corrupt(l, 2);
  if (corruptionOf(l) >= 30) lean(l, { m: -1 });
  // ยาสมานแผลดื่มเองเมื่อเจ็บหนัก
  if (l.stats.health < 30 && (f.potions?.heal ?? 0) > 0) { f.potions!.heal!--; addStat(l, "health", 20); log(l, `คุณดื่ม${POTIONS.heal.name} แผลเริ่มสมานในคืนเดียว`, "good"); }
  // เก็บตัวฝึก: แต้มฝึกมาก แต่คนข้างล่างห่างเหิน
  if (secluded(l)) {
    if (l.flags.ftSecludeTrack === "magic") f.magic += SECLUDE_XP; else f.body += SECLUDE_XP;
    for (const p of l.people) if (p.alive && ["friend", "partner", "spouse", "sibling", "child"].includes(p.relation)) p.bond = clamp(p.bond - 3, 0, 100);
    if (chance(l, SECLUDE_DEATH)) { kill(l, "สิ้นใจเพียงลำพังในถ้ำบนเขา"); return; }
    if (chance(l, SECLUDE_HURT)) { addStat(l, "health", -15); log(l, "หิมะถล่มปิดปากถ้ำหลายวัน คุณรอดมาได้แต่ร่างกายทรุดลงมาก", "bad"); }
    if (secludedUntil(l) === l.age + 1) log(l, "ปีหน้าคุณจะลงจากเขา ฝีมือของคุณไม่เหมือนเดิมแล้ว แต่โลกข้างล่างก็ไม่เหมือนเดิมเช่นกัน", "milestone");
  }
}

/** ตัวคูณโอกาสตามสายอาวุธ · ยาเพิ่มพลังในงานอันตราย · ความรู้ช่วยงานที่ใช้หัว */
function styleOdds(l: Life, c: Choice, _ctx: Ctx, p: number) {
  if (!on(l)) return p;
  let o = p;
  if (c.survival && (fl(l).potions?.strength ?? 0) > 0) o += 0.08;
  if (c.check?.stat === "smarts") o += craftRank(l, "lore") * 0.015;
  return o;
}
const ACTS: Activity[] = [
  { id: "ft_potions", emoji: "", name: "ร้านยา", desc: "ยาสมานแผล ยาเพิ่มพลัง ยาคืนชีพ", minAge: 14, time: 0, world: "fantasy", group: "ชีวิต", run: (l) => { runEvent(l, "ft.pw.potions"); return { text: "" }; } },
  { id: "ft_craft", emoji: "", name: "ฝึกวิชาช่างและตำรา", desc: "งานช่าง การปรุงยา การรักษา ความรู้", minAge: 12, time: 1, world: "fantasy", group: "การศึกษา", run: (l) => { runEvent(l, "ft.pw.study"); return { text: "" }; } },
  { id: "ft_reforge", emoji: "", name: "ตีอาวุธของตัวเองใหม่", desc: "ต้องมีฝีมือช่างขั้นชำนาญ", minAge: 16, time: 1, world: "fantasy", group: "ฝึกฝน", available: (l) => !!l.ft && craftRank(l, "smith") >= 3 && !!fl(l).weapon && fl(l).weapon!.quality < 5, run: (l) => { runEvent(l, "ft.pw.reforge"); return { text: "" }; } },
  { id: "ft_seclude", emoji: "", name: "เก็บตัวฝึกวิชา", desc: "ฝึกหนักบนเขาหลายปี · โลกข้างล่างเดินต่อไปโดยไม่มีคุณ", minAge: 16, time: 0, world: "fantasy", group: "ฝึกฝน", available: (l) => !!l.ft && !secluded(l) && (!l.flags.ftSecludeUntil || l.age >= secludedUntil(l) + SECLUDE_GAP) && (fl(l).bodyRank >= 1 || fl(l).magicRank >= 1), run: (l) => { runEvent(l, "ft.pw.seclude"); return { text: "" }; } },
  { id: "ft_penance", emoji: "", name: "ชำระบาปที่วิหาร", desc: "ลดความมืดในตัว (20 เหรียญทอง)", minAge: 14, time: 1, world: "fantasy", group: "ชีวิต", available: (l) => !!l.ft && corruptionOf(l) > 0, run: (l) => { if (l.money < 20 * GOLD) return { text: "ต้องมี 20 เหรียญทอง", kind: "bad" }; l.money -= 20 * GOLD; corrupt(l, -20); const t = "คุณคุกเข่าในวิหารทั้งเดือน ความมืดในตัวเบาลงเหมือนน้ำค่อยๆ ใสขึ้น"; log(l, t, "good"); return { text: t, kind: "good" }; } },
];

/** เรื่องที่ต้องปิดตัวเองหลังเลือก */
function after(e: GameEvent, fn: (l: Life, c: Ctx) => void): GameEvent {
  return { ...e, choices: (e.choices ?? []).map((ch) => ({ ...ch, run: (l: Life, c: Ctx, ok: boolean) => { fn(l, c); return ch.run(l, c, ok); } })) };
}
export const POWER2_EVENTS: GameEvent[] = [MASTER_EV, OWN_TECH, after(DARK[0], (l) => { l.flags.ftInqAt = l.age; }), after(DARK[1], (l) => { l.flags.ftDarkAt = l.age; }), POTION_SHOP, STUDY, REFORGE, WEAPON_NAME, SECLUDE, PEAK];

/** เรียกหลังลงทะเบียน event ทั้งหมดแล้ว */
export function loadPower2() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push(powerYear);
  oddsHooks.push(styleOdds);
  for (const [id, track] of [["ft.break_body", "body"], ["ft.break_magic", "magic"]] as const) {
    const ev = getEvent(id);
    // ทะลวงเฉยๆ โดยไม่มีบททดสอบยากกว่าเดิม บททดสอบจึงเป็นทางหลัก
    const plain = ev?.choices?.[0];
    if (plain?.odds) { const o = plain.odds; plain.odds = (l, c) => clamp(o(l, c) - PLAIN_PENALTY, 0.05, 0.95); }
    ev?.choices?.push(...trials(track));
  }
  // ทางทะลวงที่ใช้ของต้องห้ามสะสมความมืด
  for (const id of ["ft.break_body", "ft.break_magic"]) for (const ch of getEvent(id)?.choices ?? []) {
    const lab = typeof ch.label === "string" ? ch.label : "";
    if (/ต้องห้าม/.test(lab)) { const run = ch.run; ch.run = (l, c, ok) => { corrupt(l, 15); return run(l, c, ok); }; }
  }
  // ยาเพิ่มพลังใช้ไปเมื่อสู้ในงานอันตราย · อาวุธนับศัตรูที่ล้ม
  choiceHooks.push((l, c, _ctx, ok) => {
    if (!on(l) || !c.survival) return;
    const f = fl(l);
    if ((f.potions?.strength ?? 0) > 0) f.potions!.strength!--;
    if (ok && f.weapon) f.weapon.kills = (f.weapon.kills ?? 0) + 1;
  });
  // ยาคืนชีพกันตายได้หนึ่งครั้ง (ความชราไม่นับ)
  deathSaves.push((l, cause) => {
    if (!on(l) || (fl(l).potions?.life ?? 0) <= 0 || /ชรา|อายุ|สงบ|หลับ|ขึ้นสู่สวรรค์/.test(cause)) return false;
    fl(l).potions!.life!--; l.flags.ftRevived = true; l.stats.health = Math.max(l.stats.health, 25);
    log(l, `ก่อนสิ้นใจ คุณกัดขวด${POTIONS.life.name}แตก ลมหายใจกลับมาอีกครั้ง`, "milestone");
    return true;
  });
  // ร่างกายร่วงโรยตามวัย เวทลึกขึ้นตามวัย · ท่าจากอาจารย์และท่าของตัวเอง · ดาบเวทของคนที่เดินสองสาย
  combatHooks.push((l) => {
    if (!on(l)) return [];
    const f = fl(l), st = stageAge(l), out: [string, number][] = [];
    if (f.bodyRank > 0 && st > 55) out.push(["ร่างกายตามวัย", -Math.min(20, Math.round((st - 55) * 0.6))]);
    if (f.magicRank > 0 && st > 40) out.push(["เวทที่ลึกขึ้นตามวัย", Math.min(10, Math.round((st - 40) * 0.15))]);
    if (learnedOf(l).length) out.push(["ท่าจากอาจารย์", learnedOf(l).length * 3]);
    if (f.myTech) out.push([`ท่า「${f.myTech}」`, 6]);
    if (corruptionOf(l) >= 25) out.push(["พลังจากความมืด", Math.round(corruptionOf(l) / 10)]);
    return out;
  });
  // อยู่บนเขา ทำอะไรในเมืองไม่ได้ (ยกเว้นออกจากที่เก็บตัว)
  activityFilters.push((l, a) => !secluded(l) || ["ft_train", "ft_study", "ft_unseclude"].includes(a.id));
  ACTIVITIES.push({ id: "ft_unseclude", emoji: "", name: "ลงจากเขาก่อนกำหนด", desc: "กลับไปใช้ชีวิตในเมือง", minAge: 16, time: 0, world: "fantasy", group: "ฝึกฝน", available: (l) => secluded(l), run: (l) => { l.flags.ftSecludeUntil = l.age; const t = "คุณเก็บย่ามแล้วเดินลงจากเขาเร็วกว่าที่ตั้งใจไว้"; log(l, t); return { text: t }; } });
}

/** เทียบให้เห็นง่าย: ตอนนี้คุณสู้อะไรได้ อะไรยังไม่ได้ */
const REF: [string, number][] = [["โจรข้างทาง", 10], ["ฝูงหมาป่า", 18], ["อัศวินฝีมือดี", 30], ["ยักษ์ภูเขา", 42], ["มังกรหนุ่ม", 58], ["มังกรอายุพันปี", 80]];
export function standingLine(l: Life): string {
  const win = REF.filter(([, t]) => fightOdds(l, t) >= 0.6), lose = REF.find(([, t]) => fightOdds(l, t) < 0.6);
  return `${win.length ? `ตอนนี้คุณเอาชนะ${win.at(-1)![0]}ได้` : "ตอนนี้คุณยังสู้ใครไม่ค่อยได้"}${lose ? ` แต่ยังไม่ใช่คู่มือของ${lose[0]}` : " ไม่มีอะไรในโลกที่คุณต้องกลัวแล้ว"}`;
}
/** ทะลวงขั้นต่อไปต้องมีอะไร */
export function nextBreak(l: Life, track: "body" | "magic"): string {
  const f = fl(l), rank = track === "body" ? f.bodyRank : f.magicRank, xp = track === "body" ? f.body : f.magic, cap = track === "body" ? bodyCap(l) : magicCap(l);
  const names = track === "body" ? BODY_RANKS : MAGIC_RANKS;
  if (rank >= cap) return `เพดานของคุณคือ${names[cap]} ${rank >= 6 ? "" : "(ดาว ของวิเศษ หรือการฝึกนานหลายสิบปีช่วยดันได้)"}`;
  return canBreak(l, track) ? `พร้อมทะลวงเป็น${names[rank + 1]}แล้ว` : `อีก ${Math.max(0, needXp(rank) - xp)} แต้มฝึกจะถึง${names[rank + 1]}`;
}
