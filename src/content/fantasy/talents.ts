// พรสวรรค์ของโลกแฟนตาซีเท่านั้น · ทุกอย่างผูกกับระบบของโลกนี้ (เวท ดาบ มังกร ชะตา ชื่อเสียงรายแผ่นดิน)
// ส่วนที่แตะข้อมูลตัวละครแฟนตาซี (ft) แยกไว้ใน FT_PART เพราะพรสวรรค์ธรรมดาเปิดตอนเกิดก่อนข้อมูลนี้ถูกสร้าง
import type { Talent } from "../talents";
import type { Life, StatKey } from "../../engine/types";
import { SPELLS } from "./magic";
import { addStanding, fl } from "./state";
import { addStars } from "./stars";

const atLeast = (l: Life, track: "body" | "magic", n: number) => { const f = fl(l); if (track === "body") f.bstars = Math.max(f.bstars ?? 0, n); else f.potential = Math.max(f.potential, n); };

const add = (l: Life, k: StatKey, v: number) => { l.stats[k] = Math.max(0, Math.min(100, l.stats[k] + v)); };
const gold = (l: Life, g: number) => { l.money += g * 100; };
const learnOwn = (l: Life, tier: number) => {
  const f = fl(l), s = SPELLS.find((x) => x.element === f.element && x.tier === tier);
  if (s && !f.spells?.includes(s.id)) f.spells = [...(f.spells ?? []), s.id];
};

/** ผลต่อข้อมูลตัวละครแฟนตาซี · เรียกตอนพรสวรรค์เปิด และซ้ำตอนสร้างตัวละคร/ทายาทเพื่อไม่ให้หาย */
export const FT_PART: Record<string, (l: Life) => void> = {
  ft_stout: (l) => { fl(l).body += 15; },
  ft_bookworm: (l) => { fl(l).magic += 15; },
  ft_animal: (l) => { fl(l).dragonBond += 5; },
  ft_wanderer: (l) => { addStanding(l, 5); },
  ft_blade: (l) => { fl(l).body += 40; },
  ft_mana: (l) => addStars(l, "magic", 2),
  ft_warblood: (l) => addStars(l, "body", 2),
  ft_mana_spark: (l) => addStars(l, "magic", 1),
  ft_fighter_spark: (l) => addStars(l, "body", 1),
  ft_titan_seed: (l) => atLeast(l, "body", 9),
  ft_elemental: (l) => { learnOwn(l, 1); },
  ft_runesight: (l) => { const f = fl(l); f.rune = Math.max(1, f.rune ?? 0); },
  ft_silvertongue: (l) => { addStanding(l, 15); },
  ft_beastspeak: (l) => { fl(l).dragonBond += 12; },
  ft_quickstudy: (l) => { const f = fl(l); f.body += 25; f.magic += 25; },
  ft_moonborn: (l) => { const f = fl(l); f.lifeBonus = (f.lifeBonus ?? 0) + 5; },
  ft_dragonblood: (l) => { fl(l).dragonBond += 20; },
  ft_archmage_seed: (l) => atLeast(l, "magic", 9),
  ft_sword_saint: (l) => { fl(l).body += 120; },
  ft_relic_called: (l) => { const f = fl(l); f.clues.dawnchoice = (f.clues.dawnchoice ?? 0) + 2; },
  ft_starborn: (l) => { const f = fl(l); f.lifeBonus = (f.lifeBonus ?? 0) + 25; },
  ft_crowned: (l) => { addStanding(l, 25); },
  ft_godspark: (l) => { const f = fl(l); addStars(l, "body", 2); addStars(l, "magic", 2); f.body += 80; f.magic += 80; f.lifeBonus = (f.lifeBonus ?? 0) + 20; },
  ft_dragonsoul: (l) => { const f = fl(l); f.dragonBond += 40; f.dragonblood = true; },
  ft_twice_fated: (l) => { fl(l).threads += 2; },
  ft_oracle: (l) => { const f = fl(l); f.mKnown = [...new Set([...(f.mKnown ?? []), "sunken", "undying"])]; },
  ft_chosen: (l) => { const f = fl(l); atLeast(l, "body", 9); atLeast(l, "magic", 9); f.body += 100; f.magic += 100; learnOwn(l, 1); },
  ft_world_heart: (l) => { const f = fl(l); f.lifeBonus = (f.lifeBonus ?? 0) + 50; f.dragonBond += 25; },
};

const T = (id: string, name: string, rarity: Talent["rarity"], desc: string, stats?: (l: Life) => void): Talent => ({
  id, name, rarity, desc, world: "fantasy",
  apply: (l) => { stats?.(l); if (l.ft) FT_PART[id]?.(l); },
});

export const FANTASY_TALENTS: Talent[] = [
  // ธรรมดา
  T("ft_strong", "กำลังวังชา", "common", "ร่างกายแข็งแรงกว่าเด็กทั่วไป — สุขภาพ +6", (l) => add(l, "health", 6)),
  T("ft_clever", "หัวไว", "common", "จำอะไรได้เร็ว — สติปัญญา +6", (l) => add(l, "smarts", 6)),
  T("ft_charm", "เสน่ห์ติดตัว", "common", "ใครเห็นก็เอ็นดู — รูปลักษณ์ +6", (l) => add(l, "looks", 6)),
  T("ft_lucky", "ดาวนำโชค", "common", "เรื่องร้ายมักพลาดคุณไปนิดเดียว — โชค +6", (l) => add(l, "luck", 6)),
  T("ft_stout", "กระดูกแกร่ง", "common", "ล้มแล้วลุกได้เสมอ — สุขภาพ +4 และพลังกายตั้งต้นสูงขึ้น", (l) => add(l, "health", 4)),
  T("ft_bookworm", "หนอนตำรา", "common", "อ่านคัมภีร์ได้ตั้งแต่ยังไม่หย่านม — สติปัญญา +4 และพลังเวทตั้งต้นสูงขึ้น", (l) => add(l, "smarts", 4)),
  T("ft_fighter_spark", "แววนักสู้", "common", "ชนะทุกการปล้ำในหมู่บ้าน — ดาวกาย +1"),
  T("ft_mana_spark", "ประกายมานา", "common", "ผมของคุณชี้ฟูทุกครั้งที่ฟ้าร้อง — ดาวเวท +1"),
  T("ft_cheerful", "ยิ้มง่าย", "common", "แดดออกเสมอในใจคุณ — ความสุข +8", (l) => add(l, "happiness", 8)),
  T("ft_thrifty", "รู้ค่าเหรียญ", "common", "เหรียญทองไม่เคยหลุดมือคุณ — เริ่มด้วยเงิน 30 เหรียญทอง", (l) => gold(l, 30)),
  T("ft_animal", "คู่หูสัตว์", "common", "สัตว์ทุกตัวเดินมาหาคุณเอง — ความสุข +3 และมังกรระแวงคุณน้อยลง", (l) => add(l, "happiness", 3)),
  T("ft_wanderer", "เท้าไม่อยู่สุข", "common", "ทุกถนนพาคุณไปเจอเรื่องดีๆ — โชค +3 และชาวเมืองรู้จักคุณ", (l) => add(l, "luck", 3)),
  // หายาก
  T("ft_blade", "สัมผัสดาบ", "rare", "ถือดาบเป็นตั้งแต่ครั้งแรก — เริ่มสายดาบเร็วกว่าคนอื่นมาก"),
  T("ft_mana", "มานาล้นตัว", "rare", "พลังเวทแต่กำเนิดสูงกว่าที่ควร — ดาวเวท +2"),
  T("ft_warblood", "เลือดนักรบ", "rare", "บรรพบุรุษเป็นนักรบทุกรุ่น — ดาวกาย +2"),
  T("ft_elemental", "ธาตุเข้าตัว", "rare", "ธาตุของคุณตื่นก่อนที่คุณจะรู้ตัว — รู้เวทขั้นแรกของธาตุตัวเองติดตัว"),
  T("ft_runesight", "ตาเห็นรูน", "rare", "มองเห็นอักษรรูนที่คนอื่นมองไม่เห็น — ศาสตร์อักษรรูนขั้นแรกติดตัว"),
  T("ft_silvertongue", "วาทศิลป์", "rare", "พูดอะไรคนก็เชื่อ — รูปลักษณ์ +5 และชื่อเสียงในแผ่นดินบ้านเกิดสูงขึ้นมาก", (l) => add(l, "looks", 5)),
  T("ft_beastspeak", "ภาษาสัตว์", "rare", "เข้าใจเสียงสัตว์ทุกชนิด — มังกรทุกตัวเปิดใจให้คุณง่ายขึ้น"),
  T("ft_noble_blood", "เลือดขุนนาง", "rare", "ทวดของคุณเคยเป็นท่านลอร์ด — มรดกลับ 200 เหรียญทอง", (l) => gold(l, 200)),
  T("ft_quickstudy", "เรียนไว", "rare", "ทุกสิ่งที่ฝึกเข้าหัวเร็วกว่าคนอื่น — พลังกายและพลังเวทตั้งต้นสูงขึ้น"),
  T("ft_moonborn", "เกิดใต้จันทร์เต็มดวง", "rare", "ดวงจันทร์คอยดูแลคุณ — โชค +8 และอายุยืนขึ้น 5 ปี", (l) => add(l, "luck", 8)),
  T("ft_wardheart", "ใจแกร่ง", "rare", "ไม่มีคำสาปไหนเจาะใจคุณได้ — สุขภาพ +8 ความสุข +4", (l) => { add(l, "health", 8); add(l, "happiness", 4); }),
  // ตำนาน
  T("ft_dragonblood", "เลือดมังกร", "legendary", "บรรพบุรุษคนหนึ่งไม่ใช่มนุษย์ — ทนไฟ และมังกรมองคุณต่างออกไป", (l) => add(l, "health", 8)),
  T("ft_fate_thread", "ด้ายชะตา", "legendary", "ด้ายสีเงินผูกข้อมือคุณมาตั้งแต่เกิด — ย้อนชะตาได้สองครั้งทุกวัย"),
  T("ft_archmage_seed", "เมล็ดมหาจอมเวท", "legendary", "เวทในตัวคุณไม่มีเพดาน — ดาวเวทอย่างน้อยเก้าดวง"),
  T("ft_titan_seed", "เมล็ดไททัน", "legendary", "เลือดยักษ์โบราณหลับอยู่ในกระดูกคุณ — ดาวกายอย่างน้อยเก้าดวง"),
  T("ft_sword_saint", "ดาบเกิดคู่กาย", "legendary", "มือคุณจำท่าดาบที่ไม่เคยเรียน — สายดาบไปไกลกว่าคนทั้งรุ่น"),
  T("ft_relic_called", "อาวุธเรียกหา", "legendary", "ดาบสุริยันฝันถึงคุณ — เบาะแสตามหามันสองชิ้นติดตัว"),
  T("ft_starborn", "บุตรแห่งดวงดาว", "legendary", "ดาวตกตกลงในคืนที่คุณเกิด — โชค +10 และอายุยืนขึ้น 25 ปี", (l) => add(l, "luck", 10)),
  T("ft_crowned", "ชะตาสวมมงกุฎ", "legendary", "หมอดูทุกคนเห็นมงกุฎบนหัวคุณ — ผู้คนในแผ่นดินบ้านเกิดนับถือคุณตั้งแต่เด็ก"),
  // ศักดิ์สิทธิ์
  T("ft_godspark", "ประกายเทพ", "divine", "เทพองค์หนึ่งแตะหน้าผากคุณตอนเกิด — ดาวกายและดาวเวท +2 กาย เวท และอายุขัยเหนือมนุษย์"),
  T("ft_dragonsoul", "วิญญาณมังกร", "divine", "วิญญาณของมังกรโบราณมาเกิดเป็นคุณ — เลือดมังกรในตัว และมังกรทุกตัวนับเป็นญาติ", (l) => add(l, "health", 10)),
  T("ft_twice_fated", "สองชะตา", "divine", "ชะตาของคุณถูกเขียนไว้สองฉบับ — ด้ายชะตาเพิ่มสองเส้น"),
  T("ft_oracle", "ตาพยากรณ์", "divine", "ฝันของคุณคือสิ่งที่ยังไม่เกิด — สติปัญญา +12 และรู้ปริศนาสองเรื่องตั้งแต่เกิด", (l) => add(l, "smarts", 12)),
  // หนึ่งเดียวในโลก
  T("ft_chosen", "ผู้ถูกเลือกแห่งยุค", "mythic", "ทุกคำพยากรณ์ในพันปีชี้มาที่คุณ — ดาวกายและดาวเวทอย่างน้อยเก้าดวง กายและเวทล้ำทุกคน", (l) => add(l, "luck", 15)),
  T("ft_world_heart", "หัวใจของโลก", "mythic", "โลกทั้งใบเต้นตามจังหวะหัวใจคุณ — ค่าพลังทุกอย่าง +10 และอายุยืนขึ้น 50 ปี", (l) => { for (const k of ["health", "happiness", "smarts", "looks", "luck"] as StatKey[]) add(l, k, 10); }),
];

/** ให้ผลของพรสวรรค์ที่เปิดแล้วกับข้อมูลแฟนตาซีที่เพิ่งสร้าง (ตอนเกิด หรือเมื่อทายาทเริ่มชีวิตใหม่) */
export function applyFtTalents(l: Life) {
  for (const t of l.talents) if (t.revealed) FT_PART[t.id]?.(l);
}
