// สาเหตุการตายตามสภาพจริง — เดิมสุ่มจากรายการกลาง ทำให้คนที่ไม่เคยโดนพิษตาย "พิษสะสม" และคนไม่เคยฝึกลมปราณตาย "ลมปราณแตกซ่าน"
// ตอนนี้ดูจากบาดแผลที่มีอยู่จริง ขั้นยุทธ์ ภูมิภาค และอายุ
import { deathCauseHooks } from "../../../engine/game";
import { pick } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { regionOf } from "./region";

const SICK: Record<string, string[]> = {
  north: ["ไข้หนาวลงปอดในพายุหิมะ", "โรคไอเรื้อรังจากลมทราย"],
  jiangnan: ["ไข้ระบาดจากน้ำในคลอง", "โรคท้องร่วงในฤดูน้ำหลาก"],
  sichuan: ["ไข้หมอกภูเขาที่ไม่มีวันจาง", "โรคปอดชื้นจากหมอกเสฉวน"],
  west: ["ไข้ทะเลทรายระหว่างทางคาราวาน", "ความหนาวบนภูเขาหิมะ"],
  south: ["ไข้ป่าทางใต้", "พิษงูในป่าลึก"],
  capital: ["โรคระบาดในเมืองหลวงที่แออัด", "ไข้ทรพิษที่ลามทั้งตรอก"],
};
const ACCIDENT = ["จมน้ำในแม่น้ำเหลือง", "ม้าตื่นเหยียบ", "พลัดตกหน้าผาระหว่างเดินทาง", "ถูกโจรภูเขาปล้นฆ่า"];

/** สาเหตุการตาย "ตามธรรมชาติ" ของยุทธภพ — ดูบาดแผลก่อน แล้วค่อยดูความเจ็บป่วยตามถิ่น อายุ และขั้นยุทธ์ */
export function murimDeathCause(l: Life): string | undefined {
  if (l.worldId !== "murim") return undefined;
  const inj = l.body?.injuries ?? [];
  // พิษที่ยังกัดกินอยู่ หรือพิษถาวรในร่างที่ทรุดแล้ว — พิษที่ร่างกายอยู่ร่วมได้ไม่ใช่สาเหตุ
  const poison = inj.find((i) => i.kind === "poison" && (i.heal > 0 || l.stats.health < 40));
  if (poison) return `พิษ${poison.cause ? `จาก${poison.cause}` : ""}ที่สะสมในร่างกายหลายปีกัดกินอวัยวะจนหมดแรง`;
  if (inj.some((i) => i.part === "dantian" && i.kind === "shattered")) return "ตันเถียนที่แตกค่อยๆ ดูดกำลังชีวิตจนหมด";
  const inner = inj.find((i) => i.kind === "internal" && (i.heal > 0 || i.sev === 3));
  if (inner) return l.power ? "ลมปราณแตกซ่านจากบาดแผลภายในที่ไม่เคยหายสนิท" : "บาดเจ็บภายในที่รักษาไม่หาย";
  if (l.flags.qiDeviation && l.power) return "ธาตุไฟเข้าแทรกระหว่างนั่งสมาธิ";
  const sick = SICK[regionOf(l).id] ?? SICK.north;
  if (l.stats.health < 25) return l.age < 50 ? pick(l, sick) : pick(l, [...sick, "ร่างกายที่ทรุดโทรมไม่ยอมฟื้นอีกแล้ว"]);
  if (l.age < 50) return pick(l, [...ACCIDENT, ...sick]);
  if ((l.power?.rank ?? 0) >= 5) return pick(l, ["นั่งสมาธิแล้วไม่ตื่นขึ้นมาอีก — ลมปราณคืนสู่ฟ้าดิน", "ชราภาพ หลังมองพระอาทิตย์ตกจากยอดเขาเป็นครั้งสุดท้าย"]);
  return undefined;
}

deathCauseHooks.push(murimDeathCause);
