// ปริศนาที่ข้ามชีวิต: ความคืบหน้าอยู่ในโลก ไม่ใช่ในตัวละคร · คนรุ่นหลังเจอบันทึกของคนก่อนแล้วสืบต่อได้
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Choice, Ctx, GameEvent } from "../../engine/events";
import { runEvent } from "../../engine/game";
import type { Life } from "../../engine/types";
import { checkChance, clamp, displayName } from "../../engine/util";
import { addLegend, recordChronicle } from "../../engine/worldState";
import { B, BIG, C, E, G, N, SCENE } from "./kit";
import { canCast, fightOdds } from "./power";
import { dataOf, deed, fl, homeKingdom, worldOfLife, type Mystery, type RaceId } from "./state";
import { addStars } from "./stars";

interface Way { label: string; odds: (l: Life) => number; show?: (l: Life) => boolean; ok: string; fail: string; hurt?: number }
interface Step { text: string; ways: Way[] }
interface Def { id: string; name: string; hook: string; steps: Step[]; solved: string; reward: (l: Life) => void }

const stat = (s: "smarts" | "luck" | "looks" | "health", dc: number) => (l: Life) => checkChance(l, s, dc);
const raceBonus = (r: RaceId[], base: (l: Life) => number, bonus = 0.3) => (l: Life) => base(l) + (r.includes(fl(l).race) ? bonus : 0);
const holds = (id: string) => (l: Life) => fl(l).relic === id;

export const MYSTERIES: Def[] = [
  {
    id: "sunken", name: "นครที่จมหาย",
    hook: "ชาวประมงลากอวนขึ้นมาได้รูปปั้นทองคำที่สลักอักษรซึ่งไม่มีใครอ่านออก",
    steps: [
      { text: "ต้องหาแผนที่ที่บอกว่านครออเรเลียนอยู่ใต้ทะเลส่วนไหน", ways: [
        { label: "ค้นหอจดหมายเหตุของท่าเรือ", odds: stat("smarts", 50), ok: "แผนที่เก่ามีเกาะที่ไม่อยู่ในแผนที่ใหม่", fail: "เอกสารถูกปลวกกินไปครึ่งหนึ่ง" },
        { label: "ซื้อเหล้าให้ชาวประมงเฒ่า", odds: stat("looks", 45), ok: "เขาชี้ไปที่จุดที่ปลาไม่ยอมว่ายผ่าน", fail: "เขาเมาจนจำอะไรไม่ได้" },
      ] },
      { text: "นครอยู่ลึกใต้น้ำ ต้องหาทางลงไปให้ถึง", ways: [
        { label: "ร่ายเวทน้ำสร้างโพรงอากาศ", odds: () => 0.8, show: (l) => !!fl(l).spells?.some((s) => s.startsWith("water")), ok: "น้ำแยกออกเป็นอุโมงค์ให้คุณเดินลงไป", fail: "" },
        { label: "ดำน้ำลงไปเอง", odds: stat("health", 60), ok: "ปอดแทบระเบิด แต่คุณแตะประตูนครได้", fail: "คุณสำลักน้ำกลับขึ้นมา", hurt: 10 },
        { label: "ขอให้เนริธพาลงไป", odds: () => 0.9, show: (l) => (fl(l).dBonds?.nerith ?? 0) >= 40, ok: "ราชินีใต้สมุทรพาคุณลงไปบนหลังของนาง", fail: "" },
      ] },
      { text: "ประตูนครสลักอักษรโบราณ ต้องอ่านให้ออก", ways: [
        { label: "ถอดอักษรด้วยตัวเอง", odds: raceBonus(["elf"], stat("smarts", 65)), ok: "อักษรเป็นภาษาบรรพบุรุษของเอลฟ์ที่ถูกลืม", fail: "คุณอ่านได้แค่คำว่า \"ห้าม\"" },
        { label: "ลอกลายไปให้ปราชญ์", odds: stat("looks", 50), ok: "ปราชญ์หลวงร้องไห้เมื่อเห็นลายนั้น", fail: "ปราชญ์ขโมยงานของคุณไปตีพิมพ์" },
      ] },
      { text: "ประตูไม่มีลูกบิด มีแต่ร่องสำหรับอักษรรูน", ways: [
        { label: "สลักรูนเปิดผนึก", odds: (l) => 0.3 + (fl(l).rune ?? 0) * 0.2 + (fl(l).race === "dwarf" ? 0.3 : 0), ok: "รูนเรืองแสงทีละตัว แล้วประตูก็เลื่อนออก", fail: "รูนดับลงก่อนวงจะครบ" },
        { label: "ใช้ดาบผ่ามิติรัตติกาลฟันผนึก", odds: () => 0.95, show: holds("veilcutter"), ok: "ผนึกขาดเหมือนผ้าไหม", fail: "" },
      ] },
      { text: "ผู้พิทักษ์ทองคำของนครลืมตาขึ้นเป็นครั้งแรกในรอบสองพันปี", ways: [
        { label: "สู้กับผู้พิทักษ์", odds: (l) => fightOdds(l, 65), ok: "ผู้พิทักษ์ล้มลงและแตกเป็นผงทอง", fail: "หมัดทองคำส่งคุณลอยกลับขึ้นผิวน้ำ", hurt: 20 },
        { label: "พูดภาษาของมัน", odds: (l) => 0.2 + (fl(l).race === "elf" ? 0.5 : 0) + (l.stats.smarts - 50) / 150, ok: "มันโค้งคำนับ และหลีกทางให้ทายาทของผู้สร้าง", fail: "มันไม่เข้าใจสำเนียงของคุณ", hurt: 8 },
      ] },
    ],
    solved: "ค้นพบนครออเรเลียนใต้ทะเล",
    reward: (l) => { const f = fl(l); addStars(l, "magic", 2); f.magic += 40; const k = dataOf(l).kingdoms.find((x) => x.id === "thalos"); if (k) k.prosperity = clamp((k.prosperity ?? 100) + 20, 40, 140); },
  },
  {
    id: "undying", name: "ราชาที่ไม่เคยตาย",
    hook: "ภาพวาดผู้ครองแผ่นดินห้ารุ่นในหอพระราชวังมีไฝที่ตำแหน่งเดียวกันทุกภาพ",
    steps: [
      { text: "ต้องรู้ว่าภาพเหมือนกันเพราะบังเอิญหรือไม่", ways: [
        { label: "เทียบภาพทุกภาพในหอ", odds: stat("smarts", 50), ok: "แม้แต่รอยแผลที่นิ้วก้อยก็ตรงกันทุกรุ่น", fail: "ยามไล่คุณออกก่อนดูครบ" },
        { label: "ถามจิตรกรหลวงที่แก่ที่สุด", odds: stat("looks", 50), ok: "เขากระซิบว่าวาดคนคนเดียวมาสี่สิบปีแล้ว", fail: "เขาแกล้งหูหนวก" },
      ] },
      { text: "ต้องหาคนที่เคยเห็นราชาตอนไม่มีใครอยู่", ways: [
        { label: "ซื้อข้อมูลจากคนรับใช้", odds: stat("looks", 55), ok: "คนรับใช้เล่าว่าราชาไม่เคยกินอาหารเลย", fail: "เขารับเงินแล้วไปฟ้องหัวหน้าองครักษ์" },
        { label: "ใช้คนของราชสำนักรัตติกาล", odds: () => 0.85, show: (l) => fl(l).faction === "night", ok: "จดหมายลับมาถึงพร้อมรายชื่อคนที่หายไปในวัง", fail: "" },
      ] },
      { text: "ต้องเข้าห้องสมุดลับใต้วังให้ได้", ways: [
        { label: "ย่องเข้าไปตอนเปลี่ยนเวร", odds: raceBonus(["halfling"], stat("luck", 55), 0.25), ok: "ห้องนั้นเต็มไปด้วยตำราเวทความตาย", fail: "สุนัขเฝ้าวังส่งเสียงเห่า", hurt: 8 },
        { label: "ใช้กุญแจที่ \"ยืม\" มา", odds: () => 0.9, show: (l) => !!l.flags.ftKeys, ok: "กุญแจพวงนั้นมีดอกที่ไขห้องนี้ได้พอดี", fail: "" },
      ] },
      { text: "ราชาซ่อนวิญญาณไว้ในภาชนะ ต้องหาให้เจอ", ways: [
        { label: "ตามกลิ่นความตายในวัง", odds: raceBonus(["beastfolk"], stat("luck", 60)), ok: "กลิ่นพาคุณไปถึงกล่องดนตรีในห้องพระราชินี", fail: "กลิ่นธูปในวังกลบทุกอย่าง" },
        { label: "ร่ายเวทแสงตามรอยมนตร์ดำ", odds: () => 0.8, show: (l) => !!fl(l).spells?.some((s) => s.startsWith("light")), ok: "แสงของคุณดำลงเมื่อเข้าใกล้กล่องดนตรี", fail: "" },
      ] },
      { text: "ต้องเลือกจะทำอะไรกับภาชนะวิญญาณ", ways: [
        { label: "ทุบทิ้งต่อหน้าราชา", odds: (l) => fightOdds(l, 75), ok: "ราชากลายเป็นเถ้ากลางท้องพระโรง", fail: "เขาจับข้อมือคุณด้วยมือที่เย็นเหมือนหิน", hurt: 25 },
        { label: "ร่ายเวทแสงสลายมนตร์", odds: (l) => (canCast(l) ? 0.3 + fl(l).magicRank * 0.12 : 0), show: canCast, ok: "มนตร์สลายไปพร้อมเสียงกรีดร้องที่ดังทั่ววัง", fail: "มนตร์ของคุณไม่ระคายผิวของมัน", hurt: 15 },
      ] },
    ],
    solved: "โค่นราชาผู้ไม่เคยตาย",
    reward: (l) => { l.stats.happiness = clamp(l.stats.happiness + 10, 0, 100); const k = homeKingdom(l); k.stability = clamp(k.stability - 25, 5, 95); fl(l).body += 30; },
  },
  {
    id: "bell", name: "ระฆังใต้ภูเขา",
    hook: "ทุกคืนเดือนมืด คนงานเหมืองได้ยินเสียงระฆังดังมาจากใต้ดินลึกกว่าที่ใครเคยขุดถึง",
    steps: [
      { text: "ต้องรู้ว่าเสียงระฆังดังมาจากทางไหน", ways: [
        { label: "แนบหูฟังผนังเหมือง", odds: raceBonus(["beastfolk", "dwarf"], stat("luck", 55)), ok: "เสียงดังจากใต้ทะเลสาบใต้ดิน", fail: "เสียงสะท้อนจนจับทิศไม่ได้" },
        { label: "ค้นบันทึกของสมาคมคนงานเหมือง", odds: stat("smarts", 50), ok: "ร้อยปีก่อนมีคนลงไปแล้วไม่กลับมาสิบคน", fail: "บันทึกถูกเผาไปในกบฏครั้งก่อน" },
      ] },
      { text: "ต้องหาทางเข้าที่ถูกถล่มปิดไว้", ways: [
        { label: "ขุดเอง", odds: stat("health", 55), ok: "หลังหินก้อนสุดท้ายคือบันไดที่สลักด้วยมือคนแคระ", fail: "เพดานถล่มลงมาบางส่วน", hurt: 12 },
        { label: "ขอให้คอร์วาธเปิดทาง", odds: () => 0.9, show: (l) => (fl(l).dBonds?.korvath ?? 0) >= 40, ok: "มังกรหินแหวกภูเขาเหมือนแหวกม่าน", fail: "" },
      ] },
      { text: "อุโมงค์แตกเป็นร้อยทาง ต้องทำแผนที่", ways: [
        { label: "ทำแผนที่ทีละทาง", odds: stat("smarts", 55), ok: "ทุกทางวนกลับไปยังห้องโถงเดียว", fail: "คุณหลงอยู่สามวัน", hurt: 6 },
        { label: "ตามรอยสลักของบรรพบุรุษ", odds: (l) => (fl(l).race === "dwarf" ? 0.9 : 0.15), ok: "ลายบนผนังเป็นคำสอนที่ยายคุณเคยร้องให้ฟัง", fail: "ลายพวกนั้นไม่มีความหมายสำหรับคุณ" },
      ] },
      { text: "ผู้พิทักษ์ศิลาตื่นขึ้นเมื่อได้ยินเสียงฝีเท้า", ways: [
        { label: "สลักรูนสั่งให้พวกมันหลับ", odds: (l) => 0.2 + (fl(l).rune ?? 0) * 0.25 + (fl(l).race === "dwarf" ? 0.25 : 0), ok: "ผู้พิทักษ์คุกเข่าลงทีละตัว", fail: "รูนของคุณทำให้พวกมันโกรธกว่าเดิม", hurt: 10 },
        { label: "ฝ่าออกไปด้วยกำลัง", odds: (l) => fightOdds(l, 55), ok: "ศิลาแตกกระจายเต็มโถง", fail: "หมัดหินส่งคุณกระเด็นติดผนัง", hurt: 18 },
      ] },
      { text: "ระฆังแขวนอยู่เหนือเตาหลอมที่ยังมีไฟ ต้องตีระฆังให้ถูกจังหวะ", ways: [
        { label: "ตีตามจังหวะในบันทึก", odds: stat("smarts", 55), ok: "เสียงระฆังดังไปทั่วภูเขา และเตาหลอมก็ลุกโชน", fail: "จังหวะผิด ระฆังเงียบไปอีกหนึ่งปี" },
        { label: "ตีตามที่ใจบอก", odds: stat("luck", 60), ok: "ระฆังตอบคุณเหมือนจำคุณได้", fail: "เสียงระฆังทำหูคุณอื้อไปหลายวัน", hurt: 4 },
      ] },
    ],
    solved: "ปลุกนครคนแคระใต้ภูเขา",
    reward: (l) => { fl(l).rune = 3; fl(l).body += 25; l.money += 200 * 100; },
  },
];

export const mysteryState = (l: Life, id: string): Mystery => (dataOf(l).mysteries[id] ??= { step: 0, notes: [] });
const defOf = (id: unknown) => MYSTERIES.find((m) => m.id === id)!;
const known = (l: Life) => MYSTERIES.filter((m) => fl(l).mKnown?.includes(m.id) && !mysteryState(l, m.id).solvedBy);
const stepOf = (l: Life, c: Ctx) => defOf(c.m).steps[mysteryState(l, String(c.m)).step];
const wayOf = (l: Life, c: Ctx, i: number) => stepOf(l, c)?.ways[i];
const learn = (l: Life, id: string) => { const f = fl(l); if (!f.mKnown?.includes(id)) f.mKnown = [...(f.mKnown ?? []), id]; };

function advance(l: Life, c: Ctx, w: Way) {
  const d = defOf(c.m), s = mysteryState(l, d.id);
  s.notes = [...s.notes, `${displayName(l)}: ${w.ok}`].slice(-6);
  s.step++;
  if (s.step < d.steps.length) return G(w.ok, { iq: 1 })(l, c);
  s.solvedBy = displayName(l);
  d.reward(l);
  deed(l, d.solved);
  recordChronicle(worldOfLife(l), `${displayName(l)}${d.solved}`);
  addLegend(worldOfLife(l), { name: displayName(l), deed: d.solved, lifeId: l.id });
  return BIG(`${w.ok} · ${d.name}ไม่ใช่ปริศนาอีกต่อไป`, { fame: 25, joy: 15 })(l, c);
}

const wayChoice = (i: number): Choice => ({
  label: (l, c) => wayOf(l, c, i)?.label ?? "—",
  show: (l, c) => { const w = wayOf(l, c, i); return !!w && (w.show?.(l) ?? true); },
  odds: (l, c) => clamp(wayOf(l, c, i)!.odds(l), 0.03, 0.97),
  run: (l, c, ok) => {
    const w = wayOf(l, c, i)!;
    if (ok) return advance(l, c, w);
    return (w.hurt ? B(w.fail, { hp: -w.hurt }) : N(w.fail))(l, c);
  },
});
const pickMystery = (i: number): Choice => C((l) => { const m = known(l)[i]; return m ? `${m.name} (${mysteryState(l, m.id).step}/${m.steps.length})` : "—"; }, (l) => { runEvent(l, "ft.m.step", { m: known(l)[i].id }); return { text: "คุณกางบันทึกออกอีกครั้ง" }; }, { show: (l) => !!known(l)[i] });

const ACTS: Activity[] = [
  { id: "ft_mystery", emoji: "", name: "สืบปริศนา", desc: "ทุก 2 ปี · ความคืบหน้าอยู่ในโลก คนรุ่นหลังสืบต่อได้", minAge: 14, time: 2, world: "fantasy", group: "ผจญภัย", available: (l) => known(l).length > 0 && l.age >= Number(l.flags.ftMystNext ?? 0), run: (l) => { l.flags.ftMystNext = l.age + 2; runEvent(l, "ft.m.choose"); return { text: "" }; } },
];

export const MYSTERY_EVENTS: GameEvent[] = [
  SCENE("ft.m.choose", "ปริศนา", "ปริศนาที่คุณรู้อยู่ตอนนี้", [pickMystery(0), pickMystery(1), pickMystery(2), C("ปิดสมุด", N("บางเรื่องต้องรอเวลา"))]),
  SCENE("ft.m.step", "ปริศนา", (l, c) => { const s = mysteryState(l, String(c.m)); const last = s.notes.at(-1); return `${defOf(c.m).name} · ขั้น ${s.step + 1}/${defOf(c.m).steps.length}: ${stepOf(l, c).text}${last ? ` · บันทึกล่าสุด: "${last}"` : ""}`; }, [wayChoice(0), wayChoice(1), wayChoice(2), C("กลับไปก่อน", N("คุณจดสิ่งที่รู้ไว้แล้วกลับบ้าน"))]),
  ...MYSTERIES.map((m) => E(`ft.m.hook.${m.id}`, [12, 400], m.hook, [
    C("จดเรื่องนี้ไว้", G("คุณเริ่มสมุดบันทึกเล่มใหม่", { iq: 1 }, (l) => learn(l, m.id))),
    C("ไม่ใช่เรื่องของคุณ", N("เรื่องนี้จะรอคนอื่นต่อไป")),
  ], { when: (l) => !fl(l).mKnown?.includes(m.id) && !mysteryState(l, m.id).solvedBy && mysteryState(l, m.id).step === 0, weight: 4, maxTimes: 1, title: m.name })),
  E("ft.m.journal", [12, 400], (l, c) => { const m = defOf(c.m), s = mysteryState(l, m.id); return `ในหีบเก่าที่ตลาดนัดมีสมุดบันทึกเรื่อง${m.name} ลายมือของ${s.notes.at(-1)?.split(":")[0] ?? "คนแปลกหน้า"} หน้าสุดท้ายเขียนว่า "${s.notes.at(-1)?.split(": ")[1] ?? "..."}"`; }, [
    C("ซื้อไว้แล้วสืบต่อ", G("คนก่อนหน้าไปได้ไกลกว่าที่คุณคิด", { gold: -2, iq: 1 }, (l, c) => learn(l, String(c.m)))),
    C("ทิ้งไว้ในหีบ", N("อาจมีคนอื่นมาเจอ")),
  ], { when: (l) => !!journalFor(l), weight: 10, maxTimes: 3, title: "บันทึกของคนก่อน", prepare: (l) => ({ m: journalFor(l)!.id }) }),
];
const journalFor = (l: Life) => MYSTERIES.find((m) => { const s = mysteryState(l, m.id); return s.step > 0 && !s.solvedBy && !fl(l).mKnown?.includes(m.id); });

export const loadMysteries = () => { ACTIVITIES.push(...ACTS); };
