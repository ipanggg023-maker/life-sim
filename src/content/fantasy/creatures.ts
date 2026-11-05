// สัตว์และสิ่งลี้ลับ (Release 14): มังกรที่โตไปตลอดชีวิตและอยู่กับทายาท มังกรผู้ทรงอำนาจและการสูญพันธุ์ พันธะของเลือดมังกร
// สัตว์ขี่และสายเลือด ตลาดสัตว์และตลาดมืด สัตว์หายากของนักฝึก ภูต ปีศาจ ผี ปริศนาของสัตว์ผู้รู้ สัตว์เลี้ยงที่เติบโต
// สัตว์ประจำถิ่นและการล่าจนหมด และสัตว์ที่ช่วยในศึกใหญ่
import { ACTIVITIES, activityFilters, type Activity } from "../../engine/activities";
import { eligibilityFilters, getEvent, type Ctx, type GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, log, shortName } from "../../engine/util";
import { B, BIG, C, E, G, GOLD, K, N, P, PAY, SCENE } from "./kit";
import { combatHooks, fightOdds } from "./power";
import { addStanding, dataOf, deed, fl, homeKingdom } from "./state";
import { lean } from "./persona";
import { cityOf, moveTo } from "./cities";
import { aliveDragons } from "./dragons";
import { allyHooks, allyLossHooks, afflict } from "./danger";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
const gold = (l: Life) => Math.floor(l.money / GOLD);
const jailed = (l: Life) => Number(l.flags.jailUntil ?? -1) > l.age;
const yearly = (k: string) => (l: Life) => Number(l.flags[k] ?? -1) !== l.age;
const after = (e: GameEvent, fn: (l: Life, c: Ctx) => void): GameEvent => ({ ...e, choices: e.choices?.map((ch) => ({ ...ch, run: (l, c, ok) => { fn(l, c); return ch.run(l, c, ok); } })) });
const tamerLv = (l: Life) => (l.job?.careerId === "ft_tamer" ? l.job.level : 0) + (fl(l).school === "beastwarden" && fl(l).graduated ? 1 : 0);

// ───────────── มังกรที่โตไปตลอดชีวิต ─────────────
export const DRAGON_STAGES: [number, string][] = [[0, "ลูกมังกร"], [6, "มังกรหนุ่ม"], [21, "มังกรโตเต็มวัย"], [61, "มังกรใหญ่"]];
export const stageOf = (age: number) => [...DRAGON_STAGES].reverse().find(([a]) => age >= a)![1];
const TRAITS = ["หยิ่งทะนง", "อ่อนโยน", "ละโมบ", "ช่างสงสัย"];
const WISH: Record<string, [string, string]> = {
  หยิ่งทะนง: ["อยากให้คุณพามันไปประลองกับมังกรตัวอื่นต่อหน้าผู้คน", "พาไปประลอง"],
  อ่อนโยน: ["อยากให้คุณพาเด็กๆ ในหมู่บ้านมาเล่นด้วย ไม่ใช่ซ่อนมันไว้ในโรงนา", "พาเด็กๆ มาเล่นด้วย"],
  ละโมบ: ["อยากได้กองทองของตัวเองไว้นอนทับ", "หาทองมากองให้มัน"],
  ช่างสงสัย: ["อยากบินไปดูทะเลที่ไม่มีใครเคยเห็น", "บินไปกับมัน"],
};
export const WISH_GAP = 5;
const wh = (l: Life) => fl(l).whelp!;
const WISH_EV = after(E("ft.cr.wish", [10, 900], (l) => `${wh(l).name}${stageOf(wh(l).age)}นิสัย${wh(l).trait}ของคุณ${WISH[wh(l).trait ?? "อ่อนโยน"][0]}`, [
  C((l) => WISH[wh(l).trait ?? "อ่อนโยน"][1], (l) => {
    const w = wh(l), t = w.trait ?? "อ่อนโยน";
    if (t === "ละโมบ") { const g = Math.min(40, gold(l)); addMoney(l, -g * GOLD); }
    if (t === "หยิ่งทะนง" && !chance(l, 0.6)) { w.bond = clamp(w.bond + 5, 0, 100); return { text: `${w.name}แพ้การประลอง แต่คุณยืนข้างมันจนจบ`, kind: "good" }; }
    w.bond = clamp(w.bond + 15, 0, 100); w.power = Math.min(95, w.power + 3);
    return { text: `${w.name}ส่งเสียงคำรามยาวด้วยความสุข และไม่ห่างคุณไปทั้งปี`, kind: "good" };
  }),
  C("บอกมันว่าไม่ได้", N((l) => `${wh(l).name}หันหลังให้คุณและไม่ยอมกินอาหารสามวัน`, {}, (l) => { wh(l).bond = clamp(wh(l).bond - 10, 0, 100); })),
], { title: "สิ่งที่มังกรอยากได้", when: (l) => on(l) && !!fl(l).whelp && wh(l).age >= 3 && l.age - Number(l.flags.ftWishAt ?? -99) >= WISH_GAP, weight: 30, maxTimes: 0 }), (l) => { l.flags.ftWishAt = l.age; });

/** ทายาทที่โตมากับมังกรได้มังกรต่อ (เรียกจาก life.ts หลังรับมรดก) */
export function inheritCreatures(dead: Life, next: Life, heirId?: string) {
  const d = fl(dead), n = fl(next);
  const heir = dead.people.find((p) => p.id === heirId);
  const id = dead.flags.ftWhelpLeft;
  if (id && heir?.tags?.includes("dragonfriend")) {
    const ds = dataOf(next).dragons, i = ds.findIndex((x) => x.id === id && x.alive);
    if (i >= 0) { const x = ds[i]; ds.splice(i, 1); n.whelp = { name: x.name, element: x.element, age: x.age, bond: 60, power: x.power, lastCare: next.age, from: "inherit", trait: d.whelp?.trait }; next.flags.ftWhelpCame = x.name; }
  }
  if (d.steed && d.steed.born + STEEDS[d.steed.kind].life > dead.age + 1) n.steed = { ...d.steed, bond: 40, lastCare: next.age };
}
const OLD_WHELP = after(E("ft.cr.oldwhelp", [16, 900], (l) => { const x = oldWhelp(l)!; return x.mood >= 0 ? `มังกร${x.name}ที่ตระกูล${l.lastName}เคยเลี้ยงเมื่อหลายสิบปีก่อนบินลงมาเกาะหลังคาบ้านคุณ มันจำกลิ่นของตระกูลนี้ได้` : `มังกร${x.name}ที่ตระกูล${l.lastName}เคยทอดทิ้งกลับมา ดวงตาของมันยังจำทุกอย่างได้`; }, [
  C("ยื่นมือให้มันดม", (l) => { const x = oldWhelp(l)!; if (x.mood >= 0) { fl(l).dragonBond += 20; fl(l).dBonds = { ...fl(l).dBonds, [x.id]: 60 }; return { text: `${x.name}ก้มหัวให้คุณลูบ ตระกูลของคุณมีมังกรเป็นเพื่อนอีกครั้ง`, kind: "milestone" }; } addStat(l, "health", -12); return { text: `${x.name}พ่นลมร้อนใส่คุณแล้วบินจากไป มันยังไม่ให้อภัย`, kind: "bad" }; }),
  K("ขอโทษแทนบรรพบุรุษ", "looks", 55, G((l) => `${oldWhelp(l)!.name}นิ่งไปนาน แล้ววางหัวลงบนพื้นตรงหน้าคุณ`, { joy: 6 }, (l) => { oldWhelp(l)!.mood = 30; fl(l).dragonBond += 10; }), B("มังกรไม่ฟัง ยุ้งฉางของคุณลุกเป็นไฟทั้งหลัง", { gold: -15 })),
  P("ไล่มันไป", (l) => fightOdds(l, oldWhelp(l)!.power), N("มันบินหนีไปและจะไม่กลับมาอีก"), B("มังกรตอบด้วยไฟ", { hp: -18 })),
], { title: "มังกรของตระกูล", forced: true, maxTimes: 1, when: (l) => on(l) && !!oldWhelp(l) }), () => {});
const oldWhelp = (l: Life) => dataOf(l).dragons.find((x) => x.alive && x.id.startsWith("whelp") && x.title.includes(`ของ${l.lastName}`));

// ───────────── มังกรผู้ทรงอำนาจ สูญพันธุ์ และพันธะของเลือดมังกร ─────────────
export const slainDragons = (l: Life) => dataOf(l).dragons.filter((x) => !x.alive).length;
export const EXTINCT_FROM = 3;
const PACT = after(E("ft.cr.pact", [20, 900], (l) => { const d = friendlyDragon(l)!; return `${d.name}${d.title}บินลงหน้าประตูเมือง ${homeKingdom(l).name}จะอยู่ใต้ปีกของมัน ถ้าคุณเป็นคนกลางทำสัญญา`; }, [
  C("เป็นคนกลางทำสัญญา", (l) => { const d = friendlyDragon(l)!, k = homeKingdom(l); k.power = clamp(k.power + 10, 5, 95); k.stability = clamp(k.stability + 5, 5, 95); l.flags.ftPact = d.id; deed(l, `ผู้ทำสัญญากับมังกร${d.name}`); addStanding(l, 6); return { text: `${d.name}จะปกป้อง${k.name} ตราบที่ยังได้เครื่องบรรณาการทุกฤดูใบไม้ร่วง`, kind: "milestone" }; }),
  C("ปฏิเสธ แผ่นดินต้องยืนด้วยขาตัวเอง", N((l) => `${friendlyDragon(l)!.name}พยักหน้าแล้วบินกลับภูเขา`, {}, (l) => { const d = friendlyDragon(l); if (d) d.mood -= 10; })),
], { title: "สัญญากับมังกร", when: (l) => on(l) && !!friendlyDragon(l) && l.fame >= 20 && !l.flags.ftPact, weight: 8, maxTimes: 1 }), () => {});
const friendlyDragon = (l: Life) => aliveDragons(l).find((d) => d.mood >= 60 && !d.id.startsWith("whelp"));
const CLAN = after(E("ft.cr.clan", [16, 900], "เผ่ามังกรเรียกผู้มีเลือดมังกรทุกคนไปประชุมที่ยอดเขาสูงสุด การไม่ไปถือเป็นการตัดขาด", [
  C("ขึ้นไปร่วมประชุม", G("คุณนั่งในวงของมังกรทั้งคืน และกลับมาพร้อมคำพูดที่มนุษย์ไม่เคยได้ยิน", { joy: 4, magic: 6 }, (l) => { fl(l).dragonBond += 10; })),
  PAY("ส่งเครื่องบรรณาการแทนตัว", 30, N("เผ่ามังกรรับของแต่จดชื่อคุณไว้ว่าไม่มา")),
  C("ไม่ไป", (l) => { const foe = pick(l, aliveDragons(l).filter((d) => !d.id.startsWith("whelp"))); if (foe) fl(l).dragonFoe = foe.id; addStanding(l, 3); return { text: `${foe?.name ?? "มังกรตัวหนึ่ง"}ประกาศว่าคุณไม่ใช่พวกมันอีกต่อไป แต่คนในเมืองกลัวคุณน้อยลง`, kind: "bad" }; }),
], { title: "เสียงเรียกของเผ่ามังกร", when: (l) => on(l) && (fl(l).race === "dragon" || !!fl(l).dragonblood) && l.age - Number(l.flags.ftClanAt ?? -99) >= 8, weight: 20, maxTimes: 0 }), (l) => { l.flags.ftClanAt = l.age; });

// ───────────── สัตว์ขี่และสายเลือด ─────────────
export const STEEDS: Record<string, { name: string; price: number; life: number; fly?: boolean; edge: number; where?: string; tamer?: number; names: string[] }> = {
  horse: { name: "ม้าศึก", price: 15, life: 25, edge: 0.04, names: ["สายลม", "ฟ้าแลบ", "เถ้าถ่าน", "ดาวเหนือ"] },
  wolf: { name: "หมาป่ายักษ์", price: 30, life: 18, edge: 0.06, where: "forest", names: ["เขี้ยวเงิน", "เงาจันทร์", "หิมะ"] },
  griffon: { name: "กริฟฟิน", price: 80, life: 60, fly: true, edge: 0.07, where: "mountain", tamer: 2, names: ["ปีกทอง", "ผู้เฝ้ายอดผา", "สตอร์ม"] },
  serpent: { name: "งูทะเล", price: 70, life: 100, edge: 0.06, where: "port", tamer: 2, names: ["คลื่นดำ", "ลึก", "เกล็ดคราม"] },
};
const steed = (l: Life) => fl(l).steed;
export const flying = (l: Life) => (steed(l) && STEEDS[steed(l)!.kind].fly) || !!fl(l).mount;
const MARKET = SCENE("ft.cr.market", "ตลาดสัตว์ใหญ่", (l) => `ตลาดสัตว์ของ${cityOf(l).name} ม้าศึกยืนเรียงแถว${cityOf(l).kind === "mountain" ? " กริฟฟินถูกล่ามโซ่บนแท่นหิน" : cityOf(l).kind === "port" ? " งูทะเลว่ายวนในบ่อหลังท่าเรือ" : cityOf(l).kind === "forest" ? " หมาป่ายักษ์นอนอยู่ในกรงไม้" : ""}`, [
  ...Object.entries(STEEDS).map(([k, s]) => PAY(`${s.name}`, s.price, G(`${s.name}ตัวนั้นดมมือคุณ แล้วยอมให้สวมบังเหียน`, { joy: 4 }, (l) => { fl(l).steed = { kind: k, name: pick(l, s.names), bond: 50, born: l.age, line: l.lastName, gen: 1, lastCare: l.age }; }), { show: (l) => !steed(l) && (!s.where || cityOf(l).kind === s.where), req: (l) => (s.tamer && tamerLv(l) < s.tamer ? "ต้องเป็นนักฝึกสัตว์ขั้นสองขึ้นไป" : l.money < s.price * GOLD ? `ต้องมี ${s.price} เหรียญทอง` : undefined) })),
  C("ขายชิ้นส่วนสัตว์อสูรที่เก็บไว้", G((l) => `ร้านยาให้ราคาเขี้ยวและเกล็ดของคุณ ${partsValue(l)} เหรียญทอง`, {}, (l) => { addMoney(l, partsValue(l) * GOLD); l.flags.ftPartsSold = Object.values(fl(l).bestiary ?? {}).reduce((a, b) => a + b, 0); }), { show: (l) => partsValue(l) > 0 }),
  C("แวะซอยหลังตลาด", (l) => { runEvent(l, "ft.cr.black"); return { text: "ชายสวมผ้าคลุมพยักหน้าเรียกคุณเข้าไป" }; }, { show: (l) => !fl(l).egg && !fl(l).whelp }),
  C("ดูเฉยๆ", N("คุณเดินดูจนตลาดวาย")),
]);
const partsValue = (l: Life) => Math.max(0, Object.values(fl(l).bestiary ?? {}).reduce((a, b) => a + b, 0) - Number(l.flags.ftPartsSold ?? 0)) * 3;
export const EGG_PRICE = 150;
const BLACK = SCENE("ft.cr.black", "ตลาดมืด", `ในห้องใต้ดินที่มีกลิ่นกำมะถัน ไข่มังกรฟองหนึ่งวางอยู่บนฟาง ราคา ${EGG_PRICE} เหรียญทอง ไม่มีใครถามว่ามาจากไหน`, [
  PAY("ซื้อไข่มังกร", EGG_PRICE, (l) => { const d = pick(l, aliveDragons(l).filter((x) => !x.id.startsWith("whelp"))); fl(l).egg = { element: d?.element ?? "fire", warmth: 0, from: d?.id ?? "black", lastCare: l.age }; lean(l, { h: -3 }); if (d && chance(l, 0.5)) { fl(l).dragonFoe = d.id; return { text: `คุณห่อไข่กลับบ้าน คืนนั้นได้ยินเสียงปีกขนาดใหญ่บินวนเหนือเมือง ${d.name}รู้แล้ว`, kind: "bad" }; } return { text: "คุณห่อไข่กลับบ้าน มันอุ่นกว่าที่คิด", kind: "good" }; }),
  C("แจ้งยามเรื่องตลาดมืด", G("ยามบุกห้องใต้ดินตอนรุ่งสาง และส่งไข่คืนภูเขา", { fame: 2 }, (l) => { addStanding(l, 3); for (const d of aliveDragons(l)) d.mood += 3; })),
  C("เดินออกไป", N("คุณไม่อยากรู้ว่าไข่ฟองนั้นจะไปจบที่ไหน")),
]);
export const BREED_COST = 20;
const BREED = SCENE("ft.cr.breed", "สายเลือด", (l) => `${steed(l)!.name}${STEEDS[steed(l)!.kind].name}ของคุณเป็นรุ่นที่ ${steed(l)!.gen} ของสายเลือด${steed(l)!.line} ค่าผสมพันธุ์ ${BREED_COST} เหรียญทอง`, [
  PAY("ผสมพันธุ์แล้วขายลูก", BREED_COST, (l) => { const s = steed(l)!; s.gen++; const g = 15 * s.gen; addMoney(l, g * GOLD); if (s.gen === 3) { deed(l, `ผู้สร้างสายเลือด${s.line}`); addFame(l, 4); } return { text: `ลูกของ${s.name}ขายได้ ${g} เหรียญทอง${s.gen >= 3 ? ` คนรู้จักสายเลือด${s.line}ทั้งแผ่นดิน` : ""}`, kind: s.gen === 3 ? "milestone" : "good" }; }),
  C("ไว้ก่อน", N("คุณลูบคอมันแล้วปล่อยเข้าคอก")),
]);

// ───────────── สัตว์หายากของนักฝึก ─────────────
export const RARE: Record<string, { name: string; lv: number; perk: string }> = {
  basilisk: { name: "บาซิลิสก์", lv: 2, perk: "เฝ้าบ้านและช่วยสู้" },
  unicorn: { name: "ยูนิคอร์น", lv: 3, perk: "รักษาพิษ คำสาป และโรค" },
  phoenix: { name: "ฟีนิกซ์", lv: 4, perk: "สุขภาพฟื้นขึ้นทุกปี" },
};
const hasBeast = (l: Life, k: string) => !!fl(l).beasts?.some((b) => b.kind === k);
const RARE_EV = SCENE("ft.cr.rare", "ตามหาสัตว์หายาก", (l) => `ในฐานะนักฝึกสัตว์ คุณได้ยินข่าวสัตว์หายากในป่าลึก (ฝีมือนักฝึกของคุณขั้น ${tamerLv(l)})`, [
  ...Object.entries(RARE).map(([k, r]) => P(`ตามหา${r.name} · ${r.perk}`, (l) => clamp(0.35 + (tamerLv(l) - r.lv) * 0.12 + (l.stats.luck - 50) / 200, 0.05, 0.85), G(`${r.name}ยอมเดินตามคุณกลับมา มันเลือกคุณแล้ว`, { fame: 3 }, (l) => { fl(l).beasts = [...(fl(l).beasts ?? []), { kind: k, name: r.name, bond: 50 }]; deed(l, `ผู้ฝึก${r.name}`); }), B(`${r.name}หายไปในหมอก เหลือแต่รอยเท้าและแผลบนแขนคุณ`, { hp: -6 }), { show: (l) => tamerLv(l) >= r.lv && !hasBeast(l, k) })),
  C("ยังไม่ออกตามหา", N("คุณจดข่าวลือไว้ในสมุด")),
]);

// ───────────── ภูต ปีศาจ ผี และสัตว์ผู้รู้ ─────────────
const FOREST = E("ft.cr.forest", [10, 900], "ต้นโอ๊กเก่าที่สุดในป่ามีหน้าคนปรากฏบนเปลือก มันกระซิบว่าคนตัดไม้กำลังมา และมันต้องการของถวาย", [
  PAY("วางของถวายที่โคนต้น", 3, G("ใบไม้ทั้งป่าส่งเสียงขอบคุณ ปีนี้ทุกอย่างลงตัวพอดี", { luck: 3 }, (l) => lean(l, { f: 2 }))),
  C("ตัดต้นไม้ไปขาย", (l) => { addMoney(l, 20 * GOLD); afflict(l, "curse"); lean(l, { m: -3 }); return { text: "ไม้โอ๊กขายได้ 20 เหรียญทอง และคืนนั้นคุณฝันว่ามีรากไม้รัดคอ", kind: "bad" }; }),
  C("เดินผ่านไป", N("เสียงกระซิบเงียบลงเมื่อคุณพ้นแนวต้นไม้")),
], { title: "ภูตต้นไม้", when: (l) => on(l) && cityOf(l).kind === "forest", weight: 8, maxTimes: 1 });
const FEY = E("ft.cr.fey", [14, 900], "คนตัวเล็กใส่หมวกดอกเห็ดนั่งขวางทางกลางป่า \"ตอบปริศนาข้าได้ ข้าให้หนึ่งพร ตอบไม่ได้ ข้าเอาเงาของเจ้าไปหนึ่งปี\"", [
  K("ตอบปริศนา", "smarts", 55, (l) => { l.flags.ftFeyDebt = l.age + randInt(l, 3, 6); addMoney(l, 40 * GOLD); return { text: "คุณตอบถูก พรของมันคือทอง 40 เหรียญที่ร่วงลงมาจากกิ่งไม้ แต่มันหัวเราะแปลกๆ ก่อนหายไป", kind: "good" }; }, B("คุณตอบผิด ปีนั้นไม่มีเงาตามตัว และไม่มีใครกล้าเข้าใกล้คุณ", { joy: -8 }, (l) => addStanding(l, -3))),
  C("ปฏิเสธอย่างสุภาพ", N("มันยักไหล่ \"มนุษย์ที่ฉลาดคือมนุษย์ที่ไม่เล่นกับภูต\"")),
], { title: "ภูตเจ้าปริศนา", when: (l) => on(l) && ["forest", "arcane"].includes(cityOf(l).kind), weight: 6, maxTimes: 1 });
const FEY_TWIST = after(E("ft.cr.feytwist", [14, 900], "คนตัวเล็กใส่หมวกดอกเห็ดกลับมา \"พรมีราคาเสมอ ข้ามาเก็บแล้ว: ความทรงจำที่สุขที่สุดของเจ้า หรือทองคืนสองเท่า\"", [
  C("ยอมให้ความทรงจำ", N("คุณจำไม่ได้แล้วว่าวันที่มีความสุขที่สุดคือวันไหน ใจโหวงไปทั้งปี", { joy: -10 })),
  PAY("คืนทองสองเท่า", 80, N("มันนับเหรียญทีละเหรียญ แล้วหายไปพร้อมเสียงหัวเราะ")),
  K("หลอกภูตกลับ", "smarts", 70, G("มันโกรธจนหน้าแดงแล้วหายไป ไม่มีภูตตัวไหนมาเก็บหนี้จากคุณอีก", { fame: 2 }), (l) => { afflict(l, "curse"); return { text: "มันจับได้ และสาปคุณก่อนหายไป", kind: "bad" }; }),
], { title: "ราคาของพร", forced: true, maxTimes: 1, when: (l) => on(l) && l.flags.ftFeyDebt !== undefined && l.age >= Number(l.flags.ftFeyDebt) }), (l) => { delete l.flags.ftFeyDebt; });
const HOUSE = after(E("ft.cr.house", [10, 900], "ของในบ้านย้ายที่เองตอนกลางคืน และมีรอยเท้าเล็กๆ บนแป้งในครัว บ้านของคุณมีภูตประจำบ้านแล้ว", [
  C("วางนมกับขนมปังไว้ทุกคืน", G("เช้าวันต่อมาครัวสะอาดเอี่ยม และเหรียญที่หายไปนานกลับมาอยู่บนโต๊ะ", { joy: 3 }, (l) => { fl(l).houseSpirit = { fed: l.age }; })),
  C("ไล่มันออกไปด้วยเกลือ", N("รอยเท้าหายไป แต่ทุกอย่างในบ้านเริ่มพังง่ายขึ้น", { gold: -5 })),
], { title: "ภูตประจำบ้าน", when: (l) => on(l) && Number(l.flags.ftHome ?? 0) >= 1 && !fl(l).houseSpirit, weight: 6, maxTimes: 1 }), () => {});
const GHOST = E("ft.cr.ghost", [12, 900], "หญิงสาวในชุดเก่าเดินผ่านห้องโถงทุกคืนแล้วหายเข้าไปในกำแพง ผู้เฒ่าบอกว่าเธอรอใครบางคนมาร้อยปีแล้ว", [
  K("ตามหาเรื่องของเธอให้จบ", "smarts", 50, G("คุณพบจดหมายที่ไม่เคยถูกส่ง และอ่านให้เธอฟัง เธอยิ้มแล้วจางหายไปในแสงเช้า", { joy: 6 }, (l) => { addStanding(l, 2); lean(l, { m: 3 }); }), N("คุณค้นทั้งเมืองแต่ไม่พบอะไร เธอยังเดินผ่านห้องโถงทุกคืน")),
  PAY("จ้างนักบวชไล่วิญญาณ", 10, N("พิธีสามวันสามคืน แล้วห้องโถงก็เงียบ เงียบเกินไป")),
  C("อยู่กับเธอต่อไป", N("คุณเริ่มทักทายเธอทุกคืน และบ้านก็ไม่น่ากลัวอีกต่อไป", { joy: 2 })),
], { title: "ผีในบ้านเก่า", when: (l) => on(l), weight: 4, maxTimes: 1 });
const LICH = E("ft.cr.lich", [20, 900], (l) => `ลิชที่ตายมาแล้วสามร้อยปีตื่นขึ้นในหอคอยร้างนอก${cityOf(l).name} ศพในสุสานทั้งเมืองเริ่มขยับ`, [
  P("บุกหอคอยไปจัดการมัน", (l) => fightOdds(l, 62), BIG("กล่องวิญญาณของลิชแตกในมือคุณ ศพทั้งเมืองล้มลงพร้อมกัน", { fame: 12 }, (l) => { deed(l, "ผู้ทำลายลิชแห่งหอคอยร้าง"); addStanding(l, 8); }), (l, c) => (chance(l, 0.2) ? B("คุณกลายเป็นหนึ่งในกองทัพของมัน", { die: "ถูกลิชดึงวิญญาณ" })(l, c) : B("มนตร์ของลิชดูดพลังชีวิตคุณไปครึ่งหนึ่ง คุณหนีออกมาได้", { hp: -22 })(l, c))),
  C("เตือนทั้งเมืองให้อพยพ", G("ผู้คนออกจากเมืองทันก่อนกองทัพศพจะมาถึง และจำได้ว่าใครเตือน", { fame: 3 }, (l) => addStanding(l, 4))),
  C("หนีไปก่อน", N("คุณออกเดินทางกลางดึก และไม่หันกลับไปดูเมือง", { joy: -5 })),
], { title: "ลิชตื่น", when: (l) => on(l) && Math.max(fl(l).bodyRank, fl(l).magicRank) >= 3, weight: 3, maxTimes: 1 });
const SPHINX = E("ft.cr.sphinx", [16, 900], "สฟิงซ์นอนขวางช่องเขา \"อะไรที่เดินสี่ขาตอนเช้า\" มันหยุด แล้วหัวเราะ \"ล้อเล่น ปริศนาของข้ายากกว่านั้นมาก\"", [
  K("ตอบปริศนาของมัน", "smarts", 65, G("สฟิงซ์ก้มหัวให้ และบอกที่ซ่อนห้องสมบัติใต้ภูเขาให้คุณ", { gold: 50, iq: 2 }), N("คุณตอบผิด สฟิงซ์ไม่กินคุณ แต่ไม่ให้ผ่าน คุณต้องอ้อมไปอีกสามวัน")),
  C("ขอให้มันเล่าเรื่องแทน", G("มันเล่าเรื่องโลกก่อนยุคมังกรทั้งคืน", { iq: 3, magic: 4 })),
], { title: "สฟิงซ์", when: (l) => on(l) && cityOf(l).kind === "mountain", weight: 5, maxTimes: 1 });
const PET_GROW = after(E("ft.cr.familiar", [10, 900], (l) => `${fl(l).pet!.name}นกฮูกของคุณไม่ได้เป็นแค่สัตว์เลี้ยงอีกแล้ว ดวงตาของมันมีวงเวทเรืองแสง`, [
  C("ผูกพันธะเป็นผู้ช่วยเวท", BIG((l) => `${fl(l).pet!.name}กลายเป็นผู้ช่วยเวทของคุณ มันอ่านตำราได้เร็วกว่าคุณเสียอีก`, { magic: 10 }, (l) => { l.flags.ftFamiliarPet = true; })),
], { title: "นกฮูกที่เติบโต", forced: true, maxTimes: 1, when: (l) => on(l) && fl(l).pet?.kind === "owl" && fl(l).pet!.bond >= 70 && l.age - fl(l).pet!.born >= 5 && !l.flags.ftFamiliarPet }), () => {});

// ───────────── สัตว์ประจำถิ่น ─────────────
export const REGION: Record<string, string> = { mountain: "กริฟฟินบนยอดผา", port: "งูทะเลตามชายฝั่ง", forest: "ภูตและหมาป่ายักษ์ในป่าเก่า", frontier: "ฝูงหมาป่าตามแนวชายแดน", arcane: "สัตว์เวทที่หลุดจากหอคอย", capital: "ม้าศึกในคอกหลวง" };
export const HUNTED_EMPTY = 10;

// ───────────── กิจกรรม ─────────────
const M = (a: Omit<Activity, "world" | "emoji">): Activity => ({ ...a, emoji: "", world: "fantasy" });
const ACTS: Activity[] = [
  M({ group: "สัตว์", id: "ft_market", name: "ตลาดสัตว์ใหญ่", desc: "สัตว์ขี่ตามถิ่น ขายชิ้นส่วนสัตว์อสูร และซอยหลังตลาด", minAge: 14, time: 0, available: (l) => on(l) && !jailed(l), run: (l) => { runEvent(l, "ft.cr.market"); return { text: "" }; } }),
  M({ group: "สัตว์", id: "ft_steed", name: "ดูแลสัตว์ขี่", desc: "ความผูกพัน + · ปีละครั้ง", minAge: 10, time: 0, available: (l) => !!steed(l) && yearly("ftSteedAt")(l), run: (l) => { l.flags.ftSteedAt = l.age; const s = steed(l)!; s.bond = clamp(s.bond + 15, 0, 100); s.lastCare = l.age; addStat(l, "happiness", 2); return { text: `คุณขี่${s.name}ไปริมแม่น้ำทั้งบ่าย`, kind: "good" }; } }),
  M({ group: "สัตว์", id: "ft_breed", name: "ผสมพันธุ์สัตว์ขี่", desc: "ขายลูกได้เงิน สายเลือดดังขึ้นทุกรุ่น · ปีละครั้ง", minAge: 16, time: 0, available: (l) => !!steed(l) && steed(l)!.bond >= 60 && l.age - steed(l)!.born >= 3 && yearly("ftBreedAt")(l), run: (l) => { l.flags.ftBreedAt = l.age; runEvent(l, "ft.cr.breed"); return { text: "" }; } }),
  M({ group: "สัตว์", id: "ft_rare", name: "ตามหาสัตว์หายาก", desc: "สำหรับนักฝึกสัตว์ · ยิ่งฝีมือสูงยิ่งเจอสัตว์หายาก", minAge: 16, time: 2, available: (l) => tamerLv(l) >= 2 && yearly("ftRareAt")(l), run: (l) => { l.flags.ftRareAt = l.age; runEvent(l, "ft.cr.rare"); return { text: "" }; } }),
];

// ───────────── ทุกปี ─────────────
function creatureYear(l: Life) {
  if (!on(l) || !l.alive) return;
  const f = fl(l), k = homeKingdom(l);
  // มังกรของคุณ: นิสัย ช่วงวัย และลูกๆ ที่โตมากับมัน
  const w = f.whelp;
  if (w) {
    w.trait ??= pick(l, TRAITS);
    const st = DRAGON_STAGES.find(([a]) => a === w.age);
    if (st && w.age > 0) log(l, `${w.name}โตเป็น${st[1]}แล้ว ${w.age >= 21 ? "ปีกของมันบังแดดได้ทั้งลานบ้าน" : "เสียงคำรามของมันเริ่มทำให้กระจกสั่น"}`, "milestone");
    for (const p of l.people) if (p.alive && p.relation === "child" && p.age >= 6 && !p.tags?.includes("dragonfriend") && chance(l, 0.25)) { p.tags = [...(p.tags ?? []), "dragonfriend"]; log(l, `${shortName(p)}กับ${w.name}กลายเป็นเพื่อนสนิท มันยอมให้เด็กคนนี้ขี่หลังคนเดียว`, "good"); }
  }
  if (l.flags.ftWhelpCame) { log(l, `${l.flags.ftWhelpCame}มังกรที่โตมาด้วยกันยังอยู่กับคุณ มันจำบ้านหลังนี้ได้`, "milestone"); delete l.flags.ftWhelpCame; }
  // มังกรสูญพันธุ์ทีละตัว
  const slain = slainDragons(l);
  if (slain >= EXTINCT_FROM && Number(l.flags.ftExtinctNews ?? 0) < slain) { l.flags.ftExtinctNews = slain; log(l, `มังกรตายไปแล้ว ${slain} ตัวในโลกนี้ มนตราในอากาศเบาบางลง และสัญญาเก่าแก่ระหว่างมังกรกับมนุษย์เริ่มขาด`, "milestone"); }
  if (l.flags.ftPact && !aliveDragons(l).some((d) => d.id === l.flags.ftPact)) { log(l, `มังกรที่ทำสัญญาปกป้อง${k.name}ตายไปแล้ว สัญญาสิ้นสุดลง`, "bad"); delete l.flags.ftPact; }
  // สัตว์ขี่: ถูกละเลยแล้วดื้อ หนี หรือทำร้าย · แก่แล้วจากไป
  const s = f.steed;
  if (s) {
    if (l.age - s.lastCare >= 2) s.bond = clamp(s.bond - 8, 0, 100);
    if (l.age - s.born >= STEEDS[s.kind].life) { log(l, `${s.name}${STEEDS[s.kind].name}ของคุณจากไปอย่างสงบในคอก หลังอยู่ด้วยกัน ${l.age - s.born} ปี`, "bad"); addStat(l, "happiness", -8); f.steed = undefined; }
    else if (s.bond < 15) { if (chance(l, 0.5)) { log(l, `${s.name}พังคอกแล้ววิ่งหายไปตอนกลางคืน มันไม่ได้รับการดูแลนานเกินไป`, "bad"); f.steed = undefined; } else { addStat(l, "health", -6); log(l, `${s.name}ไม่ยอมให้ขี่ และดีดคุณจนล้มกลางคอก`, "bad"); } }
  }
  // สัตว์หายาก
  if (hasBeast(l, "phoenix")) addStat(l, "health", 2);
  if (hasBeast(l, "unicorn") && f.ailment) { log(l, `ยูนิคอร์นแตะเขาลงบนหน้าผากคุณ ${f.ailment.kind === "curse" ? "คำสาป" : "พิษและไข้"}หายไปทันที`, "good"); f.ailment = undefined; }
  // ภูตประจำบ้าน
  if (f.houseSpirit && chance(l, 0.4)) addMoney(l, 2 * GOLD);
  if (l.flags.ftFamiliarPet && f.pet?.kind === "owl") f.magic += 4;
  // ล่าจนหมด: สัตว์ค่อยๆ กลับมา
  if ((k.hunted ?? 0) > 0) k.hunted = Math.max(0, (k.hunted ?? 0) - 1);
}

export const CREATURE_EVENTS: GameEvent[] = [WISH_EV, OLD_WHELP, PACT, CLAN, MARKET, BLACK, BREED, RARE_EV, FOREST, FEY, FEY_TWIST, HOUSE, GHOST, LICH, SPHINX, PET_GROW];

/** เรียกหลังลงทะเบียน event ทั้งหมดแล้ว */
export function loadCreatures() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push(creatureYear);
  activityFilters.push((l, a) => (a.id !== "ft_steed" && a.id !== "ft_breed") || !!steed(l));
  activityFilters.push((l, a) => a.id !== "ft_rare" || tamerLv(l) >= 2);
  // สัตว์ช่วยในจังหวะกลางของศึก: สัตว์ขี่ สัตว์หายาก · แพ้แล้วมันอาจบาดเจ็บหรือตาย
  allyHooks.push((l) => { const s = steed(l); if (s && s.bond >= 40) return s.name; const b = fl(l).beasts?.find((x) => x.kind === "basilisk"); return b?.name; });
  allyLossHooks.push((l, c) => {
    const s = steed(l);
    if (!s || c.allyUsed !== s.name) return "";
    if (chance(l, 0.08)) { fl(l).steed = undefined; addStat(l, "happiness", -10); return ` ${s.name}รับดาบแทนคุณ และไม่ได้ลุกขึ้นมาอีก`; }
    if (chance(l, 0.3)) { s.bond = clamp(s.bond - 10, 0, 100); return ` ${s.name}บาดเจ็บและกลัวสนามรบไปพักหนึ่ง`; }
    return "";
  });
  // สัตว์ขี่ช่วยในศึก และเดินทางปลอดภัยขึ้น
  combatHooks.push((l) => {
    if (!on(l)) return [];
    const out: [string, number][] = [];
    const s = steed(l);
    if (s && s.bond >= 40) out.push([`${STEEDS[s.kind].name}คู่ใจ`, Math.round(STEEDS[s.kind].edge * 50)]);
    // มังกรตายมากเกินไป มนตราในโลกจางลง ผู้ใช้เวทอ่อนลงตาม
    const slain = slainDragons(l);
    if (slain >= EXTINCT_FROM && fl(l).magicRank > 0) out.push(["มนตราที่จางลงเพราะมังกรสูญพันธุ์", -Math.min(10, (slain - EXTINCT_FROM + 1) * 2)]);
    return out;
  });
  const how = getEvent("ft.so.journey")?.scenes?.how;
  if (how) how.choices.push(C((l) => `บินไปบนหลัง${steed(l) && STEEDS[steed(l)!.kind].fly ? steed(l)!.name : "มังกรของคุณ"}`, (l, c) => {
    const k = dataOf(l).kingdoms.find((x) => x.id === c.to)!;
    moveTo(l, k);
    const seen = chance(l, 0.25);
    if (seen) addStanding(l, -2);
    return { text: `คุณข้ามภูเขาและทะเลในสามวัน ถึง${k.name}${seen ? " คนทั้งเมืองเห็นคุณบินลงมา และไม่ใช่ทุกคนที่ดีใจ" : " ก่อนใครจะทันเห็น"}`, kind: "good" };
  }, { show: (l) => !!flying(l) }));
  // ล่าสัตว์อสูรเพิ่มแรงกดดันต่อถิ่น · ล่าจนหมดแล้วงานล่าได้เงินน้อยลง และสัตว์ไม่บุกเมืองอีก
  for (const ch of getEvent("ft.contract")?.choices ?? []) if (ch.odds) {
    const run = ch.run;
    ch.run = (l, c, ok) => {
      const m0 = l.money;
      const out = run(l, c, ok);
      if (ok && on(l)) { const k = homeKingdom(l); k.hunted = (k.hunted ?? 0) + 2; if ((k.hunted ?? 0) >= HUNTED_EMPTY) { const cut = Math.round((l.money - m0) * 0.4); addMoney(l, -cut); return { ...out, text: `${out.text} · สัตว์อสูรในแถบนี้เหลือน้อยลงมาก ค่าหัวจึงลดลง` }; } }
      return out;
    };
  }
  eligibilityFilters.push((l, e) => e.id !== "ft.dg.raid" || (homeKingdom(l).hunted ?? 0) < HUNTED_EMPTY);
}

/** สรุปสำหรับแท็บโลก */
export function creatureLines(l: Life): string[] {
  const f = fl(l), out: string[] = [];
  const k = homeKingdom(l);
  out.push(`สัตว์ประจำถิ่น: ${REGION[cityOf(l).kind] ?? "สัตว์ป่าทั่วไป"}${(k.hunted ?? 0) >= HUNTED_EMPTY ? " · ถูกล่าจนเกือบหมดแล้ว" : (k.hunted ?? 0) >= HUNTED_EMPTY / 2 ? " · เริ่มถูกล่ามากเกินไป" : ""}`);
  if (f.whelp) out.push(`${f.whelp.name} · ${stageOf(f.whelp.age)} อายุ ${f.whelp.age} ปี · นิสัย${f.whelp.trait ?? "ยังไม่รู้"} · ผูกพัน ${f.whelp.bond}`);
  if (f.steed) out.push(`สัตว์ขี่: ${f.steed.name} (${STEEDS[f.steed.kind].name}) · ผูกพัน ${f.steed.bond} · สายเลือด${f.steed.line} รุ่นที่ ${f.steed.gen}${STEEDS[f.steed.kind].fly ? " · บินได้" : ""}`);
  if (f.beasts?.length) out.push(`สัตว์หายาก: ${f.beasts.map((b) => `${b.name} (${RARE[b.kind].perk})`).join(" · ")}`);
  if (f.houseSpirit) out.push("มีภูตประจำบ้านคอยดูแล");
  const slain = slainDragons(l);
  if (slain) out.push(`มังกรที่ตายไปแล้วในโลกนี้ ${slain} ตัว${slain >= EXTINCT_FROM ? " · มนตราเริ่มจางลง" : ""}`);
  if (l.flags.ftPact) out.push("แผ่นดินของคุณมีสัญญากับมังกร");
  return out;
}
