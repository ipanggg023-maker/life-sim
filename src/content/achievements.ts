import type { Life, Soul } from "../engine/types";
import { hasTalent, people } from "../engine/util";

export type AchCategory = "life" | "power" | "social" | "hunter" | "murim" | "court" | "tower" | "apocalypse" | "ordinary";

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  points: number;
  check: (life: Life) => boolean;
  /** หมวด (ไม่ใส่ = ชีวิต) */
  cat?: AchCategory;
  /** ซ่อนชื่อและเงื่อนไขจนกว่าจะได้ */
  hidden?: boolean;
}

export const ACH_CATEGORY: Record<AchCategory, string> = {
  life: "🌱 ชีวิต",
  power: "⚡ พลังและชะตา",
  social: "📱 สังคมและครอบครัว",
  hunter: "🌀 โลก Hunter",
  murim: "⛰️ ยุทธภพ",
  court: "👑 ราชสำนัก",
  tower: "🗼 หอคอย",
  apocalypse: "☄️ วันสิ้นโลก",
  ordinary: "🏙️ โลกธรรมดา",
};

const n = (l: Life, k: string) => Number(l.flags[k] ?? 0);
const list = (l: Life, k: string) => String(l.flags[k] ?? "").split(",").filter(Boolean);

export const ACHIEVEMENTS: Achievement[] = [
  { id: "elder", name: "อายุยืน", desc: "มีชีวิตถึง 90 ปี", points: 20, check: (l) => l.age >= 90 },
  { id: "young", name: "ดอกไม้ร่วงก่อนบาน", desc: "ตายก่อนอายุ 18", points: 5, check: (l) => l.age < 18 },
  { id: "awakened", name: "ผู้ตื่นพลัง", desc: "ตื่นพลังได้สำเร็จ", points: 5, check: (l) => !!l.power },
  { id: "rank_a", name: "ชนชั้นสูงสุดของประเทศ", desc: "ไปถึงแรงก์ A", points: 15, check: (l) => (l.power?.rank ?? -1) >= 5 },
  { id: "rank_s", name: "อาวุธแห่งชาติ", desc: "ไปถึงแรงก์ S", points: 30, check: (l) => (l.power?.rank ?? -1) >= 6 },
  { id: "rank_sss", name: "เหนือมนุษย์", desc: "ไปถึงแรงก์ SSS", points: 80, check: (l) => (l.power?.rank ?? -1) >= 8 },
  { id: "rich", name: "เศรษฐีร้อยล้าน", desc: "มีทรัพย์สินสุทธิ 100 ล้าน", points: 15, check: (l) => l.money - l.debt >= 100_000_000 },
  { id: "billion", name: "มหาเศรษฐีพันล้าน", desc: "มีทรัพย์สินสุทธิ 1,000 ล้าน", points: 30, check: (l) => l.money - l.debt >= 1_000_000_000 },
  { id: "family", name: "ครอบครัวใหญ่", desc: "มีลูก 3 คนขึ้นไป", points: 10, check: (l) => people(l, "child", false).length >= 3 },
  { id: "hero", name: "วีรบุรุษของชาติ", desc: "ชื่อเสียงถึง 80", points: 20, check: (l) => l.fame >= 80 },
  { id: "doctor", name: "หมอประจำบ้าน", desc: "จบแพทยศาสตร์", points: 8, check: (l) => l.education.degree === "med" },
  { id: "gate_death", name: "ไม่ได้กลับออกมา", desc: "ตายใน Gate", points: 5, check: (l) => /Gate|ดันเจี้ยน/.test(l.causeOfDeath ?? "") },
  { id: "jackpot", name: "ดวงเฮงเกินมนุษย์", desc: "ถูกรางวัลที่ 1", points: 10, check: (l) => !!l.flags.jackpot },
  { id: "regressor", name: "ผู้ย้อนเวลา", desc: "ย้อนเวลาครั้งแรก", points: 10, check: (l) => (l.regressions ?? 0) >= 1 },
  { id: "saved_all", name: "เปลี่ยนชะตา", desc: "ปกป้องครอบครัวให้รอดจากมหันตภัยกรุงเทพฯ", points: 25, check: (l) => !!l.flags.savedFamily },
  { id: "system", name: "ผู้เล่นคนเดียว", desc: "เปิดพรสวรรค์หน้าต่างระบบส่วนตัว", points: 15, check: (l) => hasTalent(l, "system_user") },
  { id: "fate_defied", name: "หักชะตาตัวร้าย", desc: "รอดพ้นวันประหารตามบทนิยาย", points: 25, check: (l) => !!l.flags.fateDefied },
  { id: "crowned", name: "สวมมงกุฎ", desc: "ได้ครองบัลลังก์คู่กับราชวงศ์", points: 30, check: (l) => !!l.flags.crowned },
  { id: "saint", name: "นักบุญแห่งยุค", desc: "ได้รับตำแหน่งผู้สมัครนักบุญ", points: 15, check: (l) => !!l.flags.saint },
  { id: "extra_hero", name: "ตัวประกอบผู้เปลี่ยนบท", desc: "ตัวประกอบที่รอดจากเทศกาลดอกไม้", points: 10, check: (l) => !!l.flags.extraSurvived },
  { id: "ascended", name: "เซียนเหาะ", desc: "เหาะขึ้นสวรรค์ในยุทธภพ", points: 60, check: (l) => !!l.flags.ascended },
  { id: "champion", name: "ยอดฝีมือแห่งยุค", desc: "ชนะชุมนุมประลองยุทธ์", points: 20, check: (l) => Number(l.flags.champion ?? 0) > 0 },
  { id: "legacy", name: "ทายาทของตัวเอง", desc: "เกิดใหม่ในตระกูลที่ตัวเองสร้าง", points: 15, check: (l) => !!l.flags.descendant },

  // ── M22: ชีวิต ──
  { id: "century", name: "ร้อยปียังแจ๋ว", desc: "มีชีวิตถึง 100 ปี", points: 30, check: (l) => l.age >= 100 },
  { id: "poor_to_rich", name: "เกิดจน ตายรวย", desc: "เกิดในครอบครัวยากจน แล้วมีทรัพย์สิน 100 ล้าน", points: 25, check: (l) => l.wealth === "poor" && l.money - l.debt >= 100_000_000 },
  { id: "debt", name: "หนี้ท่วมหัว", desc: "มีหนี้เกิน 10 ล้าน", points: 5, check: (l) => l.debt >= 10_000_000 },
  { id: "lone_wolf", name: "หมาป่าเดียวดาย", desc: "อายุ 70 โดยไม่เคยแต่งงาน", points: 8, check: (l) => l.age >= 70 && !l.people.some((p) => p.relation === "spouse") },
  { id: "forever", name: "รักนิรันดร์", desc: "อายุ 80 โดยมีคู่ชีวิตที่ผูกพัน 90 ขึ้นไป", points: 20, check: (l) => l.age >= 80 && l.people.some((p) => p.alive && p.relation === "spouse" && p.bond >= 90) },
  { id: "dynasty", name: "ตระกูลสามรุ่น", desc: "เล่นต่อเป็นลูกหลานจนถึงรุ่นที่ 3", points: 25, check: (l) => n(l, "generation") >= 3 },
  { id: "passives8", name: "ชีวิตที่ช่ำชอง", desc: "มีสกิลติดตัว 8 อย่างในชีวิตเดียว", points: 20, check: (l) => list(l, "passives").length >= 8 },
  { id: "titles5", name: "นักสะสมฉายา", desc: "ได้ฉายา 5 แบบในชีวิตเดียว", points: 15, check: (l) => list(l, "titlesSeen").length >= 5 },
  { id: "near_death", name: "ไม่ยอมตาย", desc: "รอดชีวิตจากภาวะใกล้ตาย", points: 8, check: (l) => !!l.flags.nearDeath },
  { id: "soul_travel", name: "วิญญาณข้ามโลก", desc: "จำชาติก่อนที่อยู่ต่างโลกได้", points: 15, check: (l) => !!l.flags.pastRemembered },

  // ── M22: พลังและชะตา ──
  { id: "dual", name: "สองสาย", cat: "power", desc: "ได้พลังสายที่สอง", points: 20, check: (l) => !!l.flags.subClass },
  { id: "mastery10", name: "ปรมาจารย์สกิล", cat: "power", desc: "ความชำนาญสกิลใดก็ได้ถึง Lv.10", points: 20, check: (l) => Object.values(l.power?.mastery ?? {}).some((u) => u >= 18) || Object.keys(l.flags).some((k) => k.startsWith("mastery_") && n(l, k) >= 18) },
  { id: "sss_birth", name: "อัจฉริยะแต่กำเนิด", cat: "power", desc: "ได้ระดับสูงสุดตั้งแต่วันตื่นพลัง", points: 40, hidden: true, check: (l) => !!l.flags.sssAwakened },
  { id: "late_hero", name: "ช้าแต่ชัวร์", cat: "power", desc: "ตื่นพลังช้ากว่าคนอื่นแต่ไปถึงระดับ S", points: 30, check: (l) => !!l.flags.lateBloom && (l.power?.rank ?? 0) >= 6 },
  { id: "secret_quests", name: "นักล่าภารกิจลับ", cat: "power", desc: "ทำภารกิจลับสำเร็จ 5 ครั้ง", points: 20, check: (l) => n(l, "sqDone") >= 5 },
  { id: "sponsored", name: "มีดาวหนุนหลัง", cat: "power", desc: "ได้รับการสนับสนุนจากดวงดาว", points: 10, check: (l) => !!l.flags.sponsor && l.flags.sponsor !== "none" },
  { id: "nemesis_friend", name: "จากศัตรูสู่เพื่อน", cat: "power", desc: "คู่ปรับกลายเป็นเพื่อน", points: 15, check: (l) => l.flags.nemesisStage === "friend" },
  { id: "nemesis_end", name: "ปิดบัญชีคู่ปรับ", cat: "power", desc: "ชนะการต่อสู้ครั้งสุดท้ายกับคู่ปรับ", points: 20, check: (l) => !!l.flags.nemesisBeaten },
  { id: "other_regressor", name: "เราไม่ได้ย้อนเวลาคนเดียว", cat: "power", desc: "พบผู้ย้อนเวลาอีกคน", points: 15, hidden: true, check: (l) => (l.seen["nemesis.regressor"] ?? 0) > 0 },
  { id: "pact", name: "สัญญากับปีศาจ", cat: "power", desc: "ทำสัญญาแลกอายุขัยกับพลัง", points: 10, hidden: true, check: (l) => !!l.flags.pact },

  // ── M22: สังคมและครอบครัว ──
  { id: "ig_100k", name: "อินฟลูเอนเซอร์", cat: "social", desc: "ผู้ติดตาม IG 100K", points: 15, check: (l) => (l.phone?.ig ?? 0) >= 100_000 },
  { id: "ig_1m", name: "คนดังโลกโซเชียล", cat: "social", desc: "ผู้ติดตาม IG 1 ล้าน", points: 30, check: (l) => (l.phone?.ig ?? 0) >= 1_000_000 },
  { id: "yt_100k", name: "โล่เงิน", cat: "social", desc: "ซับ YouTube 100K", points: 15, check: (l) => (l.phone?.yt ?? 0) >= 100_000 },
  { id: "yt_1m", name: "โล่ทอง", cat: "social", desc: "ซับ YouTube 1 ล้าน", points: 30, check: (l) => (l.phone?.yt ?? 0) >= 1_000_000 },
  { id: "investor", name: "เซียนหุ้น", cat: "social", desc: "พอร์ตหุ้นมีมูลค่า 50 ล้าน", points: 20, check: (l) => (l.phone?.portfolio ?? 0) >= 50_000_000 },
  { id: "party3", name: "ทีมในฝัน", cat: "social", desc: "มีเพื่อนร่วมทีม 3 คนพร้อมกัน", points: 10, check: (l) => l.people.filter((p) => p.alive && p.relation === "ally").length >= 3 },
  { id: "big_family", name: "บ้านแตก (เพราะคนเยอะ)", cat: "social", desc: "มีลูก 6 คนขึ้นไป", points: 15, check: (l) => people(l, "child", false).length >= 6 },
  { id: "infamous", name: "ชื่อเสียงติดลบ", cat: "social", desc: "ชื่อเสียงต่ำกว่า -50", points: 10, hidden: true, check: (l) => l.fame <= -50 },

  // ── M22: โลก Hunter ──
  { id: "h_boss50", name: "นักล่าบอสร้อยศพ", cat: "hunter", desc: "ล้มบอส 50 ตัว", points: 20, check: (l) => l.worldId === "hunter" && (l.power?.bossKills ?? 0) >= 50 },
  { id: "h_gate100", name: "ร้อยประตู", cat: "hunter", desc: "เคลียร์ Gate 100 แห่ง", points: 20, check: (l) => l.worldId === "hunter" && (l.power?.gates ?? 0) >= 100 },
  { id: "h_red", name: "ผู้รอดจากเกตแดง", cat: "hunter", desc: "รอดจาก Red Gate", points: 15, check: (l) => !!l.flags.redGateSurvivor },
  { id: "h_mundane", name: "คนธรรมดาในโลก Hunter", cat: "hunter", desc: "ไม่ตื่นพลังแต่มีทรัพย์สิน 50 ล้าน", points: 20, check: (l) => l.worldId === "hunter" && !l.power && l.age >= 30 && l.money - l.debt >= 50_000_000 },

  // ── M22: ยุทธภพ ──
  { id: "m_demon_lord", name: "จอมมาร", cat: "murim", desc: "ฝึกวิชามารจนถึงขั้นเหนือธรรมชาติ", points: 25, check: (l) => l.power?.hunterClass === "m_demon" && (l.power?.rank ?? 0) >= 7 },
  { id: "m_manual", name: "ผู้เขียนคัมภีร์", cat: "murim", desc: "เขียนคัมภีร์ของตัวเองไว้ให้คนรุ่นหลัง", points: 15, check: (l) => !!l.flags.wroteManual },
  { id: "m_hidden_master", name: "ศิษย์ของปรมาจารย์ลับ", cat: "murim", desc: "ได้เป็นศิษย์ของชายแก่ในโรงเตี๊ยม", points: 15, hidden: true, check: (l) => !!l.flags.hiddenMaster },
  { id: "m_disciple", name: "อาจารย์", cat: "murim", desc: "รับศิษย์คนแรกในยุทธภพ", points: 10, check: (l) => l.worldId === "murim" && l.people.some((p) => /ศิษย์/.test(p.job ?? "")) },

  // ── M22: ราชสำนัก ──
  { id: "c_aca_top", name: "อันดับหนึ่งของสถาบัน", cat: "court", desc: "จบการศึกษาอันดับหนึ่งจากสถาบันจักรวรรดิ", points: 25, check: (l) => !!l.flags.acaTop },
  { id: "c_house_cup", name: "ถ้วยประจำหอ", cat: "court", desc: "พาหอคว้าถ้วยประจำหอ", points: 10, check: (l) => !!l.flags.houseCup },
  { id: "c_ch3", name: "ตัวประกอบที่ไม่ยอมตาย", cat: "court", desc: "รอดจากบทที่ 3 ที่ควรตาย", points: 20, check: (l) => !!l.flags.ch3Escaped },
  { id: "c_dragon", name: "ผู้ปราบมังกร", cat: "court", desc: "ปราบมังกรแดงบนยอดเขา", points: 30, hidden: true, check: (l) => (l.seen["c2.a.dragon"] ?? 0) > 0 && l.fame >= 30 && (l.power?.rank ?? 0) >= 4 },

  // ── M22: หอคอย ──
  { id: "t_half", name: "ครึ่งทางสู่ยอด", cat: "tower", desc: "ปีนถึงชั้น 50", points: 20, check: (l) => n(l, "floor") >= 50 },
  { id: "t_top", name: "ผู้ยืนบนยอดหอคอย", cat: "tower", desc: "ปีนถึงชั้น 100", points: 60, check: (l) => !!l.flags.towerTop },
  { id: "t_refuse", name: "ปฏิเสธคำเชิญ", cat: "tower", desc: "ปฏิเสธคำเชิญจากหอคอย", points: 5, check: (l) => !!l.flags.refusedTower },
  { id: "t_secret", name: "ชั้นลับ", cat: "tower", desc: "ค้นพบชั้นลับของหอคอย", points: 15, hidden: true, check: (l) => !!l.flags.secretFloor },

  // ── M22: วันสิ้นโลก ──
  { id: "a_hero", name: "ผู้ปิดฉากสุดท้าย", cat: "apocalypse", desc: "จบฉากภารกิจหลัก #8 ด้วยมือตัวเอง", points: 60, check: (l) => !!l.flags.apocHero },
  { id: "a_survive", name: "รอดถึงวันฟ้าใส", cat: "apocalypse", desc: "มีชีวิตอยู่จนโลกฟื้นตัว", points: 25, check: (l) => !!l.flags.doomed && !!l.flags.rebuilt },
  { id: "a_warn", name: "ผู้เตือนภัย", cat: "apocalypse", desc: "รู้วันสิ้นโลกล่วงหน้าจากชาติก่อน", points: 15, check: (l) => !!l.flags.knowsDoom },
  { id: "a_reader", name: "ผู้อ่านคนสุดท้าย", cat: "apocalypse", desc: "อ่านนิยายที่ไม่มีใครอ่านจนจบ", points: 15, hidden: true, check: (l) => !!l.flags.readNovel },

  // ── M22: โลกธรรมดา ──
  { id: "o_lv30", name: "ผู้ใช้ระบบขั้นสูง", cat: "ordinary", desc: "เลเวลระบบชีวิตถึง 30", points: 25, check: (l) => (l.sys?.level ?? 0) >= 30 },
  { id: "o_limit", name: "ขีดจำกัดมนุษย์", cat: "ordinary", desc: "ค่าสถานะใดก็ได้ถึง 100", points: 25, check: (l) => !!l.sys && ["str", "agi", "sta", "int", "cha", "luk"].some((k) => (l.sys as unknown as Record<string, number>)[k] >= 100) },
  { id: "o_no_system", name: "ไม่มีระบบก็ดังได้", cat: "ordinary", desc: "ไม่เคยได้ระบบ แต่ชื่อเสียงถึง 50", points: 25, check: (l) => l.worldId === "ordinary" && !l.sys && l.fame >= 50 },
];

/** หมวดของความสำเร็จ */
export const catOf = (a: Achievement): AchCategory => a.cat ?? "life";

/** ความสำเร็จที่ทำได้ในชีวิตนี้ (ใช้แจ้งเตือนระหว่างเล่น — ยังไม่ได้แต้มจนกว่าจะจบชีวิต) */
export const achievedNow = (life: Life) => ACHIEVEMENTS.filter((a) => a.check(life));

/** แต้มวิญญาณจากชีวิตหนึ่ง (ยังไม่รวมความสำเร็จ) */
export function lifePoints(life: Life): number {
  const net = life.money - life.debt;
  const wealth = net > 0 ? Math.log10(net) * 1.5 : 0;
  const rank = life.power ? (life.power.rank + 1) * 4 : 0;
  const kids = people(life, "child", false).length * 2;
  const married = life.people.some((p) => p.relation === "spouse") ? 4 : 0;
  return Math.max(1, Math.round(life.age / 4 + Math.max(0, life.fame) / 5 + wealth + rank + kids + married));
}

/** ความสำเร็จใหม่ที่ชีวิตนี้ปลดล็อก (ยังไม่เคยได้มาก่อน) */
export function newAchievements(life: Life, soul: Soul): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !soul.achievements.includes(a.id) && a.check(life));
}
