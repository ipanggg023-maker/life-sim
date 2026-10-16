import { describe, expect, it } from "vitest";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { canEnterGate, enterGate } from "../content/hunter/events/gates";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { loadTowerWorld } from "../content/tower";
import { loadApocalypseWorld } from "../content/apocalypse";
import { floorOf } from "../content/tower/climb";
import { visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Country, Life } from "./types";
import { displayName, money } from "./util";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadSharedEvents();

function drain(life: Life, r: { rng: number }) {
  while (life.queue.length) {
    const o = visibleChoices(life, life.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${life.queue[0].eventId}`).toBeGreaterThan(0);
    // บอทไม่ปฏิเสธคำเชิญ (อยากทดสอบการปีน) — เลือกตัวแรกที่ไม่ใช่ "ปฏิเสธ"
    const pool = o.filter(({ c }) => typeof c.label !== "string" || !c.label.includes("ปฏิเสธคำเชิญ"));
    resolveChoice(life, pool[Math.floor(nextFloat(r) * pool.length)].index);
  }
}

describe("M10 หอคอย + ประเทศ", () => {
  it("บอทผู้ท้าชิงปีนหอคอยได้โดยไม่พัง และชั้นกระจายตามระดับ", () => {
    const floors: number[] = [];
    let climbers = 0, top = 0, sponsored = 0, deathsInTower = 0;
    const N = 250;
    for (let s = 1; s <= N; s++) {
      const life = createLife({ seed: s * 2654435761, worldId: "tower" });
      const r = { rng: s };
      while (life.alive && life.age < 120) {
        drain(life, r);
        if (!life.alive) break;
        if (life.power && life.job?.careerId !== "climber") applyJob(life, "climber");
        if (life.power) {
          // ท้าทายระดับสูงสุดที่ยังปลอดภัยพอ ปีละสามครั้ง
          for (let k = 0; k < 3 && life.alive; k++) {
            const target = Math.min(life.power.rank + (nextFloat(r) < 0.3 ? 1 : 0), 8);
            if (canEnterGate(life, target)) break;
            enterGate(life, target);
            drain(life, r);
          }
        }
        if (!life.alive) break;
        ageUp(life);
      }
      expect(life.alive).toBe(false);
      if (life.power) {
        climbers++;
        floors.push(floorOf(life));
      }
      if (life.flags.towerTop) top++;
      if (life.flags.sponsor && life.flags.sponsor !== "none") sponsored++;
      if (/หอคอย|ชั้น/.test(life.causeOfDeath ?? "")) deathsInTower++;
    }
    floors.sort((a, b) => a - b);
    const q = (p: number) => floors[Math.floor((floors.length - 1) * p)];
    console.log("SIM M10 ผู้ท้าชิง", climbers, "/", N, "| ชั้น p25/p50/p90", q(0.25), q(0.5), q(0.9), "| ถึงยอด", top, "| มีสปอนเซอร์", sponsored, "| ตายในหอคอย", deathsInTower);
    expect(climbers).toBeGreaterThan(N * 0.6);
    expect(q(0.5)).toBeGreaterThan(5);
  });

  it("สุ่มประเทศ ไทย/เกาหลี/ญี่ปุ่น และแปลงชื่อ เงิน สถานที่ ตามประเทศ", () => {
    const count: Record<Country, number> = { th: 0, kr: 0, jp: 0 };
    for (let s = 1; s <= 300; s++) count[createLife({ seed: s * 97, worldId: "hunter" }).country!]++;
    console.log("SIM M10 ประเทศ", JSON.stringify(count));
    for (const c of ["th", "kr", "jp"] as Country[]) expect(count[c]).toBeGreaterThan(60);

    const kr = createLife({ seed: 5, worldId: "hunter", country: "kr" });
    expect(money(kr, 1000)).toBe("₩40,000");
    expect(kr.log.map((e) => e.text).join(" ")).toContain("โซล");
    expect(kr.log.map((e) => e.text).join(" ")).not.toContain("กรุงเทพ");
    expect(displayName(kr)).toBe(`${kr.lastName} ${kr.firstName}`);

    const jp = createLife({ seed: 6, worldId: "tower", country: "jp" });
    expect(money(jp, 1000)).toBe("¥4,000");
    // โลกแฟนตาซีไม่มีประเทศ
    expect(createLife({ seed: 7, worldId: "murim" }).country).toBeUndefined();
  });
});
