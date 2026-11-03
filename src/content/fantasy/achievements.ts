// ความสำเร็จของโลกแฟนตาซี — ดาบและเวท ชีวิตนักผจญภัย ตำนาน (มังกร อาวุธ ปริศนา ภพอื่น) และบัลลังก์
// ตรวจทุกปี (shared/achieveHook) — สิ่งที่เคยทำได้ระหว่างชีวิตยังนับตอนจบ แม้สถานะนั้นจะหายไปแล้ว (เช่น เสียบัลลังก์)
import { ACHIEVEMENTS, type Achievement } from "../achievements";
import type { Life } from "../../engine/types";
import { displayName } from "../../engine/util";
import { GOLD } from "./kit";
import { MAX_RANK } from "./power";
import { dataOf, fl, standingOf, worldOfLife } from "./state";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
/** เงื่อนไขที่ดูข้อมูลแฟนตาซี · ชีวิตโลกอื่นไม่ผ่านเสมอ */
const F = (fn: (l: Life) => boolean) => (l: Life) => on(l) && fn(l);

type A = Omit<Achievement, "cat">;
const power: A[] = [
  { id: "fa_body1", name: "ก้าวแรกบนเส้นทางดาบ", desc: "เป็นนักสู้", points: 5, check: F((l) => fl(l).bodyRank >= 1) },
  { id: "fa_body3", name: "ยอดนักดาบ", desc: "ฝีมือถึงขั้นยอดนักดาบ", points: 15, check: F((l) => fl(l).bodyRank >= 3) },
  { id: "fa_body4", name: "ปรมาจารย์ดาบ", desc: "ฝีมือถึงขั้นสูงสุดของสายกาย", points: 35, check: F((l) => fl(l).bodyRank >= MAX_RANK) },
  { id: "fa_magic1", name: "ประกายเวทแรก", desc: "เป็นผู้ฝึกเวท", points: 5, check: F((l) => fl(l).magicRank >= 1) },
  { id: "fa_magic3", name: "จอมเวท", desc: "เวทถึงขั้นจอมเวท", points: 15, check: F((l) => fl(l).magicRank >= 3) },
  { id: "fa_magic4", name: "อัครจอมเวท", desc: "เวทถึงขั้นสูงสุด", points: 35, check: F((l) => fl(l).magicRank >= MAX_RANK) },
  { id: "fa_both", name: "ดาบในมือขวา คทาในมือซ้าย", desc: "ขั้นสามขึ้นไปทั้งสายกายและสายเวท", points: 30, check: F((l) => fl(l).bodyRank >= 3 && fl(l).magicRank >= 3) },
  { id: "fa_spells6", name: "หกบทในหัว", desc: "รู้เวท 6 บท", points: 10, check: F((l) => (fl(l).spells?.length ?? 0) >= 6) },
  { id: "fa_spells12", name: "ตำราเวทเดินได้", desc: "รู้เวท 12 บท", points: 25, check: F((l) => (fl(l).spells?.length ?? 0) >= 12) },
  { id: "fa_arts", name: "สามศาสตร์", desc: "ศึกษาบทสวด วงเวท และอักษรรูนครบทั้งสาม", points: 15, check: F((l) => !!fl(l).chant && !!fl(l).circle && !!fl(l).rune) },
  { id: "fa_evo1", name: "พรสวรรค์ตื่น", desc: "พรสวรรค์ตื่นสู่ร่างใหม่ครั้งแรก", points: 10, check: F((l) => Number(l.flags.ftEvolved ?? 0) >= 1) },
  { id: "fa_evo3", name: "สามร่างในชีวิตเดียว", desc: "พรสวรรค์ตื่นสู่ร่างใหม่ 3 ครั้งในชีวิตเดียว", points: 30, check: F((l) => Number(l.flags.ftEvolved ?? 0) >= 3) },
  { id: "fa_wandless", name: "ไม่ต้องพึ่งคทา", desc: "ร่ายเวทได้ด้วยมือเปล่า", points: 10, check: F((l) => !!l.flags.wandless) },
];

const life: A[] = [
  { id: "fa_grad", name: "ป้ายจบการศึกษา", desc: "เรียนจบจากโรงเรียนเวทหรือโรงเรียนดาบ", points: 5, check: F((l) => !!fl(l).graduated) },
  { id: "fa_cup", name: "แชมป์งานประลอง", desc: "ชนะงานประลองของโรงเรียน", points: 10, check: F((l) => (fl(l).cups ?? 0) >= 1) },
  { id: "fa_cup3", name: "สามถ้วยบนหิ้ง", desc: "ชนะงานประลองของโรงเรียน 3 ครั้ง", points: 20, check: F((l) => (fl(l).cups ?? 0) >= 3) },
  { id: "fa_guild3", name: "ป้ายเงิน", desc: "เลื่อนขั้นกิลด์นักผจญภัยถึงขั้นเงิน", points: 10, check: F((l) => fl(l).guild >= 3) },
  { id: "fa_guild5", name: "ป้ายมิธริล", desc: "ขั้นสูงสุดของกิลด์นักผจญภัย", points: 30, check: F((l) => fl(l).guild >= 5) },
  { id: "fa_rich", name: "หีบทองหมื่นเหรียญ", desc: "มีทรัพย์สุทธิ 10,000 เหรียญทอง", points: 15, check: F((l) => l.money - l.debt >= 10_000 * GOLD) },
  { id: "fa_beloved", name: "ลูกรักของแผ่นดิน", desc: "ชื่อเสียงในแผ่นดินที่อยู่ถึง 80", points: 15, check: F((l) => standingOf(l) >= 80) },
  { id: "fa_scars", name: "แผลเป็นเล่าเรื่อง", desc: "มีแผลเป็น 5 แห่ง", points: 10, check: F((l) => fl(l).scars.length >= 5) },
  { id: "fa_old", name: "อายุยืนเกินมนุษย์", desc: "มีชีวิตถึง 150 ปี", points: 25, check: F((l) => l.age >= 150) },
  { id: "fa_outlaw", name: "ใบประกาศจับ", desc: "ก่ออาชญากรรม 5 ครั้ง", points: 8, hidden: true, check: F((l) => (fl(l).crimes ?? 0) >= 5) },
];

const legend: A[] = [
  { id: "fa_rider", name: "สหายมังกร", desc: "ขี่มังกรขึ้นฟ้า", points: 20, check: F((l) => !!l.flags.dragonRider) },
  { id: "fa_whelp", name: "แม่มังกร", desc: "ฟักไข่มังกรและเลี้ยงลูกมังกรของตัวเอง", points: 15, check: F((l) => !!fl(l).whelp) },
  { id: "fa_slayer", name: "ผู้สังหารมังกร", desc: "สังหารมังกรด้วยมือตัวเอง", points: 30, check: F((l) => dataOf(l).dragons.some((d) => d.slainBy === displayName(l))) },
  { id: "fa_relic", name: "อาวุธเลือกคุณ", desc: "ครอบครองอาวุธตำนาน", points: 20, check: F((l) => !!fl(l).relic) },
  { id: "fa_mystery", name: "ผู้ไขปริศนา", desc: "ไขปริศนาของโลกได้หนึ่งเรื่อง", points: 20, check: F((l) => Object.values(dataOf(l).mysteries).some((m) => m.solvedBy === displayName(l))) },
  { id: "fa_realms3", name: "ผู้ข้ามภพ", desc: "เดินทางไปภพอื่นครบสามภพ", points: 20, check: F((l) => Object.keys(fl(l).realmVisits ?? {}).length >= 3) },
  { id: "fa_great", name: "ล้มยักษ์", desc: "เอาชนะยอดฝีมือในตำนานของยุค", points: 20, check: F((l) => !!fl(l).beatGreat) },
  { id: "fa_deeds8", name: "พงศาวดารเดินได้", desc: "มีวีรกรรม 8 อย่างในชีวิตเดียว", points: 20, check: F((l) => fl(l).deeds.length >= 8) },
  { id: "fa_legend", name: "ชื่อในตำนาน", desc: "ชื่อของคุณถูกเล่าเป็นตำนานของโลก", points: 20, check: F((l) => worldOfLife(l).legends.some((g) => g.lifeId === l.id)) },
  { id: "fa_pact", name: "หมึกสีดำ", desc: "ทำพันธสัญญากับเจ้าปีศาจ", points: 10, hidden: true, check: F((l) => (fl(l).pacts ?? 0) >= 1) },
  { id: "fa_dragonform", name: "เกล็ดแทนผิว", desc: "แปลงกายเป็นมังกร", points: 30, hidden: true, check: F((l) => fl(l).race === "dragon" && l.flags.ftBornRace !== "dragon") },
  { id: "fa_saga1", name: "ผู้ตามรอยตำนาน", desc: "จบมหากาพย์ตำนานหนึ่งเรื่อง", points: 20, check: F((l) => Number(l.flags.ftSagas ?? 0) >= 1) },
  { id: "fa_saga3", name: "ผู้เขียนตำนานสามบท", desc: "จบมหากาพย์ตำนานสามเรื่องในชีวิตเดียว", points: 45, check: F((l) => Number(l.flags.ftSagas ?? 0) >= 3) },
  { id: "fa_heroking", name: "ราชันวีรชน", desc: "ชนะการประลองแห่งราชันวีรชน", points: 30, check: F((l) => !!l.flags.heroKing) },
  { id: "fa_god", name: "เทพองค์ใหม่", desc: "ขึ้นสู่สวรรค์เป็นเทพ", points: 60, hidden: true, check: (l) => l.worldId === "fantasy" && (l.causeOfDeath ?? "").startsWith("ขึ้นสู่สวรรค์") },
];

const throne: A[] = [
  { id: "fa_oath", name: "คำสาบาน", desc: "เข้าร่วมฝ่ายอำนาจ", points: 5, check: F((l) => !!fl(l).faction) },
  { id: "fa_leader", name: "ผู้นำฝ่าย", desc: "ขึ้นเป็นผู้นำของฝ่ายอำนาจ", points: 20, check: F((l) => fl(l).fRank >= 3) },
  { id: "fa_order", name: "ผู้ก่อตั้งภาคี", desc: "ก่อตั้งภาคีของตัวเอง", points: 20, check: F((l) => dataOf(l).factions.some((x) => x.playerLed && x.id === fl(l).faction && x.name === `ภาคี${l.lastName}`)) },
  { id: "fa_consort", name: "คู่ของผู้ครอง", desc: "แต่งงานกับผู้ครองแผ่นดิน", points: 15, check: F((l) => !!fl(l).consort) },
  { id: "fa_crown", name: "สวมมงกุฎ", desc: "ครองแผ่นดิน", points: 35, check: F((l) => !!fl(l).throne) },
  { id: "fa_found", name: "ผู้สร้างแผ่นดิน", desc: "ก่อตั้งอาณาจักรใหม่ของตัวเอง", points: 40, check: F((l) => dataOf(l).kingdoms.some((k) => k.id === fl(l).throne && k.id.startsWith("p") && k.name === `ราชรัฐ${l.lastName}`)) },
];

ACHIEVEMENTS.push(
  ...power.map((a) => ({ ...a, cat: "fantasy" as const })),
  ...life.map((a) => ({ ...a, cat: "fantasy_life" as const })),
  ...legend.map((a) => ({ ...a, cat: "fantasy_legend" as const })),
  ...throne.map((a) => ({ ...a, cat: "fantasy_throne" as const })),
);
