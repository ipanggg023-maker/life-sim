// M19 — ระบบเฉพาะของโลกหอคอย: กฎประหลาดประจำช่วงชั้น · ทีมของตัวเอง · โต๊ะพนันของดวงดาว
// เก็บสถานะทั้งหมดใน life.flags (สตริง JSON / ตัวเลข) — ไม่แตะ engine/types.ts
// ห้าม import climb.ts (climb.ts import ไฟล์นี้)
import type { Choice, Ctx, Outcome } from "../../engine/events";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, log, money, people, shortName } from "../../engine/util";
import { SPONSORS, sponsorOf, type Sponsor } from "../sponsors";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });

function readJson<T>(l: Life, key: string, fallback: T): T {
  const raw = l.flags[key];
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
const writeJson = (l: Life, key: string, v: unknown) => { l.flags[key] = JSON.stringify(v); };
const num = (l: Life, key: string) => Number(l.flags[key] ?? 0);
const bump = (l: Life, key: string, d = 1) => { l.flags[key] = num(l, key) + d; };

// ═════════════════════════ ทีม ═════════════════════════

export type RoleId = "vanguard" | "lancer" | "lantern" | "wave" | "scout";
export const ROLES: Record<RoleId, { name: string; emoji: string }> = {
  vanguard: { name: "หัวหอก", emoji: "⚔️" },
  lancer: { name: "มือขว้างหอก", emoji: "🔱" },
  lantern: { name: "ผู้ถือโคม", emoji: "🏮" },
  wave: { name: "ผู้ควบคุมพลังงาน", emoji: "🌊" },
  scout: { name: "หน่วยสอดแนม", emoji: "👣" },
};
const ROLE_IDS = Object.keys(ROLES) as RoleId[];
export const TEAM_MAX = 5;

export interface Mate {
  role: RoleId;
  lv: number;
  /** ใจที่มีให้คุณ 0–3 (3 = พร้อมสารภาพรัก) */
  love?: number;
}
export type Roster = Record<string, Mate>;

export const rosterOf = (l: Life): Roster => readJson<Roster>(l, "t19roster", {});
const saveRoster = (l: Life, r: Roster) => writeJson(l, "t19roster", r);
export const teamName = (l: Life) => (typeof l.flags.t19team === "string" ? l.flags.t19team : "");

export interface Member { p: Person; m: Mate }
/** สมาชิกทีมที่ยังมีชีวิต (เพื่อนร่วมทีม หรือคนรักที่ยังปีนด้วยกัน) */
export function team(l: Life): Member[] {
  const r = rosterOf(l);
  return l.people.filter((p) => p.alive && r[p.id] && ["ally", "partner", "spouse"].includes(p.relation)).map((p) => ({ p, m: r[p.id] }));
}
export const teamSize = (l: Life) => team(l).length;
export const hasRole = (l: Life, role: RoleId) => team(l).some((x) => x.m.role === role);

export function addMate(l: Life, p: Person, role?: RoleId, lv = 1) {
  const r = rosterOf(l);
  r[p.id] = { role: role ?? roleFromText(l, p.job), lv };
  saveRoster(l, r);
}
export function removeMate(l: Life, id: string) {
  const r = rosterOf(l);
  delete r[id];
  saveRoster(l, r);
}
export function updateMate(l: Life, id: string, f: (m: Mate) => void) {
  const r = rosterOf(l);
  if (!r[id]) return;
  f(r[id]);
  saveRoster(l, r);
}

/** เดาตำแหน่งจากบุคลิกที่ระบบปาร์ตี้ตั้งให้ ("ผู้ถือโคมขี้กลัว…") */
function roleFromText(l: Life, text?: string): RoleId {
  const hit = ROLE_IDS.find((id) => text?.includes(ROLES[id].name));
  return hit ?? pick(l, ROLE_IDS);
}

export const roleName = (m: Mate) => `${ROLES[m.role].emoji}${ROLES[m.role].name}`;
export const memberLabel = (x: Member) => `${shortName(x.p)} (${ROLES[x.m.role].name} Lv.${x.m.lv})`;

/** ความเข้าขาของทีม: ตำแหน่งครบ + เลเวล + ความผูกพัน → โอกาสผ่านด่าน (−5% … +15%) */
export function synergy(l: Life): number {
  const t = team(l);
  if (!t.length) return 0;
  const roles = new Set(t.map((x) => x.m.role)).size;
  const avgLv = t.reduce((s, x) => s + x.m.lv, 0) / t.length;
  const avgBond = t.reduce((s, x) => s + x.p.bond, 0) / t.length;
  return clamp(roles * 0.018 + avgLv * 0.005 + (avgBond - 50) / 600 + (teamName(l) ? 0.01 : 0) - (l.flags.t19teamRift ? 0.04 : 0), -0.05, 0.15);
}

/** หลังผ่านผู้คุมชั้น: สมาชิกโตขึ้น บางคนเริ่มหวั่นไหว */
export function teamGrow(l: Life): string {
  const r = rosterOf(l);
  const ups: string[] = [];
  for (const x of team(l)) {
    const m = r[x.p.id];
    if (chance(l, 0.45)) {
      m.lv++;
      if (m.lv % 5 === 0) ups.push(`${shortName(x.p)} Lv.${m.lv}`);
    }
    x.p.bond = clamp(x.p.bond + 2, 0, 100);
    if (x.p.relation === "ally" && x.p.bond >= 70 && chance(l, 0.08)) m.love = Math.min(3, (m.love ?? 0) + 1);
  }
  saveRoster(l, r);
  return ups.length ? ` · ทีมเติบโต: ${ups.join(", ")}` : "";
}

/** แพ้ผู้คุมชั้นจนถึงตาย: สมาชิกที่ผูกพันมากอาจรับแทน — คืนข้อความถ้ามีคนรับแทน */
export function shieldDeath(l: Life): string | undefined {
  const t = team(l).filter((x) => x.p.bond >= 60).sort((a, b) => b.p.bond - a.p.bond);
  if (!t.length || !chance(l, 0.5)) return;
  const x = t[0];
  x.p.alive = false;
  removeMate(l, x.p.id);
  bump(l, "t19fallen");
  addStat(l, "happiness", -18);
  l.flags.lossAge = l.age;
  return `${shortName(x.p)} ${roleName(x.m)}กระโดดเข้ามารับการโจมตีแทนคุณ — คุณรอด แต่${shortName(x.p)}ไม่ได้ลุกขึ้นมาอีก`;
}

// ═════════════════════════ กฎประหลาดประจำช่วงชั้น ═════════════════════════

export type RuleSlot = "force" | "trick" | "boss";

export interface FloorRule {
  id: string;
  name: string;
  emoji: string;
  /** คำประกาศของผู้ดูแลชั้น */
  desc: string;
  /** สรุปผลต่อการปีน (แสดงบนการ์ด) */
  effect: string;
  mod?: Partial<Record<RuleSlot, number>>;
  /** คูณความเข้าขาของทีม (ค่าเริ่มต้น 1) */
  teamMul?: number;
  noItems?: boolean;
  noAlliance?: boolean;
  /** บังคับเหตุการณ์กลางบททดสอบ */
  forceMid?: string;
  /** ผ่านผู้คุมชั้นแล้ว ทีมขึ้นได้แค่ครึ่ง */
  half?: boolean;
  /** โต๊ะพนันจ่ายสองเท่า */
  doubleWager?: boolean;
  /** ตัวเลือกบนการ์ดกฎ (ก่อนเริ่มบททดสอบ) — ทุกตัวไปฉาก "trial" */
  prep?: Choice[];
}

const toTrial = (o: Outcome): Outcome => ({ ...o, next: "trial" });
const rm = (c: Ctx, d: number) => { c.rm = Number(c.rm ?? 0) + d; };

export const RULES: FloorRule[] = [
  {
    id: "first",
    name: "กฎข้อแรก: ห้ามตาย",
    emoji: "📜",
    desc: "ผู้ดูแลชั้นประกาศด้วยน้ำเสียงเบื่อโลก \"กฎของชั้นต้นๆ มีข้อเดียว คือห้ามตาย… ซึ่งปีที่แล้วก็มีคนทำผิดกฎไปสามร้อยคน\"",
    effect: "ไม่มีผลพิเศษ — แต่ก็ไม่ได้ช่วยอะไร",
    prep: [
      { label: "ถามว่าถ้าตายแล้วจะโดนลงโทษยังไง", run: (l, c) => { rm(c, 0.02); addStat(l, "happiness", 2); return toTrial(meh("ผู้ดูแลชั้นนิ่งไปนาน \"…ไม่เคยมีใครถาม\" แล้วแอบบอกทางลัดให้หนึ่งทาง")); } },
    ],
  },
  {
    id: "silence",
    name: "ห้ามพูด",
    emoji: "🤐",
    desc: "「ผู้ใดเปล่งเสียงเป็นคำพูด จะถูกยึดเสียงไปหนึ่งปี」 — ผู้ท้าชิงคนหนึ่งสบถออกมาทันที แล้วก็ไม่มีเสียงออกมาอีกเลย",
    effect: "ทีมประสานงานยาก (ความเข้าขา ×0.5) · หาช่องโหว่ยากขึ้น −10%",
    mod: { trick: -0.1 },
    teamMul: 0.5,
    prep: [
      {
        label: "ซ้อมภาษามือกับทีมทั้งคืน",
        show: (l) => teamSize(l) >= 1,
        check: { stat: "smarts", dc: 45 },
        run: (l, c, ok) => {
          if (ok) { c.teamMul = 1.2; for (const x of team(l)) x.p.bond = clamp(x.p.bond + 3, 0, 100); return toTrial(good("ตีสามแล้วทุกคนยังหัวเราะเงียบๆ ใส่ท่ามือที่แปลว่า \"หิวข้าว\" — แต่พรุ่งนี้ทีมคุณคุยกันได้โดยไม่ต้องพูดสักคำ")); }
          return toTrial(meh("ท่ามือที่แปลว่า \"ถอย\" กับ \"บุก\" ดันคล้ายกันเกินไป ทุกคนเถียงกันด้วยมือจนเหนื่อย"));
        },
      },
      { label: "เขียนแผนทั้งหมดไว้บนฝ่ามือ", run: (_l, c) => { rm(c, 0.03); return toTrial(meh("ฝ่ามือคุณเต็มไปด้วยลูกศร พอเหงื่อออกครึ่งหนึ่งก็เลือน แต่ก็ยังดีกว่าไม่มี")); } },
    ],
  },
  {
    id: "betray",
    name: "ต้องทรยศหนึ่งคน",
    emoji: "🗡️",
    desc: "「ประตูทางออกจะเปิดให้เฉพาะผู้ที่ทรยศใครสักคนระหว่างบททดสอบ」 — ทุกคนในห้องเริ่มถอยห่างจากกัน",
    effect: "กลางบททดสอบต้องเลือกว่าจะทรยศใคร (หรือหาช่องโหว่)",
    forceMid: "rbetray",
    prep: [
      { label: "สัญญากับทีมว่าจะไม่ทรยศกันเอง", show: (l) => teamSize(l) >= 1, run: (l, c) => { c.oath = true; for (const x of team(l)) x.p.bond = clamp(x.p.bond + 4, 0, 100); return toTrial(meh("ทุกคนวางมือซ้อนกัน คำสัญญาของคุณดังกว่าคำประกาศของหอคอย — อย่างน้อยก็ตอนนี้")); } },
    ],
  },
  {
    id: "half",
    name: "ผ่านได้แค่ครึ่งหนึ่ง",
    emoji: "✂️",
    desc: "「ประตูของผู้คุมชั้นจะรับเพียงครึ่งหนึ่งของผู้ที่มาถึง」 — ผู้ดูแลชั้นยิ้ม \"ปัดเศษลงนะ\"",
    effect: "ถ้าผ่าน สมาชิกทีมครึ่งหนึ่งจะติดอยู่ชั้นล่าง (เลือกวิธีตัดสินบนการ์ดนี้)",
    half: true,
    prep: [
      { label: "จับฉลากอย่างยุติธรรม", show: (l) => teamSize(l) >= 2, run: (_l, c) => { c.halfBy = "lot"; return toTrial(meh("ทุกคนดึงฉลากพร้อมกัน ไม่มีใครเปิดดูจนกว่าจะผ่านผู้คุมชั้น")); } },
      { label: "ตัดสินเอง — คนที่อ่อนที่สุดอยู่ก่อน", show: (l) => teamSize(l) >= 2, run: (l, c) => { c.halfBy = "weak"; rm(c, 0.04); for (const x of team(l)) x.p.bond = clamp(x.p.bond - 4, 0, 100); return toTrial(meh("ไม่มีใครเถียง แต่ความเงียบในทีมหนักกว่าเสียงเถียง")); } },
      { label: "สละที่ของตัวเอง ส่งทีมขึ้นไปก่อน", show: (l) => teamSize(l) >= 2, run: (l, c) => { c.selfless = true; for (const x of team(l)) x.p.bond = clamp(x.p.bond + 8, 0, 100); return toTrial(good("\"ฉันตามไปทีหลัง\" — ทั้งทีมมองคุณเหมือนเพิ่งเห็นหน้ากันครั้งแรก")); } },
      { label: "มาคนเดียว — ครึ่งหนึ่งของหนึ่งคนคือ…?", show: (l) => teamSize(l) < 2, run: (_l, c) => { rm(c, 0.05); return toTrial(meh("หอคอยคำนวณอยู่นานจนจอประกาศกระพริบ แล้วตัดสินใจทำเป็นไม่เห็นคุณ")); } },
    ],
  },
  {
    id: "backward",
    name: "เดินถอยหลังเท่านั้น",
    emoji: "🔙",
    desc: "「ผู้ใดก้าวไปข้างหน้า จะถูกส่งกลับจุดเริ่มต้น」 — ทั้งชั้นเต็มไปด้วยผู้ท้าชิงที่เดินถอยหลังชนกันเอง",
    effect: "ฝ่าตรงๆ ยากขึ้น −12% · หาช่องโหว่ง่ายขึ้น +6%",
    mod: { force: -0.12, trick: 0.06 },
    prep: [
      { label: "ให้คนในทีมเดินหน้านำทางแล้วบอกทาง", show: (l) => hasRole(l, "scout") || hasRole(l, "lantern"), run: (_l, c) => { rm(c, 0.1); return toTrial(good("เพื่อนร่วมทีมหันหลังชนหลังกับคุณ \"ซ้ายสองก้าว… อีกนิด… ดี!\" — กฎไม่ได้ห้ามให้คนอื่นมองแทน")); } },
      { label: "ฝึกเดินถอยหลังในห้องพักทั้งคืน", check: { stat: "health", dc: 50 }, run: (_l, c, ok) => { if (ok) rm(c, 0.05); return toTrial(ok ? good("ตอนเช้าคุณเดินถอยหลังได้คล่องกว่าเดินหน้าเสียอีก") : meh("คุณชนตู้ไปสิบเจ็ดครั้ง หัวโน แต่ก็ได้อะไรบ้าง")); } },
    ],
  },
  {
    id: "memory",
    name: "แลกความทรงจำ",
    emoji: "🫧",
    desc: "「ค่าผ่านทางของชั้นนี้คือความทรงจำหนึ่งอย่าง — ยิ่งมีค่า ประตูยิ่งเปิดกว้าง」",
    effect: "เลือกจ่ายด้วยความทรงจำเพื่อเพิ่มโอกาส หรือไม่จ่ายแล้วฝ่าแบบยากขึ้น −10%",
    prep: [
      { label: "แลกความทรงจำวัยเด็ก", run: (l, c) => { rm(c, 0.08); addStat(l, "happiness", -6); l.flags.t19lostMemory = true; return toTrial(meh("คุณจำไม่ได้อีกแล้วว่าบ้านหลังแรกทาสีอะไร — แต่ประตูเปิดกว้างขึ้นนิดหนึ่ง")); } },
      {
        label: "แลกความทรงจำถึงคนในครอบครัวหนึ่งคน",
        tone: "danger",
        show: (l) => l.people.some((p) => p.alive && ["father", "mother", "sibling"].includes(p.relation)),
        run: (l, c) => {
          const p = pick(l, l.people.filter((x) => x.alive && ["father", "mother", "sibling"].includes(x.relation)));
          p.bond = 5;
          rm(c, 0.16);
          l.flags.t19lostMemory = true;
          return toTrial(bad(`ประตูเปิดกว้างจนแสงทะลักออกมา… คุณพยายามนึกหน้า${shortName(p)} แต่นึกได้แค่ว่าเคยมีใครสักคนชื่อนี้`));
        },
      },
      { label: "ไม่แลก — จะผ่านไปพร้อมความทรงจำทั้งหมด", run: (l, c) => { rm(c, -0.1); addStat(l, "happiness", 2); return toTrial(meh("ประตูแง้มแค่พอให้ตัวลอดผ่าน คุณต้องเบียดตัวเข้าไป แต่ทุกอย่างยังเป็นของคุณ")); } },
    ],
  },
  {
    id: "blind",
    name: "ห้ามลืมตา",
    emoji: "🙈",
    desc: "「ดวงตาที่เปิดอยู่ในชั้นนี้จะถูกหอคอยเก็บไว้」 — มีโหลแก้วใส่ตาของผู้ท้าชิงรุ่นก่อนวางเรียงรายที่ทางเข้า",
    effect: "ฝ่าตรงๆ −8% · ผู้คุมชั้น −5% (ผู้ถือโคมในทีมช่วยได้)",
    mod: { force: -0.08, boss: -0.05 },
    prep: [
      { label: "ให้ผู้ถือโคมของทีมบรรยายสนามให้ฟัง", show: (l) => hasRole(l, "lantern"), run: (_l, c) => { rm(c, 0.13); return toTrial(good("โคมสอดแนมมองเห็นแทนตาทั้งทีม เสียงกระซิบของผู้ถือโคมชัดเจนกว่าภาพที่ตาเคยเห็น")); } },
      { label: "ฟังเสียงลม", check: { stat: "luck", dc: 50 }, run: (_l, c, ok) => { if (ok) rm(c, 0.06); return toTrial(ok ? good("ลมพัดผ่านช่องว่างระหว่างกับดัก — คุณได้ยินแผนที่ทั้งชั้น") : meh("ลมพัดมาจากทุกทิศ คุณได้ยินแค่เสียงหัวใจตัวเอง")); } },
    ],
  },
  {
    id: "pair",
    name: "ผูกข้อมือเป็นคู่",
    emoji: "🪢",
    desc: "「ทุกคนต้องผูกข้อมือกับอีกหนึ่งคนจนจบชั้น ถ้าคู่ของท่านล้ม ท่านก็ล้มด้วย」",
    effect: "เลือกคู่ให้ดี — คู่ที่ผูกพันกันมากผ่านง่ายขึ้น",
    prep: [
      {
        label: "ผูกกับเพื่อนร่วมทีมที่สนิทที่สุด",
        show: (l) => teamSize(l) >= 1,
        run: (l, c) => {
          const x = team(l).sort((a, b) => b.p.bond - a.p.bond)[0];
          rm(c, (x.p.bond - 45) / 250);
          x.p.bond = clamp(x.p.bond + 6, 0, 100);
          if (x.p.relation === "ally" && chance(l, 0.3)) updateMate(l, x.p.id, (m) => { m.love = Math.min(3, (m.love ?? 0) + 1); });
          return toTrial(meh(`เชือกสีแดงพันรอบข้อมือคุณกับ${shortName(x.p)} ${shortName(x.p)}มองเชือกแล้วหัวเราะแห้งๆ "เหมือนในละครเลยเนอะ"`));
        },
      },
      { label: "ผูกกับคนแปลกหน้าที่ดูแข็งแรงที่สุด", check: { stat: "looks", dc: 50 }, run: (_l, c, ok) => { rm(c, ok ? 0.04 : -0.06); return toTrial(ok ? good("ชายร่างยักษ์ยอมผูกข้อมือกับคุณ เขาพาคุณลอยข้ามหลุมไปแบบไม่ต้องออกแรง") : bad("คู่ของคุณแข็งแรงจริง — แข็งแรงพอจะลากคุณไปทุกทางที่คุณไม่อยากไป")); } },
    ],
  },
  {
    id: "vote",
    name: "เสียงข้างมากตัดสิน",
    emoji: "🗳️",
    desc: "「ทุกการตัดสินใจในชั้นนี้ ต้องผ่านการโหวต」 — ห้องโถงเต็มไปด้วยตู้โหวตและผู้ท้าชิงที่หาเสียงกันวุ่น",
    effect: "ทีมใหญ่ได้เปรียบมาก (ความเข้าขา ×2)",
    teamMul: 2,
    prep: [
      { label: "หาเสียงจากทีมอื่นล่วงหน้า", check: { stat: "looks", dc: 55 }, skill: ["social"], run: (l, c, ok) => { rm(c, ok ? 0.07 : -0.04); if (ok) addFame(l, 1); return toTrial(ok ? good("คุณจับมือไปสี่สิบคน ได้สัญญาเสียงโหวตยี่สิบเจ็ดเสียง") : bad("คนที่คุณไปหาเสียงด้วยคือหัวหน้าทีมคู่แข่ง — เขาจำหน้าคุณได้แล้ว")); } },
    ],
  },
  {
    id: "noitem",
    name: "ห้ามพกสิ่งของ",
    emoji: "🎒",
    desc: "「สิ่งของทุกชิ้นที่ผ่านประตูนี้ จะกลายเป็นของหอคอย」 — กองอาวุธหายากสูงเท่าตึกตั้งอยู่ข้างประตู",
    effect: "ใช้ไอเท็มกับผู้คุมชั้นไม่ได้",
    noItems: true,
    prep: [
      { label: "แอบซ่อนของชิ้นเล็กไว้ในปาก", show: (l) => (l.power?.items.length ?? 0) > 0, check: { stat: "luck", dc: 60 }, run: (l, c, ok) => { if (ok) { c.keepItem = true; return toTrial(good("ประตูไม่ตรวจปาก — หอคอยนี่ก็ไม่ได้ฉลาดทุกเรื่อง")); } const it = l.power!.items.shift(); return toTrial(bad(`ประตูดูดของออกจากปากคุณพร้อมฟันหนึ่งซี่ —「${it}」หายไป`)); } },
      { label: "วางของทั้งหมดไว้ แล้วเข้าไปมือเปล่า", run: (_l, c) => { rm(c, 0.02); return toTrial(meh("ตัวเบาขึ้น ใจก็เบาขึ้นนิดหน่อย")); } },
    ],
  },
  {
    id: "stars",
    name: "ดวงดาวเลือกผู้รอด",
    emoji: "🌠",
    desc: "「ชั้นนี้ไม่มีผู้คุม มีแต่ผู้ชม — ดวงดาวจะเป็นผู้ตัดสินว่าใครได้ไปต่อ」",
    effect: "โต๊ะพนันจ่ายสองเท่า · มีผู้สนับสนุน +6%",
    doubleWager: true,
    prep: [
      { label: "ร้องขอผู้สนับสนุนของคุณโดยตรง", show: (l) => !!sponsorOf(l), run: (l, c) => { rm(c, 0.09); bump(l, "t19sponsorDebt"); return toTrial(meh(`[ดวงดาว '${sponsorOf(l)!.name}' ตอบรับคำขอ — และจดไว้ว่าคุณติดหนี้หนึ่งครั้ง]`)); } },
      { label: "เล่นใหญ่เอาใจดวงดาวทุกดวง", check: { stat: "looks", dc: 55 }, skill: ["perform"], run: (l, c, ok) => { rm(c, ok ? 0.06 : -0.03); if (ok) addFame(l, 2); return toTrial(ok ? good("[ดวงดาวหลายดวงส่งเหรียญมาพร้อมกัน] หน้าจอแชทของจักรวาลเต็มไปด้วยอีโมจิดาว") : meh("[ดวงดาว 'ปีศาจผู้หลงใหลโศกนาฏกรรม' หาว]")); } },
    ],
  },
  {
    id: "lie",
    name: "ทุกคำโกหกจะกลายเป็นจริง",
    emoji: "🎭",
    desc: "「ในชั้นนี้ คำโกหกคือกฎ — แต่จงระวัง หอคอยฟังทุกคำ」",
    effect: "หาช่องโหว่ +12% · โกหกเก่งแค่ไหนก็ได้เท่านั้น",
    mod: { trick: 0.12 },
    prep: [
      {
        label: "ตะโกนว่า \"ฉันแข็งแกร่งที่สุดในชั้นนี้!\"",
        tone: "danger",
        check: { stat: "luck", dc: 55 },
        run: (_l, c, ok) => { rm(c, ok ? 0.14 : -0.12); return toTrial(ok ? good("กล้ามเนื้อคุณอุ่นขึ้น — คำโกหกกลายเป็นจริงไปครึ่งหนึ่ง") : bad("หอคอยตีความว่า 'แข็งแกร่ง' หมายถึง 'แข็งทื่อ' ข้อต่อคุณขยับยากไปทั้งชั้น")); },
      },
      { label: "ไม่พูดอะไรเลยตลอดชั้น", run: () => toTrial(meh("ในชั้นที่ทุกคนโกหก คนเงียบคือคนที่น่ากลัวที่สุด")) },
    ],
  },
  {
    id: "alone",
    name: "ห้ามช่วยกัน",
    emoji: "🚷",
    desc: "「ผู้ใดยื่นมือช่วยผู้อื่น จะต้องรับบาดแผลของผู้นั้นแทน」",
    effect: "ทีมช่วยอะไรไม่ได้ (ความเข้าขา ×0) · จับทีมชั่วคราวไม่ได้",
    teamMul: 0,
    noAlliance: true,
    prep: [
      { label: "นัดทีมว่าจะเจอกันที่ทางออก", show: (l) => teamSize(l) >= 1, run: (l) => { for (const x of team(l)) x.p.bond = clamp(x.p.bond + 3, 0, 100); return toTrial(meh("\"ใครถึงก่อนสั่งข้าวรอ\" — ทุกคนแยกย้ายไปคนละทาง")); } },
    ],
  },
  {
    id: "mirror",
    name: "ศัตรูคือตัวท่านเมื่อปีก่อน",
    emoji: "🪞",
    desc: "「ผู้คุมชั้นนี้คือเงาของท่านในวันที่อ่อนแอกว่า — ถ้าท่านไม่ได้แข็งแกร่งขึ้นเลย ก็จงเตรียมแพ้ตัวเอง」",
    effect: "ผู้คุมชั้นอ่อนลงตามเลเวลที่คุณเพิ่มขึ้นตั้งแต่ปีนครั้งก่อน",
    prep: [
      { label: "เขียนจดหมายถึงตัวเองเมื่อปีก่อน", run: (l) => { addStat(l, "happiness", 3); return toTrial(meh("\"ถึงฉันเมื่อปีที่แล้ว: เลิกกินมาม่าตอนตีสามได้แล้ว\" — คุณพับจดหมายใส่กระเป๋า")); } },
    ],
  },
  {
    id: "fast",
    name: "เวลาเดินเร็วสิบเท่า",
    emoji: "⏳",
    desc: "「หนึ่งชั่วโมงในชั้นนี้ เท่ากับสิบชั่วโมงบนโลก」 — ผมของผู้ท้าชิงที่นั่งรออยู่ตรงทางเข้ายาวถึงเอว",
    effect: "รีบให้จบ หรือใช้เวลาฝึกให้คุ้ม",
    prep: [
      { label: "รีบให้จบเร็วที่สุด", run: (_l, c) => { rm(c, 0.03); return toTrial(meh("คุณวิ่งตั้งแต่ก้าวแรก ไม่ได้มองวิวสักนิด")); } },
      { label: "ฝึกในชั้นนี้ก่อนสักพักใหญ่", run: (l, c) => { c.train19 = true; addStat(l, "health", -3); addStat(l, "looks", -1); return toTrial(meh("คุณฝึกอยู่ในชั้นนี้จนผมยาวขึ้นคืบหนึ่ง กล้ามเนื้อจำท่าใหม่ได้แล้ว")); } },
    ],
  },
  {
    id: "upside",
    name: "พื้นคือเพดาน",
    emoji: "🙃",
    desc: "「แรงโน้มถ่วงของชั้นนี้กลับหัวทุกสิบนาที」 — มีคนห้อยหัวกินข้าวอยู่บนเพดานอย่างชำนาญ",
    effect: "ทุกอย่างสุ่มขึ้นลง ±5% (ผู้ควบคุมพลังงานในทีมช่วยได้)",
    prep: [
      { label: "ให้ผู้ควบคุมพลังงานของทีมสร้างพื้นลอย", show: (l) => hasRole(l, "wave") || l.power?.hunterClass === "t_wave", run: (_l, c) => { rm(c, 0.1); return toTrial(good("แผ่นพลังงานสีฟ้ารองรับเท้าทั้งทีม — พื้นจะอยู่ทางไหนก็ไม่สำคัญอีกแล้ว")); } },
      { label: "ปล่อยตัวตามแรงโน้มถ่วง", run: (l, c) => { rm(c, chance(l, 0.5) ? 0.05 : -0.05); return toTrial(meh("คุณตกขึ้น ตกลง ตกขึ้น… จนเริ่มสนุก")); } },
    ],
  },
];

const ruleById = (id: string) => RULES.find((r) => r.id === id) ?? RULES[0];
const BAND = 5;
export const bandOf = (floor: number) => Math.floor((Math.max(1, floor) - 1) / BAND);
export const bandRange = (floor: number) => {
  const b = bandOf(floor);
  return [b * BAND + 1, b * BAND + BAND] as const;
};

/** กฎของช่วงชั้นที่กำลังจะปีน — ตายตัวต่อชีวิต (ชั้นเดิมกฎเดิม) */
export function ruleFor(l: Life, floor: number): FloorRule {
  const b = bandOf(floor);
  if (b === 0) return RULES[0];
  const h = (Math.imul(l.seed ^ 0x9e3779b9, 31) + Math.imul(b + 7, 2654435761)) >>> 0;
  return RULES[1 + (((h >>> 7) ^ h) >>> 0) % (RULES.length - 1)];
}
export const ruleOfCtx = (c: Ctx) => ruleById(String(c.rule ?? "first"));

/** ผลรวมของกฎต่อโอกาสในจังหวะนั้น */
export function ruleMod(l: Life, c: Ctx, slot: RuleSlot): number {
  const r = ruleOfCtx(c);
  let m = (r.mod?.[slot] ?? 0) + Number(c.rm ?? 0);
  if (slot === "boss" && r.id === "stars" && sponsorOf(l)) m += 0.06;
  if (slot === "boss" && r.id === "mirror") m += clamp(((l.power?.level ?? 0) - num(l, "t19lastLv")) * 0.012, -0.08, 0.12);
  return m;
}
export const teamMod = (l: Life, c: Ctx) => synergy(l) * Number(c.teamMul ?? ruleOfCtx(c).teamMul ?? 1);

export const BEHIND = "อดีตเพื่อนร่วมทีม (ติดอยู่ชั้นล่าง)";

/** ผ่านผู้คุมชั้นภายใต้กฎ "ผ่านได้แค่ครึ่งหนึ่ง" */
export function applyHalf(l: Life, c: Ctx): string {
  if (!ruleOfCtx(c).half) return "";
  const t = team(l);
  if (t.length < 2) return "";
  const n = Math.floor(t.length / 2);
  const order = c.halfBy === "weak" ? [...t].sort((a, b) => a.m.lv - b.m.lv) : t.map((x) => ({ x, k: randInt(l, 0, 999) })).sort((a, b) => a.k - b.k).map((y) => y.x);
  const left = order.slice(0, n);
  for (const x of left) { removeMate(l, x.p.id); x.p.relation = "friend"; x.p.job = BEHIND; x.p.bond = clamp(x.p.bond - (c.halfBy === "weak" ? 15 : 5), 0, 100); }
  bump(l, "t19leftBehind", n);
  return ` · ✂️ ประตูปิดลงต่อหน้า${left.map((x) => shortName(x.p)).join(" และ ")} — พวกเขาติดอยู่ชั้นล่าง`;
}

// ═════════════════════════ โต๊ะพนันของดวงดาว ═════════════════════════

export interface LongBet {
  star: string;
  /** ถึงชั้น floor ก่อนอายุ by */
  floor: number;
  by: number;
  stake: number;
  pay: number;
}
export interface WagerStats { n: number; won: number; lost: number; net: number; rigged: number; thrown: number; last?: string }

export const longBets = (l: Life) => readJson<LongBet[]>(l, "t19bets", []);
export const saveBets = (l: Life, b: LongBet[]) => writeJson(l, "t19bets", b);
export const wagerStats = (l: Life) => readJson<WagerStats>(l, "t19wager", { n: 0, won: 0, lost: 0, net: 0, rigged: 0, thrown: 0 });
const saveStats = (l: Life, s: WagerStats) => writeJson(l, "t19wager", s);

/** ดวงดาวคู่แข่ง — ดาวที่ชอบเดิมพันให้คุณแพ้ (ไม่ใช่ผู้สนับสนุนของคุณ) */
export function rivalStar(l: Life): Sponsor {
  const cur = String(l.flags.t19rival ?? "");
  const found = SPONSORS.find((s) => s.id === cur && s.id !== l.flags.sponsor);
  if (found) return found;
  const s = pick(l, SPONSORS.filter((x) => x.id !== l.flags.sponsor));
  l.flags.t19rival = s.id;
  return s;
}
export const rivalGrudge = (l: Life) => num(l, "t19grudge");

/** ชั้นใหญ่ = การปีนครั้งนี้อาจข้ามหลักสิบ */
export const isMajor = (f: number, cap: number) => Math.floor(Math.min(cap, f + 4) / 10) > Math.floor(f / 10);

export const stakeOf = (l: Life) => Math.max(10_000, Math.round(Math.min(Math.max(0, l.money) * 0.2, 50_000_000) / 1000) * 1000);
/** อัตราจ่ายตามโอกาสชนะที่ดวงดาวประเมิน */
export const payFor = (p: number) => Math.round(clamp(0.92 / clamp(p, 0.08, 0.95), 1.05, 9) * 10) / 10;

/** ตั้งโต๊ะพนัน (เรียกตอนเข้าฉาก wager) — odds = โอกาสชนะผู้คุมชั้นจริง */
export function wagerText(l: Life, c: Ctx, odds: number): string {
  const p = clamp(odds, 0.05, 0.95);
  const dbl = ruleOfCtx(c).doubleWager ? " (กฎชั้นนี้: จ่ายสองเท่า!)" : "";
  const rv = rivalStar(l);
  const sp = sponsorOf(l);
  const crowd = randInt(l, 40, 400);
  return (
    `[โต๊ะพนันของดวงดาว] ชั้นข้างหน้าคือชั้นใหญ่ — ดวงดาว ${crowd} ดวงลงเดิมพันชีวิตคุณ\n` +
    `โอกาสที่คุณจะชนะผู้คุมชั้น (ดวงดาวประเมิน): ${Math.round(p * 100)}%\n` +
    `อัตราจ่าย: ข้าง "รอด" ×${payFor(p)} · ข้าง "แพ้" ×${payFor(1 - p)}${dbl}\n` +
    `${sp ? `'${sp.name}' วางเหรียญกองโตไว้ข้างคุณ ` : ""}'${rv.name}' วางเดิมพันข้าง "แพ้" แล้วส่งยิ้มมาให้${rivalGrudge(l) >= 2 ? " — มันจำคุณได้" : ""}`
  );
}

/** ลงเดิมพัน: side = "for" | "against" | "rig" */
export function placeBet(l: Life, c: Ctx, side: string, odds: number) {
  const stake = Math.min(stakeOf(l), Math.max(0, l.money));
  const p = clamp(odds, 0.05, 0.95);
  c.bet = side;
  c.stake = stake;
  c.pay = (side === "against" ? payFor(1 - p) : payFor(p)) * (ruleOfCtx(c).doubleWager ? 2 : 1);
  addMoney(l, -stake);
}

/** ปิดโต๊ะหลังจบผู้คุมชั้น — won = ชนะผู้คุมชั้น · thrown = แกล้งแพ้ */
export function settleWager(l: Life, c: Ctx, won: boolean, thrown = false): string {
  if (!c.wager) return "";
  const s = wagerStats(l);
  const rv = rivalStar(l);
  let text = "";
  const side = String(c.bet ?? "");
  if (side) {
    s.n++;
    const stake = Number(c.stake);
    const hit = side === "against" ? !won : won;
    if (hit) {
      const gain = Math.round(stake * Number(c.pay));
      addMoney(l, gain);
      s.won++;
      s.net += gain - stake;
      text = ` · 🎲 เดิมพันเข้า! ได้ ${money(l, gain)}`;
    } else {
      s.lost++;
      s.net -= stake;
      text = ` · 🎲 เดิมพันแตก เสีย ${money(l, stake)}`;
    }
    if (side === "rig") s.rigged++;
    if (thrown) s.thrown++;
  }
  if (won && !thrown) {
    bump(l, "t19grudge");
    if (!side) text += ` · '${rv.name}' เสียเดิมพันเพราะคุณ — มันเริ่มแค้นแล้ว`;
  }
  if (thrown) {
    addFame(l, -5);
    if (sponsorOf(l) && chance(l, 0.4)) {
      text += ` · [ดวงดาว '${sponsorOf(l)!.name}' ที่เดิมพันข้างคุณ ถอนการสนับสนุน!]`;
      l.flags.sponsor = "none";
    }
  }
  s.last = `ชั้น ${Number(c.f) + 1}: ${side ? ({ for: "แทงว่ารอด", against: "แทงว่าแพ้", rig: "ล้มโต๊ะ" } as Record<string, string>)[side] : "ไม่ลงเดิมพัน"} → ${won ? "ชนะผู้คุมชั้น" : "แพ้"}`;
  saveStats(l, s);
  return text;
}

/** ทุกปี: จัดทีม (เพื่อนร่วมทีมที่มาจากระบบปาร์ตี้ได้ตำแหน่ง) + ปิดเดิมพันระยะยาว */
export function towerYear(l: Life) {
  if (l.worldId !== "tower" || !l.alive) return;
  // ทีม
  const r = rosterOf(l);
  let changed = false;
  for (const id of Object.keys(r)) {
    const p = l.people.find((x) => x.id === id);
    if (!p || !p.alive) { delete r[id]; changed = true; }
  }
  if (l.power) {
    for (const p of people(l, "ally")) {
      if (!r[p.id] && Object.keys(r).length < TEAM_MAX) { r[p.id] = { role: roleFromText(l, p.job), lv: Math.max(1, Math.round((l.power.level ?? 1) / 3)) }; changed = true; }
    }
  }
  if (changed) saveRoster(l, r);
  if (l.flags.t19teamRift && chance(l, 0.3)) delete l.flags.t19teamRift;
  // เดิมพันระยะยาว
  const bets = longBets(l);
  if (!bets.length) return;
  const f = Number(l.flags.floor ?? 0);
  const keep: LongBet[] = [];
  for (const b of bets) {
    if (f >= b.floor) {
      const gain = Math.round(b.stake * b.pay);
      addMoney(l, gain);
      const s = wagerStats(l);
      s.n++; s.won++; s.net += gain - b.stake;
      saveStats(l, s);
      log(l, `[ดวงดาว '${b.star}'] เดิมพันว่าคุณจะถึงชั้น ${b.floor} — คุณทำได้! รับเงิน ${money(l, gain)}`, "good");
    } else if (l.age > b.by) {
      const s = wagerStats(l);
      s.n++; s.lost++; s.net -= b.stake;
      saveStats(l, s);
      log(l, `[ดวงดาว '${b.star}'] หมดเวลาเดิมพันชั้น ${b.floor} — เงิน ${money(l, b.stake)} ของคุณกลายเป็นของดวงดาว`, "bad");
    } else keep.push(b);
  }
  saveBets(l, keep);
}
