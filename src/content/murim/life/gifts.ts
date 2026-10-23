// พรสวรรค์ของยุทธภพ — ทุกอย่างมีผลจริงกับระบบในเกม (ลมปราณ การต่อสู้ การรอดชีวิต การเรียนวิชา การทะลวงขั้น
// ธาตุไฟเข้าแทรก บาดแผล พิษ ข่าวสาร การแพทย์ ความรัก อายุขัย รายได้) — ไม่ใช่แค่บวกค่าสถานะตอนเกิด
// ไฟล์นี้ import ได้แค่ content/talents (กันวงจร import กับ engine/game)
import type { Life, Rarity, StatKey } from "../../../engine/types";
import { TALENTS, activeTalents, type Talent } from "../../talents";

export type GiftKey =
  | "root" // รากฐานกระดูก: ศิลาวัดกระดูกตอบแน่นอน และรากฐานสูงขึ้นตามจำนวนขั้น
  | "qi" // ลมปราณสะสมเร็วขึ้น (คูณ)
  | "learn" // เรียนวิชาเร็วขึ้น (คูณ)
  | "fight" // โอกาสชนะการต่อสู้ (+)
  | "survival" // โอกาสรอดชีวิต (+)
  | "break" // โอกาสทะลวงขั้น (+)
  | "deviation" // ความเสี่ยงธาตุไฟเข้าแทรก (คูณ · ติดลบ = ลดลง)
  | "heal" // โอกาสแผลหายเร็วขึ้นต่อปี (+)
  | "poison" // ต้านพิษ (1 = ไม่ติดพิษ)
  | "info" // ตรวจสอบข่าว/สืบข่าวแม่นขึ้น (+)
  | "medicine" // งานหมอ/ปรุงยาสำเร็จง่ายขึ้น (+)
  | "work" // งานอาชีพทุกอย่างสำเร็จง่ายขึ้น (+)
  | "romance" // ความรักและการแต่งงาน (+)
  | "lifespan" // อายุขัย (ปี)
  | "income" // รายได้ (คูณ)
  | "dark"; // ใจโหด: ธรรมะลดลงเองทุกปี แต่คนเกรงกลัว

const LABEL: Record<GiftKey, (v: number) => string> = {
  root: (v) => `รากฐานกระดูก +${v} (ชีพจรเปิดแน่นอน)`,
  qi: (v) => `ลมปราณสะสม ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`,
  learn: (v) => `เรียนวิชา ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`,
  fight: (v) => `โอกาสชนะการต่อสู้ ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`,
  survival: (v) => `โอกาสรอดชีวิต ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`,
  break: (v) => `โอกาสทะลวงขั้น ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`,
  deviation: (v) => `ธาตุไฟเข้าแทรก ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`,
  heal: (v) => `แผลหายเร็ว ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`,
  poison: (v) => (v >= 1 ? "ไม่ติดพิษ" : `ต้านพิษ ${Math.round(v * 100)}%`),
  info: (v) => `สืบข่าว/ตรวจข่าว +${Math.round(v * 100)}%`,
  medicine: (v) => `งานหมอและปรุงยา +${Math.round(v * 100)}%`,
  work: (v) => `งานอาชีพ +${Math.round(v * 100)}%`,
  romance: (v) => `ความรัก +${Math.round(v * 100)}%`,
  lifespan: (v) => `อายุขัย ${v > 0 ? "+" : ""}${v} ปี`,
  income: (v) => `รายได้ ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`,
  dark: () => "ใจโหด: ธรรมะลดลงเองทุกปี คนเกรงกลัว",
};
const STAT: Record<StatKey, string> = { health: "สุขภาพ", happiness: "ความสุข", smarts: "สติปัญญา", looks: "รูปลักษณ์", luck: "โชค" };

/** ผลรวมของพรสวรรค์ที่เปิดเผยแล้ว (ยุทธภพเท่านั้น) */
export function gift(l: Life, k: GiftKey): number {
  if (l.worldId !== "murim") return 0;
  let s = 0;
  for (const t of activeTalents(l)) s += t.mx?.[k] ?? 0;
  // พรสวรรค์ที่ประสานกันแล้ว (ฉากพิเศษเกิดแล้ว)
  for (const c of COMBOS) if (l.flags[`combo:${c.id}`]) s += c.mx[k] ?? 0;
  return s;
}

/** รวมทุกพรสวรรค์ที่มี (รวมช่องลับที่ยังไม่เปิด) — ใช้กับสิ่งที่ "ติดตัวมาแต่เกิด" เช่นรากฐานกระดูก */
export function giftAll(l: Life, k: GiftKey): number {
  if (l.worldId !== "murim") return 0;
  let s = 0;
  for (const x of l.talents) s += TALENTS.find((t) => t.id === x.id)?.mx?.[k] ?? 0;
  return s;
}

/** ข้อความผลจริงของพรสวรรค์ (แสดงในแท็บวิชา/บันทึก) */
export function giftText(t: Talent): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(t.mx ?? {})) if (v) parts.push(LABEL[k as GiftKey](v));
  return parts.join(" · ");
}

function G(id: string, name: string, rarity: Rarity, flavor: string, mx: Partial<Record<GiftKey, number>>, stats: Partial<Record<StatKey, number>> = {}): Talent {
  const st = Object.entries(stats).map(([k, v]) => `${STAT[k as StatKey]} ${v > 0 ? "+" : ""}${v}`);
  const t: Talent = {
    id,
    name,
    rarity,
    world: "murim",
    mx,
    desc: "",
    apply: (l) => {
      for (const [k, v] of Object.entries(stats)) l.stats[k as StatKey] = Math.max(0, Math.min(100, l.stats[k as StatKey] + v));
    },
  };
  t.desc = `${flavor} — ${[...st, giftText(t)].filter(Boolean).join(" · ")}`;
  return t;
}

export const MURIM_TALENTS: Talent[] = [
  // ───── ธรรมดา ─────
  G("mt_good_bones", "กระดูกดี", "common", "ผู้เฒ่าในหมู่บ้านจับข้อมือแล้วพยักหน้า \"เด็กคนนี้ฝึกวิชาได้\"", { root: 1, learn: 0.1 }, { health: 4 }),
  G("mt_long_breath", "ลมหายใจยาว", "common", "ดำน้ำได้นานกว่าเด็กทุกคนในหมู่บ้าน", { qi: 0.1 }),
  G("mt_quick_heal", "เนื้อหนังหายไว", "common", "แผลถลอกหายในวันเดียว", { heal: 0.5 }, { health: 3 }),
  G("mt_keen_ear", "หูไวตาไว", "common", "ได้ยินคนกระซิบจากอีกฝั่งตลาด", { info: 0.15 }),
  G("mt_steady", "ใจนิ่ง", "common", "ไม่เคยร้องไห้แม้ตอนหกล้มหัวแตก", { deviation: -0.4 }, { happiness: 3 }),
  G("mt_hard_worker", "มือหยาบใจสู้", "common", "ทำงานหนักได้ทั้งวันโดยไม่บ่น", { work: 0.08, income: 0.1 }),
  G("mt_herb_nose", "จมูกสมุนไพร", "common", "แยกสมุนไพรร้อยชนิดได้ด้วยกลิ่น", { medicine: 0.12, poison: 0.3 }),
  G("mt_sweet_face", "หน้าตาชวนมอง", "common", "แม่สื่อมาเคาะประตูตั้งแต่คุณยังไม่สิบห้า", { romance: 0.15 }, { looks: 6 }),
  // ───── หายาก ─────
  G("mt_martial_eye", "ดวงตาแห่งยุทธ์", "rare", "ดูคนรำกระบี่ครั้งเดียวก็จำท่าได้", { learn: 0.3, fight: 0.04 }),
  G("mt_dragon_bones", "กระดูกมังกรซ่อน", "rare", "เส้นชีพจรกว้างกว่าคนทั่วไปเท่าตัว", { root: 1, break: 0.04, qi: 0.08 }),
  G("mt_hundred_poison", "ร่างร้อยพิษ", "rare", "งูกัดตอนเด็กแล้วรอด — ตั้งแต่นั้นพิษไม่ทำอะไรคุณ", { poison: 1, medicine: 0.05 }, { health: 3 }),
  G("mt_healer_hands", "มือหมอ", "rare", "แตะชีพจรแล้วรู้ว่าป่วยตรงไหน", { medicine: 0.2, heal: 0.3 }),
  G("mt_born_fighter", "เลือดนักสู้", "rare", "ยิ่งเจ็บยิ่งสู้ ไม่เคยถอยในการชกต่อยตอนเด็ก", { fight: 0.07, survival: 0.04 }, { health: 5 }),
  G("mt_merchant_blood", "สายเลือดพ่อค้า", "rare", "นับเงินในใจได้เร็วกว่าลูกคิด", { income: 0.3, info: 0.05 }),
  G("mt_peach_luck", "ดวงดอกท้อ", "rare", "ไปที่ไหนก็มีคนแอบมอง", { romance: 0.3 }, { looks: 8 }),
  // ───── ตำนาน ─────
  G("mt_heaven_bones", "กระดูกเทพยุทธ์", "legendary", "ร้อยปีจะมีสักคนที่เกิดมาพร้อมกระดูกแบบนี้", { root: 2, qi: 0.15, learn: 0.2, break: 0.05 }),
  G("mt_nine_yin", "ร่างเก้าหยิน", "legendary", "ร่างกายเย็นเฉียบตั้งแต่เกิด ลมปราณไหลเหมือนแม่น้ำ — แต่อายุสั้นถ้าไม่ระวัง", { root: 1, qi: 0.3, deviation: 0.3, lifespan: -6 }),
  G("mt_born_killer", "ดาวสังหาร", "legendary", "หมอดูเห็นดวงแล้วไม่ยอมรับเงิน", { fight: 0.12, survival: 0.05, dark: 1 }),
  G("mt_blessed", "วาสนาบุญหนา", "legendary", "รอดมาได้ทุกครั้งแม้ไม่ควรรอด", { survival: 0.1, heal: 0.4, lifespan: 5 }, { luck: 10 }),
  // ───── ศักดิ์สิทธิ์ ─────
  G("mt_immortal_body", "ร่างเซียน", "divine", "ทารกที่ไม่ร้องไห้ ลมหายใจมีกลิ่นดอกบัว", { root: 2, qi: 0.2, break: 0.06, deviation: -0.6, lifespan: 20 }, { health: 10 }),
  // ───── ใหม่: ร่างพิเศษ · จิตและปัญญา · ดวงชะตา · ฝีมือช่างและวิชามาร (design/TALENTS.md) ─────
  G("mt_frail_body", "ร่างอ่อนแอ", "common", "ป่วยบ่อยตั้งแต่เกิด ลมปราณไหลเข้าแล้วรั่วออกเหมือนตะกร้าใส่น้ำ — แต่ร่างที่อ่อนแอที่สุดกลับรับพิษได้ดีที่สุด", { qi: -0.25, poison: 0.5, medicine: 0.1 }, { health: -8 }),
  G("mt_sword_bones", "กระดูกกระบี่", "rare", "นิ้วยาวตรงเหมือนด้ามกระบี่ จับไม้ไผ่ทีไรก็ตั้งท่าโดยไม่มีใครสอน", { learn: 0.12, fight: 0.06, break: 0.02 }),
  G("mt_photo_memory", "ความจำภาพถ่าย", "rare", "อ่านหน้ากระดาษครั้งเดียวจำได้ทุกตัวอักษร แม้กระทั่งรอยหมึกที่เลอะ", { learn: 0.25, info: 0.08 }, { smarts: 6 }),
  G("mt_lie_sense", "รู้ทันคำโกหก", "rare", "ได้ยินเสียงคนพูดเท็จเหมือนได้ยินเสียงสายพิณที่ตั้งผิด", { info: 0.25, work: 0.04 }),
  G("mt_strategist", "ใจนักวางแผน", "rare", "เล่นหมากล้อมชนะผู้ใหญ่ทั้งหมู่บ้านตั้งแต่เจ็ดขวบ", { work: 0.08, info: 0.1, income: 0.08 }, { smarts: 5 }),
  G("mt_lone_star", "ดาวโดดเดี่ยว", "rare", "หมอดูบอกว่าดวงนี้อยู่กลางฟ้าคนเดียว ใครเข้าใกล้มักจากไป — แต่ใจที่อยู่คนเดียวได้คือใจที่ทะลวงขั้นได้ง่ายที่สุด", { break: 0.07, deviation: -0.3, romance: -0.25 }),
  G("mt_alchemist", "มือปรุงโอสถ", "rare", "ต้มน้ำแกงธรรมดาก็มีกลิ่นยา ไฟในเตาเชื่อฟังมือคู่นี้", { medicine: 0.25, income: 0.08 }),
  G("mt_smith_hands", "มือช่างเทพ", "rare", "เคาะเหล็กครั้งเดียวรู้ว่ามีฟองอากาศอยู่ข้างใน", { work: 0.12, income: 0.12, fight: 0.02 }),
  G("mt_pure_yang", "ร่างหยางบริสุทธิ์", "legendary", "ตัวร้อนเหมือนเตาไฟตั้งแต่เกิด หิมะตกบนตัวแล้วละลายทันที — ลมปราณแรงดุจไฟป่า แต่ไฟก็เผาเจ้าของได้", { root: 1, qi: 0.28, fight: 0.05, deviation: 0.35, lifespan: -4 }),
  G("mt_dragon_aura", "ปราณมังกร", "legendary", "หมอดูหลวงเห็นเด็กคนนี้แล้วทำถ้วยชาตก — บนศีรษะมีไอสีทองที่มีแต่โอรสสวรรค์เท่านั้นที่มี", { fight: 0.03, survival: 0.05, income: 0.1 }, { looks: 4, luck: 6 }),
  G("mt_blood_demon", "ร่างโลหิตมาร", "legendary", "ทารกที่ร้องไห้ทุกครั้งที่เห็นเลือด — ไม่ใช่เพราะกลัว แต่เพราะหิว", { qi: 0.32, fight: 0.08, dark: 1, deviation: 0.2 }),
];

// ───────── ร่างที่วิวัฒน์แล้ว (ไม่สุ่มตอนเกิด — ได้จากการตื่นของพรสวรรค์เดิม: ทางสว่าง / ทางมืด) ─────────
const V = (id: string, name: string, rarity: Rarity, flavor: string, mx: Partial<Record<GiftKey, number>>): Talent => ({ ...G(id, name, rarity, flavor, mx), noRoll: true });
export const EVOLVED_TALENTS: Talent[] = [
  V("mt_good_bones_l", "กระดูกหยกขาว", "rare", "สิบปีของการฝึกกลั่นกระดูกธรรมดาให้ใสเหมือนหยก", { root: 2, learn: 0.2 }),
  V("mt_good_bones_d", "กระดูกเหล็กดำ", "rare", "ฝึกจนกระดูกแข็งเหมือนเหล็ก ไม่สนว่าใครจะเจ็บระหว่างทาง", { root: 1, fight: 0.08, survival: 0.04 }),
  V("mt_long_breath_l", "ลมหายใจเต่าพันปี", "rare", "หายใจหนึ่งครั้งเท่าคนธรรมดาสิบครั้ง ร่างกายแก่ช้าลง", { qi: 0.22, lifespan: 5 }),
  V("mt_long_breath_d", "ลมหายใจไร้เสียง", "rare", "ยืนข้างคนทั้งคืนโดยไม่มีใครรู้ว่าคุณอยู่ตรงนั้น", { qi: 0.12, info: 0.15, fight: 0.04 }),
  V("mt_quick_heal_l", "เนื้อหนังฟื้นคืน", "rare", "แผลที่ควรเป็นแผลเป็นกลับหายสนิทในหนึ่งเดือน", { heal: 1.2, survival: 0.04 }),
  V("mt_quick_heal_d", "ร่างไม่รู้เจ็บ", "rare", "ไม่รู้สึกเจ็บอีกแล้ว — สู้ต่อได้แม้กระดูกหัก จนกว่าร่างกายจะทนไม่ไหว", { survival: 0.09, fight: 0.05, heal: 0.4 }),
  V("mt_keen_ear_l", "หูทิพย์", "rare", "ได้ยินเสียงหัวใจของคนที่ยืนห่างสิบก้าว", { info: 0.35, survival: 0.03 }),
  V("mt_keen_ear_d", "สายลับโดยกำเนิด", "rare", "ทุกความลับที่ได้ยินมีราคา และคุณรู้ราคาทั้งหมด", { info: 0.25, income: 0.12 }),
  V("mt_steady_l", "ใจหินผา", "rare", "พายุพัดผ่านแต่หินไม่ขยับ — ลมปราณนิ่งจนทะลวงขั้นง่ายขึ้น", { deviation: -0.8, break: 0.04 }),
  V("mt_steady_d", "ใจเย็นชา", "rare", "ไม่หวั่นไหวกับอะไรอีก รวมถึงน้ำตาของคนที่รัก", { deviation: -0.6, fight: 0.05, romance: -0.2 }),
  V("mt_hard_worker_l", "มือทองคำ", "rare", "สิบปีของงานหนักทำให้ทุกอย่างที่แตะกลายเป็นงานชั้นครู", { work: 0.16, income: 0.22 }),
  V("mt_hard_worker_d", "ใจทาสเงิน", "rare", "ทำงานได้ไม่หยุด เพราะหยุดเมื่อไรใจจะว่าง และใจว่างคือสิ่งที่กลัวที่สุด", { work: 0.1, income: 0.4 }),
  V("mt_herb_nose_l", "จมูกเทวดาแห่งหุบเขายา", "rare", "ได้กลิ่นโรคก่อนคนป่วยจะรู้ตัว", { medicine: 0.3, poison: 0.5 }),
  V("mt_herb_nose_d", "จมูกนักปรุงพิษ", "rare", "รู้ว่าสมุนไพรไหนผสมกันแล้วไม่มีหมอคนไหนตรวจเจอ", { medicine: 0.15, poison: 0.6, fight: 0.04 }),
  V("mt_sweet_face_l", "รอยยิ้มล่มเมือง", "rare", "ยิ้มครั้งเดียว ทั้งโรงเตี๊ยมลืมว่ากำลังทะเลาะกันเรื่องอะไร", { romance: 0.35, info: 0.08 }),
  V("mt_sweet_face_d", "หน้ากากงาม", "rare", "รู้ว่าหน้าตานี้เปิดประตูบานไหนได้ และใช้มันทุกบาน", { romance: 0.2, info: 0.18, income: 0.08 }),
  V("mt_frail_body_l", "ร่างพิษเมตตา", "rare", "ร่างที่เคยอ่อนแอกลายเป็นยาแก้พิษเดินได้ — เลือดของคุณช่วยชีวิตคนถูกพิษ", { poison: 1, medicine: 0.25, qi: -0.1 }),
  V("mt_frail_body_d", "ร่างพิษสะสม", "rare", "พิษนับร้อยที่ร่างนี้ดูดไว้กลายเป็นอาวุธ", { poison: 1, fight: 0.08, qi: -0.05 }),
  V("mt_martial_eye_l", "ดวงตาส่องวิชา", "legendary", "มองเห็นรากของทุกกระบวนท่า — รู้ว่ามันเกิดจากอะไร และจะไปถึงไหน", { learn: 0.5, fight: 0.06 }),
  V("mt_martial_eye_d", "ดวงตาขโมยวิชา", "legendary", "เห็นครั้งเดียวก็เป็นของคุณ — ไม่ว่าเจ้าของจะยอมหรือไม่", { learn: 0.4, fight: 0.1 }),
  V("mt_dragon_bones_l", "กระดูกมังกรตื่น", "legendary", "มังกรที่หลับในกระดูกลืมตาแล้ว", { root: 2, break: 0.07, qi: 0.15 }),
  V("mt_dragon_bones_d", "กระดูกมังกรดำ", "legendary", "มังกรที่ตื่นในความแค้นกินลมปราณของคนรอบข้าง", { root: 2, qi: 0.22, fight: 0.05, dark: 1 }),
  V("mt_hundred_poison_l", "ร่างหมื่นพิษ", "legendary", "ไม่มีพิษใดในแผ่นดินทำอะไรคุณได้ และคุณรู้วิธีแก้ทุกพิษ", { poison: 1, medicine: 0.25, survival: 0.04 }),
  V("mt_hundred_poison_d", "ร่างอสรพิษ", "legendary", "เลือดของคุณกลายเป็นพิษ — ใครทำร้ายคุณจนเลือดกระเด็นโดนตัวจะไม่รอด", { poison: 1, fight: 0.1, romance: -0.3 }),
  V("mt_healer_hands_l", "หัตถ์เทวดา", "legendary", "คนป่วยที่หมอทั้งเมืองบอกว่าไม่รอด รอดเพราะมือคู่นี้", { medicine: 0.45, heal: 0.6 }),
  V("mt_healer_hands_d", "หัตถ์ยมทูต", "legendary", "มือที่รู้ทุกจุดที่ทำให้คนหายป่วย ก็รู้ทุกจุดที่ทำให้คนหยุดหายใจ", { medicine: 0.25, fight: 0.1 }),
  V("mt_born_fighter_l", "สายเลือดผู้พิทักษ์", "legendary", "ยิ่งมีคนอยู่ข้างหลัง ยิ่งล้มไม่ได้", { fight: 0.1, survival: 0.1 }),
  V("mt_born_fighter_d", "อสูรกระหายเลือด", "legendary", "เสียงดาบกระทบกันคือเสียงดนตรีเดียวที่ทำให้ใจสงบ", { fight: 0.17, deviation: 0.2, dark: 1 }),
  V("mt_merchant_blood_l", "เทพเจ้าโชคลาภ", "legendary", "ที่ไหนที่คุณเปิดร้าน ที่นั่นกลายเป็นตลาด", { income: 0.55, info: 0.08 }),
  V("mt_merchant_blood_d", "เจ้าพ่อเงินกู้", "legendary", "ครึ่งหนึ่งของคนในเมืองเป็นหนี้คุณ และอีกครึ่งกำลังจะเป็น", { income: 0.7, dark: 1 }),
  V("mt_peach_luck_l", "ดอกท้อบานสะพรั่ง", "legendary", "ความรักเดินมาหาเอง — และพายุแห่งความหึงหวงก็เดินตามมาด้วย", { romance: 0.55, survival: 0.03 }),
  V("mt_peach_luck_d", "ตัดดอกท้อ", "legendary", "ตัดใจจากรักทุกรูปแบบ แลกกับจิตที่ใสเหมือนน้ำในบ่อลึก", { break: 0.07, deviation: -0.4 }),
  V("mt_sword_bones_l", "กระดูกกระบี่เทพ", "legendary", "กระบี่กับร่างเป็นหนึ่งเดียว — ไม่ต้องคิดว่าจะฟันตรงไหน", { learn: 0.2, fight: 0.12, break: 0.04 }),
  V("mt_sword_bones_d", "กระดูกกระบี่โลหิต", "legendary", "กระบี่ของคุณกระหายเลือดเท่ากับเจ้าของ", { fight: 0.16, dark: 1 }),
  V("mt_photo_memory_l", "คลังตำราเดินได้", "legendary", "ทุกคัมภีร์ที่เคยเห็นอยู่ในหัว เรียงเป็นหอตำราที่ไม่มีวันไฟไหม้", { learn: 0.4, info: 0.12 }),
  V("mt_photo_memory_d", "ความจำต้องสาป", "legendary", "จำได้ทุกอย่าง — รวมถึงทุกความเจ็บที่อยากลืม และความแค้นที่ไม่มีวันจาง", { learn: 0.35, fight: 0.05 }),
  V("mt_lie_sense_l", "ตาเห็นใจคน", "legendary", "ไม่ต้องฟังคำพูด แค่มองตาก็รู้ว่าใครเป็นคนแบบไหน", { info: 0.4, work: 0.06 }),
  V("mt_lie_sense_d", "นักบงการ", "legendary", "รู้ว่าคนโกหกเพราะอะไร — และรู้ว่าต้องพูดอะไรให้เขาทำตามที่คุณต้องการ", { info: 0.3, income: 0.15 }),
  V("mt_strategist_l", "เทพกลยุทธ์", "legendary", "มองกระดานทั้งแผ่นดินเหมือนหมากล้อมหนึ่งกระดาน", { work: 0.14, info: 0.18, income: 0.1 }),
  V("mt_strategist_d", "ปีศาจกลอุบาย", "legendary", "ทุกคนคือหมาก รวมถึงคนที่เชื่อว่าเป็นเพื่อนคุณ", { info: 0.22, income: 0.18, dark: 1 }),
  V("mt_lone_star_l", "ดาวเดียวกลางฟ้า", "legendary", "ยอมรับความโดดเดี่ยวจนมันกลายเป็นพลัง — ไม่มีอะไรรบกวนลมปราณได้อีก", { break: 0.12, deviation: -0.6, qi: 0.1 }),
  V("mt_lone_star_d", "ดาวที่หาเพื่อนเจอ", "legendary", "คำสาปแตกเมื่อมีคนหนึ่งยืนข้างคุณได้นานพอ — ดาวเดียวกลายเป็นดาวคู่", { break: 0.05, romance: 0.1, survival: 0.04 }),
  V("mt_alchemist_l", "เซียนโอสถ", "legendary", "ยาเม็ดเดียวจากมือนี้มีค่าเท่าหมู่บ้านหนึ่ง", { medicine: 0.45, income: 0.2 }),
  V("mt_alchemist_d", "เจ้าพิษ", "legendary", "โอสถกับยาพิษต่างกันแค่ปริมาณ — และคุณรู้ปริมาณทั้งหมด", { medicine: 0.3, fight: 0.08, poison: 0.6 }),
  V("mt_smith_hands_l", "มือหลอมกระบี่เทพ", "legendary", "กระบี่ที่ตีด้วยมือนี้มีชื่อ และมีวิญญาณ", { work: 0.2, income: 0.25, fight: 0.04 }),
  V("mt_smith_hands_d", "มือหลอมอาวุธมาร", "legendary", "อาวุธที่ออกจากเตาของคุณดื่มเลือดเจ้าของก่อนจะดื่มเลือดศัตรู", { work: 0.12, income: 0.3, fight: 0.08, dark: 1 }),
  V("mt_heaven_bones_l", "กระดูกเซียนยุทธ์", "divine", "พันปีจะมีสักคน — และคนคนนั้นคือคุณ", { root: 3, qi: 0.22, learn: 0.28, break: 0.08 }),
  V("mt_heaven_bones_d", "กระดูกมารยุทธ์", "divine", "กระดูกที่ฟ้าประทานถูกหลอมด้วยความแค้นจนกลายเป็นของมาร", { root: 3, qi: 0.3, fight: 0.1, dark: 1 }),
  V("mt_nine_yin_l", "ร่างเก้าหยินสมบูรณ์", "divine", "ความเย็นที่เคยกัดกินร่างกลายเป็นของคุณทั้งหมด", { root: 2, qi: 0.4, deviation: -0.2, lifespan: 4 }),
  V("mt_nine_yin_d", "ร่างหยินมาร", "divine", "ความเย็นในร่างดูดลมปราณของคนที่แตะตัวคุณ", { root: 2, qi: 0.5, fight: 0.06, dark: 1, lifespan: -2 }),
  V("mt_pure_yang_l", "ร่างหยางสุริยะ", "divine", "ไฟในร่างสงบลงเป็นแสงอาทิตย์ อุ่นแต่ไม่เผา", { root: 2, qi: 0.35, fight: 0.06, deviation: -0.1 }),
  V("mt_pure_yang_d", "ร่างเพลิงมาร", "divine", "ไฟในร่างไม่ต้องการความสงบอีกแล้ว — ต้องการเชื้อเพลิง", { root: 2, qi: 0.42, fight: 0.12, deviation: 0.4, dark: 1 }),
  V("mt_born_killer_l", "ดาวสังหารพิทักษ์", "divine", "ดาวสังหารยังอยู่ แต่เลือกเองว่าจะสังหารใคร — เฉพาะคนที่สมควร", { fight: 0.14, survival: 0.07 }),
  V("mt_born_killer_d", "ดาวมรณะ", "divine", "ดาวสังหารลุกโชนเต็มที่ — ที่ไหนที่คุณไป ที่นั่นมีศพ", { fight: 0.22, survival: 0.06, dark: 2 }),
  V("mt_blessed_l", "บุญบารมีฟ้าประทาน", "divine", "บุญที่ทำมาทั้งชีวิตย้อนกลับมาเป็นเกราะ", { survival: 0.14, heal: 0.6, lifespan: 8 }),
  V("mt_blessed_d", "โชคชิงชีวิต", "divine", "โชคของคุณไม่ได้มาจากฟ้า — มันมาจากคนรอบข้างที่โชคร้ายแทน", { survival: 0.18, heal: 0.5, lifespan: 6, dark: 1 }),
  V("mt_dragon_aura_l", "โอรสสวรรค์", "divine", "ไอสีทองเหนือศีรษะสว่างจนคนแปลกหน้าคุกเข่าโดยไม่รู้ตัว", { survival: 0.08, income: 0.15, fight: 0.04 }),
  V("mt_dragon_aura_d", "มังกรซ่อนกาย", "divine", "ซ่อนไอมังกรไว้ใต้เสื้อผ้าคนธรรมดา — ไม่มีใครเห็น จนกว่าคุณจะอยากให้เห็น", { survival: 0.1, info: 0.15 }),
  V("mt_blood_demon_l", "ร่างโลหิตชำระ", "divine", "เลือดที่เคยกระหายถูกชำระด้วยศีล — ตอนนี้เลือดของคุณรักษาคนได้", { qi: 0.3, heal: 0.8, medicine: 0.2 }),
  V("mt_blood_demon_d", "จอมมารโลหิต", "divine", "หยุดฝืนแล้ว — ยิ่งฆ่า ยิ่งแข็งแกร่ง", { qi: 0.45, fight: 0.15, dark: 2, deviation: 0.25 }),
  V("mt_immortal_body_l", "ร่างเซียนตื่น", "mythic", "ฟ้าผ่าเก้าครั้งไม่อาจทำลาย — ร่างนี้ใกล้เซียนกว่ามนุษย์", { root: 3, qi: 0.3, break: 0.1, deviation: -0.8, lifespan: 30 }),
  V("mt_immortal_body_d", "ร่างเซียนตกสวรรค์", "mythic", "เซียนที่ปฏิเสธสวรรค์ — พลังทั้งหมดอยู่บนโลกนี้", { root: 3, qi: 0.4, fight: 0.12, lifespan: 15 }),
];
TALENTS.push(...EVOLVED_TALENTS);

/** พรสวรรค์ที่ประสานกัน: ซ่อนไว้ เกิดฉากพิเศษครั้งแรกที่ทั้งคู่เปิดเผย แล้วได้ผลเพิ่ม (l.flags combo:<id>) */
export interface Combo { id: string; name: string; a: string; b: string; mx: Partial<Record<GiftKey, number>>; scene: string }
const base = (id: string) => id.replace(/_[ld]$/, "");
export const COMBOS: Combo[] = [
  { id: "cb_copy", name: "ลอกกระบวนท่ากลางศึก", a: "mt_martial_eye", b: "mt_born_fighter", mx: { fight: 0.06, learn: 0.1 }, scene: "กลางการต่อสู้ ดวงตาของคุณจับท่าของศัตรูได้ แล้วร่างกายที่ไม่เคยถอยก็ฟันท่านั้นกลับไปก่อนเขาจะทันรู้ตัว — ศัตรูเห็นกระบวนท่าของตัวเองแทงเข้าอก" },
  { id: "cb_yinyang", name: "หยินหยางในร่างเดียว", a: "mt_nine_yin", b: "mt_pure_yang", mx: { qi: 0.3, deviation: -1, lifespan: 10 }, scene: "คืนหนึ่งความเย็นกับความร้อนในร่างคุณปะทะกันจนเหงื่อเป็นน้ำแข็งแล้วระเหยเป็นไอ — รุ่งเช้าทั้งสองไหลวนเป็นวงกลมเดียวกัน ราคาของทั้งสองร่างหายไปพร้อมกัน" },
  { id: "cb_divine_doc", name: "หมอเทวดาโดยกำเนิด", a: "mt_herb_nose", b: "mt_healer_hands", mx: { medicine: 0.2, heal: 0.3 }, scene: "คุณแตะชีพจรคนไข้พร้อมได้กลิ่นลมหายใจ — รู้ทั้งโรค ทั้งยา ทั้งปริมาณ ในลมหายใจเดียว หมอแก่ข้างๆ วางพู่กันลงช้าๆ" },
  { id: "cb_poison_pill", name: "ร่างกับเตายาเป็นหนึ่ง", a: "mt_hundred_poison", b: "mt_alchemist", mx: { medicine: 0.2, poison: 0.5, income: 0.1 }, scene: "คุณชิมยาพิษทุกขนานที่ปรุงด้วยลิ้นตัวเอง — ร่างที่ไม่ตายเพราะพิษทำให้คุณกล้าปรุงสิ่งที่ไม่มีใครกล้า" },
  { id: "cb_one_read", name: "อ่านคัมภีร์ครั้งเดียว", a: "mt_photo_memory", b: "mt_martial_eye", mx: { learn: 0.3 }, scene: "คัมภีร์ที่ศิษย์ทั้งสำนักอ่านกันสิบปี คุณพลิกจบในหนึ่งก้านธูป — แล้วรำออกมาได้ครบทุกท่าตั้งแต่ครั้งแรก" },
  { id: "cb_destiny", name: "ชะตาบัลลังก์", a: "mt_dragon_aura", b: "mt_heaven_bones", mx: { survival: 0.08, fight: 0.05 }, scene: "นักพรตชราคุกเข่าลงกลางตลาดเมื่อคุณเดินผ่าน \"กระดูกเทพกับไอมังกรในร่างเดียว — แผ่นดินจะเปลี่ยนมือในชั่วชีวิตนี้\" ข่าวนี้ไปถึงวังหลวงก่อนพระอาทิตย์ตก" },
  { id: "cb_doom", name: "ดาวหายนะคู่", a: "mt_lone_star", b: "mt_born_killer", mx: { break: 0.1, fight: 0.08 }, scene: "สองดาวร้ายในดวงเดียว — คนรอบตัวหลีกทางให้โดยไม่รู้ตัว คุณอยู่คนเดียวบนยอดเขา และลมปราณไม่เคยนิ่งเท่านี้" },
  { id: "cb_city_fall", name: "งามล่มเมือง", a: "mt_sweet_face", b: "mt_peach_luck", mx: { romance: 0.3, info: 0.1 }, scene: "สองตระกูลใหญ่ยกพวกตีกันกลางสะพานเพราะคุณยิ้มให้คนผิดคน — คนทั้งเมืองเล่าเรื่องนี้ไปอีกสามปี" },
  { id: "cb_mind_trade", name: "พ่อค้าอ่านใจ", a: "mt_merchant_blood", b: "mt_lie_sense", mx: { income: 0.25 }, scene: "ทุกการต่อรองคุณรู้ราคาที่อีกฝ่ายยอมจ่ายจริงก่อนเขาจะเปิดปาก — พ่อค้าทั้งตลาดเริ่มเรียกคุณว่าปีศาจลูกคิด" },
  { id: "cb_own_blade", name: "กระบี่ที่ตีเพื่อตัวเอง", a: "mt_smith_hands", b: "mt_sword_bones", mx: { fight: 0.09 }, scene: "คุณตีกระบี่ให้มือตัวเองเป็นครั้งแรก — มันพอดีกับนิ้วยาวตรงของคุณเหมือนงอกออกมาจากกระดูก" },
  { id: "cb_war_ear", name: "ได้ยินแผนข้าศึก", a: "mt_strategist", b: "mt_keen_ear", mx: { info: 0.2, work: 0.06 }, scene: "เสียงกระซิบในค่ายข้าศึกที่ลมพัดมา คุณต่อเป็นแผนทั้งแผนได้ก่อนรุ่งเช้า" },
  { id: "cb_shielded_star", name: "ดาวสังหารที่ฟ้าคุ้ม", a: "mt_blessed", b: "mt_born_killer", mx: { survival: 0.06 }, scene: "หมอดูคนเดิมที่เคยไม่รับเงินตอนคุณเกิด มาขอดูดวงอีกครั้ง แล้วหัวเราะ \"บุญหนาพอจะกดดาวสังหารไว้ได้ — คนรอบตัวท่านปลอดภัยแล้ว\"" },
];
/** พรสวรรค์ (รวมร่างที่วิวัฒน์แล้ว) ที่เปิดเผยแล้วมีรากเดียวกับ id นี้ไหม */
export const hasGiftBase = (l: Life, id: string) => l.talents.some((t) => t.revealed && base(t.id) === id);
export const comboOn = (l: Life, c: Combo) => !!l.flags[`combo:${c.id}`];
TALENTS.push(...MURIM_TALENTS);

/** พรสวรรค์ทั่วไปที่เข้ากับยุทธภพ (ผลจริงอยู่ในระบบกลาง) — ตัวละครยุทธภพสุ่มได้ */
export const MURIM_GENERIC_TALENTS = new Set(["sturdy", "memory", "cute", "optimist", "sweettalk", "diligent", "genius", "charm", "lucky", "merchant", "heaven_child", "protagonist_face", "tragic_genius", "golden_spoon"]);

/** พรสวรรค์จากโลกอื่น/ชุดเก่า → พรสวรรค์ยุทธภพที่ใกล้เคียงที่สุด */
const CONVERT: Record<string, string> = {
  mana_heart: "mt_dragon_bones", late_bloomer: "mt_steady", dragon_blood: "mt_heaven_bones", cursed_body: "mt_nine_yin", system_user: "mt_immortal_body",
  athlete: "mt_born_fighter", natural_athlete: "mt_born_fighter", battle_sense: "mt_born_fighter", quick_heal: "mt_quick_heal", second_wind: "mt_quick_heal",
  healers_touch: "mt_healer_hands", money_nose: "mt_merchant_blood", number_mind: "mt_merchant_blood", bargainer: "mt_hard_worker", workhorse: "mt_hard_worker",
  fast_learner: "mt_good_bones", strong_grip: "mt_good_bones", mimic: "mt_martial_eye", photographic: "mt_martial_eye", sharp_eyes: "mt_keen_ear", danger_sense: "mt_keen_ear",
  nose: "mt_herb_nose", iron_stomach: "mt_herb_nose", calm_mind: "mt_steady", patient: "mt_steady", iron_will: "mt_steady", light_feet: "mt_long_breath", early_bird: "mt_long_breath",
  star_aura: "mt_peach_luck", photogenic: "mt_sweet_face", dimples: "mt_sweet_face", warm_smile: "mt_sweet_face",
};
const hash = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

/**
 * เซฟเก่า: แปลงพรสวรรค์ที่ไม่มีผลในยุทธภพเป็นพรสวรรค์ยุทธภพที่ใกล้เคียง (ความหายากเท่าเดิม)
 * ไม่บวกค่าสถานะซ้ำ (ของเดิมบวกไปแล้วตอนเปิดเผย) · ช่องลับยังเป็นช่องลับ · คืนจำนวนที่แปลง
 */
export function convertOldTalents(l: Life): number {
  if (l.worldId !== "murim") return 0;
  let n = 0;
  const names: string[] = [];
  for (const t of l.talents) {
    const old = TALENTS.find((x) => x.id === t.id);
    if (!old || old.world === "murim" || MURIM_GENERIC_TALENTS.has(t.id)) continue;
    const taken = new Set(l.talents.map((x) => x.id));
    let to = CONVERT[t.id];
    if (!to || taken.has(to)) {
      const same = MURIM_TALENTS.filter((x) => x.rarity === old.rarity && !taken.has(x.id));
      const pool = same.length ? same : MURIM_TALENTS.filter((x) => !taken.has(x.id));
      if (!pool.length) continue;
      to = pool[hash(t.id) % pool.length].id;
    }
    if (t.revealed) names.push(`「${old.name}」→「${MURIM_TALENTS.find((x) => x.id === to)!.name}」`);
    t.id = to;
    n++;
  }
  if (names.length) l.log.push({ age: l.age, text: `พรสวรรค์ของคุณถูกตีความตามโลกยุทธภพ: ${names.join(" · ")}`, kind: "good" });
  return n;
}
