import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { BUILDINGS, build, canBuild, getBase, levelSum, setPolicy, type BuildingId } from "../content/apocalypse/base";
import { canExpedition, canTrade, startExpedition, startTrade } from "../content/apocalypse/m20core";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { canEnterGate, enterGate } from "../content/hunter/events/gates";
import { loadMurimWorld } from "../content/murim";
import { loadOrdinaryWorld } from "../content/ordinary";
import { loadSharedEvents } from "../content/shared";
import { loadTowerWorld } from "../content/tower";
import { allEvents, getEvent, visibleChoices } from "./events";
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

/** บอทผู้นำฐาน: ปรับนโยบายตามเสบียง สร้างอาคารที่ขาด ออกสำรวจเมื่อแข็งแรง */
function manage(l: Life, r: { rng: number }) {
  const b = getBase(l);
  if (!b || !b.lead || l.flags.rebuilt) return;
  setPolicy(l, "ration", b.food < b.pop ? 2 : b.food > b.pop * 2.5 ? 0 : 1);
  setPolicy(l, "door", b.food > b.pop * 1.5 && b.water > b.pop ? 0 : b.food < b.pop * 0.6 ? 2 : 1);
  const want: BuildingId[] = [];
  if (b.food < b.pop * 1.2) want.push("farm");
  if (b.water < b.pop) want.push("well");
  want.push("wall", "farm", "well", "clinic", "shop", "tower", "school");
  for (let k = 0; k < 2; k++) {
    const id = want.find((x) => !canBuild(l, x));
    if (!id) break;
    build(l, id);
  }
  if (canExpedition(l) && l.stats.health > 45) startExpedition(l, Math.floor(nextFloat(r) * 4));
  else if (canTrade(l) && nextFloat(r) < 0.5) startTrade(l);
}

function drain(l: Life, r: { rng: number }, onEvent?: (id: string) => void) {
  while (l.queue.length) {
    const id = l.queue[0].eventId;
    onEvent?.(id);
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${id} (ฉาก ${l.queue[0].scene ?? "start"})`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("M20 ฐานของคุณ", () => {
  it("มี event a20.* อย่างน้อย 150 อัน", () => {
    const ids = allEvents().filter((e) => e.id.startsWith("a20."));
    console.log("SIM M20 event ใหม่", ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(150);
  });

  it("จำลอง 200 ชีวิต: ตั้งฐาน บริหาร วิกฤต และกลายเป็นเมือง", () => {
    const N = 200;
    let doomed = 0, diedAtDoom = 0, bases = 0, towns = 0, heroes = 0, lostLead = 0;
    const peaks: number[] = [], levels: number[] = [], crises: number[] = [];
    const seen = new Set<string>();
    const causes: Record<string, number> = {};
    for (let s = 1; s <= N; s++) {
      const life = createLife({ seed: s * 7919 + 13, worldId: "apocalypse" });
      const r = { rng: s * 31 };
      while (life.alive && life.age < 120) {
        drain(life, r, (id) => {
          if (id.startsWith("a20.")) seen.add(id);
        });
        if (!life.alive) {
          if (life.causeOfDeath?.includes("ฉากภารกิจแรก")) diedAtDoom++;
          break;
        }
        if (life.power && life.job?.careerId !== "survivor") applyJob(life, "survivor");
        if (life.power && !life.flags.rebuilt) {
          if (!canEnterGate(life, life.power.rank) && nextFloat(r) < 0.6) {
            enterGate(life, life.power.rank);
            drain(life, r);
          }
          if (life.alive) {
            manage(life, r);
            drain(life, r, (id) => seen.add(id));
          }
        }
        if (!life.alive) break;
        ageUp(life);
      }
      expect(life.alive).toBe(false);
      const b = getBase(life);
      if (b) {
        bases++;
        peaks.push(b.peak);
        levels.push(levelSum(b));
        crises.push(b.crises);
        if (b.town) towns++;
        if (!b.lead) lostLead++;
      }
      if (life.flags.doomed) doomed++;
      if (life.flags.apocHero) heroes++;
      if (life.flags.doomed) {
        const k = (life.causeOfDeath ?? "").slice(0, 36);
        causes[k] = (causes[k] ?? 0) + 1;
      }
    }
    const med = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0);
    console.log("SIM M20 ถึงวันสิ้นโลก", doomed, "/", N, "| ตายคืนแรก", diedAtDoom, `(${((diedAtDoom / Math.max(1, doomed)) * 100).toFixed(1)}%)`);
    console.log("SIM M20 มีฐาน", bases, "| ประชากรสูงสุด p50", med(peaks), "max", Math.max(0, ...peaks), "| เลเวลอาคารรวม p50", med(levels), "| วิกฤต p50", med(crises), "| เป็นเมือง", towns, "| ฮีโร่", heroes, "| ไม่ได้เป็นผู้นำตอนจบ", lostLead);
    console.log("SIM M20 สาเหตุตาย", JSON.stringify(Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 8)));
    console.log("SIM M20 event a20 ที่เกิดจริง", seen.size);
    expect(doomed).toBeGreaterThan(N * 0.7);
    expect(diedAtDoom / doomed).toBeLessThan(0.14);
    expect(bases).toBeGreaterThan(doomed * 0.6);
    expect(towns).toBeGreaterThan(3);
    expect(med(levels)).toBeGreaterThan(2);
    expect(seen.size).toBeGreaterThan(100);
    expect(getEvent("a20.found")).toBeDefined();
  });

  it("ฐานไม่ทำให้คนที่ไม่ใช่โลกวันสิ้นโลกได้ฐาน", () => {
    const life = createLife({ seed: 99, worldId: "hunter" });
    for (let i = 0; i < 40 && life.alive; i++) {
      drain(life, { rng: i });
      ageUp(life);
    }
    expect(life.flags.base).toBeUndefined();
    expect(BUILDINGS.length).toBe(7);
  });
});
