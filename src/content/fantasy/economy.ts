// เงินแบบหาได้ช้าลงแต่มีของใหญ่ให้เก็บเงินซื้อ · หนี้ที่มีเจ้าหนี้มาเคาะประตู · บัญชีรายปี
// แผนอยู่ที่ design/SYSTEMS_UPDATE.md (Release 1)
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Choice, GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { chance } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, addStat, clamp, log, people, shortName } from "../../engine/util";
import { CAREERS } from "../core/careers";
import { B, BIG, C, E, G, GOLD, N, SCENE } from "./kit";
import { canCast, combatHooks, safetyHooks } from "./power";
import { addStanding, deed, fl, homeKingdom } from "./state";
import { cityCost, citiesOf, cityOf } from "./cities";
import { HOMES } from "./world2";
import { assetIncome } from "./careers";
import { PREJUDICE_COST, prejudice } from "./races";
import { staffOf } from "./people3";

export type EstateId = "tower" | "stable" | "airship" | "title" | "blade" | "plate";
export interface Estate { name: string; price: number; upkeep: number; perk: string; once?: boolean; req?: (l: Life) => string | undefined; year?: (l: Life) => void; buy?: (l: Life) => void }

export const ESTATES: Record<EstateId, Estate> = {
  tower: {
    name: "หอคอยเวทส่วนตัว", price: 900, upkeep: 20, perk: "พลังเวท +8 และสติปัญญา +1 ทุกปี",
    req: (l) => (canCast(l) ? undefined : "ต้องร่ายเวทได้ก่อน"),
    year: (l) => { fl(l).magic += 8; addStat(l, "smarts", 1); },
  },
  stable: {
    name: "คอกมังกร", price: 1200, upkeep: 35, perk: "ลูกมังกรโตเร็วและผูกพันขึ้น · พลังต่อสู้ +5",
    req: (l) => { const f = fl(l); return f.whelp || f.egg || f.mount ? undefined : "ต้องมีไข่ ลูกมังกร หรือมังกรที่ขี่ก่อน"; },
    year: (l) => { const f = fl(l); if (f.whelp) { f.whelp.bond = clamp(f.whelp.bond + 5, 0, 100); f.whelp.power += 3; } if (f.egg) f.egg.warmth = Math.min(4, f.egg.warmth + 1); },
  },
  airship: {
    name: "เรือเหาะส่วนตัว", price: 1600, upkeep: 45, perk: "ความสุข +2 ทุกปี · กองคาราวานปลอดภัยขึ้นและกำไรเพิ่ม 10%",
    year: (l) => addStat(l, "happiness", 2),
  },
  title: {
    name: "บรรดาศักดิ์ขุนนาง", price: 1100, upkeep: 30, perk: "ชื่อเสียงในแผ่นดิน +2 ทุกปี · ค่าจ้างทุกงาน +10%",
    buy: (l) => deed(l, `ได้รับบรรดาศักดิ์แห่ง${homeKingdom(l).name}`),
    year: (l) => addStanding(l, 2),
  },
  blade: {
    name: "อาวุธสั่งตีจากช่างตำนาน", price: 650, upkeep: 0, once: true, perk: "อาวุธคุณภาพสูงสุดพร้อมอาคม ติดตัวไปจนตาย",
    buy: (l) => { fl(l).weapon = { name: `ดาบตระกูล${l.lastName}`, quality: 5, enchant: true }; },
  },
  plate: {
    name: "ชุดเกราะสั่งตีจากช่างตำนาน", price: 500, upkeep: 0, once: true, perk: "เกราะคุณภาพสูงสุด ลดโอกาสตายในการต่อสู้",
    buy: (l) => { fl(l).armor = { name: `เกราะตระกูล${l.lastName}`, quality: 5 }; },
  },
};
const IDS = Object.keys(ESTATES) as EstateId[];
/** บ้านระดับคฤหาสน์ขึ้นไปมีค่าดูแลทุกปี */
export const HOME_UPKEEP = [0, 0, 0, 15, 60];

export const owns = (l: Life, id: EstateId) => fl(l).estates?.[id] !== undefined;
export const ownedEstates = (l: Life) => IDS.filter((id) => owns(l, id) && !ESTATES[id].once);
/** ค่าดูแลของใหญ่และบ้าน · พ่อบ้านดูแลบัญชีลดได้หนึ่งในห้า */
export const upkeepOf = (l: Life) => Math.round((ownedEstates(l).reduce((s, id) => s + ESTATES[id].upkeep, 0) + HOME_UPKEEP[Number(l.flags.ftHome ?? 0)]) * (staffOf(l, "steward") ? 0.8 : 1));

/** ค่าครองชีพของโลกนี้ (ใช้ทั้งตอนหักเงินจริงและในบัญชี) */
export function ftLiving(l: Life, kids: number, income: number) {
  const k = homeKingdom(l), rich = (k.prosperity ?? 100) / 100;
  // เมืองรุ่งเรืองของแพงแต่คนเหลือเงินมากกว่า · ภาษีสงครามเพิ่มทั้งก้อน
  const tax = k.laws?.includes("heavyTax") ? 1.25 : 1;
  // แผ่นดินที่ระแวงเผ่าของคุณขายของให้แพงกว่า
  const wary = 1 + prejudice(l) * PREJUDICE_COST;
  return Math.round(((3_000 + kids * 700) * rich * tax + Math.max(0, income) * clamp(0.25 - (rich - 1) / 4, 0.1, 0.4) * tax) * cityCost(l) * wary);
}

/** หนี้: ดอกเบี้ยปีละ 6% · เจ้าหนี้มาเมื่อเกิน 40 เหรียญทอง */
export const DEBT_RATE = 0.06;
export const CREDITOR_AT = 40;
export const PRISON_AT = 150;
const debtGold = (l: Life) => Math.ceil(l.debt / GOLD);

export interface Ledger { age: number; pay: number; assets: number; living: number; upkeep: number; interest: number; /** ไม่มีเมื่อยังไม่มีปีก่อนให้เทียบ */ net?: number }

function sellOff(l: Life, id: EstateId) {
  const e = ESTATES[id];
  delete fl(l).estates![id];
  addMoney(l, Math.round(e.price * 0.4) * GOLD);
}
function downgradeHome(l: Life) {
  const h = Number(l.flags.ftHome ?? 0);
  if (h <= 0) return;
  l.flags.ftHome = h - 1;
  addMoney(l, Math.round(HOMES[h].cost * 0.4) * GOLD);
}

/** ปลายปี: ค่าดูแลทรัพย์สิน ผลของทรัพย์สิน หนี้และดอกเบี้ย และบันทึกบัญชี */
export function economyYear(l: Life) {
  if (l.worldId !== "fantasy" || !l.ft || !l.alive || l.age < 18) return;
  const f = fl(l);
  let upkeep = 0;
  for (const id of ownedEstates(l)) {
    const e = ESTATES[id];
    if (l.money >= e.upkeep * GOLD) {
      addMoney(l, -e.upkeep * GOLD); upkeep += e.upkeep; f.estates![id] = 0; e.year?.(l);
    } else if ((f.estates![id] = (f.estates![id] ?? 0) + 1) >= 2) {
      sellOff(l, id);
      log(l, `คุณค้างค่าดูแล${e.name}มาสองปี จนต้องขายทิ้งในราคาไม่ถึงครึ่ง`, "bad");
    } else log(l, `ปีนี้คุณไม่มีเงินจ่ายค่าดูแล${e.name} ถ้าค้างอีกปีจะต้องขาย`, "bad");
  }
  const hu = HOME_UPKEEP[Number(l.flags.ftHome ?? 0)];
  if (hu) {
    if (l.money >= hu * GOLD) { addMoney(l, -hu * GOLD); upkeep += hu; l.flags.ftHomeUnpaid = 0; }
    else if ((l.flags.ftHomeUnpaid = Number(l.flags.ftHomeUnpaid ?? 0) + 1) >= 2) {
      l.flags.ftHomeUnpaid = 0; downgradeHome(l);
      log(l, `ค่าดูแลบ้านค้างมาสองปี คุณต้องขายบ้านแล้วย้ายไปอยู่${HOMES[Number(l.flags.ftHome ?? 0)].name}`, "bad");
    } else log(l, "ปีนี้คุณจ่ายค่าดูแลบ้านไม่ไหว ถ้าค้างอีกปีจะต้องขายบ้าน", "bad");
  }
  // เงินติดลบกลายเป็นหนี้จริง
  if (l.money < 0) {
    const fresh = l.debt === 0;
    l.debt += -l.money; l.money = 0;
    if (fresh) log(l, "เงินไม่พอใช้ คุณเริ่มเป็นหนี้ร้านค้าและเจ้าของห้องเช่า", "bad");
  }
  let interest = 0;
  if (l.debt >= 5 * GOLD) { interest = Math.round(l.debt * DEBT_RATE); l.debt += interest; }
  const kids = people(l, "child").filter((c) => c.age < 18).length;
  const pay = l.job ? Number(l.flags.income ?? 0) : 0;
  f.ledger = {
    age: l.age, pay: Math.round(pay / GOLD), assets: assetIncome(l), living: Math.round(ftLiving(l, kids, pay) / GOLD),
    upkeep, interest: Math.round(interest / GOLD), ...(f.lastWorth === undefined ? {} : { net: Math.round((l.money - l.debt - f.lastWorth) / GOLD) || 0 }),
  };
  f.lastWorth = l.money - l.debt;
  // เจ้าหนี้มาทวง · หนีไปแล้วได้พักสามปี
  const fled = Number(l.flags.ftFled ?? -9), lastVisit = Number(l.flags.ftCreditorAt ?? -9);
  if (debtGold(l) >= CREDITOR_AT && l.age - fled > 3 && l.age - lastVisit >= 3 && chance(l, l.flags.ftCreditorAngry ? 0.8 : 0.4)) { l.flags.ftCreditorAt = l.age; runEvent(l, "ft.$.creditor"); }
}

/** ประมาณเงินปีหน้าแบบไม่มีเรื่องอะไรเกิด: ใช้เตือนก่อนเงินติดลบ */
export function nextYearGold(l: Life) {
  const g = fl(l).ledger;
  if (!g) return undefined;
  return Math.floor(l.money / GOLD) + g.pay + g.assets - g.living - upkeepOf(l) - Math.round((debtGold(l) * DEBT_RATE));
}

/** คนในครอบครัวที่ยังสนิทและพอช่วยได้ · ขอได้สิบปีครั้ง */
const kinHelper = (l: Life) => (l.age - Number(l.flags.ftKinHelp ?? -99) < 10 ? undefined : l.people.find((p) => p.alive && ["father", "mother", "sibling", "spouse", "child"].includes(p.relation) && p.bond >= 50 && (p.relation !== "child" || p.age >= 20)));
const settle = (l: Life, gold: number) => { const p = Math.min(l.debt, gold * GOLD); l.debt -= p; addMoney(l, -p); return Math.round(p / GOLD); };
const sellable = (l: Life) => ownedEstates(l).sort((a, b) => ESTATES[b].price - ESTATES[a].price)[0];

const CREDITOR: GameEvent = {
  ...E("ft.$.creditor", [18, 900], (l) => `เจ้าหนี้สามคนยืนรออยู่หน้าบ้านพร้อมสมุดบัญชี คุณติดหนี้อยู่ ${debtGold(l)} เหรียญทอง และดอกเบี้ยขึ้นทุกปี`, [
    C((l) => `ใช้หนี้ทั้งหมด (${debtGold(l)} เหรียญทอง)`, G("เจ้าหนี้ฉีกสมุดบัญชีหน้านั้นทิ้งต่อหน้าคุณ คืนนั้นคุณหลับสนิทเป็นครั้งแรกในรอบหลายปี", { joy: 6 }, (l) => { settle(l, debtGold(l)); delete l.flags.ftCreditorAngry; }), { req: (l) => (l.money < l.debt ? "เงินไม่พอ" : undefined) }),
    C("จ่ายเท่าที่มีตอนนี้", N((l) => `คุณเทถุงเงินจ่ายไป ${settle(l, Math.floor(l.money / GOLD))} เหรียญทอง เจ้าหนี้พยักหน้าแล้วจดยอดใหม่`, { joy: -2 }), { show: (l) => l.money >= GOLD && l.money < l.debt }),
    C((l) => { const id = sellable(l); return id ? `ขาย${ESTATES[id].name}ใช้หนี้` : `ขาย${HOMES[Number(l.flags.ftHome ?? 0)].name}แล้วย้ายไปบ้านที่เล็กลง`; },
      B("ของที่คุณเก็บเงินซื้อมาหลายปีเปลี่ยนมือในบ่ายเดียว", { joy: -6 }, (l) => { const id = sellable(l); if (id) sellOff(l, id); else downgradeHome(l); settle(l, debtGold(l)); }),
      { show: (l) => !!sellable(l) || Number(l.flags.ftHome ?? 0) > 0, cons: (l) => { const id = sellable(l); return `ได้คืนราว ${Math.round((id ? ESTATES[id].price : HOMES[Number(l.flags.ftHome ?? 0)].cost) * 0.4)} เหรียญทอง ไม่ถึงครึ่งของราคาที่ซื้อ`; } }),
    C((l) => { const k = kinHelper(l); return k ? `ขอให้${shortName(k)}ช่วยใช้หนี้ครึ่งหนึ่ง` : "ขอให้ครอบครัวช่วย"; }, G("ครอบครัวไม่ถามอะไรมาก แต่คุณเห็นสีหน้าตอนเขานับเหรียญ หนี้ลดลงไปครึ่งหนึ่ง", { joy: -1 }, (l) => { const k = kinHelper(l); if (k) k.bond = Math.max(0, k.bond - 12); l.debt = Math.round(l.debt / 2); delete l.flags.ftCreditorAngry; l.flags.ftKinHelp = l.age; }),
      { show: (l) => !!kinHelper(l), cons: "ความสัมพันธ์กับคนในครอบครัวลดลง" }),
    C("ทำงานใช้หนี้ให้เจ้าหนี้หนึ่งปี", N("คุณแบกกระสอบในโกดังของเจ้าหนี้ตั้งแต่ฟ้ามืดจนฟ้ามืด หนี้ลดลงไปก้อนใหญ่", { hp: -4, joy: -5 }, (l) => { l.debt = Math.max(0, Math.round(l.debt * 0.55) - 40 * GOLD); delete l.flags.ftCreditorAngry; }), { cons: "สุขภาพและความสุขลดลง" }),
    C("หนีไปอยู่เมืองอื่นตอนกลางคืน", B("คุณออกเดินทางตอนฟ้ายังมืด เจ้าหนี้จะตามหาคุณเจอ แต่คงไม่ใช่เร็วๆ นี้", { joy: -3 }, (l) => { const others = citiesOf(homeKingdom(l)).filter((c) => c.id !== cityOf(l).id); if (others[0]) fl(l).city = others[0].id; l.flags.ftFled = l.age; addStanding(l, -3); }),
      { show: (l) => citiesOf(homeKingdom(l)).length > 1, cons: "ชื่อเสียงในแผ่นดินลด และหนี้ยังอยู่" }),
    C("ไล่เจ้าหนี้ออกไป", (l, c) => {
      if (debtGold(l) >= PRISON_AT) {
        l.flags.jailUntil = l.age + 2; l.job = undefined; l.debt = Math.round(l.debt * 0.6);
        return B("ทหารมาถึงก่อนเที่ยง คุณถูกส่งเข้าคุกลูกหนี้หนึ่งปี หนี้บางส่วนถูกยกเลิกแลกกับอิสรภาพ", { joy: -10 })(l, c);
      }
      l.flags.ftCreditorAngry = true;
      return N("เจ้าหนี้ถอยไปพร้อมสายตาที่บอกว่าจะกลับมาอีก", { joy: -1 })(l, c);
    }, { tone: "danger", cons: "ถ้าหนี้เกิน 150 เหรียญทอง อาจติดคุกลูกหนี้" }),
  ], { title: "เจ้าหนี้มาเคาะประตู", forced: true }),
  manual: true,
};

/** ร้านของใหญ่: ทรัพย์สินที่เก็บเงินซื้อได้ทั้งชีวิต */
const estateChoice = (id: EstateId): Choice => ({
  label: () => { const e = ESTATES[id]; return `${e.name} · ${e.price} เหรียญทอง${e.upkeep ? ` · ดูแลปีละ ${e.upkeep}` : ""}`; },
  mark: `ได้: ${ESTATES[id].perk}`,
  cons: ESTATES[id].upkeep ? `ค่าดูแล ${ESTATES[id].upkeep} เหรียญทองทุกปี ค้างสองปีต้องขาย` : undefined,
  show: (l) => !owns(l, id),
  req: (l) => ESTATES[id].req?.(l) ?? (l.money < ESTATES[id].price * GOLD ? `ต้องมี ${ESTATES[id].price} เหรียญทอง` : undefined),
  run: (l) => {
    const e = ESTATES[id];
    addMoney(l, -e.price * GOLD);
    (fl(l).estates ??= {})[id] = 0;
    e.buy?.(l);
    if (Object.keys(fl(l).estates!).length === 3) deed(l, "เจ้าของทรัพย์สินที่คนทั้งเมืองพูดถึง");
    return BIG(`${e.name}เป็นของคุณแล้ว · ${e.perk}`)(l, {});
  },
});
const SHOP = SCENE("ft.$.shop", "ของใหญ่ที่เก็บเงินซื้อ", (l) => `ตอนนี้คุณมี ${Math.floor(l.money / GOLD)} เหรียญทอง · ค่าดูแลทรัพย์สินที่มีอยู่ปีละ ${upkeepOf(l)} เหรียญทอง`, [
  ...IDS.map(estateChoice),
  C("ยังไม่ซื้อ เก็บเงินต่อ", N("คุณปิดถุงเงินแล้วกลับบ้าน")),
]);

const ACTS: Activity[] = [
  { id: "ft_estate", emoji: "", name: "ซื้อของใหญ่", desc: "หอคอย คอกมังกร เรือเหาะ บรรดาศักดิ์ อาวุธสั่งตี", minAge: 18, time: 0, world: "fantasy", group: "ชีวิต",
    available: (l) => IDS.some((id) => !owns(l, id)), run: (l) => { runEvent(l, "ft.$.shop"); return { text: "" }; } },
];

export const ECONOMY_EVENTS: GameEvent[] = [CREDITOR, SHOP];

export function loadEconomy() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push(economyYear);
  combatHooks.push((l) => (l.ft && owns(l, "stable") && fl(l).estates!.stable === 0 ? [["คอกมังกร", 5]] : []));
  safetyHooks.push((l) => (l.ft && Number(l.flags.ftHome ?? 0) >= 4 ? 0.92 : 1));
  // บรรดาศักดิ์: ค่าจ้างทุกงาน +10% (ต่อจากโบนัสของเมือง)
  for (const c of CAREERS) if (c.world === "fantasy") { const before = c.salary; c.salary = (l, base) => (before ? before(l, base) : base) * (l.ft && owns(l, "title") ? 1.1 : 1); }
}
