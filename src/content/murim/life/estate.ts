// ทรัพย์สินและการใช้เงินก้อนใหญ่ช่วงปลายชีวิต
// ของที่ซื้อแล้วให้รายได้ทุกปีและมีเรื่องตามมา · การใช้เงินแบบไม่กลับคืนได้ชื่อเสียง บุญ สุขภาพ หรืออนาคตของลูก
import { ACTIVITIES, type Activity } from "../../../engine/activities";
import type { Ctx, GameEvent } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, log, people, shortName } from "../../../engine/util";
import { shiftAlign } from "../m17core";
import { B, C, E, G, K, N, P, PAY, TAEL, ab, type Res } from "../story/kit";
import { mySectFaction, shiftRep } from "../world/factions";

const M = (a: Omit<Activity, "world" | "group">): Activity => ({ ...a, world: "murim", group: "ทรัพย์สิน", time: 0 });
const good = (text: string) => ({ text, kind: "good" as const });
/** โผล่เมื่อมีเงินเกินครึ่งของราคา รายการจึงไม่รกตอนต้นเกม */
const near = (l: Life, tael: number) => l.age >= 20 && l.money >= tael * TAEL * 0.5;
const owns = (l: Life, id: string) => l.flags[`estate_${id}`] !== undefined;
const act = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign(((l: Life, c: Ctx) => { f(l, c); return r(l, c); }) as Res, { fx: r.fx });

export const PROPERTIES = [
  { id: "farm", emoji: "🌾", name: "นาผืนใหญ่", cost: 800, income: 35, desc: "ค่าเช่านาปีละราว 35 ตำลึง", text: "คุณลงชื่อในโฉนดนาสามร้อยหมู่ ชาวนาที่เช่าอยู่ยืนมองเจ้าของคนใหม่อย่างระแวง" },
  { id: "inn", emoji: "🏮", name: "โรงเตี๊ยมริมถนนหลวง", cost: 2000, income: 90, desc: "กำไรปีละราว 90 ตำลึง", text: "ป้ายใหม่ถูกแขวนขึ้นหน้าโรงเตี๊ยม ผู้จัดการคนเก่าส่งบัญชีให้คุณพร้อมรอยยิ้มที่คุณยังไม่ไว้ใจ" },
  { id: "caravan", emoji: "🐫", name: "กองคาราวาน", cost: 6000, income: 300, desc: "กำไรปีละราว 300 ตำลึง แต่เสี่ยงถูกปล้น", text: "อูฐสามสิบตัวออกจากประตูเมืองพร้อมตราของคุณ ถ้ากลับมาครบ คุณจะรวยขึ้นอีกมาก" },
];

const ACTS: Activity[] = [
  ...PROPERTIES.map((p) => M({
    id: `mw_buy_${p.id}`, emoji: p.emoji, name: `ซื้อ${p.name}`, desc: p.desc, minAge: 20, cost: p.cost * TAEL,
    available: (l) => near(l, p.cost) && !owns(l, p.id),
    run: (l) => { addMoney(l, -p.cost * TAEL); l.flags[`estate_${p.id}`] = l.age; return good(p.text); },
  })),
  M({
    id: "mw_manor", emoji: "🏯", name: "สร้างคฤหาสน์ประจำตระกูล", desc: "ความสุขทุกปี ชื่อเสียง", minAge: 25, cost: 4000 * TAEL,
    available: (l) => near(l, 4000) && !owns(l, "manor"),
    run: (l) => { addMoney(l, -4000 * TAEL); l.flags.estate_manor = l.age; addFame(l, 5); return good("เสาไม้ตั้งขึ้นครบในฤดูใบไม้ร่วง ลูกหลานจะบอกคนอื่นได้ว่าบ้านเราอยู่ที่ไหน"); },
  }),
  M({
    id: "mw_soup", emoji: "🍚", name: "เปิดโรงทานหนึ่งฤดู", desc: "บุญ ชื่อเสียง · ทำได้ห้าปีครั้ง", minAge: 20, cost: 500 * TAEL,
    available: (l) => near(l, 500) && l.age >= Number(l.flags.soupNext ?? 0),
    run: (l) => { addMoney(l, -500 * TAEL); l.flags.soupNext = l.age + 5; shiftAlign(l, 6); addFame(l, 3); addStat(l, "happiness", 4); return good("แถวยาวถึงปลายตลาด หญิงชราคนหนึ่งเรียกชื่อคุณตอนยกถ้วยขึ้น"); },
  }),
  M({
    id: "mw_bridge", emoji: "🌉", name: "สร้างสะพานข้ามแม่น้ำ", desc: "ชื่อคุณจะอยู่หลังคุณตาย", minAge: 30, cost: 1500 * TAEL,
    available: (l) => near(l, 1500) && !l.flags.builtBridge,
    run: (l) => { addMoney(l, -1500 * TAEL); l.flags.builtBridge = true; addFame(l, 8); shiftAlign(l, 8); return good("ชาวบ้านตั้งชื่อสะพานตามคุณโดยไม่ได้ถาม คนข้ามแม่น้ำไม่ต้องรอเรืออีกแล้ว"); },
  }),
  M({
    id: "mw_shrine", emoji: "🛕", name: "บูรณะศาลเจ้าเก่า", desc: "โชค +", minAge: 20, cost: 1000 * TAEL,
    available: (l) => near(l, 1000) && !l.flags.builtShrine,
    run: (l) => { addMoney(l, -1000 * TAEL); l.flags.builtShrine = true; addStat(l, "luck", 5); return good("ควันธูปลอยขึ้นอีกครั้งจากหลังคาที่เพิ่งมุงใหม่ เจ้าอาวาสเขียนชื่อคุณลงในทะเบียนผู้มีพระคุณ"); },
  }),
  M({
    id: "mw_physician", emoji: "🌿", name: "จ้างหมอหลวงมาดูแลทั้งปี", desc: "สุขภาพ ++", minAge: 30, cost: 150 * TAEL,
    available: (l) => near(l, 150) && l.stats.health < 85,
    run: (l) => { addMoney(l, -150 * TAEL); addStat(l, "health", randInt(l, 8, 14)); return good("หมอชราจากเมืองหลวงจับชีพจรคุณทุกเช้า และห้ามสิ่งที่คุณชอบทุกอย่าง"); },
  }),
  M({
    id: "mw_elixir", emoji: "⚗️", name: "ซื้อโอสถต่ออายุ", desc: "สุขภาพ +25 · มีครั้งเดียวในชีวิต", minAge: 40, cost: 5000 * TAEL,
    available: (l) => near(l, 5000) && !l.flags.boughtElixir,
    run: (l) => { addMoney(l, -5000 * TAEL); l.flags.boughtElixir = true; addStat(l, "health", 25); return good("ยาเม็ดเดียวราคาเท่าหมู่บ้านทั้งหมู่บ้าน คืนนั้นคุณนอนหลับสนิทเป็นครั้งแรกในรอบสิบปี"); },
  }),
  M({
    id: "mw_master_child", emoji: "🥋", name: "จ้างยอดฝีมือสอนลูก", desc: "ลูกคนหนึ่งเก่งขึ้นถาวร", minAge: 25, cost: 1500 * TAEL,
    available: (l) => near(l, 1500) && people(l, "child").some((c) => c.age >= 6 && c.age <= 30 && !c.tags?.includes("tutored")),
    run: (l) => {
      addMoney(l, -1500 * TAEL);
      const c = people(l, "child").find((x) => x.age >= 6 && x.age <= 30 && !x.tags?.includes("tutored"))!;
      c.tags = [...(c.tags ?? []), "tutored"];
      c.martial = { rank: (c.martial?.rank ?? 0) + 2, style: c.martial?.style ?? "กระบี่", sect: c.martial?.sect, xp: 0 };
      c.bond = Math.min(100, c.bond + 8);
      return good(`อาจารย์ที่คุณเชิญมาดู${shortName(c)}รำกระบี่รอบเดียวแล้วพยักหน้า "เด็กคนนี้สอนได้"`);
    },
  }),
  M({
    id: "mw_donate_sect", emoji: "🏛️", name: "บริจาคเข้าคลังสำนัก", desc: "สำนักรักคุณขึ้น · ปีละครั้ง", minAge: 20, cost: 800 * TAEL,
    available: (l) => near(l, 800) && !!mySectFaction(l) && l.flags.donateYear !== l.age,
    run: (l) => { addMoney(l, -800 * TAEL); l.flags.donateYear = l.age; shiftRep(l, mySectFaction(l)!.id, 15); addFame(l, 1); return good("ผู้ดูแลคลังนับเงินสองรอบ แล้วเขียนชื่อคุณลงป้ายหินหน้าโถง"); },
  }),
  M({
    id: "mw_title", emoji: "📜", name: "ซื้อยศกิตติมศักดิ์จากราชสำนัก", desc: "ชื่อเสียงก้อนใหญ่", minAge: 35, cost: 8000 * TAEL,
    available: (l) => near(l, 8000) && !l.flags.boughtTitle,
    run: (l) => { addMoney(l, -8000 * TAEL); l.flags.boughtTitle = true; addFame(l, 14); addStat(l, "happiness", 5); return good("ป้ายทองพระราชทานถูกแขวนหน้าบ้าน คนที่เคยไม่มองหน้าคุณเริ่มโค้งก่อนคุณจะเดินถึง"); },
  }),
];
ACTIVITIES.push(...ACTS);

// รายได้ทุกปี
yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive) return;
  let sum = 0;
  for (const p of PROPERTIES) if (owns(l, p.id)) sum += Math.round((p.income * randInt(l, 70, 130)) / 100);
  if (sum) { addMoney(l, sum * TAEL); if (l.age % 5 === 0) log(l, `ทรัพย์สินของคุณทำเงินได้ ${sum} ตำลึงในปีนี้`, "good"); }
  if (owns(l, "manor")) addStat(l, "happiness", 2);
});

const ownsAny = (id: string) => (l: Life) => owns(l, id) && l.age > Number(l.flags[`estate_${id}`]);
const lose = (id: string) => (l: Life) => { delete l.flags[`estate_${id}`]; };

export const ESTATE_EVENTS: GameEvent[] = [
  E("es.tenants", [20, 110], "ปีนี้แล้ง ชาวนาเช่าที่ของคุณมายืนกันเต็มหน้าบ้าน ขอลดค่าเช่าเพื่อให้มีข้าวกินถึงฤดูหน้า", [
    C("ยกค่าเช่าปีนี้ให้ทั้งหมด", G("ปีต่อมามีคนเอาแตงโมลูกแรกของไร่มาวางหน้าบ้านคุณทุกปี", { tael: -35, align: 5, fame: 2 })),
    C("ลดให้ครึ่งหนึ่ง", N("ทุกคนกลับไปโดยไม่ยิ้มและไม่บ่น", { tael: -15, align: 1 })),
    C("เก็บเต็มจำนวน", B("คุณได้เงินครบ และได้ยินชื่อตัวเองในทางที่ไม่ดีทั่วตลาด", { align: -5, fame: -2 })),
  ], { when: ownsAny("farm"), weight: 7, maxTimes: 3, title: "ค่าเช่าปีแล้ง" }),

  E("es.inn_books", [20, 110], "บัญชีโรงเตี๊ยมไม่ตรง เงินหายไปปีละนิดมาหลายปี และผู้จัดการยิ้มกว้างกว่าทุกครั้งตอนส่งบัญชี", [
    K("ตรวจบัญชีเองทั้งคืน", "smarts", 55, G("คุณเจอรายการปลอมสิบสองบรรทัด ผู้จัดการคืนเงินแล้วหายไปก่อนเช้า", { tael: 120, iq: 1 }), N("ตัวเลขเรียบร้อยจนน่าโมโห คุณจับอะไรไม่ได้", {})),
    C("ปล่อยไป คนเก่งย่อมกินเล็กน้อย", N("โรงเตี๊ยมยังกำไร แค่น้อยกว่าที่ควร", { tael: -30 })),
  ], { when: ownsAny("inn"), weight: 6, maxTimes: 2, title: "บัญชีที่ไม่ตรง" }),

  E("es.inn_brawl", [20, 110], "จอมยุทธ์สองกลุ่มฟาดฟันกันกลางโรงเตี๊ยมของคุณ โต๊ะแตกไปครึ่งร้าน", [
    P("เข้าไปห้ามด้วยตัวเอง", ab(0.45, "health"), G("ทั้งสองฝ่ายวางอาวุธเพราะเกรงใจเจ้าของร้าน และจ่ายค่าโต๊ะคนละครึ่ง", { fame: 3 }), B("คุณได้แผลกลับบ้านพร้อมค่าซ่อมเต็มจำนวน", { hp: -8, tael: -60 })),
    C("ปิดร้านรอให้จบ แล้วจ่ายค่าซ่อม", N("ช่างไม้มาสามวัน ลูกค้าประจำหายไปหนึ่งเดือน", { tael: -50 })),
  ], { when: ownsAny("inn"), weight: 5, maxTimes: 2, title: "ศึกในโรงเตี๊ยม" }),

  E("es.caravan_raid", [20, 110], "ข่าวจากทะเลทราย: โจรล้อมกองคาราวานของคุณไว้ที่ช่องเขา หัวหน้าขบวนส่งนกมาถามว่าจะทำอย่างไร", [
    PAY("จ่ายค่าไถ่ให้จบ", 200, N("สินค้ากลับมาครบ แต่ปีนี้ทั้งปีเหมือนทำงานให้โจร", {})),
    P("สั่งให้สู้และส่งคนคุ้มกันไปเพิ่ม", ab(0.45, "smarts"), G("โจรแตกหนีทิ้งอาวุธไว้เกลื่อนช่องเขา ชื่อกองคาราวานของคุณเป็นที่เกรงไปทั้งเส้นทาง", { fame: 4, tael: 150 }), act(B("อูฐไม่กลับมาสักตัว ตราของคุณถูกทิ้งไว้กลางทราย", { joy: -8 }), lose("caravan"))),
    C("ปล่อยสินค้า เอาคนกลับมาก่อน", act(B("คนรอดครบ แต่กองคาราวานไม่เหลืออะไรให้เรียกว่ากองคาราวาน", { align: 3, joy: -3 }), lose("caravan"))),
  ], { when: ownsAny("caravan"), weight: 7, maxTimes: 3, title: "ช่องเขาที่ถูกล้อม" }),
];
