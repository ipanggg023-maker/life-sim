// ศาสตร์แห่งเวท: เลือกเมื่อเป็นนักเวท (ขั้น 2) · แต่ละศาสตร์มีวิชาสามขั้น ผลติดตัว และการฝึกประจำปีของตัวเอง
// ธาตุ (เวทธาตุแม่นขึ้น) · เยียวยา (รอดง่าย รักษาคนในบ้าน) · ความตาย (ทาสอสูร แต่ศาสนจักรตามล่า)
// อัญเชิญ (วิญญาณช่วยสู้) · มายา (หลบหลีกและโชค) · กาลเวลา (หายากที่สุด ด้ายชะตาและอายุขัย)
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Choice, GameEvent } from "../../engine/events";
import { yearHooks } from "../../engine/game";
import { chance, pick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addStat, clamp, log } from "../../engine/util";
import { C, E, G } from "./kit";
import { MAGIC_RANKS, canCast } from "./power";
import { addStanding, fl } from "./state";

export type MSchool = "elemental" | "healing" | "death" | "summon" | "illusion" | "time";
interface School { name: string; desc: string; arts: [string, string, string]; need?: (l: Life) => string | undefined; train: (l: Life) => string }
export const MSCHOOLS: Record<MSchool, School> = {
  elemental: { name: "ศาสตร์ธาตุ", desc: "เวทธาตุแม่นและแรงขึ้น", arts: ["ร่ายสองธาตุพร้อมกัน", "ธาตุคลุมกาย", "พายุธาตุทั้งหก"], train: (l) => { fl(l).magic += 10; return "คุณร่ายลูกไฟกับหอกน้ำแข็งพร้อมกันได้ โดยไม่ระเบิดใส่หน้าตัวเอง"; } },
  healing: { name: "ศาสตร์เยียวยา", desc: "รอดจากงานอันตรายง่ายขึ้น สุขภาพฟื้นทุกปี และรักษาคนในบ้านได้", arts: ["มือสมานแผล", "แสงคืนชีพ", "ปาฏิหาริย์แห่งชีวิต"], train: (l) => { addStat(l, "health", 6); for (const p of l.people) if (p.alive && ["father", "mother", "spouse", "child"].includes(p.relation)) p.bond = clamp(p.bond + 2, 0, 100); return "คุณรักษาไข้ให้ทั้งบ้าน และทุกคนนอนหลับสบายเป็นครั้งแรกในฤดูหนาว"; } },
  death: { name: "ศาสตร์ความตาย", desc: "ทาสอสูรช่วยสู้และอายุยืน แต่ชื่อเสียงตกทุกปีถ้ามีคนรู้", arts: ["ปลุกโครงกระดูก", "ขโมยลมหายใจ", "ประตูแห่งความตาย"], need: (l) => (fl(l).race === "elf" ? "เอลฟ์ไม่แตะศาสตร์นี้" : undefined), train: (l) => { fl(l).magic += 8; fl(l).lifeBonus = Math.min(40, (fl(l).lifeBonus ?? 0) + 1); return "โครงกระดูกในห้องใต้ดินลุกขึ้นทำความสะอาดบ้านให้คุณทั้งคืน"; } },
  summon: { name: "ศาสตร์อัญเชิญ", desc: "วิญญาณที่อัญเชิญช่วยสู้ ยิ่งขั้นสูงยิ่งแรง", arts: ["เรียกภูตจิ๋ว", "อัญเชิญหมาป่าวิญญาณ", "อัญเชิญยักษ์ศิลา"], train: (l) => { fl(l).magic += 8; return pick(l, ["ภูตไฟตัวจิ๋วออกจากวงเวท แล้วขอนั่งบนไหล่คุณ", "หมาป่าวิญญาณวิ่งวนรอบสนามแล้วหอนใส่พระจันทร์", "วงเวทของคุณเปิดได้ใหญ่ขึ้นอีกหนึ่งช่วงแขน"]); } },
  illusion: { name: "ศาสตร์มายา", desc: "โชคดีขึ้นทุกปี หลบหนีเก่ง ภารกิจลับง่ายขึ้น", arts: ["เงาลวงตา", "หน้ากากพันหน้า", "โลกที่ไม่มีอยู่จริง"], train: (l) => { addStat(l, "luck", 2); return "คุณเดินผ่านตลาดโดยที่ทุกคนเห็นคุณเป็นแมวสีส้ม"; } },
  time: { name: "ศาสตร์กาลเวลา", desc: "หายากที่สุด · อายุยืน และได้ด้ายชะตาเมื่อชำนาญ", arts: ["หยุดเวลาหนึ่งลมหายใจ", "ย้อนบาดแผล", "เดินข้ามวันพรุ่งนี้"], need: (l) => (fl(l).potential >= 8 ? undefined : "ต้องมีดาวเวทแปดดาวขึ้นไป"), train: (l) => { fl(l).lifeBonus = Math.min(60, (fl(l).lifeBonus ?? 0) + 1); return "คุณหยุดเวลาได้หนึ่งลมหายใจ และใช้มันมองหยดน้ำที่ค้างกลางอากาศ"; } },
};
const IDS = Object.keys(MSCHOOLS) as MSchool[];
export const mschoolOf = (l: Life) => (fl(l).mschool ? MSCHOOLS[fl(l).mschool as MSchool] : undefined);
/** วิชาที่ใช้ได้: ขั้น 2 = หนึ่งวิชา ขั้น 3 = สอง ขั้น 4 = สาม */
export const mArtsOf = (l: Life) => mschoolOf(l)?.arts.slice(0, Math.max(0, fl(l).magicRank - 1)) ?? [];
const tier = (l: Life) => mArtsOf(l).length;

/** ผลต่อการต่อสู้ (power.ts) */
export const mschoolFight = (l: Life) => {
  const s = fl(l).mschool, t = tier(l);
  if (!t) return 0;
  return s === "summon" ? 4 + t * 4 : s === "death" ? 3 + t * 3 : s === "elemental" ? t * 3 : 0;
};
/** ผลต่อโอกาสตาย (power.ts) */
export const mschoolSafety = (l: Life) => { const s = fl(l).mschool, t = tier(l); return !t ? 1 : s === "healing" ? 1 - t * 0.1 : s === "illusion" ? 1 - t * 0.06 : s === "time" ? 1 - t * 0.05 : 1; };

const pickSchool = (id: MSchool): Choice => ({
  label: `${MSCHOOLS[id].name} · ${MSCHOOLS[id].desc}`,
  req: (l) => MSCHOOLS[id].need?.(l),
  run: G(`คุณเลือกเดินทาง${MSCHOOLS[id].name} อาจารย์มอบตำราเล่มแรกให้`, { magic: 8 }, (l) => { fl(l).mschool = id; }),
});

export const MSCHOOL_EVENTS: GameEvent[] = [
  E("ft.ms.pick", [10, 900], (l) => `ตอนนี้คุณเป็น${MAGIC_RANKS[fl(l).magicRank]}แล้ว หอเวทถามว่าจะลงลึกศาสตร์ใด ศาสตร์ที่เลือกจะอยู่กับคุณไปตลอดชีวิต`, [...IDS.map(pickSchool), C("ยังไม่เลือก ขอเรียนทุกอย่างกว้างๆ ไปก่อน", G("อาจารย์พยักหน้า ประตูของทุกศาสตร์ยังเปิดอยู่", {}, (l) => { l.flags.ftMsWait = l.age; }))], { when: (l) => canCast(l) && fl(l).magicRank >= 2 && !fl(l).mschool && l.age - Number(l.flags.ftMsWait ?? -99) >= 5, forced: true, maxTimes: 0, title: "เลือกศาสตร์แห่งเวท" }),
  E("ft.ms.inquisitor", [14, 900], "ผู้ตรวจการของศาสนจักรอรุณมาเคาะประตู เขาได้กลิ่นศาสตร์ความตายจากบ้านคุณ", [
    { label: "ร่ายมายาซ่อนทุกร่องรอย", odds: (l) => clamp(0.35 + (l.stats.smarts - 50) / 150, 0.1, 0.9), run: (l, _c, ok) => (ok ? { text: "ผู้ตรวจการค้นทั้งบ้านแล้วขอโทษที่รบกวน", kind: "good" } : (addStanding(l, -12), { text: "เขาเจอโครงกระดูกในห้องใต้ดิน ข่าวลือแพร่ไปทั้งเมือง", kind: "bad" })) },
    C("สารภาพและเลิกศาสตร์นี้", G("ศาสนจักรให้อภัย แต่วิชาที่สะสมมาหายไปครึ่งหนึ่ง", {}, (l) => { const f = fl(l); f.mschool = undefined; f.magic = Math.round(f.magic / 2); addStanding(l, 5); })),
  ], { when: (l) => fl(l).mschool === "death", weight: 6, maxTimes: 3, title: "ผู้ตรวจการ" }),
  E("ft.ms.time_echo", [14, 900], "คุณเห็นตัวเองในอนาคตยืนอยู่ปลายถนน เขาส่ายหัวช้าๆ แล้วหายไป", [
    C("ทำตามที่ตัวเองในอนาคตเตือน", G("ปีนั้นคุณเลี่ยงเรื่องร้ายได้หลายครั้งโดยไม่รู้ว่าเลี่ยงอะไร", { luck: 6 })),
    C("ไม่สนใจ", G("ตัวคุณในอนาคตอาจจะผิดก็ได้", { joy: 2 })),
  ], { when: (l) => fl(l).mschool === "time" && tier(l) >= 2, weight: 8, maxTimes: 2, title: "เสียงสะท้อนของเวลา" }),
  E("ft.ms.summon_wild", [14, 900], "วงเวทอัญเชิญของคุณเปิดกว้างเกินไป และสิ่งที่ออกมาไม่ใช่สิ่งที่เรียก", [
    { label: "ผูกพันธะกับมัน", odds: (l) => clamp(0.3 + tier(l) * 0.15, 0.1, 0.9), run: (l, _c, ok) => (ok ? (fl(l).magic += 20, { text: "สิ่งนั้นก้มหัวให้คุณ มันจะมาเมื่อคุณเรียกทุกครั้ง", kind: "good" }) : (addStat(l, "health", -12), { text: "มันฉีกวงเวทแล้วหนีกลับไป ทิ้งรอยกรงเล็บไว้บนแขนคุณ", kind: "bad" })) },
    C("ปิดวงเวททันที", G("วงเวทปิดลงก่อนมันจะข้ามมาได้ทั้งตัว", {})),
  ], { when: (l) => fl(l).mschool === "summon", weight: 8, maxTimes: 2, title: "สิ่งที่ไม่ได้เรียก" }),
  E("ft.ms.plague_heal", [16, 900], "โรคระบาดในหมู่บ้านข้างๆ หมอทุกคนยอมแพ้แล้ว พวกเขาได้ยินว่าคุณเรียนศาสตร์เยียวยา", [
    { label: "ไปรักษาทั้งหมู่บ้าน", odds: (l) => clamp(0.35 + tier(l) * 0.18, 0.1, 0.95), run: (l, _c, ok) => (ok ? (addStanding(l, 15), { text: "คุณรักษาจนแสงในมือแทบดับ ทั้งหมู่บ้านรอด และพวกเขาตั้งชื่อเด็กเกิดใหม่ตามชื่อคุณ", kind: "milestone" }) : (addStat(l, "health", -15), { text: "คุณช่วยได้ครึ่งหมู่บ้าน และติดไข้กลับมาเอง", kind: "bad" })) },
    C("ส่งยาไปให้", G("ยาของคุณช่วยได้บางส่วน", { gold: -5 })),
  ], { when: (l) => fl(l).mschool === "healing", weight: 8, maxTimes: 2, title: "หมู่บ้านไข้ดำ" }),
  E("ft.ms.illusion_heist", [16, 900], "เศรษฐีขี้โกงคนหนึ่งโกงที่ดินชาวบ้านทั้งหมู่บ้าน และคุณรู้ว่าโฉนดอยู่ในห้องนอนของเขา", [
    { label: "ร่ายมายาเข้าไปเอาโฉนดคืน", odds: (l) => clamp(0.4 + tier(l) * 0.15, 0.1, 0.95), run: (l, _c, ok) => (ok ? (addStanding(l, 10), { text: "เศรษฐีตื่นมาเจอแต่แมวสีส้มนั่งบนหมอน ชาวบ้านได้ที่ดินคืนทุกแปลง", kind: "good" }) : (addStanding(l, -5), { text: "มายาของคุณสลายตรงหน้ายาม คุณต้องกระโดดหน้าต่างหนี", kind: "bad" })) },
    C("ไม่ยุ่ง", G("บางเรื่องก็ไม่ใช่ของคุณ", {})),
  ], { when: (l) => fl(l).mschool === "illusion", weight: 8, maxTimes: 1, title: "โฉนดในห้องนอน" }),
  E("ft.ms.element_storm", [16, 900], "พายุธรรมชาติก่อตัวเหนือเมือง และคุณรู้สึกว่าธาตุในพายุกำลังเรียกหาคุณ", [
    { label: "ยืนกลางพายุแล้วบังคับมัน", odds: (l) => clamp(0.3 + tier(l) * 0.18, 0.1, 0.95), run: (l, _c, ok) => (ok ? (fl(l).magic += 30, addStanding(l, 8), { text: "พายุสลายเป็นฝนอุ่นๆ ตามคำสั่งของคุณ ทั้งเมืองเห็น", kind: "milestone" }) : (addStat(l, "health", -14), { text: "ฟ้าผ่าลงมาใกล้คุณจนผมไหม้ไปครึ่งหัว", kind: "bad" })) },
    C("หลบเข้าบ้าน", G("พายุผ่านไปเองตอนเช้า", {})),
  ], { when: (l) => fl(l).mschool === "elemental", weight: 8, maxTimes: 2, title: "พายุเรียกชื่อ" }),
];

const ACT: Activity = {
  id: "ft_mschool", emoji: "", name: "ฝึกศาสตร์แห่งเวท", desc: "ปีละครั้ง · ผลตามศาสตร์ที่เลือก", minAge: 10, world: "fantasy", group: "เวทมนตร์",
  available: (l) => !!mschoolOf(l) && canCast(l) && Number(l.flags.ftMsTrain ?? -1) !== l.age,
  run: (l) => { l.flags.ftMsTrain = l.age; return { text: mschoolOf(l)!.train(l), kind: "good" }; },
};

export function loadMSchools() {
  ACTIVITIES.push(ACT);
  yearHooks.push((l) => {
    if (l.worldId !== "fantasy" || !l.ft || !l.alive || !tier(l)) return;
    const s = fl(l).mschool;
    if (s === "healing") addStat(l, "health", tier(l));
    if (s === "illusion" && chance(l, 0.4)) addStat(l, "luck", 1);
    if (s === "death" && chance(l, 0.25)) { addStanding(l, -2); if (chance(l, 0.2)) log(l, "ชาวบ้านเริ่มกระซิบว่าบ้านของคุณเย็นผิดปกติตอนกลางคืน", "bad"); }
    if (s === "time" && tier(l) >= 3 && !l.flags.ftTimeThread) { l.flags.ftTimeThread = true; fl(l).threads++; log(l, "คุณเดินข้ามวันพรุ่งนี้ได้ครั้งแรก และกลับมาพร้อมด้ายชะตาอีกหนึ่งเส้น", "milestone"); }
  });
}
