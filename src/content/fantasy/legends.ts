// มังกรและอาวุธตำนาน: อยู่ในโลกจริง คนอื่นแย่งได้ และตามหาได้หลายวิธี
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Ctx, GameEvent } from "../../engine/events";
import { runEvent } from "../../engine/game";
import { pick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame } from "../../engine/util";
import { recordChronicle } from "../../engine/worldState";
import { B, BIG, C, E, G, K, N, P, SCENE } from "./kit";
import { fightOdds } from "./power";
import { dataOf, deed, fl, homeKingdom, kingdomsOf, relicOf, worldOfLife, type Relic } from "./state";

export const NEED_CLUES = 4;
const TRIAL_THREAT = 58;
const SEEK_WAIT = 1;
export const DRAGON_THREAT = 105;
const dragon = (l: Life) => dataOf(l).dragon;
const lost = (l: Life) => dataOf(l).relics.filter((r) => r.holder !== "player");
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
}

const ACTS: Activity[] = [
  { id: "ft_legend", emoji: "", name: "สืบหาอาวุธตำนาน", desc: "ตามร่องรอยในหอสมุดและซากเมือง", minAge: 16, time: 2, world: "fantasy", group: "ผจญภัย", available: (l) => !fl(l).relic && lost(l).length > 0 && l.age >= Number(l.flags.ftSeekNext ?? 0), run: (l) => { l.flags.ftSeekNext = l.age + SEEK_WAIT; runEvent(l, "ft.legend_trail", { relic: chase(l).id }); return { text: "" }; } },
  { id: "ft_dragon", emoji: "", name: "ขึ้นเขาไปหามังกร", desc: "อันตรายมาก", minAge: 18, time: 2, world: "fantasy", group: "ผจญภัย", available: (l) => dragon(l).alive, run: (l) => { runEvent(l, "ft.dragon_meet"); return { text: "" }; } },
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

  SCENE("ft.dragon_meet", "ยอดเขาเงิน", (l) => `มังกร${dragon(l).name}${dragon(l).title} ลืมตาข้างหนึ่งมองคุณ ลมหายใจของมันทำหิมะละลายไปทั้งลาน`, [
    P("ท้าสู้เพื่อสังหารมังกร", (l) => fightOdds(l, DRAGON_THREAT) + (fl(l).relic === "wyrmsbane" ? 0.25 : 0), BIG((l) => `คุณยืนอยู่บนซากมังกร${dragon(l).name} ทั่วแผ่นดินจะเล่าเรื่องนี้ไปอีกพันปี`, { fame: 40, joy: 15, body: 20 }, (l) => { const d = dragon(l); d.alive = false; d.slainBy = l.firstName; deed(l, `สังหารมังกร${d.name}`); recordChronicle(worldOfLife(l), `${l.firstName}สังหารมังกร${d.name}`); }), B("ไฟมังกรเผาโลกของคุณจนขาว", { die: "ถูกเผาโดยมังกร" }), { tone: "danger", survival: (l) => fightOdds(l, DRAGON_THREAT) }),
    K("สนทนาอย่างผู้มีปัญญา", "smarts", 60, G("มังกรหัวเราะจนหินร่วง \"มนุษย์ที่พูดรู้เรื่อง หายากกว่าทองเสียอีก\"", { iq: 2, magic: 8 }, (l) => { fl(l).dragonBond += 25; dragon(l).mood += 5; }), B("มันไม่สนใจ แล้วหางของมันก็ปัดคุณลงจากลาน", { hp: -15 })),
    C("ถวายของกำนัลแล้วขอพร", G("มังกรรับทองคำไว้โดยไม่พูดอะไร แต่ปล่อยให้คุณเดินกลับไปได้", { gold: -20 }, (l) => { fl(l).dragonBond += 10; }), { req: (l) => (l.money < 2000 ? "ต้องมี 20 เหรียญทอง" : undefined) }),
    P("ขอเป็นเพื่อนร่วมทาง", (l) => (fl(l).dragonBond - 30) / 60 + (l.stats.luck - 50) / 200, BIG((l) => `${dragon(l).name}ลดคอลงให้คุณปีนขึ้นหลัง เมฆทั้งหมดอยู่ใต้เท้าคุณ`, { fame: 25, joy: 20 }, (l) => { l.flags.dragonRider = true; deed(l, `เป็นสหายของมังกร${dragon(l).name}`); recordChronicle(worldOfLife(l), `${l.firstName}ขี่มังกร${dragon(l).name}เหนือท้องฟ้า`); }), N("มันพ่นควันใส่หน้าคุณเบาๆ \"ยังไม่ถึงเวลา\""), { show: (l) => fl(l).dragonBond >= 30 && !l.flags.dragonRider }),
    C("หนีลงเขา", N("คุณไม่เคยวิ่งเร็วเท่านี้มาก่อน", { hp: -2 })),
  ]),
  E("ft.dragon_raid", [10, 400], (l) => `เงาปีกมหึมาผ่านเมือง มังกร${dragon(l).name}บินลงมาเผายุ้งฉางของ${homeKingdom(l).name}`, [
    P("ขึ้นกำแพงต่อสู้", (l) => fightOdds(l, 70), G("คุณทำให้มันถอยไปจากกำแพง เมืองจารึกชื่อคุณ", { fame: 15, body: 8 }, (l) => deed(l, "ปกป้องเมืองจากมังกร")), B("เปลวไฟเลียแขนคุณจนไหม้", { hp: -20 })),
    C("พาคนหนีลงใต้ดิน", G("คุณพาเด็กๆ ลงห้องเก็บไวน์ ทุกคนรอด", { fame: 5, joy: 3 })),
    C("คว้าของมีค่าแล้วหนี", N("คุณรอด ของรอด แต่ไม่มีใครลืมว่าคุณทิ้งเพื่อนบ้าน", { gold: 15, fame: -5 })),
  ], { when: (l) => dragon(l).alive && dragon(l).home === fl(l).kingdom && dragon(l).mood < 10, weight: 5, maxTimes: 4, title: "มังกรมาเยือน" }),
  E("ft.relic_rumor", [14, 400], (l) => `พ่อค้าเร่กระซิบว่ามีคนเห็น${pick(l, lost(l)).name}ที่${pick(l, kingdomsOf(l)).name}`, [C("จดเก็บไว้", G("อาจเป็นเรื่องโกหก แต่เรื่องโกหกดีๆ ก็มักมีเค้า", { iq: 1 })), C("หัวเราะแล้วดื่มต่อ", N("ทุกคนในร้านเล่าเรื่องนี้มาสิบปีแล้ว"))], { when: (l) => lost(l).length > 0, weight: 5, maxTimes: 3, title: "ข่าวเล่าลือ" }),
];

function clue(l: Life, c: Ctx) {
  const r = R(l, c), f = fl(l);
  f.clues[r.id] = (f.clues[r.id] ?? 0) + 1;
  if (f.clues[r.id] >= NEED_CLUES) runEvent(l, "ft.relic_trial", { relic: r.id });
}

export const loadLegends = () => { ACTIVITIES.push(...ACTS); };
