import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadCourtWorld } from "../content/court";
import { M18_EVENTS } from "../content/court/m18";
import { FACTIONS, SCHEMES, dominant, fac, pow, rumors, schemeReady, soc, startScheme } from "../content/court/politics";
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

describe("M18 การเมืองราชสำนัก", () => {
  it("มี event ใหม่อย่างน้อย 150 อัน และ id ขึ้นต้นด้วย c18.", () => {
    expect(M18_EVENTS.length).toBeGreaterThanOrEqual(150);
    for (const e of M18_EVENTS) expect(e.id.startsWith("c18.")).toBe(true);
  });

  it("จำลอง 200 ชีวิต: ทุกฉากมีตัวเลือก ชีวิตจบได้ และระบบขั้วอำนาจ/ข่าวลือ/แผนการทำงาน", () => {
    const N = 200;
    const seenIds = new Set<string>();
    const dom: Record<string, number> = {};
    let schemes = 0, rumorsMade = 0, ended = 0, defied = 0, executed = 0, villains = 0, socSum = 0;
    const facSum: Record<string, number> = { royal: 0, temple: 0, noble: 0 };
    for (let s = 1; s <= N; s++) {
      const life = createLife({ seed: s * 2654435761, worldId: "court" });
      const r = { rng: s * 7 };
      while (life.alive && life.age < 120) {
        while (life.queue.length) {
          const id = life.queue[0].eventId;
          if (id.startsWith("c18.")) seenIds.add(id);
          const o = visibleChoices(life, life.queue[0]);
          expect(o.length, `ไม่มีตัวเลือกใน ${id} (ฉาก ${life.queue[0].scene ?? "start"})`).toBeGreaterThan(0);
          resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
        }
        if (!life.alive) break;
        // ผู้เล่นเริ่มแผนการเองบ้าง
        if (schemeReady(life) && nextFloat(r) < 0.35) {
          startScheme(life, SCHEMES[Math.floor(nextFloat(r) * SCHEMES.length)].id);
          schemes++;
          continue;
        }
        ageUp(life);
      }
      for (const k of Object.keys(life.seen)) if (k.startsWith("c18.")) seenIds.add(k);
      if (!life.alive) ended++;
      if (life.age < 6) continue;
      expect(life.flags.pol, "ระบบการเมืองถูกตั้งค่า").toBe(true);
      const total = FACTIONS.reduce((a, f) => a + pow(life, f), 0);
      expect(total).toBe(100);
      for (const f of FACTIONS) {
        expect(fac(life, f)).toBeGreaterThanOrEqual(-100);
        expect(fac(life, f)).toBeLessThanOrEqual(100);
        expect(pow(life, f)).toBeGreaterThanOrEqual(5);
        facSum[f] += fac(life, f);
      }
      expect(rumors(life).length).toBeLessThanOrEqual(6);
      dom[dominant(life)] = (dom[dominant(life)] ?? 0) + 1;
      rumorsMade += Number(life.flags.rumorsMade ?? 0);
      socSum += soc(life);
      if (life.flags.role === "villain") {
        villains++;
        if (life.flags.fateDefied) defied++;
        if (String(life.causeOfDeath ?? "").includes("กิโยติน")) executed++;
      }
    }
    console.log(
      "SIM M18 ชีวิต", N, "| จบ", ended, "| event c18 ที่เกิด", seenIds.size, "/", M18_EVENTS.length,
      "| แผนการ", schemes, "| ข่าวลือที่เกิด", rumorsMade, "| ความนิยมเฉลี่ย", Math.round(socSum / N),
      "| ท่าทีเฉลี่ย", JSON.stringify(Object.fromEntries(FACTIONS.map((f) => [f, Math.round(facSum[f] / N)]))),
      "| ขั้วที่ชนะตอนจบ", JSON.stringify(dom), "| ตัวร้าย", villains, "รอด", defied, "ถูกประหาร", executed,
    );
    expect(ended).toBe(N);
    expect(seenIds.size).toBeGreaterThan(M18_EVENTS.length * 0.6);
    expect(schemes).toBeGreaterThan(50);
    expect(rumorsMade).toBeGreaterThan(N);
    expect(Object.keys(dom).length).toBeGreaterThan(1);
  });
});
