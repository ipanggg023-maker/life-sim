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
];
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
