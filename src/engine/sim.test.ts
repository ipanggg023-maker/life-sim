import { describe, expect, it } from "vitest";
import { loadHunterWorld } from "../content/hunter";
import { CAREERS } from "../content/hunter/careers";
import { canEnterGate, enterGate } from "../content/hunter/events/gates";
import { rankName } from "../content/hunter/power";
import { ACTIVITIES, activityLocked, doActivity } from "./activities";
import { visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadHunterWorld();

function drain(life: Life, r: { rng: number }) {
  let guard = 0;
  while (life.queue.length && guard++ < 50) {
    const opts = visibleChoices(life, life.queue[0]);
    expect(opts.length, `ไม่มีตัวเลือกใน ${life.queue[0].eventId}/${life.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(life, opts[Math.floor(nextFloat(r) * opts.length)].index);
  }
}

function playLife(seed: number, opts: { hunterBot?: boolean } = {}): Life {
  const life = createLife({ seed });
  const r = { rng: seed ^ 0x5bd1e995 };
  let guard = 0;
  while (life.alive && guard++ < 200) {
    drain(life, r);
    if (!life.alive) break;
    for (const a of ACTIVITIES) if (!activityLocked(life, a) && nextFloat(r) < 0.3) doActivity(life, a.id);
    if (life.power && opts.hunterBot && life.job?.careerId !== "hunter") applyJob(life, "hunter");
    if (!life.job && life.age >= 18) applyJob(life, CAREERS[Math.floor(nextFloat(r) * CAREERS.length)].id);
    if (opts.hunterBot) {
      for (let i = 0; i < 3 && life.alive; i++) {
        const gr = Math.max(0, (life.power?.rank ?? 0) - (nextFloat(r) < 0.7 ? 1 : 0));
        if (canEnterGate(life, gr)) break;
        enterGate(life, gr);
        drain(life, r);
      }
    }
    if (life.alive) ageUp(life);
  }
  return life;
}

describe("จำลองชีวิต", () => {
  it("เล่นจนจบได้ 300 ชีวิตโดยไม่พัง และอายุเฉลี่ยสมเหตุสมผล", () => {
    const ages: number[] = [];
    const worth: number[] = [];
    let degrees = 0;
    let awakened = 0;
    for (let s = 1; s <= 300; s++) {
      const life = playLife(s * 7919);
      worth.push(life.money - life.debt);
      if (life.education.degree) degrees++;
      if (life.power) awakened++;
      expect(life.alive).toBe(false);
      for (const v of Object.values(life.stats)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(JSON.parse(JSON.stringify(life))).toEqual(life);
      ages.push(life.age);
    }
    const avg = ages.reduce((a, b) => a + b, 0) / ages.length;
    worth.sort((a, b) => a - b);
    console.log(
      "SIM อายุเฉลี่ย", avg.toFixed(1), "| ทรัพย์สินมัธยฐาน", worth[150], "| จบปริญญา", degrees, "/300", "| ตื่นพลัง", awakened, "/300",
    );
    expect(avg).toBeGreaterThan(55);
    expect(avg).toBeLessThan(95);
  });

  it("บอท Hunter บุก Gate ทุกปีได้โดยไม่พัง", () => {
    const ranks: Record<string, number> = {};
    const hunterAges: number[] = [];
    const levels: number[] = [];
    let gateDeaths = 0;
    let hunters = 0;
    for (let s = 1; s <= 300; s++) {
      const life = playLife(s * 104729, { hunterBot: true });
      if (!life.power) continue;
      hunters++;
      const k = rankName(life.power.rank);
      ranks[k] = (ranks[k] ?? 0) + 1;
      hunterAges.push(life.age);
      levels.push(life.power.level);
      if (/Gate|ดันเจี้ยน|Red Gate/.test(life.causeOfDeath ?? "")) gateDeaths++;
    }
    const avg = hunterAges.reduce((a, b) => a + b, 0) / Math.max(1, hunterAges.length);
    console.log("SIM Hunter", hunters, "คน | อายุเฉลี่ย", avg.toFixed(1), "| ตายใน Gate", gateDeaths, "| แรงก์ตอนจบ", JSON.stringify(ranks), "| เลเวลมัธยฐาน", levels.sort((a, b) => a - b)[levels.length >> 1]);
    expect(hunters).toBeGreaterThan(100);
  });

  it("seed เดียวกันได้ชีวิตเหมือนกัน (จำเป็นสำหรับการย้อนเวลา)", () => {
    const a = playLife(42, { hunterBot: true });
    const b = playLife(42, { hunterBot: true });
    expect(a.log).toEqual(b.log);
  });
});
