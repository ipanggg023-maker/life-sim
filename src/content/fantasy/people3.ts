// ผู้คนชุดที่สาม: ความรักเป็นขั้น (พบกัน จีบ คบกัน หมั้น แต่งงาน) · สิ่งที่คนรักต้องการ · แนะนำคนให้รู้จัก · จดหมาย
// วงคนใกล้ชิด · มิตรภาพที่ถูกทดสอบและพี่น้องร่วมสาบาน · สัญญาณก่อนการหักหลัง · ความโศกที่เปลี่ยนคุณ · ปาร์ตี้ที่เป็นทีมจริง
// คนในบ้าน · คนดังที่เริ่มเห็นคุณ · ออกไปพบผู้คน · แผนอยู่ที่ design/GRILL.md ส่วนที่ 4 (Release 6)
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Ctx, GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { profileOf, relOf, remember } from "../../engine/npc";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { addStat, clamp, createPerson, log, shortName } from "../../engine/util";
import { personActionHooks, type PersonAction } from "../murim/life/kinship";
import { B, BIG, C, E, G, GOLD, N, P, PAY, SCENE } from "./kit";
import { lean } from "./persona";
import { fightOdds, safetyHooks } from "./power";
import { addStanding, dataOf, deed, fl } from "./state";
import { cityOf } from "./cities";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
const who = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.pid);
const nm = (l: Life, c: Ctx) => { const p = who(l, c); return p ? shortName(p) : "เขา"; };
const bond = (p: Person | undefined, d: number) => { if (p) p.bond = clamp(p.bond + d, 0, 100); };
const tagN = (p: Person, k: string) => Number(p.tags?.find((t) => t.startsWith(`${k}:`))?.slice(k.length + 1) ?? -1);
const setTag = (p: Person, k: string, v: number | string) => { p.tags = [...(p.tags ?? []).filter((t) => !t.startsWith(`${k}:`)), `${k}:${v}`]; };
const away = (p: Person) => !!p.tags?.some((t) => t.startsWith("away:"));

// ───────────── ความรักเป็นขั้น ─────────────
export type LoveStage = "courting" | "together";
export const stageOf = (p: Person): LoveStage | undefined => (p.relation !== "partner" ? undefined : p.tags?.includes("together") ? "together" : "courting");
export const STAGE_LABEL: Record<LoveStage, string> = { courting: "กำลังจีบกัน", together: "คบกันแล้ว" };
/** วันเดตครั้งล่าสุด (อายุของคุณ) · ไม่ได้ไปไหนด้วยกันนานเกินไป ความรักเย็นลง */
export const lastDate = (p: Person) => tagN(p, "dated");
export const NEGLECT_YEARS = 3;
const lovers = (l: Life) => l.people.filter((p) => p.alive && !away(p) && (p.relation === "partner" || p.relation === "spouse"));
/** สิ่งที่คนรักต้องการที่สุด มาจากค่านิยมของเขา */
export type Want = "values" | "time" | "dream" | "safety";
export const WANT_LABEL: Record<Want, string> = { values: "คนที่คิดเหมือนกัน", time: "เวลาที่อยู่ด้วยกัน", dream: "คนที่หนุนความฝันของเขา", safety: "ชีวิตที่ปลอดภัย" };
export function wantOf(p: Person): Want {
  const v = profileOf(p).values[0];
  return v === "ความภักดี" ? "time" : v === "อิสรภาพ" || v === "พลัง" ? "dream" : v === "เงินทอง" || v === "ความสงบ" ? "safety" : "values";
}
const LOVE: GameEvent[] = [
  E("ft.lv.together", [16, 900], (l, c) => `${nm(l, c)}ถามคุณตรงๆ หลังเดินเล่นด้วยกันมาหลายครั้ง "เราเป็นอะไรกัน"`, [
    C("บอกว่าอยากคบกันจริงจัง", BIG((l, c) => `${nm(l, c)}ยิ้มกว้าง แล้วจับมือคุณเดินกลับบ้านด้วยกัน`, { joy: 8 }, (l, c) => { const p = who(l, c); if (p) { p.tags = [...(p.tags ?? []), "together"]; bond(p, 10); remember(l, p, "together", "คุณขอคบกันจริงจัง", 3, { love: 15, trust: 10 }); } })),
    C("ขอเวลาอีกหน่อย", N((l, c) => `${nm(l, c)}พยักหน้า แต่สายตาบอกว่าจะไม่รอนานนัก`, {}, (l, c) => { bond(who(l, c), -4); l.flags.ftTogetherAsk = l.age; })),
  ], { title: "เราเป็นอะไรกัน", forced: true, maxTimes: 0, prepare: (l) => ({ pid: courtingReady(l)!.id }), when: (l) => on(l) && !!courtingReady(l) && l.age - Number(l.flags.ftTogetherAsk ?? -99) >= 2 }),
  E("ft.lv.dream", [18, 900], (l, c) => `${nm(l, c)}เล่าความฝันที่เก็บไว้มานาน อยาก${pick(l, ["เปิดร้านเล็กๆ ของตัวเอง", "ออกเดินทางไปให้ถึงทะเลเหนือ", "กลับไปช่วยหมู่บ้านบ้านเกิด", "เรียนเวทให้จบตามที่แม่ฝันไว้"])} และถามว่าคุณจะอยู่ข้างเขาไหม`, [
    PAY("ช่วยทั้งเงินและแรง", 20, BIG((l, c) => `ความฝันของ${nm(l, c)}เริ่มเป็นจริงในปีนั้น และเขาบอกทุกคนว่าเพราะคุณ`, { joy: 8 }, (l, c) => { const p = who(l, c); if (p) { bond(p, 15); remember(l, p, "dream", "คุณหนุนความฝันของเขา", 3, { love: 20, debt: 20 }); } })),
    C("หนุนด้วยคำพูดและเวลา", G((l, c) => `${nm(l, c)}ทำได้ช้ากว่าที่ฝัน แต่ทุกก้าวมีคุณยืนข้างๆ`, { joy: 4 }, (l, c) => bond(who(l, c), 8))),
    C("บอกว่ามันเป็นไปไม่ได้", B((l, c) => `${nm(l, c)}เงียบไปทั้งคืน ความฝันนั้นไม่ถูกพูดถึงอีก แต่ไม่ได้หายไปไหน`, { joy: -3 }, (l, c) => { const p = who(l, c); if (p) { bond(p, -15); remember(l, p, "dream", "คุณบอกว่าความฝันของเขาเป็นไปไม่ได้", 3, { love: -15, grudge: 10 }); } })),
  ], { title: "ความฝันของคนรัก", weight: 14, maxTimes: 1, ...oneLover((p) => wantOf(p) === "dream") }),
  E("ft.lv.values", [18, 900], (l, c) => `${nm(l, c)}ได้ยินเรื่องที่คุณทำเมื่อเดือนก่อน และถามว่านั่นคือตัวตนจริงของคุณหรือเปล่า`, [
    C("อธิบายเหตุผลทั้งหมด", G((l, c) => `${nm(l, c)}ฟังจนจบ ยังไม่เห็นด้วยทุกอย่าง แต่เข้าใจคุณมากขึ้น`, { joy: 2 }, (l, c) => bond(who(l, c), 4))),
    C("สัญญาว่าจะเปลี่ยน", G((l, c) => `${nm(l, c)}กอดคุณ และคุณรู้สึกว่าคำสัญญานี้หนักกว่าที่คิด`, { joy: 3 }, (l, c) => { bond(who(l, c), 8); lean(l, { m: 4 }); })),
    C("บอกว่านี่คือตัวคุณ รับไม่ได้ก็ไป", B((l, c) => `${nm(l, c)}เก็บของออกจากบ้านในคืนนั้น`, { joy: -8 }, (l, c) => { const p = who(l, c); if (p) leave(l, p, "คุณบอกให้เขาไปถ้ารับตัวคุณไม่ได้"); })),
  ], { title: "ตัวตนที่แท้จริง", weight: 14, maxTimes: 1, ...oneLover((p) => wantOf(p) === "values") }),
  E("ft.lv.safety", [18, 900], (l, c) => `${nm(l, c)}นั่งรอคุณจนดึกอีกคืน "ข้ากลัวว่าสักวันเจ้าจะไม่กลับมา" หนี้และงานเสี่ยงของคุณทำให้เขานอนไม่หลับ`, [
    C("สัญญาว่าจะเลิกงานเสี่ยง", G((l, c) => `${nm(l, c)}หลับสนิทเป็นครั้งแรกในรอบหลายเดือน`, { joy: 3 }, (l, c) => { bond(who(l, c), 10); l.flags.ftPromiseSafe = l.age; })),
    C("บอกว่านี่คืองานของคุณ", N((l, c) => `${nm(l, c)}พยักหน้าช้าๆ แต่คุณเห็นว่าเขาเริ่มเก็บเงินไว้ในที่ที่คุณไม่รู้`, { joy: -2 }, (l, c) => bond(who(l, c), -6))),
  ], { title: "ความกลัวของคนรัก", weight: 14, maxTimes: 2, ...oneLover((p) => wantOf(p) === "safety"), when: (l) => on(l) && (l.debt >= 40 * GOLD || fl(l).contracts >= 3 || fl(l).guild >= 2) && lovers(l).some((p) => wantOf(p) === "safety") }),
  E("ft.lv.approval", [18, 900], (l, c) => `พ่อแม่ของ${nm(l, c)}ไม่ยอมรับคุณ "${pick(l, ["ตระกูลเจ้าไม่คู่ควรกับลูกเรา", "เผ่าเจ้ากับเผ่าเราไม่เคยแต่งกัน", "เจ้าไม่มีอนาคต", "พ่อของเจ้าเคยทำให้ตระกูลเราอับอาย"])}"`, [
    P("ไปพบพวกเขาให้เห็นตัวตนจริง", (l) => 0.35 + l.stats.looks / 250 + l.fame / 300, G((l, c) => `พ่อของ${nm(l, c)}จับมือคุณตอนกลับ "ข้าคิดผิด"`, { joy: 6 }, (l, c) => bond(who(l, c), 8)), N("พวกเขาฟัง แต่ยังไม่ยอมรับ และไม่มาร่วมงานใดๆ ของพวกคุณ", { joy: -3 })),
    C("แต่งงานโดยไม่ต้องได้รับอนุญาต", G((l, c) => `${nm(l, c)}เลือกคุณ แม้จะต้องเสียครอบครัวไป`, { joy: 2 }, (l, c) => { const p = who(l, c); if (p) { bond(p, 12); remember(l, p, "approval", "คุณสองคนเลือกกันแม้ครอบครัวต่อต้าน", 3, { love: 15, loyalty: 15 }); } })),
    C("ถอยออกมาเพื่อไม่ให้เขาเสียครอบครัว", B((l, c) => `${nm(l, c)}ร้องไห้ แต่เข้าใจ คุณสองคนแยกกันตอนฤดูใบไม้ร่วง`, { joy: -8 }, (l, c) => { const p = who(l, c); if (p) leave(l, p, "คุณยอมถอยเพื่อครอบครัวของเขา"); })),
  ], { title: "ครอบครัวของคนรัก", weight: 12, maxTimes: 1, ...oneLover((p) => stageOf(p) === "together") }),
  E("ft.lv.alliance", [18, 900], `ราชสำนักเสนอให้คุณแต่งงานกับทายาทตระกูลใหญ่เพื่อผูกพันธมิตร ทั้งที่คุณมีคนรักอยู่แล้ว`, [
    C("รับข้อเสนอเพื่อแผ่นดิน", B("งานแต่งยิ่งใหญ่ที่สุดแห่งปี แต่ในงานมีคนหนึ่งที่ไม่ได้มา", { fame: 4, gold: 40, joy: -6 }, (l) => { for (const p of lovers(l)) if (p.relation === "partner") leave(l, p, "คุณเลือกงานแต่งเพื่อการเมือง"); addStanding(l, 8); })),
    C("ปฏิเสธเพื่อคนรัก", G("ราชสำนักไม่พอใจ แต่คนรักของคุณจะจำวันนี้ไปตลอดชีวิต", { joy: 4 }, (l) => { addStanding(l, -6); for (const p of lovers(l)) { bond(p, 15); remember(l, p, "alliance", "คุณปฏิเสธงานแต่งการเมืองเพื่อเขา", 3, { love: 20, loyalty: 20 }); } })),
  ], { title: "งานแต่งเพื่อพันธมิตร", weight: 10, maxTimes: 1, when: (l) => on(l) && (!!fl(l).throne || l.flags.ftNobleBlood === "known" || l.job?.careerId === "ft_courtier") && lovers(l).some((p) => p.relation === "partner") }),
  E("ft.lv.cold", [18, 900], (l, c) => `${nm(l, c)}บอกว่ารู้สึกเหมือนอยู่คนเดียวในบ้าน คุณไม่ได้ไปไหนด้วยกันมาหลายปีแล้ว`, [
    C("พาไปเที่ยวทันที", G((l, c) => `คุณพา${nm(l, c)}กลับไปที่ที่พบกันครั้งแรก ความเงียบระหว่างกันค่อยๆ หายไป`, { joy: 5 }, (l, c) => { const p = who(l, c); if (p) { bond(p, 10); setTag(p, "dated", l.age); } })),
    C("บอกว่าช่วงนี้ยุ่งมากจริงๆ", B((l, c) => `${nm(l, c)}ไม่พูดอะไรอีก ${who(l, c)?.relation === "partner" ? "และไม่กลับมาบ้านในอีกหลายวันต่อมา" : "แต่คุณเห็นว่าเขาเริ่มกินข้าวคนเดียว"}`, { joy: -5 }, (l, c) => { const p = who(l, c); if (!p) return; bond(p, -15); if (p.relation === "partner" && p.bond < 35) leave(l, p, "คุณไม่มีเวลาให้เขาอีกต่อไป"); })),
  ], { title: "บ้านที่เงียบ", weight: 45, maxTimes: 0, ...oneLover((p) => l0Age(p) >= NEGLECT_YEARS) }),
];
/** อายุคุณตอนนี้ลบปีที่เดตครั้งล่าสุด (ใช้ในเงื่อนไขของ event) */
let nowAge = 0;
const l0Age = (p: Person) => nowAge - Math.max(lastDate(p), tagN(p, "since"));
function oneLover(f: (p: Person) => boolean) {
  const list = (l: Life) => { nowAge = l.age; return lovers(l).filter(f); };
  return { when: (l: Life) => on(l) && list(l).length > 0, prepare: (l: Life): Ctx => ({ pid: pick(l, list(l)).id }) };
}
const courtingReady = (l: Life) => l.people.find((p) => p.alive && p.relation === "partner" && !p.tags?.includes("together") && (tagN(p, "dates") >= 2 || p.bond >= 75));
/** แยกทางกัน: คนรักกลายเป็นคนที่เคยรัก · คู่สมรสย้ายออกไป */
function leave(l: Life, p: Person, why: string) {
  remember(l, p, "left", why, 3, { love: -20, grudge: 15 });
  if (p.relation === "partner") { p.relation = "friend"; p.tags = (p.tags ?? []).filter((t) => t !== "together"); p.bond = Math.min(p.bond, 30); }
  else p.tags = [...(p.tags ?? []), `away:${l.age}`];
  log(l, `${shortName(p)}จากไป`, "bad");
}
/** ขอแต่งงานได้เมื่อคบกันจริงจังแล้วเท่านั้น */
export const marriageBlock = (l: Life) => {
  if (!on(l)) return;
  const ps = l.people.filter((p) => p.alive && p.relation === "partner");
  return ps.length && !ps.some((p) => p.tags?.includes("together")) ? "ยังไม่ได้คบกันจริงจัง · ไปเที่ยวด้วยกันอีกสักหน่อย แล้วเขาจะถามเองว่าเป็นอะไรกัน" : undefined;
};

// ───────────── แนะนำให้รู้จัก · จดหมาย ─────────────
const CIRCLE = ["friend", "ally", "sibling", "spouse", "partner", "father", "mother", "child"];
const others = (l: Life, c: Ctx) => l.people.filter((p) => p.alive && p.id !== c.pid && ["friend", "ally", "sibling"].includes(p.relation) && p.age >= 16).sort((a, b) => b.bond - a.bond).slice(0, 4);
const INTRO = SCENE("ft.pp.intro", "แนะนำให้รู้จัก", (l, c) => `คุณอยากให้${nm(l, c)}รู้จักใคร`, [
  ...[0, 1, 2, 3].map((i) => C((l, c) => { const o = others(l, c)[i]; return o ? `พา${shortName(o)}มารู้จัก` : ""; }, (l, c) => {
    const a = who(l, c), b = others(l, c)[i];
    if (!a || !b) return { text: "" };
    const ga = relOf(a).grudge, gb = relOf(b).grudge;
    // สองคนที่เคยมีเรื่องกันกับคุณ ไกล่เกลี่ยให้กันได้ · สองคนโสดอาจถูกใจกัน
    if (ga >= 20 || gb >= 20) { remember(l, a, "intro", "คุณพยายามไกล่เกลี่ยให้", 2, { grudge: -15 }); remember(l, b, "intro", "คุณพยายามไกล่เกลี่ยให้", 2, { grudge: -15 }); return { text: `${shortName(a)}กับ${shortName(b)}นั่งคุยกันได้ในที่สุด ความแค้นในใจทั้งคู่เบาลง`, kind: "good" }; }
    const single = (p: Person) => !l.people.some((x) => x.tags?.includes(`couple:${p.id}`)) && !p.tags?.some((t) => t.startsWith("couple:"));
    if (a.gender !== b.gender && single(a) && single(b) && chance(l, 0.35)) { a.tags = [...(a.tags ?? []), `couple:${b.id}`]; b.tags = [...(b.tags ?? []), `couple:${a.id}`]; bond(a, 6); bond(b, 6); return { text: `${shortName(a)}กับ${shortName(b)}คุยกันจนลืมว่าคุณยังนั่งอยู่ด้วย สามเดือนต่อมาทั้งคู่ก็เดินจับมือกันในตลาด`, kind: "milestone" }; }
    bond(a, 4); bond(b, 4);
    return { text: `${shortName(a)}กับ${shortName(b)}ถูกคอกัน และเริ่มนัดกันเองโดยไม่ต้องมีคุณ`, kind: "good" };
  }, { show: (l, c) => !!others(l, c)[i] })),
]);
const LETTER = SCENE("ft.pp.letter", "เขียนจดหมาย", (l, c) => `คุณนั่งลงหน้ากระดาษเปล่าเพื่อเขียนถึง${nm(l, c)}`, [
  C("เล่าเรื่องชีวิตช่วงนี้ทั้งหมด", G((l, c) => `จดหมายตอบกลับมาในหนึ่งเดือน ยาวกว่าจดหมายของคุณสองเท่า ${nm(l, c)}เล่าทุกเรื่องของเขาเหมือนกัน`, { joy: 3 }, (l, c) => { const p = who(l, c); if (p) { bond(p, 6); setTag(p, "talked", l.age); } })),
  C("ขอโทษเรื่องที่ค้างคาใจ", G((l, c) => `${nm(l, c)}ตอบกลับสั้นๆ ว่ารอจดหมายนี้มานาน`, { joy: 2 }, (l, c) => { const p = who(l, c); if (p) { remember(l, p, "letter", "คุณเขียนมาขอโทษ", 2, { grudge: -12, love: 5 }); setTag(p, "talked", l.age); } })),
]);

// ───────────── มิตรภาพที่ถูกทดสอบ · พี่น้องร่วมสาบาน · สัญญาณก่อนการหักหลัง ─────────────
const friendWith = (f: (p: Person) => boolean) => (l: Life) => l.people.filter((p) => p.alive && !away(p) && (p.relation === "friend" || p.relation === "ally") && f(p));
const oneFriend = (f: (p: Person) => boolean) => ({ when: (l: Life) => on(l) && friendWith(f)(l).length > 0, prepare: (l: Life): Ctx => ({ pid: pick(l, friendWith(f)(l)).id }) });
export const sworn = (p: Person) => !!p.tags?.includes("sworn");
const warnable = (p: Person) => !!p.tags?.includes("turning") && !p.tags?.includes("warned_shown");
const FRIEND: GameEvent[] = [
  E("ft.pp.test", [16, 900], (l, c) => `${nm(l, c)}ขอให้คุณยืนยันกับยามว่าคืนนั้นเขาอยู่กับคุณ ทั้งที่ไม่ใช่ความจริง รางวัลนำจับคนร้ายคืนนั้นคือห้าสิบเหรียญทอง`, [
    C("ยืนยันให้เพื่อน", G((l, c) => `${nm(l, c)}รอดจากการถูกสอบสวน เขาบอกว่าจะไม่ลืมเรื่องนี้จนตาย`, { joy: -1 }, (l, c) => { const p = who(l, c); if (p) remember(l, p, "test", "คุณโกหกเพื่อปกป้องเขา", 3, { loyalty: 25, debt: 30 }); lean(l, { m: 3, h: -4 }); })),
    C("ขอให้เขาเล่าความจริงก่อน", N((l, c) => `${nm(l, c)}เล่าว่าคืนนั้นเขาไปหาคนรักที่แต่งงานแล้ว ไม่ได้ทำร้ายใคร คุณตัดสินใจช่วยเขาด้วยวิธีอื่น`, {}, (l, c) => { const p = who(l, c); if (p) remember(l, p, "test", "คุณฟังความจริงก่อนตัดสิน", 2, { trust: 15 }); })),
    C("บอกความจริงกับยาม แล้วรับรางวัล", B((l, c) => `${nm(l, c)}ถูกจับ และมองคุณจากหลังลูกกรงด้วยสายตาที่คุณจะจำไปตลอด`, { gold: 50, joy: -4 }, (l, c) => { const p = who(l, c); if (p) remember(l, p, "test", "คุณขายเขาเพื่อรางวัล", 3, { grudge: 50, trust: -40 }); lean(l, { h: 5, m: -5 }); })),
  ], { title: "มิตรภาพกับรางวัลนำจับ", weight: 10, maxTimes: 1, ...oneFriend((p) => p.bond >= 60) }),
  E("ft.pp.sworn", [14, 900], (l, c) => `${nm(l, c)}กรีดฝ่ามือตัวเองเบาๆ แล้วยื่นมือมา "ข้าไม่มีพี่น้องที่ไหนดีเท่าเจ้า เราสาบานเป็นพี่น้องกันไหม"`, [
    C("กรีดมือแล้วจับมือเขา", BIG((l, c) => `คุณกับ${nm(l, c)}สาบานเป็นพี่น้องกันใต้แสงจันทร์ ไม่ว่าจะเกิดอะไรขึ้น จะไม่ทิ้งกัน`, { joy: 8 }, (l, c) => { const p = who(l, c); if (p) { p.tags = [...(p.tags ?? []), "sworn"]; remember(l, p, "sworn", "สาบานเป็นพี่น้องกัน", 3, { loyalty: 40, love: 15 }); deed(l, `สาบานเป็นพี่น้องกับ${shortName(p)}`); } })),
    C("บอกว่าเป็นเพื่อนกันแบบนี้ก็ดีแล้ว", N((l, c) => `${nm(l, c)}หัวเราะเขินๆ แล้วเก็บมือกลับ`, {}, (l, c) => bond(who(l, c), -3))),
  ], { title: "คำสาบานพี่น้อง", weight: 14, maxTimes: 1, ...oneFriend((p) => p.bond >= 85 && !sworn(p)) }),
  E("ft.pp.warning", [16, 900], (l, c) => `ช่วงนี้${nm(l, c)}แปลกไป ถามเรื่องเงินของคุณบ่อยขึ้น หลบตาเวลาคุยเรื่องงาน และคุณเห็นเขาคุยกับคนแปลกหน้าในตรอกหลังตลาด`, [
    C("ถามเขาตรงๆ ว่ามีอะไรหรือเปล่า", G((l, c) => `${nm(l, c)}ร้องไห้ เขาติดหนี้คนผิด และถูกบังคับให้ขโมยของจากบ้านคุณ คุณสองคนหาทางออกด้วยกัน`, { joy: 2 }, (l, c) => { const p = who(l, c); if (p) { remember(l, p, "warned", "คุณถามตรงๆ แทนที่จะสงสัย", 3, { jealousy: -30, trust: 15, debt: 10 }); p.tags = (p.tags ?? []).filter((t) => t !== "turning"); } })),
    C("เฝ้าดูเขาเงียบๆ", N("คุณเริ่มล็อกหีบเงินและจดว่าเขาไปที่ไหนบ้าง", {}, (l, c) => { const p = who(l, c); if (p) p.tags = [...(p.tags ?? []), "watched"]; })),
    C("คิดว่าตัวเองคิดมากไป", N("คุณบอกตัวเองว่าเพื่อนก็คือเพื่อน", {})),
  ], { title: "สัญญาณบางอย่าง", weight: 18, maxTimes: 0, when: (l) => on(l) && friendWith(warnable)(l).length > 0, prepare: (l): Ctx => ({ pid: pick(l, friendWith(warnable)(l)).id }) }),
  E("ft.pp.betray", [16, 900], (l, c) => (who(l, c)?.tags?.includes("watched") ? `คืนนี้คุณจับได้คาหนังคาเขา ${nm(l, c)}กำลังเปิดหีบเงินของคุณ` : `เช้านี้หีบเงินของคุณว่างเปล่า และ${nm(l, c)}ก็หายไปจากเมือง`), [
    C((l, c) => (who(l, c)?.tags?.includes("watched") ? "ถามว่าทำไม" : "ปล่อยเขาไป"), (l, c) => {
      const p = who(l, c); if (!p) return { text: "" };
      p.tags = (p.tags ?? []).filter((t) => t !== "turning" && t !== "watched");
      if (c.caught) {
        remember(l, p, "betray", "คุณจับได้ แต่ฟังเหตุผลของเขา", 3, { jealousy: -20, debt: 20 });
        return { text: `${nm(l, c)}เล่าว่าเขาอิจฉาคุณมาหลายปี จนวันหนึ่งความอิจฉาชนะ คุณยังไม่รู้ว่าจะให้อภัยได้ไหม แต่เงินของคุณยังอยู่ครบ`, kind: "normal" };
      }
      const lost = Math.round(l.money * 0.3); l.money -= lost;
      p.relation = "rival"; remember(l, p, "betray", "เขาหักหลังคุณ", 3, { grudge: 30 });
      return { text: `เงิน ${Math.round(lost / GOLD)} เหรียญทองหายไปพร้อม${nm(l, c)} สัญญาณมีมาตั้งนานแล้ว`, kind: "bad" };
    }),
  ], { title: "การหักหลัง", weight: 25, maxTimes: 0, when: (l) => on(l) && friendWith((p) => !!p.tags?.includes("turning") && relOf(p).jealousy >= 55)(l).length > 0, prepare: (l): Ctx => { const p = pick(l, friendWith((x) => !!x.tags?.includes("turning") && relOf(x).jealousy >= 55)(l)); return { pid: p.id, caught: p.tags?.includes("watched") ? 1 : 0 }; } }),
];

// ───────────── ความโศกที่เปลี่ยนคุณ ─────────────
export const griefOf = (l: Life) => (l.flags.ftGrief ? String(l.flags.ftGrief) : undefined);
export const GRIEF_YEARS = 3;
const GRIEF: GameEvent = E("ft.pp.grief", [8, 900], (l) => `ตั้งแต่${String(l.flags.ftGriefName ?? "คนที่รัก")}จากไป ทุกเช้าคุณตื่นมาแล้วลืมไปครู่หนึ่ง ก่อนจะจำได้อีกครั้ง`, [
  C("จมอยู่กับเหล้า", B("เหล้าทำให้คืนสั้นลง แต่เช้าแต่ละวันยาวขึ้น", { joy: 2, hp: -6 }, (l) => { lean(l, { c: 2, h: 2 }); l.flags.ftGriefWay = "drink"; })),
  C("ทุ่มให้กับงาน", N("คุณทำงานจนไม่มีเวลาคิด หัวหน้าชม แต่บ้านเงียบลงทุกวัน", { joy: -2 }, (l) => { if (l.job) l.job.performance = clamp(l.job.performance + 12, 0, 100); lean(l, { c: -2 }); l.flags.ftGriefWay = "work"; })),
  C("ไปวิหารทุกเช้า", G("นักบวชไม่ได้พูดอะไรมาก แต่การนั่งเงียบๆ ในวิหารทำให้หัวใจเบาลงทีละนิด", { joy: 3 }, (l) => { lean(l, { m: 3 }); l.flags.ftGriefWay = "faith"; })),
  C("ตามหาคนที่ทำให้เขาตาย", N("คุณเริ่มถามคำถามที่ไม่มีใครอยากตอบ และตั้งใจว่าจะไม่หยุดจนกว่าจะได้คำตอบ", {}, (l) => { lean(l, { m: -3, c: 4 }); l.flags.ftGriefWay = "revenge"; }), { show: (l) => !!l.flags.ftGriefViolent }),
], { title: "หลังการจากไป", forced: true, maxTimes: 0, when: (l) => on(l) && !!l.flags.ftGrief && l.flags.ftGriefAsked !== l.flags.ftGrief, prepare: (l) => { l.flags.ftGriefAsked = l.flags.ftGrief!; return {}; } });

// ───────────── ปาร์ตี้ที่เป็นทีมจริง ─────────────
const party = (l: Life) => l.people.filter((p) => p.alive && p.tags?.some((t) => t.startsWith("party:")));
const PARTY: GameEvent[] = [
  E("ft.pp.party_name", [16, 900], "ทั้งปาร์ตี้นั่งล้อมกองไฟ มีคนเสนอว่าถึงเวลามีชื่อเรียกที่คนทั้งแผ่นดินจะจำ", [
    ...["ดาบพเนจร", "ราตรีเหล็ก", "จันทร์แดง", "ปีกเงิน"].map((n) => C(`ใช้ชื่อ "${n}"`, BIG(`ปาร์ตี้ "${n}" ถูกเขียนลงทะเบียนกิลด์ในเช้าวันถัดมา`, { fame: 2, joy: 4 }, (l) => { l.flags.ftPartyName = n; for (const p of party(l)) bond(p, 5); }))),
  ], { title: "ชื่อของปาร์ตี้", weight: 30, maxTimes: 1, when: (l) => on(l) && party(l).length >= 2 && !l.flags.ftPartyName }),
  E("ft.pp.party_quest", [16, 900], (l, c) => `${nm(l, c)}ในปาร์ตี้ขอให้ทุกคนช่วยภารกิจส่วนตัว ${pick(l, ["ตามหาน้องสาวที่ถูกลักพาตัว", "ทวงดาบของพ่อคืนจากกลุ่มโจร", "พิสูจน์ความบริสุทธิ์ให้อาจารย์ที่ถูกใส่ร้าย", "กลับไปปิดประตูมิติที่เขาเคยเปิดทิ้งไว้"])}`, [
    P("ทั้งปาร์ตี้ไปด้วยกัน", (l) => fightOdds(l, 26), BIG((l, c) => `ภารกิจของ${nm(l, c)}สำเร็จ เขาไม่พูดอะไร แค่จับมือทุกคนทีละคน`, { fame: 3, joy: 6 }, (l, c) => { const p = who(l, c); if (p) { bond(p, 15); remember(l, p, "party_quest", "ปาร์ตี้ช่วยภารกิจของเขา", 3, { loyalty: 30 }); } }), (l, c) => {
      const p = who(l, c);
      // ภารกิจที่ล้มเหลวอาจพรากสมาชิกไป
      if (p && chance(l, MEMBER_DEATH)) { p.alive = false; l.flags.ftGrief = p.id; l.flags.ftGriefName = shortName(p); l.flags.ftGriefViolent = true; return { text: `ภารกิจล้มเหลว ${shortName(p)}ไม่ได้กลับมาพร้อมพวกคุณ`, kind: "bad" }; }
      addStat(l, "health", -6);
      return { text: "ภารกิจล้มเหลว ทุกคนกลับมาได้ แต่ไม่มีใครพูดถึงมันอีก", kind: "bad" };
    }),
    C("บอกว่าปาร์ตี้รับงานส่วนตัวไม่ได้", B((l, c) => `${nm(l, c)}ออกเดินทางคนเดียวในคืนนั้น`, { joy: -3 }, (l, c) => { const p = who(l, c); if (p) { p.tags = (p.tags ?? []).filter((t) => !t.startsWith("party:")); p.relation = "friend"; bond(p, -20); } })),
  ], { title: "ภารกิจของสหาย", weight: 14, maxTimes: 0, when: (l) => on(l) && party(l).length > 0, prepare: (l) => ({ pid: pick(l, party(l)).id }) }),
];
export const MEMBER_DEATH = 0.3;

// ───────────── คนในบ้าน ─────────────
export type StaffRole = "steward" | "guard" | "servant";
export const STAFF: Record<StaffRole, { name: string; wage: number; perk: string }> = {
  steward: { name: "พ่อบ้านดูแลบัญชี", wage: 12, perk: "ค่าดูแลของใหญ่ลดลงหนึ่งในห้า และจับขโมยในบ้านได้" },
  guard: { name: "องครักษ์", wage: 15, perk: "โอกาสตายในงานอันตรายลดลง" },
  servant: { name: "คนรับใช้", wage: 5, perk: "รู้ข่าวลือและความลับของเมืองก่อนใคร" },
};
export const staffOf = (l: Life, r: StaffRole) => l.people.find((p) => p.alive && p.tags?.includes(`staff:${r}`));
const HIRE = SCENE("ft.pp.hire", "จ้างคนในบ้าน", "บ้านของคุณใหญ่พอจะต้องมีคนช่วยดูแลแล้ว คุณอยากจ้างใคร", [
  ...(Object.keys(STAFF) as StaffRole[]).map((r) => C(`${STAFF[r].name} (ปีละ ${STAFF[r].wage} เหรียญทอง)`, G(() => `${STAFF[r].name}คนใหม่มาเริ่มงานในเช้าวันถัดมา`, { joy: 2 }, (l) => { const p = createPerson(l, "ally", { age: randInt(l, 25, 55), bond: 50, job: STAFF[r].name }); p.tags = [...(p.tags ?? []), `staff:${r}`]; }), { show: (l) => !staffOf(l, r), mark: STAFF[r].perk })),
  C("ยังไม่จ้างใคร", N("คุณยังดูแลบ้านเองได้อีกสักพัก")),
]);
const STAFF_EVENTS: GameEvent[] = [
  E("ft.pp.servant_gossip", [18, 900], (l) => `${nm(l, { pid: staffOf(l, "servant")?.id ?? "" })}กระซิบตอนยกน้ำชามาให้ \"บ้านขุนนางข้างๆ กำลังจะล้ม ข้าได้ยินจากแม่ครัวของเขา\"`, [
    C("ใช้ข่าวนี้ทำกำไร", G("คุณซื้อที่ดินของเขาไว้ก่อนใคร ราคาถูกกว่าครึ่ง", { gold: 25 })),
    C("เตือนขุนนางคนนั้น", G("ขุนนางคนนั้นรอดมาได้ และส่งของขวัญมาขอบคุณทุกปี", { joy: 3 }, (l) => addStanding(l, 3))),
  ], { title: "ข่าวจากหลังครัว", weight: 12, maxTimes: 3, when: (l) => on(l) && !!staffOf(l, "servant") }),
  E("ft.pp.staff_steal", [18, 900], (l) => `เงินในหีบหายไปทีละนิดมาหลายเดือน${staffOf(l, "steward") ? " พ่อบ้านของคุณจับได้ว่าเป็นฝีมือคนในบ้านเอง" : " และคุณไม่รู้ว่าใครเอาไป"}`, [
    C("ไล่คนที่ขโมยออก", N("บ้านเงียบลง แต่คุณนอนหลับสบายขึ้น", {}, (l) => { const p = l.people.find((x) => x.alive && x.tags?.includes("staff:servant") && x.bond < 40); if (p) { p.tags = (p.tags ?? []).filter((t) => !t.startsWith("staff:")); p.relation = "friend"; } })),
    C("ให้โอกาสอีกครั้ง", G("เขาร้องไห้สารภาพว่าลูกป่วย คุณจ่ายค่าหมอให้ และเขาไม่เคยขโมยอีกเลย", { gold: -5 }, (l) => { const p = l.people.find((x) => x.alive && x.tags?.some((t) => t.startsWith("staff:"))); if (p) { bond(p, 25); remember(l, p, "mercy", "คุณให้อภัยตอนเขาขโมย", 3, { loyalty: 40 }); } })),
  ], { title: "เงินที่หายไปทีละนิด", weight: 8, maxTimes: 1, when: (l) => on(l) && l.people.some((p) => p.alive && p.tags?.some((t) => t.startsWith("staff:")) && p.bond < 40) }),
];

// ───────────── คนดังที่เริ่มเห็นคุณ ─────────────
const famousFor = (l: Life) => dataOf(l).notables.filter((n) => n.kingdom === fl(l).kingdom && n.fame >= 30);
const FAMOUS: GameEvent = E("ft.pp.famous", [18, 900], (_l, c) => `${String(c.name)} ${String(c.role)}ที่ทั้งแผ่นดินรู้จัก ส่งคนมาเชิญคุณไปพบ ชื่อของคุณเริ่มดังพอที่คนอย่างเขาจะได้ยิน`, [
  C("ไปพบและผูกมิตร", G((_l, c) => `${String(c.name)}คุยกับคุณจนดึก และบอกว่าถ้ามีอะไรให้ส่งข่าวมาได้เสมอ`, { fame: 2, joy: 4 }, (l, c) => { const p = createPerson(l, "ally", { age: Number(c.age), bond: 55, job: String(c.role) }); p.name = String(c.name); p.tags = [...(p.tags ?? []), `notable:${c.nid}`]; })),
  P("ขอประลองฝีมือ", (l, c) => fightOdds(l, Number(c.power)), BIG((_l, c) => `คุณชนะ${String(c.name)}ต่อหน้าผู้คน ทั้งแผ่นดินพูดถึงเรื่องนี้ไปอีกหลายปี`, { fame: 8 }), B((_l, c) => `${String(c.name)}เอาชนะคุณได้ไม่ยาก แต่ยื่นมือดึงคุณลุก`, { hp: -5, fame: 1 })),
  C("ปฏิเสธคำเชิญ", N("คนส่งสารกลับไปพร้อมสีหน้าแปลกใจ คนแบบนั้นไม่ค่อยถูกปฏิเสธ")),
], { title: "คำเชิญจากคนดัง", weight: 12, maxTimes: 3, when: (l) => on(l) && l.fame >= FAMOUS_AT && famousFor(l).length > 0 && l.age - Number(l.flags.ftFamousAt ?? -99) >= 8, prepare: (l): Ctx => { const n = pick(l, famousFor(l)); return { nid: n.id, name: n.name, role: n.role === "hero" ? "นักรบ" : n.role === "mage" ? "จอมเวท" : n.role === "general" ? "แม่ทัพ" : n.role === "merchant" ? "พ่อค้าใหญ่" : n.role === "priest" ? "นักบวช" : "จอมโจร", age: n.age, power: n.power }; } });
export const FAMOUS_AT = 40;

// ───────────── ออกไปพบผู้คน ─────────────
const MEET = SCENE("ft.pp.meet", "ออกไปพบผู้คน", (l) => `คืนนี้คุณออกจากบ้านไปที่${cityOf(l).name} จะไปที่ไหนดี`, [
  C("โรงเตี๊ยมกลางเมือง", G("คุณได้เพื่อนใหม่ที่หัวเราะเสียงดังที่สุดในร้าน", { joy: 3 }, (l) => meet(l, pick(l, ["นักเดินทาง", "ทหารพักร้อน", "นักร้องประจำร้าน", "พ่อค้าเร่"])))),
  C("ลานฝึกของเมือง", G("คนที่ซ้อมข้างคุณขอแลกท่ากันจนค่ำ", { body: 3 }, (l) => meet(l, pick(l, ["นักดาบพเนจร", "ทหารฝึกหัด", "นักล่าค่าหัว"])))),
  C("งานเลี้ยงของคนในวงการเดียวกัน", G("คุณได้รู้จักคนที่อาจช่วยงานของคุณได้ในวันหน้า", { joy: 2 }, (l) => { meet(l, l.job ? `คนในวงการเดียวกับคุณ` : "คนทำงานในเมือง"); if (l.job) l.job.performance = clamp(l.job.performance + 3, 0, 100); }), { show: (l) => !!l.job }),
  C("งานเลี้ยงของขุนนาง", G("คุณยืนข้างคนที่มีชื่อเสียงทั้งคืน และมีคนหนึ่งจำชื่อคุณได้", { fame: 1 }, (l) => meet(l, "ลูกขุนนาง")), { show: (l) => (fl(l).standing?.[fl(l).kingdom] ?? 0) >= 15 || l.wealth === "elite" }),
]);
/** คนใหม่ตามที่ที่ไป · คนโสดวัยเดียวกันมีโอกาสเป็นคนที่ถูกใจ */
function meet(l: Life, job: string) {
  const single = !l.people.some((p) => p.alive && (p.relation === "spouse" || p.relation === "partner"));
  const spark = single && l.age >= 18 && chance(l, 0.3);
  const p = createPerson(l, spark ? "partner" : "friend", { gender: spark ? (l.gender === "m" ? "f" : "m") : undefined, age: Math.max(16, l.age + randInt(l, -6, 6)), bond: spark ? 45 : 35, job });
  if (spark) { setTag(p, "since", l.age); log(l, `คุณกับ${shortName(p)}คุยกันจนร้านปิด และนัดเจอกันอีก`, "good"); }
}

// ───────────── ปีละครั้ง: ความรักเย็นลง เพื่อนที่เริ่มเปลี่ยน ความโศก วันครบรอบ ค่าจ้างคนในบ้าน คนที่ห่างเหิน ─────────────
function peopleYear(l: Life) {
  if (!on(l) || !l.alive) return;
  nowAge = l.age;
  // คนรักที่ยังไม่มีวันเริ่มต้น นับจากปีนี้
  for (const p of lovers(l)) if (tagN(p, "since") < 0 && lastDate(p) < 0) setTag(p, "since", l.age);
  // เพื่อนที่อิจฉามากเริ่มเปลี่ยน (มีสัญญาณก่อน)
  for (const p of l.people) if (p.alive && (p.relation === "friend" || p.relation === "ally") && !sworn(p) && relOf(p).jealousy >= 40 && !p.tags?.includes("turning") && chance(l, 0.25)) p.tags = [...(p.tags ?? []), "turning"];
  // ความโศก: คนใกล้ตัวที่จากไปปีนี้
  const lost = l.people.find((p) => !p.alive && CIRCLE.includes(p.relation) && p.bond >= 50 && !p.tags?.includes("mourned"));
  if (lost) {
    lost.tags = [...(lost.tags ?? []), "mourned", `died:${l.age}`];
    l.flags.ftGrief = lost.id; l.flags.ftGriefName = shortName(lost); l.flags.ftGriefAt = l.age;
    l.flags.ftGriefViolent = /ฆ่า|สังหาร|ลอบ|ถูกทำร้าย|ศึก/.test(String(lost.tags?.join(" ") ?? "")) || !!l.flags.ftGriefViolent;
  }
  if (l.flags.ftGrief && l.age - Number(l.flags.ftGriefAt ?? l.age) < GRIEF_YEARS) addStat(l, "happiness", l.flags.ftGriefWay === "faith" ? -1 : l.flags.ftGriefWay === "drink" ? -3 : -2);
  else if (l.flags.ftGrief && l.age - Number(l.flags.ftGriefAt) >= GRIEF_YEARS) { delete l.flags.ftGrief; delete l.flags.ftGriefViolent; }
  // วันครบรอบทุกสิบปีของคนที่รักที่จากไป
  for (const p of l.people) { const d = tagN(p, "died"); if (d > 0 && l.age > d && (l.age - d) % 10 === 0) log(l, `ครบ ${l.age - d} ปีที่${shortName(p)}จากไป คุณไปนั่งที่ที่เคยนั่งด้วยกันอีกครั้ง`, "normal"); }
  // ค่าจ้างคนในบ้าน · จ่ายไม่ไหวเขาลาออก
  for (const r of Object.keys(STAFF) as StaffRole[]) { const s = staffOf(l, r); if (!s) continue; if (l.money >= STAFF[r].wage * GOLD) l.money -= STAFF[r].wage * GOLD; else { s.tags = (s.tags ?? []).filter((t) => !t.startsWith("staff:")); log(l, `${shortName(s)}ลาออกเพราะไม่ได้ค่าจ้าง`, "bad"); } }
  // คนใกล้ชิดที่ไม่ได้คุยกันนาน (เตือนทุกห้าปี)
  if (l.age % 5 === 0) {
    const far = l.people.filter((p) => p.alive && ["friend", "sibling", "father", "mother", "child"].includes(p.relation) && p.bond >= 50 && l.age - Math.max(tagN(p, "talked"), tagN(p, "since")) >= 5 && l.age >= 16).slice(0, 2);
    if (far.length) log(l, `คุณไม่ได้คุยกับ${far.map((p) => shortName(p)).join("และ")}มาหลายปีแล้ว ลองเขียนจดหมายหรือแวะไปหาดูไหม`, "normal");
  }
}

/** ปุ่มรายคนเพิ่ม: แนะนำให้รู้จัก เขียนจดหมาย · ทุกการกระทำจดว่าคุยกันล่าสุดเมื่อไร */
function actions(l: Life, p: Person): PersonAction[] {
  if (!on(l) || l.age < 12 || !p.alive) return [];
  const out: PersonAction[] = [];
  const done = (id: string) => (l.doneThisYear.includes(`fp:${id}:${p.id}`) ? "ปีนี้ทำไปแล้ว" : undefined);
  const run = (id: string, ev: string) => (x: Life) => { x.doneThisYear.push(`fp:${id}:${p.id}`); setTag(p, "talked", x.age); runEvent(x, ev, { pid: p.id }); };
  if (["friend", "ally", "sibling"].includes(p.relation) && p.age >= 16 && others(l, { pid: p.id }).length) out.push({ id: "intro", label: "แนะนำให้รู้จัก", locked: done("intro"), run: run("intro", "ft.pp.intro") });
  if (p.relation !== "child" || p.age >= 16) out.push({ id: "letter", label: away(p) ? "เขียนจดหมายไปหา" : "เขียนจดหมาย", locked: l.doneThisYear.includes(`fl:${p.id}`) ? "ปีนี้เขียนไปแล้ว" : undefined, run: (x) => { x.doneThisYear.push(`fl:${p.id}`); runEvent(x, "ft.pp.letter", { pid: p.id }); } });
  return out;
}

const ACTS: Activity[] = [
  { id: "ft_go_out", emoji: "", name: "ออกไปพบผู้คน", desc: "เพื่อนใหม่ คนในวงการ หรือคนที่ถูกใจ", minAge: 14, time: 1, world: "fantasy", group: "ผู้คน", run: (l) => { runEvent(l, "ft.pp.meet"); return { text: "" }; } },
  { id: "ft_hire", emoji: "", name: "จ้างคนในบ้าน", desc: "พ่อบ้าน องครักษ์ หรือคนรับใช้", minAge: 20, time: 0, world: "fantasy", group: "ชีวิต", available: (l) => !!l.ft && (Number(l.flags.ftHome ?? 0) >= 3 || l.money >= 300 * GOLD) && (Object.keys(STAFF) as StaffRole[]).some((r) => !staffOf(l, r)), run: (l) => { runEvent(l, "ft.pp.hire"); return { text: "" }; } },
];

/** เรื่องที่ต้องปิดตัวเองหลังเลือก (ห้ามปิดตอน prepare เพราะคิวตรวจเงื่อนไขซ้ำหลังทุกการเลือก) */
function after(e: GameEvent, fn: (l: Life, c: Ctx) => void): GameEvent {
  return { ...e, choices: (e.choices ?? []).map((ch) => ({ ...ch, run: (l: Life, c: Ctx, ok: boolean) => { fn(l, c); return ch.run(l, c, ok); } })) };
}
const GRIEF_ONCE = after(GRIEF, (l) => { l.flags.ftGriefAsked = String(l.flags.ftGrief); });
const FAMOUS_ONCE = after(FAMOUS, (l) => { l.flags.ftFamousAt = l.age; });
const FRIEND_ONCE = FRIEND.map((e) => (e.id === "ft.pp.warning" ? after(e, (l, c) => { const p = who(l, c); if (p) p.tags = [...(p.tags ?? []), "warned_shown"]; }) : e));

export const PEOPLE3_EVENTS: GameEvent[] = [...LOVE, INTRO, LETTER, ...FRIEND_ONCE, GRIEF_ONCE, ...PARTY, HIRE, ...STAFF_EVENTS, FAMOUS_ONCE, MEET];
export function loadPeople3() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push(peopleYear);
  safetyHooks.push((l) => (l.ft && staffOf(l, "guard") ? 0.85 : 1));
  const base = personActionHooks.fantasy;
  personActionHooks.fantasy = (l, p) => [...(base?.(l, p) ?? []), ...actions(l, p)];
}
