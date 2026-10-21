// Phase 2 — เป้าหมายชีวิต: แรงผลักที่ทำให้แต่ละชีวิตมีเรื่องราว (MURIM_PLAN §18.1)
// เป้าหมายหลัก 1 ข้อ (+ รองได้อีก 2) · มีขั้นตอนที่มองเห็น · จบได้หลายแบบ · เปลี่ยนได้เมื่อมีเหตุการณ์สำคัญ ไม่ใช่สุ่มเปลี่ยน
import type { GameEvent, Outcome } from "../../../engine/events";
import { feel, relOf } from "../../../engine/npc";
import { pick, randInt } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { addFame, addStat, createPerson, log, people, shortName } from "../../../engine/util";
import { DUEL_END, startDuel } from "./duel";

export interface LifeGoal {
  id: string;
  /** ขั้นที่ผ่านแล้ว (0 = เพิ่งตั้งเป้า) */
  step: number;
  /** อายุตอนตั้งเป้า */
  since: number;
  /** จบแล้ว: สำเร็จ / ล้มเหลว / เปลี่ยนใจ */
  end?: "won" | "lost" | "changed";
  /** คนที่เกี่ยวข้อง (เช่น ศัตรูที่ต้องล้างแค้น) */
  pid?: string;
  /** ทำไมถึงตั้งเป้านี้ (แสดงในบันทึก) */
  why?: string;
}

interface GoalDef {
  id: string;
  emoji: string;
  name: string;
  /** ชื่อขั้นแต่ละขั้น — ผ่านครบ = สำเร็จ */
  steps: string[];
  /** ตรวจทุกปีว่าผ่านขั้นถัดไปหรือยัง */
  passed: (l: Life, step: number, g: LifeGoal) => boolean;
  won: string;
  /** รางวัลตอนสำเร็จ */
  reward?: (l: Life) => void;
}

const kids = (l: Life) => people(l, "child").filter((c) => c.alive);
const rank = (l: Life) => l.power?.rank ?? -1;

export const GOALS: GoalDef[] = [
  {
    id: "peak", emoji: "⚔️", name: "เป็นยอดฝีมือแห่งยุค",
    steps: ["ทะลวงเส้นชีพจร เริ่มฝึกวิชา", "ก้าวสู่ยอดฝีมือขั้นสอง", "ก้าวสู่ยอดฝีมือขั้นหนึ่ง", "แตะจุดสูงสุดของวิชา"],
    passed: (l, s) => [!!l.power, rank(l) >= 2, rank(l) >= 4, rank(l) >= 6][s],
    won: "ชื่อของคุณถูกเอ่ยถึงในทุกโรงน้ำชา — เด็กๆ เล่นเป็นคุณตอนเล่นจอมยุทธ์",
    reward: (l) => addFame(l, 15),
  },
  {
    id: "wealth", emoji: "💰", name: "ร่ำรวยและเป็นอิสระ",
    steps: ["มีเงินเก็บสองร้อยตำลึง", "มีเงินเก็บสองพันตำลึง", "มีเงินเก็บสองหมื่นตำลึง"],
    passed: (l, s) => l.money - l.debt >= [200_000, 2_000_000, 20_000_000][s],
    won: "คุณไม่ต้องก้มหัวให้ใครอีกแล้ว — คนที่เคยดูถูกคุณ ตอนนี้ต้องมาขอยืมเงิน",
    reward: (l) => addStat(l, "happiness", 15),
  },
  {
    id: "family", emoji: "🏡", name: "มีครอบครัวที่อบอุ่น",
    steps: ["แต่งงานกับคนที่รัก", "มีลูกคนแรก", "เลี้ยงลูกจนโตเป็นผู้ใหญ่", "ครอบครัวพร้อมหน้าในวันตรุษ"],
    passed: (l, s) => [people(l, "spouse").length > 0, kids(l).length > 0, kids(l).some((c) => c.age >= 16), kids(l).length >= 2 && people(l, "spouse").length > 0][s],
    won: "เย็นวันตรุษ บ้านคุณเสียงดังที่สุดในซอย — คุณมองทุกคนแล้วรู้ว่าชีวิตนี้ไม่เสียเปล่า",
    reward: (l) => addStat(l, "happiness", 20),
  },
  {
    id: "healer", emoji: "🌿", name: "เป็นหมอที่ช่วยชีวิตคน",
    steps: ["เป็นลูกมือร้านยา", "ได้เป็นหมอยา", "เป็นหมอที่มีชื่อเสียง"],
    passed: (l, s) => { const j = l.job?.careerId === "herbalist" ? l.job.level : 0; return [j >= 1, j >= 2, j >= 3 && l.fame >= 15][s]; },
    won: "ชาวบ้านสามอำเภอรู้จักชื่อคุณ คนที่คุณรักษาหายส่งไก่กับไข่มาให้ไม่ขาด",
    reward: (l) => addFame(l, 10),
  },
  {
    id: "official", emoji: "📯", name: "รับราชการเป็นขุนนาง",
    steps: ["ร่ำเรียนจนแตกฉาน", "ได้ตำแหน่งในที่ว่าการ", "ได้เป็นเจ้าเมือง"],
    passed: (l, s) => { const j = l.job?.careerId === "official" ? l.job.level : 0; return [l.stats.smarts >= 60, j >= 1, j >= 3][s]; },
    won: "ขบวนแห่ต้อนรับเจ้าเมืองคนใหม่ผ่านหน้าบ้านเก่าของคุณ — พ่อแม่ร้องไห้ด้วยความภูมิใจ",
    reward: (l) => addFame(l, 12),
  },
  {
    id: "wander", emoji: "🗺️", name: "ท่องให้ทั่วแผ่นดิน",
    steps: ["ออกจากบ้านเกิด", "เดินทางครบห้าปี", "มีสหายทั่วยุทธภพ"],
    passed: (l, s) => { const y = Number(l.flags.mwWanderYears ?? 0); return [y >= 1, y >= 5, people(l, "friend").length >= 4][s]; },
    won: "คุณเคยเห็นทะเลทราย ทะเลสาบ และหิมะบนยอดเขา — ที่ไหนก็มีคนเรียกคุณว่าสหาย",
    reward: (l) => addStat(l, "happiness", 15),
  },
  {
    id: "quiet", emoji: "🍵", name: "ใช้ชีวิตสงบสุข",
    steps: ["มีบ้านและครอบครัวของตัวเอง", "อยู่อย่างสงบสิบปี", "แก่ตัวอย่างมีความสุข"],
    passed: (l, s, g) => [people(l, "spouse").length > 0 || l.age >= 30, l.age - g.since >= 10 && l.stats.happiness >= 50, l.age >= 60 && l.stats.happiness >= 60][s],
    won: "คุณนั่งจิบชาใต้ต้นท้อหลังบ้าน ยุทธภพจะวุ่นวายแค่ไหน ก็ไม่ใช่เรื่องของคุณอีกแล้ว",
    reward: (l) => addStat(l, "health", 10),
  },
  {
    id: "revenge", emoji: "🩸", name: "ล้างแค้น",
    steps: ["สืบหาตัวคนที่ทำ", "ฝึกจนแข็งแกร่งพอ", "เผชิญหน้าศัตรู"],
    passed: (l, s, g) => {
      const foe = l.people.find((p) => p.id === g.pid);
      if (!foe || !foe.alive) return s === 2; // ศัตรูตายไปเองแล้ว
      return [l.age - g.since >= 2 && (l.stats.smarts >= 45 || Number(l.flags.mwWanderYears ?? 0) >= 1), rank(l) >= Math.max(1, Number(foe.tags?.find((t) => t.startsWith("rank:"))?.slice(5) ?? 2)), false][s];
    },
    won: "ความแค้นที่แบกมาหลายปีจบลงแล้ว — คุณรู้สึกเบา หรืออาจจะว่างเปล่า",
  },
];

export const goalById = (id: string) => GOALS.find((g) => g.id === id);
export const mainGoal = (l: Life) => l.goals?.find((g) => !g.end);

export function setGoal(l: Life, id: string, why?: string, pid?: string) {
  const cur = mainGoal(l);
  if (cur) cur.end = "changed";
  (l.goals ??= []).push({ id, step: 0, since: l.age, why, pid });
  const d = goalById(id)!;
  log(l, `🎯 เป้าหมายชีวิตใหม่: ${d.emoji} ${d.name}${why ? ` — ${why}` : ""}`, "milestone");
}

/** ตรวจความคืบหน้าทุกปี (yearHook) */
export function tickGoals(l: Life) {
  if (l.worldId !== "murim" || !l.alive) return;
  if (l.flags.plan === "wander") l.flags.mwWanderYears = Number(l.flags.mwWanderYears ?? 0) + 1;
  const g = mainGoal(l);
  if (!g) return;
  const d = goalById(g.id);
  if (!d) return;
  // ผ่านได้ปีละหนึ่งขั้น
  if (g.step < d.steps.length && d.passed(l, g.step, g)) {
    g.step++;
    if (g.step >= d.steps.length) {
      g.end = "won";
      d.reward?.(l);
      l.flags[`goalWon_${g.id}`] = true;
      log(l, `🏆 เป้าหมายชีวิตสำเร็จ: ${d.name} — ${d.won}`, "milestone");
    } else {
      log(l, `🎯 ${d.name}: ${d.steps[g.step - 1]} ✓ (ขั้นต่อไป: ${d.steps[g.step]})`, "good");
    }
  }
}

/** ข้อความสั้นสำหรับหน้าจอหลัก */
export function goalLine(l: Life): string | undefined {
  const g = mainGoal(l);
  const d = g && goalById(g.id);
  if (!g || !d) return;
  return `${d.emoji} ${d.name} (${g.step}/${d.steps.length}) · ถัดไป: ${d.steps[Math.min(g.step, d.steps.length - 1)]}`;
}

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

/** ศัตรูที่ต้องล้างแค้น */
const foeOf = (l: Life) => l.people.find((p) => p.id === mainGoal(l)?.pid);

export const GOAL_EVENTS: GameEvent[] = [
  {
    id: "goal.choose",
    minAge: 13,
    maxAge: 90,
    forced: true,
    when: (l) => !mainGoal(l) && !l.goals?.length,
    title: "ความฝัน",
    text: (l) => l.age <= 25 ? `คืนนั้นคุณนอนมองดาวบนหลังคาบ้าน${l.flags.beggarMaster ? " นึกถึงคำของขอทานแก่คนนั้น" : ""} แล้วถามตัวเองว่า — ชีวิตนี้อยากเป็นอะไร` : `อายุ ${l.age} แล้ว คืนหนึ่งคุณนั่งอยู่คนเดียวหน้าตะเกียง แล้วถามตัวเองว่า — ที่เหลือของชีวิตนี้ อยากใช้ไปกับอะไร`,
    choices: [
      { label: "⚔️ เป็นยอดฝีมือที่ทั้งยุทธภพต้องจดจำ", run: (l) => { setGoal(l, "peak", "ฝันตั้งแต่เด็กว่าจะยืนอยู่บนจุดสูงสุด"); return good("คุณกำหมัดแน่น ดาวดวงหนึ่งตกพาดฟ้าพอดี"); } },
      { label: "💰 ร่ำรวย จะไม่ให้ครอบครัวอดอยากอีก", run: (l) => { setGoal(l, "wealth", l.wealth === "poor" ? "เพราะเคยหิวจนนอนไม่หลับ" : "เพราะเงินคืออิสรภาพ"); return good("คุณนับเหรียญในกระปุกอีกครั้ง แล้ววางแผนในหัวจนถึงเช้า"); } },
      { label: "🏡 มีครอบครัวที่อบอุ่น", run: (l) => { setGoal(l, "family", "อยากให้ลูกหลานได้สิ่งที่ตัวเองเคยได้ — หรือไม่เคยได้"); return good("คุณยิ้มอยู่คนเดียวบนหลังคา"); } },
      { label: "🌿 เป็นหมอที่ช่วยชีวิตคน", run: (l) => { setGoal(l, "healer", "เพราะเคยเห็นคนตายต่อหน้าเพราะไม่มีหมอ"); return good("คุณนึกถึงกลิ่นสมุนไพรในร้านยาหัวมุมตลาด"); } },
      { label: "📯 สอบเข้ารับราชการ", show: (l) => l.stats.smarts >= 45, run: (l) => { setGoal(l, "official", "ตระกูลจะได้ไม่ต้องก้มหัวให้ใคร"); return good("คุณหยิบตำราขึ้นมาอ่านต่อใต้แสงจันทร์"); } },
      { label: "🗺️ ออกไปดูโลกให้ทั่วแผ่นดิน", run: (l) => { setGoal(l, "wander", "หมู่บ้านนี้เล็กเกินไปสำหรับความฝัน"); return good("คุณมองถนนที่ทอดออกไปนอกหมู่บ้าน แล้วตัดสินใจ"); } },
      { label: "🍵 ขอแค่ชีวิตสงบสุข", run: (l) => { setGoal(l, "quiet", "ยุทธภพวุ่นวายเกินไป"); return meh("คุณหลับไปบนหลังคา จนแม่ต้องตะโกนเรียกลงมากินข้าว"); } },
    ],
  },
  {
    id: "goal.revenge_offer",
    minAge: 10,
    maxAge: 70,
    forced: true,
    // พ่อหรือแม่ถูกฆ่า (ไม่ใช่ตายตามธรรมชาติ) ปีนี้
    when: (l) => l.flags.mwKinKilled === l.age && mainGoal(l)?.id !== "revenge",
    title: "เลือดต้องล้างด้วยเลือด",
    text: (l) => `คุณยืนหน้าหลุมศพของ${String(l.flags.mwKinKilledName ?? "คนที่คุณรัก")} ชาวบ้านกระซิบว่าเห็นคนลงมือ — ${String(l.flags.mwKillerName ?? "ชายสวมหน้ากาก")}`,
    choices: [
      {
        label: "🩸 สาบานว่าจะล้างแค้น",
        run: (l) => {
          const foe = createPerson(l, "rival", { age: l.age + randInt(l, 10, 25), bond: 0, gender: "m" });
          foe.name = String(l.flags.mwKillerName ?? foe.name);
          foe.tags = ["killer", `rank:${Math.max(1, Math.min(6, (l.power?.rank ?? 0) + randInt(l, 1, 3)))}`];
          feel(foe, { grudge: 30, love: -30 });
          setGoal(l, "revenge", `ให้${String(l.flags.mwKinKilledName ?? "คนในครอบครัว")}ที่ถูกฆ่า`, foe.id);
          return bad("คุณกรีดฝ่ามือให้เลือดหยดลงบนดินหน้าหลุมศพ — เป้าหมายเดิมของชีวิตไม่สำคัญอีกต่อไป");
        },
      },
      { label: "ปล่อยให้ทางการจัดการ แล้วใช้ชีวิตต่อ", run: (l) => { addStat(l, "happiness", -8); return meh("ทางการรับเรื่องไว้ แล้วก็เงียบหายไป คุณพยายามไม่คิดถึงมัน"); } },
    ],
  },
  {
    id: "goal.healer_offer",
    minAge: 12,
    maxAge: 50,
    forced: true,
    when: (l) => l.flags.mwKinSick === l.age && mainGoal(l)?.id !== "healer" && mainGoal(l)?.id !== "revenge",
    title: "ถ้าตอนนั้นมีหมอ",
    text: (l) => `${String(l.flags.mwKinSickName ?? "คนในครอบครัว")}จากไปเพราะโรคที่หมอดีๆ อาจรักษาได้ — แต่หมอดีๆ ไม่เคยมาถึงหมู่บ้านนี้`,
    choices: [
      { label: "🌿 ตั้งใจจะเป็นหมอ ไม่ให้ใครต้องตายแบบนี้อีก", run: (l) => { setGoal(l, "healer", "เพราะไม่อยากให้ใครต้องเสียคนที่รักแบบเดียวกัน"); return good("คุณเดินเข้าร้านยาหัวมุมตลาด ขอเป็นลูกมือโดยไม่เอาค่าจ้าง"); } },
      { label: "ยึดเป้าหมายเดิมต่อไป", run: (l) => { addStat(l, "happiness", -4); return meh("ความเศร้าไม่ได้เปลี่ยนเส้นทางของคุณ — แต่มันจะอยู่กับคุณไปอีกนาน"); } },
    ],
  },
  {
    id: "goal.revenge_confront",
    minAge: 14,
    maxAge: 90,
    forced: true,
    when: (l) => { const g = mainGoal(l); return g?.id === "revenge" && g.step === 2 && !!foeOf(l)?.alive; },
    title: "เผชิญหน้า",
    text: (l) => { const f = foeOf(l)!; return `ในที่สุดคุณก็ตามเจอ${shortName(f)} — เขาแก่ลงมาก${f.tags?.includes("married") ? " มีลูกหลานรายล้อม" : " นั่งดื่มเหล้าอยู่คนเดียว"} เขาจำหน้าคุณได้ทันที`; },
    choices: [
      {
        label: "ท้าสู้จนตายกันไปข้าง",
        tone: "danger",
        pros: "จบความแค้นด้วยมือตัวเอง",
        cons: "สู้ถึงตาย — แพ้อาจไม่รอด หรือเสียอวัยวะ",
        run: (l) => {
          const f = foeOf(l)!;
          startDuel(l, { foe: shortName(f), rank: foeRank(f), lethal: true, pid: f.id, on: "revenge", cruel: true });
          return { text: `${shortName(f)}วางจอกเหล้าลงช้าๆ แล้วลุกขึ้น "ข้ารอวันนี้มานานแล้วเหมือนกัน"` };
        },
      },
      {
        label: "ให้อภัย แล้วเดินจากไป",
        run: (l) => {
          const g = mainGoal(l)!;
          const f = foeOf(l);
          g.end = "changed";
          if (f) feel(f, { debt: 40, grudge: -30 });
          addStat(l, "happiness", 6);
          return { text: "คุณวางกระบี่ลงบนโต๊ะเขาแล้วเดินออกมา ความแค้นไม่ได้หายไป — แต่คุณเลือกที่จะไม่ให้มันเป็นเจ้าของชีวิตอีกต่อไป", kind: "milestone" };
        },
      },
      {
        label: "ลากตัวไปให้ทางการตัดสิน",
        check: { stat: "smarts", dc: 55 },
        run: (l, _c, ok) => {
          const g = mainGoal(l)!;
          const f = foeOf(l);
          if (ok) { g.step = 3; g.end = "won"; l.flags.goalWon_revenge = true; if (f) f.alive = false; addFame(l, 8); return { text: "พยานสามคนกับหลักฐานที่คุณเก็บมาหลายปีทำให้ศาลตัดสินประหาร คุณยืนดูอยู่ท้ายฝูงชน", kind: "milestone" }; }
          return bad("ศาลยกฟ้องเพราะหลักฐานไม่พอ — เขาเดินออกจากศาลพร้อมยิ้มให้คุณ");
        },
      },
    ],
  },
];

const foeRank = (f: Person) => Number(f.tags?.find((t) => t.startsWith("rank:"))?.slice(5) ?? 2);

// ผลการต่อสู้ล้างแค้น
DUEL_END.revenge = (l, r) => {
  const g = l.goals?.find((x) => x.id === "revenge" && !x.end);
  if (!g) return "";
  if (r === "win") {
    g.step = 3;
    g.end = "won";
    l.flags.goalWon_revenge = true;
    addFame(l, 5);
    return "— ความแค้นที่แบกมาหลายปีจบลงแล้ว";
  }
  if (r === "lose" || r === "yield") return "ศัตรูยังลอยนวลอยู่ — และตอนนี้เขารู้แล้วว่าคุณตามมา";
  return "";
};

/** ตั้งธงเมื่อครอบครัวเสียชีวิต (ใช้กระตุ้นการเปลี่ยนเป้าหมาย) — เรียกจากที่ที่มีการตาย */
export function noteKinDeath(l: Life, p: Person, violent: boolean, killer?: string) {
  if (!["father", "mother", "sibling", "spouse", "child"].includes(p.relation)) return;
  if (violent) {
    l.flags.mwKinKilled = l.age;
    l.flags.mwKinKilledName = shortName(p);
    l.flags.mwKillerName = killer ?? pick(l, ["ชายหน้าบากจากหุบเขาดำ", "หัวหน้าโจรภูเขาเฮยเฟิง", "นายน้อยตระกูลเหยียน", "มือสังหารไร้นาม"]);
  } else {
    l.flags.mwKinSick = l.age;
    l.flags.mwKinSickName = shortName(p);
  }
  relOf(p);
}
