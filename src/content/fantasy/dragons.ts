// สังคมมังกร: หลายตัว หลายธาตุ มีอารมณ์ อาณาเขต และไข่ · ผู้เล่นล่า ผูกมิตร เรียนรู้ ขโมยไข่ เลี้ยง และขี่ได้
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Choice, Ctx, GameEvent } from "../../engine/events";
import { runEvent } from "../../engine/game";
import { chance, pick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { clamp, displayName, log } from "../../engine/util";
import { recordChronicle, type WorldState } from "../../engine/worldState";
import { B, BIG, C, E, G, K, N, P, SCENE, type Res } from "./kit";
import { ELEMENTS, learnSpell, SPELLS } from "./magic";
import { canCast, fightOdds } from "./power";
import { addStanding, dataOf, deed, fl, homeKingdom, worldOfLife, type Dragon, type FData } from "./state";

const MAX_SHOWN = 5;
export const aliveDragons = (l: Life) => dataOf(l).dragons.filter((x) => x.alive);
export const dragonById = (l: Life, id: unknown) => dataOf(l).dragons.find((x) => x.id === id);
/** มังกรที่อยู่ในฉาก · ไม่ระบุ = ตัวที่เก่าแก่ที่สุดที่ยังอยู่ */
const D = (l: Life, c: Ctx): Dragon => dragonById(l, c.dg) ?? aliveDragons(l)[0] ?? dataOf(l).dragons[0];
/** ความผูกพัน = ความชอบมังกรโดยกำเนิด + ความผูกพันกับตัวนี้ + ญาติของมังกรที่ครอบครัวเคยเลี้ยง */
export const bondOf = (l: Life, d: Dragon) => fl(l).dragonBond + (fl(l).dBonds?.[d.id] ?? 0) + (d.kin && d.kin === l.lastName ? 40 : 0) + (fl(l).race === "dragon" ? 40 : 0);
export function addBond(l: Life, d: Dragon, n: number) {
  const f = fl(l);
  const gain = n > 0 && f.relic === "dragonhorn" ? n * 2 : n;
  f.dBonds = { ...f.dBonds, [d.id]: clamp((f.dBonds?.[d.id] ?? 0) + gain, -100, 100) };
}
export const moodWord = (m: number) => (m >= 30 ? "เป็นมิตรกับมนุษย์" : m >= 0 ? "เฉยเมย" : m >= -30 ? "หงุดหงิด" : "โกรธแค้น");
const eggsOf = (l: Life, d: Dragon) => dataOf(l).eggs.filter((e) => e.mother === d.id);
const slayOdds = (l: Life, d: Dragon) => fightOdds(l, d.power) + (fl(l).relic === "wyrmsbane" ? 0.25 : 0);
const SLAY_DEATH = 0.6, STEAL_DEATH = 0.3;
const stealOdds = (l: Life, d: Dragon) => 0.25 + (l.stats.luck - 50) / 150 + fightOdds(l, d.power) / 4;
const rideOdds = (l: Life, d: Dragon) => (bondOf(l, d) - 30) / 60 + (l.stats.luck - 50) / 200 + (fl(l).relic === "dragonhorn" ? 0.2 : 0);
export const mountOf = (l: Life) => { const m = fl(l).mount; return m === "whelp" ? fl(l).whelp?.name : m ? dragonById(l, m)?.name : undefined; };

function slay(l: Life, d: Dragon) {
  d.alive = false; d.slainBy = displayName(l);
  deed(l, `สังหารมังกร${d.name}`);
  recordChronicle(worldOfLife(l), `${displayName(l)}สังหารมังกร${d.name}${d.title}`);
  // มังกรตัวอื่นจำเรื่องนี้ได้
  for (const o of aliveDragons(l)) { o.mood = clamp(o.mood - 10, -100, 100); addBond(l, o, -20); }
  if (fl(l).mount === d.id) fl(l).mount = undefined;
  runEvent(l, "ft.d.blood", { dg: d.id });
}

function takeEgg(l: Life, d: Dragon) {
  const w = dataOf(l), e = eggsOf(l, d)[0];
  w.eggs = w.eggs.filter((x) => x !== e);
  fl(l).egg = { element: d.element, warmth: 0, from: d.id, lastCare: l.age };
}

const pickDragon = (i: number): Choice => C(
  (l) => { const d = aliveDragons(l)[i]; return d ? `${d.name}${d.title} · ธาตุ${ELEMENTS[d.element].name} · ${moodWord(d.mood)}` : "—"; },
  (l) => { runEvent(l, "ft.dragon_meet", { dg: aliveDragons(l)[i].id }); return { text: "คุณออกเดินทางไปยังรังของมัน" }; },
  { show: (l) => !!aliveDragons(l)[i] },
);

const ACTS: Activity[] = [
  { id: "ft_dragon", emoji: "", name: "ไปหามังกร", desc: "อันตรายมาก · เลือกได้ว่าจะไปหาตัวไหน", minAge: 18, time: 2, world: "fantasy", group: "มังกร", available: (l) => aliveDragons(l).length > 0, run: (l) => { runEvent(l, "ft.d.choose"); return { text: "" }; } },
  { id: "ft_egg", emoji: "", name: "ฟักไข่มังกร", desc: "ต้องดูแลทุกปี ไม่อย่างนั้นไข่จะเย็นตาย", minAge: 10, world: "fantasy", group: "มังกร", available: (l) => !!fl(l).egg, run: (l) => { runEvent(l, "ft.d.egg"); return { text: "" }; } },
  { id: "ft_whelp", emoji: "", name: "เลี้ยงลูกมังกร", desc: "ทิ้งไว้นานมันจะบินหนีไป", minAge: 10, world: "fantasy", group: "มังกร", available: (l) => !!fl(l).whelp, run: (l) => { runEvent(l, "ft.d.whelp"); return { text: "" }; } },
  { id: "ft_fly", emoji: "", name: "บินสำรวจบนหลังมังกร", desc: "หาซากเมือง ลาดตระเวน หรือไปเยี่ยมมังกรตัวอื่น", minAge: 14, world: "fantasy", group: "มังกร", available: (l) => !!mountOf(l), run: (l) => { runEvent(l, "ft.d.fly"); return { text: "" }; } },
];

const WHELP_NAMES = ["ไซรัส", "อิกนิส", "เทอร์รา", "เวเนธ", "โนคทิส", "ออรัม", "คาลิกซ์", "เซฟิรา", "พีรอส", "ไอลา"];
const careEgg = (n: number, text: string): Res => G(text, {}, (l) => {
  const e = fl(l).egg!;
  e.warmth = Math.min(4, e.warmth + n); e.lastCare = l.age;
  // ลูกมังกรตัวเดิมยังอยู่ ไข่จึงรอไว้ก่อน ไม่ทับตัวเก่า
  if (e.warmth < 4 || fl(l).whelp) return;
  fl(l).egg = undefined;
  fl(l).whelp = { name: pick(l, WHELP_NAMES), element: e.element, age: 0, bond: 50, power: 10, lastCare: l.age, from: e.from };
  deed(l, "ฟักไข่มังกรด้วยมือตัวเอง");
  log(l, `เปลือกไข่แตก ลูกมังกรธาตุ${ELEMENTS[e.element].name}ชื่อ${fl(l).whelp!.name}มองคุณเป็นคนแรก`, "milestone");
});
const careWhelp = (bond: number, power: number): Res => (l) => { const w = fl(l).whelp!; w.bond = clamp(w.bond + bond, 0, 100); w.power = Math.min(80, w.power + power); w.lastCare = l.age; return { text: "" }; };
const withScenes = (e: GameEvent, scenes: GameEvent["scenes"]): GameEvent => ({ ...e, scenes });
const then = (a: Res, b: Res): Res => (l, c) => { a(l, c); return b(l, c); };

/** สู้หรือขโมยจากมังกรตอนโอกาสรอดต่ำ: ถามย้ำก่อนหนึ่งจังหวะ (ผู้เล่นใจร้อนตายกับมังกรมากเกินไป) */
const WARN_BELOW = 0.7;
const SLAY: Choice = P("ท้าสู้เพื่อสังหารมังกร", (l, c) => slayOdds(l, D(l, c)), (l, c) => { const d = D(l, c); const out = BIG(`คุณยืนอยู่บนซากมังกร${d.name} ทั่วแผ่นดินจะเล่าเรื่องนี้ไปอีกพันปี`, { fame: 40, joy: 15, body: 20, gold: d.power * 3 })(l, c); slay(l, d); return out; }, (l, c) => (chance(l, SLAY_DEATH) ? B("ไฟมังกรเผาโลกของคุณจนขาว", { die: "ถูกเผาโดยมังกร" })(l, c) : B("คุณคลานหนีลงเขามาได้ ครึ่งตัวยังมีรอยไหม้", { hp: -35, joy: -8 })(l, c)), { tone: "danger", survival: (l, c) => 1 - (1 - slayOdds(l, D(l, c))) * SLAY_DEATH });
const STEAL: Choice = P("ลักไข่ตอนมันหลับ", (l, c) => stealOdds(l, D(l, c)), G("คุณวิ่งลงเขาพร้อมไข่ที่ยังอุ่น เสียงคำรามดังตามหลังมา", { joy: 4 }, (l, c) => { const d = D(l, c); takeEgg(l, d); d.mood = clamp(d.mood - 40, -100, 100); addBond(l, d, -60); fl(l).dragonFoe = d.id; }), (l, c) => (chance(l, STEAL_DEATH) ? B("มันตื่นก่อนที่คุณจะถึงปากถ้ำ", { die: "ถูกมังกรขย้ำขณะขโมยไข่" })(l, c) : B("กรงเล็บเฉียดหลังคุณไปครึ่งนิ้ว", { hp: -25 }, (x) => addBond(x, D(x, c), -30))(l, c)), { tone: "danger", survival: (l, c) => 1 - (1 - stealOdds(l, D(l, c))) * STEAL_DEATH, show: (l, c) => eggsOf(l, D(l, c)).length > 0 && !fl(l).egg && !fl(l).whelp });
const survivalOf = (c: Choice) => (l: Life, x: Ctx) => c.survival?.(l, x) ?? 1;
function guarded(id: string, c: Choice): Choice[] {
  const sv = survivalOf(c);
  return [
    { ...c, show: (l, x) => (c.show ? c.show(l, x) : true) && sv(l, x) >= WARN_BELOW },
    { ...c, show: (l, x) => (c.show ? c.show(l, x) : true) && sv(l, x) < WARN_BELOW, odds: undefined, run: () => ({ text: "คุณก้าวเข้าไปใกล้ ไอร้อนจากลำคอของมันแผดเผาผิวหน้า และคุณรู้ทันทีว่าตัวเองยังไม่พร้อม", next: `sure_${id}` }) },
  ];
}
const sure = (c: Choice, what: string) => ({
  title: "ไฟในลำคอของมัน",
  text: (l: Life, x: Ctx) => `มังกร${D(l, x).name}ได้กลิ่นคุณแล้ว ไฟในลำคอของมันเริ่มสว่าง ถ้า${what}ตอนนี้ โอกาสรอดของคุณแค่ราว ${Math.round(survivalOf(c)(l, x) * 100)}% คนที่รอดมาเล่าบอกว่าควรกลับไปฝึกก่อน`,
  choices: [{ ...c, show: undefined }, C("ถอยออกมาก่อน แล้วค่อยกลับมาเมื่อพร้อม", N("คุณถอยลงเขาทีละก้าว ดวงตาสีทองมองตามจนลับสายตา"))],
});

export const DRAGON_EVENTS: GameEvent[] = [
  SCENE("ft.d.choose", "รังมังกร", "มังกรแต่ละตัวมีอาณาเขตและอารมณ์ของตัวเอง คุณจะไปหาตัวไหน", [...Array.from({ length: MAX_SHOWN }, (_, i) => pickDragon(i)), C("เปลี่ยนใจ", N("คุณมองยอดเขาจากไกลๆ ก็พอแล้ว"))]),
  withScenes(SCENE("ft.dragon_meet", "รังมังกร", (l, c) => { const d = D(l, c); return `มังกร${d.name}${d.title} อายุ ${d.age} ปี ลืมตาข้างหนึ่งมองคุณ${eggsOf(l, d).length ? " ข้างหลังมันมีไข่วางอยู่" : ""}`; }, [
    ...guarded("slay", SLAY),
    K("สนทนาอย่างผู้มีปัญญา", "smarts", 60, G("มังกรหัวเราะจนหินร่วง \"มนุษย์ที่พูดรู้เรื่อง หายากกว่าทองเสียอีก\"", { iq: 2, magic: 8 }, (l, c) => { const d = D(l, c); addBond(l, d, 25); d.mood = clamp(d.mood + 5, -100, 100); }), B("มันไม่สนใจ แล้วหางของมันก็ปัดคุณลงจากลาน", { hp: -15 })),
    C("ถวายของกำนัลแล้วขอพร", G("มังกรรับทองคำไว้โดยไม่พูดอะไร แต่ปล่อยให้คุณเดินกลับไปได้", { gold: -20 }, (l, c) => addBond(l, D(l, c), 10)), { req: (l) => (l.money < 2000 ? "ต้องมี 20 เหรียญทอง" : undefined) }),
    C("ขอเรียนภาษามังกร", BIG((l, c) => `${D(l, c).name}สอนคำหนึ่งคำ ซึ่งคุณใช้เวลาทั้งปีกว่าจะออกเสียงได้`, { magic: 15, iq: 2 }, (l, c) => { const d = D(l, c), f = fl(l); f.dLearned = [...(f.dLearned ?? []), d.id]; const s = SPELLS.find((x) => x.element === d.element && x.tier === 3); if (s && !f.spells?.includes(s.id)) learnSpell(l, s.id); deed(l, `ศิษย์ของมังกร${d.name}`); }), { show: (l, c) => canCast(l) && bondOf(l, D(l, c)) >= 50 && !fl(l).dLearned?.includes(D(l, c).id) }),
    C("ขอไข่ไปเลี้ยง", BIG((l, c) => `${D(l, c).name}ผลักไข่ฟองหนึ่งมาหาคุณด้วยจมูก "ทำให้ดีกว่าที่พวกเจ้าทำกับเรา"`, { joy: 12 }, (l, c) => takeEgg(l, D(l, c))), { show: (l, c) => bondOf(l, D(l, c)) >= 80 && eggsOf(l, D(l, c)).length > 0 && !fl(l).egg && !fl(l).whelp }),
    ...guarded("steal", STEAL),
    P("ขอเป็นเพื่อนร่วมทาง", (l, c) => rideOdds(l, D(l, c)), BIG((l, c) => `${D(l, c).name}ลดคอลงให้คุณปีนขึ้นหลัง เมฆทั้งหมดอยู่ใต้เท้าคุณ`, { fame: 25, joy: 20 }, (l, c) => { const d = D(l, c); l.flags.dragonRider = true; fl(l).mount = d.id; deed(l, `เป็นสหายของมังกร${d.name}`); recordChronicle(worldOfLife(l), `${displayName(l)}ขี่มังกร${d.name}เหนือท้องฟ้า`); }), N("มันพ่นควันใส่หน้าคุณเบาๆ \"ยังไม่ถึงเวลา\""), { show: (l, c) => bondOf(l, D(l, c)) >= 30 && !fl(l).mount }),
    C("หนีลงเขา", N("คุณไม่เคยวิ่งเร็วเท่านี้มาก่อน", { hp: -2 })),
  ]), { sure_slay: sure(SLAY, "สู้"), sure_steal: sure(STEAL, "ขโมยไข่") }),
  SCENE("ft.d.blood", "เลือดมังกร", (l, c) => `เลือดของ${D(l, c).name}ยังร้อนจนไอระเหย คนเฒ่าเล่าว่าใครอาบเลือดนี้จะไม่มีวันเหมือนเดิม`, [
    K("อาบเลือดมังกร", "health", 55, BIG("ผิวคุณแข็งขึ้นเหมือนเกล็ด และหัวใจเต้นช้าลงอย่างประหลาด", { body: 25, hp: 10 }, (l) => { fl(l).dragonblood = true; deed(l, "อาบเลือดมังกร"); }), B("เลือดร้อนเกินร่างมนุษย์ คุณนอนซมเป็นเดือน", { hp: -25 })),
    C("ขายซากให้พ่อค้า", G("เกล็ด เขา และกระดูก ขายได้ราคาเกินฝัน", { gold: 150 })),
    C("ฝังอย่างให้เกียรติ", G("มังกรตัวอื่นได้ยินเรื่องนี้ และโกรธคุณน้อยลง", { fame: 4 }, (l) => { for (const o of aliveDragons(l)) addBond(l, o, 15); })),
  ]),
  E("ft.dragon_raid", [10, 400], (l, c) => `เงาปีกมหึมาผ่านเมือง มังกร${D(l, c).name}บินลงมาเผายุ้งฉางของ${homeKingdom(l).name}`, [
    P("ขึ้นกำแพงต่อสู้", (l, c) => fightOdds(l, D(l, c).power - 35), G("คุณทำให้มันถอยไปจากกำแพง เมืองจารึกชื่อคุณ", { fame: 15, body: 8 }, (l) => { deed(l, "ปกป้องเมืองจากมังกร"); addStanding(l, 10); }), B("เปลวไฟเลียแขนคุณจนไหม้", { hp: -20 })),
    C("พาคนหนีลงใต้ดิน", G("คุณพาเด็กๆ ลงห้องเก็บไวน์ ทุกคนรอด", { fame: 5, joy: 3 }, (l) => addStanding(l, 4))),
    C("คว้าของมีค่าแล้วหนี", N("คุณรอด ของรอด แต่ไม่มีใครลืมว่าคุณทิ้งเพื่อนบ้าน", { gold: 15, fame: -5 }, (l) => addStanding(l, -6))),
  ], { when: (l) => raider(l) !== undefined, weight: 5, maxTimes: 4, title: "มังกรมาเยือน", prepare: (l) => ({ dg: raider(l)!.id }) }),
  E("ft.d.vengeance", [10, 400], (l, c) => `${D(l, c).name}ตามกลิ่นไข่ของมันมาถึงบ้านคุณ หลังคาทั้งหลังปลิวไปกับลมปีก`, [
    P("สู้เพื่อรักษาไข่ไว้", (l, c) => fightOdds(l, D(l, c).power - 20), G("มันบินจากไปพร้อมแผล และไม่กลับมาอีก", { fame: 8 }, (l) => { fl(l).dragonFoe = undefined; }), B("คุณรอดมาได้ แต่บ้านไม่เหลืออะไร", { hp: -25, gold: -30 })),
    C("คืนไข่ให้แม่ของมัน", N("มันคาบไข่ไปอย่างทะนุถนอม แล้วมองคุณนานกว่าที่ควร", { joy: -6 }, (l, c) => { const f = fl(l), d = D(l, c); if (f.egg) dataOf(l).eggs.push({ mother: d.id, element: d.element, laid: worldOfLife(l).year }); f.egg = undefined; f.dragonFoe = undefined; addBond(l, d, 30); }), { show: (l) => !!fl(l).egg }),
  ], { when: (l) => !!fl(l).dragonFoe && !!dragonById(l, fl(l).dragonFoe)?.alive && (!!fl(l).egg || !!fl(l).whelp), weight: 20, maxTimes: 0, title: "แม่มังกร", prepare: (l) => ({ dg: fl(l).dragonFoe ?? "" }) }),

  SCENE("ft.d.egg", "ไข่มังกร", (l) => { const e = fl(l).egg!; return `ไข่ธาตุ${ELEMENTS[e.element].name}อุ่นขึ้นทีละน้อย (${e.warmth}/4) บางคืนคุณได้ยินเสียงเคาะจากข้างใน${fl(l).whelp ? ` แต่มันจะยังไม่ฟักจนกว่า${fl(l).whelp!.name}จะโตและจากไป` : ""}`; }, [
    C("อุ่นไว้ข้างเตาไฟทั้งปี", careEgg(1, "คุณเติมฟืนทุกคืนจนแขนเปื้อนเขม่า")),
    C("ร่ายเวทธาตุเดียวกันโอบไว้", careEgg(2, "เปลือกไข่เรืองแสงตอบรับเวทของคุณ"), { show: (l) => canCast(l) && !!fl(l).spells?.some((s) => s.startsWith(fl(l).egg!.element)) }),
    K("พาไปอาบลาวาที่ภูเขาไฟ", "luck", 45, careEgg(2, "ไข่เปลี่ยนสีเป็นแดงเข้มและเต้นเหมือนหัวใจ"), B("ภูเขาไฟปะทุ คุณวิ่งลงมาพร้อมไข่และรอยไหม้", { hp: -12 }, (l) => { fl(l).egg!.lastCare = l.age; })),
  ]),
  SCENE("ft.d.whelp", "ลูกมังกร", (l) => { const w = fl(l).whelp!; return `${w.name} ลูกมังกรธาตุ${ELEMENTS[w.element].name} อายุ ${w.age} ปี ความผูกพัน ${w.bond} พลัง ${w.power}`; }, [
    C("หาเนื้อให้กินจนอิ่ม (5 เหรียญทอง)", then(careWhelp(8, 2), G("มันหลับบนตักคุณทั้งที่ตัวหนักเท่าลูกวัวแล้ว", { gold: -5, joy: 3 })), { req: (l) => (l.money < 500 ? "ต้องมี 5 เหรียญทอง" : undefined) }),
    K("ฝึกพ่นไฟและล่าเหยื่อ", "health", 45, then(careWhelp(4, 5), G("มันจับกวางตัวแรกได้เอง แล้วลากมาให้คุณดู", { body: 3 })), then(careWhelp(2, 1), B("ไฟของมันพลาดเป้ามาโดนคุณ", { hp: -8 }))),
    P("ลองขี่ขึ้นฟ้า", (l) => (fl(l).whelp!.bond - 40) / 50, BIG((l) => `${fl(l).whelp!.name}กางปีกพาคุณขึ้นเหนือเมฆเป็นครั้งแรก`, { fame: 15, joy: 15 }, (l) => { fl(l).mount = "whelp"; l.flags.dragonRider = true; deed(l, `ขี่มังกร${fl(l).whelp!.name}ที่เลี้ยงมาเอง`); careWhelp(5, 0)(l, {}); }), B("มันยังเด็กเกินไป คุณร่วงลงกองฟาง", { hp: -10 }, (l) => careWhelp(0, 0)(l, {})), { show: (l) => fl(l).whelp!.age >= 6 && fl(l).mount !== "whelp" }),
  ]),
  SCENE("ft.d.fly", "บนหลังมังกร", (l) => `${mountOf(l)}พาคุณบินเหนือ${homeKingdom(l).name} แผ่นดินทั้งหมดเล็กเท่าแผนที่`, [
    C("ตามหาซากเมืองโบราณ", G("จากบนฟ้าคุณเห็นแนวกำแพงที่คนบนพื้นมองไม่เห็นมาพันปี", { iq: 1 }, (l) => { const f = fl(l); const r = dataOf(l).relics.find((x) => x.holder !== "player"); if (r) f.clues[r.id] = (f.clues[r.id] ?? 0) + 1; })),
    C("ลาดตระเวนชายแดน", G("กองโจรแตกกระเจิงเมื่อเห็นเงาปีก", { fame: 3 }, (l) => addStanding(l, 4))),
    C("ไปเยี่ยมมังกรตัวอื่น", G("มังกรอีกตัวยอมให้คุณลงจอดบนลานของมัน", { magic: 3 }, (l) => { const o = aliveDragons(l).filter((x) => x.id !== fl(l).mount); if (o.length) addBond(l, pick(l, o), 12); })),
  ]),
];

const raider = (l: Life) => aliveDragons(l).find((d) => d.home === fl(l).kingdom && d.mood < 10);

/** ทุกปีของผู้เล่น: ไข่เย็นถ้าไม่ดูแล ลูกมังกรโตและหนีถ้าถูกทิ้ง มังกรที่ขี่อยู่อาจตายไปแล้ว */
export function dragonYear(l: Life) {
  const f = fl(l);
  if (l.flags.dragonRider && !f.mount && f.dragonBond >= 0 && !f.whelp) f.mount = aliveDragons(l)[0]?.id;
  if (f.mount && f.mount !== "whelp" && !dragonById(l, f.mount)?.alive) { log(l, `มังกรที่คุณเคยขี่จากโลกนี้ไปแล้ว`); f.mount = undefined; }
  if (f.egg && l.age - f.egg.lastCare >= 3) { f.egg = undefined; log(l, "ไข่มังกรเย็นเฉียบ ไม่มีเสียงเคาะจากข้างในอีกแล้ว", "bad"); }
  const w = f.whelp;
  if (!w) return;
  w.age++;
  w.power = Math.min(80, w.power + 2);
  if (l.age - w.lastCare >= 2) w.bond = Math.max(0, w.bond - 8);
  if (w.bond <= 0) {
    release(worldOfLife(l), l, w, "บินหนีไปเพราะถูกทอดทิ้ง");
    f.whelp = undefined; if (f.mount === "whelp") f.mount = undefined;
    log(l, `${w.name}บินหนีไปเพราะถูกทอดทิ้ง`, "bad");
  }
}

/** ลูกมังกรของผู้เล่นกลายเป็นมังกรของโลก และจำนามสกุลของครอบครัวที่เลี้ยงมันได้ */
export function release(w: WorldState, l: Life, x: NonNullable<ReturnType<typeof fl>["whelp"]>, why: string) {
  const d = w.data as unknown as FData;
  d.dragons.push({ id: `whelp${w.year}${x.name}`, name: x.name, title: `ผู้จากบ้านของ${l.lastName}`, element: x.element, home: fl(l).kingdom, age: x.age, mood: x.bond >= 50 ? 40 : -10, alive: true, power: Math.max(40, x.power), kin: x.bond >= 50 ? l.lastName : undefined });
  recordChronicle(w, `มังกร${x.name}ที่${displayName(l)}เลี้ยงมา${why}`);
}

export const loadDragons = () => { ACTIVITIES.push(...ACTS); };
