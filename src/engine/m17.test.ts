import { describe, expect, it } from "vitest";
import { worldMatches } from "../content/worlds";
import { loadHunterWorld } from "../content/hunter";
import { CAREERS } from "../content/hunter/careers";
import { canEnterGate, enterGate, train } from "../content/hunter/events/gates";
import { combatPower, rankLabel } from "../content/hunter/power";
import { loadMurimWorld } from "../content/murim";
import { M17_EVENTS } from "../content/murim/m17";
import { alignment, canFound, foundSect, ledger, masters, myPlace, mySect, sectNameOptions, wasRanked } from "../content/murim/m17core";
import { loadSharedEvents } from "../content/shared";
import { artsOf } from "../content/murim/martial/arts";
import { trainArt } from "../content/murim/martial/training";
import { setPlan } from "../content/murim/life/plan";
import { ACTIVITIES, activityLocked, doActivity } from "./activities";
import { allEvents, visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadHunterWorld();
loadMurimWorld();
loadSharedEvents();

function drain(life: Life, r: { rng: number }, seen: Set<string>) {
  let guard = 0;
  while (life.queue.length && guard++ < 50) {
    const q = life.queue[0];
    const opts = visibleChoices(life, q);
    expect(opts.length, `ไม่มีตัวเลือกใน ${q.eventId}/${q.scene ?? "start"}`).toBeGreaterThan(0);
    if (q.eventId.startsWith("m17.")) seen.add(q.eventId);
    resolveChoice(life, opts[Math.floor(nextFloat(r) * opts.length)].index);
  }
}

/** บอทสายบู๊: ฝึกทุกปี รับภารกิจ ก่อตั้งสำนักเมื่อทำได้ */
function play(seed: number, seen: Set<string>, grinder: boolean): Life {
  const life = createLife({ seed, worldId: "murim" });
  const r = { rng: seed ^ 0x2545f491 };
  let guard = 0;
  while (life.alive && guard++ < 200) {
    drain(life, r, seen);
    if (!life.alive) break;
    for (const a of ACTIVITIES) if (!a.id.startsWith("free_") && !activityLocked(life, a) && nextFloat(r) < 0.3) doActivity(life, a.id);
    if (grinder && life.power && !["disciple", "wanderer"].includes(life.job?.careerId ?? "")) applyJob(life, "wanderer");
    const careers = CAREERS.filter((c) => worldMatches(c.world, life.worldId));
    if (!life.job && life.age >= 16) applyJob(life, careers[Math.floor(nextFloat(r) * careers.length)].id);
    if (grinder && life.power) {
      train(life);
      // บอทสายบู๊ใช้ระบบฝึกแบบใหม่: แผนปี "ทุ่มเทฝึกวิชา" + ฝึกวิชาหลักทุกปี
      setPlan(life, "train");
      const art = artsOf(life)[0];
      if (art) trainArt(life, art.id, nextFloat(r) < 0.6 ? "master" : "hard");
      for (let i = 0; i < 3 && life.alive; i++) {
        const gr = Math.max(0, life.power.rank - (nextFloat(r) < 0.7 ? 1 : 0));
        if (canEnterGate(life, gr)) break;
        enterGate(life, gr);
        drain(life, r, seen);
      }
      if (!canFound(life) && nextFloat(r) < 0.5) foundSect(life, sectNameOptions(life)[0]);
    }
    for (const e of life.log.slice(-40)) if (e.text.includes("📜")) seen.add("m17.r.announce");
    if (life.alive) ageUp(life);
  }
  drain(life, r, seen);
  return life;
}

describe("M17 ยุทธภพ", () => {
  it("มี event ใหม่ของยุทธภพอย่างน้อย 150 อัน และ id ไม่ซ้ำ", () => {
    expect(M17_EVENTS.length).toBeGreaterThanOrEqual(150);
    const ids = new Set(M17_EVENTS.map((e) => e.id));
    expect(ids.size).toBe(M17_EVENTS.length);
    for (const e of M17_EVENTS) expect(e.id.startsWith("m17.")).toBe(true);
    expect(allEvents().filter((e) => e.id.startsWith("m17.")).every((e) => e.world === "murim")).toBe(true);
  });

  it("จำลอง 200 ชีวิตในยุทธภพ: ทุกฉากมีตัวเลือก ชีวิตจบได้ และระบบประจำโลกทำงาน", () => {
    const seen = new Set<string>();
    const ranks: Record<string, number> = {};
    const best: Record<string, number> = {};
    let ranked = 0;
    let top = 0;
    let sects = 0;
    let bigSect = 0;
    let favors = 0;
    let grudges = 0;
    let cashed = 0;
    let saints = 0;
    let demons = 0;
    let cultivators = 0;
    let xian = 0;
    const cps: number[] = [];
    const causes: Record<string, number> = {};
    let rank7 = 0;
    for (let s = 1; s <= 200; s++) {
      const grinder = s % 4 !== 0;
      const life = play(s * 2654435761, seen, grinder);
      expect(life.alive).toBe(false);
      expect(masters(life).length).toBe(10);
      expect(alignment(life)).toBeGreaterThanOrEqual(-100);
      expect(alignment(life)).toBeLessThanOrEqual(100);
      expect(JSON.parse(JSON.stringify(life))).toEqual(life);
      if (life.power && grinder) {
        cultivators++;
        const k = rankLabel(life, life.power.rank);
        ranks[k] = (ranks[k] ?? 0) + 1;
        if (life.power.rank === 8) xian++;
        if (life.power.rank >= 7) rank7++;
        if (life.power.rank >= 6) causes[life.causeOfDeath ?? "?"] = (causes[life.causeOfDeath ?? "?"] ?? 0) + 1;
        cps.push(combatPower(life));
      }
      if (wasRanked(life)) {
        ranked++;
        const b = String(life.flags.m17Best);
        best[b] = (best[b] ?? 0) + 1;
      }
      if (life.flags.m17Top) top++;
      if (mySect(life)) sects++;
      if (life.flags.m17BigSect) bigSect++;
      const led = ledger(life);
      favors += led.filter((e) => e.k === "f").length;
      grudges += led.filter((e) => e.k === "g").length;
      cashed += led.filter((e) => e.d).length;
      if (alignment(life) >= 60) saints++;
      if (alignment(life) <= -60) demons++;
      void myPlace;
    }
    cps.sort((a, b) => a - b);
    const missing = M17_EVENTS.map((e) => e.id).filter((id) => !seen.has(id));
    console.log("SIM M17 ขั้นตอนจบ (บอทสายบู๊)", JSON.stringify(ranks), "| เซียน", xian, "/", cultivators, `(${((xian / Math.max(1, cultivators)) * 100).toFixed(1)}%)`);
    console.log("SIM M17 ขั้น≥เหนือธรรมชาติ", rank7, "| สาเหตุการตายของขั้น≥ยอดยุทธ์", JSON.stringify(Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 10)));
    console.log("SIM M17 พลังต่อสู้ตอนจบ p25/p50/p90", cps[cps.length >> 2], cps[cps.length >> 1], cps[Math.floor(cps.length * 0.9)]);
    console.log("SIM M17 ติดทำเนียบ", ranked, "/200 | อันดับหนึ่ง", top, "| อันดับดีที่สุด", JSON.stringify(best));
    console.log("SIM M17 สำนักของตัวเอง", sects, "| สำนักใหญ่ 100 ศิษย์", bigSect, "| ธรรมะ≥60", saints, "| มาร≤-60", demons);
    console.log("SIM M17 สมุดบุญคุณ", favors, "| ความแค้น", grudges, "| ชำระแล้ว", cashed);
    console.log("SIM M17 event ที่ไม่เคยเกิด", missing.length, missing.join(","));
    expect(ranked).toBeGreaterThan(10);
    expect(sects).toBeGreaterThan(5);
    expect(favors + grudges).toBeGreaterThan(100);
    expect(xian / cultivators).toBeLessThan(0.2);
  });
});
