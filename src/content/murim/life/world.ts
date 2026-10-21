// Phase 1 — สภาพโลกยุทธภพ: ยุคเปลี่ยนจากแรงกดดันสะสม (ไม่ใช่ตัวนับเวลา) · วิกฤต 5 ระยะ · ราคาข้าวของ
// MURIM_PLAN §2, §18.8 · ทุกค่าเก็บใน life.mw (optional — เซฟเก่าสร้างให้อัตโนมัติ)
import { kinDeathHooks } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { clamp, log, people } from "../../../engine/util";

export type EraId = "peace" | "decline" | "chaos" | "recovery";
export type CrisisId = "famine" | "rebellion" | "plague" | "cult";

/** ระยะของวิกฤต: สัญญาณเตือน → เตรียมตัว → วิกฤต → ผลลัพธ์ → ผลระยะยาว */
export const CRISIS_STAGES = ["สัญญาณเตือน", "เตรียมรับมือ", "วิกฤต", "ผลลัพธ์", "ผลระยะยาว"] as const;

export interface MurimWorld {
  era: EraId;
  /** ปีปฏิทินที่ยุคนี้เริ่ม */
  eraSince: number;
  /** ความมั่นคงทางอาหาร 0–100 (ต่ำ = ข้าวแพง อดอยาก) */
  food: number;
  /** ความไม่พอใจของราษฎร 0–100 */
  unrest: number;
  /** ความชอบธรรมของราชวงศ์ 0–100 */
  legitimacy: number;
  /** อิทธิพลของพรรคมาร 0–100 */
  cult: number;
  crisis?: { id: CrisisId; stage: number; since: number };
  /** วิกฤตที่ผ่านมาแล้ว (ปีปฏิทิน) — ใช้ในบันทึกยุทธภพ */
  past?: { id: CrisisId; year: number }[];
}

export const ERA: Record<EraId, { name: string; desc: string }> = {
  peace: { name: "ยุคสงบสุข", desc: "บ้านเมืองสงบ ข้าวปลาอาหารพอกิน ยุทธภพแข่งกันด้วยชื่อเสียงมากกว่าดาบ" },
  decline: { name: "ยุคเสื่อมโทรม", desc: "ขุนนางโกงกิน ภาษีหนัก โจรผู้ร้ายชุกชุม ราษฎรเริ่มบ่น" },
  chaos: { name: "กลียุค", desc: "ราชสำนักคุมแผ่นดินไม่อยู่ ขุนศึกตั้งตนเป็นใหญ่ ชีวิตคนราคาถูกกว่าข้าวหนึ่งถัง" },
  recovery: { name: "ยุคฟื้นฟู", desc: "สงครามสงบลง ผู้คนกลับบ้านเกิด หัวเมืองเริ่มสร้างใหม่" },
};

export const CRISIS: Record<CrisisId, { name: string; warn: string; prep: string; hit: string; end: string; tail: string }> = {
  famine: {
    name: "ทุพภิกขภัย",
    warn: "ฝนไม่ตกมาสองฤดู ชาวนาบ่นว่ากล้าข้าวเหลืองตายคานา ราคาข้าวในตลาดเริ่มขยับ",
    prep: "พ่อค้าข้าวเริ่มกักตุน ทางการประกาศห้ามขนข้าวออกนอกมณฑล — ใครมีเงินก็รีบซื้อเก็บ",
    hit: "ข้าวยากหมากแพง! ผู้คนกินเปลือกไม้ประทังชีวิต ศพคนอดตายนอนเรียงริมถนน",
    end: "ฝนกลับมาตกตามฤดู ข้าวใหม่เริ่มออกรวง ราคาข้าวค่อยๆ ลดลง",
    tail: "หมู่บ้านหลายแห่งเหลือแต่บ้านร้าง ผู้รอดชีวิตจำได้ว่าใครแบ่งข้าว และใครกักตุน",
  },
  rebellion: {
    name: "กบฏชาวนา",
    warn: "มีใบปลิวติดตามกำแพงเมือง 'ฟ้าเก่าตายแล้ว ฟ้าใหม่จะขึ้นแทน' ทหารฉีกทิ้งไม่ทัน",
    prep: "กองกบฏโพกผ้าตั้งค่ายในป่าทางเหนือ ราชสำนักสั่งเกณฑ์ไพร่พล บ้านไหนมีชายฉกรรจ์ต้องส่งคน",
    hit: "กองกบฏแตกเข้าหัวเมือง! เผาที่ว่าการ ฆ่าขุนนาง ปล้นยุ้งฉาง — และไม่แยกว่าใครเป็นใคร",
    end: "ทัพหลวงปราบกบฏลงได้ หัวผู้นำกบฏถูกเสียบประจานหน้าประตูเมือง",
    tail: "ทางการไล่จับคนที่เคยเข้ากับกบฏ ใครเคยช่วยใครในคืนนั้น ต่างจำกันได้ดี",
  },
  plague: {
    name: "โรคระบาด",
    warn: "มีคนไข้ตัวร้อนจัดและไอเป็นเลือดในตลาดฝั่งตะวันออก หมอหลายคนส่ายหน้า",
    prep: "หมู่บ้านข้างเคียงปิดประตูไม่รับคนนอก ราคายาสมุนไพรพุ่งขึ้นสามเท่า",
    hit: "ห่าลงเมือง! เสียงระฆังส่งศพดังทั้งวันทั้งคืน ครอบครัวไหนมีคนป่วยต้องเลือกระหว่างดูแลกับหนี",
    end: "โรคระบาดค่อยๆ ซาลง ผู้รอดชีวิตเริ่มเผาบ้านคนตายและสร้างใหม่",
    tail: "หมอที่ไม่หนีกลายเป็นที่นับถือ ส่วนคนที่ขายยาปลอมถูกจดชื่อไว้ทุกคน",
  },
  cult: {
    name: "พรรคมารผงาด",
    warn: "สำนักเล็กๆ ทางตะวันตกหายไปทั้งสำนักในคืนเดียว เหลือแต่ธงดำปักกลางลาน",
    prep: "พันธมิตรยุทธภพเรียกประชุม ทุกสำนักถูกขอให้ส่งยอดฝีมือ ผู้คนลือว่ามารสวรรค์องค์ใหม่ขึ้นครองแล้ว",
    hit: "ทัพพรรคมารบุกที่ราบภาคกลาง! หมู่บ้านที่ขวางทางถูกเผา สำนักที่ต่อต้านถูกล้างทั้งสำนัก",
    end: "ทัพพรรคมารถอยกลับเขาตะวันตก ทั้งสองฝ่ายสูญเสียยอดฝีมือไปมาก",
    tail: "ยุทธภพนับศพและนับแค้น ความแค้นระหว่างธรรมะกับมารลึกลงอีกหนึ่งรุ่น",
  },
};

const isMurim = (l: Life) => l.worldId === "murim";
export const calYear = (l: Life) => l.birthYear + l.age;

/** สร้างสภาพโลกครั้งแรก (เกิดใหม่หรือเซฟเก่า) — สุ่มยุคตั้งต้นให้แต่ละชีวิตต่างกัน */
export function worldOfLife(l: Life): MurimWorld {
  if (!l.mw) {
    const era = pick(l, ["peace", "peace", "decline", "decline", "chaos", "recovery"] as EraId[]);
    const base = { peace: [70, 25, 75, 20], decline: [50, 50, 50, 35], chaos: [30, 75, 25, 50], recovery: [55, 40, 55, 30] }[era];
    l.mw = { era, eraSince: calYear(l) - randInt(l, 0, 15), food: base[0], unrest: base[1], legitimacy: base[2], cult: base[3] };
  }
  return l.mw;
}

/** ราคาของกิน/ค่าครองชีพเทียบปกติ (1 = ปกติ) */
export function priceIndex(l: Life): number {
  const w = worldOfLife(l);
  let p = 1 + (50 - w.food) / 60;
  if (w.crisis?.id === "famine" && w.crisis.stage >= 2 && w.crisis.stage <= 3) p *= 2.2;
  if (w.crisis?.id === "plague" && w.crisis.stage === 2) p *= 1.3;
  if (w.era === "chaos") p *= 1.3;
  return Math.round(clamp(p, 0.7, 5) * 100) / 100;
}

/** วิกฤตที่กำลังอยู่ในระยะ "วิกฤต" (ใช้ปรับความเสี่ยงของเหตุการณ์อื่น) */
export const crisisNow = (l: Life, id?: CrisisId) => {
  const c = l.mw?.crisis;
  return !!c && c.stage === 2 && (!id || c.id === id);
};

function nextEra(w: MurimWorld): EraId {
  if (w.legitimacy < 30 && w.unrest > 65) return "chaos";
  if (w.era === "chaos" && (w.legitimacy >= 30 || w.unrest <= 65)) return "recovery";
  if (w.era === "recovery" && w.unrest < 40 && w.food > 55) return "peace";
  if (w.era === "recovery") return "recovery";
  if (w.unrest > 50 || w.food < 40 || w.legitimacy < 45) return "decline";
  return "peace";
}

const FAMILY = ["father", "mother", "sibling", "spouse", "child"] as const;

/** ผลของวิกฤตระยะ "วิกฤต" ต่อชีวิตผู้เล่น (ปีละครั้ง) — ฉากให้ตัดสินใจอยู่ใน crisisEvents.ts */
function crisisToll(l: Life, id: CrisisId) {
  const kin = people(l, "father").concat(people(l, "mother"), people(l, "sibling"), people(l, "spouse"), people(l, "child")).filter((p) => p.alive);
  const risk = { famine: 0.05, rebellion: 0.04, plague: 0.08, cult: 0.03 }[id] * (l.flags.mwPrepared ? 0.5 : 1);
  for (const p of kin) {
    const frail = p.age < 6 || p.age > 60 ? 2 : 1;
    if (chance(l, risk * frail)) {
      p.alive = false;
      for (const h of kinDeathHooks) h(l, p, id === "rebellion" || id === "cult", id === "cult" ? "สาวกพรรคมาร" : id === "rebellion" ? "ทหารกบฏ" : undefined);
      const cause = { famine: "อดอาหาร", rebellion: "ถูกทหารกบฏฆ่า", plague: "โรคระบาด", cult: "ถูกสาวกมารสังหาร" }[id];
      log(l, `💔 ${p.name} เสียชีวิตเพราะ${cause} ในวัย ${p.age} ปี`, "bad");
      l.stats.happiness = clamp(l.stats.happiness - randInt(l, 10, 20), 0, 100);
    }
  }
  const hp = { famine: [3, 8], rebellion: [0, 4], plague: [2, 10], cult: [0, 3] }[id];
  l.stats.health = clamp(l.stats.health - randInt(l, hp[0], hp[1]) * (l.flags.mwPrepared ? 0.5 : 1), 0, 100);
}

const NEWS: Record<EraId, string[]> = {
  peace: [
    "ข่าวจากโรงน้ำชา: ปีนี้ข้าวราคาถูก ชาวนาจัดงานไหว้เทพเจ้าแห่งผืนดินกันทั้งอำเภอ",
    "ข่าวจากโรงน้ำชา: สำนักใหญ่สองสำนักแต่งงานลูกศิษย์ข้ามสำนักกัน งานเลี้ยงเจ็ดวันเจ็ดคืน",
    "ข่าวจากโรงน้ำชา: กองคาราวานจากแดนตะวันตกนำผ้าไหมกับเครื่องเทศมาขาย ตลาดคึกคักทั้งเดือน",
  ],
  decline: [
    "ข่าวจากโรงน้ำชา: นายอำเภอคนใหม่ขึ้นภาษีอีกสองส่วน ใครไม่จ่ายถูกยึดนา",
    "ข่าวจากโรงน้ำชา: โจรภูเขาปล้นกองคุ้มภัยกลางวันแสกๆ ทางการทำเป็นไม่เห็น",
    "ข่าวจากโรงน้ำชา: ขุนนางในเมืองหลวงแย่งชิงตำแหน่งกันจนลืมว่าทางใต้น้ำท่วม",
  ],
  chaos: [
    "ข่าวจากโรงน้ำชา: ขุนศึกทางเหนือประกาศตั้งตนเป็นอ๋อง ไม่ส่งส่วยให้เมืองหลวงอีกแล้ว",
    "ข่าวจากโรงน้ำชา: ทหารหนีทัพกลายเป็นโจร ปล้นหมู่บ้านทีละแห่งตามแนวแม่น้ำ",
    "ข่าวจากโรงน้ำชา: ราคาดาบหนึ่งเล่มแพงกว่าราคาลูกสาวหนึ่งคน — ผู้คนพูดกันแบบนั้นจริงๆ",
  ],
  recovery: [
    "ข่าวจากโรงน้ำชา: ทางการประกาศยกเว้นภาษีสามปีให้ผู้ที่กลับมาทำนาในหมู่บ้านร้าง",
    "ข่าวจากโรงน้ำชา: สำนักที่ถูกเผาเมื่อหลายปีก่อนเริ่มรับศิษย์ใหม่ บันไดขึ้นเขาเต็มไปด้วยเด็กกำพร้า",
    "ข่าวจากโรงน้ำชา: กองคาราวานสายแรกในรอบสิบปีเดินทางผ่านช่องเขาได้โดยไม่ถูกปล้น",
  ],
};

/** เดินโลกหนึ่งปี — เรียกจาก yearHooks (เฉพาะยุทธภพ) */
export function tickWorld(l: Life) {
  if (!isMurim(l) || !l.alive) return;
  const w = worldOfLife(l);
  const yr = calYear(l);

  // แรงกดดันเปลี่ยนตามเหตุและผล + ความผันผวนเล็กน้อย
  w.food = clamp(w.food + randInt(l, -9, 9) + (w.era === "chaos" ? -4 : 0) + (w.era === "recovery" ? 3 : 0) + (w.food < 30 ? 4 : 0), 0, 100);
  w.unrest = clamp(w.unrest + (w.food < 35 ? 6 : -2) + (w.legitimacy < 40 ? 4 : -1) + randInt(l, -4, 4), 0, 100);
  w.legitimacy = clamp(w.legitimacy + randInt(l, -4, 3) - (w.unrest > 70 ? 3 : 0) + (w.era === "recovery" ? 3 : 0) + (w.legitimacy < 20 ? 2 : 0), 0, 100);
  w.cult = clamp(w.cult + randInt(l, -3, 4) + (w.era === "chaos" ? 2 : 0), 0, 100);

  // วิกฤต: เดินทีละระยะ (ระยะ "วิกฤต" อาจยืดได้ 1 ปี)
  const c = w.crisis;
  if (c) {
    if (c.stage === 2) crisisToll(l, c.id);
    const stay = c.stage === 2 && yr - c.since < 3 && chance(l, 0.35);
    if (!stay) c.stage++;
    if (c.stage > 4) {
      (w.past ??= []).push({ id: c.id, year: c.since });
      w.crisis = undefined;
      l.flags.mwPrepared = false;
      // วิกฤตจบ: แรงกดดันคลาย
      if (c.id === "famine") w.food = clamp(w.food + 30, 0, 100);
      if (c.id === "rebellion") { w.unrest = clamp(w.unrest - 35, 0, 100); w.legitimacy = clamp(w.legitimacy - 10, 0, 100); }
      if (c.id === "plague") w.unrest = clamp(w.unrest - 10, 0, 100);
      if (c.id === "cult") w.cult = clamp(w.cult - 40, 0, 100);
    } else {
      const info = CRISIS[c.id];
      const text = [info.warn, info.prep, info.hit, info.end, info.tail][c.stage];
      log(l, `【${info.name} · ${CRISIS_STAGES[c.stage]}】 ${text}`, c.stage === 2 ? "bad" : c.stage === 3 ? "good" : "normal");
    }
  } else {
    const start: CrisisId | undefined =
      w.food < 22 ? "famine" : w.unrest > 80 ? "rebellion" : w.cult > 80 ? "cult" : chance(l, 0.015) ? "plague" : undefined;
    if (start && l.age >= 1) {
      w.crisis = { id: start, stage: 0, since: yr };
      log(l, `【${CRISIS[start].name} · ${CRISIS_STAGES[0]}】 ${CRISIS[start].warn}`, "normal");
    }
  }

  // เปลี่ยนยุค
  const next = nextEra(w);
  if (next !== w.era && yr - w.eraSince >= 6) {
    w.era = next;
    w.eraSince = yr;
    log(l, `🏮 แผ่นดินเข้าสู่${ERA[next].name} — ${ERA[next].desc}`, "milestone");
  } else if (l.age >= 8 && chance(l, 0.18)) {
    log(l, pick(l, NEWS[w.era]));
  }

  // ค่าครองชีพตามราคาข้าว (ส่วนต่างจากค่าครองชีพปกติที่หักไปแล้ว)
  if (l.age >= 18) {
    const kids = people(l, "child").filter((x) => x.alive && x.age < 18).length;
    const extra = Math.round((84_000 + kids * 60_000) * (priceIndex(l) - 1));
    if (extra !== 0) l.money -= extra;
  }
}

/** สรุปสภาพโลกสั้นๆ สำหรับหน้าจอ */
export function worldSummary(l: Life): { era: string; desc: string; price: number; crisis?: string } {
  const w = worldOfLife(l);
  return {
    era: ERA[w.era].name,
    desc: ERA[w.era].desc,
    price: priceIndex(l),
    crisis: w.crisis ? `${CRISIS[w.crisis.id].name} (${CRISIS_STAGES[w.crisis.stage]})` : undefined,
  };
}

export const familyOf = (l: Life) => l.people.filter((p) => p.alive && (FAMILY as readonly string[]).includes(p.relation));
