// มังกรโบราณทั้งห้า (Release 21 · ชื่อผ่านการอนุมัติใน design/ANCIENT_NAMES.md)
// ตามข่าวลือจนรู้ที่หลับ แล้วปลุก สู้ เจรจา หรือขอเรียนรู้ · โลกจำผลข้ามชีวิต: ถูกสังหาร เป็นมิตรกับตระกูล หรือตื่นอาละวาด
import { ACTIVITIES, type Activity } from "../../engine/activities";
import { registerEvents, type Choice, type Ctx, type GameEvent } from "../../engine/events";
import { kill, runEvent, yearHooks } from "../../engine/game";
import { chance, pick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, displayName, log } from "../../engine/util";
import { addLegend, recordChronicle } from "../../engine/worldState";
import { apply, B, BIG, C, E, G, K, N, P, PAY, SCENE, type Fx } from "./kit";
import { fightOdds } from "./power";
import { addStanding, dataOf, deed, fl, homeKingdom, worldOfLife, type AncientState } from "./state";

export interface Ancient { id: string; name: string; title: string; element: string; lair: string; links: [string, string]; sleep: string; wake: string; rage: string; teach: [string, Fx]; rumor: string }
export const ANCIENTS: Ancient[] = [
  { id: "azargoth", name: "อาซาร์โกธ", title: "ผู้ฝันโลกให้เกิด", element: "มังกรตัวแรก แสงและเงา", lair: "ห้องหัวใจใต้เทือกเขาบรรพกาล", links: ["excalibur", "chronos"],
    sleep: "ห้องหัวใจใต้เทือกเขาบรรพกาลกว้างจนมองไม่เห็นผนัง อาซาร์โกธนอนขดอยู่ เกล็ดครึ่งหนึ่งสว่าง ครึ่งหนึ่งมืด ทุกครั้งที่มันหายใจ ภูเขาทั้งเทือกขยับตาม และคุณรู้สึกว่ากำลังยืนอยู่ในความฝันของมัน",
    wake: "อาซาร์โกธลืมตาข้างหนึ่ง แสงในห้องดับลงครึ่งหนึ่ง \"ข้าฝันโลกนี้มานานเกินกว่าที่เจ้าจะนับได้ เจ้าปลุกข้าเพื่ออะไร\"",
    rage: "แผ่นดินไหวไม่หยุด ภูเขาทั้งเทือกเคลื่อนตัว อาซาร์โกธตื่นจากฝัน และโลกที่มันฝันขึ้นมากำลังสั่นคลอน",
    teach: ["อาซาร์โกธเล่าให้ฟังว่าโลกเริ่มต้นอย่างไร คุณจำได้แค่เสี้ยวเดียว แต่เสี้ยวนั้นเปลี่ยนทุกอย่างที่คุณรู้เรื่องเวทและชีวิต", { magic: 30, iq: 6 }],
    rumor: "นักบวชชราเล่าว่าใต้เทือกเขาบรรพกาลมีห้องที่ภูเขาหายใจ และไม่มีใครที่เข้าไปแล้วกลับออกมาเหมือนเดิม" },
  { id: "wyrmaxar", name: "ไวร์มัคซาร์", title: "เพลิงแรกแห่งกาลก่อนกาล", element: "ไฟ", lair: "ทะเลลาวาใต้ภูเขาไฟสามยอด", links: ["wyrmsbane", "embersoul"],
    sleep: "ใต้ภูเขาไฟสามยอด ทะเลลาวาเดือดเป็นจังหวะเดียวกับลมหายใจของไวร์มัคซาร์ เกล็ดของมันแดงเหมือนถ่านที่ไม่เคยดับ และบนคอมีรอยแผลเก่าจากหอกที่ตีไม่เสร็จ",
    wake: "ไวร์มัคซาร์ยกหัวขึ้นจากลาวา ความร้อนทำให้อากาศบิดเบี้ยว \"กลิ่นของเจ้าเหมือนช่างคนนั้น คนที่คิดว่าเหล็กจะดับเพลิงแรกได้\"",
    rage: "ภูเขาไฟสามยอดระเบิดพร้อมกัน ไวร์มัคซาร์บินออกมาพร้อมเพลิงที่เผาป่าทั้งแนว เมืองชายแดนลุกเป็นไฟทีละเมือง",
    teach: ["ไวร์มัคซาร์สอนให้คุณฟังเสียงของไฟ ไฟทุกกองในโลกเป็นลูกหลานของมัน และตั้งแต่วันนั้น ไฟไม่เคยเผาคุณอีกเลย", { magic: 20, body: 15, hp: 5 }],
    rumor: "ชาวเหมืองจากวาร์นเล่าว่าลาวาใต้ภูเขาไฟสามยอดเดือดเป็นจังหวะเหมือนลมหายใจ และมีรอยหอกหักอยู่บนผนังถ้ำ" },
  { id: "leviathal", name: "เลวีอาธัล", title: "มารดาแห่งห้วงลึกทั้งเจ็ด", element: "น้ำ", lair: "ร่องทะเลลึกนอกอ่าวเกลเวน", links: ["dragonhorn", "stormcrown"],
    sleep: "ในร่องทะเลลึกนอกอ่าวเกลเวน เลวีอาธัลนอนขดยาวจนมองไม่เห็นหาง ซากเรือนับร้อยลำติดอยู่ระหว่างเกล็ด ทั้งเรือของกัปตันรีนาและห้องประชุมของสภาเก่า",
    wake: "เลวีอาธัลลืมตา ทะเลทั้งอ่าวหยุดนิ่ง \"ข้าพลิกตัวครั้งเดียว เมืองของพวกเจ้าก็จมไปทั้งเมือง เจ้ามาขอให้ข้าอยู่นิ่งๆ หรือมาขอให้ข้าพลิกตัวอีก\"",
    rage: "คลื่นยักษ์ซัดเมืองท่าทีละเมือง เลวีอาธัลตื่นแล้ว และทะเลทั้งเจ็ดไม่ยอมสงบ",
    teach: ["เลวีอาธัลสอนให้คุณหายใจใต้น้ำได้ครู่หนึ่ง และอ่านกระแสน้ำทุกสาย ทะเลไม่เคยเป็นศัตรูของคุณอีก", { hp: 10, luck: 6, magic: 12 }],
    rumor: "ชาวประมงเกลเวนบอกว่าในคืนเดือนมืด จะเห็นดวงตาขนาดเท่าเรือลืมขึ้นใต้น้ำนอกอ่าว" },
  { id: "golmoroth", name: "โกลโมรอธ", title: "ผู้แบกภูผาบนหลัง", element: "ดิน", lair: "ใจกลางเทือกเขาเหล็ก", links: ["cleaver", "starforge"],
    sleep: "ใจกลางเทือกเขาเหล็กคือหลังของโกลโมรอธ คุณยืนอยู่ในถ้ำที่เป็นเกล็ดของมัน และดาวตกที่ดูรินใช้ตีค้อนยังฝังอยู่ตรงนั้น",
    wake: "ภูเขาทั้งลูกยกตัวขึ้น หัวของโกลโมรอธโผล่ออกมาจากหน้าผา \"คนตัวเล็กผ่าหลังข้ามาแล้วครั้งหนึ่ง เจ้าจะผ่าอีกหรือ\"",
    rage: "โกลโมรอธลุกขึ้นยืน ช่องเขาทั้งหมดปิด หมู่บ้านคนแคระถล่มทีละหมู่บ้าน และแผ่นดินแตกเป็นร่องยาว",
    teach: ["โกลโมรอธสอนให้คุณยืนเหมือนภูเขา ไม่มีหมัดไหนผลักคุณล้มได้อีก และกระดูกของคุณแข็งเหมือนหิน", { body: 30, hp: 8 }],
    rumor: "คนแคระเฒ่าเล่าว่าเทือกเขาเหล็กไม่ใช่ภูเขา มันคือหลังของบางอย่างที่ยังหายใจ" },
  { id: "seraphael", name: "เซราฟาเอล", title: "ผู้ไม่เคยแตะพื้นโลก", element: "ลม", lair: "ตาพายุนิรันดร์เหนือทะเลเหนือ", links: ["crescent", "bulwark"],
    sleep: "ในตาพายุนิรันดร์เหนือทะเลเหนือ เซราฟาเอลหลับลอยอยู่กลางอากาศ ปีกไม่ขยับ แต่พายุรอบตัวหมุนไม่หยุดมาพันปี บนปีกมีลูกศรเงินของเลนาปักอยู่หนึ่งดอก",
    wake: "เซราฟาเอลลืมตา พายุทั้งวงเงียบลงครู่หนึ่ง \"ข้าไม่เคยแตะพื้นโลกเลยสักครั้ง เพราะพื้นโลกเต็มไปด้วยคนอย่างเจ้า\"",
    rage: "พายุนิรันดร์หลุดจากที่ของมัน เซราฟาเอลบินข้ามแผ่นดิน หลังคาปลิวทั้งเมือง และเรือทุกลำต้องจอดอยู่ในท่า",
    teach: ["เซราฟาเอลสอนให้คุณฟังลม คุณรู้ว่าพายุจะมาก่อนใครสามวัน และเท้าของคุณเบาเหมือนไม่แตะพื้น", { luck: 8, body: 12, magic: 12 }],
    rumor: "กะลาสีเรือทางเหนือเล่าว่ามีพายุลูกหนึ่งไม่เคยเคลื่อนที่มาพันปี และตรงกลางมันมีบางอย่างนอนหลับอยู่" },
];
export const NEED_LEADS = 2;
export const ANCIENT_THREAT = 118;
export const LINK_EDGE = 25;

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
export const ancientOf = (id: unknown) => ANCIENTS.find((a) => a.id === id)!;
export const stateOf = (l: Life, id: string): AncientState => ((dataOf(l).ancients ??= {})[id] ??= { state: "asleep" });
const setState = (l: Life, id: string, s: AncientState["state"]) => { (dataOf(l).ancients ??= {})[id] = { state: s, by: l.lastName, year: l.birthYear + l.age }; };
const A = (c: Ctx) => ancientOf(c.a);
const leads = (l: Life, id: string) => fl(l).ancientLeads?.[id] ?? 0;
const addLead = (l: Life, id: string) => { const f = fl(l); f.ancientLeads = { ...f.ancientLeads, [id]: leads(l, id) + 1 }; };
const done = (l: Life, id: string) => (fl(l).ancientDone ?? []).includes(id);
const markDone = (l: Life, id: string) => { fl(l).ancientDone = [...(fl(l).ancientDone ?? []), id]; };
/** ถืออาวุธที่เคยถูกสร้างหรือใช้กับมังกรตัวนี้ */
export const linked = (l: Life, a: Ancient) => !!fl(l).relic && a.links.includes(fl(l).relic!);
export const threatOf = (l: Life, a: Ancient) => ANCIENT_THREAT - (linked(l, a) ? LINK_EDGE : 0) + (stateOf(l, a.id).state === "raging" ? 10 : 0);
const myFamily = (l: Life, a: Ancient) => stateOf(l, a.id).by === l.lastName;

/** มังกรตัวที่รู้ที่หลับแล้ว และยังมีอะไรให้ทำในชีวิตนี้ */
export function reachable(l: Life): Ancient | undefined {
  return ANCIENTS.filter((a) => leads(l, a.id) >= NEED_LEADS && !done(l, a.id)).sort((x, y) => leads(l, y.id) - leads(l, x.id))[0];
}
function sceneFor(l: Life, a: Ancient) {
  const s = stateOf(l, a.id).state;
  return s === "asleep" ? "ft.an.sleep" : s === "slain" ? "ft.an.bones" : s === "friend" && myFamily(l, a) ? "ft.an.friend" : "ft.an.awake";
}

// ───────────── ผลของการพบ ─────────────
function slay(l: Life, a: Ancient) {
  setState(l, a.id, "slain"); markDone(l, a.id);
  deed(l, `สังหาร${a.name}${a.title}`); addFame(l, 40); addStanding(l, 20);
  recordChronicle(worldOfLife(l), `${displayName(l)}สังหาร${a.name} มังกรโบราณ${a.title}`);
  addLegend(worldOfLife(l), { name: displayName(l), deed: `สังหาร${a.name}${a.title}`, lifeId: l.id });
}
function befriend(l: Life, a: Ancient) {
  setState(l, a.id, "friend"); markDone(l, a.id);
  deed(l, `เป็นมิตรกับ${a.name}`); addFame(l, 20);
  recordChronicle(worldOfLife(l), `${a.name}${a.title}จดจำตระกูล${l.lastName}เป็นมิตร`);
}
function teach(l: Life, a: Ancient) { apply(l, a.teach[1]); markDone(l, a.id); setState(l, a.id, "asleep"); deed(l, `ได้รับคำสอนจาก${a.name}`); }
function enrage(l: Life, a: Ancient) { setState(l, a.id, "raging"); recordChronicle(worldOfLife(l), `${displayName(l)}ปลุก${a.name}แล้วจากไป มังกรโบราณออกอาละวาด`); }
function hurt(l: Life, a: Ancient, hp: number) {
  apply(l, { hp: -hp });
  if (l.stats.health <= 0) kill(l, `ถูก${a.name}${a.title}สังหาร`);
}

const sleepChoices: Choice[] = [
  C((_l, c) => `ปลุก${A(c).name}`, (l, c) => { const a = A(c); setState(l, a.id, "awake"); runEvent(l, "ft.an.awake", { a: a.id }); return { text: `คุณตะโกนชื่อของมันก้องไปทั่ว${a.lair} ความเงียบที่ยาวนานกว่าประวัติศาสตร์แตกออก และ${a.name}เริ่มขยับตัว` }; }, { tone: "danger" }),
  K("ศึกษามันขณะหลับ", "smarts", 60, BIG((_l, _c) => `คุณนั่งดูจังหวะลมหายใจของมันจนรุ่งสาง แล้วเข้าใจบางอย่างที่ไม่มีตำราไหนเขียนไว้`, { magic: 12, iq: 4 }, (l, c) => markDone(l, A(c).id)), B("มันขยับตัวในฝัน และหางของมันปัดคุณกระเด็นไปชนผนัง", { hp: -10 })),
  PAY("วางเครื่องบูชาไว้ที่หน้าที่หลับ", 20, G((_l, c) => `คุณวางทองไว้หน้า${A(c).name} ลมหายใจของมันอุ่นขึ้นเล็กน้อย และโชคของคุณก็เปลี่ยนตั้งแต่วันนั้น`, { luck: 6, joy: 4 }, (l, c) => markDone(l, A(c).id))),
  K("ขโมยเกล็ดหนึ่งเกล็ด", "luck", 62, BIG((_l, c) => `เกล็ดของ${A(c).name}หลุดออกมาในมือคุณ มันมีค่าเท่าที่ดินทั้งหมู่บ้าน`, { gold: 60, fame: 3 }, (l, c) => markDone(l, A(c).id)), (l, c) => { const a = A(c); enrage(l, a); hurt(l, a, 18); return { text: `${a.name}ตื่นขึ้นด้วยความโกรธ คุณหนีออกมาได้ แต่มันจะไม่กลับไปหลับอีกแล้ว`, kind: "bad" }; }),
  C("ถอยกลับไปเงียบๆ", N("คุณเดินออกมาโดยไม่ทำให้มันตื่น ที่หลับของมันยังอยู่ในแผนที่ของคุณ")),
];

const awakeChoices: Choice[] = [
  P((l, c) => `สู้กับ${A(c).name}${linked(l, A(c)) ? ` ด้วยอาวุธที่เคยถูกสร้างมาเพื่อมัน` : ""}`, (l, c) => fightOdds(l, threatOf(l, A(c))), (l, c) => { const a = A(c); slay(l, a); return { text: `${a.name}ล้มลงเป็นครั้งแรกตั้งแต่ก่อนมีประวัติศาสตร์ แผ่นดินเงียบไปทั้งแผ่น และชื่อของคุณจะอยู่ในทุกตำนานหลังจากนี้`, kind: "milestone" }; }, (l, c) => { const a = A(c); if (stateOf(l, a.id).state === "awake") enrage(l, a); hurt(l, a, 35); return { text: `${a.name}ปัดคุณเหมือนแมลง คุณรอดมาได้อย่างหวุดหวิด`, kind: "bad" }; }, { tone: "danger" }),
  P("เจรจากับมัน", (l, c) => 0.25 + (l.stats.smarts + l.stats.looks) / 400 - (stateOf(l, A(c).id).state === "raging" ? 0.12 : 0) + (fl(l).dragonBond ?? 0) / 300, (l, c) => { const a = A(c); befriend(l, a); return { text: `${a.name}มองคุณนาน แล้วพยักหน้า \"ตระกูล${l.lastName} ข้าจะจำชื่อนี้ไว้\"`, kind: "milestone" }; }, (l, c) => { const a = A(c); if (stateOf(l, a.id).state === "awake") enrage(l, a); hurt(l, a, 10); return { text: `คำพูดของคุณทำให้${a.name}รำคาญ มันพ่นลมใส่จนคุณกลิ้งออกมาจากที่หลับของมัน`, kind: "bad" }; }),
  K("ขอให้มันสอนสิ่งที่มันรู้", "luck", 58, (l, c) => { const a = A(c); teach(l, a); return { text: `${a.teach[0]} แล้วมันก็หลับตาลงอีกครั้ง`, kind: "milestone" }; }, (l, c) => { const a = A(c); enrage(l, a); hurt(l, a, 12); return { text: `${a.name}ไม่คิดว่ามนุษย์ควรรู้อะไร มันโกรธ และออกจากที่หลับไปทั้งที่ยังโกรธ`, kind: "bad" }; }, { show: (l, c) => stateOf(l, A(c).id).state === "awake" }),
  C("ถอยหนีออกมา", (l, c) => { const a = A(c); if (stateOf(l, a.id).state === "awake") enrage(l, a); return { text: `คุณหนีออกมาได้ แต่${a.name}ไม่กลับไปหลับ มันจะออกอาละวาดในแผ่นดิน`, kind: "bad" }; }),
];

/** ตั้งค่าหลังเลือก ไม่ใช่ใน prepare (คิวตรวจ when ซ้ำแล้วจะทิ้งเรื่องนี้) */
const after = (e: GameEvent, fn: (l: Life, c: Ctx) => void): GameEvent => ({ ...e, choices: e.choices?.map((ch) => ({ ...ch, run: (l, c, ok) => { fn(l, c); return ch.run(l, c, ok); } })) });
const ANCIENT_EVENTS: GameEvent[] = [
  after(E("ft.an.rumor", [16, 600], (l, c) => `${A(c).rumor} (ข่าวเรื่อง${A(c).name}${A(c).title} ${leads(l, A(c).id)}/${NEED_LEADS})`, [
    K("ตามไปถามต้นเรื่องด้วยตัวเอง", "smarts", 48, G((_l, c) => `คุณได้รายละเอียดที่ไม่มีใครเคยจด ทางไป${A(c).lair}ชัดขึ้นอีกนิด`, { iq: 1 }, (l, c) => addLead(l, A(c).id)), N("ต้นเรื่องเมาจนจำอะไรไม่ได้แล้ว")),
    PAY("ซื้อแผนที่จากคนเล่า", 8, G((_l, c) => `แผนที่เก่าขาดครึ่งแผ่น แต่ครึ่งที่เหลือชี้ไปทาง${A(c).lair}`, {}, (l, c) => addLead(l, A(c).id))),
    C("จดไว้แล้วกลับบ้าน", G("บางเรื่องรอได้", { iq: 1 })),
  ], { title: "ข่าวลือมังกรโบราณ", weight: (l) => (ANCIENTS.some((a) => stateOf(l, a.id).state !== "slain") ? 10 : 0), maxTimes: 0, when: (l) => on(l) && l.age - Number(l.flags.ftAnRumor ?? -99) >= 2, prepare: (l) => { const open = ANCIENTS.filter((a) => stateOf(l, a.id).state !== "slain"); // ข่าวเรื่องตัวที่เคยได้ยินมาแล้วหรือผูกกับอาวุธที่ถืออยู่มาก่อน ร่องรอยจะได้ไม่กระจาย
    const mine = open.filter((a) => linked(l, a) || (leads(l, a.id) > 0 && leads(l, a.id) < NEED_LEADS)); return { a: pick(l, mine.length ? mine : open).id }; } }), (l) => { l.flags.ftAnRumor = l.age; }),
  SCENE("ft.an.sleep", "ที่หลับของมังกรโบราณ", (_l, c) => `${A(c).name}${A(c).title} · ${A(c).lair}: ${A(c).sleep}`, sleepChoices),
  SCENE("ft.an.awake", "มังกรโบราณ", (l, c) => stateOf(l, A(c).id).state === "raging" ? `${A(c).name}${A(c).title}ยังอาละวาดอยู่ มันหันมาหาคุณ ตาลุกเป็นไฟ` : `${A(c).name}${A(c).title}: ${A(c).wake}`, awakeChoices),
  SCENE("ft.an.friend", "มิตรเก่าของตระกูล", (l, c) => `${A(c).name}ได้กลิ่นตระกูล${l.lastName}ตั้งแต่คุณยังไม่ถึงปากถ้ำ "ลูกหลานของมิตรข้า เข้ามาเถิด"`, [
    C("ขอพรให้ตระกูล", BIG((_l, c) => `${A(c).name}หายใจรดหน้าคุณ ไออุ่นนั้นอยู่กับคุณไปหลายปี`, { luck: 6, hp: 6 }, (l, c) => markDone(l, A(c).id))),
    C("ขอฟังเรื่องของบรรพบุรุษ", G((_l, c) => `${A(c).name}เล่าเรื่องคนในตระกูลคุณที่มาหามันเป็นคนแรก เรื่องที่ไม่มีใครในบ้านเคยรู้`, { iq: 4, joy: 6 }, (l, c) => markDone(l, A(c).id))),
    C("ขอนั่งบนหลังของมันสักครั้ง", G((_l, c) => `${A(c).name}พาคุณขึ้นไปเหนือโลกจนเห็นแผ่นดินทั้งสามในคราวเดียว`, { joy: 10, fame: 3 }, (l, c) => markDone(l, A(c).id))),
  ]),
  SCENE("ft.an.bones", "ซากมังกรโบราณ", (l, c) => { const s = stateOf(l, A(c).id); return `ซากของ${A(c).name}${A(c).title}ยังอยู่ที่${A(c).lair} ตระกูล${s.by}เป็นผู้สังหารมันในปี ${s.year} กระดูกของมันสูงเท่าหอคอย`; }, [
    C("เก็บเกล็ดหนึ่งชิ้นไปขาย", G("เกล็ดของมังกรโบราณยังมีค่ามหาศาล แม้ผ่านมาหลายปี", { gold: 30 }, (l, c) => markDone(l, A(c).id))),
    C("คำนับให้มังกรที่จากไป", G("ลมพัดผ่านซากกระดูกเหมือนเสียงถอนหายใจ คุณรู้สึกว่ามันไม่ได้โกรธใครแล้ว", { luck: 4, joy: 3 }, (l, c) => markDone(l, A(c).id))),
    K("ศึกษาโครงกระดูกของมัน", "smarts", 50, G("คุณเข้าใจว่าปีกขนาดนั้นบินได้อย่างไร และเวทในกระดูกยังเต้นอยู่จางๆ", { magic: 8, iq: 3 }, (l, c) => markDone(l, A(c).id)), N("กระดูกใหญ่เกินกว่าจะเข้าใจในหนึ่งฤดู")),
  ]),
  SCENE("ft.an.raid", "มังกรโบราณอาละวาด", (l, c) => `${A(c).rage} คราวนี้มันมาถึง${homeKingdom(l).name}`, [
    P("ออกไปสู้เพื่อไล่มัน", (l, c) => fightOdds(l, threatOf(l, A(c)) - 20), G((_l, c) => `${A(c).name}ถอยกลับไปพร้อมแผลจากคุณ เมืองรอดในปีนี้`, { fame: 8 }), (l, c) => { hurt(l, A(c), 22); return { text: "เพลิงและเศษหินทับคุณจนสลบไปหลายวัน", kind: "bad" }; }, { tone: "danger" }),
    C("พาคนในเมืองหนีออกไป", G("คุณพาเด็กและคนแก่ออกจากเมืองได้ก่อนมันมาถึง หลายคนรอดเพราะคุณ", { fame: 3, joy: 2 }, (l) => addStanding(l, 4))),
    C("หลบอยู่ในห้องใต้ดิน", (l, c) => (chance(l, 0.7) ? { text: "คุณรอดมาได้ แต่บ้านข้างบนเหลือแต่เถ้า" } : (hurt(l, A(c), 12), { text: "ห้องใต้ดินถล่มลงมาครึ่งห้อง", kind: "bad" }))),
  ]),
];

const ACTS: Activity[] = [
  { id: "ft_ancient", emoji: "", name: "ไปยังที่หลับของมังกรโบราณ", desc: "ตามข่าวลือจนรู้ทาง · ปลุก สู้ เจรจา หรือขอเรียนรู้", minAge: 18, time: 2, world: "fantasy", group: "ผจญภัย", available: (l) => on(l) && !!reachable(l), run: (l) => { const a = reachable(l)!; runEvent(l, sceneFor(l, a), { a: a.id }); return { text: "" }; } },
];

/** มังกรที่ตื่นอาละวาดบุกแผ่นดินเป็นบางปี · ความมั่นคงของแผ่นดินลดลง */
function ancientYear(l: Life) {
  if (!on(l) || !l.alive) return;
  // ถือหรือตามล่าอาวุธที่ผูกกับมังกร: ได้ยินเรื่องของมันหนึ่งครั้ง
  const r = fl(l).relic ?? fl(l).hunt?.id;
  for (const a of ANCIENTS) if (r && a.links.includes(r) && !leads(l, a.id) && !l.flags[`ftAnLink_${a.id}`]) { l.flags[`ftAnLink_${a.id}`] = true; addLead(l, a.id); log(l, `อาวุธที่คุณตามล่าเล่าเรื่องของ${a.name}${a.title}ผ่านความฝัน`, "normal"); }
  const raging = ANCIENTS.filter((a) => stateOf(l, a.id).state === "raging");
  if (!raging.length) return;
  homeKingdom(l).stability = Math.max(0, homeKingdom(l).stability - 2 * raging.length);
  if (l.age >= 12 && chance(l, 0.18)) runEvent(l, "ft.an.raid", { a: pick(l, raging).id });
}

/** สรุปสำหรับแท็บโลก */
export function ancientLines(l: Life): string[] {
  return ANCIENTS.map((a) => {
    const s = stateOf(l, a.id), known = leads(l, a.id) >= NEED_LEADS;
    const st = s.state === "asleep" ? "หลับอยู่" : s.state === "awake" ? "ตื่นแล้ว" : s.state === "raging" ? `ออกอาละวาด (ตระกูล${s.by}ปลุกเมื่อปี ${s.year})` : s.state === "slain" ? `ถูกสังหารโดยตระกูล${s.by} ปี ${s.year}` : `เป็นมิตรกับตระกูล${s.by}`;
    return `${a.name}${a.title} · ${a.element} · ${st} · ${known ? `ที่หลับ: ${a.lair}` : `ข่าวที่คุณได้ยิน ${leads(l, a.id)}/${NEED_LEADS}`}`;
  });
}

let loaded = false;
export function loadAncients() {
  if (loaded) return;
  loaded = true;
  registerEvents(ANCIENT_EVENTS);
  ACTIVITIES.push(...ACTS);
  yearHooks.push(ancientYear);
}
