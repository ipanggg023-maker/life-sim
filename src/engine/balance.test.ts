// Phase 9 — วัดสมดุลยุทธภพ (MURIM_PLAN §18.10 ข้อ 9): อายุขัย สาเหตุการตาย การกระจายขั้นฝีมือ รายได้ตามอาชีพ บาดแผล ครอบครัว สงคราม
// บอท 2 แบบ: "ระวังตัว" (เหมือนผู้เล่นที่คิดก่อนเลือก) และ "สุ่ม" — ผลที่ได้คือกรอบที่เกมควรอยู่ ไม่ใช่ตัวเลขตายตัว
import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { CAREERS } from "../content/hunter/careers";
import { rankLabel } from "../content/hunter/power";
import { artsOf } from "../content/murim/martial/arts";
import { trainArt } from "../content/murim/martial/training";
import { plansFor, setPlan } from "../content/murim/life/plan";
import { worldOfLife } from "../content/murim/life/world";
import { permanentInjuries } from "./body";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { currentScene, visibleChoices } from "./events";
import { ageUp, applyJob, choiceChance, createLife, propose, resolveChoice, tryForBaby, workHard } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { people } from "./util";

loadMurimWorld();
loadSharedEvents();

type Bot = "careful" | "random";

function pick(l: Life, r: { rng: number }, bot: Bot): number {
  const q = l.queue[0];
  const opts = visibleChoices(l, q);
  if (bot === "random") return opts[Math.floor(nextFloat(r) * opts.length)].index;
  const sc = currentScene(q, l)!;
  let best = opts[0].index, bestScore = -9;
  for (const o of opts) {
    const c = sc.choices[o.index];
    const p = choiceChance(l, q, o.index);
    const surv = c.survival?.(l, q.ctx) ?? 1;
    let score = (p ?? 0.75) + nextFloat(r) * 0.15;
    if (surv < 0.95) score -= (1 - surv) * 4;
    if (c.tone === "danger" && (p ?? 0.5) < 0.7) score -= 0.4;
    if (score > bestScore) { bestScore = score; best = o.index; }
  }
  return best;
}

function drain(l: Life, r: { rng: number }, bot: Bot) {
  let g = 0;
  while (l.queue.length && g++ < 80) resolveChoice(l, pick(l, r, bot));
}

interface Stats { ages: number[]; causes: Record<string, number>; realms: Record<string, number>; married: number; kids: number; perm: number; jobMoney: Record<string, number[]>; war: number; jailed: number }

function run(N: number, bot: Bot, seedMul: number): Stats {
  const st: Stats = { ages: [], causes: {}, realms: {}, married: 0, kids: 0, perm: 0, jobMoney: {}, war: 0, jailed: 0 };
  const murimJobs = CAREERS.filter((c) => c.world === "murim" && !["bandit", "pirate", "thief", "poisoner", "cultist", "m_assassin"].includes(c.id));
  for (let s = 1; s <= N; s++) {
    const l = createLife({ seed: s * seedMul, worldId: "murim" });
    worldOfLife(l);
    const r = { rng: s * 17 };
    let g = 0, money40 = -1, job40 = "", sawWar = false;
    while (l.alive && g++ < 130) {
      drain(l, r, bot);
      if (!l.alive) break;
      if (bot === "careful") {
        const opts = plansFor(l);
        const want = l.stats.health < 45 ? "rest" : l.power && l.age < 40 ? "train" : l.job ? "work" : "family";
        if (opts.some((o) => o.id === want)) setPlan(l, want);
        if (l.power && artsOf(l)[0]) trainArt(l, artsOf(l)[0].id, l.stats.health >= 60 ? "hard" : "safe");
        if (!l.job && l.age >= 16) applyJob(l, murimJobs[Math.floor(nextFloat(r) * murimJobs.length)].id);
        if (l.job) workHard(l);
        for (const id of ["m_heal", "mw_matchmaker", "mw_meditate", "mw_doctor"]) { const a = activitiesFor(l).find((x) => x.id === id); if (a && !activityLocked(l, a) && (id !== "mw_doctor" || l.stats.health < 60)) { doActivity(l, id); drain(l, r, bot); } }
        const pt = people(l, "partner")[0];
        if (pt && l.age >= 18) propose(l, pt);
        const sp = people(l, "spouse")[0];
        if (sp && l.age <= 45 && people(l, "child").length < 3) tryForBaby(l, sp);
      } else {
        const opts = plansFor(l);
        if (opts.length && nextFloat(r) < 0.4) setPlan(l, opts[Math.floor(nextFloat(r) * opts.length)].id);
        if (!l.job && l.age >= 16 && nextFloat(r) < 0.3) applyJob(l, murimJobs[Math.floor(nextFloat(r) * murimJobs.length)].id);
      }
      drain(l, r, bot);
      if (l.age === 40) { money40 = l.money; job40 = l.job?.careerId ?? ""; }
      if (l.mw?.era === "war") sawWar = true;
      if (Number(l.flags.jailUntil ?? -1) > l.age) st.jailed++;
      ageUp(l);
    }
    st.ages.push(l.age);
    const cause = (l.causeOfDeath ?? "?").replace(/ระดับ.*$/, "").slice(0, 30);
    st.causes[cause] = (st.causes[cause] ?? 0) + 1;
    const realm = l.power ? rankLabel(l, l.power.rank) : "ไม่ได้ฝึก";
    st.realms[realm] = (st.realms[realm] ?? 0) + 1;
    if (l.people.some((p) => p.relation === "spouse")) st.married++;
    st.kids += l.people.filter((p) => p.relation === "child").length;
    st.perm += permanentInjuries(l).length;
    if (job40 && money40 >= 0) (st.jobMoney[job40] ??= []).push(money40);
    if (sawWar) st.war++;
  }
  return st;
}

const q = (xs: number[], p: number) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor((s.length - 1) * p)]; };

describe("Phase 9: สมดุลยุทธภพ", () => {
  it("ผู้เล่นที่ระวังตัวอยู่ได้นานกว่าผู้เล่นมั่ว และตัวเลขอยู่ในกรอบที่สมจริง", () => {
    const N = 200;
    const c = run(N, "careful", 7841);
    const r = run(N, "random", 7841);
    const top = (o: Record<string, number>) => JSON.stringify(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8));
    console.log("BAL ระวังตัว อายุ p25/50/75", q(c.ages, 0.25), q(c.ages, 0.5), q(c.ages, 0.75), "| แต่งงาน", c.married, "| ลูกเฉลี่ย", (c.kids / N).toFixed(2), "| พิการถาวรเฉลี่ย", (c.perm / N).toFixed(2), "| เคยเจอยุคสามแคว้น", c.war, "| ปีในคุก", c.jailed);
    console.log("BAL ระวังตัว ขั้นฝีมือ", JSON.stringify(c.realms));
    console.log("BAL ระวังตัว สาเหตุตาย", top(c.causes));
    console.log("BAL ระวังตัว เงินตอนอายุ 40 (มัธยฐาน ตำลึง)", JSON.stringify(Object.fromEntries(Object.entries(c.jobMoney).filter(([, v]) => v.length >= 3).map(([k, v]) => [k, Math.round(q(v, 0.5) / 1000)]))));
    console.log("BAL สุ่ม อายุ p25/50/75", q(r.ages, 0.25), q(r.ages, 0.5), q(r.ages, 0.75), "| สาเหตุตาย", top(r.causes));
    expect(q(c.ages, 0.5)).toBeGreaterThan(q(r.ages, 0.5));
    expect(q(c.ages, 0.5)).toBeGreaterThanOrEqual(65);
    expect(q(r.ages, 0.5)).toBeGreaterThanOrEqual(35);
    expect(q(r.ages, 0.5)).toBeLessThanOrEqual(70); // โลกยังโหด: เลือกมั่วต้องเจ็บจริง
    expect(c.married).toBeGreaterThan(N * 0.6);
    expect(c.kids / N).toBeGreaterThan(1);
    const trained = N - (c.realms["ไม่ได้ฝึก"] ?? 0);
    const peak = (c.realms["จุดสูงสุด"] ?? 0) + (c.realms["เหนือจุดสูงสุด"] ?? 0) + (c.realms["หลอมรวม"] ?? 0);
    expect(peak).toBeGreaterThan(0);
    expect(peak / trained).toBeLessThan(0.25); // ยอดฝีมือต้องหายาก
  });
});
