import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { loadMurimWorld } from "../content/murim";
import { loadOrdinaryWorld } from "../content/ordinary";
import { loadSharedEvents } from "../content/shared";
import { loadTowerWorld } from "../content/tower";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

describe("M13 อะคาเดมี", () => {
  it("เข้าเรียน เลือกหอ สอบจัดอันดับทุกปี และจบการศึกษาได้", () => {
    let enrolled = 0, graduated = 0, top = 0, expelled = 0, ch3 = 0, ch3Dead = 0, exams = 0;
    const houses: Record<string, number> = {};
    const N = 300;
    for (let s = 1; s <= N; s++) {
      const life = createLife({ seed: s * 2246822519, worldId: "court" });
      const r = { rng: s };
      while (life.alive && life.age < 120) {
        while (life.queue.length) {
          const id = life.queue[0].eventId;
          const o = visibleChoices(life, life.queue[0]);
          expect(o.length, `ไม่มีตัวเลือกใน ${id}`).toBeGreaterThan(0);
          resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
          if (id === "aca.chapter3" && !life.alive) ch3Dead++;
        }
        if (!life.alive) break;
        ageUp(life);
      }
      if (life.flags.academy) enrolled++;
      if (life.flags.acaHouse) houses[String(life.flags.acaHouse)] = (houses[String(life.flags.acaHouse)] ?? 0) + 1;
      if (life.flags.acaGrad) graduated++;
      if (life.flags.acaTop) top++;
      if (life.flags.acaExpelled) expelled++;
      if (life.seen["aca.chapter3"]) ch3++;
      exams += life.seen["aca.ranking"] ?? 0;
    }
    console.log("SIM M13 เข้าเรียน", enrolled, "/", N, "| หอ", JSON.stringify(houses), "| สอบรวม", exams, "| จบ", graduated, "| ที่หนึ่ง", top, "| ถูกไล่ออก", expelled, "| บทที่ 3", ch3, "ตาย", ch3Dead);
    expect(enrolled).toBeGreaterThan(N * 0.4);
    expect(graduated).toBeGreaterThan(enrolled * 0.5);
    expect(exams).toBeGreaterThan(graduated * 4);
    expect(top).toBeLessThan(graduated * 0.2);
  });
});
