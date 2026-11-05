// มังกรและอาวุธตำนาน: อยู่ในโลกจริง คนอื่นแย่งได้ และตามหาได้หลายวิธี
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Ctx, GameEvent } from "../../engine/events";
import { runEvent } from "../../engine/game";
import { pick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, displayName } from "../../engine/util";
import { recordChronicle } from "../../engine/worldState";
import { B, BIG, C, E, G, K, N, P, SCENE } from "./kit";
import { fightOdds } from "./power";
import { dataOf, deed, fl, kingdomsOf, myRelic, passRelic, relicOf, worldOfLife, type Relic } from "./state";

export const NEED_CLUES = 4;
const TRIAL_THREAT = 58;
const SEEK_WAIT = 1;
export const DRAGON_THREAT = 105;
const EXAGGERATE = ["ด้วยมือเปล่า", "ในคืนเดียว", "ทั้งที่ตาบอดข้างหนึ่ง", "ตอนอายุเพียงสิบสองปี", "ขณะร้องเพลงไปด้วย", "โดยมีมังกรสามตัวเป็นพยาน"];
// ดาบในหินไม่ต้องตามหา มันอยู่ที่เดิมรอคนที่คู่ควร (legends2.ts)
const lost = (l: Life) => dataOf(l).relics.filter((r) => r.holder !== "player" && r.holder !== "stone");
/** ตามชิ้นที่มีเบาะแสมากสุด เบาะแสจึงไม่กระจาย */
const chase = (l: Life) => lost(l).slice().sort((a, b) => (fl(l).clues[b.id] ?? 0) - (fl(l).clues[a.id] ?? 0))[0];
const R = (l: Life, c: Ctx): Relic => relicOf(l, String(c.relic))!;

function takeRelic(l: Life, r: Relic) {
  const was = r.holder;
  r.holder = "player";
  fl(l).relic = r.id;
  deed(l, `ครอบครอง${r.name}`);
  addFame(l, 15);
  recordChronicle(worldOfLife(l), `${l.firstName}ได้${r.name}${was === "lost" ? "จากซากปรักหักพัง" : `จาก${was}`}`);
  passRelic(worldOfLife(l), r, displayName(l));
  if (r.id === "phoenixring" && !l.flags.ftPhoenix) { l.flags.ftPhoenix = true; fl(l).threads++; }
}
function dropRelic(l: Life) {
  const r = myRelic(l)!;
  r.holder = "lost"; r.at = fl(l).kingdom; fl(l).relic = undefined;
  passRelic(worldOfLife(l), r, `${displayName(l)}วางคืนแท่น`);
}
const tale = (l: Life, c: Ctx) => worldOfLife(l).legends[Number(c.g)];

const ACTS: Activity[] = [
  { id: "ft_legend", emoji: "", name: "สืบหาอาวุธตำนาน", desc: "ตามร่องรอยในหอสมุดและซากเมือง", minAge: 16, time: 2, world: "fantasy", group: "ผจญภัย", available: (l) => !fl(l).relic && lost(l).length > 0 && l.age >= Number(l.flags.ftSeekNext ?? 0), run: (l) => { l.flags.ftSeekNext = l.age + SEEK_WAIT; runEvent(l, "ft.legend_trail", { relic: chase(l).id }); return { text: "" }; } },
  { id: "ft_relic_drop", emoji: "", name: "วางอาวุธตำนานคืนแท่น", desc: "ปล่อยให้คนอื่นตามหา แล้วไปตามหาชิ้นใหม่", minAge: 16, time: 0, world: "fantasy", group: "ผจญภัย", available: (l) => !!fl(l).relic, run: (l) => { runEvent(l, "ft.relic_drop"); return { text: "" }; } },
];

export const LEGEND_EVENTS: GameEvent[] = [
  SCENE("ft.legend_trail", "ตามหาตำนาน", (l, c) => `คุณกำลังตามรอย「${R(l, c).name}」${R(l, c).power}${R(l, c).holder === "lost" ? "" : ` ข่าวว่าอยู่ในมือ${R(l, c).holder}`} (เบาะแส ${fl(l).clues[R(l, c).id] ?? 0}/${NEED_CLUES})`, [
    K("ค้นบันทึกเก่าในหอสมุด", "smarts", 50, G("ระหว่างบรรทัดของพงศาวดารมีชื่อสถานที่ที่ถูกขีดฆ่า", { iq: 1 }, (l, c) => clue(l, c)), N("หนังสือเล่มนี้ถูกตัดหน้าสำคัญไปแล้ว")),
    K("เดินทางไปซากเมืองที่ตำนานกล่าวถึง", "luck", 50, G("หินสลักใต้เถาวัลย์ชี้ไปทางเดียวกับเพลงพื้นบ้าน", {}, (l, c) => clue(l, c)), B("ซากเมืองมีสัตว์ประหลาดอาศัยอยู่แล้ว", { hp: -7 })),
    C("กลับไปก่อน", N("ตำนานรอมาเป็นพันปี รออีกหน่อยก็ได้")),
  ]),
  SCENE("ft.relic_trial", "บททดสอบ", (l, c) => `เบาะแสครบแล้ว คุณยืนอยู่ต่อหน้า「${R(l, c).name}」${R(l, c).holder === "lost" ? "" : ` และ${R(l, c).holder}ที่ถืออยู่`}`, [
    P("สู้เพื่อสิทธิ์ในอาวุธ", (l) => fightOdds(l, TRIAL_THREAT), BIG((l, c) => `ผู้พิทักษ์ถอยให้คุณ「${R(l, c).name}」เป็นของคุณแล้ว`, { joy: 15 }, (l, c) => takeRelic(l, R(l, c))), B("ผู้พิทักษ์ปัดคุณลงบันไดอย่างง่ายดาย", { hp: -18 }), { show: (l, c) => R(l, c).trial === "combat" || R(l, c).holder !== "lost" }),
    K("แก้ปริศนาบนฐานหิน", "smarts", 62, BIG((l, c) => `ตัวอักษรเรืองแสงทีละตัว และ「${R(l, c).name}」ก็หลุดจากหิน`, { joy: 15 }, (l, c) => takeRelic(l, R(l, c))), N("คำตอบของคุณทำให้ประตูปิดสนิทอีกครั้ง"), { show: (l, c) => R(l, c).trial === "wit" && R(l, c).holder === "lost" }),
    K("ยื่นมือไปโดยไม่คิดจะครอบครอง", "luck", 55, BIG((l, c) => `「${R(l, c).name}」สั่นเบาๆ แล้วลอยมาอยู่ในมือคุณ มันเลือกคุณ`, { joy: 15 }, (l, c) => takeRelic(l, R(l, c))), N("มันนิ่งสนิท วันนี้ไม่ใช่คุณ"), { show: (l, c) => R(l, c).trial === "heart" && R(l, c).holder === "lost" }),
    C("ถอยกลับก่อน", N("คุณจำทางมาที่นี่ไว้แล้ว")),
  ]),

  SCENE("ft.relic_drop", "แท่นหิน", (l) => `คุณยืน${myRelic(l)?.id === "grief" ? "จับดาบโศกาที่ไม่ยอมหลุดจากมือ" : `ถือ${myRelic(l)?.name}`}อยู่หน้าแท่นหินที่มันเคยหลับใหล`, [
    C("วางคืนแท่น", N("มันกลับไปเป็นตำนานที่รอคนต่อไป", {}, dropRelic), { show: (l) => myRelic(l)?.id !== "grief" }),
    K("ฝืนแกะนิ้วออกจากด้ามดาบ", "looks", 70, G("ดาบหลุดจากมือคุณ และความเศร้าที่สะสมมาหลายปีก็หลุดตามไปด้วย", { joy: 15 }, dropRelic), B("ดาบกระชับเข้าหามือคุณแน่นกว่าเดิม", { joy: -5 }), { show: (l) => myRelic(l)?.id === "grief" }),
    C("เก็บไว้ก่อน", N("ยังไม่ถึงเวลาปล่อยมือ")),
  ]),
  E("ft.legend_tale", [8, 400], (l, c) => { const g = tale(l, c); const tall = g.retold >= 3; return `นักกวีพเนจรขับลำนำเรื่อง${g.name}ผู้${g.deed}${tall ? ` ${EXAGGERATE[(g.retold + g.year) % EXAGGERATE.length]}` : ""} เมื่อปี ${g.year}${tall ? " ทั้งร้านเชื่อทุกคำ แม้เรื่องจะยาวกว่าที่เคยได้ยินทุกครั้ง" : ""}`; }, [
    C("ฟังจนจบแล้วโยนเหรียญให้", G("คุณเดินกลับบ้านโดยคิดว่าวันหนึ่งคงมีเพลงของคุณบ้าง", { joy: 4 })),
    C("เถียงว่าเรื่องจริงไม่ได้เป็นแบบนั้น", N("ทั้งร้านโห่ใส่ ไม่มีใครอยากฟังเรื่องจริง", { iq: 1 })),
    K("ตามรอยตำนานไปดูเอง", "luck", 45, G("ที่ปลายทางมีร่องรอยจริงอยู่ และมันชี้ไปหาอาวุธที่ยังหายสาบสูญ", { magic: 3, body: 3 }, (l) => { const r = lost(l)[0]; if (r) fl(l).clues[r.id] = (fl(l).clues[r.id] ?? 0) + 1; }), N("ปลายทางเหลือแต่ป้ายบอกทางให้นักท่องเที่ยว")),
  ], { when: (l) => worldOfLife(l).legends.some((g) => g.lifeId !== l.id), weight: 6, maxTimes: 4, title: "ลำนำตำนาน", prepare: (l) => { const all = worldOfLife(l).legends.map((g, i) => [g, i] as const).filter(([g]) => g.lifeId !== l.id); const [g, i] = pick(l, all); g.retold++; return { g: i }; } }),
  E("ft.relic_rumor", [14, 400], (l) => `พ่อค้าเร่กระซิบว่ามีคนเห็น${pick(l, lost(l)).name}ที่${pick(l, kingdomsOf(l)).name}`, [C("จดเก็บไว้", G("อาจเป็นเรื่องโกหก แต่เรื่องโกหกดีๆ ก็มักมีเค้า", { iq: 1 })), C("หัวเราะแล้วดื่มต่อ", N("ทุกคนในร้านเล่าเรื่องนี้มาสิบปีแล้ว"))], { when: (l) => lost(l).length > 0, weight: 5, maxTimes: 3, title: "ข่าวเล่าลือ" }),
];

function clue(l: Life, c: Ctx) {
  const r = R(l, c), f = fl(l);
  f.clues[r.id] = (f.clues[r.id] ?? 0) + 1;
  if (f.clues[r.id] >= NEED_CLUES) runEvent(l, "ft.relic_trial", { relic: r.id });
}

export const loadLegends = () => { ACTIVITIES.push(...ACTS); };
