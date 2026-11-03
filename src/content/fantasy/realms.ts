// ภพอื่นและความเป็นเทพ: ประตูสู่ภพปีศาจ ภพมังกร และสรวงสวรรค์ · เผ่าหายากอย่างมังกรและปีศาจ · เทพที่ผู้เล่นทิ้งไว้ให้คนรุ่นหลังกราบไหว้
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Choice, GameEvent } from "../../engine/events";
import { runEvent } from "../../engine/game";
import { chance, pick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { clamp, createPerson, displayName } from "../../engine/util";
import { addLegend, recordChronicle } from "../../engine/worldState";
import { addBond, aliveDragons } from "./dragons";
import { B, BIG, C, E, G, K, N, P, SCENE, type Res } from "./kit";
import { learnSpell, SPELLS } from "./magic";
import { canCast, fightOdds, MASTER } from "./power";
import { addStanding, dataOf, deed, fl, kingdomsOf, worldOfLife, type Gate, type Realm } from "./state";
import { addStars } from "./stars";

export const REALMS: Record<Realm, { name: string; desc: string }> = {
  demon: { name: "ภพปีศาจ", desc: "พันธสัญญา สมบัติ และเจ้าชายที่ไม่เคยแพ้" },
  dragon: { name: "ภพมังกร", desc: "บ้านเกิดของมังกรทั้งปวง และพิธีแปลงกาย" },
  divine: { name: "สรวงสวรรค์", desc: "บททดสอบของผู้ที่จะเป็นเทพ" },
};
export const DOMAINS = { war: "สงคราม", magic: "เวทมนตร์", harvest: "การเก็บเกี่ยว", trickery: "เล่ห์กล", mercy: "ความเมตตา" } as const;
type Domain = keyof typeof DOMAINS;
const VISIT_WAIT = 2;
const PACT_YEARS = 10;
/** วิญญาณหนึ่งดวงแบ่งขายได้ไม่เกินสามครั้ง */
const MAX_PACTS = 3;

const W = (l: Life) => worldOfLife(l);
const gateHere = (l: Life, r: Realm) => dataOf(l).gates.some((g) => g.realm === r && g.kingdom === fl(l).kingdom && g.until >= W(l).year);
/** ใครเข้าภพไหนได้: ประตูที่เปิดอยู่ในแผ่นดินนี้ เผ่าที่ภพนั้นเป็นบ้าน หรือคุณสมบัติพิเศษ */
export const godly = (l: Life) => { const f = fl(l); return (f.bodyRank >= MASTER || f.magicRank >= MASTER) && l.fame >= 70 && f.deeds.length >= 5; };
export function canEnter(l: Life, r: Realm) {
  const f = fl(l);
  if (r === "demon") return gateHere(l, r) || f.race === "demon" || (f.circle ?? 0) >= 3;
  if (r === "dragon") return gateHere(l, r) || f.race === "dragon" || !!f.dragonblood || !!f.mount;
  return godly(l);
}
const reachable = (l: Life) => (Object.keys(REALMS) as Realm[]).filter((r) => canEnter(l, r));

const ACTS: Activity[] = [
  { id: "ft_gate", emoji: "", name: "ข้ามไปยังภพอื่น", desc: `ต้องมีประตูเปิด หรือมีสิทธิ์พิเศษ · ทุก ${VISIT_WAIT} ปี`, minAge: 16, time: 2, world: "fantasy", group: "ภพอื่น", available: (l) => reachable(l).length > 0 && l.age >= Number(l.flags.ftGateNext ?? 0), run: (l) => { l.flags.ftGateNext = l.age + VISIT_WAIT; runEvent(l, "ft.v.choose"); return { text: "" }; } },
];

const go = (r: Realm): Choice => C(`${REALMS[r].name} · ${REALMS[r].desc}`, (l) => { fl(l).realmVisits = { ...fl(l).realmVisits, [r]: (fl(l).realmVisits?.[r] ?? 0) + 1 }; runEvent(l, `ft.v.${r}`); return { text: `คุณก้าวผ่านประตูสู่${REALMS[r].name}` }; }, { show: (l) => canEnter(l, r) });
const lethal = (odds: number, cause: string, text: string, hp: number): Res => (l, c) => (chance(l, odds) ? B(text, { die: cause })(l, c) : B(text, { hp: -hp })(l, c));

/** ขึ้นเป็นเทพ: ชีวิตจบลง แต่โลกได้เทพองค์ใหม่ที่คนรุ่นหลังกราบไหว้ได้ */
const ascend = (d: Domain): Choice => C(`เป็นเทพแห่ง${DOMAINS[d]}`, (l, c) => {
  const w = W(l);
  w.year = l.birthYear + l.age;
  dataOf(l).gods.push({ name: displayName(l), domain: d, year: w.year, kin: l.lastName });
  deed(l, `ขึ้นเป็นเทพแห่ง${DOMAINS[d]}`);
  addLegend(w, { name: displayName(l), deed: `ขึ้นสู่สวรรค์เป็นเทพแห่ง${DOMAINS[d]}`, lifeId: l.id });
  recordChronicle(w, `${displayName(l)}ขึ้นสู่สวรรค์เป็นเทพแห่ง${DOMAINS[d]}`);
  return BIG(`ร่างของคุณกลายเป็นแสง ชื่อของคุณจะถูกสวดในวิหารไปอีกพันปี`, { fame: 50, die: `ขึ้นสู่สวรรค์เป็นเทพแห่ง${DOMAINS[d]}` })(l, c);
});

const BOON: Record<Domain, [string, Res]> = {
  war: ["ขอพรแห่งชัยชนะ", G("แขนของคุณหนักแน่นขึ้นอย่างประหลาด", { body: 15 })],
  magic: ["ขอพรแห่งปัญญาเวท", G("ปลายนิ้วของคุณอุ่นด้วยมานาที่ไม่ใช่ของคุณ", { magic: 15 })],
  harvest: ["ขอพรแห่งความอุดม", G("ปีนั้นทุกอย่างที่คุณปลูกออกผลสองเท่า", { gold: 40 })],
  trickery: ["ขอพรแห่งโชค", G("คุณเจอเหรียญบนพื้นทุกครั้งที่ก้มมอง", { luck: 5 })],
  mercy: ["ขอพรแห่งการเยียวยา", G("แผลเก่าหายไปในคืนเดียว", { hp: 12 })],
};
const godOf = (l: Life, i: unknown) => dataOf(l).gods[Number(i)];

export const REALM_TRAVEL_EVENTS: GameEvent[] = [
  SCENE("ft.v.choose", "ประตูมิติ", "อากาศตรงหน้าคุณบิดเหมือนผิวน้ำ อีกฟากหนึ่งคือโลกที่ไม่มีใครกลับมาเล่าครบทุกคน", [go("demon"), go("dragon"), go("divine"), C("ถอยกลับ", N("ประตูปิดลงต่อหน้าคุณ"))]),

  SCENE("ft.v.demon", "ภพปีศาจ", (l) => `ท้องฟ้าสีเลือดและหินที่ร้อนจนเท้าพอง${fl(l).race === "demon" ? " แต่สำหรับคุณ ที่นี่คือบ้าน" : ""}`, [
    C(`ทำพันธสัญญาแลกพลัง (อายุขัยหาย ${PACT_YEARS} ปี)`, BIG("หมึกสีดำซึมเข้าผิวคุณ พลังที่ไม่ใช่ของคุณไหลเข้ามาเต็มอก", { magic: 60 }, (l) => { const f = fl(l); f.pacts = (f.pacts ?? 0) + 1; addStars(l, "magic", 2); addStanding(l, -10); if (f.pacts === 1) deed(l, "ทำพันธสัญญากับเจ้าปีศาจ"); }), { show: (l) => (fl(l).pacts ?? 0) < MAX_PACTS }),
    P("ขโมยสมบัติจากคลังนรก", (l) => fightOdds(l, 75), G("คุณกลับมาพร้อมเหรียญที่ร้อนจนต้องแช่น้ำ", { gold: 200 }), lethal(0.35, "ถูกทิ้งไว้ในภพปีศาจ", "ผู้เฝ้าคลังไล่ตามคุณถึงประตู", 30), { tone: "danger" }),
    K("ปลดปล่อยวิญญาณที่ติดอยู่", "luck", 50, G("วิญญาณนับร้อยตามคุณกลับไปยังโลกมนุษย์ และกระซิบชื่อคุณในวิหาร", { fame: 5, joy: 6 }, (l) => addStanding(l, 10)), B("พวกมันเกาะคุณแน่นจนลากคุณล้ม", { hp: -10 })),
    P("ท้าดวลเจ้าชายปีศาจ", (l) => fightOdds(l, 95), BIG("เขาเจ้าชายปีศาจหักอยู่ในมือคุณ ทั้งภพโค้งคำนับ", { fame: 30, body: 40 }, (l) => { fl(l).demonHorn = true; deed(l, "ปราบเจ้าชายปีศาจ"); addLegend(W(l), { name: displayName(l), deed: "ปราบเจ้าชายปีศาจในภพของเขาเอง", lifeId: l.id }); }), lethal(0.5, "สิ้นชีพในภพปีศาจ", "เจ้าชายหัวเราะแล้วโยนคุณกลับผ่านประตู", 40), { tone: "danger", show: (l) => !fl(l).demonHorn }),
    C("พักในบ้านเกิด", G("ไฟนรกอุ่นเหมือนอ้อมกอดแม่", { hp: 10, joy: 8 }), { show: (l) => fl(l).race === "demon" }),
  ]),
  SCENE("ft.v.dragon", "ภพมังกร", (l) => `ภูเขาลอยฟ้าเป็นร้อยลูก มังกรตัวใหญ่กว่าเมืองทั้งเมืองบินผ่านเงาของคุณ${fl(l).race === "dragon" ? " ทุกตัวหันมาทักคุณด้วยภาษาที่คุณรู้ตั้งแต่เกิด" : ""}`, [
    K("เข้ารับการทดสอบของสภามังกรเฒ่า", "smarts", 60, G("สภาพยักหน้า มังกรทุกตัวในโลกมนุษย์จะรู้ชื่อคุณ", { magic: 10 }, (l) => { for (const d of aliveDragons(l)) addBond(l, d, 30); const s = SPELLS.find((x) => x.element === fl(l).element && x.tier === 3); if (s && canCast(l) && !fl(l).spells?.includes(s.id)) learnSpell(l, s.id); }), B("คำตอบของคุณทำให้สภาหัวเราะจนฟ้าผ่า", { hp: -8 })),
    C("ดื่มน้ำจากทะเลสาบเกล็ดทอง", G("ทุกปีที่คุณเหลือยาวขึ้นอย่างที่หมอไม่มีทางอธิบาย", { hp: 15 }, (l) => { fl(l).lifeBonus = (fl(l).lifeBonus ?? 0) + 20; l.flags.ftLake = true; }), { show: (l) => !l.flags.ftLake }),
    P("ประกอบพิธีแปลงกายเป็นมังกร", (l) => 0.4 + (l.stats.luck - 50) / 150 + (fl(l).mount ? 0.15 : 0), BIG("กระดูกของคุณยืดออก ปีกฉีกผ่านแผ่นหลัง คุณไม่ใช่มนุษย์อีกต่อไป", { fame: 30, joy: 10 }, (l) => { transformToDragon(l); }), lethal(0.2, "ร่างกายแตกสลายระหว่างพิธีแปลงกาย", "ร่างของคุณปฏิเสธเลือดมังกร", 30), { tone: "danger", show: (l) => !!fl(l).dragonblood && fl(l).race !== "dragon" }),
    C("ตามหาบรรพบุรุษ", G("มังกรชราที่มีเกล็ดสีเดียวกับคุณเล่าเรื่องสายเลือดของคุณทั้งคืน", { body: 15, magic: 15 }), { show: (l) => fl(l).race === "dragon" }),
  ]),
  SCENE("ft.v.divine", "สรวงสวรรค์", (l) => `บันไดแสงทอดขึ้นไปไม่สิ้นสุด บททดสอบที่ ${(fl(l).divine ?? 0) + 1} จาก 3 รอคุณอยู่`, [
    P("บททดสอบแห่งกำลัง: สู้กับเงาของตัวเอง", (l) => fightOdds(l, 100), G("เงาของคุณคุกเข่า", { body: 10 }, trial), lethal(0.2, "พ่ายแพ้ต่อเงาของตัวเองบนบันไดสวรรค์", "เงาของคุณผลักคุณตกบันไดแสง", 30), { show: (l) => (fl(l).divine ?? 0) === 0 }),
    K("บททดสอบแห่งปัญญา: ตอบคำถามที่ไม่มีคำตอบ", "smarts", 75, G("ผู้พิทักษ์ยิ้มเป็นครั้งแรกในพันปี", { iq: 3 }, trial), B("คำตอบของคุณทำให้บันไดหายไปใต้เท้า", { hp: -15 }), { show: (l) => (fl(l).divine ?? 0) === 1 }),
    C("สละอาวุธตำนานแทนคำตอบ", G("ผู้พิทักษ์รับมันไว้ และบันไดก็ยาวขึ้นอีกขั้น", {}, (l) => { const f = fl(l); const r = dataOf(l).relics.find((x) => x.id === f.relic); if (r) { r.holder = "lost"; r.at = f.kingdom; } f.relic = undefined; trial(l); }), { show: (l) => (fl(l).divine ?? 0) === 1 && !!fl(l).relic }),
    ...(Object.keys(DOMAINS) as Domain[]).map((d) => ({ ...ascend(d), show: (l: Life) => (fl(l).divine ?? 0) >= 2 })),
    C("ยังไม่พร้อมทิ้งโลกมนุษย์", N("คุณเดินลงบันไดกลับไปหาคนที่รัก")),
  ]),

  E("ft.g.temple", [8, 400], (l, c) => { const g = godOf(l, c.g); return `วิหารของ${g.name} เทพแห่ง${DOMAINS[g.domain as Domain]} สร้างขึ้นเมื่อปี ${g.year} ยังมีคนจุดเทียนทุกคืน${g.kin === l.lastName ? " ป้ายหน้าวิหารเขียนนามสกุลเดียวกับคุณ" : ""}`; }, [
    C((l, c) => BOON[godOf(l, c.g).domain as Domain][0], (l, c) => BOON[godOf(l, c.g).domain as Domain][1](l, c)),
    C("เดินผ่านไป", N("คุณไม่เชื่อว่าคนธรรมดาจะกลายเป็นเทพได้")),
  ], { when: (l) => dataOf(l).gods.length > 0, weight: 5, maxTimes: 3, title: "วิหาร", prepare: (l) => ({ g: dataOf(l).gods.indexOf(pick(l, dataOf(l).gods)) }) }),
  E("ft.g.rift", [10, 400], (l) => `ประตูสู่${REALMS[dataOf(l).gates.find((g) => g.kingdom === fl(l).kingdom && g.until >= W(l).year)!.realm].name}เปิดอยู่นอกเมือง ${dataOf(l).gates.find((g) => g.kingdom === fl(l).kingdom && g.until >= W(l).year)!.realm === "demon" ? "สิ่งที่คลานออกมาทำให้หมาทั้งเมืองเห่าไม่หยุด" : "แสงจากอีกฟากทำให้ดอกไม้บานผิดฤดู"}`, [
    P("ช่วยทหารปิดทางที่ทะลักออกมา", (l) => fightOdds(l, 35), G("คุณกลับเข้าเมืองพร้อมเสียงเชียร์", { fame: 4, body: 6 }, (l) => addStanding(l, 8)), B("บางอย่างจากอีกฟากข่วนคุณจนเลือดไหล", { hp: -14 })),
    C("ไปยืนดูใกล้ๆ", G("คุณจำทางไปประตูนั้นได้แล้ว", { magic: 3 })),
    C("ปิดประตูบ้านแล้วรอ", N("คุณไม่ออกจากบ้านทั้งฤดู")),
  ], { when: (l) => dataOf(l).gates.some((g) => g.kingdom === fl(l).kingdom && g.until >= W(l).year), weight: 10, maxTimes: 3, title: "รอยแยกมิติ" }),
];

function trial(l: Life) {
  const f = fl(l);
  f.divine = (f.divine ?? 0) + 1;
  if (f.divine === 1) deed(l, "ผ่านบททดสอบแรกแห่งสรวงสวรรค์");
}

/** แปลงกายเป็นมังกร: เผ่าเปลี่ยน ค่าพลังเปลี่ยนตามเผ่า แต่ความทรงจำและชีวิตยังเป็นของเดิม */
export function transformToDragon(l: Life) {
  transform.fn?.(l, "dragon");
  deed(l, "แปลงกายเป็นมังกร");
  recordChronicle(W(l), `${displayName(l)}แปลงกายเป็นมังกรในภพมังกร`);
}
/** ผูกตอนโหลด เพื่อไม่ให้ไฟล์นี้กับไฟล์เผ่าอ้างกันเป็นวง */
export const transform: { fn?: (l: Life, r: "dragon") => void } = {};

/** ประตูเปิดเองในโลก · ปีศาจทะลักออกมาสร้างความวุ่นวาย */
export function tickGates(d: { gates: Gate[]; kingdoms: { id: string; name: string; stability: number }[] }, year: number, r: Pick<Life, "rng">, note: (t: string) => void) {
  d.gates = d.gates.filter((g) => g.until >= year);
  if (d.gates.length < 2 && chance(r, 0.03)) {
    const k = pick(r, d.kingdoms), realm: Realm = chance(r, 0.6) ? "demon" : "dragon";
    d.gates.push({ realm, kingdom: k.id, until: year + 5 });
    note(`ประตูสู่${REALMS[realm].name}เปิดขึ้นใน${k.name}`);
  }
  for (const g of d.gates) if (g.realm === "demon") { const k = d.kingdoms.find((x) => x.id === g.kingdom); if (k) k.stability = clamp(k.stability - 2, 5, 95); }
}

// ---------- เผ่าหายาก ----------
const race = (id: string) => (l: Life) => fl(l).race === id && !fl(l).throne;
export const RARE_EVENTS: GameEvent[] = [
  E("ft.r.dragon_form", [5, 14], "วันหนึ่งคุณโกรธจนเกล็ดขึ้นเต็มแขนต่อหน้าเด็กทั้งซอย", [
    K("สะกดมันกลับเข้าไปทันที", "smarts", 50, G("ทุกคนคิดว่าตาฝาด", { iq: 1 }), B("ข่าวลือว่าบ้านคุณเลี้ยงสัตว์ประหลาดแพร่ไปทั้งเมือง", { joy: -4 }, (l) => addStanding(l, -10))),
    C("คำรามใส่พวกมันให้หนีไป", N("ไม่มีใครกล้าแกล้งคุณอีก และไม่มีใครเล่นกับคุณอีกเช่นกัน", { joy: -3, body: 3 })),
  ], { when: race("dragon"), forced: true, maxTimes: 1, title: "เกล็ด" }),
  E("ft.r.dragon_hunter", [16, 500], "นักล่ามังกรที่ถือหอกเงินตามกลิ่นคุณมาถึงหน้าบ้าน", [
    P("แปลงร่างแล้วสู้", (l) => fightOdds(l, 45), G("เขาหนีไปพร้อมหอกที่ละลายครึ่งเล่ม", { fame: 4, body: 6 }), B("หอกเงินปักเข้าที่ปีกคุณ", { hp: -20 })),
    C("บินหนีไปแผ่นดินอื่น", (l, c) => { const k = pick(l, kingdomsOf(l).filter((x) => x.id !== fl(l).kingdom)); fl(l).kingdom = k.id; return N(`คุณร่อนลงที่${k.name}ก่อนรุ่งสาง`, { joy: -3 })(l, c); }),
  ], { when: (l) => race("dragon")(l) && l.age >= Number(l.flags.ftHunted ?? 0), weight: 8, maxTimes: 0, title: "นักล่ามังกร", prepare: (l) => { l.flags.ftHunted = l.age + 12; return {}; } }),
  E("ft.r.dragon_hoard", [20, 500], "คุณนอนหลับบนกองเหรียญของตัวเองทั้งฤดูหนาว และตื่นมาพบว่ามันดูเยอะขึ้น", [
    C("นับใหม่ทั้งหมด", G("สัญชาตญาณมังกรของคุณทำให้เงินงอกเงยเอง", {}, (l) => { const add = Math.min(200, Math.round(l.money / 10000)); l.money += add * 100; })),
    C("แบ่งให้คนยากจน", G("ชาวบ้านเริ่มเล่าว่ามังกรตัวนี้ใจดี", { joy: 4 }, (l) => addStanding(l, 10))),
  ], { when: (l) => race("dragon")(l) && l.money > 10_000, weight: 6, maxTimes: 5, title: "กองสมบัติ" }),
  E("ft.r.dragon_kin", [12, 500], (l) => `${aliveDragons(l)[0]?.name ?? "มังกรเฒ่า"}บินลงมาหาคุณกลางดึก "เจ้าคือลูกหลานของพวกเรา"`, [
    C("ขอให้สอนวิธีเป็นมังกร", G("คุณเรียนรู้การพ่นไฟครั้งแรก", { body: 10, magic: 8 }, (l) => { const d = aliveDragons(l)[0]; if (d) addBond(l, d, 20); })),
    C("บอกว่าคุณเลือกเป็นคน", N("มันมองคุณนานแล้วบินจากไปโดยไม่โกรธ", { joy: 2 })),
  ], { when: (l) => race("dragon")(l) && aliveDragons(l).length > 0, weight: 8, maxTimes: 1, title: "เครือญาติ" }),
  E("ft.r.demon_horns", [5, 14], "เขาเล็กๆ งอกขึ้นบนหน้าผากคุณ แม่ร้องไห้ทั้งคืน", [
    C("ใส่หมวกตลอดเวลา", N("คุณไม่เคยถอดหมวกต่อหน้าใครอีกเลย", { joy: -3 })),
    C("ไปหานักบวชที่ใจดีที่สุดในเมือง", G("เขาไม่กลัวคุณ และกลายเป็นคนแรกนอกบ้านที่รู้ความลับ", { joy: 4 }, (l) => { const p = createPerson(l, "friend", { age: l.age + 40, bond: 70 }); p.job = "นักบวช"; })),
  ], { when: race("demon"), forced: true, maxTimes: 1, title: "เขา" }),
  E("ft.r.demon_paladin", [16, 500], "อัศวินแห่งศาสนจักรอรุณพังประตูบ้านคุณเข้ามาพร้อมคบเพลิง", [
    P("สู้", (l) => fightOdds(l, 45), G("พวกเขาถอยออกไป แต่จะกลับมาพร้อมคนมากกว่าเดิม", { body: 6 }, (l) => addStanding(l, -8)), B("คบเพลิงเผาบ้านคุณไปครึ่งหลัง", { hp: -18, gold: -20 })),
    K("พิสูจน์ว่าคุณไม่ได้ทำร้ายใคร", "looks", 55, G("หัวหน้าอัศวินลดดาบลง และพาลูกน้องกลับไป", { joy: 4 }, (l) => addStanding(l, 10)), B("พวกเขาไม่ฟังอะไรทั้งนั้น", { hp: -12 })),
    C("หนีข้ามแดน", (l, c) => { const k = pick(l, kingdomsOf(l).filter((x) => x.id !== fl(l).kingdom)); fl(l).kingdom = k.id; return N(`คุณไปเริ่มใหม่ที่${k.name}`, { joy: -4 })(l, c); }),
  ], { when: (l) => race("demon")(l) && l.age >= Number(l.flags.ftHunted ?? 0), weight: 8, maxTimes: 0, title: "อัศวินอรุณ", prepare: (l) => { l.flags.ftHunted = l.age + 10; return {}; } }),
  E("ft.r.demon_whisper", [14, 500], "ในความฝัน เสียงจากภพปีศาจบอกว่าคุณไม่จำเป็นต้องทนกับมนุษย์เหล่านี้อีกต่อไป", [
    C("ฟังต่อ", G("คุณตื่นมาพร้อมพลังที่ไม่ได้ขอ และใจที่เย็นลงกว่าเดิม", { magic: 12, joy: -4 })),
    C("ตะโกนให้มันเงียบ", G("คุณตื่นมาพร้อมเหงื่อท่วมตัว แต่ยังเป็นตัวของตัวเอง", { joy: 3 })),
  ], { when: race("demon"), weight: 8, maxTimes: 3, title: "เสียงกระซิบ" }),
];

export const loadRealms = () => { ACTIVITIES.push(...ACTS); };
