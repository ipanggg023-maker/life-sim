import type { Life } from "../../../engine/types";
import { people } from "../../../engine/util";
import { mySect } from "../m17core";
import { TAEL } from "../story/kit";

/** ริบบิ้นตอนตายแบบ BitLife: หนึ่งชีวิตได้หนึ่งริบบิ้น ตามแบบที่ใช้ชีวิตจริง (MURIM_PLAN §174, §183) */
export interface Ribbon {
  id: string;
  emoji: string;
  name: string;
  desc: string;
}

const won = (l: Life, id: string) => !!l.goals?.some((g) => g.id === id && g.end === "won");
const align = (l: Life) => Number(l.flags.m17Align ?? 0);
const kids = (l: Life) => people(l, "child", false).length;
const married = (l: Life) => people(l, "spouse", false).length > 0;

/** เรียงตามลำดับความโดดเด่น — ชีวิตหนึ่งได้อันแรกที่เข้าเงื่อนไข */
const RIBBONS: (Ribbon & { when: (l: Life) => boolean })[] = [
  { id: "legend", emoji: "🐉", name: "ตำนานยุทธภพ", desc: "ฝีมือข้ามพ้นจุดสูงสุด ชื่อถูกจารึกไว้หลายร้อยปี", when: (l) => (l.power?.rank ?? 0) >= 6 },
  { id: "demon", emoji: "😈", name: "มารร้าย", desc: "ทั้งใต้หล้าสาปแช่งชื่อนี้", when: (l) => align(l) <= -60 && Number(l.flags.mwKills ?? 0) >= 2 },
  { id: "hero", emoji: "🦸", name: "วีรชน", desc: "คนธรรมดาจุดธูปให้ทุกปี", when: (l) => align(l) >= 60 && l.fame >= 50 },
  { id: "avenger", emoji: "🗡️", name: "ผู้ชำระแค้น", desc: "ทวงหนี้เลือดได้ครบ", when: (l) => won(l, "revenge") },
  { id: "master", emoji: "🏯", name: "เจ้าสำนัก", desc: "สร้างสำนักของตัวเองขึ้นมา", when: (l) => !!mySect(l) },
  { id: "peak", emoji: "⚔️", name: "ยอดฝีมือ", desc: "ขึ้นถึงจุดสูงสุดของวิชายุทธ์", when: (l) => (l.power?.rank ?? 0) >= 4 },
  { id: "scholar", emoji: "📜", name: "บัณฑิตจอหงวน", desc: "สอบได้ที่หนึ่งของแผ่นดิน", when: (l) => !!l.flags.zhuangyuan },
  { id: "official", emoji: "🎓", name: "ขุนนางราชสำนัก", desc: "ผ่านการสอบหลวงหรือรับราชการจนถึงตำแหน่งสูง", when: (l) => !!l.flags.jinshi || (l.job?.careerId === "official" && l.job.level >= 4) },
  { id: "healer", emoji: "⚕️", name: "หมอเทวดา", desc: "ชีวิตนี้ช่วยชีวิตคนไว้มากกว่าที่ใครนับได้", when: (l) => won(l, "healer") || l.job?.careerId === "palace_physician" },
  { id: "rich", emoji: "💰", name: "มหาเศรษฐี", desc: "ทองล้นคลังจนลูกหลานใช้ไม่หมด", when: (l) => l.money - l.debt >= 5000 * TAEL },
  { id: "elder", emoji: "🐢", name: "ผู้เฒ่าอายุยืน", desc: "อยู่จนเห็นลูกหลานหลายรุ่น", when: (l) => l.age >= 95 },
  { id: "family", emoji: "👨‍👩‍👧‍👦", name: "ต้นตระกูลใหญ่", desc: "ลูกหลานเต็มบ้าน", when: (l) => kids(l) >= 5 },
  { id: "outlaw", emoji: "⛓️", name: "คนนอกกฎหมาย", desc: "ชื่ออยู่บนใบประกาศจับจนวันตาย", when: (l) => !!l.flags.wanted || Number(l.flags.jailUntil ?? -1) > l.age },
  { id: "young", emoji: "🥀", name: "ดอกไม้ร่วงเร็ว", desc: "จากไปก่อนจะได้เป็นอะไรเลย", when: (l) => l.age < 25 },
  { id: "loner", emoji: "🐺", name: "หมาป่าเดียวดาย", desc: "ไม่มีใครรอที่บ้าน ไม่มีใครสืบสกุล", when: (l) => l.age >= 50 && !married(l) && kids(l) === 0 },
  { id: "devoted", emoji: "🏠", name: "คนรักครอบครัว", desc: "ความสุขที่แท้อยู่ที่โต๊ะกินข้าว", when: (l) => married(l) && kids(l) >= 2 && l.stats.happiness >= 60 },
  { id: "quiet", emoji: "🌾", name: "ชีวิตเรียบง่าย", desc: "ไม่เคยจับกระบี่ ไม่เคยติดค้างใคร", when: (l) => !l.power && l.age >= 50 },
  { id: "fighter", emoji: "🥋", name: "จอมยุทธ์", desc: "ฝีมือถึงชั้นหนึ่ง เดินทางไหนก็ไม่มีใครกล้ารังแก", when: (l) => (l.power?.rank ?? 0) >= 3 },
  { id: "kind", emoji: "🙏", name: "คนดีที่ไม่มีใครรู้จัก", desc: "ไม่เคยดัง แต่หลายคนรอดเพราะคุณ", when: (l) => align(l) >= 25 },
  { id: "rogue", emoji: "🃏", name: "คนเลวธรรมดา", desc: "โกงบ้าง ขโมยบ้าง ไม่ถึงกับเป็นมาร", when: (l) => align(l) <= -25 },
  { id: "worker", emoji: "⚒️", name: "คนทำงานหนัก", desc: "ทั้งชีวิตอยู่กับงานตรงหน้า", when: (l) => (l.job?.years ?? 0) >= 15 },
  { id: "parent", emoji: "🏮", name: "เสาหลักของบ้าน", desc: "เลี้ยงลูกจนโต นั่นก็พอแล้ว", when: (l) => kids(l) >= 1 && l.age >= 40 },
  { id: "common", emoji: "🍵", name: "สามัญชน", desc: "หนึ่งในล้านชีวิตใต้หล้า — ธรรมดา แต่เป็นของคุณเอง", when: () => true },
];

export const RIBBON_COUNT = RIBBONS.length;
export function ribbonOf(l: Life): Ribbon {
  const r = RIBBONS.find((x) => x.when(l))!;
  return { id: r.id, emoji: r.emoji, name: r.name, desc: r.desc };
}
export const ribbonById = (id: string): Ribbon | undefined => RIBBONS.find((r) => r.id === id);
