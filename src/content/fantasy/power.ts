// พลังสองสาย: ร่างกายกับเวทมนตร์ · ไม่มีพลังแต่กำเนิดก็ใช้คทาได้ แต่ไปได้ไม่ไกลเท่าคนมีพรสวรรค์
import type { Life } from "../../engine/types";
import { clamp } from "../../engine/util";
import { fl, myRelic } from "./state";
import { styleBonus } from "./styles";

export const BODY_RANKS = ["สามัญชน", "นักสู้", "นักดาบ", "ยอดนักดาบ", "ปรมาจารย์ดาบ"];
export const MAGIC_RANKS = ["ผู้ไร้เวท", "ผู้ฝึกเวท", "นักเวท", "จอมเวท", "อัครจอมเวท"];
export const GUILD_RANKS = ["", "เหล็ก", "ทองแดง", "เงิน", "ทอง", "มิธริล"];
export const MAX_RANK = 4;
/** แต้มฝึกที่ต้องสะสมก่อนทะลวงแต่ละขั้น ขั้นสูงต้องใช้ทั้งชีวิต */
const NEED = [100, 200, 340, 520, 520];
export const needXp = (rank: number) => NEED[Math.min(rank, NEED.length - 1)];

/** เพดานเวท: พรสวรรค์คือหลัก คทาช่วยให้คนธรรมดาเข้าถึงได้ถึงขั้นนักเวท */
export const magicCap = (l: Life) => { const f = fl(l); return Math.min(MAX_RANK, Math.max(f.potential, 0) + (f.wand ? 2 : 0) + (f.relic === "embersoul" ? 1 : 0)); };
/** ร่ายเวทได้ไหม: มีคทา หรือเก่งจนไม่ต้องใช้ */
export const canCast = (l: Life) => { const f = fl(l); return !!f.wand || f.magicRank >= 3 || f.race === "dragon" || f.race === "demon"; };

/** พลังต่อสู้: เก่งสายใดสายหนึ่งก็พอ อีกสายช่วยเสริม อาวุธตำนานไม่ได้ทำให้ไร้เทียมทาน */
export function combat(l: Life): number {
  const f = fl(l);
  const body = f.bodyRank * 16 + Math.min(f.body, needXp(f.bodyRank)) / needXp(f.bodyRank) * 10;
  const magic = canCast(l) ? f.magicRank * 18 + Math.min(f.magic, needXp(f.magicRank)) / needXp(f.magicRank) * 10 + (f.wand?.quality ?? 0) * 2 : 0;
  const hurt = l.stats.health < 40 ? -8 : 0;
  return Math.round(Math.max(body, magic) + Math.min(body, magic) * 0.3 + gearBonus(l) + styleBonus(l) + (myRelic(l)?.bonus ?? 0) + (f.rune ?? 0) * (f.race === "dwarf" ? 6 : 3) + (f.race === "orc" ? 3 : 0) + companion(l) + hurt);
}
/** อาวุธช่วยมากกว่าเกราะ · อาวุธลงอาคมแรงขึ้นอีกขั้น */
export const gearBonus = (l: Life) => { const f = fl(l); return (f.weapon ? f.weapon.quality * 3 + (f.weapon.enchant ? 4 : 0) : 0) + (f.armor ? f.armor.quality * 2 : 0); };
/** มังกรที่ขี่ช่วยสู้ ลูกมังกรที่โตแล้วช่วยตามพลังของมัน */
/** ปาร์ตี้นักผจญภัยช่วยสู้ คนละ 4 สูงสุดสามคน (bonds.ts) */
export const partyBonus = (l: Life) => Math.min(3, l.people.filter((p) => p.alive && p.tags?.some((t) => t.startsWith("party:"))).length) * 4;
const companion = (l: Life) => { const f = fl(l); return partyBonus(l) + (f.mount ? 10 : 0) + (f.race === "dragon" ? Math.min(60, Math.floor(l.age / 6)) : 0) + (f.demonHorn ? 10 : 0) + (f.whelp && f.whelp.age >= 3 ? Math.min(15, Math.round(f.whelp.power / 5)) : 0) + (f.dragonblood ? 5 : 0); };
/** โอกาสชนะศัตรูระดับนี้ */
export const fightOdds = (l: Life, threat: number) => clamp(0.5 + (combat(l) - threat) / 60 + (l.stats.luck - 50) / 400, 0.04, 0.96);
export const breakOdds = (l: Life, track: "body" | "magic") => {
  const f = fl(l);
  const rank = track === "body" ? f.bodyRank : f.magicRank;
  const base = track === "body" ? (l.stats.health - 50) / 150 : (l.stats.smarts - 50) / 150 + f.potential * 0.05;
  return clamp(0.7 - rank * 0.14 + base, 0.08, 0.9);
};
export const canBreak = (l: Life, track: "body" | "magic") => {
  const f = fl(l);
  return track === "body" ? f.body >= needXp(f.bodyRank) && f.bodyRank < MAX_RANK : f.magic >= needXp(f.magicRank) && f.magicRank < magicCap(l);
};
/** พลาดในงานอันตรายแล้วตายไหม: ยิ่งอ่อนกว่าศัตรูและยิ่งเจ็บ ยิ่งเสี่ยง */
export const deathOdds = (l: Life, threat: number) => clamp((0.03 + Math.max(0, threat - combat(l)) / 160 + Math.max(0, 40 - l.stats.health) / 150) * (1 - (fl(l).armor?.quality ?? 0) * 0.08) * (fl(l).style === "shield" && fl(l).bodyRank >= 1 ? 0.8 : 1), 0.01, 0.5);
