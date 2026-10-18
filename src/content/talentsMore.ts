// พรสวรรค์ชุดใหญ่ (M24) — ผลเขียนเป็นข้อมูล แล้วสร้างคำอธิบายจากผลจริงอัตโนมัติ
// ห้าม import engine/util (util → passives → talents → ไฟล์นี้)
import type { Life, Rarity, StatKey } from "../engine/types";

export interface TalentFx {
  /** ค่าสถานะเพิ่มตอนเปิดเผย */
  s?: Partial<Record<StatKey, number>>;
  /** ค่าสถานะเพิ่มทุกปี */
  y?: Partial<Record<StatKey, number>>;
  /** โบนัสการเช็กค่าสถานะ */
  c?: Partial<Record<StatKey, number>>;
  survival?: number;
  cp?: number;
  exp?: number;
  money?: number;
  /** แรงก์ตอนตื่นพลัง (สายพลัง) */
  rank?: number;
}

export interface TalentDef extends TalentFx {
  id: string;
  name: string;
  rarity: Rarity;
  desc: string;
  power?: boolean;
  apply?: (life: Life) => void;
}

const LABEL: Record<StatKey, string> = { health: "สุขภาพ", happiness: "ความสุข", smarts: "สติปัญญา", looks: "รูปลักษณ์", luck: "โชค" };
const sign = (v: number) => (v >= 0 ? `+${v}` : `${v}`);
const pct = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;

/** ข้อความสรุปผลของพรสวรรค์ (ใช้ทั้งชุดใหม่และแสดงผล) */
export function fxText(f: TalentFx): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(f.s ?? {})) out.push(`${LABEL[k as StatKey]} ${sign(v)}`);
  for (const [k, v] of Object.entries(f.y ?? {})) out.push(`${LABEL[k as StatKey]} ${sign(v)}/ปี`);
  for (const [k, v] of Object.entries(f.c ?? {})) out.push(`เช็ก${LABEL[k as StatKey]} ${pct(v)}`);
  if (f.survival) out.push(`โอกาสรอด ${pct(f.survival)}`);
  if (f.cp) out.push(`พลังต่อสู้ ${sign(f.cp)}`);
  if (f.exp) out.push(`EXP ${pct(f.exp)}`);
  if (f.money) out.push(`รายได้ ${pct(f.money)}`);
  if (f.rank) out.push(`แรงก์ตอนตื่นพลัง ${sign(f.rank)}`);
  return out.join(" · ");
}

function T(id: string, name: string, rarity: Rarity, flavor: string, fx: TalentFx, extra: { power?: boolean; apply?: (l: Life) => void } = {}): TalentDef {
  return { id, name, rarity, desc: `${flavor} — ${fxText(fx)}`, ...fx, ...extra };
}

export const MORE_TALENTS: TalentDef[] = [
  // ───────── ธรรมดา ─────────
  T("early_bird", "ตื่นเช้าโดยธรรมชาติ", "common", "ตื่นตีห้าโดยไม่ต้องตั้งนาฬิกา", { s: { health: 6 }, y: { health: 1 } }),
  T("night_owl", "นกฮูกยามดึก", "common", "สมองแล่นที่สุดตอนตีสอง", { s: { smarts: 7 }, c: { smarts: 0.03 } }),
  T("big_eater", "กินเก่งไม่อ้วน", "common", "ระบบเผาผลาญที่ใครก็อิจฉา", { s: { health: 8, happiness: 3 } }),
  T("dimples", "ลักยิ้มสองข้าง", "common", "ยิ้มทีโลกละลาย", { s: { looks: 8 }, c: { looks: 0.03 } }),
  T("good_voice", "เสียงดี", "common", "ร้องเพลงในห้องน้ำแล้วข้างบ้านปรบมือ", { s: { looks: 5, happiness: 4 } }),
  T("green_thumb", "มือปลูกอะไรก็ขึ้น", "common", "ต้นไม้ที่ตายแล้วยังฟื้นในมือคุณ", { y: { happiness: 1 }, s: { luck: 4 } }),
  T("animal_friend", "สัตว์รัก", "common", "หมาแมวทั้งซอยเดินตาม", { s: { happiness: 8 } }),
  T("thick_skin", "หน้าหนา", "common", "คำวิจารณ์เด้งออกไปหมด", { s: { happiness: 6 }, c: { happiness: 0.04 } }),
  T("fast_learner", "หัวไว", "common", "สอนครั้งเดียวจำได้", { s: { smarts: 6 }, exp: 0.05 }),
  T("sharp_eyes", "ตาไว", "common", "เห็นเหรียญตกพื้นจากระยะสิบเมตร", { c: { luck: 0.04 }, s: { luck: 4 } }),
  T("good_sleeper", "หลับง่าย", "common", "หัวถึงหมอนปุ๊บหลับปั๊บ", { y: { health: 1 } }),
  T("bargainer", "นักต่อราคา", "common", "แม่ค้าทั้งตลาดกลัว", { money: 0.05 }),
  T("steady_hands", "มือนิ่ง", "common", "ร้อยเข็มได้ตอนรถไฟวิ่ง", { c: { smarts: 0.03, health: 0.03 } }),
  T("calm_mind", "ใจเย็น", "common", "ไม่เคยตะโกนใส่ใคร", { y: { happiness: 1 }, c: { happiness: 0.03 } }),
  T("funny", "ตลกโดยไม่ตั้งใจ", "common", "พูดอะไรคนก็ขำ", { s: { happiness: 6, looks: 3 } }),
  T("tall", "ตัวสูง", "common", "หยิบของบนชั้นบนสุดได้เสมอ", { s: { looks: 6, health: 4 } }),
  T("iron_stomach", "กระเพาะเหล็ก", "common", "กินอะไรก็ไม่เคยท้องเสีย", { s: { health: 8 }, survival: 0.01 }),
  T("polyglot_ear", "หูภาษา", "common", "ได้ยินสำเนียงไหนก็เลียนแบบได้", { s: { smarts: 5 }, c: { smarts: 0.02 } }),
  T("tidy", "รักความสะอาด", "common", "ห้องเป็นระเบียบตั้งแต่ห้าขวบ", { s: { health: 4, smarts: 3 } }),
  T("brave_kid", "ใจกล้า", "common", "ไม่เคยกลัวความมืดเลยสักครั้ง", { survival: 0.02, s: { happiness: 3 } }),
  T("stubborn", "ดื้อตาใส", "common", "ถ้าตั้งใจแล้วไม่มีใครเปลี่ยนได้", { c: { health: 0.03 }, exp: 0.03 }),
  T("sweet_tooth", "ปากหวานชอบขนม", "common", "รู้จักร้านขนมทุกร้านในเมือง", { y: { happiness: 1 }, s: { health: -3 } }),
  T("daydreamer", "ช่างฝัน", "common", "เพ้อฝันได้ทั้งวัน", { s: { happiness: 5, smarts: 3 } }),
  T("handy", "ช่างซ่อม", "common", "ซ่อมได้ทุกอย่างที่มีน็อต", { s: { smarts: 5 }, money: 0.03 }),
  T("light_feet", "ฝีเท้าเบา", "common", "เดินไม่มีเสียง", { c: { luck: 0.03 }, survival: 0.01 }),
  T("photogenic", "ถ่ายรูปขึ้น", "common", "กล้องรักคุณ", { s: { looks: 7 } }),
  T("homebody", "ติดบ้าน", "common", "บ้านคือที่ที่ดีที่สุด", { y: { happiness: 1 }, s: { health: 2 } }),
  T("eager", "กระตือรือร้น", "common", "ยกมือก่อนครูถามจบ", { exp: 0.05, s: { smarts: 3 } }),
  T("patient", "อดทน", "common", "รอคิวสามชั่วโมงได้แบบยิ้มๆ", { c: { happiness: 0.03 }, s: { health: 3 } }),
  T("mimic", "เลียนแบบเก่ง", "common", "ดูครั้งเดียวทำตามได้", { exp: 0.04, c: { looks: 0.02 } }),
  T("strong_grip", "มือหนัก", "common", "เปิดฝาโหลได้ทุกฝา", { s: { health: 5 }, cp: 1 }),
  T("nose", "จมูกดี", "common", "ได้กลิ่นอันตรายก่อนใคร", { survival: 0.02 }),
  T("thrifty", "ประหยัดเก่ง", "common", "เงินเหลือทุกสิ้นเดือน", { money: 0.04, s: { smarts: 2 } }),
  T("warm_smile", "ยิ้มอบอุ่น", "common", "คนแปลกหน้าชอบเล่าเรื่องให้ฟัง", { c: { looks: 0.03 }, y: { happiness: 1 } }),
  T("clumsy_lucky", "ซุ่มซ่ามแต่ดวงดี", "common", "ล้มทุกวันแต่ไม่เคยเจ็บ", { s: { luck: 8, health: -2 } }),
  T("note_taker", "จดทุกอย่าง", "common", "สมุดโน้ตเต็มทุกเล่ม", { c: { smarts: 0.04 } }),
  T("rhythm", "จังหวะดี", "common", "เต้นได้ทุกเพลง", { s: { looks: 4, happiness: 4 } }),
  T("cold_resist", "ทนหนาว", "common", "ใส่เสื้อแขนสั้นกลางหิมะ", { s: { health: 6 }, survival: 0.01 }),

  // ───────── หายาก ─────────
  T("silver_tongue", "ลิ้นทองคำ", "rare", "พูดให้คนเชื่อได้ทุกเรื่อง", { c: { smarts: 0.05, looks: 0.05 }, money: 0.05 }),
  T("photographic", "ความจำภาพถ่าย", "rare", "เห็นครั้งเดียวจำได้ทุกตัวอักษร", { s: { smarts: 18 }, c: { smarts: 0.05 } }),
  T("natural_athlete", "นักกีฬาโดยกำเนิด", "rare", "วิ่งเร็วกว่าเด็กทั้งโรงเรียน", { s: { health: 15 }, c: { health: 0.05 } }),
  T("perfect_pitch", "หูเพอร์เฟกต์พิตช์", "rare", "ได้ยินโน้ตผิดแม้แค่ครึ่งเสียง", { s: { looks: 10, happiness: 8 } }),
  T("money_nose", "จมูกเงิน", "rare", "ได้กลิ่นโอกาสทางธุรกิจ", { money: 0.15, c: { luck: 0.03 } }),
  T("iron_will", "จิตใจเหล็ก", "rare", "ไม่เคยยอมแพ้อะไรเลย", { c: { happiness: 0.06, health: 0.04 }, survival: 0.03 }),
  T("star_aura", "รัศมีดารา", "rare", "เดินเข้าห้องแล้วทุกคนหันมามอง", { s: { looks: 15 }, c: { looks: 0.05 } }),
  T("healers_touch", "สัมผัสเยียวยา", "rare", "จับมือใครแล้วเขารู้สึกดีขึ้น", { y: { health: 1, happiness: 1 }, s: { health: 6 } }),
  T("battle_sense", "สัมผัสการต่อสู้", "rare", "ร่างกายขยับก่อนสมองสั่ง", { cp: 4, survival: 0.03 }),
  T("quick_heal", "แผลหายเร็ว", "rare", "แผลถลอกหายในวันเดียว", { y: { health: 2 }, survival: 0.02 }),
  T("born_leader", "ผู้นำโดยกำเนิด", "rare", "พูดแล้วคนฟัง", { c: { looks: 0.04, smarts: 0.04 }, money: 0.08 }),
  T("gamblers_luck", "ดวงนักพนัน", "rare", "ไพ่มักเข้าข้างคุณ", { s: { luck: 15 }, c: { luck: 0.05 } }),
  T("scholar_blood", "สายเลือดนักปราชญ์", "rare", "ตระกูลนี้มีแต่นักวิชาการ", { s: { smarts: 15 }, exp: 0.08 }),
  T("evergreen", "หน้าเด็ก", "rare", "อายุสี่สิบยังโดนขอบัตรประชาชน", { s: { looks: 12 }, y: { looks: 1 } }),
  T("sunshine", "ดวงอาทิตย์เดินได้", "rare", "อยู่ใกล้แล้วทุกคนอารมณ์ดี", { y: { happiness: 2 }, s: { happiness: 10 } }),
  T("danger_sense", "สัมผัสอันตราย", "rare", "ขนลุกทุกครั้งก่อนเรื่องร้าย", { survival: 0.05 }),
  T("workhorse", "ม้างาน", "rare", "ทำงานสามคนในคนเดียว", { money: 0.12, s: { health: 5 } }),
  T("strategist", "นักวางแผน", "rare", "มองเห็นสามตาข้างหน้าเสมอ", { c: { smarts: 0.06 }, cp: 2 }),
  T("artist_soul", "วิญญาณศิลปิน", "rare", "โลกนี้สวยกว่าในสายตาคุณ", { s: { happiness: 10, looks: 6 }, c: { looks: 0.03 } }),
  T("trust_magnet", "คนน่าไว้ใจ", "rare", "แปลกหน้าแค่ไหนก็กล้าฝากของ", { c: { looks: 0.04, happiness: 0.04 } }),
  T("second_wind", "ลมหายใจที่สอง", "rare", "ยิ่งเหนื่อยยิ่งแรง", { survival: 0.04, c: { health: 0.04 } }),
  T("number_mind", "หัวตัวเลข", "rare", "คิดเลขห้าหลักในใจ", { s: { smarts: 12 }, money: 0.06 }),
  T("unshakable", "ไม่หวั่นไหว", "rare", "ใจนิ่งแม้ฟ้าถล่ม", { y: { happiness: 1 }, survival: 0.03 }),
  T("charisma", "บารมี", "rare", "คนยอมตามโดยไม่รู้ตัว", { s: { looks: 10 }, money: 0.06, c: { looks: 0.03 } }),
  T("long_life", "อายุยืน", "rare", "ทั้งตระกูลอยู่เกินร้อยปี", { s: { health: 12 }, y: { health: 1 } }),
  T("wanderlust", "หัวใจนักเดินทาง", "rare", "ไปไหนก็เจอเรื่องดีๆ", { s: { luck: 10, happiness: 6 } }),
  T("cook_god", "มือเทวดาในครัว", "rare", "ข้าวผัดธรรมดากลายเป็นอาหารชั้นเลิศ", { y: { happiness: 1 }, money: 0.06, s: { health: 4 } }),
  T("speed_reader", "อ่านเร็ว", "rare", "หนังสือเล่มหนาจบในบ่ายเดียว", { exp: 0.1, s: { smarts: 8 } }),
  T("clutch", "ยิ่งกดดันยิ่งเก่ง", "rare", "ช่วงวิกฤตคือเวทีของคุณ", { c: { luck: 0.04, smarts: 0.04, health: 0.04 } }),
  T("beast_tamer_soul", "ใจสัตว์ป่า", "rare", "สัตว์ดุร้ายยังยอมให้ลูบหัว", { survival: 0.03, s: { happiness: 6 } }),
  // สายพลัง (ช่องลับ)
  T("mana_veins", "เส้นมานากว้าง", "rare", "พลังไหลเวียนดีกว่าคนทั่วไป", { rank: 1, exp: 0.08 }, { power: true }),
  T("battle_born", "เกิดมาเพื่อสู้", "rare", "ร่างกายถูกออกแบบมาเพื่อการต่อสู้", { rank: 1, cp: 4 }, { power: true }),
  T("spirit_eyes", "ดวงตาวิญญาณ", "rare", "มองเห็นสิ่งที่คนอื่นมองไม่เห็น", { rank: 1, survival: 0.04 }, { power: true }),

  // ───────── ตำนาน ─────────
  T("prodigy", "อัจฉริยะร้อยปีมีหนึ่ง", "legendary", "ครูทุกคนบอกว่าไม่เคยเจอเด็กแบบนี้", { s: { smarts: 30 }, exp: 0.2, c: { smarts: 0.08 } }),
  T("idol_aura", "ออร่าซูเปอร์สตาร์", "legendary", "ทั้งประเทศจำหน้าคุณได้", { s: { looks: 30, happiness: 10 }, c: { looks: 0.1 } }),
  T("midas", "มือแตะเป็นทอง", "legendary", "ลงทุนอะไรก็ขึ้น", { money: 0.35, s: { luck: 15 } }),
  T("unkillable", "ฆ่าไม่ตาย", "legendary", "รอดจากเรื่องที่ไม่มีใครรอด", { survival: 0.1, s: { health: 15 } }),
  T("fortune_favored", "สวรรค์เข้าข้าง", "legendary", "เรื่องบังเอิญดีๆ เกิดขึ้นตลอด", { s: { luck: 35 }, c: { luck: 0.1 } }),
  T("vitality", "พลังชีวิตล้นเหลือ", "legendary", "ไม่เคยป่วยเลยสักครั้ง", { s: { health: 30 }, y: { health: 2 } }),
  T("joy_incarnate", "ความสุขเดินได้", "legendary", "หัวเราะได้ทุกสถานการณ์", { s: { happiness: 30 }, y: { happiness: 3 } }),
  T("mastermind", "จอมวางแผน", "legendary", "ทุกอย่างเป็นไปตามแผนของคุณ", { s: { smarts: 25 }, c: { smarts: 0.1, luck: 0.05 } }),
  T("living_legend", "ตำนานมีชีวิต", "legendary", "เรื่องของคุณถูกเล่าต่อตั้งแต่ยังเด็ก", { s: { looks: 15, smarts: 15 }, money: 0.15, exp: 0.1 }),
  T("war_god_body", "ร่างเทพสงคราม", "legendary", "กล้ามเนื้อทุกมัดคืออาวุธ", { s: { health: 25 }, cp: 8, survival: 0.05 }),
  T("heart_reader", "อ่านใจคน", "legendary", "รู้ว่าใครโกหกตั้งแต่คำแรก", { c: { smarts: 0.08, looks: 0.08, happiness: 0.05 } }),
  T("phoenix_soul", "วิญญาณฟีนิกซ์", "legendary", "ล้มแล้วลุกขึ้นแรงกว่าเดิมทุกครั้ง", { survival: 0.08, y: { health: 2, happiness: 1 } }),
  T("timeless_beauty", "ความงามไร้กาลเวลา", "legendary", "แก่แค่ไหนก็ยังงาม", { s: { looks: 25 }, y: { looks: 2 } }),
  T("golden_luck", "ดวงทอง", "legendary", "ลอตเตอรี่ยังเคยถูกสองงวดติด", { s: { luck: 30 }, money: 0.15 }),
  // สายพลัง
  T("star_core", "แกนดาวในหัวใจ", "legendary", "มีแสงบางอย่างเต้นอยู่ในอก", { rank: 2, exp: 0.15 }, { power: true }),
  T("ancient_blood", "สายเลือดโบราณ", "legendary", "บรรพบุรุษเคยเป็นวีรบุรุษในตำนาน", { rank: 2, cp: 6, survival: 0.04 }, { power: true }),
  T("calamity_body", "ร่างภัยพิบัติ", "legendary", "พลังมหาศาลที่ร่างกายแทบรับไม่ไหว", { rank: 3, s: { health: -20 }, cp: 6 }, { power: true }),
  T("sword_heart", "หัวใจกระบี่", "legendary", "จับอาวุธครั้งแรกเหมือนจับมาทั้งชีวิต", { rank: 2, cp: 8 }, { power: true }),

  // ───────── ศักดิ์สิทธิ์ ─────────
  T("heavens_favorite", "บุตรสวรรค์", "divine", "ฟ้ามองคุณด้วยรอยยิ้ม", { s: { luck: 40, happiness: 20 }, c: { luck: 0.12 }, survival: 0.06 }),
  T("sage_mind", "สติปัญญาของปราชญ์", "divine", "เข้าใจสิ่งที่คนอื่นใช้ทั้งชีวิตเพื่อเรียนรู้", { s: { smarts: 45 }, exp: 0.3, c: { smarts: 0.12 } }),
  T("divine_beauty", "งามเกินมนุษย์", "divine", "ภาพวาดของคุณถูกแขวนในวิหาร", { s: { looks: 45 }, c: { looks: 0.15 }, y: { happiness: 2 } }),
  T("dragon_fortune", "โชคมังกร", "divine", "ทรัพย์สินไหลเข้ามาเองเหมือนแม่น้ำ", { money: 0.5, s: { luck: 25 } }, { apply: (l) => { if (l.wealth === "poor") l.wealth = "middle"; } }),
  T("blessed_body", "กายศักดิ์สิทธิ์", "divine", "โรคภัยไม่กล้าเข้าใกล้", { s: { health: 40 }, y: { health: 3 }, survival: 0.08 }),
  // สายพลัง
  T("monarch_seed", "เมล็ดพันธุ์ราชันย์", "divine", "วันหนึ่งคุณจะยืนเหนือทุกคน", { rank: 3, cp: 10, exp: 0.25 }, { power: true }),
  T("void_walker", "ผู้เดินในความว่างเปล่า", "divine", "หายตัวไปจากอันตรายได้เสมอ", { rank: 3, survival: 0.12 }, { power: true }),

  // ───────── หนึ่งเดียวในโลก (ยากที่สุด) ─────────
  T("world_chosen", "ผู้ที่โลกเลือก", "mythic", "ทั้งโลกมีได้เพียงคนเดียวในรอบพันปี", { s: { health: 20, happiness: 20, smarts: 20, looks: 20, luck: 20 }, survival: 0.1, money: 0.25, exp: 0.25 }),
  T("eternal_youth", "ร่างไม่ร่วงโรย", "mythic", "เวลาเดินผ่านคุณไปโดยไม่ทิ้งร่องรอย", { s: { health: 40, looks: 25 }, y: { health: 4, looks: 2 }, survival: 0.1 }),
  T("boundless_mind", "ปัญญาไร้ขอบเขต", "mythic", "คุณเข้าใจโลกทั้งใบตั้งแต่อายุสิบขวบ", { s: { smarts: 70 }, c: { smarts: 0.2 }, exp: 0.5 }),
  T("fortune_avatar", "เทพแห่งโชคกลับชาติมาเกิด", "mythic", "เหรียญโยนกี่ครั้งก็ออกด้านที่คุณต้องการ", { s: { luck: 70 }, c: { luck: 0.2 }, money: 0.5 }),
  T("worlds_beloved", "หัวใจที่โลกรัก", "mythic", "ไม่มีใครในโลกที่เกลียดคุณได้", { s: { looks: 50, happiness: 30 }, y: { happiness: 4 }, c: { looks: 0.2 } }),
  // สายพลัง
  T("destined_sovereign", "ราชันย์ผู้ถูกลิขิต", "mythic", "ชะตาเขียนไว้ตั้งแต่ก่อนคุณเกิดว่าจะยืนบนจุดสูงสุด", { rank: 4, cp: 15, survival: 0.1, exp: 0.3 }, { power: true }),
  T("twin_souls", "สองวิญญาณในร่างเดียว", "mythic", "อีกวิญญาณหนึ่งกระซิบสิ่งที่คุณไม่ควรรู้", { rank: 3, exp: 0.5, c: { smarts: 0.1, luck: 0.1, health: 0.1 } }, { power: true }),
];
