import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { canEnterGate, enterGate } from "../content/hunter/events/gates";
import { loadMurimWorld } from "../content/murim";
import { loadOrdinaryWorld } from "../content/ordinary";
import { loadSharedEvents } from "../content/shared";
import { loadTowerWorld } from "../content/tower";
import { floorOf } from "../content/tower/climb";
import { M19_EVENTS } from "../content/tower/m19";
import { RULES, longBets, ruleFor, teamSize, wagerStats } from "../content/tower/m19sys";
import { allEvents, visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

const seenEvents = new Set<string>();
const rulesSeen = new Set<string>();

function drain(life: Life, r: { rng: number }) {
  let guard = 0;
  while (life.queue.length) {
    const q = life.queue[0];
    seenEvents.add(q.eventId);
    if (q.eventId === "tower.climb" && !q.scene) rulesSeen.add(String(q.ctx.rule));
    const o = visibleChoices(life, q);
    expect(o.length, `ไม่มีตัวเลือกใน ${q.eventId}/${q.scene ?? "start"}`).toBeGreaterThan(0);
    const pool = o.filter(({ c }) => typeof c.label !== "string" || !c.label.includes("ปฏิเสธคำเชิญ"));
    resolveChoice(life, pool[Math.floor(nextFloat(r) * pool.length)].index);
    expect(++guard, "ฉากวนไม่จบ").toBeLessThan(200);
  }
}

describe("M19 หอคอย: กฎประจำชั้น · ทีม · โต๊ะพนันของดวงดาว", () => {
  it("มี event ใหม่อย่างน้อย 150 อัน id ขึ้นต้น t19. และลงทะเบียนแล้ว", () => {
    expect(M19_EVENTS.length).toBeGreaterThanOrEqual(150);
    const ids = new Set(allEvents().map((e) => e.id));
    for (const e of M19_EVENTS) {
      expect(e.id.startsWith("t19.")).toBe(true);
      expect(ids.has(e.id)).toBe(true);
      expect(e.world ?? "tower").toBe("tower");
    }
  });

  it("กฎของช่วงชั้นตายตัวต่อชีวิต และช่วงชั้นแรกคือกฎข้อแรก", () => {
    const l = createLife({ seed: 42, worldId: "tower" });
    expect(ruleFor(l, 1).id).toBe("first");
    expect(ruleFor(l, 23).id).toBe(ruleFor(l, 25).id);
    const used = new Set<string>();
    for (let s = 1; s <= 30; s++) for (let f = 6; f <= 100; f += 5) used.add(ruleFor(createLife({ seed: s, worldId: "tower" }), f).id);
    expect(used.size).toBeGreaterThanOrEqual(RULES.length - 2);
  });

  it("บอทปีนหอคอย 200 ชีวิตจนจบโดยไม่ติด และอัตราถึงยอดอยู่ในช่วงที่ตั้งไว้", () => {
    const N = 200;
    const floors: number[] = [];
    let climbers = 0, top = 0, withTeam = 0, maxTeam = 0, wagers = 0, wagerWins = 0, thrown = 0, rigged = 0, fallen = 0, longB = 0, rivals = 0;
    for (let s = 1; s <= N; s++) {
      const life = createLife({ seed: s * 7919 + 13, worldId: "tower" });
      const r = { rng: s * 31 };
      while (life.alive && life.age < 120) {
        drain(life, r);
        if (!life.alive) break;
        if (life.power && life.job?.careerId !== "climber" && !life.flags.t19citizen) applyJob(life, "climber");
        if (life.power) {
          for (let k = 0; k < 3 && life.alive; k++) {
            const target = Math.min(life.power.rank + (nextFloat(r) < 0.3 ? 1 : 0), 8);
            if (canEnterGate(life, target)) break;
            enterGate(life, target);
            drain(life, r);
          }
        }
        maxTeam = Math.max(maxTeam, teamSize(life));
        if (!life.alive) break;
        ageUp(life);
      }
      drain(life, r);
      expect(life.alive).toBe(false);
      if (life.power) { climbers++; floors.push(floorOf(life)); }
      if (life.flags.towerTop) top++;
      if (life.flags.t19team) withTeam++;
      const w = wagerStats(life);
      wagers += w.n; wagerWins += w.won; thrown += w.thrown; rigged += w.rigged;
      fallen += Number(life.flags.t19fallen ?? 0);
      longB += longBets(life).length;
      if (Number(life.flags.t19grudge ?? 0) >= 2) rivals++;
    }
    floors.sort((a, b) => a - b);
    const q = (p: number) => floors[Math.floor((floors.length - 1) * p)];
    const m19seen = M19_EVENTS.filter((e) => seenEvents.has(e.id)).length;
    console.log(
      "SIM M19 ผู้ท้าชิง", climbers, "/", N,
      "| ชั้น p25/p50/p90", q(0.25), q(0.5), q(0.9),
      "| ถึงยอด", top, `(${((top / N) * 100).toFixed(1)}%)`,
      "| ตั้งทีม", withTeam, "ทีมใหญ่สุด", maxTeam, "สมาชิกตาย", fallen,
      "| เดิมพัน", wagers, "ชนะ", wagerWins, "แกล้งแพ้", thrown, "ล้มโต๊ะ", rigged, "ค้างระยะยาว", longB, "มีดาวคู่แข่งแค้น", rivals,
      "| กฎที่เจอ", rulesSeen.size, "/", RULES.length,
      "| event M19 ที่เกิด", m19seen, "/", M19_EVENTS.length,
    );
    expect(climbers).toBeGreaterThan(N * 0.6);
    expect(withTeam).toBeGreaterThan(climbers * 0.3);
    expect(wagers).toBeGreaterThan(N);
    expect(rulesSeen.size).toBeGreaterThanOrEqual(RULES.length - 2);
    expect(top / N).toBeGreaterThan(0.03);
    expect(top / N).toBeLessThan(0.11);
    expect(m19seen).toBeGreaterThan(M19_EVENTS.length * 0.7);
  });
});
