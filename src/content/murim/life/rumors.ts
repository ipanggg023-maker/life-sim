// ข่าวลือ การสืบสวน และการปกปิด (MURIM_PLAN §18.3 · §18.8 · EXPANSION §4.3 · §10)
// ข่าวลือมี: แหล่งที่มา · ปีที่ได้ยิน · ความน่าเชื่อถือ (ตามที่คุณรับรู้) · ความจริง (ซ่อนจนกว่าจะตรวจ) · กับดัก
// ข่าวเรื่องคุณแพร่ปีละภูมิภาค อาจถูกบิดเบือน และคนที่ได้ยินจำ — ตามค่านิยมของเขา · การปลอมตัว/เอกสารปลอม/ทำลายหลักฐานลดการเปิดเผย
import type { Ctx, GameEvent, Outcome } from "../../../engine/events";
import { kill, yearHooks } from "../../../engine/game";
import { profileOf, remember } from "../../../engine/npc";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, shortName } from "../../../engine/util";
import { fightOdds, gainExp, survivalOdds } from "../../hunter/power";
import { npcName, shiftAlign } from "../m17core";
import { ARTS, knows, learn } from "../martial/arts";
import { TAEL } from "../story/kit";
import { REGIONS, regionOf } from "./region";
import { gift } from "./gifts";

export type Truth = "true" | "false" | "trap" | "partial";
export interface Rumor {
  id: string;
  kind: "treasure" | "villain" | "court" | "scandal" | "sect";
  text: string;
  truth: Truth;
  /** แหล่งข่าว (ข้อความ) */
  src: string;
  /** 1 อาจบิดเบือน · 2 แหล่งเดียว · 3 พยานหลายคน · 4 มีหลักฐาน — ตามที่คุณรับรู้ ไม่ใช่ความจริง */
  rel: number;
  /** แรงจูงใจของคนปล่อยข่าว (ถ้ารู้) */
  motive?: string;
  heard: number;
  region: string;
  verified?: boolean;
  done?: boolean;
  /** คนที่ข่าวพาดพิง (ข่าวฉาว) */
  pid?: string;
}
/** ข่าวเรื่องคุณที่แพร่ออกไป */
export interface Fame {
  id: string;
  text: string;
  good: boolean;
  year: number;
  /** แพร่ไปกี่ภูมิภาคแล้ว */
  reach: number;
  distorted?: boolean;
  /** ถูกกลบด้วยการปกปิด */
  covered?: boolean;
  told: string[];
}

const RKEY = "mwRumors";
const FKEY = "mwFameNews";
const read = <T,>(l: Life, k: string): T[] => { try { return l.flags[k] ? (JSON.parse(String(l.flags[k])) as T[]) : []; } catch { return []; } };
const write = (l: Life, k: string, v: unknown) => { l.flags[k] = JSON.stringify(v); };
export const rumorsOf = (l: Life) => read<Rumor>(l, RKEY);
export const fameNewsOf = (l: Life) => read<Fame>(l, FKEY);
const saveRumors = (l: Life, rs: Rumor[]) => write(l, RKEY, rs.slice(-10));
const saveFame = (l: Life, fs: Fame[]) => write(l, FKEY, fs.slice(-8));
export const REL_LABEL = ["", "อาจถูกปล่อยข่าว/บิดเบือน", "แหล่งข่าวเดียว", "มีพยานหลายคน", "มีหลักฐานยืนยัน"];
export const TRUTH_LABEL: Record<Truth, string> = { true: "จริง", false: "ไม่จริง", trap: "เป็นกับดัก", partial: "จริงบางส่วน" };
const year = (l: Life) => l.birthYear + l.age;

// แหล่งข่าว: ความน่าเชื่อถือจริง (โอกาสที่ข่าวเป็นจริง)
const SOURCES: { src: string; base: number; motive?: string }[] = [
  { src: "พ่อค้าเร่ที่เพิ่งผ่านมา", base: 0.5 },
  { src: "นักเล่านิทานในโรงน้ำชา", base: 0.3, motive: "อยากให้คนฟังเยอะ" },
  { src: "ศิษย์สำนักที่ลงเขามา", base: 0.55 },
  { src: "มือปราบที่เมาในโรงเตี๊ยม", base: 0.7 },
  { src: "จดหมายเก่าในหีบมรดก", base: 0.75 },
  { src: "ผู้รอดชีวิตที่หนีมา", base: 0.6 },
  { src: "คู่แข่งในตลาด", base: 0.2, motive: "อยากให้คุณเสียเวลาและเงิน" },
];

export function hearRumor(l: Life): Rumor {
  const s = pick(l, SOURCES);
  let kind = pick(l, ["treasure", "treasure", "villain", "court", "scandal", "sect"] as Rumor["kind"][]);
  const r = regionOf(l);
  const place = pick(l, REGIONS).name;
  let truth: Truth = chance(l, s.base) ? (chance(l, 0.25) ? "partial" : "true") : kind === "treasure" && chance(l, 0.45) ? "trap" : "false";
  let text = "";
  let pid: string | undefined;
  if (kind === "treasure") text = `ถ้ำหลังน้ำตกแห่งหนึ่งใน${place}มีคัมภีร์ของยอดฝีมือรุ่นก่อนซ่อนอยู่`;
  else if (kind === "villain") text = `โจรร้าย${npcName(l)}ที่มีค่าหัวสูง ซ่อนตัวอยู่ในหมู่บ้านแถบ${place}`;
  else if (kind === "court") text = `ขุนนางคลังประจำ${place}ยักยอกเงินภาษีมาสามปี`;
  else if (kind === "sect") text = `${pick(l, ["วัดวัชระ", "สำนักกระบี่เมฆา", "ห้าตระกูลใหญ่", "พรรคกระยาจก"])}กำลังขาดเงินจนต้องขายคัมภีร์ลับ`;
  else {
    // ข่าวฉาวเรื่องคนที่คุณรู้จัก — จริงเมื่อเขามีความลับจริง
    const p = pick(l, l.people.filter((x) => x.alive && x.age >= 18 && x.relation !== "child") );
    if (p) {
      pid = p.id;
      const sec = profileOf(p).secret;
      truth = sec && chance(l, 0.7) ? "true" : "false";
      text = `${shortName(p)}${truth === "true" && sec ? sec.text : pick(l, ["แอบติดหนี้บ่อนก้อนใหญ่", "เคยเป็นสาวกลัทธิมาร", "มีลูกนอกสมรส"])}`;
    } else { kind = "court"; text = `ขุนนางคลังประจำ${place}ยักยอกเงินภาษีมาสามปี`; }
  }
  // ความน่าเชื่อถือที่ "รับรู้" — สัมพันธ์กับความจริงแต่ไม่ตรงเสมอ (ข่าวปลอมบางข่าวดูน่าเชื่อ)
  const rel = clamp(Math.round(s.base * 4 + (truth === "true" ? 0.6 : truth === "partial" ? 0.2 : -0.4) + (chance(l, 0.3) ? randInt(l, -1, 1) : 0)), 1, 4);
  const rumor: Rumor = { id: `r${l.age}_${randInt(l, 100, 999)}`, kind, text, truth, src: s.src, rel, motive: s.motive, heard: year(l), region: r.id, pid };
  const rs = rumorsOf(l);
  rs.push(rumor);
  saveRumors(l, rs);
  return rumor;
}

/** ข่าวเรื่องคุณ (เรียกเมื่อทำเรื่องใหญ่) */
export function spreadAboutYou(l: Life, text: string, good: boolean) {
  const fs = fameNewsOf(l);
  if (fs.some((f) => f.text === text && year(l) - f.year < 3)) return;
  fs.push({ id: `f${l.age}_${fs.length}`, text, good, year: year(l), reach: 0, told: [] });
  saveFame(l, fs);
}

const EXAGGERATE = ["ว่ากันว่าคนเดียวสู้ได้เป็นสิบ", "ว่ากันว่าไม่มีใครรอดกลับมาเล่า", "ว่ากันว่าทำในคืนเดียว", "ว่ากันว่ามีคนเห็นตาเป็นสีแดง"];

yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive) return;
  // ได้ยินข่าวจากพ่อค้า/คนเดินทางบ้างเป็นครั้งคราว
  if (l.age >= 14 && chance(l, 0.25)) hearRumor(l);
  // ชื่อเสียงพุ่ง/ตกแรง = มีข่าวเรื่องคุณ
  const last = Number(l.flags.lastFame ?? l.fame);
  if (l.fame - last >= 6) spreadAboutYou(l, `${l.lastName}${l.firstName}ทำเรื่องที่คนพูดถึงทั้งเมือง`, true);
  l.flags.lastFame = l.fame;
  // ข่าวเรื่องคุณแพร่ปีละภูมิภาค · อาจถูกบิดเบือน · คนรู้จักได้ยินแล้วจำ
  const fs = fameNewsOf(l);
  for (const f of fs) {
    if (f.covered) continue;
    if (f.reach < REGIONS.length - 1) f.reach++;
    if (!f.distorted && chance(l, 0.2)) { f.distorted = true; f.text = `${f.text} — ${pick(l, EXAGGERATE)}`; }
    const listeners = l.people.filter((p) => p.alive && p.age >= 14 && !f.told.includes(p.id) && p.relation !== "child");
    for (const p of listeners.slice(0, f.reach >= 2 ? 2 : 1)) {
      if (!chance(l, 0.5)) continue;
      f.told.push(p.id);
      const vals = profileOf(p).values;
      const d = f.good
        ? { respect: 6, love: vals.includes("ชื่อเสียง") ? 4 : 1 }
        : vals.includes("ความยุติธรรม") ? { respect: -10, trust: -8, grudge: 6 } : vals.includes("พลัง") ? { respect: 4, fear: 6 } : { fear: 4, trust: -4 };
      remember(l, p, "heard_news", `ได้ยินข่าวว่า${f.text}${f.distorted ? " (ข่าวที่ถูกเติมแต่ง)" : ""}`, 2, d, true);
    }
  }
  saveFame(l, fs.filter((f) => year(l) - f.year < 15));
});

// ───────────────────────── ตรวจสอบและลงมือตามข่าว ─────────────────────────
const rumorBy = (l: Life, c: Ctx) => rumorsOf(l).find((r) => r.id === c.rid);
const mark = (l: Life, id: unknown, patch: Partial<Rumor>) => { const rs = rumorsOf(l); const r = rs.find((x) => x.id === id); if (r) Object.assign(r, patch); saveRumors(l, rs); };
const ok = (text: string): Outcome => ({ text, kind: "good" });
const no = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });
const big = (text: string): Outcome => ({ text, kind: "milestone" });
const pow = (l: Life) => l.power?.rank ?? 0;

export const RUMOR_EVENTS: GameEvent[] = [
  {
    id: "rm.verify",
    minAge: 10,
    maxAge: 120,
    manual: true,
    maxTimes: 0,
    title: "ตรวจสอบข่าว",
    text: (l, c) => { const r = rumorBy(l, c); return r ? `ข่าว: "${r.text}" — มาจาก${r.src} (${REL_LABEL[r.rel]})${r.motive ? ` · คนปล่อยข่าวอาจ${r.motive}` : ""}` : "ข่าวนี้เลือนหายไปแล้ว"; },
    choices: [
      { label: "ถามพยานหลายคนแล้วเทียบคำให้การ", skill: ["social"], show: (l, c) => !!rumorBy(l, c), check: { stat: "smarts", dc: 50, bonus: (l) => gift(l, "info") }, run: (l, c, s) => { const r = rumorBy(l, c)!; if (s) { mark(l, c.rid, { verified: true }); return ok(`คำให้การสามคนตรงกัน — ข่าวนี้${TRUTH_LABEL[r.truth]}`); } return meh("พยานแต่ละคนเล่าไม่ตรงกัน — ยังสรุปอะไรไม่ได้"); } },
      { label: "จ้างสายข่าว (5 ตำลึง)", show: (l, c) => !!rumorBy(l, c), req: (l) => (l.money < 5 * TAEL ? "ต้องมีเงิน 5 ตำลึง" : undefined), odds: (l) => clamp(0.6 + (l.stats.luck - 50) / 200 + gift(l, "info"), 0.3, 0.95), run: (l, c, s) => { addMoney(l, -5 * TAEL); const r = rumorBy(l, c)!; if (s) { mark(l, c.rid, { verified: true }); return ok(`สายข่าวกลับมาพร้อมคำตอบ — ข่าวนี้${TRUTH_LABEL[r.truth]}`); } return no("สายข่าวรับเงินแล้วหายไป"); } },
      { label: "ไปดูด้วยตาตัวเอง", skill: ["stealth"], show: (l, c) => !!rumorBy(l, c), odds: (l) => clamp(0.5 + (l.stats.health - 50) / 200 + pow(l) * 0.04 + gift(l, "info"), 0.2, 0.95), run: (l, c, s) => { const r = rumorBy(l, c)!; if (s) { mark(l, c.rid, { verified: true }); return ok(`คุณเดินทางไปดูเอง — ข่าวนี้${TRUTH_LABEL[r.truth]}`); } addStat(l, "health", -5); return no("หลงทางกลางป่า — กลับมาเหนื่อยเปล่า"); } },
      { label: "ปล่อยไว้ก่อน", run: () => meh("ข่าวลือมีอยู่ทุกวัน — บางเรื่องก็ปล่อยให้มันลอยไป") },
    ],
  },
  {
    id: "rm.act",
    minAge: 14,
    maxAge: 120,
    manual: true,
    maxTimes: 0,
    title: "ลงมือตามข่าว",
    text: (l, c) => { const r = rumorBy(l, c); return r ? `คุณตัดสินใจลงมือตามข่าว "${r.text}"${r.verified ? ` (ตรวจแล้ว: ${TRUTH_LABEL[r.truth]})` : " — โดยยังไม่รู้ว่าจริงหรือไม่"}` : "ข่าวนี้เลือนหายไปแล้ว"; },
    choices: [
      { label: "ไปตามหาสมบัติ", show: (l, c) => rumorBy(l, c)?.kind === "treasure", run: (l, c) => {
        const r = rumorBy(l, c)!; mark(l, c.rid, { done: true });
        if (r.truth === "true" || r.truth === "partial") { const pool = ARTS.filter((a) => a.grade >= 2 && a.grade <= 3 && !knows(l, a.id)); if (r.truth === "true" && pool.length) { const a = pick(l, pool); return big(`ในถ้ำมีหีบเหล็กขึ้นสนิม — คัมภีร์อยู่จริง!${learn(l, a.id, "ถ้ำตามข่าวลือ")}`); } addMoney(l, randInt(l, 20, 60) * TAEL); return ok("ไม่มีคัมภีร์ — แต่มีทองเก่าซ่อนอยู่ใต้หิน"); }
        if (r.truth === "trap") { if (!chance(l, survivalOdds(l, Math.max(1, pow(l))))) { kill(l, "ถูกโจรที่ปล่อยข่าวลวงสมบัติซุ่มฆ่า"); return no("ถ้ำนั้นมีแต่โจรรออยู่ — ข่าวลือนี้ถูกปล่อยมาเพื่อล่อคนอย่างคุณ"); } addStat(l, "health", -15); addMoney(l, -Math.min(l.money, 20 * TAEL)); return no("ถ้ำนั้นมีแต่โจรซุ่มรออยู่ — คุณหนีรอดแต่ถูกปล้นและบาดเจ็บ"); }
        addStat(l, "health", -3); return meh("ถ้ำว่างเปล่า มีแต่ค้างคาว — ข่าวลือนี้ไม่มีมูลความจริง");
      } },
      { label: "ล่าค่าหัวโจร", skill: ["combat"], show: (l, c) => rumorBy(l, c)?.kind === "villain", odds: (l) => fightOdds(l, Math.max(1, pow(l))), run: (l, c, s) => {
        const r = rumorBy(l, c)!; mark(l, c.rid, { done: true });
        if (r.truth === "false") return meh("ไม่มีโจรคนนั้นอยู่ที่หมู่บ้าน — ชาวบ้านไม่เคยได้ยินชื่อด้วยซ้ำ");
        if (s) { addMoney(l, (r.truth === "true" ? 40 : 15) * TAEL); gainExp(l, 400); addFame(l, 2); return ok(r.truth === "true" ? "เจอตัวจริง — ค่าหัวเต็มจำนวน" : "เจอแต่ลูกน้องของมัน — ได้ค่าหัวไม่เต็ม"); }
        addStat(l, "health", -12); return no("มันรู้ตัวก่อน — คุณได้แผลกลับมาแทนค่าหัว");
      } },
      { label: "แจ้งผู้ตรวจการ", skill: ["social"], show: (l, c) => rumorBy(l, c)?.kind === "court", check: { stat: "smarts", dc: 55 }, run: (l, c, s) => {
        const r = rumorBy(l, c)!; mark(l, c.rid, { done: true });
        if (s && r.truth !== "false") { addFame(l, 4); shiftAlign(l, 3); return ok("ผู้ตรวจการสอบบัญชี — ขุนนางคนนั้นถูกปลด ชาวบ้านจุดประทัดฉลอง"); }
        if (r.truth === "false") { l.flags.courtBlacklist = true; return no("ขุนนางคนนั้นบริสุทธิ์ — และตอนนี้เขารู้ว่าใครกล่าวหา"); }
        return meh("หลักฐานไม่พอ — ผู้ตรวจการพยักหน้าแล้วเก็บเรื่องเข้าลิ้นชัก");
      } },
      { label: "เปิดโปงเรื่องนี้ต่อหน้าคนอื่น", show: (l, c) => rumorBy(l, c)?.kind === "scandal", run: (l, c) => {
        const r = rumorBy(l, c)!; mark(l, c.rid, { done: true }); const p = l.people.find((x) => x.id === r.pid);
        if (p && r.truth === "true") { if (p.secret) p.secret.known = true; remember(l, p, "exposed_secret", "คุณเปิดโปงความลับของเขา", 3, { grudge: 50, love: -30, trust: -40 }); addFame(l, 1); return meh(`เรื่องจริง — ${shortName(p)}เสียชื่อทั้งเมือง และจะไม่มีวันให้อภัยคุณ`); }
        if (p) remember(l, p, "slandered", "คุณใส่ร้ายเขาด้วยข่าวลือเท็จ", 3, { grudge: 60, love: -30 });
        addFame(l, -4); return no("ข่าวนี้ไม่จริง — คนที่เสียชื่อคือคุณ ไม่ใช่เขา");
      } },
      { label: "ไปถามตรงๆ อย่างเป็นส่วนตัว", show: (l, c) => rumorBy(l, c)?.kind === "scandal", run: (l, c) => {
        const r = rumorBy(l, c)!; mark(l, c.rid, { done: true }); const p = l.people.find((x) => x.id === r.pid);
        if (p && r.truth === "true") { if (p.secret) p.secret.known = true; remember(l, p, "kept_secret", "คุณมาถามตรงๆ แทนที่จะป่าวประกาศ", 3, { trust: 12, debt: 15 }); return ok(`${shortName(p)}นิ่งไปนาน แล้วยอมรับ — "ขอบคุณที่มาถามข้าก่อน"`); }
        if (p) remember(l, p, "asked_rumor", "คุณถามเรื่องข่าวลือเท็จ", 1, { trust: -3 });
        return meh("ข่าวนี้ไม่จริง — เขาหัวเราะ แต่ก็อดสงสัยไม่ได้ว่าใครปล่อยข่าว");
      } },
      { label: "ไปซื้อคัมภีร์ที่ถูกขาย (30 ตำลึง)", show: (l, c) => rumorBy(l, c)?.kind === "sect", req: (l) => (l.money < 30 * TAEL ? "ต้องมีเงิน 30 ตำลึง" : undefined), run: (l, c) => {
        const r = rumorBy(l, c)!; mark(l, c.rid, { done: true }); addMoney(l, -30 * TAEL);
        const pool = ARTS.filter((a) => a.grade === 3 && !knows(l, a.id));
        if (r.truth !== "false" && pool.length) { const a = pick(l, pool); return big(`ข่าวจริง — คัมภีร์ลับเปลี่ยนมือในห้องลับหลังโรงเตี๊ยม${learn(l, a.id, "ซื้อจากสำนักที่ขาดเงิน")}`); }
        return no("คนขายหายไปพร้อมเงิน — คัมภีร์ที่ได้มาเป็นของปลอมทั้งเล่ม");
      } },
      // ───── ทางเลือกที่มีความหมายไม่ว่าข่าวจะจริงหรือไม่ (ข่าวเท็จ/กับดักก็มีทางได้ประโยชน์) ─────
      { label: "ซุ่มดักคนที่วางกับดัก", skill: ["combat"], tone: "danger", show: (l, c) => { const r = rumorBy(l, c); return r?.kind === "treasure" && (!r.verified || r.truth === "trap"); }, odds: (l) => fightOdds(l, Math.max(1, pow(l))), survival: (l) => survivalOdds(l, Math.max(1, pow(l))), run: (l, c, s) => {
        const r = rumorBy(l, c)!; mark(l, c.rid, { done: true });
        if (r.truth !== "trap") return meh(r.truth === "false" ? "คุณซุ่มอยู่สามคืน — ไม่มีใครมา ถ้ำนั้นแค่ว่างเปล่า" : "ไม่มีโจรซุ่มอยู่ — แต่คุณมัวซุ่มจนคนอื่นเข้าไปเอาของในถ้ำไปก่อน");
        if (s) { addMoney(l, 30 * TAEL); addFame(l, 4); gainExp(l, 500); shiftAlign(l, 2); return ok("โจรที่ปล่อยข่าวลวงคนมาปล้นถูกคุณจับมัดส่งทางการ — ค่าหัวทั้งแก๊ง และคนเดินทางปลอดภัยขึ้น"); }
        addStat(l, "health", -15); return no("พวกมันมากกว่าที่คิด — คุณหนีออกมาได้พร้อมแผลยาว");
      } },
      { label: "บอกชาวบ้านว่าไม่มีโจรคนนี้ ไม่ต้องตื่นตูม", skill: ["social"], show: (l, c) => { const r = rumorBy(l, c); return r?.kind === "villain" && !!r.verified && r.truth === "false"; }, run: (l, c) => {
        mark(l, c.rid, { done: true }); shiftAlign(l, 2); addFame(l, 2);
        return ok("ชาวบ้านเลิกปิดประตูตั้งแต่หัวค่ำ ตลาดกลับมาคึกคัก — ผู้ใหญ่บ้านส่งไก่มาให้สองตัว");
      } },
      { label: "ไปเตือนขุนนางว่ามีคนจะใส่ร้าย", skill: ["social"], show: (l, c) => rumorBy(l, c)?.kind === "court", check: { stat: "looks", dc: 50 }, run: (l, c, s) => {
        const r = rumorBy(l, c)!; mark(l, c.rid, { done: true });
        if (r.truth === "false") { if (s) { addFame(l, 3); shiftAlign(l, 2); l.flags.officialFavor = true; return ok("ขุนนางคนนั้นจับมือคุณแน่น — เขาเตรียมบัญชีไว้ทันก่อนผู้ตรวจการมา และติดหนี้คุณหนึ่งครั้ง"); } return meh("เขาไม่เชื่อว่าคุณหวังดี — แต่ก็เตรียมตัวรับการตรวจไว้"); }
        shiftAlign(l, -4); return no("ขุนนางคนนั้นยิ้ม แล้วสั่งเผาบัญชีทั้งคืน — คุณเพิ่งช่วยคนโกงลบหลักฐาน");
      } },
      { label: "ออกหน้าปกป้องชื่อเสียงเขา", skill: ["social"], show: (l, c) => rumorBy(l, c)?.kind === "scandal", run: (l, c) => {
        const r = rumorBy(l, c)!; mark(l, c.rid, { done: true }); const p = l.people.find((x) => x.id === r.pid);
        if (r.truth === "false") { if (p) remember(l, p, "defended", "คุณปกป้องชื่อเสียงเขาจากข่าวลือเท็จ", 3, { trust: 20, love: 10, debt: 15 }); addFame(l, 2); return ok(`คุณยืนยันต่อหน้าทุกคนว่าข่าวนี้ไม่จริง — ${p ? shortName(p) : "เขา"}รู้ว่าใครอยู่ข้างเขาในวันที่แย่ที่สุด`); }
        if (p) remember(l, p, "defended", "คุณปกป้องเขาแม้รู้ว่าเรื่องจริง", 2, { trust: 10, debt: 10 }); addFame(l, -3);
        return meh("ข่าวนั้นเป็นเรื่องจริง — คนทั้งเมืองมองว่าคุณโกหกแทนเพื่อน แต่เพื่อนคนนั้นจะไม่ลืม");
      } },
      { label: "แจ้งทางการจับแก๊งต้มตุ๋นขายคัมภีร์ปลอม", show: (l, c) => rumorBy(l, c)?.kind === "sect", check: { stat: "smarts", dc: 55 }, run: (l, c, s) => {
        const r = rumorBy(l, c)!; mark(l, c.rid, { done: true });
        if (r.truth === "false") { if (s) { addMoney(l, 20 * TAEL); addFame(l, 3); return ok("มือปราบตามรอยจนเจอโรงพิมพ์คัมภีร์ปลอม — คุณได้ส่วนแบ่งค่าปรับ และหลายคนไม่ต้องเสียเงินฟรี"); } return meh("แก๊งรู้ตัวและย้ายไปเมืองอื่นก่อน"); }
        shiftAlign(l, -1); addFame(l, -2); return no("การขายนั้นเป็นเรื่องจริง — คุณทำให้สำนักที่ลำบากอยู่แล้วต้องอับอายต่อหน้าทางการ");
      } },
      { label: "สืบหาว่าใครปล่อยข่าวนี้และทำไม", skill: ["social"], check: { stat: "smarts", dc: 55 }, run: (l, c, s) => {
        const r = rumorBy(l, c)!;
        if (!s) return meh("ข่าวผ่านปากคนมาหลายทอดเกินกว่าจะตามถึงต้นตอ");
        if (r.truth === "false" || r.truth === "trap") {
          mark(l, c.rid, { done: true, verified: true }); addFame(l, 2); addStat(l, "smarts", 1);
          return ok(`ต้นตอคือ${r.src}${r.motive ? ` — เพราะ${r.motive}` : " ที่แค่อยากเป็นคนสำคัญในวงเหล้า"} คุณแฉเรื่องนี้ในตลาด คนเริ่มฟังข่าวจากคุณมากกว่าจากเขา`);
        }
        mark(l, c.rid, { verified: true, rel: 4 });
        return ok("ต้นตอเป็นคนที่เห็นกับตาจริง — เขาเล่ารายละเอียดเพิ่มที่ไม่มีใครรู้ ข่าวนี้น่าเชื่อถือแล้ว");
      } },
      { label: "ขายข่าวนี้ต่อให้คนอื่น", run: (l, c) => {
        const r = rumorBy(l, c)!; mark(l, c.rid, { done: true }); addMoney(l, (r.rel >= 3 ? 12 : 6) * TAEL);
        if (r.truth === "false" || r.truth === "trap") { shiftAlign(l, -3); l.flags.soldBadRumor = Number(l.flags.soldBadRumor ?? 0) + 1; return no(r.truth === "trap" ? "คนที่ซื้อข่าวไปไม่กลับมาอีกเลย — คุณได้เงิน และได้เรื่องหนึ่งที่ต้องแบกไปตลอด" : "คนซื้อเสียเวลาเปล่าแล้วกลับมาด่าคุณถึงหน้าบ้าน — ชื่อเสียงเรื่องข่าวของคุณพังลงหนึ่งขั้น"); }
        return meh("เงินมาง่าย — แต่โอกาสที่ข่าวนี้ให้ ตกเป็นของคนอื่นไปแล้ว");
      } },
      { label: "เปลี่ยนใจ", run: () => meh("คุณเก็บข่าวนี้ไว้ในใจก่อน") },
    ],
  },
  // ───── สืบคดี: หาตัวคนร้ายจากเบาะแส (ไม่ใช่ทุกคดีจะคลี่คลาย) ─────
  {
    id: "iv.case",
    minAge: 16,
    maxAge: 90,
    manual: true,
    maxTimes: 0,
    title: "สืบคดี",
    prepare: (l): Ctx => {
      const shoes = ["รองเท้าผ้าไหม", "รองเท้าฟาง", "รองเท้าหนัง"];
      const ctx: Ctx = { culprit: randInt(l, 0, 2), notes: "", clues: 0 };
      for (let i = 0; i < 3; i++) { ctx[`n${i}`] = npcName(l); ctx[`s${i}`] = shoes[i]; ctx[`h${i}`] = chance(l, 0.5) ? "ซ้าย" : "ขวา"; ctx[`d${i}`] = chance(l, 0.5); }
      // ถนัดมือของคนร้ายต้องแยกแยะได้บ้าง — ไม่รับประกันว่าทุกคดีมีคำตอบครบ
      ctx.what = pick(l, ["ฆ่าพ่อค้าผ้าในตรอกหลังตลาด", "ขโมยหยกประจำตระกูลเศรษฐี", "วางเพลิงโกดังข้าวของทางการ"]);
      return ctx;
    },
    text: (_l, c) => `คดี: มีคน${c.what} — ผู้ต้องสงสัยสามคนคือ ${c.n0} (${c.s0}) · ${c.n1} (${c.s1}) · ${c.n2} (${c.s2}) ไม่มีใครยอมรับ`,
    choices: [
      { label: "เริ่มสืบ", run: () => ({ text: "คุณเปิดสมุดจดบันทึก — มีเวลาสืบได้สามทาง", next: "dig" }) },
      { label: "ไม่รับคดี", run: () => meh("คดีนี้จะถูกปิดแบบที่คนมีอำนาจต้องการ") },
    ],
    scenes: {
      dig: {
        title: "เก็บเบาะแส",
        text: (_l, c) => `เบาะแสที่มี (${c.clues}/3): ${String(c.notes) || "ยังไม่มี"}`,
        choices: [
          { label: "ถามพยานที่เห็นเหตุการณ์", skill: ["social"], show: (_l, c) => !String(c.notes).includes("พยาน"), check: { stat: "smarts", dc: 50 }, run: (l, c, s) => { const real = Number(c.culprit); const said = s ? real : (real + randInt(l, 1, 2)) % 3; c.notes = `${c.notes}พยานเห็นคนใส่${c[`s${said}`]} · `; c.clues = Number(c.clues) + 1; return { text: s ? "พยานจำได้ชัด" : "พยานเล่าอย่างลังเล — อาจจำผิด", next: Number(c.clues) >= 3 ? "accuse" : "dig" }; } },
          { label: "ตรวจที่เกิดเหตุ", skill: ["stealth"], show: (_l, c) => !String(c.notes).includes("รอย"), check: { stat: "smarts", dc: 45 }, run: (_l, c, s) => { const real = Number(c.culprit); c.notes = `${c.notes}${s ? `รอยบาดบอกว่าคนร้ายถนัดมือ${c[`h${real}`]}` : "รอยถูกฝนชะไปหมด"} · `; c.clues = Number(c.clues) + 1; return { text: s ? "รอยแผลบอกอะไรบางอย่าง" : "ที่เกิดเหตุไม่เหลืออะไร", next: Number(c.clues) >= 3 ? "accuse" : "dig" }; } },
          { label: "ตามรอยเงิน", show: (_l, c) => !String(c.notes).includes("เงิน"), check: { stat: "luck", dc: 45 }, run: (_l, c, s) => { const real = Number(c.culprit); c.notes = `${c.notes}${s ? `คนร้าย${c[`d${real}`] ? "เพิ่งใช้หนี้ก้อนใหญ่" : "ไม่มีหนี้สินเลย"}` : "เส้นทางเงินขาดตอน"} · `; c.clues = Number(c.clues) + 1; return { text: s ? "เงินบอกความจริงมากกว่าคำพูด" : "บัญชีถูกเผาไปแล้ว", next: Number(c.clues) >= 3 ? "accuse" : "dig" }; } },
          { label: "พอแล้ว ไปตัดสิน", run: () => ({ text: "คุณปิดสมุดจด", next: "accuse" }) },
        ],
      },
      accuse: {
        title: "ชี้ตัวคนร้าย",
        text: (_l, c) => `เบาะแส: ${String(c.notes) || "ไม่มี"}\nผู้ต้องสงสัย — ${c.n0}: ${c.s0} ถนัด${c.h0} ${c.d0 ? "มีหนี้" : "ไม่มีหนี้"} · ${c.n1}: ${c.s1} ถนัด${c.h1} ${c.d1 ? "มีหนี้" : "ไม่มีหนี้"} · ${c.n2}: ${c.s2} ถนัด${c.h2} ${c.d2 ? "มีหนี้" : "ไม่มีหนี้"}`,
        choices: [
          ...[0, 1, 2].map((i) => ({
            label: (_l: Life, c: Ctx) => `ชี้ว่า ${c[`n${i}`]} คือคนร้าย`,
            run: (l: Life, c: Ctx): Outcome => {
              if (Number(c.culprit) === i) { addFame(l, 4); shiftAlign(l, 2); if (l.job && ["constable", "official", "jinyiwei"].includes(l.job.careerId)) l.job.performance = clamp(l.job.performance + 20, 0, 100); return big(`${c[`n${i}`]}หน้าซีด แล้วยอมรับสารภาพ — คดีปิดได้อย่างถูกต้อง`); }
              shiftAlign(l, -5); addFame(l, -2);
              return no(`${c[`n${i}`]}ถูกลงโทษ — หลายปีต่อมาคนร้ายตัวจริง ${c[`n${Number(c.culprit)}`]} ถูกจับได้ในคดีอื่น และสารภาพเรื่องนี้ด้วย`);
            },
          })),
          { label: "ปิดคดีว่าไม่มีหลักฐานพอ", run: () => meh("ไม่ใช่ทุกคดีจะมีคำตอบ — อย่างน้อยไม่มีผู้บริสุทธิ์ถูกลงโทษเพราะคุณ") },
        ],
      },
    },
  },
];

// ───────────────────────── การปกปิดตัวตน ─────────────────────────
/** ลดความร้อนแรง + กลบข่าวอาชญากรรมล่าสุดเรื่องคุณ */
export function coverTracks(l: Life, heat: number) {
  l.flags.heat = clamp(Number(l.flags.heat ?? 0) - heat, 0, 100);
  if (Number(l.flags.heat) < 50) delete l.flags.wanted;
  const fs = fameNewsOf(l);
  const bad = fs.filter((f) => !f.good && !f.covered).pop();
  if (bad) bad.covered = true;
  saveFame(l, fs);
}
