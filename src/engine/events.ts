import { weightedPick } from "./rng";
import { worldMatches } from "../content/worlds";
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
  /** "modern" = ทุกโลกยุคปัจจุบัน (Hunter, หอคอย …) */
  world?: WorldId | "modern";
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
export function registerEvents(events: GameEvent[], world?: WorldId | "modern") {
  for (const e of events) {
    if (registry.has(e.id)) throw new Error(`event ซ้ำ: ${e.id}`);
    registry.set(e.id, world && !e.world ? { ...e, world } : e);
  }
}

export const getEvent = (id: string) => registry.get(id);
export const allEvents = () => [...registry.values()];

/**
 * ตัวเลือกเสริมที่ content เติมเข้าไปในทุกฉาก (เช่น "ใช้สกิล") — ต่อท้ายตัวเลือกเดิมเสมอ
 * ต้องคำนวณจากสถานะชีวิตอย่างเดียว เพื่อให้ index ตรงกันระหว่างแสดงผลกับตอนเลือก
 */
export const sceneExtras: Array<(life: Life, scene: Scene, ctx: Ctx) => Choice[]> = [];

/** ฉากปัจจุบันของ event ที่อยู่ในคิว (ส่ง life มาด้วยเพื่อรวมตัวเลือกเสริม) */
export function currentScene(q: QueuedEvent, life?: Life): Scene | undefined {
  const e = getEvent(q.eventId);
  if (!e) return;
  const s = q.scene && q.scene !== "start" ? e.scenes?.[q.scene] : { title: e.title, system: e.system, text: e.text, choices: e.choices ?? [] };
  if (!s || !life) return s;
  const extra = sceneExtras.flatMap((f) => f(life, s, q.ctx));
  return extra.length ? { ...s, choices: [...s.choices, ...extra] } : s;
}

function eligible(life: Life, e: GameEvent, takenThisYear: Set<string>): boolean {
  if (e.manual) return false;
  if (e.world && !worldMatches(e.world, life.worldId)) return false;
  if (life.age < e.minAge || life.age > e.maxAge) return false;
  if (takenThisYear.has(e.id)) return false;
  const max = e.maxTimes ?? 1;
  if (max > 0 && (life.seen[e.id] ?? 0) >= max) return false;
  return e.when ? e.when(life) : true;
}

function weightOf(life: Life, e: GameEvent) {
  return typeof e.weight === "function" ? e.weight(life) : (e.weight ?? 10);
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
  const s = currentScene(q, life);
  if (!s) return [];
  return s.choices
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => (c.show ? c.show(life, q.ctx) : true));
}
