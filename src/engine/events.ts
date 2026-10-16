import { weightedPick } from "./rng";
import type { Life, LogKind, QueuedEvent, StatKey, WorldId } from "./types";

export type Ctx = Record<string, string | number | boolean>;

export interface Outcome {
  text: string;
  kind?: LogKind;
  /** ตอนพิเศษ: ไปฉากถัดไป (ไม่ใส่ = จบตอน) */
  next?: string;
}

export interface Choice {
  label: string | ((life: Life, ctx: Ctx) => string);
  /** ถ้ามี จะแสดง % สำเร็จให้ผู้เล่นเห็นก่อนเลือก */
  check?: { stat: StatKey; dc: number; bonus?: (life: Life, ctx: Ctx) => number };
  /** โอกาสสำเร็จแบบคำนวณเอง (0-1) ใช้แทน check เช่น การต่อสู้ที่ใช้พลังต่อสู้ */
  odds?: (life: Life, ctx: Ctx) => number;
  show?: (life: Life, ctx: Ctx) => boolean;
  /** special = ตัวเลือกจากพรสวรรค์/ความทรงจำ/ระบบ · danger = เสี่ยงตาย */
  tone?: "special" | "danger";
  /** โอกาสรอดชีวิตที่จะแสดงเป็นคำเตือน (0-1) */
  survival?: (life: Life, ctx: Ctx) => number;
  run: (life: Life, ctx: Ctx, success: boolean) => Outcome;
}

export interface Scene {
  title?: string;
  system?: boolean;
  text: (life: Life, ctx: Ctx) => string;
  choices: Choice[];
}

export interface GameEvent {
  id: string;
  world?: WorldId;
  minAge: number;
  maxAge: number;
  weight?: number | ((life: Life) => number);
  /** เกิดได้กี่ครั้งต่อชีวิต (ค่าเริ่มต้น 1) — ใส่ 0 = ไม่จำกัด */
  maxTimes?: number;
  /** ถ้าเงื่อนไขผ่าน เกิดแน่นอนในปีนั้น */
  forced?: boolean;
  /** ไม่ถูกสุ่มเอง — เรียกจากปุ่มหรือ event อื่นเท่านั้น */
  manual?: boolean;
  when?: (life: Life) => boolean;
  prepare?: (life: Life) => Ctx;
  /** แสดงเป็นหน้าต่างระบบสีฟ้า */
  system?: boolean;
  title?: string;
  text: (life: Life, ctx: Ctx) => string;
  /** event แบบไม่มีตัวเลือก: ใส่ผลตรงนี้ แล้วข้อความจาก text จะถูกบันทึก */
  auto?: (life: Life, ctx: Ctx) => LogKind | void;
  choices?: Choice[];
  /** ตอนพิเศษหลายฉาก: ฉากแรกคือ text/choices ด้านบน ("start") ฉากต่อไปอยู่ที่นี่ */
  scenes?: Record<string, Scene>;
}

const registry = new Map<string, GameEvent>();
const QUIET_WEIGHT = 25;

/** world: event เกิดเฉพาะในโลกนั้น · ไม่ใส่ = ทุกโลก */
export function registerEvents(events: GameEvent[], world?: WorldId) {
  for (const e of events) {
    if (registry.has(e.id)) throw new Error(`event ซ้ำ: ${e.id}`);
    registry.set(e.id, world && !e.world ? { ...e, world } : e);
  }
}

export const getEvent = (id: string) => registry.get(id);
export const allEvents = () => [...registry.values()];

/** ฉากปัจจุบันของ event ที่อยู่ในคิว */
export function currentScene(q: QueuedEvent): Scene | undefined {
  const e = getEvent(q.eventId);
  if (!e) return;
  if (q.scene && q.scene !== "start") return e.scenes?.[q.scene];
  return { title: e.title, system: e.system, text: e.text, choices: e.choices ?? [] };
}

function eligible(life: Life, e: GameEvent, takenThisYear: Set<string>): boolean {
  if (e.manual) return false;
  if (e.world && e.world !== (life.worldId ?? "hunter")) return false;
  if (life.age < e.minAge || life.age > e.maxAge) return false;
  if (takenThisYear.has(e.id)) return false;
  const max = e.maxTimes ?? 1;
  if (max > 0 && (life.seen[e.id] ?? 0) >= max) return false;
  return e.when ? e.when(life) : true;
}

/** Focus ประจำปีทำให้ event บางกลุ่มเกิดบ่อยขึ้น */
const FOCUS_BOOST: Record<string, RegExp> = {
  power: /gate|quest|tournament|guild|sect|master|devour|second_awakening|monster|bandit/,
  money: /lottery|stock|recipe|sponsor|core|black|condo|car|business|plague/,
  love: /crush|love|matchmaker|senior|royal|contract|letter|teammate|reunion|maid_life|festival|lantern/,
  study: /exam|olympiad|library|scholar|homework|tutor|academy/,
};

function weightOf(life: Life, e: GameEvent) {
  const w = typeof e.weight === "function" ? e.weight(life) : (e.weight ?? 10);
  const focus = life.flags.focus as string | undefined;
  if (!focus || w <= 0) return w;
  if (focus === "secret" && e.title) return w * 1.8; // สืบความลับ: เหตุการณ์ใหญ่และวาสนา
  return FOCUS_BOOST[focus]?.test(e.id) ? w * 1.7 : w;
}

/** event ที่ถูกเลือกไว้ต้นปีอาจหมดเงื่อนไขเพราะ event ก่อนหน้าในปีเดียวกัน (เช่น เพื่อนเพิ่งตาย) */
export function stillValid(life: Life, e: GameEvent) {
  return (e.when ? e.when(life) : true) && weightOf(life, e) > 0;
}

/** เลือก event ของปีนี้: forced ทั้งหมด + สุ่มอีก count อัน */
export function pickEvents(life: Life, count: number): GameEvent[] {
  const taken = new Set<string>();
  const picked: GameEvent[] = [];
  for (const e of registry.values()) {
    if (e.forced && eligible(life, e, taken)) {
      picked.push(e);
      taken.add(e.id);
    }
  }
  for (let i = 0; i < count; i++) {
    const pool: (GameEvent | null)[] = [...registry.values()].filter((e) => !e.forced && eligible(life, e, taken));
    // "ปีที่ไม่มีอะไรเกิดขึ้น" — กันไม่ให้ event น้ำหนักต่ำถูกเลือกแน่ๆ ตอนที่ event อื่นหมดแล้ว
    pool.push(null);
    const e = weightedPick(life, pool, (x) => (x ? weightOf(life, x) : QUIET_WEIGHT));
    if (!e) continue;
    picked.push(e);
    taken.add(e.id);
  }
  return picked;
}

export function labelOf(c: Choice, life: Life, ctx: Ctx) {
  return typeof c.label === "function" ? c.label(life, ctx) : c.label;
}

export function visibleChoices(life: Life, q: QueuedEvent) {
  const s = currentScene(q);
  if (!s) return [];
  return s.choices
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => (c.show ? c.show(life, q.ctx) : true));
}
