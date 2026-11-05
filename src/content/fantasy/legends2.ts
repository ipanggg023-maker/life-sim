// ตำนาน (Release 15): อาวุธตำนานชิ้นใหม่และเอ็กซ์คาลิเบอร์ในหิน · อาวุธตำนานใช้ได้จริงในฉากต่อสู้ มีเรื่องเฉพาะตัว มีใจและมีราคา
// ตีอาวุธตำนานของตัวเอง สิ่งมหัศจรรย์ที่ซ่อนอยู่ คำทำนายที่อาจผิด ภัยพิบัติของโลกที่กินเวลาหลายชีวิต ความจริงของโลกที่ค้นพบทีละชิ้น
// คำอธิษฐานใหญ่ที่เทพตอบพร้อมราคา และวิญญาณวีรชนในอดีต
import { ACTIVITIES, activityFilters, type Activity } from "../../engine/activities";
import { sceneExtras, type Choice, type Ctx, type GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { chance, pick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, displayName, log } from "../../engine/util";
import { recordChronicle } from "../../engine/worldState";
import { B, BIG, C, E, G, GOLD, K, N, P, SCENE } from "./kit";
import { fightOdds } from "./power";
import { addStanding, dataOf, deed, fl, homeKingdom, myRelic, passRelic, standingOf, worldOfLife, type FData, type Relic } from "./state";
import { lean, personaOf } from "./persona";
import { cityOf } from "./cities";
import { craftRank } from "./power2";
import { isFight } from "./danger";
import { flying } from "./creatures";
import { throneOf } from "./realm";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
const gold = (l: Life) => Math.floor(l.money / GOLD);
const jailed = (l: Life) => Number(l.flags.jailUntil ?? -1) > l.age;
const after = (e: GameEvent, fn: (l: Life, c: Ctx) => void): GameEvent => ({ ...e, choices: e.choices?.map((ch) => ({ ...ch, run: (l, c, ok) => { fn(l, c); return ch.run(l, c, ok); } })) });
const D = (l: Life) => dataOf(l) as FData;

// ───────────── อาวุธตำนานชิ้นใหม่ ─────────────
export const NEW_RELICS: Relic[] = [
  { id: "excalibur", name: "เอ็กซ์คาลิเบอร์", power: "ดาบในหินที่มีแต่ผู้คู่ควรแก่บัลลังก์จะดึงออกได้", holder: "stone", at: "aldria", bonus: 22, trial: "heart" },
  { id: "crescent", name: "ธนูจันทร์เสี้ยว", power: "ลูกศรไม่เคยพลาดเป้าในคืนที่มีจันทร์", holder: "lost", at: "varn", bonus: 14, trial: "wit" },
  { id: "cleaver", name: "ขวานผ่าภูผา", power: "ขวานที่ผ่าภูเขาให้เป็นช่องเขาได้ในหนึ่งครั้ง", holder: "lost", at: "varn", bonus: 16, trial: "combat" },
  { id: "starforge", name: "ค้อนหลอมดารา", power: "ค้อนที่ตีเหล็กจากดาวตก ใครถือตีของได้ดีกว่าช่างทั้งแผ่นดิน", holder: "lost", at: "aldria", bonus: 13, trial: "wit" },
  { id: "twilight", name: "มีดคู่เงาสนธยา", power: "มีดคู่ที่หายไปในเงา และกระซิบว่าใครโกหก", holder: "lost", at: "thalos", bonus: 13, trial: "wit" },
  { id: "bulwark", name: "โล่ปราการนิรันดร์", power: "โล่ที่ไม่เคยแตก ผู้ถือไม่ตายในศึกที่ยืนปกป้องคนอื่น", holder: "lost", at: "varn", bonus: 12, trial: "heart" },
  { id: "dragonheart", name: "สนับมือหัวใจมังกร", power: "สนับมือที่ตีจากหัวใจมังกรที่ตายแล้ว ทุกหมัดร้อนเหมือนเปลวไฟ", holder: "lost", at: "thalos", bonus: 15, trial: "combat" },
  { id: "chronos", name: "คทาห้วงกาล", power: "คทาที่ให้ผู้ถือเห็นอนาคตหนึ่งปีข้างหน้า แต่กินเวลาของชีวิต", holder: "lost", at: "aldria", bonus: 12, trial: "wit" },
];
/** ใช้ในฉากต่อสู้: ชื่อท่า · ความได้เปรียบ · ราคาที่ต้องจ่าย */
const RELIC_MOVE: Record<string, { act: string; edge: number; cost?: (l: Life) => string }> = {
  veilcutter: { act: "ฟันผ่าเวทของศัตรู", edge: 0.12 },
  dawnchoice: { act: "ชูดาบให้แสงอรุณส่อง", edge: 0.12 },
  wyrmsbane: { act: "พุ่งทวนเข้าหาจุดตาย", edge: 0.1 },
  stormcrown: { act: "ประกาศให้ศัตรูยอมจำนน", edge: 0.08 },
  embersoul: { act: "ปล่อยเพลิงนิรันดร์", edge: 0.12, cost: (l) => { addStat(l, "health", -3); return " เพลิงเผามือคุณด้วย"; } },
  grief: { act: "ปล่อยให้ดาบโศกากินเลือด", edge: 0.2, cost: (l) => { addStat(l, "happiness", -6); lean(l, { m: -3 }); return " ดาบกระซิบขอเพิ่มอีก และคุณรู้สึกว่างเปล่า"; } },
  phoenixring: { act: "ปลุกเปลวฟีนิกซ์ในแหวน", edge: 0.08 },
  dragonhorn: { act: "เป่าแตรมังกร", edge: 0.1 },
  excalibur: { act: "ชูเอ็กซ์คาลิเบอร์", edge: 0.18 },
  crescent: { act: "ยิงศรจันทร์เสี้ยว", edge: 0.12 },
  cleaver: { act: "ผ่าพื้นด้วยขวานผ่าภูผา", edge: 0.13 },
  starforge: { act: "ทุบด้วยค้อนหลอมดารา", edge: 0.11 },
  twilight: { act: "หายเข้าไปในเงาสนธยา", edge: 0.12 },
  bulwark: { act: "ยืนบังด้วยโล่ปราการ", edge: 0.08 },
  dragonheart: { act: "ชกด้วยหัวใจมังกร", edge: 0.13 },
  chronos: { act: "มองเห็นท่าต่อไปของศัตรูล่วงหน้า", edge: 0.15, cost: (l) => { fl(l).lifeBonus = (fl(l).lifeBonus ?? 0) - 1; return " คทาห้วงกาลกินเวลาของชีวิตคุณไปหนึ่งปี"; } },
};
const ready = (l: Life) => Number(l.flags.ftRelicUsed ?? -1) !== l.age;

// ───────────── เอ็กซ์คาลิเบอร์ในหิน ─────────────
/** ผู้คู่ควรแก่บัลลังก์: ผู้ครอง ขุนนางในราชสำนัก สายเลือดขุนนาง หรือคนที่แผ่นดินนับถืออย่างสูง */
export const worthy = (l: Life) => !!throneOf(l) || (fl(l).court?.rank ?? 0) >= 3 || l.flags.ftNobleBlood === "known" || standingOf(l) >= 40;
const excal = (l: Life) => D(l).relics.find((r) => r.id === "excalibur");
const STONE = after(E("ft.lg.stone", [14, 900], (l) => `ในลานวิหารเก่าของ${homeKingdom(l).name}มีดาบปักอยู่ในหิน คำจารึกบอกว่า "ผู้ดึงดาบนี้ได้คือผู้ครองแผ่นดินโดยชอบธรรม" ${worthy(l) ? "มือของคุณอุ่นขึ้นเมื่อเข้าใกล้" : "หลายคนลองแล้ว ไม่มีใครขยับมันได้"}`, [
  C("ลองดึงดาบ", (l) => { const r = excal(l)!; if (!worthy(l)) { addStat(l, "happiness", -2); return { text: "ดาบไม่ขยับแม้แต่นิดเดียว ผู้คนรอบลานหัวเราะเบาๆ", kind: "bad" }; } r.holder = "player"; fl(l).relic = r.id; passRelic(worldOfLife(l), r, displayName(l)); deed(l, "ผู้ดึงเอ็กซ์คาลิเบอร์ออกจากหิน"); addFame(l, 20); addStanding(l, 15); recordChronicle(worldOfLife(l), `${displayName(l)}ดึงเอ็กซ์คาลิเบอร์ออกจากหินในลานวิหารแห่ง${homeKingdom(l).name}`); return { text: "ดาบเลื่อนออกจากหินราวกับรอคุณมาตลอด ลานวิหารเงียบกริบ แล้วทุกคนคุกเข่าลง", kind: "milestone" }; }, { show: (l) => !fl(l).relic }),
  C("เดินผ่านไป", N("คุณมองดาบในหินแล้วเดินต่อ บางสิ่งรอเวลาของมัน")),
], { title: "ดาบในหิน", when: (l) => on(l) && excal(l)?.holder === "stone" && excal(l)!.at === homeKingdom(l).id && l.age - Number(l.flags.ftStoneAt ?? -99) >= 10, weight: 12, maxTimes: 0 }), (l) => { l.flags.ftStoneAt = l.age; });

// ───────────── เรื่องเฉพาะของอาวุธแต่ละชิ้น ─────────────
const holds = (id: string) => (l: Life) => on(l) && fl(l).relic === id;
const RE = (id: string, title: string, text: string, choices: Choice[]) => after(E(`ft.lg.r_${id}`, [14, 900], text, choices, { title, when: holds(id), weight: 25, maxTimes: 1 }), () => {});
const RELIC_EVENTS: GameEvent[] = [
  RE("veilcutter", "ประตูผนึกเวท", "ประตูหินที่ถูกผนึกเวทมาพันปีขวางทางลงห้องสมบัติใต้ภูเขา ดาบผ่ามิติรัตติกาลสั่นในฝัก", [C("ฟันผนึก", G("ผนึกขาดเป็นสองท่อน ห้องสมบัติเต็มไปด้วยตำราเวทที่หายไป", { magic: 15, gold: 40 })), C("ปล่อยให้มันหลับต่อไป", N("บางประตูถูกปิดไว้มีเหตุผล", {}, (l) => lean(l, { c: -2 })))]),
  RE("dawnchoice", "ดาบที่ไม่ยอมชัก", "คนที่คุณถูกจ้างให้ฆ่ายืนอยู่ตรงหน้า แต่ดาบสุริยันไม่ยอมออกจากฝัก", [C("ฟังดาบ แล้วถามเขาว่าเกิดอะไรขึ้น", G("เขาไม่ผิด และคนจ้างคือคนผิด ดาบเรืองแสงอุ่นในมือคุณ", { fame: 3 }, (l) => lean(l, { m: 5, h: 3 }))), C("ฝืนชักดาบออกมา", B("ดาบหลุดจากมือคุณและหายไปในแสงอรุณ มันไม่เลือกคุณอีกแล้ว", {}, (l) => { const r = myRelic(l)!; r.holder = "lost"; r.at = homeKingdom(l).id; fl(l).relic = undefined; }))]),
  RE("wyrmsbane", "กลิ่นของทวน", "มังกรหนุ่มตัวหนึ่งได้กลิ่นทวนพิฆาตมังกรจากอีกฟากหุบเขา มันบินตรงมาด้วยความกลัวและความโกรธ", [P("สู้กับมัน", (l) => fightOdds(l, 55) + 0.25, BIG("ทวนแทงทะลุเกล็ด และมังกรหนุ่มร่วงลงหุบเขา", { fame: 10 }, (l) => deed(l, "ผู้ปลิดชีพมังกรหนุ่มด้วยทวนพิฆาตมังกร")), B("มังกรพ่นไฟก่อนบินหนีไป", { hp: -16 })), C("วางทวนลงแล้วยกมือเปล่า", G("มังกรหนุ่มลังเลนาน แล้วบินจากไป คืนนั้นคุณรู้ว่าทวนนี้ไม่ได้มีไว้ฆ่าทุกตัว", {}, (l) => { fl(l).dragonBond += 10; lean(l, { m: 4 }); }))]),
  RE("stormcrown", "สภาที่ทะเลาะกัน", "สภาของแผ่นดินแตกเป็นสองฝ่ายจนเกือบเกิดสงครามกลางเมือง ทุกคนหันมามองมงกุฏราชันอัสนีบนหัวคุณ", [C("ลุกขึ้นพูด", BIG("ทั้งสภาเงียบฟัง และเมื่อคุณพูดจบ ทั้งสองฝ่ายจับมือกัน", { fame: 6 }, (l) => { const k = homeKingdom(l); k.stability = clamp(k.stability + 15, 5, 95); addStanding(l, 6); })), C("ปล่อยให้พวกเขาตัดสินกันเอง", N("สภาทะเลาะกันอีกสามเดือน", {}, (l) => { const k = homeKingdom(l); k.stability = clamp(k.stability - 5, 5, 95); }))]),
  RE("embersoul", "เพลิงที่หิว", "คทาวิญญาณเพลิงนิรันดร์ร้อนขึ้นทุกคืน มันอยากเผาบางอย่าง", [C("เผาป่าต้องคำสาปทางเหนือ", G("ป่าคำสาปมอดไหม้ และหมู่บ้านทางเหนือปลอดภัยเป็นครั้งแรกในรอบร้อยปี", { fame: 4, magic: 8 })), K("ข่มเพลิงไว้ด้วยใจ", "happiness", 60, G("เพลิงสงบลงในมือคุณ คุณกับคทาเข้าใจกันมากขึ้น", { magic: 6 }), B("เพลิงลามขึ้นแขนก่อนจะยอมสงบ", { hp: -10 }))]),
  RE("grief", "เสียงกระซิบของดาบ", "ดาบคำสาปแห่งความโศกากระซิบชื่อคนในครอบครัวของคุณตอนกลางคืน มันอยากได้เลือดที่คุณรัก", [C("โยนดาบลงแม่น้ำ", G("ดาบจมลงไป และคืนนั้นเป็นคืนแรกในรอบหลายปีที่คุณหลับสนิท", { joy: 10 }, (l) => { const r = myRelic(l)!; r.holder = "lost"; r.at = homeKingdom(l).id; fl(l).relic = undefined; lean(l, { m: 4 }); })), C("เก็บดาบไว้ แล้วไม่กลับบ้าน", N("คุณนอนในโรงเตี๊ยมทั้งปี ครอบครัวไม่เข้าใจว่าทำไม", { joy: -8 }, (l) => { for (const p of l.people) if (p.alive && ["spouse", "child"].includes(p.relation)) p.bond = clamp(p.bond - 10, 0, 100); }))]),
  RE("phoenixring", "แหวนในงานศพ", "ในงานศพของเด็กชาวบ้าน แหวนวิญญาณฟีนิกซ์ร้อนวาบบนนิ้วคุณ มันมีพลังพอจะปลุกคนตายได้หนึ่งครั้ง", [C("ใช้พลังของแหวน", BIG("เด็กคนนั้นลืมตาขึ้นท่ามกลางเสียงกรีดร้อง แหวนแตกเป็นเถ้าในมือคุณ", { fame: 8 }, (l) => { const r = myRelic(l)!; r.holder = "lost"; r.at = homeKingdom(l).id; fl(l).relic = undefined; fl(l).threads = Math.max(0, fl(l).threads - 1); lean(l, { m: 6 }); deed(l, "ผู้ปลุกเด็กคนหนึ่งจากความตายด้วยแหวนฟีนิกซ์"); })), C("เก็บพลังไว้", N("คุณกำมือแน่นจนแหวนเย็นลง และไม่กล้ามองแม่ของเด็ก", { joy: -5 }))]),
  RE("dragonhorn", "เสียงเรียกจากหุบเขา", "แตรมังกรสั่นเองตอนรุ่งสาง มีมังกรที่หลงทางกำลังเรียกหาใครสักคน", [C("เป่าแตรตอบ", G("มังกรแก่ตาบอดบินลงมาหาคุณ และพักที่ลานบ้านคุณทั้งฤดูหนาวก่อนจากไป", { joy: 6 }, (l) => { fl(l).dragonBond += 20; })), C("เก็บแตรไว้เงียบๆ", N("เสียงเรียกค่อยๆ จางหายไปทางเหนือ"))]),
  RE("excalibur", "ราชาตัวปลอม", "ชายคนหนึ่งอ้างว่าเป็นทายาทแท้ของแผ่นดิน และรวบรวมกองทัพ ผู้คนถามว่าทำไมคนที่ถือเอ็กซ์คาลิเบอร์ยังเงียบอยู่", [P("นำทัพไปเผชิญหน้า", (l) => fightOdds(l, 45) + 0.18, BIG("กองทัพของเขาวางอาวุธเมื่อเห็นเอ็กซ์คาลิเบอร์ส่องแสง", { fame: 10 }, (l) => { const k = homeKingdom(l); k.stability = clamp(k.stability + 12, 5, 95); deed(l, "ผู้ใช้เอ็กซ์คาลิเบอร์หยุดสงครามกลางเมือง"); }), B("ศึกยืดเยื้อ คุณชนะแต่เสียคนไปมาก", { hp: -12 })), C("ส่งดาบให้คนที่คู่ควรกว่า", G("คุณวางดาบกลับคืนหิน มันรอผู้ครองคนต่อไป", { fame: 4 }, (l) => { const r = myRelic(l)!; r.holder = "stone"; r.at = homeKingdom(l).id; fl(l).relic = undefined; lean(l, { h: 4 }); }))]),
  RE("crescent", "เงาจันทร์บนน้ำ", "ในคืนเดือนเต็มดวง ธนูจันทร์เสี้ยวชี้ไปที่เงาจันทร์บนทะเลสาบ มีบางอย่างซ่อนอยู่ใต้น้ำ", [C("ยิงศรลงเงาจันทร์", G("น้ำแยกออก เผยให้เห็นหีบเงินของราชินีโบราณ", { gold: 60, luck: 2 })), C("เก็บศรไว้", N("เงาจันทร์จางลงเมื่อเมฆบังดวงจันทร์"))]),
  RE("cleaver", "ช่องเขาที่ปิดตาย", "หิมะถล่มปิดช่องเขาเพียงทางเดียวที่เชื่อมสองแผ่นดิน กองคาราวานติดอยู่ทั้งหน้าหนาว", [C("ผ่าภูเขาให้เป็นทางใหม่", BIG("ขวานผ่าภูผาฟันลงครั้งเดียว ภูเขาแยกเป็นทางกว้างพอให้เกวียนสามคันวิ่งคู่กัน", { fame: 8 }, (l) => { deed(l, "ผู้ผ่าภูเขาเป็นช่องเขาใหม่"); const k = homeKingdom(l); k.prosperity = clamp((k.prosperity ?? 100) + 8, 40, 160); })), C("ช่วยขุดหิมะด้วยมือ", G("คุณขุดกับทุกคนจนเปิดทางได้ในสามสัปดาห์", { joy: 4 }))]),
  RE("starforge", "ดาวตก", "ดาวตกดวงหนึ่งตกลงในทุ่งนอกเมือง เหล็กข้างในยังร้อนแดง ค้อนหลอมดาราสั่นในมือคุณ", [C("ตีอาวุธจากเหล็กดาว", BIG("อาวุธที่ได้เบาเหมือนขนนกและคมเหมือนแสง", { fame: 5 }, (l) => { fl(l).weapon = { name: "อาวุธจากเหล็กดาวตก", quality: 5, named: true }; })), C("ขายเหล็กดาวให้หอเวท", G("หอเวทจ่ายราคาที่คุณไม่กล้าพูดออกมา", { gold: 80 }))]),
  RE("twilight", "คนโกหกในห้อง", "ในงานเลี้ยงของขุนนาง มีดคู่เงาสนธยากระซิบว่ามีคนในห้องนี้วางยาในถ้วยของผู้ครอง", [K("หาตัวคนวางยา", "smarts", 50, BIG("คุณจับมือคนวางยาได้ก่อนเขาจะเทลงถ้วย ผู้ครองติดหนี้ชีวิตคุณ", { fame: 6 }, (l) => { addStanding(l, 10); }), B("คุณชี้ผิดคน และคนผิดหนีไปได้", {}, (l) => addStanding(l, -4))), C("ทำเป็นไม่ได้ยิน", N("เช้าวันรุ่งขึ้นทั้งเมืองไว้ทุกข์", {}, (l) => lean(l, { m: -4 })))]),
  RE("bulwark", "ประตูเมืองแตก", "ประตูเมืองแตกกลางศึก และมีเด็กสิบคนติดอยู่ข้างหลังคุณ", [C("ยืนบังด้วยโล่ปราการ", BIG("ลูกธนูนับร้อยตกลงบนโล่ แต่ไม่มีดอกไหนผ่าน เด็กทั้งสิบรอด", { fame: 8 }, (l) => { deed(l, "ผู้ยืนบังประตูเมืองด้วยโล่ปราการนิรันดร์"); lean(l, { c: 5, m: 5 }); })), C("พาเด็กหนีทางท่อน้ำ", G("ทุกคนรอด แต่ประตูเมืองถูกยึด", { joy: 2 }))]),
  RE("dragonheart", "มังกรท้ามือเปล่า", "มังกรแก่ได้กลิ่นหัวใจของญาติมันในสนับมือ มันท้าคุณสู้มือเปล่าเพื่อชิงคืน", [P("รับคำท้า", (l) => fightOdds(l, 60) + 0.13, BIG("หมัดสุดท้ายของคุณทำให้มังกรล้มลง มันยอมรับว่าหัวใจนั้นอยู่ในมือที่คู่ควร", { fame: 12 }, (l) => deed(l, "ผู้ชนะมังกรด้วยมือเปล่า")), B("มังกรตบคุณกระเด็น แต่ไม่ฆ่า มันบอกว่าจะกลับมาอีก", { hp: -20 })), C("คืนสนับมือให้มัน", G("มังกรรับหัวใจของญาติไปฝัง และทิ้งเกล็ดหนึ่งเกล็ดไว้ให้คุณ", { joy: 6 }, (l) => { const r = myRelic(l)!; r.holder = "lost"; r.at = homeKingdom(l).id; fl(l).relic = undefined; fl(l).dragonBond += 25; }))]),
  RE("chronos", "หนึ่งปีข้างหน้า", "คทาห้วงกาลเปิดภาพหนึ่งปีข้างหน้าให้คุณเห็น: คนที่คุณรักป่วยหนัก", [C("เตรียมยาและหมอไว้ล่วงหน้า", G("เมื่อไข้มาถึงจริง ทุกอย่างพร้อมแล้ว และเขารอด", { joy: 6 }, (l) => addMoney(l, -10 * GOLD))), C("ไม่เชื่อภาพนั้น", N("คุณบอกตัวเองว่ามันเป็นแค่ความฝัน", {}, (l) => lean(l, { c: 2 })))]),
];

// ───────────── ตีอาวุธตำนานของตัวเอง ─────────────
export const FORGE_GOLD = 200, FORGE_SMITH = 5;
const FORGE = SCENE("ft.lg.forge", "งานชิ้นสุดท้ายของชีวิต", `คุณมีฝีมือพอจะตีอาวุธที่โลกจะจำได้ แต่มันต้องการวัตถุดิบหายาก (${FORGE_GOLD} เหรียญทอง) และการเสียสละครั้งใหญ่`, [
  ...([["สิบปีของชีวิต", (l: Life) => { fl(l).lifeBonus = (fl(l).lifeBonus ?? 0) - 10; }], ["ความสุขที่เหลือทั้งหมด", (l: Life) => addStat(l, "happiness", -40)], ["ชื่อเสียงทั้งหมดที่สะสมมา", (l: Life) => { l.fame = 0; }]] as [string, (l: Life) => void][]).map(([what, pay]) => C(`แลกด้วย${what}`, (l) => {
    addMoney(l, -FORGE_GOLD * GOLD); pay(l);
    const r: Relic = { id: `forged_${l.lastName}_${l.age}`, name: `${pick(l, ["ดาบ", "ค้อน", "หอก", "ขวาน"])}แห่งตระกูล${l.lastName}`, power: `อาวุธที่${displayName(l)}ตีด้วย${what}`, holder: "player", at: homeKingdom(l).id, bonus: 16, trial: "heart" };
    D(l).relics.push(r); fl(l).relic = r.id; passRelic(worldOfLife(l), r, `${displayName(l)}ตีขึ้น`);
    deed(l, `ผู้ตี${r.name}`); recordChronicle(worldOfLife(l), `${displayName(l)}ตี${r.name}ด้วย${what}`);
    return { text: `${r.name}เย็นลงในน้ำค้างตอนรุ่งสาง โลกมีอาวุธตำนานเพิ่มอีกหนึ่งชิ้น และมันมีชื่อของคุณ`, kind: "milestone" as const };
  }, { req: (l) => (l.money < FORGE_GOLD * GOLD ? `ต้องมี ${FORGE_GOLD} เหรียญทอง` : undefined) })),
  C("ยังไม่ถึงเวลา", N("คุณเก็บภาพร่างไว้ในลิ้นชัก")),
]);

// ───────────── สิ่งมหัศจรรย์ที่ซ่อนอยู่ (คนเดียวต่อโลก) ─────────────
export const WONDERS: Record<string, { name: string; need: (l: Life) => boolean; hint: string; reward: (l: Life) => string }> = {
  lostcity: { name: "นครที่สาบสูญ", need: (l) => Object.keys(fl(l).bestiary ?? {}).length >= 3 || l.stats.smarts >= 70, hint: "ต้องรู้จักโลกมากพอ (สมุดสัตว์อสูรหรือสติปัญญาสูง)", reward: (l) => { addMoney(l, 120 * GOLD); return "ทองของนครที่สาบสูญมากพอจะซื้อเมืองทั้งเมือง"; } },
  sunken: { name: "วิหารใต้สมุทร", need: (l) => cityOf(l).kind === "port", hint: "ต้องอยู่เมืองท่า", reward: (l) => { fl(l).magic += 30; return "ตำราเวทของวิหารใต้สมุทรยังอ่านได้ทุกหน้า"; } },
  skyisle: { name: "เกาะลอยฟ้า", need: (l) => !!flying(l), hint: "ต้องมีสัตว์ขี่ที่บินได้หรือมังกร", reward: (l) => { addStat(l, "health", 20); return "อากาศบนเกาะลอยฟ้าทำให้ร่างกายคุณหนุ่มขึ้นสิบปี"; } },
  worldtree: { name: "ต้นไม้แรกของโลก", need: (l) => cityOf(l).kind === "forest" && personaOf(l).m >= 20, hint: "ต้องอยู่ป่าเก่าและมีใจเมตตา", reward: (l) => { fl(l).lifeBonus = (fl(l).lifeBonus ?? 0) + 15; return "ต้นไม้แรกของโลกให้ใบไม้หนึ่งใบแก่คุณ ชีวิตคุณยาวขึ้นสิบห้าปี"; } },
};
const wonders = (l: Life) => (D(l).wonders ??= {});
/** ต้องมีเบาะแสก่อน: แผนที่จากของที่เก็บได้ คำตอบของสฟิงซ์ หรือความจริงของโลกสองเรื่อง */
export const hasLead = (l: Life) => !!l.flags.ftMapFound || (D(l).lore?.length ?? 0) >= 2;
const WONDER_EV = SCENE("ft.lg.wonder", "สิ่งมหัศจรรย์ที่ซ่อนอยู่", "จากเบาะแสในแผนที่เก่า บันทึกของนักเดินทาง และเรื่องเล่าในโรงเตี๊ยม คุณรู้ว่าสิ่งมหัศจรรย์ของโลกซ่อนอยู่ที่ไหน มีคนเดียวต่อโลกที่จะได้ไปถึง", [
  ...Object.entries(WONDERS).map(([k, w]) => C((l) => `${w.name}${wonders(l)[k] ? ` · ${wonders(l)[k]}ไปถึงแล้ว` : w.need(l) ? "" : ` · ${w.hint}`}`, (l) => { wonders(l)[k] = displayName(l); deed(l, `ผู้ค้นพบ${w.name}`); addFame(l, 15); recordChronicle(worldOfLife(l), `${displayName(l)}ค้นพบ${w.name}`); return { text: `คุณยืนอยู่หน้า${w.name}เป็นคนแรกในรอบพันปี ${w.reward(l)}`, kind: "milestone" as const }; }, { req: (l) => (wonders(l)[k] ? "มีคนค้นพบไปแล้วในโลกนี้" : !w.need(l) ? w.hint : undefined) })),
  C("ยังไม่ออกเดินทาง", N("คุณม้วนแผนที่เก็บ")),
]);

// ───────────── คำทำนาย ─────────────
const PROPHECY = after(E("ft.lg.prophecy", [14, 60], (l) => `หญิงชราตาบอดจับมือคุณกลางตลาด "ดาวหางปีนี้ชี้ไปที่คนหนึ่งในเมืองนี้ คนที่จะ${pick(l, ["โค่นบัลลังก์", "ฆ่ามังกรตัวสุดท้าย", "ช่วยแผ่นดินจากความอดอยาก"])} อาจเป็นเจ้า หรืออาจเป็นคนที่เจ้าเกลียดที่สุด"`, [
  C("เชื่อและออกตามหาชะตา", G("คุณออกเดินทางทั้งที่ไม่รู้ว่าจะไปไหน และสิ่งที่พบทำให้คุณกลายเป็นคนใหม่", { fame: 3, body: 6, magic: 6 }, (l) => { l.flags.ftProphecy = "chased"; lean(l, { c: 4, f: 3 }); })),
  C("ไม่เชื่อ ชะตาเป็นของเราเอง", N("หญิงชรายิ้มแล้วปล่อยมือ \"คนที่ปฏิเสธคำทำนายก็ทำให้มันเป็นจริงได้เหมือนกัน\"", {}, (l) => { l.flags.ftProphecy = "defied"; lean(l, { f: -4 }); })),
  C("ป่าวประกาศว่าคำทำนายพูดถึงคุณ", (l) => { lean(l, { h: -5 }); addFame(l, 8); if (chance(l, 0.4)) { addStanding(l, -10); return { text: "ผู้คนตามคุณอยู่หลายปี จนมีคนพบว่าคุณแต่งเรื่องขึ้นมา", kind: "bad" }; } return { text: "ผู้คนเชื่อ และเริ่มเรียกคุณว่าผู้ถูกเลือก", kind: "good" }; }),
], { title: "คำทำนาย", when: (l) => on(l) && !l.flags.ftProphecy, weight: 4, maxTimes: 1 }), () => {});

// ───────────── ภัยพิบัติของโลกที่กินเวลาหลายชีวิต ─────────────
export const CRISES: Record<string, { name: string; start: string; win: string; lose: string }> = {
  demon: { name: "การบุกของปีศาจ", start: "รอยแยกสู่ภพปีศาจเปิดออกทางเหนือ และไม่ยอมปิดลง", win: "รอยแยกสู่ภพปีศาจถูกปิดลงในที่สุด", lose: "ปีศาจตั้งอาณาจักรของตัวเองทางเหนือ" },
  sun: { name: "ดวงอาทิตย์ที่กำลังดับ", start: "ดวงอาทิตย์หรี่ลงทุกปี ฤดูหนาวยาวขึ้นทุกครั้ง", win: "ดวงอาทิตย์กลับมาสว่างเต็มดวง", lose: "ฤดูหนาวไม่มีวันจบ และแผ่นดินทางเหนือกลายเป็นน้ำแข็ง" },
  goddeath: { name: "เทพที่กำลังตาย", start: "เทพองค์หนึ่งกำลังจะตาย และพรของมันจางลงทั่วโลก", win: "เทพฟื้นขึ้นด้วยศรัทธาของคนทั้งโลก", lose: "เทพองค์นั้นตาย และวิหารของมันกลายเป็นซากปรักหักพัง" },
};
export const CRISIS_START = 0.01, CRISIS_WIN = 5, CRISIS_YEARS = 120;
const crisis = (l: Life) => { const c = D(l).crisis; return c && !c.done ? c : undefined; };
const CRISIS_EV = after(E("ft.lg.crisis", [16, 900], (l) => { const c = crisis(l)!; return `${CRISES[c.kind].name}: ${CRISES[c.kind].start} (โลกต้านไว้ได้ ${c.stage}/${CRISIS_WIN} · ผ่านมา ${worldOfLife(l).year - c.since} ปี)`; }, [
  P("ทุ่มทุกอย่างเพื่อต้านภัย", (l) => clamp(fightOdds(l, 50) + 0.1, 0.1, 0.9), (l) => { const c = crisis(l)!; c.stage++; deed(l, `ผู้ต้าน${CRISES[c.kind].name}`); addFame(l, 6); if (c.stage >= CRISIS_WIN) { c.done = "won"; recordChronicle(worldOfLife(l), `${CRISES[c.kind].win} ด้วยมือของ${displayName(l)}`); return { text: CRISES[c.kind].win, kind: "milestone" }; } return { text: "สิ่งที่คุณทำไม่ได้จบภัยครั้งนี้ แต่โลกเข้าใกล้ชัยชนะอีกก้าว", kind: "good" }; }, B("ภัยพิบัติแรงกว่าที่คุณคิด คุณรอดกลับมาพร้อมแผล", { hp: -15 })),
  C("ช่วยผู้คนที่หนีภัยแทน", G("คุณสร้างที่พักให้ผู้ลี้ภัยหลายร้อยคน", { fame: 2 }, (l) => { addStanding(l, 4); lean(l, { m: 4 }); })),
  C("ใช้ชีวิตต่อไปตามปกติ", N("ภัยยังอยู่ และจะยังอยู่ไปอีกนาน")),
], { title: "ภัยของโลก", when: (l) => on(l) && !!crisis(l) && l.age - Number(l.flags.ftCrisisAt ?? -99) >= 8, weight: 18, maxTimes: 0 }), (l) => { l.flags.ftCrisisAt = l.age; });

// ───────────── ความจริงของโลก (ค้นพบทีละชิ้น ทายาทเก็บไว้ต่อ) ─────────────
export const LORE = [
  "มังกรไม่ได้เกิดจากไข่ตัวแรก แต่เกิดจากเวทมนตร์ที่ไหลล้นออกมาจากใต้ดิน",
  "เวทมนตร์ทั้งโลกไหลมาจากต้นไม้แรก รากของมันอยู่ใต้ทุกแผ่นดิน",
  "แผ่นดินแรกของโลกถูกสร้างโดยมนุษย์และมังกรร่วมกัน ก่อนจะแตกคอ",
  "มังกรจางหายเพราะเวทมนตร์ใต้ดินลดลง ไม่ใช่เพราะถูกล่า",
  "เทพทั้งห้าเคยเป็นมนุษย์ที่ดื่มน้ำจากรากต้นไม้แรก",
  "ทุกคนที่เกิดใหม่ในโลกนี้คือวิญญาณเดิมที่วนกลับมา และโลกจำพวกเขาได้",
];
const lore = (l: Life) => (D(l).lore ??= []);
const LIBRARY = SCENE("ft.lg.library", "หอสมุดเก่า", (l) => `ชั้นใต้ดินของหอสมุดเก่ามีม้วนคัมภีร์ที่ไม่มีใครอ่านออก ตระกูลของคุณจดสิ่งที่รู้ไว้แล้ว ${lore(l).length}/${LORE.length} เรื่อง`, [
  K("ถอดความม้วนคัมภีร์", "smarts", 55, (l) => { const left = LORE.filter((x) => !lore(l).includes(x)); if (!left.length) return { text: "ทุกอย่างในม้วนนี้ คุณรู้อยู่แล้ว" }; const t = pick(l, left); lore(l).push(t); if (lore(l).length === LORE.length) { deed(l, "ผู้รู้ความจริงของโลก"); fl(l).magic += 30; } return { text: `คุณถอดความได้หนึ่งเรื่อง: ${t}`, kind: "milestone" }; }, N("ตัวอักษรเก่าเกินไป คุณอ่านได้แค่คำว่า \"ราก\" ซ้ำไปซ้ำมา")),
  C("กลับขึ้นไปข้างบน", N("ฝุ่นของคัมภีร์ติดเสื้อคุณไปทั้งวัน")),
]);

// ───────────── คำอธิษฐานใหญ่ และวิญญาณวีรชน ─────────────
const PRAYER = SCENE("ft.lg.prayer", "คำอธิษฐานใหญ่", "เทพตอบคำอธิษฐานได้ครั้งเดียวในชีวิต และทุกพรมีราคา", [
  C("ขอให้คนที่รักหายป่วย", (l) => { const p = l.people.find((x) => x.alive && ["spouse", "child", "mother", "father"].includes(x.relation)); if (p) p.bond = clamp(p.bond + 15, 0, 100); addStat(l, "health", 5); l.flags.ftGodPrice = "duty"; return { text: "คนที่คุณรักหายป่วยในคืนเดียว และเทพขอให้คุณถวายส่วนหนึ่งของทุกสิ่งที่หาได้ให้วิหารไปตลอดชีวิต", kind: "milestone" }; }),
  C("ขอความมั่งคั่ง", (l) => { addMoney(l, 150 * GOLD); l.flags.ftGodPrice = "curse"; return { text: "หีบทองปรากฏใต้เตียง และตั้งแต่คืนนั้นไม่มีใครในบ้านหลับสนิทอีกเลย", kind: "milestone" }; }),
  C("ขอให้แผ่นดินชนะสงคราม", (l) => { const k = homeKingdom(l); k.power = clamp(k.power + 20, 5, 95); l.flags.ftGodPrice = "champion"; deed(l, `ผู้อธิษฐานให้${k.name}`); return { text: "ศัตรูถอยทัพในเดือนเดียว และเทพเลือกคุณเป็นนักรบของมัน ทุกศึกต่อจากนี้คุณต้องไป", kind: "milestone" }; }),
  C("ไม่ขออะไร", N("คุณจุดเทียนแล้วเดินออกมา บางคนบอกว่านั่นคือคำอธิษฐานที่ดีที่สุด", { joy: 3 })),
]);
const GHOST_HERO = E("ft.lg.hero", [16, 900], (l) => { const g = pick(l, worldOfLife(l).legends); return `ในคืนหมอกลง วิญญาณของ${g.name} ผู้${g.deed} ปรากฏที่ปลายเตียง "มีเรื่องหนึ่งที่ข้ายังทำไม่เสร็จ"`; }, [
  C("รับปากจะทำต่อ", G("คุณทำสิ่งที่วิญญาณขอจนเสร็จในปีนั้น และฝันถึงรอยยิ้มของเขา", { fame: 3, joy: 5 }, (l) => lean(l, { f: 3 }))),
  C("ถามเรื่องจริงของตำนาน", G("วิญญาณเล่าเรื่องจริงที่ไม่เหมือนที่ใครร้องเพลง คุณจดไว้ให้ลูกหลาน", { iq: 3 })),
  C("ขอให้ไปสู่ที่สงบ", N("วิญญาณพยักหน้าแล้วจางไปกับหมอก")),
], { title: "วิญญาณวีรชน", when: (l) => on(l) && worldOfLife(l).legends.length > 0, weight: 3, maxTimes: 1 });

// ───────────── กิจกรรม ─────────────
const M = (a: Omit<Activity, "world" | "emoji">): Activity => ({ ...a, emoji: "", world: "fantasy" });
const ACTS: Activity[] = [
  M({ group: "ตำนาน", id: "ft_forge_relic", name: "ตีอาวุธตำนานของตัวเอง", desc: `งานชิ้นสุดท้ายของช่างระดับสูงสุด · ${FORGE_GOLD} เหรียญทองกับการเสียสละครั้งใหญ่`, minAge: 30, available: (l) => on(l) && craftRank(l, "smith") >= FORGE_SMITH && !fl(l).relic && !l.flags.ftForged, run: (l) => { l.flags.ftForged = true; runEvent(l, "ft.lg.forge"); return { text: "" }; } }),
  M({ group: "ตำนาน", id: "ft_wonder", name: "ตามหาสิ่งมหัศจรรย์", desc: "นครที่สาบสูญ วิหารใต้สมุทร เกาะลอยฟ้า ต้นไม้แรกของโลก · คนเดียวต่อโลก · ต้องมีแผนที่หรือเบาะแสก่อน", minAge: 18, time: 2, available: (l) => on(l) && !jailed(l) && hasLead(l) && Object.keys(WONDERS).some((k) => !wonders(l)[k]), run: (l) => { runEvent(l, "ft.lg.wonder"); return { text: "" }; } }),
  M({ group: "ตำนาน", id: "ft_library", name: "ค้นหอสมุดเก่า", desc: "ความจริงของโลกทีละชิ้น · ตระกูลเก็บบันทึกไว้ข้ามชีวิต", minAge: 12, available: (l) => on(l) && lore(l).length < LORE.length && ["arcane", "capital"].includes(cityOf(l).kind), run: (l) => { runEvent(l, "ft.lg.library"); return { text: "" }; } }),
  M({ group: "ตำนาน", id: "ft_prayer", name: "อธิษฐานขอสิ่งยิ่งใหญ่", desc: "เทพตอบได้ครั้งเดียวในชีวิต และทุกพรมีราคา", minAge: 16, time: 0, available: (l) => on(l) && !l.flags.ftPrayed, run: (l) => { l.flags.ftPrayed = true; runEvent(l, "ft.lg.prayer"); return { text: "" }; } }),
];

// ───────────── ทุกปี ─────────────
function legendYear(l: Life) {
  if (!on(l) || !l.alive) return;
  const d = D(l), f = fl(l);
  // เซฟเก่า: เพิ่มอาวุธตำนานชิ้นใหม่เข้าโลก
  for (const r of NEW_RELICS) if (!d.relics.some((x) => x.id === r.id)) d.relics.push({ ...r });
  // อาวุธตำนานมีใจ: เลือกเจ้าของต่อเมื่อยังคู่ควร
  const r = myRelic(l), p = personaOf(l);
  const leave = (why: string) => { r!.holder = r!.id === "excalibur" ? "stone" : "lost"; r!.at = homeKingdom(l).id; f.relic = undefined; passRelic(worldOfLife(l), r!, `ทิ้ง${displayName(l)}ไปเพราะ${why}`); log(l, `${r!.name}ทิ้งคุณไป เพราะ${why}`, "bad"); };
  if (r?.id === "excalibur" && p.h <= -30) leave("คุณไม่ซื่อตรงพอจะถือมันอีกแล้ว");
  else if (r?.id === "dawnchoice" && p.m <= -30) leave("มันไม่เลือกคนใจร้าย");
  else if (r?.id === "bulwark" && p.c <= -40) leave("มันไม่อยู่กับคนที่ไม่กล้ายืนปกป้องใคร");
  // ภัยพิบัติของโลก: เริ่มนานๆ ครั้ง · ปล่อยไว้นานเกินไปแล้วโลกแพ้
  const c = d.crisis;
  if (!c && chance(l, CRISIS_START)) { const kind = pick(l, Object.keys(CRISES)); d.crisis = { kind, stage: 0, since: worldOfLife(l).year }; recordChronicle(worldOfLife(l), CRISES[kind].start); log(l, `ข่าวที่ทำให้ทั้งโลกเงียบ: ${CRISES[kind].start}`, "milestone"); }
  else if (c && !c.done && worldOfLife(l).year - c.since >= CRISIS_YEARS) { c.done = "lost"; recordChronicle(worldOfLife(l), CRISES[c.kind].lose); log(l, CRISES[c.kind].lose, "bad"); for (const k of d.kingdoms) k.prosperity = clamp((k.prosperity ?? 100) - 15, 40, 160); }
  // ราคาของคำอธิษฐาน
  if (l.flags.ftGodPrice === "curse" && chance(l, 0.5)) addStat(l, "happiness", -2);
  if (l.flags.ftGodPrice === "champion" && homeKingdom(l).war) { addFame(l, 1); addStat(l, "health", -4); if (chance(l, 0.3)) log(l, "เทพเรียกนักรบของมันไปแนวหน้าอีกปี คุณกลับมาพร้อมแผลและชื่อเสียง", "milestone"); }
  if (l.flags.ftGodPrice === "duty" && chance(l, 0.4)) { addMoney(l, -Math.min(gold(l), 5) * GOLD); }
}

/** ปุ่มใช้อาวุธตำนานในทุกฉากต่อสู้ (ปีละครั้ง) */
function relicExtra(l: Life, scene: { choices: Choice[] }, ctx: Ctx): Choice[] {
  if (!on(l) || !l.alive || !ready(l)) return [];
  const r = myRelic(l), mv = r && RELIC_MOVE[r.id] ? RELIC_MOVE[r.id] : r ? { act: `ใช้พลังของ${r.name}`, edge: 0.1 } : undefined;
  if (!r || !mv) return [];
  const base = scene.choices.find((c) => (!c.show || c.show(l, ctx)) && c.odds && isFight(c));
  if (!base) return [];
  return [{
    label: `${r.name}: ${mv.act}`, tone: "special", odds: (l2, c2) => clamp(base.odds!(l2, c2) + mv.edge, 0.05, 0.97), survival: base.survival,
    run: (l2, c2, ok) => { l2.flags.ftRelicUsed = l2.age; const out = base.run(l2, c2, ok); const extra = mv.cost?.(l2) ?? ""; return { ...out, text: `${r.name}ส่องประกาย · ${out.text}${extra}` }; },
  }];
}

export const LEGEND2_EVENTS: GameEvent[] = [STONE, ...RELIC_EVENTS, FORGE, WONDER_EV, PROPHECY, CRISIS_EV, LIBRARY, PRAYER, GHOST_HERO];

/** เรียกหลังลงทะเบียน event ทั้งหมดแล้ว */
export function loadLegends2() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push(legendYear);
  sceneExtras.push(relicExtra);
  activityFilters.push((l, a) => a.id !== "ft_forge_relic" || craftRank(l, "smith") >= FORGE_SMITH - 1);
  activityFilters.push((l, a) => a.id !== "ft_wonder" || hasLead(l));
}

/** สรุปสำหรับแท็บโลก */
export function legendLines(l: Life): string[] {
  const out: string[] = [], d = D(l), r = myRelic(l);
  if (r) out.push(`ถือ${r.name} · ${r.power}${RELIC_MOVE[r.id] ? ` · ในศึกใช้ได้ปีละครั้ง: ${RELIC_MOVE[r.id].act}` : ""}${r.history?.length ? ` · เจ้าของก่อนหน้า: ${r.history.slice(-3).join(" / ")}` : ""}`);
  const ex = d.relics.find((x) => x.id === "excalibur");
  if (ex?.holder === "stone") out.push(`เอ็กซ์คาลิเบอร์ยังปักอยู่ในหินที่${d.kingdoms.find((k) => k.id === ex.at)?.name ?? "แผ่นดินหนึ่ง"} · ${worthy(l) ? "คุณคู่ควรจะลองดึง" : "รอผู้คู่ควรแก่บัลลังก์"}`);
  const w = Object.entries(d.wonders ?? {});
  if (w.length) out.push(`สิ่งมหัศจรรย์ที่ค้นพบแล้ว: ${w.map(([k, who]) => `${WONDERS[k].name} (${who})`).join(" · ")}`);
  const c = d.crisis;
  if (c) out.push(c.done ? `${CRISES[c.kind].name}: ${c.done === "won" ? CRISES[c.kind].win : CRISES[c.kind].lose}` : `ภัยของโลก: ${CRISES[c.kind].name} · ต้านไว้ได้ ${c.stage}/${CRISIS_WIN}`);
  if (d.lore?.length) out.push(`ความจริงของโลกที่ตระกูลจดไว้ (${d.lore.length}/${LORE.length}): ${d.lore.join(" · ")}`);
  return out;
}
