// งานเฉพาะอาชีพ (แท็บอาชีพ) — นอกจาก "ทุ่มเททำงาน" แต่ละอาชีพมีสิ่งที่ทำได้ของตัวเอง ปีละครั้งต่ออย่าง
// โอกาสสำเร็จมาจากค่าสถานะจริง + ขั้นตำแหน่ง · ผลบางอย่างติดตัวถาวร: อาวุธที่ตีเอง (เพิ่มพลังต่อสู้) ที่ดิน/สาขา (เพิ่มรายได้ทุกปี)
import type { Outcome } from "../../../engine/events";
import { kill, runEvent } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life, StatKey } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, log, money, shortName } from "../../../engine/util";
import { gainExp } from "../../hunter/power";
import { addQi, artsOf, practise } from "../martial/arts";
import { shiftAlign } from "../m17core";
import { startDuel } from "./duel";
import { addHeat } from "./law";
import { TAEL } from "../story/kit";
import { timeLeft } from "../../../engine/activities";
import { gift } from "./gifts";
import { plantSeed } from "./seedStore";

export interface JobAction {
  id: string;
  jobs: string[];
  emoji: string;
  name: string;
  desc: string;
  /** ตำแหน่งขั้นต่ำ (1–5) */
  minLevel?: number;
  /** ค่าใช้จ่าย (ตำลึง) */
  cost?: number;
  /** % สำเร็จ (ถ้ามี) */
  odds?: (l: Life) => number;
  /** เงื่อนไขเพิ่ม — คืนเหตุผลถ้ายังทำไม่ได้ */
  req?: (l: Life) => string | undefined;
  run: (l: Life, ok: boolean) => Outcome;
}

const lv = (l: Life) => l.job?.level ?? 1;
/** โอกาสตามค่าสถานะ + ตำแหน่ง */
const MED = ["herbalist", "palace_physician", "taoist", "monk"];
const by = (stat: StatKey, base = 0.4, perLv = 0.06) => (l: Life) =>
  clamp(base + (l.stats[stat] - 50) / 150 + (lv(l) - 1) * perLv + gift(l, "work") + (MED.includes(l.job?.careerId ?? "") ? gift(l, "medicine") : 0), 0.05, 0.95);
const ok = (text: string): Outcome => ({ text, kind: "good" });
const no = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });
const big = (text: string): Outcome => ({ text, kind: "milestone" });
const perf = (l: Life, d: number) => { if (l.job) l.job.performance = clamp(l.job.performance + d, 0, 100); };
/** ธุรกิจโตถาวร: รายได้อาชีพนี้เพิ่มทุกปี (ดู salaryOf) */
const grow = (l: Life) => { const k = `jobUp_${l.job!.careerId}`; l.flags[k] = Math.min(6, Number(l.flags[k] ?? 0) + 1); return Number(l.flags[k]); };

// ───── อาวุธที่ตีเอง ─────
const WEAPON_TIER = ["", "ธรรมดา", "ชั้นดี", "ชั้นเลิศ", "ในตำนาน"];
const WEAPON_KIND = ["กระบี่", "ดาบ", "ทวน", "กระบองเหล็ก"];
function forge(l: Life, forSelf: boolean): Outcome {
  const roll = by("health", 0.25, 0.1)(l) + (l.flags.smithSkill ? 0.1 : 0);
  const tier = chance(l, roll * 0.35) ? 4 : chance(l, roll * 0.8) ? 3 : chance(l, roll + 0.2) ? 2 : 1;
  const kind = pick(l, WEAPON_KIND);
  const name = `${kind}${WEAPON_TIER[tier]}ฝีมือ${forSelf ? "ตัวเอง" : "ร้านคุณ"}`;
  if (!forSelf) { const pay = [0, 4, 10, 25, 60][tier]; addMoney(l, pay * TAEL); if (tier >= 3) addFame(l, tier - 1); perf(l, 4 + tier * 2); return tier >= 3 ? ok(`${name} — จอมยุทธ์จ่ายถึง ${pay} ตำลึงโดยไม่ต่อรอง`) : meh(`${name} ขายได้ ${pay} ตำลึง`); }
  if (Number(l.flags.mwWeaponTier ?? 0) >= tier) return meh(`${name} — ยังไม่ดีกว่าเล่มที่ใช้อยู่ คุณแขวนไว้ข้างฝา`);
  l.flags.mwWeaponTier = tier;
  l.flags.mwWeapon = name;
  if (l.power) { l.power.items = l.power.items.filter((i) => !i.includes("ฝีมือตัวเอง")); l.power.items.push(name); }
  return tier >= 3 ? big(`ค้อนกระทบเหล็กเก้าพันครั้ง — ${name}เปล่งประกายเย็นเฉียบ (พลังต่อสู้ +${tier * 1.5})`) : ok(`${name}พร้อมใช้ (พลังต่อสู้ +${tier * 1.5})`);
}

export const JOB_ACTIONS: JobAction[] = [
  // ───── ชาวนา ประมง พราน กุลี ─────
  { id: "farm_sell", jobs: ["farmer"], emoji: "🛒", name: "ขนผลผลิตไปขายในเมือง", desc: "ได้ราคาดีกว่าขายให้พ่อค้าคนกลาง", odds: by("smarts", 0.45), run: (l, s) => { const t = s ? randInt(l, 6, 12) : randInt(l, 1, 3); addMoney(l, t * TAEL); return s ? ok(`ข้าวขายได้ราคาดี — ${t} ตำลึง`) : meh(`ตลาดวายพอดี ขายได้แค่ ${t} ตำลึง`); } },
  { id: "farm_land", jobs: ["farmer"], emoji: "🌾", name: "บุกเบิกที่นาใหม่", desc: "รายได้เพิ่มทุกปี", cost: 20, run: (l) => { const n = grow(l); return ok(`ที่นาแปลงใหม่ริมลำธาร — ตอนนี้คุณมีนา ${n + 1} แปลง`); } },
  { id: "farm_seed", jobs: ["farmer"], emoji: "🌱", name: "คัดเมล็ดพันธุ์ข้าวดี", desc: "ผลผลิตปีหน้าดีขึ้น", odds: by("smarts", 0.5), run: (l, s) => { perf(l, s ? 15 : 3); return s ? ok("เมล็ดพันธุ์ที่คัดไว้ออกรวงหนักกว่าทุกแปลงในหมู่บ้าน") : meh("ต้นกล้าขึ้นไม่ต่างจากเดิม"); } },
  { id: "fish_night", jobs: ["fisher"], emoji: "🌙", name: "ออกเรือกลางคืน", desc: "ปลาชุม แต่เสี่ยง", odds: by("luck", 0.5), run: (l, s) => { if (s) { const t = randInt(l, 6, 14); addMoney(l, t * TAEL); return ok(`แหหนักจนแทบดึงไม่ขึ้น — ขายได้ ${t} ตำลึง`); } addStat(l, "health", -5); return no("คลื่นซัดเรือเกือบคว่ำ — กลับเข้าฝั่งมือเปล่า"); } },
  { id: "fish_boat", jobs: ["fisher"], emoji: "⛵", name: "ต่อเรือลำใหม่", desc: "รายได้เพิ่มทุกปี", cost: 25, run: (l) => { const n = grow(l); return ok(`เรือลำที่ ${n + 1} ของคุณลงน้ำ — จ้างลูกเรือเพิ่มได้แล้ว`); } },
  { id: "hunt_big", jobs: ["hunter_m"], emoji: "🐗", name: "ล่าสัตว์ใหญ่", desc: "หนังและเขาขายได้ราคา", odds: by("health", 0.4, 0.08), run: (l, s) => { if (s) { const t = randInt(l, 8, 20); addMoney(l, t * TAEL); perf(l, 8); return ok(`หมูป่าตัวใหญ่ที่สุดที่หมู่บ้านเคยเห็น — ${t} ตำลึง`); } addStat(l, "health", -8); return no("เขี้ยวหมูป่าเฉียดต้นขา — คุณกลับบ้านมาพร้อมแผล"); } },
  { id: "hunt_herb", jobs: ["hunter_m"], emoji: "🌿", name: "หาสมุนไพรหายากในป่าลึก", desc: "อาจเจอของมีค่า", odds: by("luck", 0.35), run: (l, s) => { if (s) { l.flags.medicKnow = true; const t = randInt(l, 10, 30); addMoney(l, t * TAEL); return ok(`โสมป่าอายุร้อยปีใต้รากสน — หมอยาจ่าย ${t} ตำลึง`); } return meh("ป่าลึกเงียบสงัด ไม่มีอะไรนอกจากเห็ดธรรมดา"); } },
  { id: "porter_rush", jobs: ["porter"], emoji: "🧺", name: "รับแบกของด่วนข้ามเขา", desc: "ค่าจ้างสามเท่า หนักมาก", odds: by("health", 0.55), run: (l, s) => { if (s) { addMoney(l, 6 * TAEL); return ok("ถึงก่อนกำหนด — พ่อค้าเพิ่มค่าจ้างให้"); } addStat(l, "health", -6); return no("หลังเคล็ดกลางทาง ต้องพักครึ่งเดือน"); } },
  { id: "porter_gang", jobs: ["porter"], emoji: "👥", name: "รวมกุลีตั้งกลุ่มรับงาน", desc: "รายได้เพิ่มทุกปี", minLevel: 2, odds: by("looks", 0.45), run: (l, s) => { if (s) { const n = grow(l); return ok(`กุลี ${n * 5} คนยอมทำงานใต้ชื่อคุณ`); } return meh("กุลีส่วนใหญ่ไม่ไว้ใจคุณพอ"); } },

  // ───── ช่าง ─────
  { id: "smith_self", jobs: ["smith"], emoji: "⚔️", name: "ตีอาวุธให้ตัวเอง", desc: "อาวุธคู่กาย เพิ่มพลังต่อสู้ — ฝีมือยิ่งสูง ยิ่งมีโอกาสได้ของดี", cost: 10, run: (l) => forge(l, true) },
  { id: "smith_sell", jobs: ["smith"], emoji: "🗡️", name: "ตีอาวุธขาย", desc: "ของดีขายได้ราคาสูงและได้ชื่อเสียง", cost: 3, run: (l) => forge(l, false) },
  { id: "smith_repair", jobs: ["smith"], emoji: "🔧", name: "ซ่อมอาวุธให้จอมยุทธ์", desc: "อาจได้คนรู้จักในยุทธภพ", odds: by("health", 0.55), run: (l, s) => { addMoney(l, 3 * TAEL); if (s) { const p = createPerson(l, "friend", { age: l.age + randInt(l, -5, 10), bond: 50 }); p.tags = ["jianghu_client"]; return ok(`${shortName(p)}พอใจงานซ่อมมาก — "มีอะไรให้ช่วย บอกข้าได้"`); } return meh("ซ่อมเสร็จ ลูกค้าจ่ายเงินแล้วจากไป"); } },
  { id: "tailor_noble", jobs: ["tailor"], emoji: "👘", name: "ตัดชุดให้ตระกูลขุนนาง", desc: "งานยาก ค่าจ้างสูง", odds: by("smarts", 0.35, 0.1), run: (l, s) => { if (s) { addMoney(l, 15 * TAEL); addFame(l, 2); perf(l, 10); return ok("ฮูหยินขุนนางสวมชุดของคุณไปงานเลี้ยง — มีคนถามหาร้านคุณทั้งเมือง"); } return no("ตะเข็บเบี้ยว ต้องทำใหม่ทั้งชุดโดยไม่ได้ค่าจ้าง"); } },
  { id: "tailor_self", jobs: ["tailor"], emoji: "🧥", name: "ตัดชุดดีให้ตัวเอง", desc: "รูปลักษณ์ดีขึ้น", cost: 3, run: (l) => { addStat(l, "looks", 3); return ok("ชุดผ้าไหมที่พอดีตัวทุกส่วน — คนหันมามองคุณบ่อยขึ้น"); } },
  { id: "tailor_shop", jobs: ["tailor"], emoji: "🏪", name: "ขยายร้าน จ้างลูกมือ", desc: "รายได้เพิ่มทุกปี", minLevel: 2, cost: 20, run: (l) => { const n = grow(l); return ok(`ร้านขยายเป็น ${n + 1} คูหา ลูกมือเย็บผ้าเสียงดังทั้งวัน`); } },
  { id: "carp_house", jobs: ["carpenter"], emoji: "🏠", name: "สร้างบ้านให้ครอบครัวตัวเอง", desc: "บ้านอบอุ่น ความสุขทุกปี", cost: 10, req: (l) => (l.flags.ownHouse ? "สร้างไปแล้ว" : undefined), run: (l) => { l.flags.ownHouse = true; addStat(l, "happiness", 10); return big("บ้านไม้สามห้องที่คุณสร้างด้วยมือตัวเอง — ทุกคานมีชื่อคนในครอบครัวสลักไว้"); } },
  { id: "carp_contract", jobs: ["carpenter"], emoji: "🏯", name: "รับเหมาสร้างศาลาวัด", desc: "งานใหญ่ ได้ชื่อเสียง", odds: by("health", 0.4, 0.08), run: (l, s) => { if (s) { addMoney(l, 20 * TAEL); addFame(l, 2); return ok("ศาลาเสร็จทันงานบุญ — เจ้าอาวาสสลักชื่อคุณไว้ที่เสา"); } addStat(l, "health", -6); return no("คานหล่นทับขา — งานล่าช้า ค่าจ้างโดนหัก"); } },

  // ───── ค้าขาย การพนัน ─────
  { id: "trade_goods", jobs: ["merchant"], emoji: "📦", name: "ซื้อถูกไปขายแพงต่างเมือง", desc: "กำไรตามไหวพริบ", cost: 15, odds: by("smarts", 0.45, 0.07), run: (l, s) => { if (s) { const t = randInt(l, 22, 40); addMoney(l, t * TAEL); return ok(`${pick(l, ["ผ้าไหมเจียงหนาน", "ชาเสฉวน", "เกลือทะเล", "เครื่องเทศตะวันตก"])}ขายได้ ${t} ตำลึง (ทุน 15)`); } const t = randInt(l, 3, 10); addMoney(l, t * TAEL); return no(`ราคาตกก่อนไปถึง — ได้คืนแค่ ${t} ตำลึง`); } },
  { id: "trade_branch", jobs: ["merchant"], emoji: "🏬", name: "เปิดร้านสาขาใหม่", desc: "รายได้เพิ่มทุกปี", minLevel: 3, cost: 50, run: (l) => { const n = grow(l); return ok(`ร้านสาขาที่ ${n + 1} เปิดแล้ว — ป้ายชื่อตระกูลคุณอยู่ในสองเมือง`); } },
  { id: "trade_guild", jobs: ["merchant"], emoji: "🤝", name: "ผูกมิตรกับสมาคมพ่อค้า", desc: "ทางค้าราบรื่น เลื่อนตำแหน่งง่าย", cost: 8, odds: by("looks", 0.45), run: (l, s) => { if (s) { perf(l, 15); return ok("หัวหน้าสมาคมดื่มกับคุณจนดึก — สินค้าคุณผ่านด่านไม่โดนตรวจอีก"); } return meh("งานเลี้ยงสิ้นเปลือง แต่ไม่มีใครจำชื่อคุณ"); } },
  { id: "gam_table", jobs: ["gambler"], emoji: "🎲", name: "เปิดวงพนันของตัวเอง", desc: "เจ้ามือได้เปรียบ แต่ทางการจับตา", odds: by("luck", 0.5, 0.05), run: (l, s) => { if (s) { const t = randInt(l, 10, 25); addMoney(l, t * TAEL); return ok(`คืนนี้เจ้ามือกวาดเรียบ — ${t} ตำลึง${addHeat(l, 4)}`); } addMoney(l, -8 * TAEL); return no("นักพนันใหญ่ชนะติดกันห้าตา — คุณจ่ายจนหมดกระเป๋า"); } },
  { id: "gam_cheat", jobs: ["gambler"], emoji: "🃏", name: "โกงลูกเต๋า", desc: "รวยเร็ว ถ้าถูกจับได้จะเจ็บ", odds: by("luck", 0.4, 0.07), run: (l, s) => { if (s) { addMoney(l, 20 * TAEL); return ok(`ลูกเต๋าถ่วงตะกั่วทำงานสมบูรณ์แบบ${shiftAlign(l, -3)}`); } addStat(l, "health", -10); return no("ถูกจับได้คาโต๊ะ — นิ้วเกือบถูกตัด"); } },

  // ───── หมอ ร้านอาหาร นักเล่า ─────
  { id: "herb_tonic", jobs: ["herbalist"], emoji: "🍵", name: "ปรุงยาบำรุงขาย", desc: "รายได้และชื่อเสียงร้านยา", odds: by("smarts", 0.5), run: (l, s) => { if (s) { addMoney(l, 10 * TAEL); perf(l, 8); return ok("ยาบำรุงสูตรคุณขายหมดภายในเจ็ดวัน"); } return meh("ยาหม้อนี้ขมเกินไป ขายได้ไม่ถึงครึ่ง"); } },
  { id: "herb_pill", jobs: ["herbalist"], emoji: "💊", name: "ปรุงยาเม็ดทะลวงชีพจร", desc: "ยาช่วยทะลวงขั้น (ยากมาก)", minLevel: 3, cost: 20, odds: by("smarts", 0.2, 0.1), run: (l, s) => { if (s) { if (l.power) l.power.items.push("ยาเม็ดทะลวงชีพจร"); else addMoney(l, 60 * TAEL); return big(l.power ? "เตายาเปิดออก — ยาเม็ดสีทองกลิ่นหอมเย็น เก็บไว้ใช้ตอนทะลวงขั้น" : "ยาเม็ดสีทองขายให้จอมยุทธ์ได้ 60 ตำลึง"); } return no("เตายาระเบิด — สมุนไพรร้อยปีกลายเป็นเถ้า"); } },
  { id: "herb_hard", jobs: ["herbalist"], emoji: "🩺", name: "รักษาคนไข้ที่หมออื่นยอมแพ้", desc: "ชื่อเสียงมาก ถ้าพลาดเสียชื่อ", odds: by("smarts", 0.3, 0.1), run: (l, s) => { if (s) { addFame(l, 4); perf(l, 15); l.flags.medicKnow = true; return ok("คนไข้ลุกขึ้นเดินได้ในเดือนที่สาม — ข่าวลือว่าหมอเทวดาอยู่ในเมืองนี้แพร่ไปทั่ว"); } addFame(l, -2); return no("คนไข้ไม่รอด — ญาติเขาด่าคุณหน้าร้าน"); } },
  { id: "inn_feast", jobs: ["innkeeper"], emoji: "🏮", name: "จัดงานเลี้ยงให้ขุนนาง", desc: "รายได้ก้อนใหญ่", odds: by("looks", 0.45), run: (l, s) => { if (s) { addMoney(l, 18 * TAEL); return ok("ขุนนางเมาจนหัวเราะไม่หยุด แล้วทิปให้อีกหนึ่งถุง"); } return no("อาหารจานหลักไหม้ — ขุนนางเดินออกจากร้าน"); } },
  { id: "inn_expand", jobs: ["innkeeper"], emoji: "🏨", name: "ต่อเติมห้องพัก", desc: "รายได้เพิ่มทุกปี", cost: 25, run: (l) => { const n = grow(l); return ok(`โรงเตี๊ยมมีห้องพักเพิ่มเป็น ${8 + n * 4} ห้อง`); } },
  { id: "inn_gossip", jobs: ["innkeeper", "storyteller"], emoji: "👂", name: "ฟังข่าวจากแขก", desc: "อาจได้ข่าวลือเป็นงาน", run: (l) => { if (l.age >= 18 && chance(l, 0.5)) { runEvent(l, pick(l, ["ad.j.inn_secret", "ad.j.wanted_hunt", "ad.j.escort_small"])); return { text: "" }; } addStat(l, "smarts", 1); return meh("แขกโต๊ะมุมคุยเรื่องการเมืองในเมืองหลวง — คุณจำไว้ทุกคำ"); } },
  { id: "story_new", jobs: ["storyteller"], emoji: "📖", name: "แต่งเรื่องใหม่", desc: "เรื่องดังได้ชื่อเสียง", odds: by("smarts", 0.4, 0.08), run: (l, s) => { if (s) { addFame(l, 3); addMoney(l, 6 * TAEL); perf(l, 12); return ok("คนต่อแถวจนล้นร้าน — เรื่องใหม่ของคุณถูกเล่าต่อทั่วเมือง"); } return meh("คนฟังหาวกันทั้งร้าน"); } },
  { id: "story_self", jobs: ["storyteller"], emoji: "🗣️", name: "เล่าเรื่องชีวิตตัวเอง", desc: "ถ้าชีวิตคุณมีเรื่อง คนจะฟัง", odds: (l) => clamp(0.2 + Math.max(0, l.fame) / 100 + (l.age - 20) / 150, 0.1, 0.9), run: (l, s) => (s ? ok(`ทั้งร้านเงียบกริบตอนคุณเล่าถึงเรื่องที่เคยเจอ${(addFame(l, 3), "")}`) : meh("คนฟังคิดว่าคุณแต่งเรื่องเอง")) },

  // ───── คุ้มภัย มือปราบ ทหาร ขุนนาง ครู ─────
  { id: "esc_job", jobs: ["escort"], emoji: "🐎", name: "รับงานคุ้มกันขบวนใหญ่", desc: "ค่าจ้างดี อาจต้องสู้", run: (l) => { if (chance(l, 0.45)) { startDuel(l, { foe: "หัวหน้าโจรดักขบวน", rank: Math.max(0, (l.power?.rank ?? 0)), lethal: false, on: "bandit" }); return { text: "" }; } addMoney(l, 12 * TAEL); perf(l, 8); return ok("ขบวนถึงปลายทางเรียบร้อย — ค่าจ้างเต็มจำนวน"); } },
  { id: "esc_train", jobs: ["escort"], emoji: "🥋", name: "ฝึกลูกน้องในสำนักคุ้มภัย", desc: "ขบวนปลอดภัยขึ้น รายได้เพิ่ม", minLevel: 2, odds: by("health", 0.5), run: (l, s) => { if (s) { grow(l); return ok("ลูกน้องสิบคนตั้งแถวได้อย่างพร้อมเพรียง — โจรเห็นธงสำนักคุณแล้วหลีกทาง"); } return meh("ลูกน้องครึ่งหนึ่งหนีกลับบ้านกลางการฝึก"); } },
  { id: "cons_hunt", jobs: ["constable", "soldier"], emoji: "🏃", name: "ไล่จับโจรผู้ร้าย", desc: "ได้ผลงาน อาจบาดเจ็บ", run: (l) => { startDuel(l, { foe: pick(l, ["โจรปล้นร้านทอง", "ฆาตกรหนีคดี", "หัวหน้าแก๊งนักเลง"]), rank: Math.max(0, (l.power?.rank ?? 0) - 1), lethal: false, on: "brawl" }); perf(l, 10); return { text: "" }; } },
  { id: "cons_question", jobs: ["constable", "jinyiwei"], emoji: "⛓️", name: "สอบสวนผู้ต้องหาในคุก", desc: "ได้คำสารภาพ — วิธีที่ใช้มีราคาของมัน", run: (l) => { runEvent(l, "tt.question"); perf(l, 4); return { text: "" }; } },
  { id: "cons_case", jobs: ["constable", "official"], emoji: "🔍", name: "สืบคดีที่ค้างอยู่", desc: "ไขคดีได้ เลื่อนขั้นเร็ว", odds: by("smarts", 0.35, 0.08), run: (l, s) => { if (s) { perf(l, 18); addFame(l, 2); return ok("คนร้ายตัวจริงคือคนที่ไม่มีใครสงสัย — คดีปิดได้ในเดือนเดียว"); } return meh("เบาะแสขาดกลางทาง คดียังค้างอยู่"); } },
  { id: "off_bribe", jobs: ["official", "constable"], emoji: "💰", name: "รับสินบน", desc: "เงินง่าย แต่ทางการอาจรู้", run: (l) => { const t = randInt(l, 10, 30) * lv(l); addMoney(l, t * TAEL); return meh(`ห่อเงิน ${t} ตำลึงถูกวางไว้ใต้โต๊ะทำงาน${shiftAlign(l, -4)}${addHeat(l, 8)}`); } },
  { id: "off_petition", jobs: ["official"], emoji: "📜", name: "ถวายฎีกาปฏิรูป", desc: "ได้ใจราษฎร เสี่ยงขัดใจผู้ใหญ่", odds: by("smarts", 0.3, 0.08), run: (l, s) => { if (s) { perf(l, 20); addFame(l, 4); return ok(`ฎีกาผ่าน — ราษฎรในเขตคุณเสียภาษีน้อยลงครึ่งหนึ่ง${shiftAlign(l, 3)}`); } l.flags.courtBlacklist = true; return no("เสนาบดีโกรธ — ชื่อคุณอยู่ในบัญชีดำแล้ว"); } },
  { id: "sold_drill", jobs: ["soldier"], emoji: "🛡️", name: "ฝึกหนักกับกองร้อย", desc: "ร่างกายแกร่ง ฝีมือขึ้น", run: (l) => { addStat(l, "health", 3); if (l.power) gainExp(l, 200); else l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + 2; perf(l, 8); return ok("วิ่งแบกหินรอบค่ายวันละสิบรอบ — ขาคุณแข็งเหมือนเสาบ้าน"); } },
  { id: "teach_pupils", jobs: ["teacher"], emoji: "🖌️", name: "รับลูกศิษย์เพิ่ม", desc: "รายได้เพิ่มทุกปี", odds: by("looks", 0.45), run: (l, s) => { if (s) { const n = grow(l); return ok(`ห้องเรียนมีเด็ก ${10 + n * 6} คนแล้ว — เสียงท่องหนังสือดังทั้งตรอก`); } return meh("พ่อแม่ส่วนใหญ่ส่งลูกไปเรียนกับครูอีกคน"); } },
  { id: "teach_book", jobs: ["teacher"], emoji: "📚", name: "เขียนตำราอธิบายคัมภีร์", desc: "สติปัญญาและชื่อเสียง", odds: by("smarts", 0.4, 0.08), run: (l, s) => { addStat(l, "smarts", 2); if (s) { addFame(l, 3); return ok("ตำราของคุณถูกคัดลอกไปใช้ในสำนักศึกษาสามแห่ง"); } return meh("เขียนเสร็จ แต่ไม่มีร้านไหนรับพิมพ์"); } },

  // ───── ศาสนา พรรคกระยาจก ─────
  { id: "monk_chant", jobs: ["monk"], emoji: "🙏", name: "สวดมนต์ภาวนาทั้งพรรษา", desc: "ใจสงบ ลมปราณนิ่ง", run: (l) => { addStat(l, "happiness", 5); if (l.power) addQi(l, 1); shiftAlign(l, 2); return ok("สามเดือนในโบสถ์ — ใจคุณนิ่งเหมือนน้ำในบ่อหลังวัด"); } },
  { id: "monk_art", jobs: ["monk"], emoji: "👊", name: "ฝึกวิชาประจำวัด", desc: "ฝีมือขึ้น", run: (l) => { const a = artsOf(l)[0]; if (a) practise(l, a.id, 6); if (l.power) gainExp(l, 300); else l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + 2; return ok("หมัดวัชระหนึ่งพันครั้งทุกเช้า — กำแพงหินหลังวัดมีรอยหมัดคุณเพิ่มขึ้น"); } },
  { id: "tao_elixir", jobs: ["taoist"], emoji: "⚗️", name: "หลอมโอสถในเตาแปดทิศ", desc: "ยาเสริมลมปราณ หรือพิษถ้าพลาด", cost: 8, odds: by("smarts", 0.4), run: (l, s) => { if (s) { if (l.power) addQi(l, 2); else l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + 2; addStat(l, "health", 3); return ok("โอสถเม็ดสีทองกลิ้งออกจากเตาเจ็ดวันเจ็ดคืน — ลมปราณไหลลื่นอย่างที่ไม่เคยเป็น"); } addStat(l, "health", -8); return no("ชาดในเตาร้อนเกินไป — คุณกินยาที่หลอมพลาดแล้วอาเจียนเป็นเลือดสามวัน"); } },
  { id: "tao_talisman", jobs: ["taoist"], emoji: "📜", name: "เขียนยันต์ขับไล่สิ่งชั่วร้ายให้ชาวบ้าน", desc: "รายได้และชื่อเสียง", odds: by("luck", 0.55), run: (l, s) => { addMoney(l, (s ? 25 : 8) * TAEL); if (s) { addFame(l, 2); return ok("ลูกสาวผู้ใหญ่บ้านหายจากอาการเพ้อในคืนที่สาม — ชาวบ้านแห่มาขอยันต์จนหมึกหมด"); } return meh("คนไข้ไม่ดีขึ้น — หมอยาบอกว่าเป็นไข้มาลาเรีย ไม่ใช่ผี"); } },
  { id: "tao_divine", jobs: ["taoist"], emoji: "🔮", name: "ดูดวงเสี่ยงทายที่หน้าอาราม", desc: "เงินเล็กน้อย บางทีได้ข่าวสาร", run: (l) => { addMoney(l, 12 * TAEL); if (chance(l, 0.3)) { addStat(l, "smarts", 1); return ok("ลูกค้าคนหนึ่งเป็นภรรยาขุนนาง — นางเล่าเรื่องในจวนให้ฟังมากกว่าที่ควร"); } return meh("ทั้งปีมีแต่คนถามเรื่องคู่ครองกับเลขเด็ด"); } },
  { id: "tao_retreat", jobs: ["taoist"], emoji: "⛰️", name: "ปลีกวิเวกบนยอดเขาหนึ่งฤดู", desc: "อายุยืน ใจสงบ", minLevel: 2, run: (l) => { addStat(l, "health", 4); addStat(l, "happiness", 4); l.flags.taoLongevity = Number(l.flags.taoLongevity ?? 0) + 1; if (l.power) addQi(l, 1); return ok("ร้อยวันบนยอดเขา กินแต่น้ำค้างกับสน — ลมหายใจของคุณยาวขึ้นเหมือนเมฆ"); } },
  { id: "monk_heal", jobs: ["monk"], emoji: "🍲", name: "ตั้งโรงทานให้คนยากไร้", desc: "ธรรมะและชื่อเสียง", cost: 5, run: (l) => { addFame(l, 2); if (chance(l, 0.35)) plantSeed(l, "kindness", "เด็กกำพร้าที่โรงทาน"); return ok(`คนจนต่อแถวรับโจ๊กยาวถึงประตูวัด${shiftAlign(l, 4)}`); } },
  { id: "beg_intel", jobs: ["beggar_sect"], emoji: "👁️", name: "สืบข่าวให้พรรค", desc: "ผลงานในพรรค", odds: by("luck", 0.5), run: (l, s) => { if (s) { perf(l, 15); l.flags.factionIntel = true; return ok("ข่าวที่คุณได้มาช่วยให้พรรครู้แผนของศัตรูก่อน"); } return meh("ไม่มีข่าวอะไรน่าสนใจ"); } },
  { id: "beg_pouch", jobs: ["beggar_sect"], emoji: "🥣", name: "ขอทดสอบเลื่อนถุง", desc: "ผ่านแล้วได้เลื่อนขั้น", odds: by("health", 0.35, 0.06), run: (l, s) => { if (s && l.job && l.job.level < 5) { l.job.level++; return big(`คุณได้ถุงเพิ่ม — ตอนนี้เป็น${["", "ศิษย์ถุงเดียว", "ศิษย์สามถุง", "ศิษย์ห้าถุง", "ผู้อาวุโสเจ็ดถุง", "ผู้อาวุโสเก้าถุง"][l.job.level]}`); } return no("ผู้อาวุโสส่ายหน้า \"ปีหน้าค่อยมาใหม่\""); } },

  // ───── สายมืด ─────
  { id: "dark_rob", jobs: ["bandit", "pirate"], emoji: "🏴", name: "ออกปล้นกับพวก", desc: "เงินมาก ทางการตามล่า", run: (l) => { runEvent(l, "cr.rob"); return { text: "" }; } },
  { id: "dark_split", jobs: ["bandit", "pirate", "thief"], emoji: "💰", name: "แบ่งของที่ปล้นมา", desc: "ส่วนแบ่งตามตำแหน่ง", run: (l) => { const t = randInt(l, 5, 12) * lv(l); addMoney(l, t * TAEL); return meh(`ส่วนแบ่งของคุณ ${t} ตำลึง${addHeat(l, 3)}`); } },
  { id: "dark_steal", jobs: ["thief"], emoji: "🤏", name: "ย่องเบาบ้านเศรษฐี", desc: "ได้ของมีค่า เสี่ยงถูกจับ", run: (l) => { runEvent(l, "cr.steal"); return { text: "" }; } },
  { id: "dark_poison", jobs: ["poisoner"], emoji: "🧪", name: "ปรุงพิษขายตลาดมืด", desc: "เงินดี บาปหนัก", odds: by("smarts", 0.45, 0.08), run: (l, s) => { if (s) { const t = randInt(l, 15, 35); addMoney(l, t * TAEL); return meh(`ขวดพิษไร้สีไร้กลิ่นขายได้ ${t} ตำลึง${shiftAlign(l, -5)}${addHeat(l, 6)}`); } addStat(l, "health", -10); return no("ไอพิษย้อนเข้าจมูก — คุณไออยู่เป็นเดือน"); } },
  { id: "dark_antidote", jobs: ["poisoner"], emoji: "🌿", name: "ปรุงยาแก้พิษ", desc: "ช่วยคน และขายได้", odds: by("smarts", 0.5), run: (l, s) => (s ? ok(`ยาแก้พิษของคุณช่วยชีวิตคนได้สามคนในปีนี้${(addMoney(l, 8 * TAEL), shiftAlign(l, 3))}`) : meh("ยาแก้พิษได้ผลแค่ครึ่งเดียว")) },
  { id: "dark_hit", jobs: ["m_assassin"], emoji: "🌑", name: "รับงานลอบสังหาร", desc: "ทองหนัก ถึงตาย", run: (l) => { runEvent(l, "cr.assassinate"); return { text: "" }; } },
  { id: "dark_train", jobs: ["m_assassin", "thief"], emoji: "🥷", name: "ฝึกฝีมือในเงามืด", desc: "เดินบนหลังคาไร้เสียง ซัดอาวุธลับแม่นขึ้น", odds: by("luck", 0.5, 0.06), run: (l, s) => { if (l.power) gainExp(l, s ? 500 : 150); else l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + 1; perf(l, s ? 10 : 3); return s ? ok("คุณเดินข้ามหลังคาทั้งตรอกโดยไม่มีกระเบื้องแตกสักแผ่น") : meh("ตกหลังคาสองครั้ง — แต่ยังไม่มีใครเห็น"); } },
  { id: "cult_preach", jobs: ["cultist"], emoji: "🩸", name: "เผยแผ่ลัทธิ", desc: "ได้สาวกใหม่ ทางการเริ่มสนใจ", odds: by("looks", 0.45), run: (l, s) => { if (s) { perf(l, 15); return meh(`ชาวบ้านสิบคนกรีดฝ่ามือสาบานต่อลัทธิ${addHeat(l, 6)}`); } return no("ชาวบ้านไล่ขว้างด้วยก้อนหิน"); } },

  { id: "cult_art", jobs: ["cultist"], emoji: "🔥", name: "ฝึกวิชามารในถ้ำลับ", desc: "พลังพุ่งเร็ว แต่ใจเริ่มมืด", odds: by("happiness", 0.45, 0.06), run: (l, s) => { if (s) { if (l.power) { addQi(l, 2); gainExp(l, 500); } else l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + 2; return ok(`ลมปราณมารเดือดพล่านในเส้นชีพจร — แข็งแกร่งขึ้นอย่างน่ากลัว${shiftAlign(l, -4)}`); } addStat(l, "health", -10); return no("ลมปราณย้อนกลับ คุณกระอักเลือดดำในถ้ำ"); } },
  // ───── งานทั่วไปและราชสำนัก ─────
  { id: "wood_far", jobs: ["woodcutter"], emoji: "🌲", name: "ตัดไม้ในป่าลึก", desc: "ไม้ดีราคาสูง ป่าลึกมีสัตว์ร้าย", odds: by("health", 0.5), run: (l, s) => { if (s) { addMoney(l, randInt(l, 5, 10) * TAEL); return ok("ไม้สนพันปีหนึ่งต้นขายได้ราคาเท่าตัดฟืนครึ่งปี"); } addStat(l, "health", -8); return no("หมาป่าตามกลิ่นเลือดจากมือที่ถลอก — คุณทิ้งไม้หนีกลับมา"); } },
  { id: "wood_cart", jobs: ["woodcutter"], emoji: "🛒", name: "ซื้อเกวียนขนไม้", desc: "รายได้เพิ่มทุกปี", cost: 12, run: (l) => { const n = grow(l); return ok(`เกวียนคันที่ ${n} — ขนไม้ได้มากขึ้นทุกเที่ยว`); } },
  { id: "wait_tips", jobs: ["waiter"], emoji: "🫖", name: "บริการแขกคนสำคัญ", desc: "ทิปดี ได้ยินข่าว", odds: by("looks", 0.5), run: (l, s) => { if (s) { addMoney(l, randInt(l, 2, 6) * TAEL); addStat(l, "smarts", 1); return ok("แขกโต๊ะหัวมุมทิ้งเงินไว้ใต้ถ้วย — พร้อมข่าวลือจากเมืองหลวง"); } return meh("แขกขี้เหนียว ไม่ทิ้งแม้แต่อีแปะ"); } },
  { id: "wait_learn", jobs: ["waiter"], emoji: "🍶", name: "ฝึกชงชาจากเถ้าแก่", desc: "เลื่อนตำแหน่งเร็วขึ้น", odds: by("smarts", 0.5), run: (l, s) => { perf(l, s ? 15 : 4); return s ? ok("ชาที่คุณชงทำให้เถ้าแก่พยักหน้าเป็นครั้งแรก") : meh("ชายังขมเกินไป"); } },
  { id: "guard_night", jobs: ["imperial_guard"], emoji: "🌙", name: "เฝ้าเวรกลางคืนหน้าตำหนัก", desc: "ผลงานดี อาจเจอเรื่องที่ไม่ควรเห็น", odds: by("smarts", 0.5), run: (l, s) => { perf(l, 10); if (s) return ok("คืนที่สงบ — ผู้บัญชาการชมว่าคุณไม่เคยหลับในเวร"); l.flags.sawPalaceSecret = true; return meh("ตีสาม คุณเห็นขันทีคนหนึ่งพาคนแปลกหน้าเข้าตำหนักใน — คุณทำเป็นไม่เห็น แต่จำหน้าได้"); } },
  { id: "guard_assassin", jobs: ["imperial_guard", "jinyiwei"], emoji: "⚔️", name: "สกัดมือสังหารที่ลอบเข้าวัง", desc: "ชนะได้บำเหน็จจากฮ่องเต้", run: (l) => { startDuel(l, { foe: "มือสังหารลอบเข้าวัง", rank: Math.max(2, (l.power?.rank ?? 0)), lethal: true, on: "bandit" }); perf(l, 15); addFame(l, 2); return { text: "" }; } },
  { id: "jyw_case", jobs: ["jinyiwei"], emoji: "📂", name: "สืบคดีขุนนางกบฏ", desc: "เลื่อนขั้นเร็ว บาปหนักถ้าจับผิดคน", odds: by("smarts", 0.35, 0.08), run: (l, s) => { if (s) { perf(l, 20); return ok("หลักฐานชัดเจน — ขุนนางกบฏถูกจับพร้อมจดหมายลับ"); } perf(l, 10); shiftAlign(l, -6); return no("หลักฐานไม่พอ แต่ผู้บัญชาการสั่งให้จับอยู่ดี — ตระกูลบริสุทธิ์หนึ่งตระกูลถูกส่งไปชายแดน"); } },
  { id: "jyw_spy", jobs: ["jinyiwei"], emoji: "👁️", name: "ฝังสายลับในสำนักยุทธ์", desc: "ราชสำนักรู้ความเคลื่อนไหวยุทธภพ", odds: by("smarts", 0.4, 0.07), run: (l, s) => { if (s) { perf(l, 12); l.flags.factionIntel = true; return ok("สายลับของคุณส่งรายงานจากในสำนักใหญ่ทุกเดือน"); } addFame(l, -3); return no("สายลับถูกจับได้ — สำนักนั้นรู้แล้วว่าราชสำนักจับตามอง"); } },
  { id: "pp_emperor", jobs: ["palace_physician"], emoji: "👑", name: "ถวายการรักษาฮ่องเต้", desc: "สำเร็จได้ทุกอย่าง พลาดอาจหัวขาด", odds: by("smarts", 0.3, 0.1), run: (l, s) => { if (s) { perf(l, 25); addFame(l, 8); addMoney(l, 80 * TAEL); return big("พระอาการดีขึ้นในเจ็ดวัน — ฮ่องเต้พระราชทานแผ่นป้ายทองคำ"); } if (chance(l, 0.3)) { kill(l, "ถูกประหารเพราะรักษาฮ่องเต้ไม่หาย"); return no("พระอาการทรุดลง — ขันทีคนสนิทชี้นิ้วมาที่คุณ"); } addFame(l, -6); return no("พระอาการไม่ดีขึ้น — คุณถูกลดขั้นและเฝ้าดูทุกฝีก้าว"); } },
  { id: "pp_secret", jobs: ["palace_physician"], emoji: "🤫", name: "ตรวจครรภ์พระสนม", desc: "ความลับในวังหลัง", run: (l) => { if (chance(l, 0.5)) { l.flags.palaceSecret = true; perf(l, 8); return meh("พระสนมตั้งครรภ์ — แต่วันที่ไม่ตรงกับคืนที่ฮ่องเต้เสด็จ คุณเก็บความลับนี้ไว้ในใจ"); } perf(l, 8); return ok("ข่าวดีของวังหลัง — ฮ่องเต้พระราชทานรางวัลให้คุณด้วย"); } },
  { id: "pp_book", jobs: ["palace_physician"], emoji: "📗", name: "เรียบเรียงตำรายาหลวง", desc: "ความรู้และชื่อเสียงยืนยาว", odds: by("smarts", 0.5), run: (l, s) => { addStat(l, "smarts", 2); l.flags.medicKnow = true; if (s) { addFame(l, 4); return ok("ตำรายาของคุณถูกคัดลอกไปใช้ทุกมณฑล"); } return meh("ตำรายังไม่สมบูรณ์ — แต่คุณเข้าใจยามากขึ้นอีกขั้น"); } },
  // ───── สายยุทธ์ ─────
  { id: "disc_serve", jobs: ["disciple"], emoji: "🧹", name: "รับใช้ผู้อาวุโสในสำนัก", desc: "ผู้อาวุโสอาจชี้แนะวิชา", odds: by("looks", 0.45), run: (l, s) => { perf(l, 8); if (s) { if (l.power) gainExp(l, 400); return ok("ผู้อาวุโสชี้ท่าที่คุณทำผิดมาสองปีในพริบตา"); } return meh("ผู้อาวุโสใช้งานคุณทั้งปีโดยไม่พูดอะไรสักคำ"); } },
  { id: "disc_mission", jobs: ["disciple", "wanderer"], emoji: "📯", name: "รับภารกิจลงเขา", desc: "ปราบโจร ได้ผลงาน", req: (l) => (l.power ? undefined : "ต้องฝึกวิชาแล้ว"), run: (l) => { startDuel(l, { foe: pick(l, ["โจรภูเขาที่ปล้นหมู่บ้าน", "ศิษย์ทรยศสำนัก", "จอมโจรเดียวดาย"]), rank: Math.max(0, l.power?.rank ?? 0), lethal: true, on: "bandit" }); perf(l, 10); return { text: "" }; } },
  { id: "wand_road", jobs: ["wanderer"], emoji: "🍶", name: "ช่วยเหลือคนตามทาง", desc: "ชื่อเสียงและมิตรสหาย", odds: by("luck", 0.5), run: (l, s) => { if (s) { addFame(l, 3); const p = createPerson(l, "friend", { age: l.age + randInt(l, -8, 8), bond: 55 }); return ok(`คุณช่วยขบวนผู้อพยพจากโจร — ${shortName(p)}สาบานจะตอบแทน${shiftAlign(l, 2)}`); } return meh("ปีนี้ถนนเงียบสงบ ไม่มีใครต้องการความช่วยเหลือ"); } },
];

export const jobActionsFor = (l: Life) => (l.worldId === "murim" && l.job ? JOB_ACTIONS.filter((a) => a.jobs.includes(l.job!.careerId)) : []);

export function jobActionLocked(l: Life, a: JobAction): string | undefined {
  if (!l.job || !a.jobs.includes(l.job.careerId)) return "ไม่ใช่งานของคุณ";
  if (Number(l.flags.jailUntil ?? -1) > l.age) return "ติดคุกอยู่";
  if (l.doneThisYear.includes(`job:${a.id}`)) return "ปีนี้ทำแล้ว";
  if ((timeLeft(l) ?? 1) < 1) return "ปีนี้ไม่มีเวลาเหลือ";
  if (a.minLevel && l.job.level < a.minLevel) return `ต้องเป็นตำแหน่งขั้น ${a.minLevel} ขึ้นไป`;
  if (a.cost && l.money < a.cost * TAEL) return `ต้องมี ${money(l, a.cost * TAEL)}`;
  if (l.queue.length) return "กำลังมีเหตุการณ์อยู่";
  return a.req?.(l);
}

export function doJobAction(l: Life, id: string): Outcome | undefined {
  const a = JOB_ACTIONS.find((x) => x.id === id);
  if (!a || jobActionLocked(l, a)) return;
  l.doneThisYear.push(`job:${a.id}`);
  if (a.cost) addMoney(l, -a.cost * TAEL);
  const p = a.odds?.(l);
  const s = p === undefined ? true : chance(l, p);
  const out = a.run(l, s);
  if (out.text) log(l, `${a.emoji} ${out.text}`, out.kind ?? "normal");
  return out;
}
