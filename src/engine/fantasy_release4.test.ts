import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { ftLiving } from "../content/fantasy/economy";
import { setRace } from "../content/fantasy/life";
import { RITES, inYouth, prejudice, riteState } from "../content/fantasy/races";
import { addStanding, fl, type RaceId } from "../content/fantasy/state";
import { careerById } from "../content/core/careers";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, jobChance, resolveChoice } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, race: RaceId, age: number): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  setRace(l, race); l.age = age; l.queue = []; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};

describe("พิธีของเผ่า", () => {
  it("แต่ละเผ่าถึงพิธีตามอายุของเผ่าตัวเอง และผ่านแล้วได้ของติดตัว", () => {
    for (const r of Object.keys(RITES) as RaceId[]) {
      const l = life(11, r, RITES[r].age - 1);
      ageUp(l);
      const q = l.queue.find((x) => x.eventId === `ft.rc.rite_${r}`);
      expect(q, r).toBeTruthy();
      l.queue = [q!];
      const before = { body: fl(l).body, magic: fl(l).magic };
      // เลือกทางแรกซ้ำจนผ่าน (ใช้ seed ต่างกัน)
      const ev = getEvent(q!.eventId)!;
      const vis = visibleChoices(l, q!);
      expect(vis.length).toBe(3);
      expect(labelOf(ev.choices![vis[2].index], l, q!.ctx)).toMatch(/ไม่เข้าร่วม/);
      resolveChoice(l, vis[0].index);
      expect(riteState(l), r).toMatch(/passed|failed/);
      if (riteState(l) === "passed" && (r === "orc" || r === "elf")) expect(fl(l).body + fl(l).magic).toBeGreaterThan(before.body + before.magic);
    }
  });
  it("เผ่าอายุยืนมีวัยเยาว์ระหว่าง 18 ปีถึงวันพิธี", () => {
    const e = life(12, "elf", 30);
    expect(inYouth(e)).toBe(true);
    const h = life(13, "human", 30);
    expect(inYouth(h)).toBe(false);
  });
});

describe("อคติที่เอาชนะได้", () => {
  it("ทายาทปีศาจถูกระแวงจนได้งานยากและของแพง แต่ชื่อเสียงกับการยอมรับลดอคติลง", () => {
    const d = life(14, "demon", 25);
    const h = life(14, "human", 25);
    expect(prejudice(d)).toBe(2);
    expect(prejudice(h)).toBe(0);
    const c = careerById("ft_merchant")!;
    const job0 = jobChance(d, c), cost0 = ftLiving(d, 0, 0);
    d.fame = 50;
    expect(prejudice(d)).toBe(1);
    addStanding(d, 80);
    expect(prejudice(d)).toBe(0);
    expect(jobChance(d, c)).toBeGreaterThan(job0);
    expect(ftLiving(d, 0, 0)).toBeLessThan(cost0);
  });
});
