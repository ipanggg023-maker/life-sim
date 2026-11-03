// สิ่งที่ทำได้นอกงาน (แท็บทำ): สัตว์เลี้ยงและสัตว์รับใช้ ดันเจี้ยนหลายชั้น วิหารของเทพ ปรุงยาเอง และลูกเต๋ามังกร
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Ctx, GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, addStat, clamp, log } from "../../engine/util";
import { B, BIG, C, G, GOLD, K, N, P, PAY, SCENE, type Res } from "./kit";
import { ELEMENTS, spellChoices } from "./magic";
import { deathOdds, fightOdds } from "./power";
import { deed, fl, type Element } from "./state";
import { techChoice, weaponNoun } from "./styles";

// ── สัตว์เลี้ยง ──
export type PetKind = "cat" | "owl" | "wolf" | "fox" | "slime" | "golem";
export const PETS: Record<PetKind, { name: string; life: number; price: number; perk: string; names: string[] }> = {
  cat: { name: "แมวดำ", life: 18, price: 3, perk: "โชคดีขึ้นทุกปี", names: ["หมอก", "ถ่าน", "เงา", "พริกไทย", "ลูน่า", "บิสกิต"] },
  owl: { name: "นกฮูกเวท", life: 25, price: 20, perk: "พลังเวทเพิ่มทุกปี", names: ["เซจ", "อาร์คัส", "ฮูดินี่", "เปปเปอร์มินต์", "นิมบัส"] },
  wolf: { name: "หมาป่า", life: 15, price: 12, perk: "ช่วยสู้ (+3)", names: ["เขี้ยว", "หิมะ", "ฟ้าร้อง", "สกาย", "แอช"] },
  fox: { name: "จิ้งจอกไฟ", life: 30, price: 35, perk: "ความสุขเพิ่มทุกปี", names: ["อีกนิส", "ซินเดอร์", "ส้มจี๊ด", "คิตสึ", "เฟลม"] },
  slime: { name: "สไลม์ใส", life: 40, price: 6, perk: "สุขภาพดีขึ้นทุกปี", names: ["หยด", "เจลลี่", "บลูบ", "ปุ๊ก", "โมจิ"] },
  golem: { name: "โกเลมจิ๋ว", life: 200, price: 80, perk: "ช่วยทำงาน ได้เงินทุกปี", names: ["หินกรวด", "บูลเดอร์", "ก้อนเล็ก", "อิฐ", "แกรนิต"] },
};
const PET_IDS = Object.keys(PETS) as PetKind[];
export const petOf = (l: Life) => fl(l).pet;
const givePet = (l: Life, kind: PetKind) => { fl(l).pet = { kind, name: pick(l, PETS[kind].names), bond: 60, born: l.age }; };

// ── ดันเจี้ยน ──
interface Dungeon { id: string; name: string; desc: string; threat: number; floors: number; loot: number; weak: Element; boss: string }
export const DUNGEONS: Dungeon[] = [
  { id: "warren", name: "รังก็อบลินใต้เนิน", desc: "อุโมงค์แคบเต็มไปด้วยกับดักไม้และเสียงหัวเราะแหลม", threat: 12, floors: 3, loot: 6, weak: "fire", boss: "ราชาก็อบลินอ้วน" },
  { id: "crypt", name: "สุสานจมน้ำ", desc: "สุสานของราชวงศ์เก่าที่น้ำทะเลท่วมถึงครึ่งชั้น", threat: 28, floors: 4, loot: 12, weak: "light", boss: "ราชินีศพในชุดเจ้าสาว" },
  { id: "caverns", name: "ถ้ำผลึกร้องเพลง", desc: "ผลึกทุกก้อนร้องเพลงเมื่อมีคนเดินผ่าน และบางเพลงก็ทำให้คนหลับไม่ตื่น", threat: 42, floors: 4, loot: 20, weak: "earth", boss: "งูผลึกเก้าหัว" },
  { id: "bone", name: "หุบกระดูกมังกร", desc: "สุสานของมังกรโบราณ กระดูกซี่โครงสูงเท่าหอคอย", threat: 60, floors: 5, loot: 32, weak: "water", boss: "อัศวินกระดูกมังกร" },
  { id: "spire", name: "หอคอยเหว", desc: "หอคอยที่ยื่นลงไปในดินแทนที่จะชี้ขึ้นฟ้า ชั้นล่างสุดไม่มีใครรู้ว่ามีอะไร", threat: 80, floors: 5, loot: 50, weak: "light", boss: "สิ่งที่รออยู่ใต้หอคอย" },
];
const D = (c: Ctx) => DUNGEONS.find((x) => x.id === c.dg)!;
const floorOf = (l: Life, id: string) => fl(l).dungeons?.[id] ?? 0;
const threatAt = (l: Life, d: Dungeon) => d.threat + floorOf(l, d.id) * 4;
const isBoss = (l: Life, d: Dungeon) => floorOf(l, d.id) === d.floors - 1;

function clearFloor(l: Life, d: Dungeon, mul = 1) {
  const f = fl(l);
  f.dungeons = { ...f.dungeons, [d.id]: floorOf(l, d.id) + 1 };
  addMoney(l, Math.round(d.loot * mul * (1 + floorOf(l, d.id) * 0.25)) * GOLD);
  f.body += 5; f.magic += 3;
  if (floorOf(l, d.id) >= d.floors) {
    deed(l, `พิชิต${d.name}`);
    const q = Math.min(5, 1 + Math.floor(d.threat / 20));
    if ((f.weapon?.quality ?? 0) < q) f.weapon = { name: `${weaponNoun(l)}จาก${d.name}`, quality: q, enchant: f.weapon?.enchant };
  }
}
const floorWin = (mul: number): Res => (l, c) => {
  const d = D(c), boss = isBoss(l, d);
  clearFloor(l, d, mul);
  return boss
    ? BIG(`${d.boss}ล้มลง ${d.name}ถูกพิชิตแล้ว คุณออกมาพร้อม${weaponNoun(l)}ที่เก็บได้จากห้องสมบัติ`, { fame: 10, joy: 10 })(l, c)
    : G(`ชั้นที่ ${floorOf(l, d.id)} ผ่านไป คุณเก็บสมบัติแล้วจุดคบไฟปักไว้เป็นทางกลับ`, { joy: 3 })(l, c);
};
const floorLose = (text: string, extra = 0): Res => (l, c) => {
  const d = D(c);
  if (chance(l, deathOdds(l, threatAt(l, d) + extra) * 0.6)) return B("คบไฟของคุณดับลงในความมืดชั้นล่าง", { die: `ตายใน${d.name}` })(l, c);
  return B(text, { hp: -randInt(l, 8, 14) })(l, c);
};

// ── วิหาร ──
export const GODS: { id: string; name: string; domain: string; boon: string; fx: (l: Life) => string }[] = [
  { id: "solia", name: "ซอเลีย", domain: "อรุณและการเยียวยา", boon: "สุขภาพ", fx: (l) => { addStat(l, "health", 6); return "แสงอุ่นไหลผ่านอกคุณ แผลเก่าเจ็บน้อยลง"; } },
  { id: "garroth", name: "การ์โรธ", domain: "สงครามและความกล้า", boon: "พลังกาย", fx: (l) => { fl(l).body += 10; return "เสียงกลองศึกดังในหัวคุณทั้งคืน แขนคุณหนักแน่นขึ้น"; } },
  { id: "myra", name: "มีร่า", domain: "โชคและการเดินทาง", boon: "โชค", fx: (l) => { addStat(l, "luck", 3); return "เหรียญที่คุณโยนลงบ่อน้ำศักดิ์สิทธิ์ลอยขึ้นมาเองหนึ่งเหรียญ"; } },
  { id: "alven", name: "อัลเวน", domain: "ปัญญาและเวทมนตร์", boon: "สติปัญญาและพลังเวท", fx: (l) => { addStat(l, "smarts", 2); fl(l).magic += 6; return "คุณฝันเห็นหอสมุดที่ไม่มีเพดาน และตื่นมาจำบางหน้าได้"; } },
  { id: "verda", name: "เวอร์ดา", domain: "ความอุดมและครอบครัว", boon: "ความสุขของคนในบ้าน", fx: (l) => { addStat(l, "happiness", 5); for (const p of l.people) if (p.alive && ["spouse", "child", "father", "mother"].includes(p.relation)) p.bond = clamp(p.bond + 3, 0, 100); return "บ้านคุณหอมกลิ่นขนมปังทั้งปี และทุกคนกลับบ้านเร็วขึ้น"; } },
];

const M = (a: Omit<Activity, "world" | "emoji">): Activity => ({ ...a, emoji: "", world: "fantasy" });
const yearly = (k: string) => (l: Life) => Number(l.flags[k] ?? -1) !== l.age;

const ACTS: Activity[] = [
  M({ group: "งานอดิเรก", id: "ft_h_pet", name: "หาสัตว์เลี้ยง", desc: "ตลาดสัตว์ · สัตว์แต่ละแบบช่วยต่างกัน", minAge: 6, available: (l) => !petOf(l), run: (l) => { runEvent(l, "ft.h.pet_shop"); return { text: "" }; } }),
  M({ group: "งานอดิเรก", id: "ft_h_petplay", name: "เล่นกับสัตว์เลี้ยง", desc: "ความผูกพันกับสัตว์เลี้ยง + ความสุข", minAge: 3, time: 0, available: (l) => !!petOf(l) && yearly("ftPetPlay")(l), run: (l) => { l.flags.ftPetPlay = l.age; const p = petOf(l)!; p.bond = clamp(p.bond + 15, 0, 100); addStat(l, "happiness", 3); return { text: `${p.name}${pick(l, ["นอนหงายให้คุณเกาท้อง", "วิ่งวนรอบตัวคุณจนเวียนหัว", "เอาของที่ขโมยมาจากเพื่อนบ้านมาให้", "หลับอยู่บนตักคุณทั้งบ่าย"])}`, kind: "good" }; } }),
  M({ group: "ผจญภัย", id: "ft_h_dungeon", name: "บุกดันเจี้ยน", desc: "ห้าแห่ง หลายชั้น · ชั้นสุดท้ายมีบอส", minAge: 14, time: 2, available: (l) => DUNGEONS.some((d) => floorOf(l, d.id) < d.floors), run: (l) => { runEvent(l, "ft.h.dungeon"); return { text: "" }; } }),
  M({ group: "ชีวิต", id: "ft_h_temple", name: "ไปวิหาร", desc: "ขอพรจากเทพห้าองค์ · ปีละครั้ง", minAge: 6, available: yearly("ftTemple"), run: (l) => { l.flags.ftTemple = l.age; runEvent(l, "ft.h.temple"); return { text: "" }; } }),
  M({ group: "งานอดิเรก", id: "ft_h_brew", name: "ปรุงยาเอง", desc: "ต้องมีสติปัญญา · วัตถุดิบ 3 เหรียญทอง", minAge: 12, cost: 3 * GOLD, available: (l) => l.stats.smarts >= 40 || l.job?.careerId === "ft_alchemist", run: (l) => { runEvent(l, "ft.h.brew"); return { text: "" }; } }),
  M({ group: "งานอดิเรก", id: "ft_h_dice", name: "เล่นลูกเต๋ามังกร", desc: "ในโรงเตี๊ยม · ได้หรือเสียเงิน", minAge: 16, available: (l) => l.money >= 5 * GOLD, run: (l) => { runEvent(l, "ft.h.dice"); return { text: "" }; } }),
];

const diceOdds = (l: Life) => clamp(0.42 + (l.stats.luck - 50) / 250 + (fl(l).pet?.kind === "cat" ? 0.04 : 0), 0.1, 0.8);
const bet = (g: number) => P(`วางเดิมพัน ${g} เหรียญทอง`, diceOdds, G(`ลูกเต๋าทั้งสามออกหัวมังกร โต๊ะทั้งโต๊ะโห่ร้อง คุณได้ ${g} เหรียญทอง`, { gold: g, joy: 3 }), B(`ลูกเต๋ากลิ้งไปหยุดที่หางมังกร คุณเสีย ${g} เหรียญทอง`, { gold: -g, joy: -2 }), { req: (l) => (l.money < g * GOLD ? `ต้องมี ${g} เหรียญทอง` : undefined) });

export const HOBBY_EVENTS: GameEvent[] = [
  SCENE("ft.h.pet_shop", "ตลาดสัตว์", "กรงไม้เรียงยาวเต็มตลาด บางกรงมีเสียงร้อง บางกรงมีควันลอยออกมา", [
    ...PET_IDS.map((k) => PAY(`${PETS[k].name} · ${PETS[k].perk}`, PETS[k].price, G(`${PETS[k].name}ตัวนั้นมองคุณแล้วเดินออกจากกรงเอง`, { joy: 6 }, (l) => givePet(l, k)))),
    C("ดูเฉยๆ", N("คุณเดินออกจากตลาดพร้อมรอยข่วนหนึ่งรอย")),
  ]),
  SCENE("ft.h.dungeon", "เลือกดันเจี้ยน", "แผนที่ของกิลด์ระบุดันเจี้ยนห้าแห่ง ยิ่งลึกยิ่งอันตราย และยิ่งร่ำรวย", [
    ...DUNGEONS.map((d) => C(
      (l) => `${d.name} · ชั้น ${floorOf(l, d.id) + 1}/${d.floors}${floorOf(l, d.id) === d.floors - 1 ? ` · บอส: ${d.boss}` : ""} · บุกตรงผ่าน ${Math.round(fightOdds(l, threatAt(l, d) + (isBoss(l, d) ? 8 : 0)) * 100)}%`,
      (l) => { runEvent(l, "ft.h.floor", { dg: d.id }); return { text: `คุณจุดคบไฟแล้วก้าวลงบันไดของ${d.name} ${d.desc}` }; },
      { show: (l) => floorOf(l, d.id) < d.floors },
    )),
    C("ยังไม่ลงไปปีนี้", N("คุณพับแผนที่เก็บใส่อกเสื้อ")),
  ]),
  SCENE("ft.h.floor", "ในดันเจี้ยน", (l, c) => { const d = D(c); return isBoss(l, d) ? `ห้องสุดท้ายของ${d.name} ${d.boss}ลืมตาขึ้นในความมืด (จุดอ่อนธาตุ${ELEMENTS[d.weak].name})` : `ชั้นที่ ${floorOf(l, d.id) + 1} ของ${d.name} เงาบางอย่างขยับอยู่ข้างหน้า${l.stats.smarts >= 50 ? ` (จุดอ่อนธาตุ${ELEMENTS[d.weak].name})` : ""}`; }, [
    P("บุกตรงเข้าไป", (l, c) => fightOdds(l, threatAt(l, D(c)) + (isBoss(l, D(c)) ? 8 : 0)), floorWin(1), floorLose("มันแข็งแกร่งกว่าที่คิด คุณถอยกลับขึ้นบันไดพร้อมแผล")),
    techChoice((l, c) => threatAt(l, D(c)) + (isBoss(l, D(c)) ? 8 : 0), () => floorWin(1.2), floorLose("ท่าไม้ตายพลาดเป้า มันสวนกลับทันที")),
    ...spellChoices((l, c) => threatAt(l, D(c)) + (isBoss(l, D(c)) ? 8 : 0), (_l, c) => D(c).weak, () => undefined, () => floorWin(1.1), floorLose("เวทของคุณสะท้อนกลับจากผนัง")),
    K("ย่องผ่านไปเงียบๆ", "luck", 55, floorWin(0.6), floorLose("เท้าคุณเหยียบกับดักพอดี", 6), { show: (l, c) => !isBoss(l, D(c)) }),
    C("ถอยกลับ", N("คุณกลับขึ้นไปก่อน ดันเจี้ยนไม่หนีไปไหน")),
  ]),
  SCENE("ft.h.temple", "วิหาร", "วิหารหินขาวมีแท่นบูชาห้าแท่น เทียนบนแต่ละแท่นไหวต่างกัน", [
    ...GODS.map((g) => PAY(`${g.name} · เทพแห่ง${g.domain} · ${g.boon}`, 5, (l) => ({ text: g.fx(l), kind: "good" as const }))),
    C("สวดเงียบๆ โดยไม่ถวายอะไร", G("ไม่มีปาฏิหาริย์ แต่ใจคุณสงบลง", { joy: 3 })),
  ]),
  SCENE("ft.h.brew", "ปรุงยา", "หม้อเล็กเดือดอยู่บนเตา คุณจะปรุงอะไร", [
    K("ยาฟื้นพลัง", "smarts", 40, G("ยาสีแดงอุ่นๆ ทำให้คุณรู้สึกเหมือนอายุน้อยลงห้าปี", { hp: 10 }), N("ยาขมเกินจะกลืน คุณเททิ้ง")),
    K("ยาเพิ่มพละกำลัง", "smarts", 50, G("กล้ามเนื้อคุณร้อนวูบทั้งคืน แล้วแข็งแรงขึ้น", { body: 10 }), B("ยาออกฤทธิ์ผิด คุณปวดท้องสามวัน", { hp: -4 })),
    K("ยาเสน่ห์ (สำหรับตัวเอง)", "smarts", 50, G("ผิวคุณเปล่งปลั่ง คนหันมามองทั้งตลาด", { look: 3 }), N("ผมคุณกลายเป็นสีเขียวไปหนึ่งเดือน", { look: -2 })),
    K("ยานำโชค", "smarts", 60, G("กลิ่นของมันเหมือนฝนแรกของฤดู ปีนี้ทุกอย่างลงตัวพอดี", { luck: 3 }), N("ไม่มีอะไรเกิดขึ้น นอกจากกลิ่นแปลกๆ ในครัว")),
  ]),
  SCENE("ft.h.dice", "ลูกเต๋ามังกร", "โต๊ะไม้ในมุมโรงเตี๊ยม ลูกเต๋าสามลูกสลักหัวมังกรหนึ่งด้าน หางมังกรอีกด้าน", [bet(5), bet(20), bet(60), C("ดูคนอื่นเล่น", N("คุณเห็นคนแพ้หมดตัวในตาเดียว แล้วรู้สึกโชคดีที่แค่ดู"))]),
];

export function loadHobbies() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push((l) => {
    if (l.worldId !== "fantasy" || !l.ft || !l.alive) return;
    const f = fl(l);
    // สัตว์ที่ได้มาจากเรื่องราว
    if (!f.pet && l.flags.wolfPup) { delete l.flags.wolfPup; givePet(l, "wolf"); log(l, `ลูกหมาป่าที่คุณเลี้ยงไว้โตแล้ว คุณตั้งชื่อมันว่า${f.pet!.name}`, "good"); }
    if (!f.pet && l.flags.ftFamiliar) { delete l.flags.ftFamiliar; givePet(l, "owl"); log(l, `นกฮูกเงินที่ผูกพันธะกับคุณได้ชื่อว่า${f.pet!.name}`, "good"); }
    const p = f.pet;
    if (!p) return;
    const info = PETS[p.kind];
    if (l.age - p.born >= info.life) { log(l, `${p.name}${info.name}ของคุณจากไปอย่างสงบหลังอยู่ด้วยกัน ${l.age - p.born} ปี`, "bad"); addStat(l, "happiness", -8); f.pet = undefined; return; }
    p.bond = clamp(p.bond - 6, 0, 100);
    if (p.bond <= 5 && chance(l, 0.5)) { log(l, `${p.name}หนีออกจากบ้านไปตอนกลางคืน คุณไม่ได้ดูแลมันนานเกินไป`, "bad"); f.pet = undefined; return; }
    if (p.bond < 30) return;
    if (p.kind === "cat" && chance(l, 0.5)) addStat(l, "luck", 1);
    if (p.kind === "owl") f.magic += 4;
    if (p.kind === "fox") addStat(l, "happiness", 2);
    if (p.kind === "slime") addStat(l, "health", 2);
    if (p.kind === "golem") addMoney(l, 3 * GOLD);
  });
}
