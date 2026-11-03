// สายอาวุธของคนสายกาย: เลือกเมื่อเป็นนักสู้ · ท่าไม้ตายเปิดตามขั้น · บางเผ่าถนัดบางสาย
// ใช้ท่าไม้ตายได้ปีละครั้งในการต่อสู้ (เหมือนมานาของสายเวท) · ฉายาตามสิ่งที่ทำมาทั้งชีวิต
import type { Choice, Ctx, GameEvent } from "../../engine/events";
import type { Life } from "../../engine/types";
import { clamp } from "../../engine/util";
import { C, E, G, N, P, PAY, SCENE, type Res } from "./kit";
import { BODY_RANKS, MAGIC_RANKS, MASTER, fightOdds } from "./power";
import { twinStar } from "./stars";
import { personaEpithet } from "./persona";
import { dataOf, fl, homeKingdom, myRelic, type RaceId } from "./state";

export type StyleId = "sword" | "spear" | "axe" | "bow" | "daggers" | "hammer" | "fist" | "shield";
interface Style { name: string; weapon: string; desc: string; techs: [string, string, string, string]; races: RaceId[] }
export const STYLES: Record<StyleId, Style> = {
  sword: { name: "สายดาบ", weapon: "ดาบ", desc: "สมดุลทุกด้าน", techs: ["ฟันเฉียงจันทร์เสี้ยว", "ดาบพายุหมุน", "หนึ่งดาบผ่าภูเขา", "ดาบไร้เงา"], races: ["human"] },
  spear: { name: "สายหอก", weapon: "หอก", desc: "ระยะไกลกว่าดาบ ล้มคนบนหลังม้าได้", techs: ["แทงทะลวงเกราะ", "หอกมังกรม้วน", "พันหอกฝนดาว", "หอกเดียวหยุดทัพ"], races: ["human", "beastfolk"] },
  axe: { name: "สายขวาน", weapon: "ขวาน", desc: "หนักและแรง ผ่าได้ทั้งโล่ทั้งคน", techs: ["ผ่าฟืนเหล็ก", "ขวานหมุนพายุ", "ฟันแผ่นดินแยก", "ขวานล้มยักษ์"], races: ["orc", "dwarf"] },
  bow: { name: "สายธนู", weapon: "ธนู", desc: "ชนะก่อนศัตรูจะเข้าถึงตัว", techs: ["ยิงสามดอกพร้อมกัน", "ศรตามลม", "ฝนธนูพันดอก", "ศรเดียวดับดาว"], races: ["elf"] },
  daggers: { name: "สายมีดคู่", weapon: "มีดคู่", desc: "เร็วและเงียบ เหมาะกับงานในเงา", techs: ["เงาสองคม", "ก้าวเงาไร้เสียง", "พันแผลในพริบตา", "มีดที่ไม่มีใครเห็น"], races: ["halfling", "demon"] },
  hammer: { name: "สายค้อนศึก", weapon: "ค้อนศึก", desc: "ทุบเกราะแตก ทุบหินร้าว", techs: ["ทุบโล่แตก", "ค้อนฟ้าคำราม", "แผ่นดินสะท้าน", "ค้อนหลอมดาว"], races: ["dwarf"] },
  fist: { name: "สายหมัด", weapon: "สนับมือ", desc: "ร่างกายคืออาวุธ ไม่ต้องพกอะไรเลย", techs: ["หมัดเหล็ก", "เท้ากรงเล็บ", "หมัดหยุดหัวใจ", "หมัดเดียวพังกำแพงเมือง"], races: ["beastfolk", "orc"] },
  shield: { name: "สายโล่", weapon: "โล่และดาบสั้น", desc: "รอดก่อนแล้วค่อยชนะ · โอกาสตายต่ำกว่าทุกสาย", techs: ["กำแพงโล่", "โล่สะท้อน", "โล่ไม่มีวันแตก", "ปราการมนุษย์"], races: ["dwarf", "human"] },
};
export const STYLE_IDS = Object.keys(STYLES) as StyleId[];

export const styleOf = (l: Life) => (fl(l).style ? STYLES[fl(l).style as StyleId] : undefined);
export const techsOf = (l: Life) => styleOf(l)?.techs.slice(0, Math.min(MASTER, fl(l).bodyRank)) ?? [];
export const weaponNoun = (l: Life) => styleOf(l)?.weapon ?? "ดาบ";
const affinity = (l: Life) => !!styleOf(l)?.races.includes(fl(l).race);
/** สายที่เลือกช่วยสู้ · เผ่าที่ถนัดได้มากกว่า */
export const styleBonus = (l: Life) => (styleOf(l) && fl(l).bodyRank >= 1 ? 2 + fl(l).bodyRank + (affinity(l) ? 3 : 0) : 0);

/** ปุ่มท่าไม้ตายในฉากต่อสู้ · ปีละครั้ง */
export function techChoice(threat: (l: Life, c: Ctx) => number, ok: (tech: string) => Res, fail: Res): Choice {
  const best = (l: Life) => techsOf(l).at(-1)!;
  return P(
    (l) => `ใช้ท่าไม้ตาย「${best(l)}」`,
    (l, c) => clamp(fightOdds(l, threat(l, c)) + 0.06 + fl(l).bodyRank * 0.02, 0.04, 0.97),
    (l, c) => { l.flags.ftTechUsed = l.age; return ok(best(l))(l, c); },
    (l, c) => { l.flags.ftTechUsed = l.age; return fail(l, c); },
    { show: (l) => techsOf(l).length > 0 && l.flags.ftTechUsed !== l.age },
  );
}

const pickStyle = (id: StyleId): Choice => C((l) => `${STYLES[id].name} · ${STYLES[id].desc}${STYLES[id].races.includes(fl(l).race) ? " · เผ่าของคุณถนัด" : ""}`, G(`คุณจับ${STYLES[id].weapon}ขึ้นมา มันพอดีมือเหมือนรอคุณมานาน`, { body: 6 }, (l) => { fl(l).style = id; }));

export const STYLE_EVENTS: GameEvent[] = [
  E("ft.style_pick", [8, 400], (l) => `ตอนนี้คุณเป็น${BODY_RANKS[fl(l).bodyRank]}แล้ว ครูฝึกถามว่าจะเอาดีทางอาวุธไหน${fl(l).race !== "human" ? " (บางสายเข้ากับเผ่าของคุณเป็นพิเศษ)" : ""}`, STYLE_IDS.map(pickStyle), { when: (l) => fl(l).bodyRank >= 1 && !fl(l).style, forced: true, maxTimes: 1, title: "เลือกสายอาวุธ" }),
  SCENE("ft.style_change", "เปลี่ยนสายอาวุธ", (l) => `ตอนนี้คุณใช้${styleOf(l)?.name ?? "อาวุธทั่วไป"} ครูฝึกในเมืองสอนได้ทุกสาย แต่ต้องเริ่มท่าใหม่จากพื้นฐาน`, [
    ...STYLE_IDS.map((id) => PAY(`ฝึก${STYLES[id].name}`, 30, G((l) => `คุณวาง${weaponNoun(l)}ลง แล้วเริ่มนับหนึ่งกับ${STYLES[id].weapon}`, {}, (l) => { const f = fl(l); f.style = id; f.body = Math.round(f.body * 0.5); l.flags.ftStyleNext = l.age + 5; }), { show: (l) => fl(l).style !== id })),
    C("ใช้สายเดิมต่อ", N("คุณกลับไปซ้อมท่าเดิมให้คมกว่าเดิม")),
  ]),
];

/** ฉายาที่ผู้คนเรียกคุณ ตามเรื่องที่ยิ่งใหญ่ที่สุดที่ทำ */
export function epithetOf(l: Life): string | undefined {
  const f = fl(l), d = dataOf(l), me = `${l.firstName} ${l.lastName}`;
  const k = d.kingdoms.find((x) => x.id === f.throne);
  if (k) return `ผู้ครอง${k.name}`;
  if (d.dragons.some((x) => x.slainBy === me)) return "ผู้สังหารมังกร";
  if (f.race === "dragon" && l.flags.ftBornRace !== "dragon") return "ผู้กลายเป็นมังกร";
  if (twinStar(l)) return "ดาวคู่";
  if (f.magicRank > MASTER || f.bodyRank > MASTER) return f.magicRank >= f.bodyRank ? MAGIC_RANKS[f.magicRank] : BODY_RANKS[f.bodyRank];
  if (f.magicRank >= MASTER) return MAGIC_RANKS[MASTER];
  if (f.bodyRank >= MASTER) return `ปรมาจารย์${styleOf(l)?.name ?? "ดาบ"}`;
  if (l.flags.dragonRider) return "ผู้ขี่มังกร";
  if (myRelic(l)) return `ผู้ถือ${myRelic(l)!.name}`;
  if (f.fRank >= 3 && f.faction) return `ผู้นำ${d.factions.find((x) => x.id === f.faction)?.name ?? "ฝ่าย"}`;
  if (f.guild >= 5) return "นักผจญภัยขั้นมิธริล";
  if ((f.crimes ?? 0) >= 5) return "จอมโจรแห่ง" + homeKingdom(l).name;
  if (l.fame >= 50) return `วีรชนแห่ง${homeKingdom(l).name}`;
  if ((f.cups ?? 0) >= 2) return "แชมป์งานประลอง";
  return personaEpithet(l);
}
