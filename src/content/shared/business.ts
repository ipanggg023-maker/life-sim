// M25 — ธุรกิจและอสังหาฯ (ทุกโลก): เปิดกิจการ 5 ระดับ ขยาย ขาย · ซื้อทรัพย์สินให้เช่า · รายได้ทุกปี + เหตุการณ์ของกิจการ
import { ACTIVITIES } from "../../engine/activities";
import type { Choice, GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, log, money } from "../../engine/util";
import { jailed, tone } from "./freedom";

interface Biz { t: number; lv: number; rep: number; yrs: number }
interface Prop { k: number; v: number }

/** ชื่อกิจการตามโทน [ปัจจุบัน, ซากเมือง, ยุทธภพ, ราชสำนัก] · ทุน · รายได้พื้นฐานต่อปี */
const BIZ: { names: [string, string, string, string]; emoji: string; cost: number; income: number }[] = [
  { names: ["รถเข็นขายของ", "แผงแลกของในฐาน", "แผงซาลาเปา", "แผงขนมปังในตลาด"], emoji: "🛒", cost: 150_000, income: 45_000 },
  { names: ["ร้านกาแฟ", "โรงซ่อมอาวุธ", "ร้านยาสมุนไพร", "ร้านตัดเสื้อ"], emoji: "☕", cost: 800_000, income: 200_000 },
  { names: ["ร้านอาหาร", "ฟาร์มในฐาน", "โรงเตี๊ยม", "โรงแรมริมถนนหลวง"], emoji: "🍜", cost: 3_000_000, income: 700_000 },
  { names: ["บริษัทเทคโนโลยี", "เครือข่ายการค้าระหว่างฐาน", "สำนักคุ้มภัย", "บริษัทการค้าทางเรือ"], emoji: "🏢", cost: 12_000_000, income: 2_500_000 },
  { names: ["เครือห้างสรรพสินค้า", "เมืองผู้รอดชีวิต", "หอการค้าแห่งแคว้น", "ธนาคารแห่งจักรวรรดิ"], emoji: "🏙️", cost: 50_000_000, income: 9_000_000 },
];
const PROPS: { names: [string, string, string, string]; emoji: string; cost: number; rent: number }[] = [
  { names: ["ห้องคอนโดให้เช่า", "ห้องพักในฐาน", "ห้องเช่าในตรอก", "ห้องเช่าในเมือง"], emoji: "🏬", cost: 1_500_000, rent: 0.06 },
  { names: ["บ้านเดี่ยว", "บ้านปลอดภัยนอกฐาน", "เรือนไม้ริมน้ำ", "บ้านในย่านขุนนาง"], emoji: "🏡", cost: 5_000_000, rent: 0.05 },
  { names: ["ตึกแถวทำเลทอง", "โกดังเสบียง", "ตึกร้านค้ากลางเมือง", "อาคารพาณิชย์ริมท่าเรือ"], emoji: "🏪", cost: 15_000_000, rent: 0.065 },
  { names: ["ที่ดินเปล่า", "พื้นที่เพาะปลูก", "ที่นาริมเขา", "ที่ดินในชนบท"], emoji: "🌾", cost: 8_000_000, rent: 0.01 },
];

const ti = (l: Life) => ({ modern: 0, ruins: 1, murim: 2, court: 3 })[tone(l)];
export const bizList = (l: Life): Biz[] => { try { return JSON.parse(String(l.flags.bizData ?? "[]")); } catch { return []; } };
export const propList = (l: Life): Prop[] => { try { return JSON.parse(String(l.flags.propData ?? "[]")); } catch { return []; } };
const saveBiz = (l: Life, b: Biz[]) => { l.flags.bizData = JSON.stringify(b); };
const saveProp = (l: Life, p: Prop[]) => { l.flags.propData = JSON.stringify(p); };
export const bizName = (l: Life, b: Biz) => `${BIZ[b.t].emoji} ${BIZ[b.t].names[ti(l)]}`;
export const propName = (l: Life, p: Prop) => `${PROPS[p.k].emoji} ${PROPS[p.k].names[ti(l)]}`;
const bizValue = (b: Biz) => Math.round(BIZ[b.t].cost * b.lv * (0.5 + b.rep / 100));
const upCost = (b: Biz) => BIZ[b.t].cost * b.lv;
/** มูลค่าทรัพย์สินทั้งหมด (ธุรกิจ + อสังหาฯ) */
export const assetsValue = (l: Life) => bizList(l).reduce((s, b) => s + bizValue(b), 0) + propList(l).reduce((s, p) => s + p.v, 0);

ACTIVITIES.push({
  id: "biz_menu",
  emoji: "🏪",
  name: "ธุรกิจ/ทรัพย์สิน",
  desc: "เปิดกิจการ ซื้อบ้าน ให้เช่า",
  minAge: 18,
  world: "all",
  available: (l) => !jailed(l),
  run: (l) => { runEvent(l, "biz.menu"); return { text: "" }; },
});

// ───────────────────────── เมนู ─────────────────────────

const openChoice = (t: number): Choice => ({
  label: (l) => `เปิด${BIZ[t].names[ti(l)]} (${money(l, BIZ[t].cost)})`,
  show: (l) => l.money >= BIZ[t].cost && bizList(l).length < 3 && !bizList(l).some((b) => b.t === t),
  run: (l) => {
    addMoney(l, -BIZ[t].cost);
    saveBiz(l, [...bizList(l), { t, lv: 1, rep: 50, yrs: 0 }]);
    l.flags.bizOpened = Number(l.flags.bizOpened ?? 0) + 1;
    return { text: `🎉 เปิด${BIZ[t].emoji} ${BIZ[t].names[ti(l)]}แล้ว! วันแรกลูกค้า${pick(l, ["แน่นร้าน", "มาเรื่อยๆ", "น้อยกว่าที่คิดแต่ทุกคนชม"])}`, kind: "milestone" };
  },
});

const bizSlot = (i: number, act: "up" | "sell"): Choice => ({
  label: (l) => {
    const b = bizList(l)[i];
    return act === "up" ? `ขยาย${bizName(l, b)} → ระดับ ${b.lv + 1} (${money(l, upCost(b))})` : `ขาย${bizName(l, b)} (ได้ราว ${money(l, bizValue(b))})`;
  },
  show: (l) => { const b = bizList(l)[i]; return !!b && (act === "sell" || (b.lv < 5 && l.money >= upCost(b))); },
  run: (l) => {
    const list = bizList(l);
    const b = list[i];
    if (act === "up") {
      addMoney(l, -upCost(b));
      b.lv++;
      saveBiz(l, list);
      return { text: `${bizName(l, b)}ขยายเป็นระดับ ${b.lv} — ${pick(l, ["เปิดสาขาใหม่", "รีโนเวตทั้งร้าน", "จ้างพนักงานเพิ่ม"])}`, kind: "good" };
    }
    const v = bizValue(b);
    addMoney(l, v);
    saveBiz(l, list.filter((_, j) => j !== i));
    return { text: `คุณขาย${bizName(l, b)}ได้ ${money(l, v)}`, kind: "good" };
  },
});

const buyProp = (k: number): Choice => ({
  label: (l) => `ซื้อ${PROPS[k].names[ti(l)]} (${money(l, PROPS[k].cost)})`,
  show: (l) => l.money >= PROPS[k].cost && propList(l).length < 6,
  run: (l) => {
    addMoney(l, -PROPS[k].cost);
    saveProp(l, [...propList(l), { k, v: PROPS[k].cost }]);
    addStat(l, "happiness", 4);
    return { text: `🔑 คุณได้กุญแจ${PROPS[k].emoji} ${PROPS[k].names[ti(l)]}มาแล้ว${k === 3 ? " — ที่ดินไม่มีค่าเช่า แต่ราคาอาจพุ่งในอนาคต" : " — มีผู้เช่าติดต่อมาทันที"}`, kind: "good" };
  },
});

const sellProp = (i: number): Choice => ({
  label: (l) => { const p = propList(l)[i]; return `ขาย${propName(l, p)} (${money(l, p.v)})`; },
  show: (l) => !!propList(l)[i],
  run: (l) => {
    const list = propList(l);
    const p = list[i];
    addMoney(l, p.v);
    saveProp(l, list.filter((_, j) => j !== i));
    return { text: `ขาย${propName(l, p)}ได้ ${money(l, p.v)} (${p.v >= PROPS[p.k].cost ? "กำไร" : "ขาดทุน"} ${money(l, Math.abs(p.v - PROPS[p.k].cost))})`, kind: p.v >= PROPS[p.k].cost ? "good" : "bad" };
  },
});

export const BIZ_EVENTS: GameEvent[] = [
  {
    id: "biz.menu",
    minAge: 0, maxAge: 200, manual: true, maxTimes: 0,
    title: "ธุรกิจและทรัพย์สิน",
    text: (l) => {
      const b = bizList(l), p = propList(l);
      const lines = [
        ...b.map((x) => `${bizName(l, x)} ระดับ ${x.lv} · ชื่อเสียงร้าน ${x.rep}`),
        ...p.map((x) => `${propName(l, x)} · มูลค่า ${money(l, x.v)}`),
      ];
      return lines.length ? `ทรัพย์สินของคุณ (มูลค่ารวม ${money(l, assetsValue(l))}):\n${lines.join("\n")}` : "คุณยังไม่มีกิจการหรือทรัพย์สิน — จะเริ่มอะไรดี?";
    },
    choices: [
      ...BIZ.map((_, t) => openChoice(t)),
      ...[0, 1, 2].flatMap((i) => [bizSlot(i, "up"), bizSlot(i, "sell")]),
      ...PROPS.map((_, k) => buyProp(k)),
      ...[0, 1, 2, 3, 4, 5].map(sellProp),
      { label: "ไว้ก่อน", run: () => ({ text: "คุณปิดสมุดบัญชีไว้ก่อน" }) },
    ],
  },
  // เหตุการณ์ของกิจการ
  {
    id: "biz.review",
    minAge: 18, maxAge: 120, maxTimes: 3, weight: (l) => (bizList(l).length ? 8 : 0),
    title: "รีวิว",
    text: (l) => `${tone(l) === "murim" ? "นักชิมพเนจร" : tone(l) === "court" ? "นักวิจารณ์จากหนังสือพิมพ์หลวง" : "อินฟลูเอนเซอร์สายกิน"}แวะมาที่${bizName(l, bizList(l)[0])}`,
    choices: [
      { label: "ต้อนรับอย่างดีที่สุด", check: { stat: "looks", dc: 50 }, skill: ["social", "cook"], run: (l, _c, ok) => { const list = bizList(l); list[0].rep = clamp(list[0].rep + (ok ? 15 : -5), 0, 100); saveBiz(l, list); return ok ? { text: "รีวิวห้าดาว! ลูกค้าต่อคิวยาวไปอีกหลายเดือน", kind: "good" } : { text: "รีวิวกลางๆ — บอกว่า 'ดีแต่ไม่ว้าว'", kind: "bad" }; } },
      { label: "ทำตามปกติ ไม่พิเศษ", run: (l) => { const list = bizList(l); list[0].rep = clamp(list[0].rep + randInt(l, -3, 8), 0, 100); saveBiz(l, list); return { text: "รีวิวตามจริง — ลูกค้าประจำชอบที่ร้านไม่เปลี่ยน" }; } },
    ],
  },
  {
    id: "biz.staff",
    minAge: 18, maxAge: 120, maxTimes: 3, weight: (l) => (bizList(l).length ? 7 : 0),
    title: "พนักงานคนเก่ง",
    text: (l) => `พนักงานที่เก่งที่สุดของ${bizName(l, bizList(l)[0])}ได้ข้อเสนอจากคู่แข่ง`,
    choices: [
      { label: "ขึ้นเงินเดือนให้", run: (l) => { addMoney(l, -100_000); const list = bizList(l); list[0].rep = clamp(list[0].rep + 6, 0, 100); saveBiz(l, list); return { text: "เขาอยู่ต่อและทำงานหนักกว่าเดิม", kind: "good" }; } },
      { label: "ให้หุ้นส่วนเล็กๆ", run: (l) => { createPerson(l, "ally", { age: l.age - randInt(l, 0, 10), bond: 70, job: "หุ้นส่วนธุรกิจ" }); return { text: "เขากลายเป็นหุ้นส่วนที่ภักดีที่สุดของคุณ", kind: "good" }; } },
      { label: "ปล่อยไป", run: (l) => { const list = bizList(l); list[0].rep = clamp(list[0].rep - 10, 0, 100); saveBiz(l, list); return { text: "ร้านวุ่นวายไปหลายเดือนกว่าจะหาคนแทนได้", kind: "bad" }; } },
    ],
  },
  {
    id: "biz.crisis",
    minAge: 18, maxAge: 120, maxTimes: 3, weight: (l) => (bizList(l).length ? 6 : 0),
    title: "วิกฤตกิจการ",
    text: (l) => `${pick(l, tone(l) === "ruins" ? ["สัตว์อสูรบุกโกดัง", "หลังคารั่วกลางพายุ", "แก๊งปล้นขู่เก็บค่าคุ้มครอง"] : tone(l) === "murim" ? ["พรรคมารมาเก็บค่าคุ้มครอง", "ไฟไหม้ครัว", "ข่าวลือว่าอาหารมีพิษ"] : tone(l) === "court" ? ["ขุนนางขึ้นภาษีการค้า", "ไฟไหม้โกดัง", "คู่แข่งปล่อยข่าวลือ"] : ["น้ำท่วมหน้าร้าน", "ข่าวปลอมในโซเชียล", "ค่าเช่าขึ้นสองเท่า"])} — ${bizName(l, bizList(l)[0])}กำลังลำบาก`,
    choices: [
      { label: "ทุ่มเงินแก้ปัญหา", show: (l) => l.money >= Math.round(BIZ[bizList(l)[0]?.t ?? 0].cost * 0.2), run: (l) => { addMoney(l, -Math.round(BIZ[bizList(l)[0].t].cost * 0.2)); return { text: "เสียเงินไม่น้อย แต่กิจการรอด", kind: "good" }; } },
      { label: "แก้ด้วยไหวพริบ", check: { stat: "smarts", dc: 60 }, skill: ["business", "social"], run: (l, _c, ok) => { const list = bizList(l); list[0].rep = clamp(list[0].rep + (ok ? 10 : -15), 0, 100); saveBiz(l, list); return ok ? { text: "คุณพลิกวิกฤตเป็นโอกาส ลูกค้าเห็นใจและกลับมาอุดหนุนมากกว่าเดิม", kind: "good" } : { text: "แผนไม่ได้ผล กิจการซบเซาไปพักใหญ่", kind: "bad" }; } },
    ],
  },
  {
    id: "biz.buyout",
    minAge: 25, maxAge: 120, maxTimes: 2, weight: (l) => (bizList(l).some((b) => b.lv >= 3) ? 5 : 0),
    title: "ข้อเสนอซื้อกิจการ",
    text: (l) => { const b = bizList(l).find((x) => x.lv >= 3)!; return `กลุ่มทุนใหญ่เสนอซื้อ${bizName(l, b)}ในราคาสองเท่าของมูลค่า (${money(l, bizValue(b) * 2)})`; },
    choices: [
      { label: "ขาย รับเงินก้อนใหญ่", run: (l) => { const list = bizList(l); const i = list.findIndex((x) => x.lv >= 3); const v = bizValue(list[i]) * 2; addMoney(l, v); saveBiz(l, list.filter((_, j) => j !== i)); return { text: `คุณขายได้ ${money(l, v)} — ตัวเลขในบัญชีทำให้มือสั่น`, kind: "milestone" }; } },
      { label: "ไม่ขาย นี่คือชีวิตของฉัน", run: (l) => { addStat(l, "happiness", 4); addFame(l, 1); return { text: "คุณปฏิเสธ — พนักงานทุกคนได้ยินและปรบมือ", kind: "good" }; } },
    ],
  },
  {
    id: "biz.tenant",
    minAge: 18, maxAge: 120, maxTimes: 3, weight: (l) => (propList(l).some((p) => p.k !== 3) ? 6 : 0),
    title: "ผู้เช่า",
    text: () => "ผู้เช่าค้างค่าเช่าสามเดือน บอกว่าตกงานและลูกป่วย",
    choices: [
      { label: "ผ่อนผันให้", run: (l) => { addMoney(l, -30_000); addStat(l, "happiness", 3); l.flags.karma = Number(l.flags.karma ?? 0) + 1; return { text: "ครึ่งปีต่อมาเขาจ่ายครบพร้อมกระเช้าผลไม้", kind: "good" }; } },
      { label: "ให้ย้ายออก", run: (l) => { addStat(l, "happiness", -2); return { text: "ได้ห้องคืน แต่คุณนอนไม่ค่อยหลับไปหลายคืน" }; } },
    ],
  },
  {
    id: "biz.land_boom",
    minAge: 18, maxAge: 120, maxTimes: 1, weight: (l) => (propList(l).some((p) => p.k === 3) ? 5 : 0),
    title: "ที่ดินราคาพุ่ง",
    text: () => "มีข่าวว่าจะตัดถนนใหญ่ผ่านที่ดินของคุณ นายหน้าโทรมาไม่หยุด",
    choices: [
      { label: "ถือไว้ต่อ", run: (l) => { const list = propList(l); for (const p of list) if (p.k === 3) p.v = Math.round(p.v * 2.5); saveProp(l, list); return { text: "ราคาที่ดินพุ่งขึ้นสองเท่าครึ่ง!", kind: "milestone" }; } },
      { label: "ขายทันทีตอนข่าวดี", run: (l) => { const list = propList(l); const i = list.findIndex((p) => p.k === 3); const v = Math.round(list[i].v * 1.8); addMoney(l, v); saveProp(l, list.filter((_, j) => j !== i)); return { text: `ขายได้ ${money(l, v)} — ไม่ต้องลุ้นต่อ`, kind: "good" }; } },
    ],
  },
];

// รายได้ประจำปี
yearHooks.push((l) => {
  if (!l.alive) return;
  const list = bizList(l);
  if (list.length) {
    let total = 0;
    for (const b of list) {
      b.yrs++;
      b.rep = clamp(b.rep + randInt(l, -6, 6), 5, 100);
      const inc = Math.round(BIZ[b.t].income * b.lv * (0.4 + b.rep / 80) * (0.6 + randInt(l, 0, 80) / 100) - BIZ[b.t].cost * 0.08 * b.lv);
      total += inc;
      if (b.rep <= 10 && chance(l, 0.3)) {
        log(l, `📉 ${bizName(l, b)}ขาดทุนต่อเนื่องจนต้องปิดกิจการ`, "bad");
        b.lv = 0;
      }
    }
    saveBiz(l, list.filter((b) => b.lv > 0));
    addMoney(l, total);
    if (Math.abs(total) >= 1000) log(l, `🏪 กิจการปีนี้${total >= 0 ? "กำไร" : "ขาดทุน"} ${money(l, Math.abs(total))}`, total >= 0 ? "good" : "bad");
  }
  const props = propList(l);
  if (props.length) {
    let rent = 0;
    for (const p of props) {
      rent += Math.round(p.v * PROPS[p.k].rent);
      p.v = Math.round(p.v * (1 + randInt(l, -4, 8) / 100));
    }
    saveProp(l, props);
    addMoney(l, rent);
    if (rent > 0) log(l, `🏠 ได้ค่าเช่าทรัพย์สินรวม ${money(l, rent)}`, "good");
  }
});
