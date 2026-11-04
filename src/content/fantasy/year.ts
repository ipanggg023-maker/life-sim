// ปีหนึ่งคือหนึ่งบท: เลือกเรื่องหลักหนึ่งเรื่องที่ผูกกับชีวิตคุณมากที่สุด ที่เหลือเป็นช่วงเล็กๆ ที่นิสัยของคุณตัดสินเอง
// แผนอยู่ที่ design/YEAR_REWORK.md
import type { Ctx } from "../../engine/events";
import type { QueuedEvent } from "../../engine/types";
import { currentScene, getEvent, labelOf, stillValid, visibleChoices } from "../../engine/events";
import { choiceChance, choiceHooks, runEvent, yearEndHooks } from "../../engine/game";
import { nextFloat } from "../../engine/rng";
import type { Life, LogKind } from "../../engine/types";
import { log } from "../../engine/util";
import { personaOf } from "./persona";
import { pickHeadline } from "./hkit";
import { GOLD } from "./kit";

/** ฉากที่ต้องเป็นป๊อปอัปเสมอ: อ่านดาว ทะลวงขั้น สงครามจบ จุดหักเหของนิสัย */
const ALWAYS = /^ft\.(st\.awaken|st\.bloom|break_|wr\.after|pe\.)/;
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

const SEASON = ["ฤดูใบไม้ผลิ", "ฤดูร้อน", "ฤดูฝน", "ฤดูหนาว"];
const LINK = ["ปีนั้น", "ไม่นานหลังจากนั้น", "กลางปี", "ก่อนสิ้นปี"];
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
/** ประโยคของช่วงเล็กๆ: เรื่องอะไร คุณทำอะไร แล้วเกิดอะไร */
export const momentLine = (m: Moment, i = 0) => clean(`${LINK[i % LINK.length]}${m.title ? `มีเรื่อง${m.title} ` : " "}คุณ${m.label.replace(/\s*\(\d+ เหรียญทอง\)/, "")} ${m.text}`);
export function chapterTitle(l: Life, theme?: string) {
  return `อายุ ${l.age} · ${SEASON[(l.age * 7 + l.id.length) % 4]}แห่ง${theme ?? "วันธรรมดา"}`;
}
export const autoDecide = (l: Life) => !!l.flags.ftAutoDecide;

/** จัดปีใหม่: เรื่องหลักหนึ่งเรื่อง · ช่วงเล็กๆ ไม่เกินสี่ · ฉากบังคับเป็นป๊อปอัปตามเดิม */
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
    else cand.push({ q, s: q.eventId.startsWith("ft.ec.") || q.eventId.startsWith("ft.el.") ? 5 : TIED.test(q.eventId) ? 3 : 1 });
  }
  // เรื่องหลักจากคลังเรื่องใหญ่ ผูกกับชีวิตคุณตามจำนวนจุดเชื่อม
  const hl = pickHeadline(l);
  let head: QueuedEvent | undefined;
  let best = -1, bestIdx = -1;
  cand.forEach((x, i) => { const s = x.s + nextFloat(l) * 1.5; if (s > best) { best = s; bestIdx = i; } });
  if (hl && hl.score + nextFloat(l) * 1.5 >= best) {
    runEvent(l, hl.id);
    head = l.queue.pop();
    // เรื่องหลักแทนที่เรื่องสุ่มหนึ่งเรื่อง ไม่ได้เพิ่มเข้าไป · ปีหนึ่งมีเรื่องเท่าเดิม
    const filler = cand.findIndex((x) => x.s <= 1);
    if (filler >= 0) cand.splice(filler, 1);
  } else if (bestIdx >= 0) {
    head = cand.splice(bestIdx, 1)[0].q;
  }
  const rest = cand.sort((a, b) => b.s - a.s).map((x) => x.q);
  if (head && autoDecide(l)) rest.unshift(head), (head = undefined);
  const moments: Moment[] = [];
  for (const q of rest.slice(0, MAX_MOMENTS + (autoDecide(l) ? 1 : 0))) {
    const m = autoResolve(l, q);
    if (m) { moments.push(m); log(l, momentLine(m, moments.length - 1), m.kind ?? "normal"); }
    if (!l.alive) return;
  }
  const extra = l.queue.splice(0);
  l.queue = [...(head ? [head] : []), ...keep, ...extra];
  const theme = head ? getEvent(head.eventId)?.title : moments.find((m) => m.title)?.title;
  l.lastChapter = l.chapter;
  l.flags[`ch_${l.age}`] = chapterTitle(l, theme);
  l.chapter = { age: l.age, title: chapterTitle(l, theme), lines: moments.map(momentLine), ...(head ? { headline: getEvent(head.eventId)?.title ?? "" } : {}) };
}

export function loadYear() {
  yearEndHooks.push(buildYear);
}
export type { Ctx };
