// เดินทางไปดูโลก: ไปแล้วกลับ ไม่ได้ย้ายถิ่น · แต่ละภูมิภาคมีเรื่องและของดีของตัวเอง · ที่อยู่ปัจจุบันให้ผลทุกปี
// และปุ่มลงมือในสงครามสำนักจากแท็บยุทธภพ แทนการรอเหตุการณ์สุ่ม
import { timeLeft } from "../../../engine/activities";
import type { Ctx, GameEvent } from "../../../engine/events";
import { runEvent, yearHooks } from "../../../engine/game";
import { chance } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, log } from "../../../engine/util";
import { addQi } from "../martial/arts";
import { B, C, G, K, N, P, TAEL, ab, type Res } from "../story/kit";
import { activeWar, mySide } from "../world/sectWar";
import { REGIONS, regionOf } from "./region";
import { placeOf } from "./place";

export const TRIP_COST = 5;
const TRIP_TIME = 2, WAIT = 5, MIN_AGE = 16;

const act = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign(((l: Life, c: Ctx) => { f(l, c); return r(l, c); }) as Res, { fx: r.fx });

/** ผลรายปีของถิ่นที่อยู่ */
export const REGION_PERK: Record<string, { text: string; run: (l: Life) => void }> = {
  north: { text: "ลมหนาวสร้างคน: สุขภาพดีขึ้นบ้างในบางปี", run: (l) => { if (chance(l, 0.12)) addStat(l, "health", 1); } },
  jiangnan: { text: "การค้าคึกคัก: รายได้ปีละ +6%", run: (l) => addMoney(l, Math.round(Number(l.flags.income ?? 0) * 0.06)) },
  sichuan: { text: "สมุนไพรหาง่าย: ฟื้นตัวดีเมื่อสุขภาพต่ำ", run: (l) => { if (l.stats.health < 50 && chance(l, 0.3)) addStat(l, "health", 1); } },
  west: { text: "ทะเลทรายเงียบสงัด: ลมปราณสะสมปีละ +0.1", run: (l) => { if (l.power) addQi(l, 0.1); } },
  south: { text: "ป่าลึกสอนให้เอาตัวรอด: โชคดีขึ้นบ้างในบางปี", run: (l) => { if (chance(l, 0.15)) addStat(l, "luck", 1); } },
  capital: { text: "ข่าวสารไหลเร็ว: ชื่อเสียงขยับง่ายขึ้นในบางปี", run: (l) => { if (l.fame > 0 && chance(l, 0.25)) addFame(l, 1); } },
};

const visitedKey = (id: string) => `jr_${id}`;
export const visited = (l: Life) => REGIONS.filter((r) => l.flags[visitedKey(r.id)] !== undefined);

/** เหตุผลที่ไปที่นี่ตอนนี้ไม่ได้ · undefined = ไปได้ */
export function tripLocked(l: Life, id: string): string | undefined {
  const p = placeOf(l);
  if (p) return `อยู่${p.name}`;
  if (l.age < MIN_AGE) return `อายุ ${MIN_AGE}+`;
  if (regionOf(l).id === id) return "คุณอยู่ที่นี่แล้ว";
  if (l.doneThisYear.includes("journey")) return "ปีนี้เดินทางไปแล้ว";
  const last = l.flags[visitedKey(id)];
  if (last !== undefined && l.age - Number(last) < WAIT) return `กลับไปได้อีกใน ${WAIT - (l.age - Number(last))} ปี`;
  if (l.money < TRIP_COST * TAEL) return `ต้องมี ${TRIP_COST} ตำลึง`;
  const left = timeLeft(l);
  if (left !== undefined && left < TRIP_TIME) return "ปีนี้ไม่มีเวลาเหลือ";
}

export function startTrip(l: Life, id: string) {
  if (tripLocked(l, id)) return;
  l.doneThisYear.push("journey", "job:trip1", "job:trip2");
  addMoney(l, -TRIP_COST * TAEL);
  l.flags.mwWanderYears = Number(l.flags.mwWanderYears ?? 0) + 1;
  const first = l.flags[visitedKey(id)] === undefined;
  l.flags[visitedKey(id)] = l.age;
  if (first && visited(l).length === REGIONS.length - 1 && !l.flags.jrAll) {
    l.flags.jrAll = true;
    addFame(l, 5);
    log(l, "คุณเดินทางมาแล้วทุกภูมิภาคของแผ่นดิน มีน้อยคนนักที่จะพูดแบบนี้ได้", "milestone");
  }
  runEvent(l, `rg.jr_${id}`);
}

const trip = (id: string, title: string, text: string, choices: GameEvent["choices"]): GameEvent => ({ id: `rg.jr_${id}`, minAge: MIN_AGE, maxAge: 120, manual: true, maxTimes: 0, title, text: () => text, choices });

export const JOURNEY_EVENTS: GameEvent[] = [
  trip("north", "ทุ่งหญ้าภาคเหนือ", "ลมหนาวพัดทรายเข้าปาก กองม้าของชนเผ่าวิ่งผ่านเส้นขอบฟ้า ที่นี่ไม่มีใครสนใจว่าคุณเป็นใคร", [
    K("ร่วมล่าฝูงหมาป่ากับชาวทุ่ง", "health", 55, G("คุณกลับมาพร้อมหนังหมาป่าหนึ่งผืนและคำชมสั้นๆ จากผู้เฒ่า", { hp: 4, fame: 2 }), B("หมาป่าฉลาดกว่าที่คิด ขาคุณเป็นแผลยาว", { hp: -6 })),
    P("ซื้อม้าทุ่งไปขายทางใต้", ab(0.45, "smarts", 0.6), G("ม้าเจ็ดตัวรอดถึงตลาด คุณได้กำไรเกินคาด", { tael: 18 }), N("ม้าล้มตายกลางทางสองตัว คุณเสมอตัว", {})),
    C("นั่งฟังเพลงทุ่งหญ้าข้างกองไฟ", G("ท้องฟ้ากว้างจนคุณลืมเรื่องที่ค้างอยู่ที่บ้าน", { joy: 8 })),
  ]),
  trip("jiangnan", "คลองเจียงหนาน", "เรือสินค้าแน่นคลอง กลิ่นชาใหม่ลอยมาจากโรงน้ำชาทุกหัวสะพาน", [
    K("เจรจาการค้ากับพ่อค้าใหญ่", "smarts", 55, G("สัญญาผ้าไหมฉบับเล็กทำให้คุณได้ค่านายหน้าก้อนงาม", { tael: 22 }), N("พ่อค้ายิ้มแล้วบอกว่าจะติดต่อกลับ", {})),
    K("ร่วมประลองกวีที่หอริมน้ำ", "looks", 50, G("บทกวีของคุณถูกเขียนลงบนผนังหอ", { fame: 4, joy: 3 }), N("คนในหอปรบมือตามมารยาท", {})),
    C("ล่องเรือชมเมืองหนึ่งวัน", G("คนแจวเรือร้องเพลงที่คุณจำเนื้อไม่ได้ แต่ฮัมอยู่ทั้งปี", { joy: 8 })),
  ]),
  trip("sichuan", "หมอกเสฉวน", "ทางเดินแคบเกาะหน้าผา หมอกหนาจนเห็นแค่เท้าตัวเอง ร้านยาทุกร้านมีของที่เมืองอื่นไม่รู้จัก", [
    K("เก็บสมุนไพรบนหน้าผา", "health", 55, G("โสมภูเขารากหนึ่งบำรุงร่างกายคุณไปอีกนาน", { hp: 8 }), B("หินใต้เท้าหลุด คุณตกลงมาครึ่งหน้าผา", { hp: -8 })),
    P("ขอเรียนวิธีแก้พิษจากหมอยา", ab(0.45, "smarts", 0.6), G("เขาสอนสามเคล็ด และบอกว่าเคล็ดที่สี่แพงกว่าชีวิตคุณ", { iq: 1, hp: 3 }), N("หมอยาถามว่าคุณเป็นคนของใคร แล้วปิดประตู", {})),
    C("กินหม้อไฟจนเหงื่อท่วม", G("ลิ้นคุณชาไปสามวัน และคุณคิดถึงมันทุกปี", { joy: 7 })),
  ]),
  trip("west", "ทะเลทรายตะวันตก", "กองคาราวานเดินเรียงยาวเหมือนเส้นเชือกบนผืนทราย ซากเมืองเก่าโผล่จากเนินทรายเมื่อลมเปลี่ยนทิศ", [
    P("ค้นซากเมืองเก่า", ab(0.4, "luck", 0.7), G("ใต้กำแพงที่พังมีเหรียญทองจากแผ่นดินที่ไม่มีใครจำชื่อได้", { tael: 28 }), B("พายุทรายมาก่อนคุณจะหาทางออกเจอ", { hp: -7 })),
    K("นั่งสมาธิกลางทะเลทรายสามคืน", "smarts", 50, act(G("ความเงียบในทะเลทรายดังกว่าที่คุณคิด ลมปราณคุณนิ่งขึ้น", { joy: 3 }), (l) => addQi(l, 0.5)), N("คุณคิดถึงบ้านจนนั่งไม่ติด", {}), { show: (l) => !!l.power }),
    C("เดินตามกองคาราวานไปดูตลาดชายแดน", G("คุณได้ยินภาษาที่ไม่เคยได้ยิน และได้ลูกแห้งหนึ่งถุงเป็นของฝาก", { joy: 7 })),
  ]),
  trip("south", "ป่าทางใต้", "อากาศร้อนชื้นจนเสื้อไม่เคยแห้ง เสียงกลองของชนเผ่าดังมาจากที่ไหนสักแห่งในป่า", [
    K("ช่วยรักษาคนไข้ป่าในหมู่บ้าน", "smarts", 55, G("ชนเผ่ามอบเขี้ยวเสือให้คุณ และบอกทางลัดที่ไม่มีในแผนที่", { fame: 3, align: 3 }), B("คุณติดไข้เสียเอง", { hp: -7 })),
    P("ตามหากล้วยไม้เลือดในป่าลึก", ab(0.4, "luck", 0.7), G("พ่อค้ายาจ่ายแพงกว่าที่คุณกล้าเรียก", { tael: 24 }), B("งูเขียวหล่นจากกิ่งไม้ใส่บ่าคุณ", { hp: -6 })),
    C("ร่วมงานเทศกาลของชนเผ่า", G("คุณไม่รู้ว่าดื่มอะไรเข้าไป แต่ทุกคนหัวเราะ", { joy: 8 })),
  ]),
  trip("capital", "เมืองหลวง", "ถนนหลวงกว้างพอให้รถม้าวิ่งแปดคัน ทุกคนในเมืองนี้ดูเหมือนกำลังรีบไปพบใครสักคน", [
    K("ฝากตัวกับขุนนางที่รู้จักคนบ้านเดียวกัน", "looks", 55, G("คุณได้ป้ายเชิญไปงานเลี้ยงหนึ่งงาน ชื่อคุณเริ่มมีคนจำ", { fame: 5 }), N("คนเฝ้าประตูบอกให้มาใหม่ปีหน้า", {})),
    P("ฟังข่าวในโรงน้ำชาใกล้วัง", ab(0.5, "smarts", 0.6), G("ข่าวเรื่องราคาข้าวที่ได้ยินทำเงินให้คุณเมื่อกลับบ้าน", { tael: 20 }), N("ข่าวที่ได้ยินไม่จริงสักเรื่อง", {})),
    C("เดินชมตลาดกลางคืน", G("โคมไฟเรียงยาวสุดถนน คุณซื้อของฝากให้คนที่บ้าน", { joy: 7, tael: -2 })),
  ]),
];

/** ปุ่มสงครามสำนัก */
export interface WarAction { label: string; locked?: string; run: (l: Life) => void }
export function warAction(l: Life): WarAction | undefined {
  if (!activeWar(l) || !l.power || placeOf(l)) return;
  const side = mySide(l);
  if (side) {
    const left = timeLeft(l);
    const locked = l.doneThisYear.includes("job:war") ? "ปีนี้ออกศึกแล้ว" : left !== undefined && left < 1 ? "ปีนี้ไม่มีเวลาเหลือ" : l.age > 80 ? "แก่เกินจะออกศึก" : undefined;
    return { label: "ออกศึกปีนี้", locked, run: (x) => { x.doneThisYear.push("job:war"); runEvent(x, "sw.battle"); } };
  }
  if (l.flags.warSide !== "none") return { label: "เลือกข้าง", run: (x) => runEvent(x, "sw.declared") };
}

yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive || placeOf(l)) return;
  REGION_PERK[regionOf(l).id]?.run(l);
});
