// ปีหนึ่งคือหนึ่งบท: เลือกเรื่องหลักหนึ่งเรื่องที่ผูกกับชีวิตคุณมากที่สุด ที่เหลือเป็นช่วงเล็กๆ ที่นิสัยของคุณตัดสินเอง
// แผนอยู่ที่ design/YEAR_REWORK.md
import type { Ctx } from "../../engine/events";
import type { QueuedEvent } from "../../engine/types";
import { currentScene, getEvent, labelOf, stillValid, visibleChoices } from "../../engine/events";
import { choiceChance, choiceHooks, runEvent, yearEndHooks } from "../../engine/game";
import { nextFloat } from "../../engine/rng";
import type { Life, LogKind } from "../../engine/types";
import { displayName, log } from "../../engine/util";
import { chance, pick } from "../../engine/rng";
import { dataOf, kingdomsOf, worldOfLife } from "./state";
import { personaOf } from "./persona";
import { pickHeadline } from "./hkit";
import { GOLD } from "./kit";

/** ฉากที่ต้องเป็นป๊อปอัปเสมอ: อ่านดาว ทะลวงขั้น สงครามจบ จุดหักเหของนิสัย */
const ALWAYS = /^ft\.(st\.awaken|st\.bloom|break_|wr\.after|pe\.|hu\.)/;
/** เรื่องจากระบบที่ผูกกับชีวิตคุณ: ผู้คน ครอบครัว ศัตรู เพื่อน เรื่องที่กลับมา งาน ราชสำนัก สงคราม */
const TIED = /^ft\.(np|fd|en|fr|ec|wk|wd|wr|mo|fm)\./;
export const MAX_MOMENTS = 4;

/** เลือกตามนิสัย: ทางที่ตรงกับตัวคุณที่สุด · ไม่เลือกทางเสี่ยงตายแทนผู้เล่น */
export function personaPick(l: Life, q: QueuedEvent): number | undefined {
  const vis = visibleChoices(l, q).filter(({ c }) => c.tone !== "danger" && !c.survival);
  if (!vis.length) return undefined;
  const p = personaOf(l);
  let best = vis[0].index, top = -Infinity;
  for (const { c, index } of vis) {
    let s = nextFloat(l) * 0.6;
    if (c.lean) for (const [k, v] of Object.entries(c.lean)) s += (v * (p[k as keyof typeof p] ?? 0)) / 400;
    // คนกล้าชอบทางที่ต้องลุ้น คนรอบคอบชอบทางที่แน่นอน
    if (c.odds || c.check) s += p.c / 200;
    const lab = labelOf(c, l, q.ctx);
    if (/เหรียญทอง/.test(lab) && l.money < 30 * GOLD) s -= 0.6;
    if (s > top) { top = s; best = index; }
  }
  return best;
}

export interface Moment { title?: string; label: string; text: string; kind?: LogKind }
/** เล่นฉากหนึ่งจนจบโดยไม่เปิดหน้าต่าง · ผลจริงทุกอย่างเหมือนเลือกเอง */
export function autoResolve(l: Life, q: QueuedEvent): Moment | undefined {
  const e = getEvent(q.eventId);
  // ช่วงก่อนหน้าในปีเดียวกันอาจทำให้เรื่องนี้หมดเงื่อนไขแล้ว (เช่น แต่งงานไปแล้ว)
  if (!e || !stillValid(l, e)) return;
  let label = "", text = "", kind: LogKind | undefined;
  for (let guard = 0; guard < 6 && l.alive; guard++) {
    const idx = personaPick(l, q);
    if (idx === undefined) return guard ? { title: e.title, label, text, kind } : undefined;
    const c = currentScene(q, l)!.choices[idx];
    label = labelOf(c, l, q.ctx);
    const p = choiceChance(l, q, idx);
    const ok = p === undefined || nextFloat(l) < p;
    const out = c.run(l, q.ctx, ok);
    for (const h of choiceHooks) h(l, c, q.ctx, ok, q.eventId);
    text = out.text; kind = out.kind;
    if (out.next) { q.scene = out.next; continue; }
    break;
  }
  return { title: e.title, label, text, kind };
}

const QUIET_TITLE = ["ปีที่ผ่านไปอย่างเงียบๆ", "ปีของวันธรรมดา", "ปีที่ไม่มีอะไรมาก", "ปีที่ได้พักหายใจ"];
const LINK = ["ปีนั้น", "ไม่นานหลังจากนั้น", "กลางปี", "ก่อนสิ้นปี"];
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
/** ประโยคของช่วงเล็กๆ: เรื่องอะไร คุณทำอะไร แล้วเกิดอะไร */
export const momentLine = (m: Moment, i = 0) => clean(`${LINK[i % LINK.length]}${m.title ? `มีเรื่อง${m.title} ` : " "}คุณ${m.label.replace(/\s*\(\d+ เหรียญทอง\)/, "")} ${m.text}`);
export function chapterTitle(l: Life, theme?: string) {
  // ชื่อบทตามเรื่องที่เกิดจริงในปีนั้น · ปีที่ไม่มีเรื่องใหญ่ก็บอกว่าเงียบ
  return `อายุ ${l.age} · ${theme ?? QUIET_TITLE[(l.age * 7 + l.id.length) % QUIET_TITLE.length]}`;
}
export const autoDecide = (l: Life) => !!l.flags.ftAutoDecide;

/** จัดปีใหม่: เรื่องหลักหนึ่งเรื่อง · ช่วงเล็กๆ ไม่เกินสี่ · ฉากบังคับเป็นป๊อปอัปตามเดิม */
/** เรื่องที่เกิดในคุกได้ (ตรงกับ JAIL_EVENTS ใน underworld.ts) */
const JAIL_STORY = /^ft\.(ug\.|break_|f2\.last|fr\.jail)/;
export function buildYear(l: Life) {
  if (l.worldId !== "fantasy" || !l.ft || !l.alive || l.age < 3) return;
  const queued = l.queue.splice(0);
  const keep: QueuedEvent[] = [], cand: { q: QueuedEvent; s: number }[] = [];
  const ids = new Set<string>();
  for (const q of queued) {
    const e = getEvent(q.eventId);
    // เรื่องเดียวกันซ้ำในปีเดียวไม่ต้องเล่าสองรอบ
    if (!e || (!q.scene && ids.has(q.eventId))) continue;
    ids.add(q.eventId);
    if (e.forced || ALWAYS.test(q.eventId) || q.scene) keep.push(q);
    else cand.push({ q, s: q.eventId.startsWith("ft.ec.") || q.eventId.startsWith("ft.el.") || q.eventId === "ft.sg.cont" ? 5 : TIED.test(q.eventId) ? 3 : 1 });
  }
  // ในคุก: เรื่องของชีวิตข้างนอกรอจนพ้นโทษ เหลือแค่เรื่องในคุก (underworld.ts)
  const inJail = Number(l.flags.jailUntil ?? -1) > l.age;
  if (inJail) for (let i = cand.length - 1; i >= 0; i--) if (!JAIL_STORY.test(cand[i].q.eventId)) cand.splice(i, 1);
  // เรื่องหลักจากคลังเรื่องใหญ่ ผูกกับชีวิตคุณตามจำนวนจุดเชื่อม
  const hl = inJail ? undefined : pickHeadline(l);
  let head: QueuedEvent | undefined;
  let best = -1, bestIdx = -1;
  cand.forEach((x, i) => { const s = x.s + nextFloat(l) * 1.5; if (s > best) { best = s; bestIdx = i; } });
  if (hl && hl.score + nextFloat(l) * 1.5 >= best) {
    runEvent(l, hl.id, hl.ctx?.() ?? {});
    head = l.queue.pop();
    // เรื่องหลักแทนที่เรื่องสุ่มหนึ่งเรื่อง ไม่ได้เพิ่มเข้าไป · ปีหนึ่งมีเรื่องเท่าเดิม
    const filler = cand.findIndex((x) => x.s <= 1);
    if (filler >= 0) cand.splice(filler, 1);
  } else if (bestIdx >= 0) {
    head = cand.splice(bestIdx, 1)[0].q;
  }
  const rest = cand.sort((a, b) => b.s - a.s).map((x) => x.q);
  if (head && autoDecide(l)) rest.unshift(head), (head = undefined);
  const list = rest.slice(0, MAX_MOMENTS + (autoDecide(l) ? 1 : 0));
  // จำสภาพก่อนช่วงเล็กๆ ไว้ (เฉพาะในหน้าจอนี้) เพื่อให้ "คิดใหม่" ได้หนึ่งเรื่องต่อปี
  redoSnap = { id: l.id, age: l.age, base: structuredClone(l), head: head && structuredClone(head), keep: structuredClone(keep), list: structuredClone(list), picked: [] };
  finishYear(l, head, keep, list);
}

/** ช่วงเล็กๆ ของปี นิสัยตัดสินเอง · redo = เรื่องที่ผู้เล่นขอเลือกเอง (ขึ้นเป็นป๊อปอัปแทน) */
function finishYear(l: Life, head: QueuedEvent | undefined, keep: QueuedEvent[], list: QueuedEvent[], redo?: number) {
  const moments: Moment[] = [];
  const mine: QueuedEvent[] = [];
  list.forEach((q, i) => {
    if (!l.alive) return;
    if (i === redo) { mine.push(q); return; }
    const m = autoResolve(l, q);
    if (m) { moments.push(m); log(l, momentLine(m, moments.length - 1), m.kind ?? "normal"); if (redo === undefined) redoSnap?.picked.push({ i, title: m.title ?? m.label }); }
  });
  if (!l.alive) return;
  const extra = l.queue.splice(0);
  l.queue = [...(head ? [head] : []), ...keep, ...mine, ...extra];
  const theme = head ? getEvent(head.eventId)?.title : moments.find((m) => m.title)?.title;
  const news = worldNews(l);
  if (news) log(l, `ข่าวจากแผ่นดิน: ${news}`, "normal");
  l.lastChapter = l.chapter;
  l.flags[`ch_${l.age}`] = chapterTitle(l, theme);
  l.chapter = { age: l.age, title: chapterTitle(l, theme), lines: moments.map(momentLine), ...(head ? { headline: getEvent(head.eventId)?.title ?? "" } : {}) };
}

// ───────────── คิดใหม่หนึ่งเรื่องต่อปี ─────────────
let redoSnap: { id: string; age: number; base: Life; head?: QueuedEvent; keep: QueuedEvent[]; list: QueuedEvent[]; picked: { i: number; title: string }[] } | undefined;
export const REDO_COST = 3;
/** ช่วงเล็กๆ ของปีนี้ที่ขอคิดใหม่ได้ (ปีละเรื่อง ก่อนเลือกอะไรต่อในปีนี้) */
export function redoable(l: Life): { i: number; title: string }[] {
  if (!redoSnap || redoSnap.id !== l.id || redoSnap.age !== l.age || l.flags.ftRedoAt === l.age || !l.alive) return [];
  return redoSnap.picked;
}
/** ย้อนกลับไปก่อนช่วงเล็กๆ ของปีนี้ แล้วให้ผู้เล่นเลือกเรื่องที่ i เอง · เสียความสุขเล็กน้อย */
export function redoMoment(l: Life, i: number): Life | undefined {
  if (!redoable(l).some((x) => x.i === i) || !redoSnap) return;
  const s = redoSnap;
  const n = structuredClone(s.base);
  finishYear(n, s.head && structuredClone(s.head), structuredClone(s.keep), structuredClone(s.list), i);
  n.flags.ftRedoAt = n.age;
  n.stats.happiness = Math.max(0, n.stats.happiness - REDO_COST);
  log(n, "คุณนอนไม่หลับทั้งคืน คิดว่าถ้าย้อนกลับไปได้จะทำอีกแบบ", "normal");
  redoSnap = undefined;
  return n;
}

export function worldNews(l: Life): string | undefined {
  const w = worldOfLife(l), me = displayName(l);
  const fresh = (w.chronicle ?? []).filter((c) => c.year === w.year && !c.text.includes(me) && !c.text.includes(l.firstName));
  if (fresh.length) return fresh[fresh.length - 1].text;
  if (!chance(l, NEWS_CHANCE)) return;
  const ks = kingdomsOf(l), war = ks.find((k) => k.war), d = dataOf(l).dragons.filter((x) => x.alive);
  const opts: string[] = [];
  if (war) opts.push(`สงครามของ${war.name}ยังไม่จบ ทหารผ่านเมืองทุกสัปดาห์`);
  if (d.length) { const x = pick(l, d); opts.push(`มีคนเห็น${x.name} ${x.title} บินอยู่เหนือ${pick(l, ks).name}`); }
  const old = ks.filter((k) => k.rulerAge >= 70);
  if (old.length) { const k = pick(l, old); opts.push(`ผู้คนเริ่มกระซิบว่า${k.ruler}แห่ง${k.name}ชราลงมาก`); }
  return opts.length ? pick(l, opts) : undefined;
}
export const NEWS_CHANCE = 0.35;

export function loadYear() {
  yearEndHooks.push(buildYear);
}
export type { Ctx };

// ───────────── ใช้ชีวิตเงียบๆ หลายปี ─────────────
/** เรื่องที่ต้องหยุดให้ผู้เล่นเลือกเอง: อันตราย ครอบครัว เรื่องที่กลับมา และการตัดสินใจใหญ่ */
const STOP_ID = /^ft\.(st\.|break_|wr\.|pe\.|fd\.|np\.|ec\.|sg\.cont|el\.calling|cp\.|ar\.destiny|ar\.love|fm\.|\$\.creditor)/;
export function stopsQuiet(l: Life, q: QueuedEvent): string | undefined {
  const e = getEvent(q.eventId);
  if (!e) return;
  if (e.forced || STOP_ID.test(q.eventId)) return e.title ? `มีเรื่อง${e.title}ให้ตัดสินใจ` : "มีเรื่องสำคัญให้ตัดสินใจ";
  const risky = visibleChoices(l, q).some(({ c }) => c.tone === "danger" || (c.survival && c.survival(l, q.ctx) < 0.95));
  return risky ? `เรื่อง${e.title ?? "ที่เกิดขึ้น"}มีอันตราย` : undefined;
}
export const QUIET_YEARS = [5, 10];
/** เดินเวลาหลายปีแบบเงียบๆ · หยุดเมื่อมีเรื่องสำคัญ อันตราย คนเกิดหรือตาย สุขภาพแย่ หรือเริ่มเป็นหนี้ · คืนเหตุที่หยุด */
export function liveQuietly(l: Life, years: number, ageUp: (l: Life) => void): string | undefined {
  for (let y = 0; y < years && l.alive; y++) {
    const kin = l.people.filter((p) => p.alive && ["child", "spouse", "partner", "father", "mother"].includes(p.relation)).map((p) => p.id).join();
    const debt = l.debt;
    ageUp(l);
    if (!l.alive) return "ชีวิตจบลง";
    // ทุกเรื่องในปีนี้: ถ้ามีเรื่องที่ต้องหยุด ปล่อยไว้ให้ผู้เล่นเลือก ที่เหลือนิสัยตัดสินเอง
    for (let guard = 0; guard < 12 && l.queue.length; guard++) {
      const q = l.queue[0];
      const why = stopsQuiet(l, q);
      if (why) return why;
      l.queue.shift();
      const m = autoResolve(l, q);
      if (m) log(l, momentLine(m), m.kind ?? "normal");
      if (!l.alive) return "ชีวิตจบลง";
    }
    const kinNow = l.people.filter((p) => p.alive && ["child", "spouse", "partner", "father", "mother"].includes(p.relation)).map((p) => p.id).join();
    if (kinNow !== kin) return "ครอบครัวมีคนเกิดหรือจากไป";
    if (l.stats.health < 40) return "สุขภาพแย่ลง";
    if (l.debt > debt) return "เริ่มมีหนี้";
  }
  return undefined;
}
